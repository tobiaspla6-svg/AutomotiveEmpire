const { spawn } = require('node:child_process'); const path = require('node:path'); const { chromium } = require('playwright');
const PORT = 4322, BASE = `http://localhost:${PORT}/`, ROOT = path.resolve(__dirname, '..'); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await sleep(200); }
  for (const [label, args, q] of [['blocked-high', ['--disable-gpu', '--disable-3d-apis', '--disable-webgl', '--disable-webgl2'], 'high'], ['software-medium', [], 'medium']]) {
    const browser = await chromium.launch({ args }); const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(([q]) => { localStorage.setItem('ae.lang', 'en'); localStorage.setItem('ae.graphics.quality', q); localStorage.setItem('ae.guide.welcomeSeen', '1'); }, [q]);
    const page = await ctx.newPage(); page.setDefaultTimeout(30000); const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
    await page.goto(BASE); await page.locator('.menu2').waitFor();
    await page.locator('.mode2').nth(0).locator('.m2-head').click(); await page.locator('input[type=range]').first().fill('2000'); await page.locator('.card', { hasText: 'Toyota' }).first().click(); await page.locator('[data-action="start-game"]').click(); await page.locator('.shell').waitFor();
    let res = 'no race reached';
    for (let i = 0; i < 14; i++) { if (await page.locator('[data-action="race-weekend"]').count()) break; await page.locator('[data-action="next-month"]').click(); await page.waitForTimeout(500); if (await page.locator('.modal .card').count()) await page.locator('.modal .card').first().click(); }
    if (await page.locator('[data-action="race-weekend"]').count()) {
      try {
        await page.locator('[data-action="race-weekend"]').click(); await page.locator('[data-action="start-race"]').waitFor();
        await page.screenshot({ path: path.join(ROOT, `docs/audit-4d/screens/race-${label}-briefing.png`) });
        await page.locator('[data-action="start-race"]').click(); await sleep(4000);
        await page.screenshot({ path: path.join(ROOT, `docs/audit-4d/screens/race-${label}-live.png`) });
        res = 'live race screen rendered; canvases=' + await page.locator('canvas').count();
        if (await page.locator('[data-action="box"]').count()) res += ', pit controls present';
        await page.locator('.race-overlay').first().waitFor().catch(() => {});
      } catch (e) { res = 'FAILED: ' + String(e.message).split('\n')[0]; }
    }
    console.log(label, '→', res, '| errors:', [...new Set(errs)].slice(0, 3)); await browser.close();
  }
  server.kill(); process.exit(0);
})();
