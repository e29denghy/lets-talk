/**
 * 浏览器级验证（CDP 驱动系统 Chrome，无 puppeteer 版本兼容问题）。
 * 流程：打开首页 → 登记访客 → 点「打招呼」→ 观察 8 秒 → 输出状态 + 截图。
 * 用法：node scripts/browser-check.mjs
 */
import CDP from 'chrome-remote-interface';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP = process.env.APP_URL || 'https://lets-talk.test';
const DEBUG_PORT = 9223;
const PROFILE = '/tmp/lt-chrome-profile';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--remote-allow-origins=*',
    '--headless=new',
    '--no-first-run',
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

try {
    // 等 CDP 端口就绪
    await sleep_until(async () => {
        const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).catch(() => null);
        return res && res.ok;
    });

    const client = await CDP({ port: DEBUG_PORT });
    const { Runtime, Page, Network, Log } = client;

    await Promise.all([Runtime.enable(), Page.enable(), Network.enable(), Log.enable()]);

    Runtime.exceptionThrown(({ exceptionDetails }) => {
        console.log('[pageerror]', exceptionDetails.text, exceptionDetails.exception?.description ?? '');
    });
    Log.entryAdded(({ entry }) => {
        if (entry.level === 'error') console.log('[log.error]', entry.text.slice(0, 300));
    });
    Network.responseReceived(({ response }) => {
        if (response.status >= 400) console.log(`[http ${response.status}]`, response.url);
    });

    await Page.navigate({ url: APP });
    await sleep_until(() => true && Page.getNavigationHistory().then(({ entries }) => entries.at(-1)?.url === APP), 20000);
    await sleep(3000);

    // 登记访客（如果出现登记卡）
    const hasRegister = await Runtime.evaluate({
        expression: `!!document.body.innerText.includes('开始练习')`,
        returnByValue: true,
    });
    if (hasRegister.result.value) {
        await Runtime.evaluate({
            expression: `(() => {
                const input = document.querySelector('input[placeholder*="小明"]');
                if (input) { input.value = '浏览器测试'; input.dispatchEvent(new Event('input', { bubbles: true })); }
                [...document.querySelectorAll('button')].find(b => b.textContent.includes('开始练习'))?.click();
            })()`,
        });
        console.log('[check] 已登记访客');
        await sleep(2500);
    }

    // 点「打招呼」
    const clicked = await Runtime.evaluate({
        expression: `(() => {
            const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('打招呼'));
            if (btn) { btn.click(); return true; }
            return false;
        })()`,
        returnByValue: true,
    });
    console.log('[check] 点击打招呼:', clicked.result.value);

    await sleep(9000);

    const bodyText = await Runtime.evaluate({
        expression: 'document.body.innerText',
        returnByValue: true,
    });
    console.log('[check] 页面文案:\n', bodyText.result.value.slice(0, 700));

    const screenshot = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('/tmp/browser-check.png', Buffer.from(screenshot.data, 'base64'));
    console.log('[check] 截图: /tmp/browser-check.png');

    await client.close();
} finally {
    chrome.kill();
}
