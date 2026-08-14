/**
 * Qwen-Omni 音色验证：逐个音色发真实语音，确认能否正常生成音频回复。
 * 用法：node scripts/qwen-voice-test.mjs <16kHz mono wav>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const WAV = process.argv[2];
if (!WAV || !fs.existsSync(WAV)) {
    console.error('用法: node scripts/qwen-voice-test.mjs <16kHz mono wav>');
    process.exit(1);
}

// 从项目 .env 读 API Key
const projectDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const env = {};
for (const line of fs.readFileSync(path.join(projectDir, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const API_KEY = env.VOICE_QWEN_OMNI_API_KEY;
const MODEL = env.VOICE_QWEN_OMNI_MODEL || 'qwen3-omni-flash-realtime';
if (!API_KEY) {
    console.error('未找到 VOICE_QWEN_OMNI_API_KEY');
    process.exit(1);
}

const VOICES = process.env.VOICES?.split(',') ?? ['Cherry', 'Serena', 'Ethan', 'Chelsie', 'Tina'];

const buf = fs.readFileSync(WAV);
const dataOffset = buf.indexOf(Buffer.from('data')) + 8;
const pcm = new Int16Array((buf.length - dataOffset) / 2);
for (let i = 0; i < pcm.length; i++) pcm[i] = buf.readInt16LE(dataOffset + i * 2);
const silence = Buffer.alloc(3200 * 2);

function testVoice(voice) {
    return new Promise((resolve) => {
        const url = `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${encodeURIComponent(MODEL)}`;
        const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${API_KEY}` } });

        let offset = 0;
        let sentSilence = 0;
        const timer = setTimeout(() => {
            console.log(`  ${voice}: ⏱ 超时（无音频无错误）`);
            ws.close();
            resolve(false);
        }, 25000);

        ws.on('open', () => {});
        ws.on('message', (data) => {
            let ev;
            try { ev = JSON.parse(data.toString()); } catch { return; }

            if (ev.type === 'session.created') {
                ws.send(JSON.stringify({
                    event_id: 'evt_voice_test',
                    type: 'session.update',
                    session: {
                        modalities: ['text', 'audio'],
                        instructions: 'You are a friendly English tutor for a child. Speak slowly and keep replies to one or two short sentences. Reply in one short sentence.',
                        voice,
                        input_audio_format: 'pcm',
                        output_audio_format: 'pcm',
                        turn_detection: { type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 800, create_response: true, interrupt_response: true },
                    },
                }));
                return;
            }
            if (ev.type === 'session.updated') {
                // 开始推流
                const push = setInterval(() => {
                    if (offset < pcm.length) {
                        const slice = pcm.subarray(offset, Math.min(offset + 3200, pcm.length));
                        offset += 3200;
                        ws.send(JSON.stringify({ event_id: 'evt_voice_test_a', type: 'input_audio_buffer.append', audio: Buffer.from(slice.buffer, slice.byteOffset, slice.byteLength).toString('base64') }));
                    } else if (sentSilence < 25) {
                        sentSilence += 1;
                        ws.send(JSON.stringify({ event_id: 'evt_voice_test_s', type: 'input_audio_buffer.append', audio: silence.toString('base64') }));
                    } else {
                        clearInterval(push);
                    }
                }, 100);
                return;
            }
            if (ev.type === 'response.audio.delta') {
                clearTimeout(timer);
                console.log(`  ${voice}: ✅ 正常生成音频`);
                ws.close();
                resolve(true);
                return;
            }
            if (ev.type === 'error') {
                clearTimeout(timer);
                console.log(`  ${voice}: ❌ 错误: ${JSON.stringify(ev.error).slice(0, 160)}`);
                ws.close();
                resolve(false);
            }
        });
        ws.on('error', (e) => {
            clearTimeout(timer);
            console.log(`  ${voice}: ❌ 连接错误: ${e.message}`);
            resolve(false);
        });
        ws.on('close', () => resolve(false));
    });
}

console.log(`音色验证（model=${MODEL}）:`);
for (const voice of VOICES) {
    await testVoice(voice.trim());
}
console.log('完成。');
process.exit(0);
