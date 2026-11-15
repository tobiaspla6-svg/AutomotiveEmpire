/**
 * Automotive Empire — cinematic showroom.
 *
 * The car is modelled as parametric surfaces (a lofted lower body and a greenhouse) and drawn with the small vector
 * renderer in `vector3d.ts`: a real perspective three-quarter camera, back-face culling, depth sorting and a
 * clear-coat paint model that reflects the studio's soft boxes and horizon. Lamps, grille, door cuts, mirrors and
 * wheels are placed on the same 3D surfaces, so proportions always agree. Output is plain SVG: no WebGL, no images,
 * the paint follows the player's colour.
 */
import { memo, useId, useMemo } from 'react';
import type { BodyType } from '../../sim/types';
import {
  batch, camera, cross, depthOf, glass, hexRgb, mix, norm, paint, poly, profile, rgbHex, satin, smooth, sub, surface,
  type Facet, type Projector, type RGB, type V3,
} from './vector3d';

type Props = {
  color?: string;
  body?: BodyType;
  label?: string;
  /** In the workshop the stage is lighter and the caption is hidden. */
  compact?: boolean;
};

interface Shape {
  L: number; W: number; fx: number; rx: number; R: number; tw: number;
  top: [number, number][]; bottom: [number, number][]; plan: [number, number][];
  cabin: { x0: number; x1: number; roof: [number, number][]; wb: number; wt: number; b: number; open?: boolean };
  n: number;
}
const SHAPES: Record<'sedan' | 'coupe' | 'supercar' | 'suv' | 'hatch' | 'wagon' | 'roadster' | 'pickup', Shape> = {
  sedan: {
    L: 4.85, W: 0.93, fx: 0.98, rx: 3.86, R: 0.35, tw: 0.8, n: 5,
    top: [[0, 0.58], [0.1, 0.68], [0.45, 0.8], [1.0, 0.87], [1.8, 0.93], [3.9, 0.98], [4.55, 0.98], [4.78, 0.8], [4.85, 0.64]],
    bottom: [[0, 0.32], [0.35, 0.22], [0.9, 0.17], [4.0, 0.17], [4.55, 0.25], [4.85, 0.36]],
    plan: [[0, 0.56], [0.08, 0.76], [0.32, 0.89], [0.85, 0.93], [4.2, 0.93], [4.6, 0.9], [4.8, 0.8], [4.85, 0.7]],
    cabin: { x0: 1.72, x1: 4.12, roof: [[1.72, 0.9], [2.42, 1.4], [2.8, 1.45], [3.3, 1.44], [3.62, 1.37], [4.12, 0.95]], wb: 0.82, wt: 0.62, b: 2.9 },
  },
  coupe: {
    L: 4.72, W: 0.96, fx: 1.06, rx: 3.78, R: 0.36, tw: 0.83, n: 5,
    top: [[0, 0.54], [0.1, 0.64], [0.5, 0.76], [1.2, 0.84], [2.0, 0.9], [3.8, 0.96], [4.45, 0.95], [4.66, 0.78], [4.72, 0.6]],
    bottom: [[0, 0.28], [0.35, 0.19], [1.0, 0.15], [3.9, 0.15], [4.45, 0.22], [4.72, 0.32]],
    plan: [[0, 0.52], [0.09, 0.76], [0.35, 0.9], [0.95, 0.95], [3.6, 0.97], [4.4, 0.92], [4.66, 0.8], [4.72, 0.7]],
    cabin: { x0: 1.98, x1: 4.3, roof: [[1.98, 0.9], [2.65, 1.29], [3.0, 1.32], [3.4, 1.25], [3.9, 1.07], [4.3, 0.95]], wb: 0.8, wt: 0.58, b: 3.05 },
  },
  supercar: {
    L: 4.55, W: 0.99, fx: 1.12, rx: 3.78, R: 0.36, tw: 0.86, n: 4,
    top: [[0, 0.44], [0.12, 0.52], [0.6, 0.66], [1.3, 0.76], [3.2, 0.92], [4.3, 0.92], [4.5, 0.74], [4.55, 0.6]],
    bottom: [[0, 0.22], [0.4, 0.14], [1.0, 0.12], [3.9, 0.12], [4.55, 0.26]],
    plan: [[0, 0.6], [0.08, 0.8], [0.3, 0.92], [1.0, 0.97], [3.4, 0.99], [4.3, 0.95], [4.55, 0.82]],
    cabin: { x0: 1.45, x1: 3.95, roof: [[1.45, 0.8], [2.2, 1.12], [2.6, 1.15], [3.1, 1.08], [3.95, 0.93]], wb: 0.76, wt: 0.55, b: 0 },
  },
  suv: {
    L: 4.8, W: 0.97, fx: 0.98, rx: 3.88, R: 0.42, tw: 0.84, n: 6,
    top: [[0, 0.78], [0.12, 0.9], [0.5, 1.0], [1.0, 1.05], [1.8, 1.1], [4.4, 1.12], [4.72, 1.08], [4.8, 0.9]],
    bottom: [[0, 0.46], [0.4, 0.34], [0.9, 0.3], [4.0, 0.3], [4.5, 0.36], [4.8, 0.48]],
    plan: [[0, 0.66], [0.08, 0.84], [0.3, 0.93], [0.8, 0.97], [4.4, 0.97], [4.7, 0.92], [4.8, 0.85]],
    cabin: { x0: 1.78, x1: 4.72, roof: [[1.78, 1.07], [2.45, 1.66], [2.8, 1.72], [4.2, 1.7], [4.55, 1.6], [4.72, 1.14]], wb: 0.86, wt: 0.72, b: 2.95 },
  },
  hatch: {
    L: 4.2, W: 0.9, fx: 0.88, rx: 3.5, R: 0.33, tw: 0.78, n: 5,
    top: [[0, 0.6], [0.1, 0.7], [0.45, 0.82], [1.6, 0.92], [3.9, 0.98], [4.15, 0.9], [4.2, 0.7]],
    bottom: [[0, 0.32], [0.35, 0.22], [0.8, 0.18], [3.6, 0.18], [4.2, 0.34]],
    plan: [[0, 0.62], [0.07, 0.78], [0.25, 0.87], [0.7, 0.9], [3.9, 0.9], [4.15, 0.84], [4.2, 0.76]],
    cabin: { x0: 1.5, x1: 4.12, roof: [[1.5, 0.92], [2.25, 1.44], [2.6, 1.47], [3.7, 1.45], [3.98, 1.36], [4.12, 0.98]], wb: 0.8, wt: 0.64, b: 2.7 },
  },
  roadster: {
    L: 4.4, W: 0.94, fx: 1.02, rx: 3.5, R: 0.35, tw: 0.82, n: 5,
    top: [[0, 0.52], [0.1, 0.62], [0.5, 0.74], [1.2, 0.83], [2.0, 0.88], [3.6, 0.92], [4.2, 0.92], [4.36, 0.76], [4.4, 0.6]],
    bottom: [[0, 0.28], [0.35, 0.19], [1.0, 0.15], [3.6, 0.15], [4.2, 0.22], [4.4, 0.32]],
    plan: [[0, 0.52], [0.09, 0.76], [0.35, 0.89], [0.95, 0.94], [3.6, 0.94], [4.3, 0.88], [4.4, 0.78]],
    cabin: { x0: 1.95, x1: 3.45, roof: [[1.95, 0.88], [2.3, 1.16], [2.42, 1.17], [2.55, 1.02], [3.1, 1.0], [3.45, 0.9]], wb: 0.76, wt: 0.6, b: 0, open: true },
  },
  pickup: {
    L: 5.3, W: 0.99, fx: 1.0, rx: 4.25, R: 0.42, tw: 0.86, n: 7,
    top: [[0, 0.82], [0.12, 0.94], [0.5, 1.06], [1.0, 1.1], [1.8, 1.14], [5.1, 1.16], [5.3, 1.1]],
    bottom: [[0, 0.48], [0.4, 0.36], [0.9, 0.32], [4.6, 0.32], [5.3, 0.5]],
    plan: [[0, 0.7], [0.08, 0.86], [0.3, 0.95], [0.8, 0.99], [5.0, 0.99], [5.3, 0.95]],
    cabin: { x0: 1.82, x1: 3.55, roof: [[1.82, 1.12], [2.45, 1.82], [2.75, 1.86], [3.3, 1.85], [3.45, 1.7], [3.55, 1.16]], wb: 0.88, wt: 0.74, b: 2.85 },
  },
  wagon: {
    L: 4.9, W: 0.93, fx: 0.98, rx: 3.9, R: 0.35, tw: 0.8, n: 5,
    top: [[0, 0.58], [0.1, 0.68], [0.45, 0.8], [1.0, 0.87], [1.8, 0.93], [4.6, 0.98], [4.84, 0.86], [4.9, 0.66]],
    bottom: [[0, 0.32], [0.35, 0.22], [0.9, 0.17], [4.0, 0.17], [4.6, 0.25], [4.9, 0.36]],
    plan: [[0, 0.64], [0.07, 0.8], [0.25, 0.89], [0.7, 0.93], [4.5, 0.93], [4.8, 0.88], [4.9, 0.78]],
    cabin: { x0: 1.72, x1: 4.84, roof: [[1.72, 0.9], [2.42, 1.4], [2.8, 1.46], [4.4, 1.44], [4.7, 1.36], [4.84, 0.98]], wb: 0.82, wt: 0.64, b: 2.9 },
  },
};
const shapeFor = (b: BodyType): Shape =>
  b === 'coupe' ? SHAPES.coupe : b === 'roadster' ? SHAPES.roadster : b === 'pickup' ? SHAPES.pickup : b === 'supercar' ? SHAPES.supercar : b === 'suv' ? SHAPES.suv : b === 'hatch' ? SHAPES.hatch : b === 'wagon' ? SHAPES.wagon : SHAPES.sedan;

const BLACK: RGB = [14, 16, 20], TRIM: RGB = [28, 31, 36], CHROME: RGB = [150, 158, 168];

/** Lofted body: x along the car, alpha around it (0 far side, π/2 top, π near side, 3π/2 bottom). */
function bodyModel(s: Shape) {
  const top = profile(s.top), bot = profile(s.bottom), plan = profile(s.plan);
  const pw = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);
  const at = (x: number, a: number): V3 => {
    const zt = top(x), zb = bot(x), W = plan(x), zc = (zt + zb) / 2, hh = (zt - zb) / 2;
    const c = Math.cos(a), sn = Math.sin(a);
    const e = sn > 0 ? 2 / s.n : 2 / (s.n + 3);
    const tumble = 1 - 0.07 * Math.max(0, sn) * Math.max(0, sn);
    return [x, W * pw(c, e) * tumble, zc + hh * pw(sn, e)];
  };
  /** Height of the body surface where it is `y` from the centre line (upper half). */
  const beltZ = (x: number, y: number) => {
    const W = plan(x) * 0.97, zt = top(x), zb = bot(x), zc = (zt + zb) / 2, hh = (zt - zb) / 2, e = 2 / s.n;
    const c = Math.min(1, Math.pow(Math.min(1, y / W), 1 / e)), sn = Math.sqrt(Math.max(0, 1 - c * c));
    return zc + hh * Math.pow(sn, e);
  };
  return { at, top, bot, plan, beltZ };
}

function buildCar(cam: Projector, body: BodyType, color: string) {
  const s = shapeFor(body), m = bodyModel(s), base = hexRgb(color);
  const roof = profile(s.cabin.roof);
  const facets: Facet[] = [];

  const { x0, x1, wb, wt, b } = s.cabin;
  const roofTop = Math.max(...s.cabin.roof.map((k) => k[1]));
  const widthK = (x: number) => { const zb = m.beltZ(x, wb) - 0.01, H = Math.max(0, roof(x) - zb); return Math.min(1, 0.35 + (H / (roofTop - zb + 0.001)) * 1.4); };
  // ---- lower body (facets under the greenhouse are never visible and would confuse the depth sort)
  const NU = 78, NV = 64;
  facets.push(...surface(cam, NU, NV, (u, v) => m.at(u * s.L, v * Math.PI * 2), (n, view, u, v) => {
    const x = u * s.L, a = v * Math.PI * 2, p = m.at(x, a);
    if (Math.sin(a) < -0.55) return satin(TRIM, n, view, 0.12);                                // sills and underbody
    if (x < 0.3 && Math.sin(a) < -0.25) return satin(BLACK, n, view, 0.1);                      // front splitter
    if (x > x0 + 0.03 && x < x1 - 0.03 && Math.sin(a) > 0.2 && Math.abs(p[1]) < wb * widthK(x) - 0.02) return null;
    return paint(base, n, view);
  }, { key: 'body', inside: (q) => [q[0], 0, (m.top(q[0]) + m.bot(q[0])) / 2] }));

  // ---- greenhouse
  const bodyCount = facets.length;
  const cab = (u: number, v: number): V3 => {
    const x = x0 + (x1 - x0) * u, a = v * Math.PI;
    const zb = m.beltZ(x, wb) - 0.01, H = Math.max(0, roof(x) - zb);
    const c = Math.cos(a), sn = Math.sin(a), e = 0.5;
    const w = (wb - (wb - wt) * Math.pow(sn, 1.6)) * widthK(x);
    return [x, w * Math.sign(c) * Math.pow(Math.abs(c), e), zb + H * Math.pow(sn, e)];
  };
  const rampF = s.cabin.roof[2][0], rampR = s.cabin.roof[s.cabin.roof.length - 3][0];
  facets.push(...surface(cam, 60, 40, cab, (n, view, u, v) => {
    // every boundary follows a parameter line (constant x or constant height band), so edges stay smooth
    const x = x0 + (x1 - x0) * u, h = Math.pow(Math.sin(v * Math.PI), 0.5);
    const fastback = s.cabin.x1 < s.L - 0.3;
    if (s.cabin.open) return x < rampF + 0.02 && h > 0.15 ? glass(n, view) : satin(x < rampF + 0.02 ? BLACK : [52, 40, 34], n, view, 0.2);   // windscreen; cockpit
    if (h < 0.07) return satin(CHROME, n, view, 0.7);                                             // waist chrome
    if (h < 0.83) {                                                                                // side glass band
      if (b && Math.abs(x - b) < 0.055) return satin(BLACK, n, view, 0.3);                       // B pillar
      if (x > rampR + (fastback ? -0.05 : 0.2)) return paint(base, n, view);                      // C pillar
      return glass(n, view);
    }
    if (h < 0.875) return paint(base, n, view);                                                   // A pillar and roof rail
    if (x < rampF - 0.08) return glass(n, view);                                                  // windscreen
    if (x > rampR + 0.08) return glass(n, view);                                                  // rear window
    return paint(base, n, view);                                                                  // roof panel
  }, { key: 'cabin', inside: (q) => [q[0], 0, m.beltZ(q[0], wb) - 0.3] }));

  // ---- door mirrors (small ellipsoids on the near and far side)
  for (const sideSign of [-1, 1]) {
    const mx = x0 + 0.24, my = sideSign * (wb + 0.1), mz = m.beltZ(mx, wb) + 0.05;
    facets.push(...surface(cam, 10, 12, (u, v) => {
      const th = u * Math.PI, ph = v * Math.PI * 2;
      return [mx + 0.11 * Math.cos(th), my + 0.09 * Math.sin(th) * Math.cos(ph), mz + 0.06 * Math.sin(th) * Math.sin(ph)];
    }, (n, view, u) => (u < 0.25 ? satin(BLACK, n, view, 0.3) : paint(base, n, view)), { key: 'mirror', inside: () => [mx, my, mz] }));
  }
  const upper = facets.splice(bodyCount);
  // three convex layers, painted in order; inside each, same-colour facets share one path
  const layers = [batch(facets), batch(upper.filter((f) => f.key === 'cabin')), batch(upper.filter((f) => f.key === 'mirror'))];
  return { s, m, layers, base };
}

/** A wheel: tyre tread and sidewall, brake disc and calliper, five twin-spoke forged rim. */
function Wheel({ cam, cx, y, R, tint, far = false }: { cam: Projector; cx: number; y: number; R: number; tint: string; far?: boolean }) {
  const out = Math.sign(y) || -1, w = 0.125;
  const at = (r: number, a: number, dy: number): V3 => [cx + r * Math.cos(a), y + dy * out, R + r * Math.sin(a)];
  const ring = (r: number, dy: number, n = 56) => Array.from({ length: n }, (_, i) => at(r, (i / n) * Math.PI * 2, dy));
  const tread = surface(cam, 48, 4, (u, v) => at(R * (0.985 + 0.015 * Math.sin(v * Math.PI)), u * Math.PI * 2, -w + 2 * w * v), (n, view) => satin([22, 23, 26], n, view, 0.05), { inside: (q) => [cx, q[1], R] });
  const wall = surface(cam, 48, 3, (u, v) => at(R * (0.985 - v * 0.27), u * Math.PI * 2, w + 0.012 * Math.sin(v * Math.PI)), (n, view) => satin([30, 31, 35], n, view, 0.12), { inside: (q) => [cx, y, R] });
  const tyre = <g strokeWidth="0.6">{[...batch(tread), ...batch(wall)].map((f, i) => <path key={i} d={f.d} fill={f.fill} stroke={f.fill} />)}</g>;
  if (far) return tyre;
  const rim = 0.7 * R;
  const spokes: { pts: string; depth: number; fill: string }[] = [];
  for (let k = 0; k < 10; k++) {
    const a0 = (k / 10) * Math.PI * 2 + (k % 2 ? 0.1 : -0.1), da = 0.07;
    const quad: V3[] = [at(rim * 0.24, a0 - da * 1.6, w - 0.005), at(rim * 0.96, a0 - da, w - 0.03), at(rim * 0.96, a0 + da, w - 0.03), at(rim * 0.24, a0 + da * 1.6, w - 0.005)];
    const n = norm(cross(sub(quad[2], quad[0]), sub(quad[3], quad[1])));
    const lit = 0.55 + 0.45 * Math.max(0, Math.sin(a0 + 2.2));
    spokes.push({ pts: poly(cam, quad), depth: depthOf(cam, quad), fill: rgbHex(mix([92, 99, 108], [226, 232, 238], lit * (0.6 + 0.4 * Math.abs(n[2])))) });
  }
  const caliper: V3[] = Array.from({ length: 10 }, (_, i) => at(rim * (i < 5 ? 0.9 : 0.62), Math.PI * 0.62 + ((i < 5 ? i : 9 - i) / 4) * 0.75, w - 0.07));
  return <g className="ae-wheel">
    {tyre}
    <polygon points={poly(cam, ring(rim * 1.02, w - 0.06))} fill="#0b0d11" />
    <polygon points={poly(cam, ring(rim * 0.82, w - 0.085))} fill="#59606a" />
    <polygon points={poly(cam, ring(rim * 0.66, w - 0.083))} fill="none" stroke="#3a4048" strokeWidth="1.2" />
    <polygon points={poly(cam, caliper)} fill={tint} stroke="#00000055" strokeWidth="1" />
    {spokes.map((p, i) => <polygon key={i} points={p.pts} fill={p.fill} />)}
    <polygon points={poly(cam, ring(rim, w - 0.012))} fill="none" stroke="#e8edf2" strokeWidth="2.2" />
    <polygon points={poly(cam, ring(rim * 1.05, w))} fill="none" stroke="#7d8692" strokeWidth="1.2" />
    <polygon points={poly(cam, ring(rim * 0.26, w - 0.002, 20))} fill="#2b3139" stroke="#c9d2db" strokeWidth="1.4" />
    <polygon points={poly(cam, ring(rim * 0.1, w + 0.002, 12))} fill="#d9e1e8" />
  </g>;
}

function CarDetails({ cam, s, m, uid, accent }: { cam: Projector; s: Shape; m: ReturnType<typeof bodyModel>; uid: string; accent: string }) {
  const on = (x: number, a: number, k = 1.004): V3 => { const p = m.at(x, a); return [p[0], p[1] * k, p[2]]; };
  const A = (sign: number, t: number) => (sign < 0 ? Math.PI * t : Math.PI * (1 - t));
  // headlamp: a sharp sweep from the nose, round the corner and into the wing
  const lampPts = (sg: number): V3[] => [on(0.05, A(sg, 0.585)), on(0.16, A(sg, 0.645)), on(0.36, A(sg, 0.675)), on(0.58, A(sg, 0.672)), on(0.6, A(sg, 0.655)), on(0.42, A(sg, 0.628)), on(0.22, A(sg, 0.59)), on(0.08, A(sg, 0.545))];
  const drl = (sg: number): V3[] => [on(0.07, A(sg, 0.575), 1.008), on(0.2, A(sg, 0.63), 1.008), on(0.4, A(sg, 0.66), 1.008), on(0.57, A(sg, 0.666), 1.008)];
  const lens = (sg: number, x: number, t: number) => on(x, A(sg, t), 1.01);
  const front = (y: number, z: number): V3 => [-0.004, y, z];
  const zb0 = m.bot(0), zt0 = m.top(0), w0 = m.plan(0), H0 = zt0 - zb0;
  // grille: a wide, low shield with rounded corners; a lower intake with a bright blade below it
  const gz0 = zb0 + H0 * 0.3, gz1 = zb0 + H0 * 0.74, gw = w0 * 0.66, r = H0 * 0.12;
  const grille: V3[] = [front(-gw + r, gz1), front(gw - r, gz1), front(gw, gz1 - r), front(gw * 0.9, gz0 + r), front(gw * 0.9 - r, gz0), front(-gw * 0.9 + r, gz0), front(-gw * 0.9, gz0 + r), front(-gw, gz1 - r)];
  const intake: V3[] = [front(-w0 * 0.8, zb0 + H0 * 0.2), front(w0 * 0.8, zb0 + H0 * 0.2), front(w0 * 0.74, zb0 + H0 * 0.06), front(-w0 * 0.74, zb0 + H0 * 0.06)];
  const slats = Array.from({ length: 4 }, (_, i) => { const z = gz0 + ((i + 1) / 5) * (gz1 - gz0); return [front(-gw * 0.93, z), front(gw * 0.93, z)] as V3[]; });
  const doorCut = (x: number) => Array.from({ length: 10 }, (_, i) => on(x - 0.02 * (i / 9), Math.PI * (0.62 + 0.72 * (i / 9) * 0.6), 1.003));
  const shoulder = Array.from({ length: 24 }, (_, i) => on(0.5 + (s.L - 1.0) * (i / 23), Math.PI * 0.69, 1.004));
  const doors = s.cabin.b ? [s.cabin.x0 + 0.08, s.cabin.b + 0.02, Math.min(s.rx - s.R - 0.12, s.cabin.x1 - 0.35)] : [s.cabin.x0 + 0.05, Math.min(s.rx - s.R - 0.1, s.cabin.x1 - 0.4)];
  // a pickup's load bed: a dark tub set into the deck behind the cab, with a lit rim
  const bed = s.cabin.x1 < s.L - 1 && s.cabin.wb > 0.85 ? (() => {
    const xb0 = s.cabin.x1 + 0.12, xb1 = s.L - 0.18, yw = m.plan(3.5) * 0.9, zt = m.top(xb0) + 0.003, zf = zt - 0.38;
    return { rim: poly(cam, [[xb0, -yw, zt], [xb1, -yw, zt], [xb1, yw, zt], [xb0, yw, zt]]), floor: poly(cam, [[xb0 + 0.05, -yw + 0.05, zf], [xb1 - 0.05, -yw + 0.05, zf], [xb1 - 0.05, yw - 0.05, zf], [xb0 + 0.05, yw - 0.05, zf]]) };
  })() : null;
  const handle = (x: number) => [on(x, Math.PI * 0.705, 1.012), on(x + 0.16, Math.PI * 0.705, 1.012)];
  return <g className="ae-car-details">
    {bed && <g><polygon points={bed.rim} fill="#07090c" /><polygon points={bed.floor} fill="#1b2027" /><polygon points={bed.rim} fill="none" stroke="#c9d2da" strokeOpacity="0.35" strokeWidth="2" /></g>}
    <polyline points={poly(cam, shoulder)} fill="none" stroke="#ffffff" strokeOpacity="0.32" strokeWidth="1.4" />
    {doors.map((x, i) => <polyline key={i} points={poly(cam, doorCut(x))} fill="none" stroke="#05070a" strokeOpacity="0.55" strokeWidth="1.3" />)}
    {doors.slice(0, -1).map((x, i) => <polyline key={'h' + i} points={poly(cam, handle(x + 0.45))} fill="none" stroke="#c9d1d9" strokeWidth="3" strokeLinecap="round" />)}
    <polygon points={poly(cam, intake)} fill="#07090c" stroke="#2a3038" strokeWidth="1" />
    <polyline points={poly(cam, [front(-w0 * 0.62, zb0 + H0 * 0.13), front(w0 * 0.62, zb0 + H0 * 0.13)])} stroke="#b9c3cc" strokeWidth="1.6" />
    <polygon points={poly(cam, grille)} fill={`url(#mesh${uid})`} stroke="#c9d2da" strokeOpacity="0.75" strokeWidth="1.6" strokeLinejoin="round" />
    {slats.map((sl, i) => <polyline key={i} points={poly(cam, sl)} stroke="#4b545f" strokeWidth="1" opacity="0.8" />)}
    {([-1, 1] as const).map((sg) => <g key={sg}>
      <polygon points={poly(cam, lampPts(sg))} fill={`url(#lamp${uid})`} stroke="#0a0d12" strokeWidth="1.2" strokeLinejoin="round" />
      {[[0.2, 0.615], [0.33, 0.64]].map(([x, t], i) => { const c = cam.project(lens(sg, x, t)); return <g key={i}><circle cx={c[0]} cy={c[1]} r={sg < 0 ? 6 : 3.6} fill="#0b1118" stroke="#8fa3b4" strokeWidth="1" /><circle cx={c[0] - 1} cy={c[1] - 1} r={sg < 0 ? 2.4 : 1.4} fill="#eaf8ff" /></g>; })}
      <polyline points={poly(cam, drl(sg))} fill="none" stroke={accent} strokeOpacity="0.5" strokeWidth="8" strokeLinecap="round" filter={`url(#bloom${uid})`} className="ae-drl-glow" />
      <polyline points={poly(cam, drl(sg))} fill="none" stroke="#f2fbff" strokeWidth="2.4" strokeLinecap="round" />
    </g>)}
  </g>;
}

export const HeroShowroom2D = memo(function HeroShowroom2D({ color = '#315b8e', body = 'sedan', label = 'Premium vehicle showroom', compact = false }: Props) {
  const uid = useId().replace(/[^A-Za-z0-9]/g, '');
  const safe = /^#[0-9A-Fa-f]{6}$/.test(color) ? color.toLowerCase() : '#315b8e';
  const scene = useMemo(() => {
    const s0 = shapeFor(body);
    const cam = camera({ eye: [-2.9, -5.9, 1.85], target: [s0.L * 0.5, 0, 0.62], focal: 1560, cx: 650, cy: 410 });
    const car = buildCar(cam, body, safe);
    const s = car.s;
    const floorRing = (r: number, n = 72) => poly(cam, Array.from({ length: n }, (_, i) => [s.L / 2 + r * Math.cos((i / n) * Math.PI * 2), r * Math.sin((i / n) * Math.PI * 2), 0] as V3));
    const shadow = poly(cam, Array.from({ length: 48 }, (_, i) => { const a = (i / 48) * Math.PI * 2; return [s.L / 2 + (s.L / 2 + 0.25) * Math.cos(a), (s.W + 0.18) * Math.sin(a), 0] as V3; }));
    const contact = [s.fx, s.rx].flatMap((x) => [-1, 1].map((sg) => poly(cam, Array.from({ length: 20 }, (_, i) => { const a = (i / 20) * Math.PI * 2; return [x + 0.32 * Math.cos(a), sg * s.tw + 0.16 * Math.sin(a), 0] as V3; }))));
    // wheel arches: a circle on the body side around each near axle, used as the window the wheel shows through
    const RA = s.R + 0.07;
    const archPts = (ax: number, from = 0, to = Math.PI * 2, n = 40) => Array.from({ length: n + 1 }, (_, i) => {
      const t = from + (to - from) * (i / n), x = ax + RA * Math.cos(t), z = s.R + RA * Math.sin(t);
      return [x, -car.m.plan(x) * (z > 0.45 ? 0.965 : 0.99), Math.max(-0.02, z)] as V3;
    });
    const arches = [s.fx, s.rx].map((ax) => ({ ax, hole: poly(cam, archPts(ax)), lip: poly(cam, archPts(ax, Math.PI * 0.05, Math.PI * 0.95)) }));
    const c1 = cam.project([s.fx, -s.tw - 0.1, 0]), c2 = cam.project([s.rx, -s.tw - 0.1, 0]);
    const k = (c2[1] - c1[1]) / (c2[0] - c1[0]);
    const mirror = `matrix(1 ${(2 * k).toFixed(4)} 0 -1 0 ${(2 * (c1[1] - k * c1[0])).toFixed(1)})`;   // flip about the ground line
    return { cam, car, s, mirror, rings: [floorRing(3.4), floorRing(3.25), floorRing(2.2)], shadow, contact, arches };
  }, [body, safe]);
  const { cam, car, s } = scene;
  const accent = '#9fd6e5', light = rgbHex(mix(car.base, [255, 255, 255], 0.35));
  return <svg className={'ae-hero-showroom' + (compact ? ' compact' : '')} viewBox={compact ? '0 0 1280 720' : '110 150 1060 600'} role="img" aria-label={label} focusable="false" preserveAspectRatio="xMidYMid meet" data-paint={safe}>
    <defs>
      <linearGradient id={`wall${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b121c" /><stop offset="0.62" stopColor="#16222f" /><stop offset="1" stopColor="#0d141d" /></linearGradient>
      <radialGradient id={`studioFloor${uid}`} cx="0.5" cy="0.25" r="0.8"><stop offset="0" stopColor="#2a3644" /><stop offset="0.55" stopColor="#131b25" /><stop offset="1" stopColor="#080c12" /></radialGradient>
      <radialGradient id={`spot${uid}`} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#dcecf6" stopOpacity="0.22" /><stop offset="1" stopColor="#dcecf6" stopOpacity="0" /></radialGradient>
      <linearGradient id={`paintTop${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={light} /><stop offset="1" stopColor={safe} /></linearGradient>
      <pattern id={`mesh${uid}`} width="7" height="5" patternUnits="userSpaceOnUse"><rect width="7" height="5" fill="#0a0d11" /><path d="M0 2.5L3.5 0L7 2.5L3.5 5Z" fill="#1d232b" stroke="#39414b" strokeWidth="0.6" /></pattern>
      <linearGradient id={`lamp${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3a4654" /><stop offset="0.45" stopColor="#0d1218" /><stop offset="1" stopColor="#5d6b78" /></linearGradient>
      <linearGradient id={`softbox${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f3f8fb" stopOpacity="0.95" /><stop offset="1" stopColor="#b9d4e4" stopOpacity="0.55" /></linearGradient>
      <linearGradient id={`fin${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9fc6dd" stopOpacity="0" /><stop offset="0.5" stopColor="#bfe0ef" stopOpacity="0.55" /><stop offset="1" stopColor="#9fc6dd" stopOpacity="0" /></linearGradient>
      <linearGradient id={`fadeG${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stopColor="#fff" stopOpacity="0" /><stop offset="0.72" stopColor="#fff" stopOpacity="1" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
      <mask id={`fade${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1280" height="720"><rect width="1280" height="720" fill={`url(#fadeG${uid})`} /></mask>
      <filter id={`bloom${uid}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
      <filter id={`soft${uid}`} x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="14" /></filter>
    </defs>
    {/* studio: back wall with light fins, overhead soft box, polished floor and turntable */}
    {/* wall and floor run past the frame so the scene fills panels of any shape */}
    <rect x="-900" y="-600" width="3080" height="940" fill="#0b121c" />
    <rect x="-900" y="0" width="3080" height="330" fill={`url(#wall${uid})`} />
    {/* cyclorama: a curved wall that melts into the floor, light fins, a long ceiling soft box */}
    <ellipse cx="640" cy="330" rx="760" ry="230" fill={`url(#spot${uid})`} opacity="0.55" />
    <g>{Array.from({ length: 15 }, (_, i) => { const x = -200 + i * 120; return <rect key={i} x={x} y={-80 - Math.abs(i - 5) * 6} width="5" height={390 + Math.abs(i - 5) * 6} rx="2.5" fill={`url(#fin${uid})`} opacity={0.35 + (i % 2) * 0.2} />; })}</g>
    <path d="M260 0H1020L960 46H320Z" fill="#0e1622" />
    <rect x="330" y="14" width="620" height="18" rx="9" fill={`url(#softbox${uid})`} />
    <ellipse cx="640" cy="34" rx="400" ry="46" fill={`url(#spot${uid})`} />
    <rect x="-900" y="322" width="3080" height="900" fill="#080c12" />
    <path d="M-900 330C300 312 980 312 2180 330V720H-900Z" fill={`url(#studioFloor${uid})`} />
    <path d="M0 322C300 312 980 312 1280 322" stroke="#a8c4d6" strokeOpacity="0.14" fill="none" />
    <polygon points={scene.rings[0]} fill="#0a1018" stroke="#2c3a48" strokeWidth="1.5" />
    <polygon points={scene.rings[1]} fill="#0f1822" stroke="#c7a46a" strokeOpacity="0.5" strokeWidth="1.3" />
    <polygon points={scene.rings[2]} fill="none" stroke="#9fd6e5" strokeOpacity="0.12" strokeWidth="1" />
    <ellipse cx="640" cy="520" rx="520" ry="120" fill={`url(#spot${uid})`} opacity="0.5" />
    {/* polished floor: the car reflected about the ground line, fading out (re-uses the drawing, no extra nodes) */}
    <g mask={`url(#fade${uid})`} opacity="0.22"><use href={`#car${uid}`} transform={scene.mirror} /></g>
    {/* car */}
    <g className="ae-hero-vehicle" id={`car${uid}`}>
      <polygon points={scene.shadow} fill="#000" opacity="0.6" filter={`url(#soft${uid})`} />
      {scene.contact.map((c, i) => <polygon key={i} points={c} fill="#000" opacity="0.7" />)}
      <Wheel cam={cam} cx={s.fx} y={s.tw} R={s.R} tint={accent} far />
      <Wheel cam={cam} cx={s.rx} y={s.tw} R={s.R} tint={accent} far />
      <g className="ae-hero-paint" strokeWidth="0.7" strokeLinejoin="round">{car.layers.map((layer, k) => <g key={k}>{layer.map((f, i) => <path key={i} d={f.d} fill={f.fill} stroke={f.fill} />)}</g>)}</g>
      {scene.arches.map((a, i) => <g key={i}>
        <clipPath id={`arch${i}${uid}`}><polygon points={a.hole} /></clipPath>
        <polygon points={a.hole} fill="#06080b" />
        <g clipPath={`url(#arch${i}${uid})`}><Wheel cam={cam} cx={a.ax} y={-s.tw} R={s.R} tint="#c8a35a" /></g>
        <polyline points={a.lip} fill="none" stroke={rgbHex(mix(car.base, [255, 255, 255], 0.45))} strokeOpacity="0.55" strokeWidth="2" />
      </g>)}
      <CarDetails cam={cam} s={s} m={car.m} uid={uid} accent={accent} />
    </g>
  </svg>;
});
