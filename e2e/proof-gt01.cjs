// Phase 5D: proof that GT-01 parts swap in the real game render without changing the rest of the car.
//   npx vite build && node e2e/proof-gt01.cjs <outDir>
// Opens the design studio, picks each variant in turn, screenshots only the car element at 2× and writes PNGs; then
// e2e/proof-gt01.py measures the differences against the base (changed pixels outside each part's region).
const { spawn, execFileSync } = require('node:child_process'); const path = require('node:path'); const fs = require('node:fs'); const { chromium } = require('playwright');
const PORT = 4334, BASE = `http://localhost:${PORT}/`, ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs/phase5d-modular/proof')); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// [category, part] pairs; each shot is the base plus that single variant
const VARIANTS = [
  ['wheels', 'wheel-multispoke'], ['lights', 'headlamp-matrix'], ['handles', 'handle-flush'], ['bumpers', 'bumper-front-sport'], ['roof', 'roof-panoramic'],
];
(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await sleep(200); }
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { localStorage.setItem('ae.lang', 'es'); localStorage.setItem('ae.graphics.quality', 'off'); localStorage.setItem('ae.guide.welcomeSeen', '1'); localStorage.setItem('ae.prefs', JSON.stringify({ reduceMotion: true })); });
  const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(BASE); await p.locator('.menu2').waitFor();
  await p.locator('[data-action="new-game"]').click(); await p.locator('.mode2 .m2-head').first().click();
  await p.locator('input[type=range]').first().fill('2024'); await p.locator('.card', { hasText: 'Toyota' }).first().click(); await p.locator('[data-action="start-game"]').click(); await p.locator('.shell').waitFor();
  await p.evaluate(() => document.querySelector('.nav [data-view="studio2d"]').click()); await p.locator('.fs-studio').waitFor(); await p.waitForLoadState('networkidle'); await sleep(600);
  const car = p.locator('.fs-stage .gt01');
  const shot = async (name) => { await sleep(350); await car.screenshot({ path: path.join(OUT, `${name}.png`) }); };
  const pick = async (cat, part) => { await p.locator(`.fs-cat[data-cat="${cat}"]`).click(); await p.locator(`.fs-opt[data-part="${part}"]`).click(); await p.waitForLoadState('networkidle'); };
  const defaults = { wheels: 'wheel-gt01-twin5', lights: 'headlamp-led-slim', handles: 'handle-conventional', bumpers: 'bumper-front-standard', roof: 'roof-fixed' };
  await shot('base');
  for (const [cat, part] of VARIANTS) { await pick(cat, part); await shot(part); await pick(cat, defaults[cat]); }
  await shot('base-again');                                 // back to base: must equal the first shot
  // finishes, and every variant together
  for (const f of ['solid', 'pearl', 'matte']) { await p.locator('.fs-chip', { hasText: { solid: 'Sólida', pearl: 'Perlada', matte: 'Mate' }[f] }).click(); await shot(`finish-${f}`); }
  await p.locator('.fs-chip', { hasText: 'Metalizada' }).click();
  await p.locator('.fs-swatch').nth(4).click();
  for (const [cat, part] of VARIANTS) await pick(cat, part);
  await shot('all-variants-red');
  const box = await car.boundingBox();
  fs.writeFileSync(path.join(OUT, 'render.json'), JSON.stringify({ carCssWidth: box.width, carCssHeight: box.height, deviceScaleFactor: 2, errors }, null, 1));
  await b.close(); server.kill();
  execFileSync('python3', [path.join(__dirname, 'proof-gt01.py'), OUT, path.join(ROOT, 'public/flow/gt01/parts.json')], { stdio: 'inherit' });
  process.exit(errors.length ? 1 : 0);
})();
