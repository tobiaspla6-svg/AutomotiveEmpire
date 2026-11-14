// Phase 4D: 3D path audit — WebGL on (software rendering, so NOT GPU FPS), WebGL blocked, and quality "auto".
const { spawn } = require('node:child_process'); const path = require('node:path'); const fs = require('node:fs');
const { chromium } = require('playwright');
const PORT = 4321, BASE = `http://localhost:${PORT}/`, ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'docs/audit-4d/screens');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await sleep(200); }
  const out = [];
  for (const [label, args, quality] of [['webgl-software-medium', [], 'medium'], ['webgl-software-high', [], 'high'], ['webgl-blocked-auto', ['--disable-gpu', '--disable-3d-apis', '--disable-webgl', '--disable-webgl2'], 'auto'], ['webgl-blocked-high', ['--disable-gpu', '--disable-3d-apis', '--disable-webgl', '--disable-webgl2'], 'high']]) {
    const browser = await chromium.launch({ args });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(([q]) => { try { localStorage.setItem('ae.lang', 'en'); localStorage.setItem('ae.graphics.quality', q); localStorage.setItem('ae.guide.welcomeSeen', '1'); } catch {} }, [quality]);
    const page = await ctx.newPage(); page.setDefaultTimeout(30000);
    const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
    const gl = await page.evaluate(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2') || c.getContext('webgl'); return g ? (g.getParameter(g.VERSION) + ' / ' + (g.getExtension('WEBGL_debug_renderer_info') ? g.getParameter(g.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL) : '?')) : 'none'; }).catch((e) => 'eval-failed');
    await page.goto(BASE); await page.locator('.menu2').waitFor(); await sleep(2500);
    const r = { label, gl, menuCanvas: await page.locator('canvas').count() };
    await page.screenshot({ path: path.join(OUT, `3d-${label}-menu.png`) });
    try {
      await page.locator('.mode2').nth(1).locator('.m2-head').click(); await page.locator('input[type=range]').first().fill('2005'); await page.locator('[data-action="start-game"]').click(); await page.locator('.shell').waitFor();
      await page.locator('.nav [data-view="vehicles"]').click(); await page.locator('[data-action="new-vehicle"]').click(); await page.locator('.studio-grid').waitFor(); await sleep(6000);
      r.studioCanvas = await page.locator('canvas').count(); r.poster = await page.locator('.studio .poster').count();
      r.frames = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 3000) res(n / 3); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
      await page.screenshot({ path: path.join(OUT, `3d-${label}-studio.png`) });
      await page.locator('.studio-name').fill('X3D'); await page.locator('[data-mode="advanced"]').click(); await page.locator('[data-section="engine"]').click(); await sleep(500);
      r.usable = true;
    } catch (e) { r.error = String(e.message).split('\n')[0]; }
    r.errors = [...new Set(errs)].slice(0, 4);
    out.push(r); console.log(JSON.stringify(r));
    await browser.close();
  }
  server.kill(); fs.writeFileSync(path.join(OUT, '3d-results.json'), JSON.stringify(out, null, 1)); process.exit(0);
})();
