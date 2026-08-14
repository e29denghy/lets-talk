/**
 * 新 UI 视觉验证（CDP 驱动系统 Chrome）。
 * 流程：桌面视口打开首页 → 登记 → 截图画廊 → 点第一个场景 → 截图会话舞台
 *       → 结束练习 → 截图结束反馈 → 切移动视口截图首页与会话。
 * 输出：/tmp/ui-{step}.png
 * 用法：node scripts/ui-check.mjs [APP_URL]
 */
import CDP from 'chrome-remote-interface';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP = process.env.APP_URL || 'https://lets-talk.test';
const DEBUG_PORT = 9224;
const PROFILE = '/tmp/lt-ui-profile';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(CHROME, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--remote-allow-origins=*',
    '--headless=new',
    '--no-first-run',
    // DSH 沙箱内 Chrome 子进程沙箱初始化会被拒，禁用 GPU/沙箱避免崩溃
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--no-sandbox',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--ignore-certificate-errors',
    'about:blank',
], { stdio: 'ignore' });

const sleep_until = async (fn, timeout = 15000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            if (await fn()) return true;
        } catch { /* retry */ }
        await sleep(300);
    }
    return false;
};

let shot = 0;

try {
    await sleep_until(async () => {
        const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).catch(() => null);
        return res && res.ok;
    });

    let client = null;
    for (let attempt = 0; attempt < 6 && !client; attempt++) {
        try {
            client = await CDP({ port: DEBUG_PORT });
        } catch (error) {
            console.log(`[retry] CDP 连接失败（第 ${attempt + 1} 次）: ${error.message}`);
            await sleep(1000);
        }
    }
    if (!client) throw new Error('无法连接 Chrome CDP');

    const { Runtime, Page, Network, Log, Emulation } = client;

    await Promise.all([Runtime.enable(), Page.enable(), Network.enable(), Log.enable()]);

    Runtime.exceptionThrown(({ exceptionDetails }) => {
        console.log('[pageerror]', exceptionDetails.text, exceptionDetails.exception?.description ?? '');
    });
    Log.entryAdded(({ entry }) => {
        if (entry.level === 'error') console.log('[log.error]', entry.text.slice(0, 200));
    });
    Network.responseReceived(({ response }) => {
        if (response.status >= 400) console.log(`[http ${response.status}]`, response.url);
    });

    const setViewport = async (width, height) => {
        await Emulation.setDeviceMetricsOverride({
            width, height, deviceScaleFactor: 1, mobile: false,
        });
    };

    const snap = async (name) => {
        shot += 1;
        const s = await Page.captureScreenshot({ format: 'png' });
        const file = `/tmp/ui-${String(shot).padStart(2, '0')}-${name}.png`;
        fs.writeFileSync(file, Buffer.from(s.data, 'base64'));
        console.log(`[shot] ${file}`);
        return file;
    };

    const evalJs = async (expression, returnByValue = true) => {
        const r = await Runtime.evaluate({ expression, returnByValue });
        return r.result.value;
    };

    const clickButtonByText = async (text) =>
        evalJs(`(() => {
            const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('${text}'));
            if (btn) { btn.click(); return true; }
            return false;
        })()`);

    // ── 桌面：首页 + 登记 ──
    await setViewport(1280, 900);
    await Page.navigate({ url: APP });
    await sleep(3500);

    const hasRegister = await evalJs(`!!document.body.innerText.includes('开始练习')`);
    if (hasRegister) {
        await evalJs(`(() => {
            const input = document.querySelector('input[placeholder*="小明"]');
            if (input) { input.value = '小明'; input.dispatchEvent(new Event('input', { bubbles: true })); }
        })()`);
        await clickButtonByText('开始练习');
        console.log('[check] 已登记访客');
        await sleep(3000);
    }
    await snap('desktop-home');

    // ── 桌面：进入会话 ──
    const clicked = await clickButtonByText('U1');
    console.log('[check] 点击场景:', clicked);
    await sleep(6000);
    await snap('desktop-session');

    // ── 桌面：结束 ──
    await clickButtonByText('结束练习');
    await sleep(5000);
    await snap('desktop-end');

    // ── 移动视口：首页 ──
    await setViewport(390, 844);
    await Page.navigate({ url: APP });
    await sleep(3500);
    await snap('mobile-home');

    // ── 移动视口：会话 ──
    await clickButtonByText('U1');
    await sleep(6000);
    await snap('mobile-session');

    await client.close();
    console.log('[check] done');
} finally {
    chrome.kill();
}
