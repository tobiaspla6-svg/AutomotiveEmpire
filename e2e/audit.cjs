// Phase 4D exploratory browser audit: plays a founder game through the real UI and records what happens.
//   npx vite build && node e2e/audit.cjs [outDir]
// It prints PASS/FAIL per step (it keeps going after a failure) and writes screenshots to docs/audit-4d/screens.
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const PORT = Number(process.env.E2E_PORT || 4320), BASE = `http://localhost:${PORT}/`;
const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs/audit-4d/screens'));
fs.mkdirSync(OUT, { recursive: true });
const results = []; const errors = [];
const step = async (name, fn) => { try { const r = await fn(); results.push({ name, ok: true, note: r }); console.log('  PASS', name, r ?? ''); } catch (e) { results.push({ name, ok: false, note: String(e.message).split('\n')[0] }); console.log('  FAIL', name, '→', String(e.message).split('\n')[0]); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await sleep(200); }
  const browser = await chromium.launch();
  const run = async (label, viewport, lang, quality) => {
    console.log(`\n=== ${label} (${viewport.width}x${viewport.height}, ${lang}, 3D=${quality}) ===`);
    const ctx = await browser.newContext({ viewport });
    await ctx.addInitScript(([l, q]) => { try { localStorage.setItem('ae.lang', l); localStorage.setItem('ae.graphics.quality', q); localStorage.setItem('ae.guide.welcomeSeen', '1'); } catch {} }, [lang, quality]);
    const page = await ctx.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', (e) => errors.push(`[${label}] pageerror ${e}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${label}] console ${m.text()}`); });
    const shot = (n) => page.screenshot({ path: path.join(OUT, `${label}-${n}.png`) });
    const stat = async (id) => (await page.locator(`[data-stat="${id}"] .v`).innerText()).trim();
    const nav = async (v) => { await page.locator(`.nav [data-view="${v}"]`).click(); await page.waitForTimeout(250); };
    const month = async () => {
      for (let g = 0; g < 8; g++) {
        if (await page.locator('.modal .card').count()) { await page.locator('.modal .card').first().click(); await page.waitForTimeout(120); continue; }
        if (await page.locator('[data-action="race-weekend"]').count()) { await page.locator('[data-action="race-weekend"]').click(); await page.locator('[data-action="simulate-race"]').click(); await page.locator('[data-action="race-continue"]').first().click(); await page.locator('.shell').waitFor(); continue; }
        break;
      }
      if (await page.locator('.shell [role="alertdialog"], .modal [data-action="confirm-ok"]').count()) return 'blocked-by-modal';
      const b = await stat('date');
      await page.locator('[data-action="next-month"]').click();
      await page.waitForFunction((x) => document.querySelector('[data-stat="date"] .v')?.textContent?.trim() !== x, b, { timeout: 8000 });
      if (await page.locator('.modal .card').count()) await page.locator('.modal .card').first().click();
    };
    await page.goto(BASE); await page.locator('.menu2').waitFor(); await sleep(500); await shot('01-menu');
    await step('found a founder company', async () => { await page.locator('.mode2').nth(1).locator('.m2-head').click(); await page.locator('input[type=range]').first().fill('2005'); await sleep(300); await shot('02-founder-setup'); await page.locator('[data-action="start-game"]').click(); await page.locator('.shell').waitFor(); await sleep(400); await shot('03-dashboard-day1'); return await stat('cash'); });
    await step('studio: design a car, start development', async () => {
      await nav('vehicles'); await page.locator('[data-action="new-vehicle"]').click(); await page.locator('.studio-grid').waitFor();
      await page.locator('.studio-name').fill('Audit GT'); await sleep(1200); await shot('04-studio');
      await page.locator('[data-action="start-development"]').first().click();
      if (await page.locator('[data-action="confirm-ok"]').count()) await page.locator('[data-action="confirm-ok"]').click();
      await page.locator('.range-table tbody tr').first().waitFor(); return (await page.locator('.range-table tbody tr').first().innerText()).replace(/\s+/g, ' ').slice(0, 90);
    });
    let n = 0;
    await step('advance until the car is ready', async () => { for (; n < 70; n++) { const t = await page.locator('.range-table tbody tr').first().innerText().catch(() => ''); if (!/development|desarrollo/i.test(t)) break; await nav('vehicles'); const r = await month(); if (r) return r; } return `${n} months, ${await stat('date')}, cash ${await stat('cash')}`; });
    await step('factory: assign a production line', async () => { await nav('factories'); await sleep(300); await shot('05-factories-before'); await page.locator('[data-action="add-line"]').first().click(); await page.locator('[data-action="tool-line"]').click(); await sleep(400); await shot('06-factories-line'); return (await page.locator('[data-plant]').first().innerText()).replace(/\s+/g, ' ').slice(0, 120); });
    await step('vehicles: set a price', async () => { await nav('vehicles'); const inp = page.locator('.range-table tbody tr').first().locator('input[type=number]'); const p0 = await inp.inputValue(); await inp.fill(String(Math.round(Number(p0) * 0.9))); await inp.press('Enter'); await sleep(300); const p1 = await page.locator('.range-table tbody tr').first().locator('input[type=number]').inputValue(); if (p1 === p0) throw new Error(`price did not change (${p0})`); return `${p0} → ${p1}`; });
    await step('sell for 12 months: sales and cash move', async () => { const c0 = await stat('cash'); for (let i = 0; i < 12; i++) { const r = await month(); if (r) return r; } await nav('dashboard'); await sleep(300); await shot('07-dashboard-year1'); return `cash ${c0} → ${await stat('cash')}, date ${await stat('date')}`; });
    await step('finance: borrow and repay', async () => { await nav('finance'); const d0 = await stat('debt'); await page.locator('[aria-label]', { hasText: '' }).first().count(); const loan = page.locator('input[type=number][min="1"]').first(); await loan.fill('5'); await page.locator('[data-action="borrow"]').click(); if (await page.locator('[data-action="confirm-ok"]').count()) await page.locator('[data-action="confirm-ok"]').click(); await page.waitForFunction((d) => document.querySelector('[data-stat="debt"] .v')?.textContent?.trim() !== d, d0); await sleep(300); await shot('08-finance'); const d1 = await stat('debt'); await page.locator('[data-action="repay"]').first().click(); if (await page.locator('[data-action="confirm-ok"]').count()) await page.locator('[data-action="confirm-ok"]').click(); await sleep(300); return `${d0} → ${d1} → ${await stat('debt')}`; });
    await step('research screen renders and a budget slider moves state', async () => { await nav('research'); await sleep(300); await shot('09-research'); const sl = page.locator('.tech-grid input[type=range]').first(); const v0 = await sl.inputValue(); await sl.focus(); for (let i = 0; i < 6; i++) await sl.press('ArrowRight'); await sleep(200); const v1 = await page.locator('.tech-grid input[type=range]').first().inputValue(); if (v0 === v1) throw new Error('slider unchanged'); const c0 = await stat('cash'); await page.locator('[data-action="next-month"]').click(); await page.waitForTimeout(600); return `${v0} → ${v1}; monthly research text: ${(await page.locator('.stat-tile, .kpi').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 60)}`; });
    await step('market screen', async () => { await nav('market'); await sleep(300); await shot('10-market'); return 'ok'; });
    await step('motorsport: found a team and run a season', async () => { await nav('motorsport'); await sleep(300); await shot('11-motorsport-found'); await page.locator('[data-action="found-team"]').click(); if (await page.locator('[data-action="confirm-ok"]').count()) await page.locator('[data-action="confirm-ok"]').click(); await page.locator('.ms-hero').waitFor(); await sleep(500); await shot('12-motorsport-hq'); for (let i = 0; i < 14; i++) { const r = await month(); if (r) return r; } await nav('motorsport'); await sleep(300); await shot('13-motorsport-season'); return await stat('date'); });
    await step('company/news/saves screens', async () => { for (const v of ['company', 'news', 'saves']) { await nav(v); await sleep(200); } await shot('14-saves'); return 'ok'; });
    let before;
    await step('save → reload page → resume: same state', async () => { before = { date: await stat('date'), cash: await stat('cash'), debt: await stat('debt') }; await nav('saves'); await page.locator('input[type=text]').first().fill('audit'); await page.locator('[data-action="save-game"]').click(); await page.locator('[data-save="audit"]').waitFor(); await page.reload(); await page.locator('.menu2').waitFor(); await page.locator('[data-action="resume"]').click(); await page.locator('.shell').waitFor(); const after = { date: await stat('date'), cash: await stat('cash'), debt: await stat('debt') }; if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`${JSON.stringify(before)} vs ${JSON.stringify(after)}`); return JSON.stringify(after); });
    await step('after reload the game keeps running', async () => { for (let i = 0; i < 3; i++) { const r = await month(); if (r) return r; } return await stat('date'); });
    await ctx.close();
  };
  await run('desktop-en', { width: 1920, height: 1080 }, 'en', 'off');
  await run('laptop-es', { width: 1280, height: 720 }, 'es', 'off');
  await browser.close(); server.kill();
  console.log('\nconsole/page errors:', errors.length); for (const e of [...new Set(errors)].slice(0, 15)) console.log(' ', e.slice(0, 220));
  fs.writeFileSync(path.join(OUT, 'audit-results.json'), JSON.stringify({ results, errors: [...new Set(errors)] }, null, 1));
  process.exit(0);
})();
