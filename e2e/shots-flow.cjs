// Phase 5C: the seven Flow screens from the real build, at 1920×1080, 1440×900, 1280×720 and 390×844, in Spanish.
//   npx vite build && node e2e/shots-flow.cjs <outDir> [refDir]
// With refDir (the extracted design-assets folder), it also writes reference-vs-implementation sheets per screen.
const { spawn, execFileSync } = require('node:child_process'); const path = require('node:path'); const fs = require('node:fs'); const { chromium } = require('playwright');
const PORT = 4333, BASE = `http://localhost:${PORT}/`, ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs/phase5c-flow/screens')); const REF = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SIZES = [['1920', 1920, 1080], ['1440', 1440, 900], ['1280', 1280, 720], ['390', 390, 844]];
const errors = []; const metrics = {};
(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await sleep(200); }
  const browser = await chromium.launch();
  for (const [tag, w, h] of SIZES) {
    const mobile = w < 600;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
    await ctx.addInitScript(() => { localStorage.setItem('ae.lang', 'es'); localStorage.setItem('ae.graphics.quality', 'off'); localStorage.setItem('ae.guide.welcomeSeen', '1'); });
    const page = await ctx.newPage(); page.setDefaultTimeout(20000);
    page.on('pageerror', (e) => errors.push(`[${tag}] ${e}`)); page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${tag}] ${m.text()}`); });
    const shot = async (name) => { await sleep(450); await page.screenshot({ path: path.join(OUT, `${name}-${tag}.png`) }); };
    const go = async (v) => { await page.evaluate((view) => document.querySelector(`.nav [data-view="${view}"]`)?.click(), v); await sleep(300); await page.evaluate(() => { const m = document.querySelector('.main'); if (m) m.scrollTop = 0; }); };
    const t0 = Date.now();
    await page.goto(BASE); await page.locator('.menu2').waitFor(); await page.waitForLoadState('networkidle');
    metrics[tag] = { menuLoadMs: Date.now() - t0 };
    await shot('01-inicio');
    // a Toyota CEO game in 2024, two months on, so plants, models and milestones are real
    await page.locator('[data-action="new-game"]').click(); await page.locator('.mode2 .m2-head').first().click();
    await page.locator('input[type=range]').first().fill('2024'); await page.locator('.card', { hasText: 'Toyota' }).first().click(); await page.locator('[data-action="start-game"]').click(); await page.locator('.shell').waitFor();
    for (let i = 0; i < 2; i++) {
      for (let k = 0; k < 4 && await page.locator('.modal .card').count(); k++) { await page.locator('.modal .card').first().click(); await sleep(150); }
      const d = await page.locator('[data-stat="date"] .v').innerText(); await page.locator('[data-action="next-month"]').click();
      await page.waitForFunction((b) => document.querySelector('[data-stat="date"] .v')?.textContent?.trim() !== b.trim(), d);
    }
    for (let k = 0; k < 4 && await page.locator('.modal .card').count(); k++) { await page.locator('.modal .card').first().click(); await sleep(150); }
    await go('hq2d'); await page.waitForLoadState('networkidle'); await shot('02-headquarters');
    await go('studio2d'); await page.waitForLoadState('networkidle'); await shot('03-taller');
    if (!mobile) { await page.locator('.fs-cat[data-cat="interior"]').click(); await shot('03b-taller-interior'); await page.locator('.fs-cat[data-cat="wheels"]').click(); }
    await go('factory2d'); await page.waitForLoadState('networkidle'); await shot('04-fabrica');
    await go('garage2d'); await page.waitForLoadState('networkidle'); await shot('05-garaje');
    await go('chests2d'); await page.waitForLoadState('networkidle'); await shot('06-cofres-cerrado');
    if (await page.locator('[data-action="open-chest"]:not([disabled])').count()) { await page.locator('[data-action="open-chest"]').click(); await sleep(1100); await shot('06-cofres'); }
    await page.locator('.topbar [data-action="settings"]').first().click(); await page.locator('.fs-settings').waitFor(); await shot('07-configuracion');
    await ctx.close();
  }
  await browser.close(); server.kill();
  fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(metrics, null, 1));
  console.log('errors:', errors.length, errors.slice(0, 5).join('\n'));
  if (REF) execFileSync('python3', [path.join(__dirname, 'compare-flow.py'), REF, OUT], { stdio: 'inherit' });
  process.exit(0);
})();
