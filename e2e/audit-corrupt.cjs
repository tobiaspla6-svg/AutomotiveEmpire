const { spawn } = require('node:child_process'); const path = require('node:path'); const fs = require('node:fs'); const { chromium } = require('playwright');
const PORT = 4325, BASE = `http://localhost:${PORT}/`, ROOT = path.resolve(__dirname, '..'); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DIR = process.argv[2] || '/tmp/claude-0/saves';
(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await sleep(200); }
  const browser = await chromium.launch();
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json')).sort()) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => { localStorage.setItem('ae.lang', 'en'); localStorage.setItem('ae.graphics.quality', 'off'); localStorage.setItem('ae.guide.welcomeSeen', '1'); });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
    await page.goto(BASE); await page.locator('.menu2').waitFor();
    await page.locator('input[type=file]').first().setInputFiles(path.join(DIR, f)); await sleep(1500);
    const shell = await page.locator('.shell').count(), menu = await page.locator('.menu2').count();
    const body = (await page.locator('body').innerText()).trim().length;
    const toast = (await page.locator('.toast').allInnerTexts()).join('|').slice(0, 100);
    let navOk = 'n/a'; if (shell) { const bad = []; for (const v of ['dashboard', 'vehicles', 'research', 'factories', 'market', 'finance', 'company', 'motorsport', 'news', 'saves']) { await page.locator(`.nav [data-view="${v}"]`).click().catch(() => {}); await sleep(150); if (!(await page.locator('.shell').count())) { bad.push(v); break; } } navOk = bad.length ? 'WHITE-SCREEN on ' + bad[0] : 'all screens ok'; }
    const blank = !shell && !menu && body === 0;
    console.log(f.padEnd(26), blank ? 'BLANK PAGE' : shell ? 'loaded' : menu ? 'rejected' : '??', '| toast:', JSON.stringify(toast), '| nav:', navOk, '| errors:', errs.slice(0, 1).join(''));
    await ctx.close();
  }
  await browser.close(); server.kill(); process.exit(0);
})();
