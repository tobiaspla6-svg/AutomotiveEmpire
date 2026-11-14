// Phase 4D: click-everything audit. For every screen, click each enabled button and report clicks that (a) throw console
// errors or (b) change nothing observable (no DOM change, no toast, no dialog, no navigation, no top-bar change).
const { spawn } = require('node:child_process'); const path = require('node:path'); const fs = require('node:fs'); const { chromium } = require('playwright');
const PORT = 4323, BASE = `http://localhost:${PORT}/`, ROOT = path.resolve(__dirname, '..'); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SKIP = /quit|delete-save|load-save|negotiate|restructure|acquire|build-factory|confirm-build|sign-driver|found-team|build-race-car|lights-out|help|race-weekend|go-race|next-month|\+3|apply-staff|start-race|simulate-race|welcome/;
(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await sleep(200); }
  const browser = await chromium.launch(); const report = []; const errs = [];
  for (const [mode, lang] of [['ceo', 'en'], ['ceo', 'es'], ['founder', 'en']]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(([l]) => { localStorage.setItem('ae.lang', l); localStorage.setItem('ae.graphics.quality', 'off'); localStorage.setItem('ae.guide.welcomeSeen', '1'); }, [lang]);
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    page.on('pageerror', (e) => errs.push(`[${mode}/${lang}] pageerror ${String(e).slice(0, 200)}`)); page.on('console', (m) => { if (m.type() === 'error') errs.push(`[${mode}/${lang}] console ${m.text().slice(0, 200)}`); });
    await page.goto(BASE); await page.locator('.menu2').waitFor();
    if (mode === 'ceo') { await page.locator('.mode2').nth(0).locator('.m2-head').click(); await page.locator('input[type=range]').first().fill('2000'); await page.locator('.card', { hasText: 'Toyota' }).first().click(); }
    else { await page.locator('.mode2').nth(1).locator('.m2-head').click(); await page.locator('input[type=range]').first().fill('2005'); }
    await page.locator('[data-action="start-game"]').click(); await page.locator('.shell').waitFor();
    // give the founder something to manage
    if (mode === 'founder') { await page.locator('.nav [data-view="vehicles"]').click(); await page.locator('[data-action="new-vehicle"]').click(); await page.locator('.studio-name').fill('Monkey'); await page.locator('[data-action="start-development"]').first().click(); if (await page.locator('[data-action="confirm-ok"]').count()) await page.locator('[data-action="confirm-ok"]').click(); }
    const views = ['dashboard', 'vehicles', 'research', 'factories', 'market', 'finance', 'company', 'motorsport', 'news'];
    for (const v of views) {
      await page.locator(`.nav [data-view="${v}"]`).click(); await page.waitForTimeout(300);
      const labels = await page.locator('.main button:not([disabled])').evaluateAll((els) => els.map((e, i) => ({ i, text: (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50), action: e.getAttribute('data-action') || '' })));
      let tested = 0;
      for (const b of labels.slice(0, 60)) {
        if (SKIP.test(b.action) || SKIP.test(b.text.toLowerCase())) continue;
        await page.locator(`.nav [data-view="${v}"]`).click().catch(() => {}); await page.waitForTimeout(80);
        const btn = page.locator('.main button:not([disabled])').nth(b.i); if (!(await btn.count())) continue;
        const snap = async () => page.evaluate(() => (document.querySelector('.main')?.innerHTML.length ?? 0) + '|' + (document.querySelector('.topbar, header')?.textContent ?? '') + '|' + document.querySelectorAll('.modal, [role=alertdialog], .toast').length + '|' + document.querySelector('.nav [aria-current]')?.getAttribute('data-view') + '|' + [...document.querySelectorAll('.main [aria-selected], .main .on, .main [aria-pressed]')].map((x) => x.className + x.getAttribute('aria-selected') + x.getAttribute('aria-pressed')).join(','));
        const before = await snap(); const e0 = errs.length;
        try { await btn.click({ timeout: 2000 }); } catch { continue; }
        await page.waitForTimeout(120); tested++;
        if (await page.locator('[data-action="confirm-cancel"]').count()) { await page.locator('[data-action="confirm-cancel"]').click(); report.push({ mode, lang, view: v, text: b.text, result: 'opens-confirm (ok)' }); continue; }
        const after = await snap();
        if (before === after) report.push({ mode, lang, view: v, text: b.text, action: b.action, result: 'NO-OBSERVABLE-CHANGE' });
        if (errs.length > e0) report.push({ mode, lang, view: v, text: b.text, result: 'CONSOLE-ERROR', err: errs[errs.length - 1] });
        if (await page.locator('.modal').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(100); if (await page.locator('.modal').count()) { const c = page.locator('.modal button', { hasText: /cancel|cancelar|close|cerrar/i }).first(); if (await c.count()) await c.click(); } }
      }
      console.log(`${mode}/${lang} ${v}: ${labels.length} buttons, ${tested} clicked`);
    }
    await ctx.close();
  }
  await browser.close(); server.kill();
  const bad = report.filter((r) => r.result !== 'opens-confirm (ok)');
  console.log('\nFINDINGS (' + bad.length + '):'); for (const r of bad) console.log(' ', `${r.mode}/${r.lang}/${r.view}`, JSON.stringify(r.text), r.action || '', r.result, r.err || '');
  console.log('\nERRORS:', [...new Set(errs)].slice(0, 10));
  fs.writeFileSync(path.join(ROOT, 'docs/audit-4d/monkey-results.json'), JSON.stringify({ report, errs: [...new Set(errs)] }, null, 1)); process.exit(0);
})();
