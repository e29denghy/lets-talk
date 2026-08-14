/**
 * 排查浏览器 WS 连接状态（CDP）：打印 WebSocket 事件 + 控制台输出。
 * 用法：node scripts/ws-probe.mjs
 */
import CDP from 'chrome-remote-interface';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP = process.env.APP_URL || 'https://lets-talk.test';
const DEBUG_PORT = 9229;
const PROFILE = '/tmp/lt-ws-probe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(CHROME, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--remote-allow-origins=*',
    '--headless=new',
    '--no-first-run',
    '--disable-gpu',
    '--no-sandbox',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--ignore-certificate-errors',
    'about:blank',
], { stdio: 'ignore' });

try {
    let ready = false;
    for (let i = 0; i < 40 && !ready; i++) {
        ready = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then(() => true).catch(() => false);
        if (!ready) await sleep(400);
    }

    const client = await CDP({ port: DEBUG_PORT });
    const { Runtime, Page, Network } = client;
    await Promise.all([Runtime.enable(), Page.enable(), Network.enable()]);

    Network.webSocketCreated((e) => console.log('[ws created]', e.url));
    Network.webSocketWillSendHandshakeRequest((e) => console.log('[ws handshake→]', e.request.url));
    Network.webSocketHandshakeResponseReceived((e) => console.log('[ws handshake←]', e.response.status));
    Network.webSocketFrameSent((e) => console.log('[ws→frame]', typeof e.response.payloadData === 'string' ? e.response.payloadData.slice(0, 100) : `<${e.response.payloadData?.length ?? 0} bytes>`));
    Network.webSocketFrameReceived((e) => console.log('[ws←frame]', typeof e.response.payloadData === 'string' ? e.response.payloadData.slice(0, 100) : `<${e.response.payloadData?.length ?? 0} bytes>`));
    Network.webSocketClosed((e) => console.log('[ws closed]', e.url, e.timestamp));
    Runtime.consoleAPICalled((e) => console.log('[console]', e.type, e.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200)));
    Runtime.exceptionThrown(({ exceptionDetails }) => console.log('[pageerror]', exceptionDetails.text, exceptionDetails.exception?.description ?? ''));

    await Page.navigate({ url: APP });
    await sleep(3000);

    const evalJs = async (expression) => {
        const r = await Runtime.evaluate({ expression, returnByValue: true });
        return r.result.value;
    };

    const hasRegister = await evalJs(`!!document.body.innerText.includes('开始练习')`);
    if (hasRegister) {
        await evalJs(`(() => {
            const input = document.querySelector('input[placeholder*="小明"]');
            if (input) { input.value = '小明'; input.dispatchEvent(new Event('input', { bubbles: true })); }
            [...document.querySelectorAll('button')].find(b => b.textContent.includes('开始练习'))?.click();
        })()`);
        await sleep(2500);
    }

    await evalJs(`(() => {
        const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('U1'));
        btn?.click();
    })()`);

    await sleep(25000);

    const status = await evalJs(`(document.body.innerText.match(/我在听|让我想一想|AI 老师正在说|正在连接语音老师|出错了|语音连接已断开|无法连接语音服务|重连[^\n]*/) || ['?'])[0]`);
    console.log('[status]', status);
    console.log('[probe done]');
    await client.close();
} finally {
    chrome.kill();
}
