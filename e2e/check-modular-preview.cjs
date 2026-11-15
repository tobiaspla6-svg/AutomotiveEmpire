// Phase 6: opens the art branch's MODULAR_PREVIEW.html in Chromium (served over http) and records every wheel × lamp
// combination and both bumper-face trials at 1920, 1280 and 390 px: screenshots, mounted image boxes, console errors
// and failed requests. The preview itself is not modified.
//   git worktree add /tmp/suvart origin/art/suv90-master-20261115-01a1dd27
//   node e2e/check-modular-preview.cjs /tmp/suvart/production-assets/suv-1990-v1 <outDir>
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const ROOT = process.argv[2], OUT = process.argv[3]; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '4351', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const b = await chromium.launch(); const report = { runs: [] };
  for (const [w, h] of [[1920, 1080], [1280, 720], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const p = await ctx.newPage(); const errors = [], bad = [];
    p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    p.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
    await p.goto('http://127.0.0.1:4351/MODULAR_PREVIEW.html'); await p.waitForLoadState('networkidle');
    const combos = [];
    for (const wv of ['original', 'steel', 'alloy']) for (const lv of ['original', 'a', 'b']) combos.push([wv, lv, 'original']);
    combos.push(['original', 'original', 'a'], ['original', 'original', 'b']);
    for (const [wv, lv, bv] of combos) {
      await p.evaluate(([a, c, d]) => { wheel(a); lamp(c); bumper(d); }, [wv, lv, bv]); await p.waitForLoadState('networkidle'); await p.waitForTimeout(250);
      const info = await p.evaluate(() => ({ wheels: [...document.querySelectorAll('#wheels image')].map((i) => { const bb = i.getBBox(); return [i.getAttribute('href'), +(bb.x + bb.width / 2).toFixed(2), +(bb.y + bb.height / 2).toFixed(2), +bb.width.toFixed(2), +bb.height.toFixed(2)]; }), lamps: document.querySelectorAll('#lamps image').length, bumpers: document.querySelectorAll('#bumpers image').length, svgW: document.querySelector('.stage svg').getBoundingClientRect().width, svgH: document.querySelector('.stage svg').getBoundingClientRect().height }));
      const name = `w-${wv}_l-${lv}_b-${bv}-${w}`;
      if (w !== 390 || (bv === 'original' && lv !== 'original' ? false : true)) await p.locator('.stage').screenshot({ path: path.join(OUT, name + '.png') });
      report.runs.push({ viewport: [w, h], combo: { wheels: wv, lamps: lv, bumper: bv }, ...info });
    }
    report[`errors-${w}`] = errors; report[`http-${w}`] = bad;
    await ctx.close();
  }
  await b.close(); srv.kill();
  fs.writeFileSync(path.join(OUT, 'preview-report.json'), JSON.stringify(report, null, 1));
})();
