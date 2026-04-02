/**
 * 测试 Vercel Challenge 耗时
 * 用法: npm run test:stealth
 */
const CHALLENGE_URL = process.env.CHALLENGE_URL || 'https://cursor.com/cn/docs';

(async () => {
    const { chromium } = require('playwright-extra');
    const stealth = require('puppeteer-extra-plugin-stealth');
    chromium.use(stealth());

    const start = Date.now();
    const elapsed = () => ((Date.now() - start) / 1000).toFixed(1) + 's';

    console.log(`[Test] Launching browser...`);
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const ctx = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    });

    const page = await ctx.newPage();
    console.log(`[Test] [${elapsed()}] Navigating to ${CHALLENGE_URL}...`);

    try {
        await page.goto(CHALLENGE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
        console.log(`[Test] [${elapsed()}] Page loaded, waiting for _vcrcs cookie...`);
    } catch (e) {
        console.error(`[Test] [${elapsed()}] Page load failed: ${e.message}`);
        await browser.close();
        process.exit(1);
    }

    for (let i = 0; i < 60; i++) {
        const cookies = await ctx.cookies();
        const vcrcs = cookies.find(c => c.name === '_vcrcs');
        if (vcrcs) {
            console.log(`[Test] [${elapsed()}] ✅ Got _vcrcs cookie!`);
            console.log(`[Test] Value: ${vcrcs.value.substring(0, 50)}...`);
            await browser.close();
            process.exit(0);
        }
        await new Promise(r => setTimeout(r, 2000));
    }

    console.error(`[Test] [${elapsed()}] ❌ Failed to get _vcrcs cookie after 120s`);
    await browser.close();
    process.exit(1);
})();
