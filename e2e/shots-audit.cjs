// Evidence for the fixes of the 16 Nov 2026 audit, from the real build:
//   AE-03 Director setup budget · AE-05 acquisition review · AE-04 dealer preview · AE-07 GT clock after the time limit.
//   npx vite build && node e2e/shots-audit.cjs [outDir]
const { spawn } = require('node:child_process'); const path = require('node:path'); const fs = require('node:fs'); const { chromium } = require('playwright');
const PORT = 4337, BASE = `http://localhost:${PORT}/`, ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs/audit-2026-11-16/screens')); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await sleep(200); }
  const b = await chromium.launch(); const report = { errors: [] };
  const fresh = async () => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => { localStorage.setItem('ae.lang', 'es'); localStorage.setItem('ae.graphics.quality', 'off'); localStorage.setItem('ae.guide.welcomeSeen', '1'); });
    const p = await ctx.newPage(); p.setDefaultTimeout(30000);
    p.on('pageerror', (e) => report.errors.push(String(e)));
    await p.goto(BASE); await p.locator('.menu2').waitFor();
    return { ctx, p };
  };
  // AE-03 and AE-07: Director, GT
  { const { ctx, p } = await fresh();
    await p.locator('[data-action="new-game"]').click(); await p.locator('.mode2').nth(2).locator('.m2-head').click();
    await p.locator('input[type=range]').first().fill('2015');
    await p.locator('.cards .card', { hasText: /GT/ }).first().click();
    const pv = p.locator('[data-preview="ms-budget"]'); await pv.waitFor();
    report.setup = { owner: await pv.getAttribute('data-owner'), sponsors: await pv.getAttribute('data-sponsors'), cash: await pv.getAttribute('data-cash'), text: await pv.innerText() };
    await pv.scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(OUT, 'ae03-director-setup.png') });
    await p.locator('[data-action="start-game"]').click(); await p.locator('.shell').waitFor();
    for (let i = 0; i < 14 && !(await p.locator('[data-action="race-weekend"]').count()); i++) { await p.locator('[data-action="next-month"]').click(); await sleep(400); if (await p.locator('.modal .card').count()) await p.locator('.modal .card').first().click(); }
    await p.locator('[data-action="race-weekend"]').click(); await p.locator('[data-action="start-race"]').waitFor();
    await p.locator('[data-action="simulate-race"]').click(); await p.locator('.race-overlay table tbody tr').first().waitFor();
    const clock = p.locator('[data-race-clock]');
    report.gtClock = { seconds: Number(await clock.getAttribute('data-race-clock')), text: await p.locator('.race-lap').innerText(), outOfFuel: await p.locator('.race-overlay table tbody tr', { hasText: /fuel|combustible/i }).count(), cars: await p.locator('.race-overlay table tbody tr').count() };
    await p.screenshot({ path: path.join(OUT, 'ae07-gt-clock-and-classification.png') });
    await ctx.close(); }
  // AE-05 and AE-04: Ferrari 1985
  { const { ctx, p } = await fresh();
    await p.locator('[data-action="new-game"]').click(); await p.locator('.mode2').nth(0).locator('.m2-head').click();
    await p.locator('input[type=range]').first().fill('1985'); await p.locator('.card', { hasText: 'Ferrari' }).first().click(); await p.locator('[data-action="start-game"]').click(); await p.locator('.shell').waitFor();
    await p.locator('.nav [data-view="company"]').click();
    await p.locator('tr', { hasText: 'Lamborghini' }).locator('[data-action="acquire"]').click();
    await p.locator('[role="alertdialog"]').waitFor(); report.acquisition = await p.locator('[role="alertdialog"] p').innerText();
    await p.screenshot({ path: path.join(OUT, 'ae05-acquisition-review.png') });
    await p.locator('[data-action="confirm-cancel"]').click();
    report.objectives = await p.locator('.statline').allInnerTexts();
    await p.locator('.nav [data-view="market"]').click(); await p.locator('.region-grid').waitFor();
    report.dealers = await p.locator('[data-dealer-gain]').allInnerTexts();
    await p.locator('.region-grid').scrollIntoViewIfNeeded(); await p.locator('.region-grid').screenshot({ path: path.join(OUT, 'ae04-dealer-preview.png') });
    await ctx.close(); }
  await b.close(); server.kill();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1)); console.log(JSON.stringify(report, null, 1));
})();
