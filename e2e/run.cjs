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
async function pickMode(page, n) {
  await page.locator('[data-action="new-game"]').click();
  await page.locator('.mode2').nth(n).locator('.m2-head').click();
  if (await page.locator('[data-action="confirm-ok"]').count()) await page.locator('[data-action="confirm-ok"]').click();   // replacing the autosave
}
async function startCeo(page, maker = 'Toyota', year = '2000') {
  await pickMode(page, 0);
  await page.locator('input[type=range]').first().fill(year);
  await page.locator('.card', { hasText: maker }).first().click();
  await page.locator('[data-action="start-game"]').click();
  await page.locator('.shell').waitFor();
}
async function startFounder(page, year = '2005') {
  await pickMode(page, 1);
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
test('menu: continue, new game with three modes, load, settings (Flow)', async (browser) => {
  const { ctx, page, errors } = await open(browser);
  assert(await page.locator('[data-action="resume"]').isDisabled(), 'Continue is disabled without a save, with a reason');
  assert((await page.locator('#fm-continue-note').innerText()).length > 10, 'the reason is written');
  await page.locator('[data-action="new-game"]').click();
  eq(await page.locator('.mode2').count(), 3, 'game modes');
  await page.keyboard.press('Escape');
  eq(await page.locator('.mode2').count(), 0, 'Escape closes the panel');
  await page.locator('[data-action="load-game"]').click();
  await page.locator('.fm-panel').waitFor();
  await page.locator('.fm-side [data-action="settings"]').click();
  await page.locator('.fs-settings').waitFor();
  await page.locator('.fs-set-tab[data-tab="video"]').click();
  eq(await page.locator('.gfx-opt').count(), 5, 'graphics options (auto, low, medium, high, off)');
  // a draft: Back with an unapplied change asks Save / Discard / Cancel
  await page.locator('.fs-set-tab[data-tab="access"]').click();
  await page.locator('[data-pref="reduceMotion"]').click();
  await page.locator('[data-action="settings-back"]').click();
  await page.locator('[role="alertdialog"]').waitFor();
  await page.locator('[role="alertdialog"] .fm-btn.primary').click();
  eq(await page.locator('.fs-settings').count(), 0, 'saved and closed');
  assert(await page.evaluate(() => document.documentElement.classList.contains('reduce-motion')), 'reduced motion is applied');
  noErrors(errors); await ctx.close();
});

test('language: switching changes the interface and is remembered', async (browser) => {
  const { ctx, page, errors } = await open(browser);
  assert((await page.locator('[data-action="new-game"]').innerText()).toLowerCase().includes('new game'), 'English by default');
  await page.locator('.menu2-top button[lang="es"]').click();
  assert((await page.locator('[data-action="new-game"]').innerText()).toLowerCase().includes('nueva partida'), 'Spanish after the switch');
  await page.reload(); await page.locator('.menu2').waitFor();
  assert((await page.locator('[data-action="new-game"]').innerText()).toLowerCase().includes('nueva partida'), 'Spanish is remembered after a reload');
  await startCeo(page);
  eq((await page.locator('.nav [data-view="factories"]').textContent()).trim(), 'Fábricas', 'navigation in Spanish');
  await nav(page, 'factories');
  assert((await page.locator('.main').innerText()).includes('Cadena de suministro'), 'factory screen in Spanish');
  await page.locator('.nav-foot button[lang="en"]').click();
  eq((await page.locator('.nav [data-view="factories"]').textContent()).trim(), 'Factories', 'navigation back in English without reloading');
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


/** Rewrite the autosave in IndexedDB with `mutate` (a function body over `g`, the stored game) to simulate damage. */
async function damageAutosave(page, body) {
  await page.evaluate(async (src) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('automotive-empire', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const rec = await new Promise((res, rej) => { const r = db.transaction('saves').objectStore('saves').get('autosave'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    new Function('g', src)(rec.game);
    await new Promise((res, rej) => { const t = db.transaction('saves', 'readwrite'); t.objectStore('saves').put(rec); t.oncomplete = res; t.onerror = () => rej(t.error); });
    db.close();
  }, body);
}
test('damaged saves: refused with a message instead of a blank screen', async (browser) => {
  for (const [name, body] of [['news missing', 'delete g.news;'], ['technology missing', "g.companies.find((c) => c.id === g.playerId).tech = undefined;"], ['vehicle without stats', "g.companies.find((c) => c.id === g.playerId).models[0].stats = undefined;"], ['no finances', "g.companies.find((c) => c.id === g.playerId).cash = null;"]]) {
    const { ctx, page, errors } = await open(browser);
    await startCeo(page); await nextMonth(page);
    await page.locator('[data-action="quit"]').click(); await page.locator('.menu2').waitFor();
    await damageAutosave(page, body);
    await page.reload(); await page.locator('.menu2').waitFor();
    await page.locator('[data-action="resume"]').click();
    await page.locator('.toast', { hasText: 'damaged' }).waitFor();
    eq(await page.locator('.menu2').count(), 1, `${name}: the menu is still there`);
    eq(await page.locator('.shell').count(), 0, `${name}: the damaged game was not opened`);
    assert(errors.length === 0, `${name}: console errors ${errors.slice(0, 2).join(' | ')}`);
    await ctx.close();
  }
});

test('crash guard: a screen that cannot render shows a way back, not a blank page', async (browser) => {
  const { ctx, page } = await open(browser);
  await startCeo(page); await nextMonth(page);
  await page.locator('[data-action="quit"]').click(); await page.locator('.menu2').waitFor();
  // a truncated racing division passes the structural check (it is optional) but cannot be drawn
  await damageAutosave(page, "const p = g.companies.find((c) => c.id === g.playerId); p.motorsport = { discipline: 'f1' };");
  await page.reload(); await page.locator('.menu2').waitFor();
  await page.locator('[data-action="resume"]').click();
  await page.locator('[data-action="crash-menu"]').waitFor();
  assert((await page.locator('[role="alert"]').innerText()).includes('Something went wrong'), 'recovery message shown');
  await page.locator('[data-action="crash-menu"]').click();
  await page.locator('.menu2').waitFor();
  await ctx.close();
});

test('game over: the books can be read after the dialog, and the way back to the menu stays available', async (browser) => {
  const { ctx, page, errors } = await open(browser);
  await startCeo(page); await nextMonth(page);
  await page.locator('[data-action="quit"]').click(); await page.locator('.menu2').waitFor();
  await damageAutosave(page, "g.gameOver = { reason: 'The board has lost confidence in your leadership and dismissed you.' };");
  await page.reload(); await page.locator('.menu2').waitFor();
  await page.locator('[data-action="resume"]').click(); await page.locator('.shell').waitFor();
  eq(await page.locator('.modal').count(), 1, 'the game-over dialog is shown');
  assert(await page.locator('[data-action="next-month"]').isDisabled(), 'time cannot advance after game over');
  await page.locator('[data-action="over-books"]').click();
  eq(await page.locator('.modal').count(), 0, 'the dialog gets out of the way so the books can be read');
  eq(await page.locator('.nav [aria-current="page"]').getAttribute('data-view'), 'finance', 'the finance screen is open');
  await nav(page, 'company'); await nav(page, 'finance');
  await page.locator('[data-action="over-menu"]').click();
  await page.locator('.menu2').waitFor();
  noErrors(errors); await ctx.close();
});

test('2d loop: headquarters, engineering, design studio, achievement, chest, garage, factory and rankings', async (browser) => {
  const { ctx, page, errors } = await open(browser);
  await startFounder(page);
  eq(await page.locator('.nav [aria-current="page"]').getAttribute('data-view'), 'hq2d', 'the game opens at the headquarters');
  assert(await page.locator('.fs-hq .fs-scene img.fs-bg').count() === 1, 'the Flow campus scene is drawn');
  eq(await page.locator('.g2-hub .g2-mini-league').count(), 0, 'no ranking before any month is closed');
  // engineering (mechanics) through the simulator's rules
  await nav(page, 'workshop2d');
  const power0 = await page.locator('.g2-specs dd').first().innerText();
  await page.locator('.g2-option[data-option="V8"]').click();
  const power1 = await page.locator('.g2-specs dd').first().innerText();
  assert(power0 !== power1, `choosing a V8 changes the projected power (${power0} → ${power1})`);
  await page.locator('.g2-steps button').nth(4).click();
  await page.locator('.g2-option[data-option="sedan"]').click();
  await page.locator('.g2-steps button').last().click();
  await page.locator('[data-field="model-name"]').fill('Arrow GT');
  if (await page.locator('.g2-approve .g2-warn .g2-btn').count()) await page.locator('.g2-approve .g2-warn .g2-btn').click();
  await page.locator('[data-action="2d-start-development"]').click();
  await page.locator('.g2-hub').waitFor();
  assert((await page.locator('.g2-range').innerText()).includes('Arrow GT'), 'the approved car appears in the range');
  // the design workshop building opens the studio; a visual change, undo, redo, save
  await page.locator('.fs-pin[data-spot="studio"]').click();
  await page.locator('.fs-studio').waitFor();
  const paint0 = await page.locator('.fs-stage .gt01').getAttribute('data-paint');
  await page.locator('.fs-swatch').nth(4).click();
  const paint1 = await page.locator('.fs-stage .gt01').getAttribute('data-paint');
  assert(paint0 !== paint1, `the paint changes the preview (${paint0} → ${paint1})`);
  await page.locator('.fs-cat[data-cat="suspension"]').click();
  await page.locator('.fs-opt[data-part="ride-low"]').click();
  eq(await page.locator('.fs-stage .gt01').getAttribute('data-ride'), 'ride-low', 'ride height changes the preview');
  await page.getByRole('button', { name: 'Undo' }).click();
  eq(await page.locator('.fs-stage .gt01').getAttribute('data-ride'), 'ride-stock', 'undo');
  await page.getByRole('button', { name: 'Redo' }).click();
  eq(await page.locator('.fs-stage .gt01').getAttribute('data-ride'), 'ride-low', 'redo');
  await page.locator('.fs-cat[data-cat="roof"]').click();
  assert(await page.locator('.fs-opt[data-part="roof-soft-top"]').isDisabled(), 'an open roof needs another body family');
  await page.locator('[data-action="studio-save"]').click();
  assert(await page.locator('[data-action="studio-save"]').isDisabled(), 'saved: nothing left to save');
  // an achievement reached by a fact, claimed once
  await nav(page, 'collection2d');
  const goal = page.locator('[data-goal="first-programme"]');
  await goal.locator('[data-action="claim-goal"]').click();
  await goal.locator('.g2-chip').waitFor();
  eq(await goal.locator('[data-action="claim-goal"]').count(), 0, 'a claimed achievement cannot be claimed again');
  // the starter chest: open once, real card, claim
  await nav(page, 'chests2d');
  await page.locator('.fs-chestbtn[data-milestone="0"]').click();
  await page.locator('[data-action="open-chest"]').click();
  await page.locator('.fs-reward .card2d').waitFor();
  await page.locator('[data-action="claim-chest"]').click();
  assert(await page.locator('.fs-chestbtn[data-milestone="0"]').isDisabled(), 'the chest cannot be opened twice');
  // the plant: a station shows its stage
  await nav(page, 'factory2d');
  if (await page.locator('.fs-factory').count()) {
    await page.locator('.fs-station[data-station="paint"]').click();
    await page.locator('[data-sector-detail="paint"]').waitFor();
  }
  await nextMonth(page);
  await nav(page, 'league2d');
  assert(await page.locator('.g2-table tr').count() > 3, 'the industry table is built after a closed month');
  noErrors(errors); await ctx.close();
});

test('garage: real vehicles, Customise opens the studio on that vehicle with its saved configuration', async (browser) => {
  const { ctx, page, errors } = await open(browser);
  await startCeo(page, 'Toyota', '2024');
  await nav(page, 'garage2d');
  const sel = page.locator('.fs-gcard[data-model]');
  const id = await sel.getAttribute('data-model');
  await page.locator('[data-action="customize"]').click();
  await page.locator('.fs-studio').waitFor();
  eq(await page.locator('[data-field="studio-target"]').inputValue(), id, 'the studio edits the chosen vehicle');
  await page.locator('.fs-swatch').nth(3).click();
  await page.locator('[data-action="studio-save"]').click();
  const saved = await page.locator('.fs-stage .gt01, .fs-stage .fs-car').first().getAttribute('data-paint');
  await nav(page, 'garage2d');
  if (saved) eq(await page.locator('.fs-gmain .fs-scene .gt01').first().getAttribute('data-paint'), saved, 'the garage shows the same configuration');
  noErrors(errors); await ctx.close();
});

test('modular GT: variants and finish saved per vehicle, recovered in garage, studio and after reloading; open roofs refused', async (browser) => {
  const { ctx, page, errors } = await open(browser, { lang: 'es' });
  await startCeo(page, 'Toyota', '2024');
  await nav(page, 'garage2d');
  // a vehicle drawn as GT-01 (a modern saloon or coupé)
  const ids = await page.locator('.fs-gtray .fs-thumb[data-model]').evaluateAll((els) => els.filter((e) => e.querySelector('.gt01')).map((e) => e.getAttribute('data-model')));
  assert(ids.length > 0, 'the garage has a vehicle drawn as GT-01');
  const id = ids[0];
  await page.locator(`.fs-gtray .fs-thumb[data-model="${id}"]`).click();
  await page.locator('[data-action="customize"]').click();
  await page.locator('.fs-studio').waitFor();
  eq(await page.locator('[data-field="studio-target"]').inputValue(), id, 'the studio edits the chosen vehicle');
  const pick = async (cat, part) => { await page.locator(`.fs-cat[data-cat="${cat}"]`).click(); await page.locator(`.fs-opt[data-part="${part}"]`).click(); };
  await pick('wheels', 'wheel-multispoke'); await pick('lights', 'headlamp-matrix'); await pick('bumpers', 'bumper-front-sport');
  // open roofs need the open-top body family, which has no asset: disabled, with the reason
  await page.locator('.fs-cat[data-cat="roof"]').click();
  for (const r of ['roof-soft-top', 'roof-retractable-hardtop']) {
    assert(await page.locator(`.fs-opt[data-part="${r}"]`).isDisabled(), `${r} is disabled`);
    assert((await page.locator(`.fs-opt[data-part="${r}"] small`).innerText()).includes('estructura'), `${r} says why`);
  }
  assert(await page.locator('.fs-opt[data-part="roof-panoramic"]').isEnabled(), 'the panoramic roof can be fitted');
  await page.locator('.fs-chip', { hasText: 'Mate' }).click();
  const stage = page.locator('.fs-stage .gt01');
  const parts = await stage.getAttribute('data-parts');
  eq(parts, 'bumper-front-sport headlamp-matrix', 'the stage shows the chosen overlays');
  eq(await stage.locator('.gt01-wheel[data-part="wheel-multispoke"]').count(), 2, 'both wheels are multi-spoke');
  await page.locator('[data-action="studio-save"]').click();
  const check = async (car, where) => {
    eq(await car.getAttribute('data-parts'), parts, `${where}: overlays`);
    eq(await car.getAttribute('data-finish'), 'matte', `${where}: finish`);
    eq(await car.locator('.gt01-wheel[data-part="wheel-multispoke"]').count(), 2, `${where}: wheels`);
  };
  await nav(page, 'garage2d');
  await page.locator(`.fs-gtray .fs-thumb[data-model="${id}"]`).click();
  await check(page.locator('.fs-gmain .fs-scene .gt01').first(), 'garage');
  await check(page.locator(`.fs-gtray .fs-thumb[data-model="${id}"] .gt01`), 'garage thumbnail');
  // another vehicle keeps its own (default) configuration
  const other = ids.find((x) => x !== id);
  if (other) eq(await page.locator(`.fs-gtray .fs-thumb[data-model="${other}"] .gt01`).getAttribute('data-parts'), '', 'another vehicle is unchanged');
  await nav(page, 'hq2d'); await nav(page, 'studio2d');
  await check(page.locator('.fs-stage .gt01'), 'studio reopened');
  // the autosave carries it: reload the page and resume
  await page.locator('[data-action="quit"]').click(); await page.locator('.menu2').waitFor();
  await page.reload(); await page.locator('.menu2').waitFor();
  await page.locator('[data-action="resume"]').click(); await page.locator('.shell').waitFor();
  await nav(page, 'garage2d');
  await page.locator(`.fs-gtray .fs-thumb[data-model="${id}"]`).click();
  await check(page.locator('.fs-gmain .fs-scene .gt01').first(), 'garage after reload');
  noErrors(errors); await ctx.close();
});

test('SUV 1990 family: wheels, lamps and colour saved per vehicle and recovered; only drawn variants offered', async (browser) => {
  const { ctx, page, errors } = await open(browser, { lang: 'es' });
  await startCeo(page, 'Toyota', '1995');
  await nav(page, 'garage2d');
  const id = await page.locator('.fs-gtray .fs-thumb:has(.mcar[data-family="suv90-green"])').first().getAttribute('data-model');
  assert(id, 'a 1984–2004 SUV is drawn by the suv90-green family');
  await page.locator(`.fs-gtray .fs-thumb[data-model="${id}"]`).click();
  eq(await page.locator('.fs-gcard [data-art-family]').getAttribute('data-art-family'), 'suv90-green', 'the garage card names the family');
  await page.locator('[data-action="customize"]').click(); await page.locator('.fs-studio').waitFor();
  const car = page.locator('.fs-stage .mcar');
  eq(await car.getAttribute('data-family'), 'suv90-green', 'the studio draws the SUV family');
  // the tray offers only this family's parts
  const opts = async (cat) => { await page.locator(`.fs-cat[data-cat="${cat}"]`).click(); return page.locator('.fs-opt').evaluateAll((els) => els.map((e) => e.dataset.part)); };
  eq((await opts('wheels')).join(' '), 'wheel-suv90-steel5 wheel-suv90-steel6 wheel-suv90-alloy6', 'SUV wheels only');
  eq((await opts('bumpers')).join(' '), 'bumper-suv90-standard', 'only the original bumper (trial faces rejected)');
  await page.locator('.fs-cat[data-cat="roof"]').click(); eq(await page.locator('[data-empty-tray]').count(), 1, 'a category without SUV variants says so');
  await page.locator('.fs-cat[data-cat="wheels"]').click(); await page.locator('.fs-opt[data-part="wheel-suv90-alloy6"]').click();
  await page.locator('.fs-cat[data-cat="lights"]').click(); await page.locator('.fs-opt[data-part="headlamp-suv90-halogen-b"]').click();
  await page.locator('.fs-swatch[aria-label^="#c8352e"]').click();
  eq(await car.getAttribute('data-parts'), 'headlamp-b wheel-alloy-rear wheel-alloy-front', 'the stage shows the chosen layers');
  eq(await car.getAttribute('data-repaint'), '1', 'a colour other than the original repaints through the mask');
  await page.locator('[data-action="studio-save"]').click();
  const check = async (c, where) => { eq(await c.getAttribute('data-parts'), 'headlamp-b wheel-alloy-rear wheel-alloy-front', `${where}: parts`); eq(await c.getAttribute('data-paint'), '#c8352e', `${where}: paint`); };
  await nav(page, 'garage2d'); await page.locator(`.fs-gtray .fs-thumb[data-model="${id}"]`).click();
  await check(page.locator('.fs-gmain .fs-scene .mcar').first(), 'garage');
  await page.locator('[data-action="quit"]').click(); await page.locator('.menu2').waitFor();
  await page.reload(); await page.locator('.menu2').waitFor();
  await page.locator('[data-action="resume"]').click(); await page.locator('.shell').waitFor();
  await nav(page, 'garage2d'); await page.locator(`.fs-gtray .fs-thumb[data-model="${id}"]`).click();
  await check(page.locator('.fs-gmain .fs-scene .mcar').first(), 'garage after reload');
  // restore the original drawing
  await page.locator('[data-action="customize"]').click(); await page.locator('.fs-studio').waitFor();
  await page.locator('.fs-cat[data-cat="wheels"]').click(); await page.locator('.fs-opt[data-part="wheel-suv90-steel5"]').click();
  await page.locator('.fs-cat[data-cat="lights"]').click(); await page.locator('.fs-opt[data-part="headlamp-suv90-original"]').click();
  await page.locator('.fs-swatch[data-original="1"]').click();
  eq(await car.getAttribute('data-parts'), '', 'back to the original drawing: no variant layer');
  eq(await car.getAttribute('data-repaint'), '0', 'original green: no repaint layer');
  noErrors(errors); await ctx.close();
});

test('Tuning Lab (separate page): stage, race, incompatible stage disabled, ECU refuses a map', async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE + 'tuning.html'); await page.locator('.tl').waitFor();
  assert(await page.locator('[data-stage="m18-stage1"]').isDisabled(), 'a stage for another engine is disabled');
  assert(await page.locator('[data-field="boost"]').isDisabled(), 'the stock ECU cannot be recalibrated');
  await page.locator('[data-action="race"]').click(); await page.locator('[data-results]').waitFor();
  const stock = parseFloat(await page.locator('[data-run="build"] [data-et4]').innerText());
  await page.locator('[data-stage="k20t-stage2"]').click();
  for (const [cat, id] of [['clutch', 'clutch-r5-twin'], ['differential', 'diff-r-lsd-41'], ['tyres', 'tyres-16-drag']]) await page.locator(`select[data-cat="${cat}"]`).selectOption(id);
  await page.locator('[data-action="race"]').click(); await page.locator('[data-results]').waitFor();
  const built = parseFloat(await page.locator('[data-run="build"] [data-et4]').innerText());
  assert(built < stock - 1, `the built car is quicker over 1/4 mile (${built} vs ${stock})`);
  await page.locator('[data-field="boost"]').fill('2.2');
  assert((await page.locator('.tl-error').allInnerTexts()).join(' ').includes('supera lo que puede dar este turbo'), 'the ECU names the limit');
  assert(await page.locator('[data-action="race"]').isDisabled(), 'no race with an invalid map');
  // the game itself is untouched: its page still opens
  await page.goto(BASE); await page.locator('.menu2').waitFor();
  noErrors(errors); await ctx.close();
});

test('audit AE-01: typing spaces in the save importer never advances the month; Space outside forms still does', async (browser) => {
  const { ctx, page, errors } = await open(browser);
  await startCeo(page);
  await nav(page, 'saves');
  const date0 = await stat(page, 'date'), cash0 = await stat(page, 'cash');
  await page.locator('button', { hasText: /Paste a save/ }).click();
  const ta = page.locator('#paste-save'); await ta.waitFor(); await ta.click();
  for (let i = 0; i < 10; i++) await page.keyboard.press('Space');
  await page.keyboard.type('line one\nline two  with  spaces');
  await page.evaluate(() => { const el = document.querySelector('#paste-save'); el.focus(); document.execCommand('insertText', false, ' pasted text '); });
  await page.waitForTimeout(400);
  eq(await stat(page, 'date'), date0, 'the month did not change while typing');
  eq(await stat(page, 'cash'), cash0, 'cash did not change while typing');
  assert((await ta.inputValue()).startsWith('          line one'), 'the spaces went into the text area');
  // with the dialog open, Space on the page body does nothing either
  await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press('Space'); await page.waitForTimeout(300);
  eq(await stat(page, 'date'), date0, 'Space is ignored while a dialog is open');
  await page.keyboard.press('Escape');
  if (await page.locator('#paste-save').count()) await page.mouse.click(5, 5);
  await page.locator('#paste-save').waitFor({ state: 'detached' });
  await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press('Space');
  await page.waitForFunction((d) => document.querySelector('[data-stat="date"] .v')?.textContent?.trim() !== d, date0);
  noErrors(errors); await ctx.close();
});

test('audit AE-03/AE-08: the Director setup budget equals the team that is created; +3 months stops at the race weekend', async (browser) => {
  const { ctx, page, errors } = await open(browser);
  await pickMode(page, 2);
  const pv = page.locator('[data-preview="ms-budget"]'); await pv.waitFor();
  const want = { owner: Number(await pv.getAttribute('data-owner')), sponsors: Number(await pv.getAttribute('data-sponsors')), cash: Number(await pv.getAttribute('data-cash')) };
  await page.locator('[data-action="start-game"]').click(); await page.locator('.shell').waitFor();
  // read the real budget from the autosave that the game writes on start
  const real = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('automotive-empire'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const rec = await new Promise((res, rej) => { const t = db.transaction('saves', 'readonly'); const q = t.objectStore('saves').getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    const g = rec.map((x) => x.game ?? x.data ?? x).find((x) => x && x.companies); const c = g.companies.find((x) => x.id === g.playerId);
    return { owner: Math.round(c.motorsport.ownerGrant), sponsors: Math.round(c.motorsport.sponsors.reduce((a, x) => a + x.annual, 0) + c.motorsport.championship.teams.find((t) => t.id === c.motorsport.teamId).drivers.reduce((a, id) => a + (c.motorsport.championship.drivers.find((d) => d.id === id)?.backing ?? 0), 0)), cash: Math.round(c.cash), month: g.month };
  });
  eq(real.owner, want.owner, 'owner funding: setup preview = team created');
  eq(real.cash, want.cash, 'starting cash: setup preview = team created');
  eq(real.sponsors, want.sponsors, 'sponsors: setup preview = team created');
  // +3 months: stops when the first race weekend arrives, nothing simulated
  await page.locator('button', { hasText: '+3 months' }).click();
  await page.locator('[data-action="race-weekend"]').waitFor();
  await nav(page, 'motorsport');
  eq(await page.locator('[data-action="race-weekend"]').count() > 0, true, 'the race weekend is waiting for the player');
  // while the weekend waits, the batch button is replaced by the race button: nothing can simulate it by accident
  eq(await page.locator('button', { hasText: '+3 months' }).count(), 0, 'no batch advance while a race waits');
  const results = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('automotive-empire', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const rec = await new Promise((res, rej) => { const r = db.transaction('saves').objectStore('saves').get('autosave'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    db.close(); const g = rec.game; return g.companies.find((x) => x.id === g.playerId).motorsport.championship.results.length;
  });
  eq(results, 0, 'no race was simulated on the way');
  noErrors(errors); await ctx.close();
});

test('audit AE-05: the acquisition dialog shows cash received and debt assumed, and Cancel changes nothing', async (browser) => {
  const { ctx, page, errors } = await open(browser);
  await startCeo(page, 'Ferrari', '1985');
  await nav(page, 'company');
  const cash0 = await stat(page, 'cash'), debt0 = await stat(page, 'debt');
  await page.locator('tr', { hasText: 'Lamborghini' }).locator('[data-action="acquire"]').click();
  const dlg = page.locator('[role="alertdialog"]'); await dlg.waitFor();
  const text = await dlg.innerText();
  for (const w of ['Purchase review', 'cash that comes with Lamborghini', 'debt you assume', 'Your debt:', 'Credit left afterwards']) assert(text.includes(w), `the review mentions "${w}"`);
  await page.locator('[data-action="confirm-cancel"]').click();
  await page.waitForTimeout(250);
  eq(await stat(page, 'cash'), cash0, 'Cancel: cash unchanged'); eq(await stat(page, 'debt'), debt0, 'Cancel: debt unchanged');
  noErrors(errors); await ctx.close();
});

test('studio at 1280x720: the stage and the parts tray fit the window', async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('ae.lang', 'es'); localStorage.setItem('ae.graphics.quality', 'off'); localStorage.setItem('ae.guide.welcomeSeen', '1'); } catch {} });
  const page = await ctx.newPage(); page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE); await page.locator('.menu2').waitFor();
  await startCeo(page, 'Toyota', '2024');
  await nav(page, 'studio2d'); await page.locator('.fs-studio').waitFor();
  for (const cat of ['wheels', 'roof', 'paint']) {
    await page.locator(`.fs-cat[data-cat="${cat}"]`).click(); await page.waitForTimeout(100);
    const r = await page.evaluate(() => {
      const tray = document.querySelector('.fs-tray'), t = tray.getBoundingClientRect(), c = document.querySelector('.fs-stage .gt01, .fs-stage .fs-car').getBoundingClientRect();
      const opt = Math.max(0, ...[...tray.querySelectorAll('.fs-opt')].map((e) => e.getBoundingClientRect().bottom));
      return { tray: t.bottom, inner: t.bottom - parseFloat(getComputedStyle(tray).paddingBottom), opt, carW: c.width, carBottom: c.bottom, doc: document.documentElement.scrollWidth };
    });
    assert(r.tray <= 720, `${cat}: the tray ends inside the window (${r.tray})`);
    assert(r.opt <= r.inner + 1, `${cat}: every option (with its reason) fits in the tray (${r.opt} > ${r.inner})`);
    assert(r.carBottom <= 720 && r.carW > 400, `${cat}: the car is visible and large (${r.carW} px)`);
    eq(r.doc, 1280, `${cat}: no horizontal scroll`);
  }
  noErrors(errors); await ctx.close();
});

test('2d phone: the headquarters and workshop fit a 390 px screen', async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('ae.lang', 'es'); localStorage.setItem('ae.graphics.quality', 'off'); localStorage.setItem('ae.guide.welcomeSeen', '1'); } catch {} });
  const page = await ctx.newPage(); page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE); await page.locator('.menu2').waitFor();
  await startFounder(page);
  for (const v of ['hq2d', 'studio2d', 'workshop2d', 'garage2d', 'chests2d', 'collection2d', 'league2d']) {
    await page.evaluate((view) => document.querySelector(`.nav [data-view="${view}"]`)?.click(), v); await page.waitForTimeout(200);
    const over = await page.evaluate(() => [...document.querySelectorAll('.g2 *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > window.innerWidth + 1 && !e.closest('.fl2d,.g2-steps,.g2-tabs,.g2-table-wrap,.nav') && !(e.ownerSVGElement); }).map((e) => String(e.className?.baseVal ?? e.className)).slice(0, 3)); // shapes inside an <svg> are clipped by it; the <svg> itself is measured
    eq(over.length, 0, `${v}: nothing overflows the phone width (${over.join(', ')})`);
  }
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
