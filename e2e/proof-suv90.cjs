// Phase 6: the 1990 SUV in the real game. Opens the garage of a Toyota 1995 CEO game, selects a vehicle drawn by the
// suv90-green family, opens the design studio on it, and screenshots only the car at 2× for: the original; every
// wheel × headlamp combination; six colours (original green, white, black, red, blue, metallic grey); restore.
// Then e2e/proof-suv90.py measures each capture against the original (pixels changed outside the allowed region).
//   npx vite build && node e2e/proof-suv90.cjs [outDir]
const { spawn, execFileSync } = require('node:child_process'); const path = require('node:path'); const fs = require('node:fs'); const { chromium } = require('playwright');
const PORT = 4335, BASE = `http://localhost:${PORT}/`, ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs/phase6/suv90-proof')); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WHEELS = ['wheel-suv90-steel5', 'wheel-suv90-steel6', 'wheel-suv90-alloy6'];
const LAMPS = ['headlamp-suv90-original', 'headlamp-suv90-halogen-a', 'headlamp-suv90-halogen-b'];
const COLOURS = { verde: '#526a54', blanco: '#eeece5', negro: '#101923', rojo: '#c8352e', azul: '#2a4f86', 'gris-metalico': '#9aa4b1' };
(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await sleep(200); }
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { localStorage.setItem('ae.lang', 'es'); localStorage.setItem('ae.graphics.quality', 'off'); localStorage.setItem('ae.guide.welcomeSeen', '1'); localStorage.setItem('ae.prefs', JSON.stringify({ reduceMotion: true })); });
  const p = await ctx.newPage(); const errors = [], loaded = new Set();
  p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('response', (r) => { if (r.url().includes('/flow/suv90/')) loaded.add(r.url().split('/flow/suv90/')[1] + ' ' + r.status()); });
  await p.goto(BASE); await p.locator('.menu2').waitFor();
  await p.locator('[data-action="new-game"]').click(); await p.locator('.mode2 .m2-head').first().click();
  await p.locator('input[type=range]').first().fill('1995'); await p.locator('.card', { hasText: 'Toyota' }).first().click(); await p.locator('[data-action="start-game"]').click(); await p.locator('.shell').waitFor();
  await p.evaluate(() => document.querySelector('.nav [data-view="garage2d"]').click()); await p.locator('.fs-garage').waitFor();
  const id = await p.locator('.fs-gtray .fs-thumb:has(.mcar[data-family="suv90-green"])').first().getAttribute('data-model');
  if (!id) throw new Error('no vehicle drawn by suv90-green in this game');
  await p.locator(`.fs-gtray .fs-thumb[data-model="${id}"]`).click(); await p.waitForLoadState('networkidle'); await sleep(300);
  await p.locator('.fs-gmain').screenshot({ path: path.join(OUT, 'garage-suv.png') });
  const loadedAtGarage = [...loaded];
  await p.locator('[data-action="customize"]').click(); await p.locator('.fs-studio').waitFor(); await p.waitForLoadState('networkidle'); await sleep(500);
  const car = p.locator('.fs-stage .mcar');
  const shot = async (name) => { await p.waitForLoadState('networkidle'); await sleep(300); await car.screenshot({ path: path.join(OUT, `${name}.png`) }); return car.evaluate((e) => ({ parts: e.dataset.parts, paint: e.dataset.paint, repaint: e.dataset.repaint })); };
  const pick = async (cat, part) => { await p.locator(`.fs-cat[data-cat="${cat}"]`).click(); await p.locator(`.fs-opt[data-part="${part}"]`).click(); };
  const states = {};
  // the model's own colour is shown first; the reference is the master drawing's original green (no repaint layer)
  states['model-colour'] = await shot('model-colour');
  await p.locator(`.fs-swatch[aria-label^="#526a54"]`).click();
  states.base = await shot('base');
  await p.screenshot({ path: path.join(OUT, 'studio-suv-1920.png') });
  for (const w of WHEELS) for (const lmp of LAMPS) { await pick('wheels', w); await pick('lights', lmp); states[`${w}__${lmp}`] = await shot(`${w}__${lmp}`); }
  await pick('wheels', WHEELS[0]); await pick('lights', LAMPS[0]);
  for (const [name, hex] of Object.entries(COLOURS)) { await p.locator(`.fs-swatch[aria-label^="${hex}"]`).click(); states[`paint-${name}`] = await shot(`paint-${name}`); }
  await p.locator(`.fs-swatch[aria-label^="#526a54"]`).click(); states['base-again'] = await shot('base-again');
  // bumpers: only the original exists; the tray says so
  await p.locator('.fs-cat[data-cat="bumpers"]').click(); const bumperOpts = await p.locator('.fs-opt').evaluateAll((els) => els.map((e) => e.dataset.part));
  await p.locator('.fs-cat[data-cat="handles"]').click(); const handlesEmpty = await p.locator('[data-empty-tray]').count();
  const box = await car.boundingBox();
  fs.writeFileSync(path.join(OUT, 'render.json'), JSON.stringify({ vehicle: id, carCssWidth: box.width, carCssHeight: box.height, deviceScaleFactor: 2, errors, states, bumperOptions: bumperOpts, handlesTrayEmptyMessage: handlesEmpty === 1, suvFilesLoadedAtGarage: loadedAtGarage, suvFilesLoadedInTotal: [...loaded] }, null, 1));
  await b.close(); server.kill();
  execFileSync('python3', [path.join(__dirname, 'proof-suv90.py'), OUT, path.join(ROOT, 'public/flow/suv90/manifest.json'), path.join(ROOT, 'public/flow/suv90/paint-mask.png')], { stdio: 'inherit' });
  process.exit(errors.length ? 1 : 0);
})();
