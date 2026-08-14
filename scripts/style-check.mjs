/**
 * 新 UI 计算样式断言（CDP）。
 * 打开首页与会话页，验证设计 token 是否真正编译生效、布局是否溢出。
 * 用法：node scripts/style-check.mjs [APP_URL]
 */
import CDP from 'chrome-remote-interface';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP = process.env.APP_URL || 'https://lets-talk.test';
const DEBUG_PORT = 9228;
const PROFILE = '/tmp/lt-style-profile';

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
    const { Runtime, Page, Network, Emulation } = client;
    await Promise.all([Runtime.enable(), Page.enable(), Network.enable()]);

    const t0 = Date.now();
    const mark = (label) => console.log(`[t+${((Date.now() - t0) / 1000).toFixed(1)}s] ${label}`);
    Network.webSocketCreated((e) => mark(`ws created ${e.url}`));
    Network.webSocketHandshakeResponseReceived((e) => mark(`ws handshake ${e.response.status}`));
    Network.webSocketFrameReceived((e) => {
        const p = typeof e.response.payloadData === 'string' ? e.response.payloadData : '';
        if (p.startsWith('{') && p.includes('"type"')) {
            const type = (p.match(/"type":"([^"]+)"/) || [])[1];
            if (!type.includes('audio')) mark(`ws← ${type}`);
        }
    });
    Network.webSocketClosed((e) => mark('ws closed'));

    const evalJs = async (expression) => {
        const r = await Runtime.evaluate({ expression, returnByValue: true });
        if (r.exceptionDetails) return `EXCEPTION: ${r.exceptionDetails.text}`;
        return r.result.value;
    };

    const check = (name, ok, detail) => {
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  → ${detail}` : ''}`);
    };

    await Page.navigate({ url: APP });
    await sleep(3500);

    // 若出现登记卡，先登记
    const hasRegister = await evalJs(`!!document.body.innerText.includes('开始练习')`);
    if (hasRegister) {
        await evalJs(`(() => {
            const input = document.querySelector('input[placeholder*="小明"]');
            if (input) { input.value = '小明'; input.dispatchEvent(new Event('input', { bubbles: true })); }
            [...document.querySelectorAll('button')].find(b => b.textContent.includes('开始练习'))?.click();
        })()`);
        console.log('[check] 已登记访客');
        await sleep(3000);
    }

    const home = await evalJs(`(() => {
        const cs = (el) => (el ? getComputedStyle(el) : null);
        const q = (s) => document.querySelector(s);
        const qa = (s) => [...document.querySelectorAll(s)];
        const root = q('.min-h-screen');
        const body = cs(root);
        const cards = qa('section[aria-label="场景选择"] button');
        const firstCard = cards[0];
        const emoji = firstCard?.querySelector('span[aria-hidden]');
        const grid = q('section[aria-label="场景选择"] > div.grid');
        const h1 = q('h1');
        const langBtn = qa('[role="group"][aria-label="对话语言"] button')[0];
        const quota = q('[title="今日可用练习时长"]');
        const quotaBar = quota?.querySelector('div > div');
        return {
            bodyBg: body.backgroundColor,
            fontFamily: body.fontFamily.slice(0, 60),
            overflowX: document.documentElement.scrollWidth - window.innerWidth,
            cardCount: cards.length,
            cardRadius: firstCard ? cs(firstCard).borderRadius : null,
            cardEmoji: emoji?.textContent?.trim(),
            cardEmojiSize: emoji ? cs(emoji).fontSize : null,
            cardBgImage: firstCard ? cs(firstCard.querySelector('div')).backgroundImage.slice(0, 80) : null,
            gridColumns: grid ? cs(grid).gridTemplateColumns : null,
            h1Text: h1?.textContent?.trim().slice(0, 30),
            h1Color: h1 ? cs(h1).color : null,
            langBtnBg: langBtn ? cs(langBtn).backgroundColor : null,
            quotaText: quota?.innerText?.replace(/\\n/g, ' '),
            quotaBarColor: quotaBar ? cs(quotaBar).backgroundColor : null,
            greeting: document.body.innerText.includes('今天想聊点什么'),
        };
    })()`);

    console.log('═══ 首页断言 ═══');
    check('根容器背景为奶油色（非白非透明）', !['rgb(255, 255, 255)', 'rgba(0, 0, 0, 0)'].includes(home.bodyBg), home.bodyBg);
    check('字体包含 Baloo 2', String(home.fontFamily).includes('Baloo 2'), home.fontFamily);
    check('无横向溢出', home.overflowX <= 0, `溢出 ${home.overflowX}px`);
    check('场景卡片数量 = 6', home.cardCount === 6, `${home.cardCount} 张`);
    check('卡片圆角 = 24px (rounded-3xl)', home.cardRadius === '24px', home.cardRadius);
    check('卡片有 emoji 插图', !!home.cardEmoji, home.cardEmoji);
    check('卡片 emoji 大字号 (≥40px)', parseFloat(home.cardEmojiSize) >= 40, home.cardEmojiSize);
    check('卡片渐变底色生效', String(home.cardBgImage).includes('gradient'), home.cardBgImage);
    check('标题用墨色 ink-700', home.h1Color === 'rgb(43, 43, 58)', home.h1Color);
    check('EN 按钮高亮 azure', home.langBtnBg === 'rgb(77, 163, 255)', home.langBtnBg);
    check('配额条显示', !!home.quotaText, home.quotaText);
    check('问候语显示', home.greeting === true);

    // 进入会话（等连接完成，观察最终状态）
    const clicked = await evalJs(`(() => {
        const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('U1'));
        if (btn) { btn.click(); return true; }
        return false;
    })()`);
    await sleep(30000);

    const session = await evalJs(`(() => {
        const cs = (el) => (el ? getComputedStyle(el) : null);
        const qa = (s) => [...document.querySelectorAll(s)];
        const svg = document.querySelector('svg');
        const meters = qa('[aria-label="麦克风音量"] > div').length;
        const footerCtl = qa('footer').find(f => f.textContent.includes('结束练习'));
        const text = document.body.innerText;
        const litBars = qa('[aria-label="麦克风音量"] > div > div').filter((el) => parseFloat(getComputedStyle(el).opacity) > 0.5).length;
        return {
            overflowX: document.documentElement.scrollWidth - window.innerWidth,
            mascotVisible: !!svg && svg.getBoundingClientRect().height > 100,
            svgAnim: svg ? svg.getAttribute('class') : null,
            meterBars: meters,
            hasTopbar: text.includes('当前场景'),
            hasConsole: text.includes('对话字幕'),
            hasStage: text.includes('正在听你说话') || text.includes('AI 老师正在想') || text.includes('点我，或直接开口打断') || text.includes('正在连接'),
            hasEndBtn: text.includes('结束练习'),
            hint: (text.match(/我在听，开口说英语吧|让我想一想|AI 老师正在说，开口就能打断它|正在连接语音老师|语音连接已断开|重连|出错了/) || ['未识别'])[0],
            timerText: (text.match(/[0-9]{1,2}:[0-9]{2}/) || [])[0],
            bigButton: footerCtl ? cs(footerCtl.querySelector('button')).width : null,
            litBars,
            bodyText: text.slice(0, 200).replace(/\\n/g, ' | '),
        };
    })()`);

    console.log('═══ 会话页断言 ═══');
    check('点击场景进入会话', clicked === true);
    check('无横向溢出', session.overflowX <= 0, `溢出 ${session.overflowX}px`);
    check('吉祥物 SVG 渲染 (>100px)', session.mascotVisible === true);
    check('吉祥物带状态动画类', /animate-(nod|breathe|think)/.test(session.svgAnim ?? ''), session.svgAnim);
    check('电平表 24 根柱', session.meterBars === 24, `${session.meterBars} 根`);
    check('舞台/字幕台/顶栏/底栏齐全', session.hasTopbar && session.hasConsole && session.hasStage && session.hasEndBtn, session.bodyText);
    check('计时显示 mm:ss', typeof session.timerText === 'string' && session.timerText.includes(':'), session.timerText);
    check('中心大按钮 ≥64px', parseFloat(session.bigButton) >= 64, session.bigButton);
    check('会话状态文案', session.hint !== '未识别', session.hint);
    check('电平表点亮（有输入）', session.litBars >= 3, `${session.litBars} 根点亮`);

    // 结束会话 → 结束反馈屏
    await evalJs(`(() => {
        [...document.querySelectorAll('button')].find(b => b.textContent.includes('结束练习'))?.click();
    })()`);
    await sleep(6000);

    const endScreen = await evalJs(`(() => {
        const cs = (el) => (el ? getComputedStyle(el) : null);
        const text = document.body.innerText;
        const stars = [...document.querySelectorAll('span')].filter((el) => el.textContent === '⭐').length;
        const card = [...document.querySelectorAll('section')].find((s) => s.textContent.includes('再练一次'));
        const againBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('再练一次'));
        return {
            hasCheer: /迈出第一步|开口说英语了|聊得不错|太棒了|超级棒/.test(text),
            starCount: stars,
            hasStats: text.includes('练习时长') && text.includes('开口次数') && text.includes('对话句数'),
            hasVocab: text.includes('今天的目标词汇'),
            hasButtons: text.includes('再练一次') && text.includes('换个场景'),
            radius: card ? cs(card).borderRadius : null,
            againHeight: againBtn ? cs(againBtn).height : null,
            bodyText: text.slice(0, 260).replace(/\\n/g, ' | '),
        };
    })()`);

    console.log('═══ 结束屏断言 ═══');
    check('鼓励语出现', endScreen.hasCheer === true, endScreen.bodyText);
    check('星星展示 (1~5)', endScreen.starCount >= 1 && endScreen.starCount <= 5, `${endScreen.starCount} 颗`);
    check('三项数据卡齐全', endScreen.hasStats === true);
    check('目标词汇回顾', endScreen.hasVocab === true);
    check('再练一次/换个场景按钮', endScreen.hasButtons === true);
    check('结束卡大圆角 32px', endScreen.radius === '32px', endScreen.radius);
    check('主按钮 ≥48px 高', parseFloat(endScreen.againHeight) >= 48, endScreen.againHeight);

    // ── 移动视口（390×844）：首页无溢出 + 2 列网格 ──
    await Emulation.setDeviceMetricsOverride({ width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await Page.navigate({ url: APP });
    await sleep(3500);

    const mobile = await evalJs(`(() => {
        const cs = (el) => (el ? getComputedStyle(el) : null);
        const grid = document.querySelector('section[aria-label="场景选择"] > div.grid');
        const card = document.querySelector('section[aria-label="场景选择"] button');
        return {
            overflowX: document.documentElement.scrollWidth - window.innerWidth,
            columns: grid ? cs(grid).gridTemplateColumns.split(' ').length : 0,
            cardMinWidth: card ? card.getBoundingClientRect().width : 0,
            cardRadius: card ? cs(card).borderRadius : null,
        };
    })()`);

    console.log('═══ 移动视口断言 ═══');
    check('390px 宽无横向溢出', mobile.overflowX <= 0, `溢出 ${mobile.overflowX}px`);
    check('场景卡 2 列网格', mobile.columns === 2, `${mobile.columns} 列`);
    check('卡片可点宽度 ≥150px', mobile.cardMinWidth >= 150, `${mobile.cardMinWidth}px`);
    check('卡片大圆角', mobile.cardRadius === '24px', mobile.cardRadius);

    // ── reduced-motion：动效应被降级为瞬时 ──
    await Emulation.setEmulatedMedia({ features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    const reducedMotion = await evalJs(`(() => {
        const el = document.querySelector('.animate-nod, .animate-breathe, .animate-float');
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { duration: cs.animationDuration, iterations: cs.animationIterationCount };
    })()`);
    const isDegraded = reducedMotion && parseFloat(reducedMotion.duration) <= 0.02;
    check(
        'prefers-reduced-motion 动效降级',
        isDegraded === true,
        reducedMotion ? `duration=${reducedMotion.duration}` : '未找到动画元素',
    );

    // ── 管理端冒烟：basic auth 访问 + 新 token 生效 ──
    await Emulation.setDeviceMetricsOverride({ width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    const auth = Buffer.from('admin@example.com:password').toString('base64');
    await Network.setExtraHTTPHeaders({ headers: { Authorization: `Basic ${auth}` } });
    await Page.navigate({ url: `${APP}/admin` });
    await sleep(3000);

    const adminPage = await evalJs(`(() => {
        const cs = (el) => (el ? getComputedStyle(el) : null);
        const link = document.querySelector('a[href*="scenarios"]');
        return {
            hasTitle: document.body.innerText.includes('会话记录'),
            hasTable: !!document.querySelector('table'),
            linkColor: link ? cs(link).color : null,
            overflowX: document.documentElement.scrollWidth - window.innerWidth,
        };
    })()`);

    console.log('═══ 管理端断言 ═══');
    check('会话记录页渲染', adminPage.hasTitle === true && adminPage.hasTable === true);
    check('链接用新 azure token', adminPage.linkColor === 'rgb(51, 137, 232)', adminPage.linkColor);
    check('无横向溢出', adminPage.overflowX <= 0, `溢出 ${adminPage.overflowX}px`);

    await client.close();
} finally {
    chrome.kill();
}
