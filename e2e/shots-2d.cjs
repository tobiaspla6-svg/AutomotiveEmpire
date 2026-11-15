// Phase 5: screenshots of the 2D game screens (desktop and phone, EN/ES) for visual review.
//   npx vite build && node e2e/shots-2d.cjs [outDir] [tag]
const { spawn } = require('node:child_process'); const path = require('node:path'); const fs = require('node:fs'); const { chromium } = require('playwright');
const PORT = 4331, BASE = `http://localhost:${PORT}/`, ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs/phase5-2d/screens')), TAG = process.argv[3] || '';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await sleep(200); }
  const browser = await chromium.launch(); const errors = [];
  for (const [label, viewport, lang, mobile] of [['desktop-es', { width: 1440, height: 900 }, 'es', false], ['phone-en', { width: 390, height: 844 }, 'en', true]]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
    await ctx.addInitScript(([l]) => { localStorage.setItem('ae.lang', l); localStorage.setItem('ae.graphics.quality', 'off'); localStorage.setItem('ae.guide.welcomeSeen', '1'); }, [lang]);
    const page = await ctx.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', (e) => errors.push(`[${label}] ${e}`)); page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${label}] ${m.text()}`); });
    // the shell scrolls inside .main, so a "full" capture grows the window to the content height for one shot
    const shot = async (n, full = false) => {
      await sleep(500);
      if (!full) { await page.screenshot({ path: path.join(OUT, `${TAG}${label}-${n}.png`) }); return; }
      const h = await page.evaluate(() => { const m = document.querySelector('.main'); return m ? m.scrollHeight + (m.getBoundingClientRect().top) + 8 : document.body.scrollHeight; });
      await page.setViewportSize({ width: viewport.width, height: Math.ceil(Math.min(7000, Math.max(viewport.height, h))) }); await sleep(400);
      await page.screenshot({ path: path.join(OUT, `${TAG}${label}-${n}.png`) });
      await page.setViewportSize(viewport); await sleep(200);
    };
    const go = async (v) => {
      const btn = page.locator(`.nav [data-view="${v}"]`);
      if (mobile && !(await btn.isVisible())) await page.evaluate((view) => document.querySelector(`.nav [data-view="${view}"]`)?.click(), v);
      else await btn.click({ force: true });
      await sleep(200);
    };
    await page.goto(BASE); await page.locator('.menu2').waitFor(); await shot('00-menu');
    await page.locator('.mode2').nth(0).locator('.m2-head').click(); await page.locator('input[type=range]').first().fill('1995'); await page.locator('.card', { hasText: 'Toyota' }).first().click(); await page.locator('[data-action="start-game"]').click(); await page.locator('.shell').waitFor();
    // close two months so rankings, plant loads and sales charts show real simulated results
    for (let i = 0; i < 2; i++) {
      for (let k = 0; k < 4 && await page.locator('.modal .card').count(); k++) { await page.locator('.modal .card').first().click(); await sleep(150); }
      const d = await page.locator('[data-stat="date"] .v').innerText();
      await page.locator('[data-action="next-month"]').click();
      await page.waitForFunction((b) => document.querySelector('[data-stat="date"] .v')?.textContent?.trim() !== b.trim(), d);
    }
    for (let k = 0; k < 4 && await page.locator('.modal .card').count(); k++) { await page.locator('.modal .card').first().click(); await sleep(150); }
    const views = ['hq2d', 'workshop2d', 'factory2d', 'skills2d', 'collection2d', 'campaign2d', 'league2d'];
    for (const [i, v] of views.entries()) { await go(v); await shot(`${String(i + 1).padStart(2, '0')}-${v}`); await shot(`${String(i + 1).padStart(2, '0')}-${v}-full`, true); }
    // a few interactions worth seeing: other workshop stages, the chest opening, the collection and the shop
    await go('workshop2d');
    for (const [k, n] of [[4, 'body'], [5, 'wheels'], [7, 'approve']]) { await page.locator('.g2-steps button').nth(k).click(); await shot(`08-workshop-${n}`, true); }
    await go('collection2d');
    await page.locator('[data-tab="chests"]').click(); await shot('09-chests', true);
    const ready = page.locator('.g2-chest.ready').first();
    if (await ready.count()) { await ready.click(); await sleep(900); await shot('10-chest-reveal'); await page.locator('.g2-reveal .g2-btn.gold').click(); }
    await page.locator('[data-tab="cards"]').click(); await shot('11-collection', true);
    await page.locator('[data-tab="shop"]').click(); await shot('12-shop', true);
    await ctx.close();
  }
  await browser.close(); server.kill();
  console.log('errors:', errors.length, errors.slice(0, 5).join('\n'));
  process.exit(0);
})();
