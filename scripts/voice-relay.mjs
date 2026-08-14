/**
 * Let's Talk 语音中继服务。
 *
 * 为什么需要它：Qwen-Omni Realtime 端点只接受 Authorization: Bearer 头鉴权
 * （实测 query 鉴权 401），而浏览器 WebSocket 无法自定义请求头。
 * 中继做的事：
 *   浏览器 --wss(lets-talk.test:9333, Valet 证书)--> 中继 --wss(Bearer 头)--> 百炼
 * 中继凭浏览器自动携带的访客 Cookie 调 Laravel /relay-init 校验会话（共享密钥 + 归属），
 * API Key 只到达中继进程，绝不下发浏览器。
 *
 * 启动：node scripts/voice-relay.mjs   （或 npm run relay）
 * 环境变量（均有默认值）：VOICE_RELAY_PORT=9333 VOICE_RELAY_HOST=127.0.0.1
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { Agent, setGlobalDispatcher } from 'undici';
import WebSocket, { WebSocketServer } from 'ws';

// Node 不读 macOS 钥匙串：给 fetch 注入 Valet 自签 CA（浏览器不受影响，走系统钥匙串）
const valetCa = path.join(os.homedir(), '.config/valet/CA/LaravelValetCASelfSigned.pem');
if (fs.existsSync(valetCa)) {
    setGlobalDispatcher(new Agent({ connect: { ca: fs.readFileSync(valetCa) } }));
}

const PORT = parseInt(process.env.VOICE_RELAY_PORT || '9333', 10);
const HOST = process.env.VOICE_RELAY_HOST || '127.0.0.1';
const CERT = process.env.VOICE_RELAY_CERT
    || path.join(os.homedir(), '.config/valet/Certificates/lets-talk.test.crt');
const KEY = process.env.VOICE_RELAY_KEY
    || path.join(os.homedir(), '.config/valet/Certificates/lets-talk.test.key');
const APP_URL = process.env.VOICE_RELAY_APP_URL || 'https://lets-talk.test';

// 从项目 .env 读取中继共享密钥（避免重复配置）
const projectDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const secret = readEnv(path.join(projectDir, '.env'))['VOICE_RELAY_SECRET'] || process.env.VOICE_RELAY_SECRET || '';

if (!secret) {
    console.error('[relay] 未找到 VOICE_RELAY_SECRET（.env），拒绝启动。');
    process.exit(1);
}

function readEnv(file) {
    const out = {};
    try {
        for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
            const m = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
            if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
    } catch {
        // .env 不存在
    }
    return out;
}

const server = https.createServer({
    cert: fs.readFileSync(CERT),
    key: fs.readFileSync(KEY),
});

const wss = new WebSocketServer({ server });

wss.on('connection', (browserWs, req) => {
    const url = new URL(req.url, 'https://lets-talk.test');
    const sessionId = url.searchParams.get('session');
    const cookie = req.headers.cookie || '';

    if (!sessionId) {
        browserWs.close(4001, 'missing session');
        return;
    }

    console.log(`[relay] 浏览器接入 session=${sessionId}`);

    fetch(`${APP_URL}/api/voice/sessions/${sessionId}/relay-init`, {
        method: 'POST',
        headers: {
            Cookie: cookie,
            Accept: 'application/json',
            'X-Relay-Secret': secret,
        },
    })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                browserWs.close(4003, body.message || 'relay-init 校验失败');
                return;
            }

            const upstream = new WebSocket(body.upstream.ws_url, {
                headers: { Authorization: `Bearer ${body.upstream.api_key}` },
            });

            let upstreamReady = false;
            const pending = [];

            upstream.on('open', () => {
                upstreamReady = true;
                console.log(`[relay] session=${sessionId} 上游已连接`);
                for (const message of pending) {
                    upstream.send(message.data, { binary: message.isBinary });
                }
                pending.length = 0;
            });

            upstream.on('message', (data, isBinary) => {
                if (browserWs.readyState === WebSocket.OPEN) {
                    browserWs.send(data, { binary: isBinary });
                }
            });

            upstream.on('error', (error) => {
                console.error(`[relay] session=${sessionId} 上游错误:`, error.message);
                browserWs.close(1011, 'upstream error');
            });

            upstream.on('close', () => {
                console.log(`[relay] session=${sessionId} 上游关闭`);
                browserWs.close(1000, 'upstream closed');
            });

            browserWs.on('message', (data, isBinary) => {
                if (upstreamReady) {
                    upstream.send(data, { binary: isBinary });
                } else {
                    pending.push({ data, isBinary });
                }
            });

            browserWs.on('close', () => {
                console.log(`[relay] session=${sessionId} 浏览器断开`);
                upstream.close();
            });
        })
        .catch((error) => {
            console.error(`[relay] session=${sessionId} relay-init 请求失败:`, error.message);
            browserWs.close(4002, 'relay-init error');
        });
});

server.listen(PORT, HOST, () => {
    console.log(`[relay] 监听 wss://${HOST}:${PORT}，证书: ${CERT}`);
});
