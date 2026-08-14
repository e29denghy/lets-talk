import { reactive, readonly } from 'vue';
import { MicRecorder } from '../lib/audio/recorder';
import { PcmPlayer } from '../lib/audio/player';
import { EnergyVad } from '../lib/audio/vad';
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
let vad: EnergyVad | null = null;
let uploader: ChunkUploader | null = null;
let socket: WebSocket | null = null;

let aiSpeaking = false;
let studentSpeaking = false;
let studentTranscriptSeen = false;
let manualClose = false;
let suppressAiAudio = false;
let latencyAnchor: number | null = null;
let turns: TurnInput[] = [];
let nextSeq = 1;
let durationTimer: number | null = null;
let sessionStartedAt = 0;

const VISITOR_COOKIE = 'lets_talk_visitor';

async function ensureVisitor(nickname?: string, grade?: number): Promise<void> {
    if (document.cookie.includes(`${VISITOR_COOKIE}=`)) return;
    await api.registerVisitor({ nickname, grade });
}

/** 开始一次语音会话（必须在用户点击手势中调用）。 */
async function start(scenarioId: number, nickname?: string, grade?: number): Promise<void> {
    if (state.status === 'connecting' || state.status === 'listening' || state.status === 'thinking' || state.status === 'speaking') {
        return;
    }

    reset();
    state.status = 'connecting';

    try {
        await ensureVisitor(nickname, grade);

        // 用户手势内解锁自动播放
        player = new PcmPlayer();
        await player.unlock();

        const result = await api.startSession(scenarioId);
        state.sessionId = result.session.id;
        state.quota = result.quota;
        sessionStartedAt = Date.now();

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

/** 学生 PCM 帧处理：本地 VAD 控制起止、上行、录音、打断判定。 */
function onStudentPcm(pcm: Int16Array): void {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    vad ??= new EnergyVad({ threshold: 0.02, hangoverMs: 450 });

    const active = vad.process(pcm);

    if (active) {
        uploader?.append('student', pcm);

        if (!studentSpeaking) {
            // 学生新开口：若 AI 正在说/思考 → 打断
            if (aiSpeaking || state.status === 'thinking') {
                interrupt();
            }
            studentSpeaking = true;
            studentTranscriptSeen = false;
        }

        socket.send(qwen.appendAudio(pcm));
        return;
    }

    if (studentSpeaking) {
        studentSpeaking = false;
        socket.send(qwen.commitAudio());
        state.status = 'thinking';
        latencyAnchor = performance.now();
    }
}

/** 打断 AI：取消生成 + 清空播放队列，回到聆听状态。 */
function interrupt(): void {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(qwen.cancelResponse());
    }

    player?.flush();
    aiSpeaking = false;
    suppressAiAudio = true;
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

        const transcript = qwen.normalizeEvent(parsed);

        if (transcript) {
            addSubtitle(transcript.speaker, transcript.text);

            if (transcript.speaker === 'student' && !studentTranscriptSeen) {
                studentTranscriptSeen = true;
                addTurn('student', transcript.text);
            } else if (transcript.speaker === 'assistant') {
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

                    // 记录首包延迟到最近一条学生回合
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
            aiSpeaking = false;
            suppressAiAudio = false;

            if (state.status === 'speaking') {
                state.status = 'listening';
            }
        }

        return;
    }

    if (event.data instanceof ArrayBuffer) {
        // 供应商直接下发二进制 PCM 帧的情况
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

        const timeout = window.setTimeout(() => {
            ws.close();
            reject(new Error('连接语音服务超时，请稍后重试'));
        }, 15000);

        ws.onopen = () => {
            window.clearTimeout(timeout);

            const preset = (result.credentials.session_init ?? { session: {} }) as {
                session: Record<string, unknown>;
            };
            ws.send(qwen.sessionInit(preset, result.system_prompt));

            ws.onmessage = onSocketMessage;
            resolve();
        };

        ws.onerror = () => {
            window.clearTimeout(timeout);
            reject(new Error('无法连接语音服务，请检查网络或服务商配置'));
        };

        ws.onclose = () => {
            if (!manualClose && state.status !== 'ended' && state.status !== 'error') {
                state.status = 'error';
                state.error = '语音连接已断开';
                void teardown();
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

    vad = null;

    try {
        socket?.close(1000, 'session done');
    } catch {
        // noop
    }
    socket = null;

    aiSpeaking = false;
    studentSpeaking = false;
    latencyAnchor = null;
}

function reset(): void {
    manualClose = false;
    suppressAiAudio = false;
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
