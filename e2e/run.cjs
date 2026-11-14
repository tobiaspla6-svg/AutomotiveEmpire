// Browser interaction tests for Automotive Empire (Phase 4C): navigation, game actions, language switching, save
// loading, the race weekend and the no-WebGL path, driven through the real production build in Chromium.
//
//   npx vite build && node e2e/run.cjs            (all tests)
//   node e2e/run.cjs save language                (only tests whose name contains one of these words)
//
// Needs Playwright with a Chromium it can launch (`npm i -D playwright && npx playwright install chromium`, or a
// global install). It is not part of `npm run ci`, so the unit suite keeps running where no browser is available.
const { spawn } = require('node:child_process');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); } catch { console.error('Playwright is not installed: see the header of e2e/run.cjs.'); process.exit(2); }

const PORT = Number(process.env.E2E_PORT || 4319);
const BASE = `http://localhost:${PORT}/`;
const ROOT = path.resolve(__dirname, '..');
const only = process.argv.slice(2);
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (a, b, msg) => assert(a === b, `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

async function waitForServer() {
  for (let i = 0; i < 100; i++) { try { const r = await fetch(BASE); if (r.ok) return; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 200)); }
  throw new Error('preview server did not start');
}

/** A fresh browser context: empty storage, a chosen language and graphics setting, the welcome already seen. */
async function open(browser, { lang = 'en', quality = 'off', welcome = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  await ctx.addInitScript(([l, q, w]) => { try { if (!localStorage.getItem('ae.lang')) localStorage.setItem('ae.lang', l); if (!localStorage.getItem('ae.graphics.quality')) localStorage.setItem('ae.graphics.quality', q); if (!w) localStorage.setItem('ae.guide.welcomeSeen', '1'); } catch {} }, [lang, quality, welcome]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE);
  await page.locator('.menu2').waitFor();
  return { ctx, page, errors };
}
const stat = async (page, id) => (await page.locator(`[data-stat="${id}"] .v`).innerText()).trim();
async function startCeo(page, maker = 'Toyota', year = '2000') {
  await page.locator('.mode2').nth(0).locator('.m2-head').click();
  await page.locator('input[type=range]').first().fill(year);
  await page.locator('.card', { hasText: maker }).first().click();
  await page.locator('[data-action="start-game"]').click();
  await page.locator('.shell').waitFor();
}
async function startFounder(page, year = '2005') {
  await page.locator('.mode2').nth(1).locator('.m2-head').click();
  await page.locator('input[type=range]').first().fill(year);
  await page.locator('[data-action="start-game"]').click();
  await page.locator('.shell').waitFor();
}
/** Advance one month, answering any decision with its first option and running any pending race instantly. */
async function nextMonth(page) {
  for (let guard = 0; guard < 6; guard++) {
    if (await page.locator('.modal .card').count()) { await page.locator('.modal .card').first().click(); await page.waitForTimeout(150); continue; }
    if (await page.locator('[data-action="race-weekend"]').count()) {
      await page.locator('[data-action="race-weekend"]').click();
      await page.locator('[data-action="simulate-race"]').click();
      await page.locator('[data-action="race-continue"]').first().click();
      await page.locator('.shell').waitFor();
      continue;
    }
    break;
  }
  const before = await stat(page, 'date');
  await page.locator('[data-action="next-month"]').click();
  await page.waitForFunction((b) => document.querySelector('[data-stat="date"] .v')?.textContent?.trim() !== b, before);
  if (await page.locator('.modal .card').count()) await page.locator('.modal .card').first().click();
}
const nav = async (page, view) => { await page.locator(`.nav [data-view="${view}"]`).click(); await page.waitForTimeout(150); };
const noErrors = (errors) => assert(errors.length === 0, `console errors: ${errors.slice(0, 3).join(' | ')}`);

// ---------------------------------------------------------------------------------------------------- tests
test('menu: three modes, hover preview and settings', async (browser) => {
  const { ctx, page, errors } = await open(browser);
  eq(await page.locator('.mode2').count(), 3, 'game modes');
  await page.locator('.mode2').nth(2).hover();
  assert((await page.locator('.showroom-cap b').innerText()).includes('Motorsport'), 'the showroom caption follows the hovered mode');
  await page.locator('.menu2-top [aria-label="Settings"]').click();
  await page.locator('.gfx-options').waitFor();
  eq(await page.locator('.gfx-opt').count(), 5, 'graphics options (auto, low, medium, high, off)');
  await page.locator('[aria-label="Close"]').click();
  noErrors(errors); await ctx.close();
});

test('language: switching changes the interface and is remembered', async (browser) => {
  const { ctx, page, errors } = await open(browser);
  assert((await page.locator('.mode2').first().innerText()).includes('Historical Automotive CEO'), 'English by default');
  await page.locator('.menu2-top button[lang="es"]').click();
  assert((await page.locator('.mode2').first().innerText()).includes('CEO histórico'), 'Spanish after the switch');
  await page.reload(); await page.locator('.menu2').waitFor();
  assert((await page.locator('.mode2').first().innerText()).includes('CEO histórico'), 'Spanish is remembered after a reload');
  await startCeo(page);
  eq((await page.locator('.nav [data-view="factories"]').innerText()).trim(), 'Fábricas', 'navigation in Spanish');
  await nav(page, 'factories');
  assert((await page.locator('.main').innerText()).includes('Cadena de suministro'), 'factory screen in Spanish');
  await page.locator('.nav-foot button[lang="en"]').click();
  eq((await page.locator('.nav [data-view="factories"]').innerText()).trim(), 'Factories', 'navigation back in English without reloading');
  assert((await page.locator('.main').innerText()).includes('Supply chain'), 'the open screen re-renders in English');
  eq(await page.evaluate(() => document.documentElement.lang), 'en', 'document language attribute');
  noErrors(errors); await ctx.close();
});

test('navigation: every screen opens and renders its own content', async (browser) => {
  const { ctx, page, errors } = await open(browser);
  await startCeo(page);
  const expect = { dashboard: '.dash', vehicles: '.range-hero', research: '.tech-grid', factories: '.fac .flow', market: '.region-grid', finance: '.corp-main', company: '[data-action="acquire"]', motorsport: '.ms-hero', news: '.news-item', saves: '[data-action="save-game"]' };
  for (const [view, sel] of Object.entries(expect)) {
    await nav(page, view);
    await page.locator(sel).first().waitFor();
    eq(await page.locator(`.nav [data-view="${view}"]`).getAttribute('aria-current'), 'page', `${view} is marked current`);
  }
  for (const tab of ['car', 'team', 'season', 'hq']) { await nav(page, 'motorsport'); await page.locator(`.ms-head [data-tab="${tab}"]`).click(); eq(await page.locator(`.ms-head [data-tab="${tab}"]`).getAttribute('aria-selected'), 'true', `motorsport tab ${tab}`); }
  await nav(page, 'dashboard');
  await page.locator('.insight .btn').first().click();
  assert((await page.locator('.nav [aria-current="page"]').getAttribute('data-view')) !== 'dashboard', 'a briefing action opens another screen');
  noErrors(errors); await ctx.close();
});

test('actions: time advances and the studio starts a development programme', async (browser) => {
  const { ctx, page, errors } = await open(browser);
  await startFounder(page);
  eq(await stat(page, 'date'), 'Jan 2005', 'starting date');
  await page.locator('[data-action="guide-go"]').click();
  await page.locator('[data-action="new-vehicle"]').click();
  await page.locator('.studio-grid').waitFor();
  assert(await page.locator('[data-action="start-development"]').first().isDisabled(), 'cannot start an unnamed car');
  await page.locator('.studio-name').fill('E2E Coupe');
  const power0 = await page.locator('.spec-tile').first().locator('b').innerText();
  await page.locator('[data-mode="advanced"]').click();
  await page.locator('[data-section="engine"]').click();
  await page.locator('.section-body input[type=range]').first().fill('2600');
  const power1 = await page.locator('.spec-tile').first().locator('b').innerText();
  assert(Number(power1) > Number(power0), `a bigger engine makes more power (${power0} -> ${power1})`);
  await page.locator('[data-action="start-development"]').first().click();
  if (await page.locator('[data-action="confirm-ok"]').count()) await page.locator('[data-action="confirm-ok"]').click();
  await page.locator('.range-table tbody tr').first().waitFor();
  assert((await page.locator('.range-table tbody tr').first().innerText()).includes('E2E Coupe'), 'the new model is in the range');
  const cash0 = await stat(page, 'cash');
  await nextMonth(page);
  eq(await stat(page, 'date'), 'Feb 2005', 'one month later');
  assert((await stat(page, 'cash')) !== cash0, 'cash changed after a month of development spending');
  noErrors(errors); await ctx.close();
});

test('actions: borrowing, a risky sale that can be cancelled, and a contract', async (browser) => {
  const { ctx, page, errors } = await open(browser);
  await startCeo(page);
  await nav(page, 'finance');
  const debt0 = await stat(page, 'debt');
  await page.locator('[aria-label="Loan amount in millions"]').fill('500');
  await page.locator('[data-action="borrow"]').click();
  if (await page.locator('[data-action="confirm-ok"]').count()) await page.locator('[data-action="confirm-ok"]').click();
  await page.waitForFunction((d) => document.querySelector('[data-stat="debt"] .v')?.textContent?.trim() !== d, debt0);
  await nav(page, 'factories');
  const plants = await page.locator('[data-plant]').count();
  await page.locator('[data-plant]').first().locator('.btn.danger').click();
  await page.locator('[role="alertdialog"]').waitFor();
  assert((await page.locator('[role="alertdialog"]').innerText()).includes('cannot be undone'), 'selling a plant explains the consequence');
  await page.locator('[data-action="confirm-cancel"]').click();
  eq(await page.locator('[data-plant]').count(), plants, 'cancelling keeps the plant');
  await page.locator('[data-component="tires"] [data-action="contract"]').click();
  await page.locator('[data-action="sign-contract"]').click();
  await page.locator('.toast', { hasText: 'at most' }).waitFor(); // a manufacturer this size needs more than one supplier can commit: the game says so
  await page.locator('.modal input[type=range]').first().fill('20000');
  await page.locator('[data-action="sign-contract"]').click();
  await page.locator('[data-component="tires"] .status-chip', { hasText: 'Contract' }).waitFor();
  noErrors(errors); await ctx.close();
});

test('saves: save, keep playing, load the save back, resume from the menu', async (browser) => {
  const { ctx, page, errors } = await open(browser);
  await startCeo(page);
  await nextMonth(page);
  const saved = await stat(page, 'date');
  await nav(page, 'saves');
  await page.locator('[aria-label="Save name"]').fill('E2E checkpoint');
  await page.locator('[data-action="save-game"]').click();
  await page.locator('[data-save="E2E checkpoint"]').waitFor();
  await nextMonth(page); await nextMonth(page);
  assert((await stat(page, 'date')) !== saved, 'time moved on after the save');
  await nav(page, 'saves');
  await page.locator('[data-save="E2E checkpoint"] [data-action="load-save"]').click();
  await page.locator('[data-action="confirm-ok"]').click();
  await page.waitForFunction((d) => document.querySelector('[data-stat="date"] .v')?.textContent?.trim() === d, saved);
  await page.locator('[data-action="quit"]').click();
  await page.locator('.menu2').waitFor();
  await page.locator('[data-action="resume"]').waitFor();
  await page.reload(); await page.locator('.menu2').waitFor();
  await page.locator('[data-action="resume"]').click();
  await page.locator('.shell').waitFor();
  assert((await page.locator('.who-text b').innerText()).includes('Toyota'), 'the resumed game is the same company');
  noErrors(errors); await ctx.close();
});

test('race weekend: briefing, instant simulation, classification, back to headquarters', async (browser) => {
  const { ctx, page, errors } = await open(browser);
  await startCeo(page);
  for (let i = 0; i < 14 && !(await page.locator('[data-action="race-weekend"]').count()); i++) { await page.locator('[data-action="next-month"]').click(); await page.waitForTimeout(350); if (await page.locator('.modal .card').count()) await page.locator('.modal .card').first().click(); }
  await page.locator('[data-action="race-weekend"]').click();
  await page.locator('[data-action="start-race"]').waitFor();
  await page.locator('[data-action="simulate-race"]').click();
  await page.locator('.race-overlay table tbody tr').first().waitFor();
  assert((await page.locator('.tower .trow').count()) >= 10, 'the timing tower lists the field');
  assert((await page.locator('.tower .trow.me').count()) >= 1, 'the player cars are highlighted');
  await page.locator('[data-action="race-continue"]').first().click();
  await page.locator('.shell').waitFor();
  eq(await page.locator('[data-action="race-weekend"]').count(), 0, 'the race is done: time can advance again');
  noErrors(errors); await ctx.close();
});

test('no WebGL: 3D off still gives a usable studio', async (browser) => {
  const { ctx, page, errors } = await open(browser, { quality: 'off' });
  eq(await page.locator('canvas').count(), 0, 'no canvas on the menu');
  await startFounder(page);
  await nav(page, 'vehicles');
  await page.locator('[data-action="new-vehicle"]').click();
  await page.locator('.studio .poster').waitFor();
  eq(await page.locator('canvas').count(), 0, 'no canvas in the studio');
  assert(await page.locator('.studio-right .spec-tile').count() === 4, 'the engineering figures are all there');
  noErrors(errors); await ctx.close();
});

test('onboarding: the welcome appears once and the checklist leads to the next step', async (browser) => {
  const { ctx, page, errors } = await open(browser, { welcome: true });
  await startFounder(page);
  await page.locator('[data-action="welcome-close"]').click();
  assert((await page.locator('.guide-steps li.next').getAttribute('data-step')) === 'design', 'the first step is to design a car');
  await page.locator('[data-action="quit"]').click();
  await page.locator('[data-action="resume"]').click();
  await page.locator('.shell').waitFor();
  eq(await page.locator('[data-action="welcome-close"]').count(), 0, 'the welcome is not shown twice');
  await page.locator('[data-action="help"]').click();
  await page.locator('[data-action="welcome-close"]').waitFor();
  noErrors(errors); await ctx.close();
});

// ---------------------------------------------------------------------------------------------------- runner
(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  let failed = 0;
  try {
    await waitForServer();
    const browser = await chromium.launch();
    for (const t of tests.filter((x) => !only.length || only.some((w) => x.name.includes(w)))) {
      const t0 = Date.now();
      try { await t.fn(browser); console.log(`  ok    ${t.name}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`); }
      catch (e) { failed++; console.log(`  FAIL  ${t.name}\n        ${String(e.message || e).split('\n').slice(0, 6).join(' | ')}`); }
    }
    await browser.close();
  } finally { server.kill(); }
  console.log(failed ? `\n${failed} browser test(s) failed` : '\nall browser tests passed');
  process.exit(failed ? 1 : 0);
})();
