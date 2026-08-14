import { reactive, readonly } from 'vue';
import { MicRecorder } from '../lib/audio/recorder';
import { PcmPlayer } from '../lib/audio/player';
import { rmsEnergy } from '../lib/audio/vad';
import { ChunkUploader } from '../lib/audio/uploader';
import * as qwen from '../lib/providers/qwenOmniClient';
import { api, type SessionStartResponse, type TurnInput } from '../lib/api';

export type VoiceStatus =
    | 'idle'
    | 'connecting'
    | 'listening'
    | 'thinking'
    | 'speaking'
    | 'ended'
    | 'error';

export interface Subtitle {
    speaker: 'student' | 'assistant';
    text: string;
    at: number;
}

interface VoiceState {
    status: VoiceStatus;
    error: string | null;
    sessionId: number | null;
    subtitles: Subtitle[];
    quota: { used_seconds: number; limit_seconds: number } | null;
    durationS: number;
    uploadedStudentBytes: number;
    uploadedAiBytes: number;
}

const state = reactive<VoiceState>({
    status: 'idle',
    error: null,
    sessionId: null,
    subtitles: [],
    quota: null,
    durationS: 0,
    uploadedStudentBytes: 0,
    uploadedAiBytes: 0,
});

let recorder: MicRecorder | null = null;
let player: PcmPlayer | null = null;
let uploader: ChunkUploader | null = null;
let socket: WebSocket | null = null;

let aiSpeaking = false;
let lastStudentItemId: string | null = null;
let manualClose = false;
let suppressAiAudio = false;
let latencyAnchor: number | null = null;
let sessionConfigured = false;
let pendingSessionUpdate: string | null = null;
let reconnectAttempts = 0;
let activeResult: SessionStartResponse | null = null;
let turns: TurnInput[] = [];
let nextSeq = 1;
let durationTimer: number | null = null;
let sessionStartedAt = 0;

const VISITOR_COOKIE = 'lets_talk_visitor';

// AI 说话期间的插话判定阈值：麦克风帧能量超过它才算「学生开口」。
// 低于该值的帧（包括扬声器回声）在 AI 说话期间不会发给服务端，防止回声自激循环。
const BARGE_IN_RMS = 0.08;

async function ensureVisitor(nickname?: string, grade?: number): Promise<void> {
    if (document.cookie.includes(`${VISITOR_COOKIE}=`)) return;
    await api.registerVisitor({ nickname, grade });
}

/** 开始一次语音会话（必须在用户点击手势中调用）。 */
async function start(
    scenarioId: number,
    language: 'en' | 'zh' = 'en',
    nickname?: string,
    grade?: number,
): Promise<void> {
    if (state.status === 'connecting' || state.status === 'listening' || state.status === 'thinking' || state.status === 'speaking') {
        return;
    }

    reset();
    state.status = 'connecting';

    try {
        await ensureVisitor(nickname, grade);

        const result = await api.startSession(scenarioId, language);
        activeResult = result;
        state.sessionId = result.session.id;
        state.quota = result.quota;
        sessionStartedAt = Date.now();

        // 用户手势内解锁自动播放（AI 输出是 24kHz PCM）
        player = new PcmPlayer();
        await player.unlock(result.credentials.output_sample_rate ?? result.audio.sample_rate);

        // 预先组装 session.update，等收到 session.created 后发送
        prepareSessionUpdate(result);

        durationTimer = window.setInterval(() => {
            state.durationS = Math.floor((Date.now() - sessionStartedAt) / 1000);
        }, 1000);

        uploader = new ChunkUploader({
            buildUrl: (channel, seq) =>
                `/api/voice/sessions/${result.session.id}/audio/${channel}?seq=${seq}`,
            intervalMs: result.audio.chunk_interval_seconds * 1000,
            maxBytes: result.audio.max_chunk_bytes,
            onFlush: (channel, _seq, bytes, ok) => {
                if (ok) {
                    if (channel === 'student') state.uploadedStudentBytes += bytes;
                    else state.uploadedAiBytes += bytes;
                }
            },
        });

        recorder = new MicRecorder({
            targetSampleRate: result.audio.sample_rate,
            onPcm: onStudentPcm,
        });

        await openSocket(result);
        await recorder.start();

        state.status = 'listening';
    } catch (error) {
        state.status = 'error';
        state.error = error instanceof Error ? error.message : String(error);
        await teardown();
        throw error;
    }
}

/** 组装 session.update（收到 session.created 后由消息循环发送）。 */
function prepareSessionUpdate(result: SessionStartResponse): void {
    const preset = (result.credentials.session_init ?? { session: {} }) as {
        session: Record<string, unknown>;
    };
    pendingSessionUpdate = qwen.sessionUpdate(preset, result.system_prompt);
    sessionConfigured = false;
}

/**
 * 学生 PCM 帧处理：录音始终进行；推流分两种状态——
 *  1. AI 说话期间：只把「疑似学生插话」的响亮帧发给服务端（触发服务端打断），
 *     其余帧不上行——这是防回声自激的关键（否则 AI 的声音被麦克风拾取后
 *     会被服务端 VAD 当成学生在说话，形成无限循环）。
 *  2. 平时：全量推流，话轮由服务端 server_vad 判断。
 */
function onStudentPcm(pcm: Int16Array): void {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    uploader?.append('student', pcm);

    if (aiSpeaking) {
        if (rmsEnergy(pcm) >= BARGE_IN_RMS) {
            // 学生开口插话：本地立即静音，恢复推流让服务端完成打断
            player?.flush();
            suppressAiAudio = true;
            aiSpeaking = false;

            if (state.status === 'speaking') {
                state.status = 'listening';
            }

            socket.send(qwen.appendAudio(pcm));
        }
        return;
    }

    socket.send(qwen.appendAudio(pcm));
}

/** 手动打断（头像点击）：仅在 AI 生成中发送 cancel，避免「无响应可取消」的 error 事件。 */
function interrupt(): void {
    if (aiSpeaking && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(qwen.cancelResponse());
        suppressAiAudio = true;
    }

    player?.flush();
    aiSpeaking = false;
    latencyAnchor = null;

    if (state.status === 'speaking' || state.status === 'thinking') {
        state.status = 'listening';
    }
}

function onSocketMessage(event: MessageEvent): void {
    if (typeof event.data === 'string') {
        let parsed: qwen.QwenEvent;

        try {
            parsed = JSON.parse(event.data);
        } catch {
            return;
        }

        // 连接后第一个事件：拿到默认会话配置后发送我们的 session.update
        if (qwen.isSessionCreated(parsed) && !sessionConfigured && pendingSessionUpdate) {
            sessionConfigured = true;
            socket?.send(pendingSessionUpdate);
            pendingSessionUpdate = null;
            return;
        }

        // 服务端错误（如配置不合法）：展示但不中断会话
        if (parsed.type === 'error') {
            const message = (parsed.error as { message?: string } | undefined)?.message ?? '语音服务返回错误';
            state.error = message;
            return;
        }

        // 学生说完 → 进入思考（记录首包延迟锚点）
        if (qwen.isSpeechStopped(parsed)) {
            state.status = 'thinking';
            latencyAnchor = performance.now();
        }

        const transcript = qwen.normalizeEvent(parsed);

        if (transcript) {
            addSubtitle(transcript.speaker, transcript.text);

            if (transcript.speaker === 'student') {
                const itemId = typeof parsed.item_id === 'string' ? parsed.item_id : null;
                if (itemId === null || itemId !== lastStudentItemId) {
                    lastStudentItemId = itemId;
                    addTurn('student', transcript.text);
                }
            } else {
                addTurn('assistant', transcript.text);
            }
        }

        if (qwen.isAiAudioDelta(parsed)) {
            if (suppressAiAudio) {
                return;
            }

            const pcm = qwen.decodeAudio(parsed);

            if (pcm && pcm.length > 0) {
                if (!aiSpeaking) {
                    aiSpeaking = true;
                    state.status = 'speaking';

                    // 首包延迟记入最近一条学生回合
                    if (latencyAnchor !== null) {
                        const ms = Math.round(performance.now() - latencyAnchor);
                        for (let i = turns.length - 1; i >= 0; i--) {
                            if (turns[i].speaker === 'student' && !turns[i].latency_ms) {
                                turns[i].latency_ms = ms;
                                break;
                            }
                        }
                        latencyAnchor = null;
                    }
                }

                player?.push(pcm);
                uploader?.append('ai', pcm);
            }
        }

        if (qwen.isResponseDone(parsed) || qwen.isResponseCancelled(parsed)) {
            // 成本核算：把本次响应的 token 用量记到最近一条 AI 回合
            if (qwen.isResponseDone(parsed)) {
                const usage = qwen.extractUsage(parsed);
                if (usage) {
                    for (let i = turns.length - 1; i >= 0; i--) {
                        if (turns[i].speaker === 'assistant' && turns[i].input_audio_tokens === undefined) {
                            Object.assign(turns[i], usage);
                            break;
                        }
                    }
                }
            }

            aiSpeaking = false;
            suppressAiAudio = false;

            if (state.status === 'speaking') {
                state.status = 'listening';
            }
        }

        return;
    }

    if (event.data instanceof ArrayBuffer) {
        // 供应商若直接下发二进制 PCM 帧（非文档路径，兼容处理）
        const pcm = new Int16Array(event.data);

        if (pcm.length > 0) {
            if (!aiSpeaking) {
                aiSpeaking = true;
                state.status = 'speaking';
            }

            player?.push(pcm);
            uploader?.append('ai', pcm);
        }
    }
}

function addSubtitle(speaker: 'student' | 'assistant', text: string): void {
    state.subtitles.push({ speaker, text, at: Date.now() });
}

function addTurn(speaker: 'student' | 'assistant', text: string): void {
    turns.push({ seq: nextSeq++, speaker, text });
}

function openSocket(result: SessionStartResponse): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(result.credentials.ws_url);
        socket = ws;
        ws.onmessage = onSocketMessage;

        const timeout = window.setTimeout(() => {
            ws.close();
            reject(new Error('连接语音服务超时，请稍后重试'));
        }, 15000);

        ws.onopen = () => {
            window.clearTimeout(timeout);
            resolve();
        };

        ws.onerror = () => {
            window.clearTimeout(timeout);
            reject(new Error('无法连接语音服务，请检查网络或服务商配置'));
        };

        ws.onclose = async () => {
            if (manualClose || state.status === 'ended' || state.status === 'error') return;

            // 意外断线：重签 token 后自动重连（最多 2 次）
            if (reconnectAttempts >= 2 || state.sessionId === null || !activeResult) {
                state.status = 'error';
                state.error = '语音连接已断开';
                await teardown();
                return;
            }

            reconnectAttempts += 1;
            state.error = `连接断开，正在重连（第 ${reconnectAttempts} 次）…`;

            try {
                const fresh = await api.reissueSession(state.sessionId);
                prepareSessionUpdate({ ...activeResult, credentials: fresh.credentials });
                await openSocket({ ...activeResult, credentials: fresh.credentials });
                state.error = null;
            } catch {
                state.status = 'error';
                state.error = '重连失败，请结束本次练习后重试';
                await teardown();
            }
        };
    });
}

/** 结束会话：落库回合 + 封存音频与 timeline。 */
async function stop(): Promise<void> {
    if (state.status === 'ended' || state.sessionId === null) return;

    try {
        if (turns.length > 0) {
            await api.saveTurns(state.sessionId, turns);
        }

        const timeline = state.subtitles.map((s, index) => ({
            seq: index + 1,
            speaker: s.speaker,
            text: s.text,
        }));

        const result = await api.endSession(state.sessionId, timeline);
        state.quota = result.quota;
        state.durationS = result.session.duration_s;
    } catch (error) {
        state.error = error instanceof Error ? error.message : String(error);
    } finally {
        await teardown();
        state.status = 'ended';
    }
}

async function teardown(): Promise<void> {
    manualClose = true;

    if (durationTimer !== null) {
        window.clearInterval(durationTimer);
        durationTimer = null;
    }

    await uploader?.flushAll().catch(() => undefined);
    uploader?.destroy();
    uploader = null;

    await recorder?.stop().catch(() => undefined);
    recorder = null;

    player?.close();
    player = null;

    try {
        socket?.close(1000, 'session done');
    } catch {
        // noop
    }
    socket = null;

    aiSpeaking = false;
    latencyAnchor = null;
}

function reset(): void {
    manualClose = false;
    suppressAiAudio = false;
    sessionConfigured = false;
    pendingSessionUpdate = null;
    lastStudentItemId = null;
    reconnectAttempts = 0;
    activeResult = null;
    turns = [];
    nextSeq = 1;
    state.sessionId = null;
    state.subtitles = [];
    state.error = null;
    state.durationS = 0;
    state.uploadedStudentBytes = 0;
    state.uploadedAiBytes = 0;
    sessionStartedAt = 0;
}

/** 结束后回到初始状态（先尽力结束服务端会话，再清空本轮内容）。 */
async function dismiss(): Promise<void> {
    if (state.sessionId !== null && state.status !== 'ended') {
        await stop().catch(() => undefined);
    }

    reset();
    state.status = 'idle';
}

export function useVoiceChat() {
    return {
        state: readonly(state),
        start,
        stop,
        interrupt,
        dismiss,
    };
}
