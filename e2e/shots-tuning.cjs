// Phase 6: the experimental Tuning Lab page (tuning.html) from the real build: Kestrel stock → Stage 2 + parts →
// race, dyno hover tooltip, an incompatible stage shown disabled, ECU refusing a map; at 1920, 1280 and 390 px.
//   npx vite build && node e2e/shots-tuning.cjs [outDir]
const { spawn } = require('node:child_process'); const path = require('node:path'); const fs = require('node:fs'); const { chromium } = require('playwright');
const PORT = 4336, BASE = `http://localhost:${PORT}/tuning.html`, ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs/phase6/tuning-lab')); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await sleep(200); }
  const b = await chromium.launch(); const report = {};
  for (const [w, h] of [[1920, 1080], [1280, 720], [390, 844]]) {
    const mobile = w < 600;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
    const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(BASE); await p.locator('.tl').waitFor(); await p.waitForLoadState('networkidle');
    await p.screenshot({ path: path.join(OUT, `01-stock-${w}.png`), fullPage: true });
    const r = { errors };
    r.stageDisabled = await p.locator('[data-stage="m18-stage1"]').isDisabled();
    // ECU refuses a map without the reflash
    r.ecuLockedSliders = await p.locator('[data-field="boost"]').isDisabled();
    await p.locator('[data-stage="k20t-stage2"]').click();
    await p.locator('select[data-cat="clutch"]').selectOption('clutch-r5-twin');
    await p.locator('select[data-cat="differential"]').selectOption('diff-r-lsd-41');
    await p.locator('select[data-cat="tyres"]').selectOption('tyres-16-drag');
    r.peakKw = await p.locator('[data-stat="peak-kw"]').innerText();
    await p.locator('[data-action="race"]').click(); await p.locator('[data-results]').waitFor();
    r.et4 = { stock: await p.locator('[data-run="stock"] [data-et4]').innerText(), build: await p.locator('[data-run="build"] [data-et4]').innerText() };
    if (!mobile) { const svg = p.locator('[data-chart="power"] svg'); const bb = await svg.boundingBox(); await p.mouse.move(bb.x + bb.width * 0.62, bb.y + bb.height / 2); await sleep(150); r.tooltip = await p.locator('[data-chart="power"] .tl-tip').innerText(); }
    r.overflowX = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await p.screenshot({ path: path.join(OUT, `02-stage2-race-${w}.png`), fullPage: true });
    // a calibration beyond the hardware: boost slider to max → ECU error, race disabled
    await p.locator('[data-field="boost"]').fill('2.2'); await sleep(100);
    r.overBoostError = (await p.locator('.tl-error').allInnerTexts()).join(' | ');
    r.raceDisabledWhenInvalid = await p.locator('[data-action="race"]').isDisabled();
    if (w === 1280) await p.locator('.tl-grid').screenshot({ path: path.join(OUT, `03-ecu-refuses-${w}.png`) });
    report[w] = r; await ctx.close();
  }
  await b.close(); server.kill();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1)); console.log(JSON.stringify(report, null, 1));
})();
