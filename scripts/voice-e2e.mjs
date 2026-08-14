/**
 * Let's Talk 真实语音链路 E2E 验证（无需浏览器）。
 *
 * 流程：注册访客 → 开会话（拿到中继地址）→ 连中继 → session.update
 *      → 流式推送真实英语语音 PCM（16kHz mono）→ 服务端 VAD 断句
 *      → 期待：speech_started/stopped → 学生转写 → AI 音频帧（24k）→ AI 转写 → done
 *
 * 用法：
 *   # 生成测试语音（macOS 内置 TTS）
 *   say -o /tmp/e2e-speech.aiff "Hello! My name is Xiaoming. I like pandas."
 *   afconvert -f WAVE -d LEI16@16000 -c 1 /tmp/e2e-speech.aiff /tmp/e2e-speech.wav
 *
 *   node scripts/voice-e2e.mjs /tmp/e2e-speech.wav
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Agent, setGlobalDispatcher } from 'undici';
import WebSocket from 'ws';

// Node 不读 macOS 钥匙串：给 fetch 注入 Valet 自签 CA（浏览器不受影响，走系统钥匙串）
const valetCa = path.join(os.homedir(), '.config/valet/CA/LaravelValetCASelfSigned.pem');
if (fs.existsSync(valetCa)) {
    setGlobalDispatcher(new Agent({ connect: { ca: fs.readFileSync(valetCa) } }));
}

const APP = process.env.APP_URL || 'https://lets-talk.test';
const SCENARIO_ID = process.env.SCENARIO_ID || '1';
const WAV = process.argv[2];

if (!WAV || !fs.existsSync(WAV)) {
    console.error('用法: node scripts/voice-e2e.mjs <16kHz mono wav>');
    process.exit(1);
}

let cookie = '';

async function api(pathname, options = {}) {
    const headers = { Accept: 'application/json', ...(options.headers ?? {}) };
    if (cookie) headers.Cookie = cookie;
    if (options.body && typeof options.body === 'string') headers['Content-Type'] = 'application/json';

    const res = await fetch(`${APP}${pathname}`, { ...options, headers });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];

    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${pathname} -> HTTP ${res.status}: ${body?.message ?? ''}`);
    return body;
}

function wavToPcm16(file) {
    const buf = fs.readFileSync(file);
    const rate = buf.readUInt32LE(24);
    const channels = buf.readUInt16LE(22);
    const bits = buf.readUInt16LE(34);
    const dataOffset = buf.indexOf(Buffer.from('data')) + 8;
    const pcm = new Int16Array((buf.length - dataOffset) / 2);
    for (let i = 0; i < pcm.length; i++) {
        pcm[i] = buf.readInt16LE(dataOffset + i * 2);
    }
    console.log(`[e2e] 音频: ${rate}Hz ${channels}ch ${bits}bit, ${pcm.length} 样本 (${(pcm.length / rate).toFixed(1)}s)`);
    if (rate !== 16000 || channels !== 1) {
        console.error('[e2e] 请用 afconvert 转成 16kHz 单声道 WAV。');
        process.exit(1);
    }
    return pcm;
}

const pcm = wavToPcm16(WAV);

// 1) 访客登记
await api('/api/voice/visitors', {
    method: 'POST',
    body: JSON.stringify({ nickname: 'E2E-Test', grade: 3 }),
});
console.log('[e2e] 访客已登记');

// 2) 开会话
const start = await api('/api/voice/sessions', {
    method: 'POST',
    body: JSON.stringify({ scenario_id: Number(SCENARIO_ID) }),
});
console.log(`[e2e] 会话 #${start.session.id} 已创建`);
console.log(`[e2e] 中继地址: ${start.credentials.ws_url}`);
console.log(`[e2e] 场景提示词: ${start.system_prompt.slice(0, 80)}...`);

// 3) 连中继（带访客 Cookie，同真实浏览器行为）
const ws = new WebSocket(start.credentials.ws_url, {
    headers: { Cookie: cookie },
    rejectUnauthorized: false,
});

const stats = { aiAudioBytes: 0, aiAudioChunks: 0, studentText: '', aiText: '' };
const aiAudioParts = []; // 收集 AI 音频帧（base64 解码后），用于模拟浏览器录音上传
let updated = false;
let finished = false;

async function finish() {
    if (finished) return;
    finished = true;

    console.log('[e2e] ===== 汇总 =====');
    console.log(`[e2e] AI 音频: ${stats.aiAudioChunks} 帧 / ${(stats.aiAudioBytes / 1024).toFixed(1)} KB（24kHz PCM）`);
    console.log(`[e2e] 学生说: "${stats.studentText}"`);
    console.log(`[e2e] AI 答: "${stats.aiText}"`);

    // 5) 模拟浏览器录音上传（学生声道 + AI 声道）与结束会话
    try {
        const sessionId = start.session.id;
        await uploadAudio(sessionId, 'student', Buffer.from(pcm.buffer));
        if (aiAudioParts.length > 0) {
            await uploadAudio(sessionId, 'ai', Buffer.concat(aiAudioParts));
        }
        await api(`/api/voice/sessions/${sessionId}/turns`, {
            method: 'POST',
            body: JSON.stringify({
                turns: [
                    { seq: 1, speaker: 'student', text: stats.studentText },
                    { seq: 2, speaker: 'assistant', text: stats.aiText },
                ],
            }),
        });
        const end = await api(`/api/voice/sessions/${sessionId}/end`, {
            method: 'POST',
            body: JSON.stringify({ timeline: [{ seq: 1, speaker: 'student', text: stats.studentText }, { seq: 2, speaker: 'assistant', text: stats.aiText }] }),
        });
        console.log(`[e2e] 会话结束: 时长 ${end.session.duration_s}s / ${end.session.turn_count} 回合 / 配额已用 ${end.quota.used_seconds}s`);
        console.log(`[e2e] 回放地址: ${APP}/admin/sessions/${sessionId}（admin@example.com / password）`);
        console.log('[e2e] ===== 通过：对话 + 录音 + 落库 + 封存 全链路 OK =====');
    } catch (error) {
        console.error('[e2e] 收尾失败:', error.message);
        process.exitCode = 1;
    }

    ws.close();
    setTimeout(() => process.exit(process.exitCode ?? 0), 300);
}

async function uploadAudio(sessionId, channel, bytes) {
    const res = await fetch(`${APP}/api/voice/sessions/${sessionId}/audio/${channel}?seq=0`, {
        method: 'POST',
        headers: {
            Cookie: cookie,
            'Content-Type': 'application/octet-stream',
            Accept: 'application/json',
        },
        body: bytes,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`录音上传 ${channel}: HTTP ${res.status} ${body?.message ?? ''}`);
    console.log(`[e2e] 录音已上传: ${channel} ${(bytes.length / 1024).toFixed(1)} KB`);
}

function send(type, payload = {}) {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
        event_id: `evt_e2e_${Math.random().toString(36).slice(2)}`,
        type,
        ...payload,
    }));
}

ws.on('open', () => console.log('[e2e] 中继连接成功'));

ws.on('message', (data, isBinary) => {
    if (isBinary) {
        stats.aiAudioChunks += 1;
        stats.aiAudioBytes += data.length;
        return;
    }

    let ev;
    try {
        ev = JSON.parse(data.toString());
    } catch {
        return;
    }

    switch (ev.type) {
        case 'session.created':
            console.log(`[e2e] session.created (model=${ev.session?.model})`);
            send('session.update', {
                session: {
                    ...(start.credentials.session_init?.session ?? {}),
                    instructions: start.system_prompt,
                },
            });
            break;
        case 'session.updated':
            console.log('[e2e] session.updated —— 开始推流');
            pushAudio();
            break;
        case 'input_audio_buffer.speech_started':
            console.log('[e2e] VAD: 语音开始');
            break;
        case 'input_audio_buffer.speech_stopped':
            console.log('[e2e] VAD: 语音结束，服务端自动提交');
            break;
        case 'conversation.item.input_audio_transcription.completed':
            stats.studentText = ev.transcript;
            console.log(`[e2e] 学生转写: "${ev.transcript}"`);
            break;
        case 'response.audio.delta': {
            stats.aiAudioChunks += 1;
            stats.aiAudioBytes += Math.floor(((ev.delta ?? '').length * 3) / 4);
            try {
                aiAudioParts.push(Buffer.from(ev.delta ?? '', 'base64'));
            } catch {
                // 忽略坏帧
            }
            break;
        }
        case 'response.audio_transcript.done':
            stats.aiText = ev.transcript;
            console.log(`[e2e] AI 转写: "${ev.transcript}"`);
            break;
        case 'response.done':
            console.log('[e2e] response.done');
            setTimeout(finish, 600);
            break;
        case 'error':
            console.error('[e2e] 服务端错误:', JSON.stringify(ev.error));
            break;
        default:
            // 其余事件静默
    }
});

ws.on('close', (code) => {
    console.log(`[e2e] 连接关闭 code=${code}`);
    process.exit(code === 1000 ? 0 : 1);
});

ws.on('error', (error) => {
    console.error('[e2e] WebSocket 错误:', error.message);
    process.exit(1);
});

setTimeout(() => {
    console.error('[e2e] 超时（30s），链路未完成。');
    ws.close();
    process.exit(1);
}, 30000);

// 4) 推流：100ms/帧（16k → 3200 样本），与前端采集节奏一致；
//    推完语音后继续送静音帧（模拟真实麦克风），让服务端 VAD 听到静音从而断句
function pushAudio() {
    let offset = 0;
    const chunk = 3200;
    const silence = Buffer.alloc(chunk * 2); // 3200 个 0 样本
    let silenceFramesLeft = 25; // 再送 2.5 秒静音

    const timer = setInterval(() => {
        if (offset < pcm.length) {
            const slice = pcm.subarray(offset, Math.min(offset + chunk, pcm.length));
            offset += chunk;
            send('input_audio_buffer.append', {
                audio: Buffer.from(slice.buffer, slice.byteOffset, slice.byteLength).toString('base64'),
            });
            return;
        }

        if (silenceFramesLeft > 0) {
            silenceFramesLeft -= 1;
            send('input_audio_buffer.append', { audio: silence.toString('base64') });
            if (silenceFramesLeft === 0) {
                console.log('[e2e] 语音 + 静音推送完成，等待服务端 VAD 断句…');
            }
            return;
        }

        clearInterval(timer);
    }, 100);
}
