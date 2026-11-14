// Phase 4D: layout audit — horizontal overflow, clipped text and off-screen controls on every screen, per size and language.
const { spawn } = require('node:child_process'); const path = require('node:path'); const fs = require('node:fs'); const { chromium } = require('playwright');
const PORT = 4327, BASE = `http://localhost:${PORT}/`, ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'docs/audit-4d/screens'); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await sleep(200); }
  const browser = await chromium.launch(); const rows = [];
  for (const [w, h] of [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [1024, 768]]) for (const lang of ['en', 'es']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(([l]) => { localStorage.setItem('ae.lang', l); localStorage.setItem('ae.graphics.quality', 'off'); localStorage.setItem('ae.guide.welcomeSeen', '1'); }, [lang]);
    const page = await ctx.newPage(); page.setDefaultTimeout(10000); await page.goto(BASE); await page.locator('.menu2').waitFor(); await sleep(300);
    const check = async (name) => page.evaluate(() => { const de = document.documentElement; const over = de.scrollWidth - innerWidth; const clipped = []; for (const e of document.querySelectorAll('.main button, .main h1, .main h2, .main .stat-tile, .topbar *, .nav *')) { if (e.children.length > 3) continue; const r = e.getBoundingClientRect(); if (r.width === 0) continue; if (r.right > innerWidth + 1 || r.left < -1) clipped.push((e.textContent || '').trim().slice(0, 24)); else if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible' && getComputedStyle(e).textOverflow !== 'ellipsis' && e.clientWidth > 0 && e.tagName === 'BUTTON') clipped.push('clip:' + (e.textContent || '').trim().slice(0, 24)); } return { over, clipped: [...new Set(clipped)].slice(0, 4) }; });
    rows.push({ w, h, lang, view: 'menu', ...(await check('menu')) });
    await page.locator('.mode2').nth(0).locator('.m2-head').click(); await page.locator('input[type=range]').first().fill('2000'); await page.locator('.card', { hasText: 'Toyota' }).first().click(); await page.locator('[data-action="start-game"]').click(); await page.locator('.shell').waitFor(); await sleep(300);
    for (const v of ['dashboard', 'vehicles', 'research', 'factories', 'market', 'finance', 'company', 'motorsport', 'news', 'saves']) { await page.locator(`.nav [data-view="${v}"]`).click(); await sleep(250); rows.push({ w, h, lang, view: v, ...(await check(v)) }); if (lang === 'es' && w === 1280) await page.screenshot({ path: path.join(OUT, `layout-${w}-${lang}-${v}.png`) }); }
    await page.locator('.nav [data-view="vehicles"]').click(); await page.locator('[data-action="new-vehicle"]').click(); await page.locator('.studio-grid').waitFor(); await sleep(300); rows.push({ w, h, lang, view: 'studio', ...(await check('studio')) });
    await ctx.close();
  }
  await browser.close(); server.kill();
  const bad = rows.filter((r) => r.over > 1 || r.clipped.length);
  console.log(`${rows.length} screen/size/language combinations checked; ${bad.length} with overflow or clipping`);
  for (const r of bad) console.log(`  ${r.w}x${r.h} ${r.lang} ${r.view}: overflowX ${r.over}px ${r.clipped.join(' | ')}`);
  fs.writeFileSync(path.join(ROOT, 'docs/audit-4d/layout-results.json'), JSON.stringify(rows, null, 1)); process.exit(0);
})();
