const { spawn } = require('node:child_process'); const path = require('node:path'); const { chromium } = require('playwright');
const PORT = 4324, BASE = `http://localhost:${PORT}/`, ROOT = path.resolve(__dirname, '..'); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await sleep(200); }
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { localStorage.setItem('ae.lang', 'en'); localStorage.setItem('ae.graphics.quality', 'off'); localStorage.setItem('ae.guide.welcomeSeen', '1'); });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  await page.goto(BASE); await page.locator('.menu2').waitFor();
  await page.locator('.mode2').nth(0).locator('.m2-head').click(); await page.locator('input[type=range]').first().fill('2000'); await page.locator('.card', { hasText: 'Toyota' }).first().click(); await page.locator('[data-action="start-game"]').click(); await page.locator('.shell').waitFor();
  const toast = async () => (await page.locator('.toast').allInnerTexts()).join(' / ');
  const stat = async (id) => (await page.locator(`[data-stat="${id}"] .v`).innerText()).trim();
  const log = (...a) => console.log(...a);
  // finance: borrow / repay with their default amounts
  await page.locator('.nav [data-view="finance"]').click(); await sleep(400);
  const loanIn = page.locator('input[type=number][min="1"]').first(); log('loan input default:', await loanIn.inputValue(), '| debt', await stat('debt'), 'cash', await stat('cash'));
  await sleep(4500); await page.locator('[data-action="borrow"]').click(); await sleep(200); log('Borrow default → toast:', JSON.stringify(await toast()), 'debt', await stat('debt'), 'confirm?', await page.locator('[data-action="confirm-ok"]').count());
  if (await page.locator('[data-action="confirm-ok"]').count()) { await page.locator('[data-action="confirm-ok"]').click(); await sleep(200); log('  after confirm: debt', await stat('debt'), 'toast', JSON.stringify(await toast())); }
  await sleep(4500); await page.locator('[data-action="repay"]').first().click(); await sleep(200); log('Repay default → toast:', JSON.stringify(await toast()), 'debt', await stat('debt'));
  // vehicles: use recommended price, retire, new generation
  await page.locator('.nav [data-view="vehicles"]').click(); await sleep(400);
  await sleep(4500);
  const rec = page.locator('button', { hasText: 'Use recommended price' }).first();
  log('recommended-price button present:', await rec.count());
  if (await rec.count()) { const before = await page.locator('.range-table tbody tr').first().locator('input[type=number]').inputValue().catch(() => '?'); await rec.click(); await sleep(250); log('Use recommended → toast', JSON.stringify(await toast()), 'price before', before, 'after', await page.locator('.range-table tbody tr').first().locator('input[type=number]').inputValue().catch(() => '?')); }
  await sleep(4500);
  const ng = page.locator('button', { hasText: 'New generation' }).first(); if (await ng.count()) { await ng.click(); await sleep(300); log('New generation → url/studio?', await page.locator('.studio-grid').count(), 'toast', JSON.stringify(await toast())); await page.locator('.studio-grid [data-action="studio-back"]').first().click().catch(() => {}); }
  await page.locator('.nav [data-view="vehicles"]').click(); await sleep(300);
  const ret = page.locator('button', { hasText: /^Retire$/ }).first(); if (await ret.count()) { await ret.click(); await sleep(300); log('Retire → dialog?', await page.locator('[role=alertdialog]').count(), 'toast', JSON.stringify(await toast())); if (await page.locator('[data-action="confirm-cancel"]').count()) await page.locator('[data-action="confirm-cancel"]').click(); }
  // factories: automate
  await page.locator('.nav [data-view="factories"]').click(); await sleep(400); await sleep(4500);
  const au = page.locator('button', { hasText: /^Automate/ }).first(); if (await au.count()) { log('Automate disabled?', await au.isDisabled()); const c0 = await stat('cash'); await au.click(); await sleep(300); log('Automate → toast', JSON.stringify(await toast()), 'confirm', await page.locator('[role=alertdialog]').count(), 'cash', c0, '→', await stat('cash')); if (await page.locator('[data-action="confirm-cancel"]').count()) await page.locator('[data-action="confirm-cancel"]').click(); }
  // body shop stage button
  const stg = page.locator('.flow button').first(); if (await stg.count()) { await sleep(4500); await stg.click(); await sleep(300); log('stage button → toast', JSON.stringify(await toast()), 'dialog', await page.locator('[role=alertdialog], .modal').count()); }
  await browser.close(); server.kill(); process.exit(0);
})();
