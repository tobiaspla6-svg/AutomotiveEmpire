// Small convex solids for the vector renderer (boxes, cylinders, pipes) and a component that paints a list of them back
// to front into a fitted SVG. Used for parts, chests and other technical illustrations so they share one look.
import { memo, useMemo, type ReactNode } from 'react';
import { add, batch, camera, cross, mul, norm, paint, rgbHex, satin, sub, surface, type Facet, type Projector, type RGB, type V3 } from './vector3d';

export type Mat = { c: RGB; spec?: number; metal?: boolean; alpha?: number };
export const MAT = {
  alu: { c: [176, 182, 190], spec: 0.35 } as Mat, iron: { c: [98, 102, 108], spec: 0.15 } as Mat, dark: { c: [34, 37, 42], spec: 0.2 } as Mat,
  black: { c: [20, 22, 25], spec: 0.25 } as Mat, steel: { c: [150, 156, 164], spec: 0.6, metal: true } as Mat, chrome: { c: [205, 211, 218], spec: 0.9, metal: true } as Mat,
  rubber: { c: [18, 19, 21], spec: 0.05 } as Mat, carbon: { c: [30, 32, 36], spec: 0.55 } as Mat, red: { c: [196, 40, 34], spec: 0.45 } as Mat,
  gold: { c: [214, 168, 72], spec: 0.8, metal: true } as Mat, spring: { c: [212, 168, 40], spec: 0.4 } as Mat, blue: { c: [56, 120, 196], spec: 0.3 } as Mat,
};
export const shadeMat = (m: Mat) => (n: V3, view: V3): RGB => (m.metal ? paint(m.c, n, view, { metal: 0.7, gloss: m.spec }) : satin(m.c, n, view, m.spec ?? 0.2));

export interface Solid { facets: Facet[]; depth: number; alpha?: number; tag?: string; bias?: number }
/** Force a solid to be painted later (nearer) than its neighbours: for coplanar decals such as discs on a face. */
export const over = (s: Solid, bias = 1): Solid => ({ ...s, bias });
const solidOf = (facets: Facet[], m?: Mat, tag?: string): Solid => ({ facets, depth: facets.length ? facets.reduce((a, f) => a + f.depth, 0) / facets.length : 0, alpha: m?.alpha, tag });

/** A box from a centre and three half-axis vectors. */
export function box(cam: Projector, c: V3, ax: V3, ay: V3, az: V3, m: Mat, tag?: string): Solid {
  const P = (i: number, j: number, k: number) => add(add(add(c, mul(ax, i)), mul(ay, j)), mul(az, k));
  const faces: [V3, V3, V3, V3][] = [
    [P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)], [P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), P(1, -1, -1)],
    [P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1)], [P(-1, 1, -1), P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1)],
    [P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1)], [P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1)],
  ];
  const out: Facet[] = [];
  for (const q of faces) {
    let n = norm(cross(sub(q[2], q[0]), sub(q[3], q[1])));
    const mid = mul(add(add(q[0], q[1]), add(q[2], q[3])), 0.25);
    if (n[0] * (mid[0] - c[0]) + n[1] * (mid[1] - c[1]) + n[2] * (mid[2] - c[2]) < 0) n = mul(n, -1);
    const view = norm(sub(mid, cam.eye));
    if (n[0] * view[0] + n[1] * view[1] + n[2] * view[2] > 0) continue;
    const pts = q.map((p) => cam.project(p));
    out.push({ pts: pts.map((p) => [p[0], p[1]] as [number, number]), depth: pts.reduce((a, p) => a + p[2], 0) / 4, fill: rgbHex(shadeMat(m)(n, view)) });
  }
  return solidOf(out, m, tag);
}
export const abox = (cam: Projector, c: V3, sx: number, sy: number, sz: number, m: Mat, tag?: string) => box(cam, c, [sx, 0, 0], [0, sy, 0], [0, 0, sz], m, tag);

/** A cylinder (with caps) around `axis` through `c`; `r2` makes a cone frustum. */
export function cyl(cam: Projector, c: V3, axis: V3, r: number, len: number, m: Mat, seg = 18, r2 = r, tag?: string): Solid {
  const a = norm(axis), t = norm(Math.abs(a[2]) < 0.9 ? cross(a, [0, 0, 1]) : cross(a, [1, 0, 0])), b = cross(a, t);
  const at = (u: number, v: number): V3 => { const ang = u * Math.PI * 2, rr = r + (r2 - r) * v; return add(add(c, mul(a, (v - 0.5) * len)), add(mul(t, Math.cos(ang) * rr), mul(b, Math.sin(ang) * rr))); };
  const f = surface(cam, seg, 1, at, shadeMat(m), { inside: (p) => add(c, mul(a, (p[0] - c[0]) * a[0] + (p[1] - c[1]) * a[1] + (p[2] - c[2]) * a[2])) });
  for (const [v, rr, sg] of [[0, r, -1], [1, r2, 1]] as const) {
    const cc = add(c, mul(a, (v - 0.5) * len)), n = mul(a, sg), view = norm(sub(cc, cam.eye));
    if (n[0] * view[0] + n[1] * view[1] + n[2] * view[2] > 0) continue;
    const pts = Array.from({ length: seg }, (_, i) => cam.project(add(cc, add(mul(t, Math.cos((i / seg) * Math.PI * 2) * rr), mul(b, Math.sin((i / seg) * Math.PI * 2) * rr)))));
    f.push({ pts: pts.map((p) => [p[0], p[1]] as [number, number]), depth: pts.reduce((s, p) => s + p[2], 0) / seg - 0.001, fill: rgbHex(shadeMat(m)(n, view)) });
  }
  return solidOf(f, m, tag);
}
/** A pipe along a polyline: one short cylinder per segment. */
export const tube = (cam: Projector, pts: V3[], r: number, m: Mat, seg = 10): Solid[] =>
  pts.slice(1).map((p, i) => { const a = pts[i], d = sub(p, a), len = Math.hypot(d[0], d[1], d[2]); return cyl(cam, mul(add(a, p), 0.5), d, r, len + r * 0.6, m, seg); });
/** A coil spring along `axis` (drawn as short pipe segments). */
export function coil(cam: Projector, c: V3, axis: V3, r: number, len: number, turns: number, wire: number, m: Mat): Solid[] {
  const a = norm(axis), t = norm(Math.abs(a[2]) < 0.9 ? cross(a, [0, 0, 1]) : cross(a, [1, 0, 0])), b = cross(a, t);
  const n = Math.round(turns * 10);
  const pts = Array.from({ length: n + 1 }, (_, i) => { const g = (i / 10) * Math.PI * 2; return add(add(c, mul(a, (i / n - 0.5) * len)), add(mul(t, Math.cos(g) * r), mul(b, Math.sin(g) * r))); });
  return tube(cam, pts, wire, m, 6);
}

export interface SolidArtProps { build: (cam: Projector) => Solid[]; eye: V3; target: V3; deps: string; aspect?: number; className?: string; label?: string; children?: (fit: { vb: number[]; cam: Projector }) => ReactNode; underlay?: (fit: { vb: number[]; cam: Projector }) => ReactNode }
/** Paint solids back to front, each solid's faces batched by colour, in a viewBox fitted to the drawing. */
export const SolidArt = memo(function SolidArt({ build, eye, target, deps, aspect = 120 / 90, className, label, children, underlay }: SolidArtProps) {
  const art = useMemo(() => {
    const cam = camera({ eye, target, focal: 300, cx: 0, cy: 0 });
    const solids = build(cam).filter((s) => s.facets.length).sort((a, b) => (b.depth - (b.bias ?? 0) * 1e3) - (a.depth - (a.bias ?? 0) * 1e3));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of solids) for (const f of s.facets) for (const [x, y] of f.pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const pad = Math.max(x1 - x0, y1 - y0) * 0.08;
    let w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2;
    if (w / h < aspect) w = h * aspect; else h = w / aspect;
    const vb = [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h];
    return { cam, vb, layers: solids.map((s) => ({ alpha: s.alpha, tag: s.tag, paths: batch(s.facets) })) };
  }, [deps]); // eslint-disable-line react-hooks/exhaustive-deps
  const [vx, vy, w, h] = art.vb;
  return <svg viewBox={`${vx.toFixed(2)} ${vy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`} className={className} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    {underlay?.({ vb: art.vb, cam: art.cam })}
    <ellipse cx={vx + w / 2} cy={vy + h * 0.9} rx={w * 0.38} ry={h * 0.06} fill="#000" opacity="0.35" />
    <g strokeWidth={w / 600} strokeLinejoin="round">{art.layers.map((l, i) => <g key={i} opacity={l.alpha ?? 1} data-tag={l.tag}>{l.paths.map((p, k) => <path key={k} d={p.d} fill={p.fill} stroke={p.fill} />)}</g>)}</g>
    {children?.({ vb: art.vb, cam: art.cam })}
  </svg>;
});
