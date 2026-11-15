// A very small "vector renderer" for the 2D art: parametric 3D surfaces are tessellated, projected through a pinhole
// camera, back-face culled, depth sorted and flat shaded per facet into plain SVG polygons. It gives illustrations a
// true perspective (three-quarter cars, engines) while staying pure SVG: no WebGL, no bitmaps, recolourable at run
// time. Facets are small enough that the shading reads as smooth metal and glass.
export type V3 = [number, number, number];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (e0: number, e1: number, x: number) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

/** Piecewise-linear profile through (x, value) knots, smoothed with a cosine ease between knots. */
export function profile(knots: [number, number][]) {
  return (x: number) => {
    if (x <= knots[0][0]) return knots[0][1];
    for (let i = 1; i < knots.length; i++) {
      const [x1, y1] = knots[i];
      if (x <= x1) { const [x0, y0] = knots[i - 1]; const t = (x - x0) / (x1 - x0 || 1); return lerp(y0, y1, (1 - Math.cos(Math.PI * t)) / 2); }
    }
    return knots[knots.length - 1][1];
  };
}

export interface Camera { eye: V3; target: V3; up?: V3; focal: number; cx: number; cy: number }
export interface Projector { project: (p: V3) => [number, number, number]; eye: V3 }
/** Pinhole camera: world z is up. Returns screen x, y and the view depth. */
export function camera(c: Camera): Projector {
  const f = norm(sub(c.target, c.eye));
  const r = norm(cross(f, c.up ?? [0, 0, 1]));
  const u = cross(r, f);
  return {
    eye: c.eye,
    project: (p) => { const d = sub(p, c.eye); const z = dot(d, f); return [c.cx + (dot(d, r) / z) * c.focal, c.cy - (dot(d, u) / z) * c.focal, z]; },
  };
}

// ---------------------------------------------------------------------------------------------------- colour
export type RGB = [number, number, number];
export const hexRgb = (hex: string): RGB => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
// colours are quantised to steps of 4 so facets of one layer can be batched into few <path> elements
const h2 = (v: number) => (Math.max(0, Math.min(252, Math.round(v / 4) * 4))).toString(16).padStart(2, '0');
export const rgbHex = (c: RGB) => `#${h2(c[0])}${h2(c[1])}${h2(c[2])}`;
export const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const scale = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];
export const plus = (a: RGB, b: RGB): RGB => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export interface Facet { pts: [number, number][]; depth: number; fill: string; key?: string }
/**
 * Merge the facets of one convex layer by colour: visible facets of a convex surface never overlap, so their
 * painting order does not matter and every colour becomes a single path with many sub-paths.
 */
export function batch(facets: Facet[]): { d: string; fill: string }[] {
  const by = new Map<string, string[]>();
  for (const f of facets) { const l = by.get(f.fill); const d = facetPath(f); if (l) l.push(d); else by.set(f.fill, [d]); }
  return [...by].map(([fill, ds]) => ({ fill, d: ds.join('') }));
}
const n1 = (v: number) => { const r = Math.round(v * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
export const facetPath = (f: Facet) => 'M' + f.pts.map(([x, y]) => `${n1(x)} ${n1(y)}`).join('L') + 'Z';

/**
 * A studio "environment" for reflective materials: a dark floor, a bright horizon band, overhead soft boxes and a
 * key light. `dir` is the reflected view direction. Returns a light level 0..~1.6.
 */
export function studioEnv(dir: V3, key: V3 = norm([-0.4, -0.55, 0.75])) {
  const z = dir[2];
  const floor = 0.05 + 0.06 * smooth(-0.6, 0, z);
  const horizon = 0.5 * Math.exp(-((z - 0.04) * (z - 0.04)) / 0.009);                      // horizon line
  const sky = 0.14 + 0.46 * smooth(0, 0.75, z);
  const side = 0.55 * smooth(0.86, 0.98, dot(dir, norm([-0.15, -1, 0.22])));                // tall side panel light
  const softbox = 1.15 * smooth(0.82, 0.97, dot(dir, key));                                   // big key soft box
  const strip = 0.5 * smooth(0.9, 0.985, dot(dir, norm([0.65, -0.3, 0.7])));                 // rim strip light
  const top = 0.45 * smooth(0.93, 0.99, z);                                                   // ceiling panel
  return (z < 0 ? floor : sky) + horizon + softbox + strip + top + side;
}

/** Shade a paint facet: base colour, diffuse key light and a clear-coat reflection of the studio. */
export function paint(base: RGB, n: V3, view: V3, opts: { metal?: number; gloss?: number } = {}): RGB {
  const metal = opts.metal ?? 0.55, gloss = opts.gloss ?? 1;
  const key = norm([-0.4, -0.55, 0.75]);
  const diff = 0.28 + 0.72 * Math.max(0, dot(n, key));
  const r = sub(view, mul(n, 2 * dot(view, n)));                                              // reflected view ray
  const env = studioEnv(norm(r));
  const fres = 0.06 + 0.94 * Math.pow(1 - Math.max(0, -dot(view, n)), 5);
  const tinted = scale(base, diff * (1 - metal * 0.35) + metal * env * 0.55);
  const coat = scale([255, 255, 255], gloss * (0.05 + fres * 0.45) * Math.min(1.15, env * env * 0.75));
  return plus(tinted, coat);
}

/** Shade glass: dark and tinted; it reflects a smooth sky gradient (no sharp features, so coarse facets stay clean). */
export function glass(n: V3, view: V3, tint: RGB = [16, 23, 32]): RGB {
  const r = norm(sub(view, mul(n, 2 * dot(view, n))));
  const sky = 0.08 + 0.55 * smooth(-0.1, 0.8, r[2]) + 0.35 * smooth(0.6, 0.95, dot(r, norm([-0.4, -0.55, 0.75])));
  const fres = 0.15 + 0.85 * Math.pow(1 - Math.max(0, -dot(view, n)), 3);
  return plus(tint, scale([150, 175, 196], sky * (0.25 + 0.6 * fres)));
}

/** Shade a matte or satin material (plastics, tyres, cast metal). */
export function satin(base: RGB, n: V3, view: V3, spec = 0.15): RGB {
  const key = norm([-0.4, -0.55, 0.75]);
  const diff = 0.3 + 0.7 * Math.max(0, dot(n, key));
  const r = sub(view, mul(n, 2 * dot(view, n)));
  return plus(scale(base, diff), scale([255, 255, 255], spec * Math.min(1, studioEnv(norm(r)) * 0.6)));
}

/**
 * Tessellate a parametric surface into shaded, culled facets. Normals are computed at the grid vertices and every
 * facet takes the average of its four shaded corners, which reads as smooth (Gouraud-like) shading.
 */
export function surface(
  cam: Projector, nu: number, nv: number, at: (u: number, v: number) => V3,
  shade: (n: V3, view: V3, u: number, v: number) => RGB | null, opts: { cull?: boolean; key?: string; inside?: (mid: V3) => V3 } = {},
): Facet[] {
  const grid: V3[][] = [], scr: [number, number, number][][] = [];
  for (let i = 0; i <= nu; i++) { const row: V3[] = []; for (let j = 0; j <= nv; j++) row.push(at(i / nu, j / nv)); grid.push(row); scr.push(row.map((p) => cam.project(p))); }
  // vertex normals by central differences, oriented outwards
  const vn: (V3 | null)[][] = grid.map((row, i) => row.map((p, j) => {
    const du = sub(grid[Math.min(nu, i + 1)][j], grid[Math.max(0, i - 1)][j]), dv = sub(grid[i][Math.min(nv, j + 1)], grid[i][Math.max(0, j - 1)]);
    const c = cross(du, dv); if (!c[0] && !c[1] && !c[2]) return null;
    let n = norm(c);
    if (opts.inside && dot(n, sub(p, opts.inside(p))) < 0) n = mul(n, -1);
    return n;
  }));
  const out: Facet[] = [];
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = grid[i][j], b = grid[i + 1][j], c = grid[i + 1][j + 1], d = grid[i][j + 1];
    let n = cross(sub(c, a), sub(d, b));
    if (!n[0] && !n[1] && !n[2]) continue;
    n = norm(n);
    const mid = mul(add(add(a, b), add(c, d)), 0.25);
    if (opts.inside && dot(n, sub(mid, opts.inside(mid))) < 0) n = mul(n, -1);               // make the normal point outwards
    const view = norm(sub(mid, cam.eye));
    if (opts.cull !== false && dot(n, view) > 0) continue;                                    // facing away
    const u = (i + 0.5) / nu, v = (j + 0.5) / nv;
    let acc: RGB = [0, 0, 0], k = 0, skip = false;
    for (const [ii, jj] of [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]]) {
      let nn = vn[ii][jj] ?? n;
      if (dot(nn, n) < 0.3) nn = n;                                                             // keep creases crisp
      const p = grid[ii][jj], vw = norm(sub(p, cam.eye));
      const col = shade(dot(nn, vw) > 0 ? norm(add(nn, mul(vw, -1.2 * dot(nn, vw)))) : nn, vw, u, v);
      if (!col) { skip = true; break; }
      acc = plus(acc, col); k++;
    }
    if (skip) continue;
    const pa = scr[i][j], pb = scr[i + 1][j], pc = scr[i + 1][j + 1], pd = scr[i][j + 1];
    out.push({ pts: [[pa[0], pa[1]], [pb[0], pb[1]], [pc[0], pc[1]], [pd[0], pd[1]]], depth: (pa[2] + pb[2] + pc[2] + pd[2]) / 4, fill: rgbHex(scale(acc, 1 / k)), key: opts.key });
  }
  return out;
}

/** Project a closed 3D polyline into an SVG points string. */
export const poly = (cam: Projector, pts: V3[]) => pts.map((p) => { const q = cam.project(p); return `${q[0].toFixed(1)},${q[1].toFixed(1)}`; }).join(' ');
/** Average depth of a 3D point set. */
export const depthOf = (cam: Projector, pts: V3[]) => pts.reduce((a, p) => a + cam.project(p)[2], 0) / pts.length;
