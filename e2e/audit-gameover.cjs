const { spawn } = require('node:child_process'); const path = require('node:path'); const { chromium } = require('playwright');
const PORT = 4326, BASE = `http://localhost:${PORT}/`, ROOT = path.resolve(__dirname, '..'); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await sleep(200); }
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { localStorage.setItem('ae.lang', 'en'); localStorage.setItem('ae.graphics.quality', 'off'); localStorage.setItem('ae.guide.welcomeSeen', '1'); });
  const page = await ctx.newPage(); await page.goto(BASE); await page.locator('.menu2').waitFor();
  await page.locator('.mode2').nth(0).locator('.m2-head').click(); await page.locator('input[type=range]').first().fill('2000'); await page.locator('.card', { hasText: 'Toyota' }).first().click(); await page.locator('[data-action="start-game"]').click(); await page.locator('.shell').waitFor();
  await page.locator('[data-action="quit"]').click(); await page.locator('.menu2').waitFor();
  await page.evaluate(async () => { const db = await new Promise((res) => { const r = indexedDB.open('automotive-empire', 1); r.onsuccess = () => res(r.result); }); const rec = await new Promise((res) => { const r = db.transaction('saves').objectStore('saves').get('autosave'); r.onsuccess = () => res(r.result); }); rec.game.gameOver = { reason: 'The board has lost confidence in your leadership and dismissed you.' }; await new Promise((res) => { const t = db.transaction('saves', 'readwrite'); t.objectStore('saves').put(rec); t.oncomplete = res; }); });
  await page.reload(); await page.locator('.menu2').waitFor(); await page.locator('[data-action="resume"]').click(); await page.locator('.shell').waitFor(); await sleep(300);
  console.log('modal shown:', await page.locator('.modal').count());
  const books = page.locator('[data-action="over-books"]'); await books.click(); await sleep(400);
  console.log('after "Review the books": modal still covering the screen:', await page.locator('.modal').count(), '| view:', await page.locator('.nav [aria-current="page"]').getAttribute('data-view'));
  await page.screenshot({ path: path.join(ROOT, 'docs/audit-4d/screens/gameover-after-fix.png') });
  await browser.close(); server.kill(); process.exit(0);
})();
