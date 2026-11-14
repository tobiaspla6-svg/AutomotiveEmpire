// Phase 4E: screenshots of what a new maker is told — the first design the studio proposes, the cost-versus-worth warning,
// the "sell what your lines can build" step and the idle-engineers insight — in English and Spanish.
//   npx vite build && node e2e/audit-4e.cjs
const { spawn } = require('node:child_process'); const path = require('node:path'); const fs = require('node:fs'); const { chromium } = require('playwright');
const PORT = 4328, BASE = `http://localhost:${PORT}/`, ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'docs/calibration-4e/screens');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await sleep(200); }
  const browser = await chromium.launch(); const log = [];
  for (const lang of ['en', 'es']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(([l]) => { localStorage.setItem('ae.lang', l); localStorage.setItem('ae.graphics.quality', 'off'); localStorage.setItem('ae.guide.welcomeSeen', '1'); }, [lang]);
    const page = await ctx.newPage(); page.setDefaultTimeout(20000);
    const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(BASE); await page.locator('.menu2').waitFor();
    // a 2015 affordable-cars founder
    await page.locator('.mode2').nth(1).locator('.m2-head').click();
    await page.locator('input[type=range]').first().fill('2015');
    await page.locator('.cards .card').nth(2).click(); // affordable cars
    await sleep(300); await page.screenshot({ path: path.join(OUT, `${lang}-01-setup-mass-2015.png`) });
    await page.locator('[data-action="start-game"]').click(); await page.locator('.shell').waitFor();
    await page.locator('.nav [data-view="vehicles"]').click(); await page.locator('[data-action="new-vehicle"]').click(); await page.locator('.studio-grid').waitFor();
    await page.locator('.studio-name').fill('Popolo'); await sleep(500);
    const warn = await page.locator('[data-warn="cost-above-worth"]').count();
    log.push(`${lang}: cost-above-worth warning shown: ${warn > 0}`);
    await page.locator('[data-warn="cost-above-worth"]').scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({ path: path.join(OUT, `${lang}-02-studio-starter.png`) });
    await page.locator('[data-action="start-development"]').first().click();
    if (await page.locator('[data-action="confirm-ok"]').count()) await page.locator('[data-action="confirm-ok"]').click();
    // run until the car is ready, then three more months with nothing to engineer
    for (let i = 0; i < 45; i++) {
      const row = await page.locator('.range-table tbody tr').first().innerText().catch(() => '');
      if (!/Development|Desarrollo/.test(row)) break;
      await page.locator('[data-action="next-month"]').click(); await sleep(250);
      if (await page.locator('.modal .card').count()) await page.locator('.modal .card').first().click();
    }
    await page.locator('.nav [data-view="factories"]').click(); await page.locator('[data-action="add-line"]').first().click(); await page.locator('[data-action="tool-line"]').click();
    for (let i = 0; i < 4; i++) { await page.locator('[data-action="next-month"]').click(); await sleep(300); if (await page.locator('.modal .card').count()) await page.locator('.modal .card').first().click(); }
    await page.locator('.nav [data-view="dashboard"]').click(); await sleep(400);
    const steps = await page.locator('.guide-steps li').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-step')}:${e.className || 'todo'}`));
    const insights = await page.locator('.insight b').allInnerTexts();
    log.push(`${lang}: guide ${steps.join(' ')} | insights: ${insights.join(' / ')}`);
    await page.screenshot({ path: path.join(OUT, `${lang}-03-dashboard-guidance.png`), fullPage: true });
    log.push(`${lang}: console errors ${errors.length}`);
    await ctx.close();
  }
  await browser.close(); server.kill();
  console.log(log.join('\n')); fs.writeFileSync(path.join(OUT, 'results.txt'), log.join('\n') + '\n'); process.exit(0);
})();
