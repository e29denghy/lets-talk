/**
 * Qwen-Omni Realtime 连接探测脚本。
 *
 * 用途：拿到 API Key 后，先在命令行验证 WebSocket 端点、鉴权方式与事件流，
 * 再进浏览器联调。支持两种鉴权模式：
 *
 *   # 方式 A：query 鉴权（浏览器直连模式的候选方案，需实测是否被服务端接受）
 *   VOICE_QWEN_OMNI_API_KEY=sk-xxx node scripts/qwen-ws-probe.mjs
 *
 *   # 方式 B：Bearer 头鉴权（官方文档方式；若 A 被拒，说明浏览器直连不可行，需走中继）
 *   VOICE_QWEN_OMNI_API_KEY=sk-xxx AUTH_MODE=header node scripts/qwen-ws-probe.mjs
 *
 * 可选：MODEL=qwen3-omni-flash-realtime  AUTH_QUERY_PARAM=api-key
 */
import WebSocket from 'ws';

const apiKey = process.env.VOICE_QWEN_OMNI_API_KEY;
const model = process.env.MODEL || 'qwen3-omni-flash-realtime';
const authMode = process.env.AUTH_MODE || 'query';
const authQueryParam = process.env.AUTH_QUERY_PARAM || 'api-key';
const wsBase = process.env.WS_URL || 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime';

if (!apiKey) {
    console.error('请设置 VOICE_QWEN_OMNI_API_KEY 环境变量。');
    process.exit(1);
}

const url = `${wsBase}?model=${encodeURIComponent(model)}`
    + (authMode === 'query' ? `&${authQueryParam}=${encodeURIComponent(apiKey)}` : '');

console.log(`[probe] 连接 ${authMode === 'header' ? 'Bearer 头' : 'query 参数'} 鉴权:`);
console.log(`[probe] ${url.replace(/api-key=[^&]*/, 'api-key=***')}`);

const headers = authMode === 'header' ? { Authorization: `Bearer ${apiKey}` } : undefined;

const ws = new WebSocket(url, { headers });

const samples = {};
let events = 0;
let sessionCreated = false;

ws.on('open', () => console.log('[open] 握手成功'));
ws.on('error', (error) => console.error('[error]', error.message));
ws.on('close', (code, reason) => {
    console.log(`[close] code=${code} reason=${reason.toString()}`);
    console.log(`[summary] 共 ${events} 个事件：`, samples);
    console.log(sessionCreated ? '[result] session.created 收到，鉴权与端点可用 ✓'
        : '[result] 未收到 session.created —— 鉴权/端点不可用（若 code=1008/4401 多为鉴权被拒）');
});

ws.on('message', (data) => {
    let parsed = {};
    try {
        parsed = JSON.parse(data.toString());
    } catch {
        return;
    }
    events += 1;
    samples[parsed.type] = (samples[parsed.type] ?? 0) + 1;

    if (parsed.type === 'session.created') {
        sessionCreated = true;
        console.log(`[evt] session.created: model=${parsed.session?.model} modalities=${JSON.stringify(parsed.session?.modalities)}`);

        // 收到默认配置后，按协议发送一次 session.update 验证双向链路
        ws.send(JSON.stringify({
            event_id: 'evt_probe',
            type: 'session.update',
            session: {
                ...(parsed.session ?? {}),
                instructions: 'Probe test. Reply with one short sentence.',
                voice: (parsed.session?.voice) ?? 'Cherry',
            },
        }));
        return;
    }

    if (parsed.type === 'session.updated') {
        console.log('[evt] session.updated —— session.update 被接受，双向链路 OK ✓');
        return;
    }

    console.log(`[evt] ${parsed.type} ${JSON.stringify(parsed).slice(0, 160)}`);
});

// 15 秒后自动收尾
setTimeout(() => ws.close(), 15000);
