// Engine illustrations built from the simulation's engine specification and drawn in true perspective with the
// vector renderer: cylinder count and arrangement (inline, V, flat), valvetrain (pushrod or overhead cams), induction
// (turbos, supercharger), block material, hybrid assistance and electric drive units. Each part (block, sump, heads,
// cam covers, coil packs, plenum and runners, headers, belt drive, turbos, bell housing) is a small convex solid; the
// solids are painted back to front and their faces are batched by colour. Pure SVG, recoloured per engine.
import { memo, useId, useMemo } from 'react';
import type { EngineSpec, EngineLayout } from '../../sim/types';
import { CYL } from '../../sim/engineering';
import { add, batch, camera, cross, mul, norm, paint, rgbHex, satin, sub, surface, type Facet, type Projector, type RGB, type V3 } from './vector3d';

type Kind = 'inline' | 'v' | 'flat' | 'ev';
const kindOf = (l: EngineLayout): Kind => (l === 'EV' ? 'ev' : l.startsWith('V') ? 'v' : l.startsWith('F') ? 'flat' : 'inline');

export interface Engine2DProps { engine: Pick<EngineSpec, 'layout'> & Partial<EngineSpec>; label?: string; accent?: string; className?: string; compact?: boolean }

// ---------------------------------------------------------------------------------------------------- materials
type Mat = { c: RGB; spec?: number; metal?: boolean };
const ALU: Mat = { c: [176, 182, 190], spec: 0.35 }, IRON: Mat = { c: [98, 102, 108], spec: 0.15 }, DARK: Mat = { c: [34, 37, 42], spec: 0.2 };
const BLACK: Mat = { c: [20, 22, 25], spec: 0.25 }, STEEL: Mat = { c: [150, 156, 164], spec: 0.6, metal: true }, CHROME: Mat = { c: [200, 206, 214], spec: 0.9, metal: true };
const HEAT: Mat = { c: [150, 98, 58], spec: 0.35 }, BRONZE: Mat = { c: [186, 140, 84], spec: 0.5, metal: true }, ORANGE: Mat = { c: [232, 118, 36], spec: 0.3 };
const BLUEHV: Mat = { c: [40, 86, 132], spec: 0.3 }, RUBBER: Mat = { c: [14, 15, 17], spec: 0.05 };
const shadeMat = (m: Mat) => (n: V3, view: V3): RGB => (m.metal ? paint(m.c, n, view, { metal: 0.7, gloss: m.spec }) : satin(m.c, n, view, m.spec ?? 0.2));

interface Solid { facets: Facet[]; depth: number }
const solidOf = (facets: Facet[]): Solid => ({ facets, depth: facets.length ? facets.reduce((a, f) => a + f.depth, 0) / facets.length : 0 });

/** A box from a centre and three half-axis vectors. */
function box(cam: Projector, c: V3, ax: V3, ay: V3, az: V3, m: Mat): Solid {
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
  return solidOf(out);
}
const X: V3 = [1, 0, 0], Y: V3 = [0, 1, 0], Z: V3 = [0, 0, 1];
const axisBox = (cam: Projector, c: V3, sx: number, sy: number, sz: number, m: Mat) => box(cam, c, [sx, 0, 0], [0, sy, 0], [0, 0, sz], m);

/** A cylinder (with caps) around `axis` through `c`. `r2` makes it a cone frustum. */
function cyl(cam: Projector, c: V3, axis: V3, r: number, len: number, m: Mat, seg = 18, r2 = r): Solid {
  const a = norm(axis), t = norm(Math.abs(a[2]) < 0.9 ? cross(a, Z) : cross(a, X)), b = cross(a, t);
  const at = (u: number, v: number): V3 => { const ang = u * Math.PI * 2, rr = r + (r2 - r) * v; return add(add(c, mul(a, (v - 0.5) * len)), add(mul(t, Math.cos(ang) * rr), mul(b, Math.sin(ang) * rr))); };
  const f = surface(cam, seg, 1, at, shadeMat(m), { inside: (p) => add(c, mul(a, (p[0] - c[0]) * a[0] + (p[1] - c[1]) * a[1] + (p[2] - c[2]) * a[2])) });
  for (const [v, rr, sg] of [[0, r, -1], [1, r2, 1]] as const) {
    const cc = add(c, mul(a, (v - 0.5) * len)), n = mul(a, sg), view = norm(sub(cc, cam.eye));
    if (n[0] * view[0] + n[1] * view[1] + n[2] * view[2] > 0) continue;
    const pts = Array.from({ length: seg }, (_, i) => cam.project(add(cc, add(mul(t, Math.cos((i / seg) * Math.PI * 2) * rr), mul(b, Math.sin((i / seg) * Math.PI * 2) * rr)))));
    f.push({ pts: pts.map((p) => [p[0], p[1]] as [number, number]), depth: pts.reduce((s, p) => s + p[2], 0) / seg - 0.001, fill: rgbHex(shadeMat(m)(n, view)) });
  }
  return solidOf(f);
}
/** A pipe along a polyline: one short cylinder per segment. */
const tube = (cam: Projector, pts: V3[], r: number, m: Mat, seg = 10): Solid[] =>
  pts.slice(1).map((p, i) => { const a = pts[i], d = sub(p, a), len = Math.hypot(d[0], d[1], d[2]); return cyl(cam, mul(add(a, p), 0.5), d, r, len + r * 0.6, m, seg); });

// ---------------------------------------------------------------------------------------------------- assemblies
interface Build { cam: Projector; solids: Solid[]; belts: [number, number][][]; bolts: [number, number][]; marks: { at: [number, number]; text: string }[] }

function engineSolids(engine: Engine2DProps['engine'], cam: Projector): Build {
  const kind = kindOf(engine.layout), n = CYL[engine.layout] || 4;
  const alu = engine.aluBlock ?? true, ohc = !!engine.valvetrain && engine.valvetrain !== 'ohv';
  const racy = (engine.redline ?? 6500) >= 7800;
  const turbos = engine.aspiration === 'twinturbo' ? 2 : engine.aspiration === 'turbo' ? 1 : 0, blower = engine.aspiration === 'supercharged';
  const hybrid = (engine.hybridKw ?? 0) > 0;
  const blockM = alu ? ALU : IRON, coverM: Mat = racy ? { c: [178, 36, 30], spec: 0.35 } : ohc ? BLACK : { c: [46, 78, 128], spec: 0.4 };
  const S: Solid[] = [], belts: Build['belts'] = [], bolts: Build['bolts'] = [], marks: Build['marks'] = [];
  const P = (p: V3) => { const q = cam.project(p); return [q[0], q[1]] as [number, number]; };

  if (kind === 'ev') {
    // drive unit: motor drum, inverter on top, reduction gear, half shafts, battery modules below
    S.push(axisBox(cam, [0.45, 0, 0.05], 0.75, 0.55, 0.05, { c: [30, 48, 66], spec: 0.3 }));
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) S.push(axisBox(cam, [-0.17 + i * 0.25, -0.27 + j * 0.54, 0.115], 0.11, 0.24, 0.018, BLUEHV));
    S.push(cyl(cam, [0.25, 0, 0.42], Y, 0.21, 0.42, ALU, 28));
    for (let k = 0; k < 7; k++) S.push(cyl(cam, [0.25, -0.18 + k * 0.06, 0.42], Y, 0.222, 0.014, ALU, 28));
    S.push(cyl(cam, [0.62, 0, 0.36], Y, 0.15, 0.38, IRON, 22));
    S.push(axisBox(cam, [0.28, 0, 0.72], 0.24, 0.17, 0.07, DARK));
    S.push(...tube(cam, [[0.06, -0.12, 0.76], [-0.1, -0.12, 0.7], [-0.16, -0.12, 0.2]], 0.022, ORANGE));
    S.push(...tube(cam, [[0.06, 0.06, 0.76], [-0.12, 0.06, 0.7], [-0.2, 0.06, 0.2]], 0.022, ORANGE));
    S.push(cyl(cam, [0.62, -0.42, 0.36], Y, 0.03, 0.5, STEEL, 10), cyl(cam, [0.62, 0.42, 0.36], Y, 0.03, 0.5, STEEL, 10));
    S.push(cyl(cam, [0.62, -0.67, 0.36], Y, 0.06, 0.08, RUBBER, 14));
    marks.push({ at: P([0.28, -0.17, 0.74]), text: 'HV 400 V' });
    return { cam, solids: S, belts, bolts, marks };
  }

  const pitch = 0.105, L = n === 3 ? 0.42 : 0.12 + (kind === 'inline' ? n : n / 2) * pitch;
  const x0 = -L / 2;
  // ---- crank case, sump, front timing cover, bell housing and gearbox
  S.push(axisBox(cam, [0, 0, 0.1], L / 2 + 0.01, kind === 'flat' ? 0.2 : 0.16, 0.07, IRON));
  S.push(axisBox(cam, [x0 - 0.02, 0, 0.3], 0.025, kind === 'inline' ? 0.15 : 0.22, 0.2, blockM));
  S.push(cyl(cam, [L / 2 + 0.07, 0, 0.25], X, 0.22, 0.12, alu ? ALU : IRON, 26, 0.17));
  S.push(cyl(cam, [L / 2 + 0.24, 0, 0.23], X, 0.15, 0.24, ALU, 22, 0.1));
  if (hybrid) {
    S.push(cyl(cam, [L / 2 + 0.2, 0, 0.27], X, 0.26, 0.1, BLUEHV, 26));
    S.push(...tube(cam, [[L / 2 + 0.2, -0.22, 0.4], [L / 2 + 0.25, -0.38, 0.45], [L / 2 + 0.45, -0.42, 0.2]], 0.022, ORANGE));
    marks.push({ at: P([L / 2 + 0.2, -0.26, 0.48]), text: 'HYBRID' });
  }

  // ---- cylinder banks
  // inline engines show the side facing the camera: the hot side when there is a turbo to see, else the intake
  const exhaustSide = turbos ? -1 : 1;
  const bankSolids = (tilt: number, side: number, cyls: number) => {
    // a bank: block, head and cam cover(s), rotated about the crank axis by `tilt` (radians from vertical)
    const up: V3 = [0, Math.sin(tilt), Math.cos(tilt)], across: V3 = [0, Math.cos(tilt), -Math.sin(tilt)];
    const base: V3 = [0, 0, 0.18];
    const at = (h: number, w = 0): V3 => add(add(base, mul(up, h)), mul(across, w));
    const bw = 0.14, bh = kind === 'flat' ? 0.2 : 0.26;
    S.push(box(cam, at(bh / 2 + 0.02), mul(X, L / 2), mul(across, bw), mul(up, bh / 2), blockM));
    S.push(box(cam, at(bh + 0.07), mul(X, L / 2 - 0.005), mul(across, bw + 0.012), mul(up, 0.05), blockM));
    const coverTop = bh + 0.12;
    if (ohc) {
      for (const w of [-0.065, 0.065]) S.push(box(cam, at(coverTop + 0.03, w), mul(X, L / 2 - 0.02), mul(across, 0.06), mul(up, 0.035), coverM));
      // coil packs / plug wells, one per cylinder, down the middle of the cover
      for (let i = 0; i < cyls; i++) S.push(box(cam, at(coverTop + 0.075, 0), mul(X, 0.022), mul(across, 0.028), mul(up, 0.02), DARK), box(cam, add(at(coverTop + 0.075, 0), [x0 + 0.08 + i * pitch, 0, 0]), mul(X, 0.025), mul(across, 0.03), mul(up, 0.03), BLACK));
    } else {
      S.push(box(cam, at(coverTop + 0.025), mul(X, L / 2 - 0.02), mul(across, bw - 0.01), mul(up, 0.035), coverM));
      for (let i = 0; i < cyls; i++) S.push(cyl(cam, add(at(coverTop - 0.02, side * (bw + 0.02)), [x0 + 0.08 + i * pitch, 0, 0]), across, 0.012, 0.06, BLACK, 8));
    }
    // cast ribs across the cam cover(s) and an oil filter on the block side
    for (let i = 0; i < cyls; i++) S.push(box(cam, add(at(coverTop + (ohc ? 0.068 : 0.062), side * (bw * 0.55)), [x0 + 0.08 + i * pitch + pitch * 0.5, 0, 0]), mul(X, 0.006), mul(across, 0.035), mul(up, 0.006), coverM));
    if (side === (kind === 'inline' ? -exhaustSide : -1)) S.push(cyl(cam, add(at(0.06, side * (bw + 0.05)), [L * 0.15, 0, 0]), across, 0.045, 0.1, { c: [24, 70, 140], spec: 0.4 }, 16));
    // cover bolts along the edges
    for (let i = 0; i <= cyls; i++) for (const w of [-(bw - 0.012), bw - 0.012]) bolts.push(P(add(at(coverTop + 0.06, w), [x0 + 0.04 + i * ((L - 0.08) / cyls), 0, 0])));
    // exhaust headers on the exhaust side: out of each port, down and back into a collector that runs rearwards
    const hdr: V3[] = [];
    const exSide = kind === 'inline' ? exhaustSide : side;
    const colZ = 0.24, colW = bw + 0.14;
    for (let i = 0; i < cyls; i++) {
      const px = x0 + 0.08 + i * pitch, port = add(at(bh + 0.04, exSide * (bw + 0.02)), [px, 0, 0]);
      const out = add(port, mul(across, exSide * 0.07)), end = add(add(at(colZ, exSide * colW), [x0 + 0.08 + (cyls - 1) * pitch * 0.5 + (i - (cyls - 1) / 2) * pitch * 0.45, 0, 0]), [0, 0, 0]);
      S.push(...tube(cam, [port, out, end], 0.019, HEAT, 8));
      hdr.push(end);
    }
    const c0 = add(at(colZ, exSide * colW), [x0 + 0.08 + (cyls - 1) * pitch * 0.5, 0, 0]);
    S.push(...tube(cam, [c0, add(c0, [L / 2 + 0.25, 0, -0.06])], 0.032, HEAT, 10));
    return { at, coverTop, hdr, across, up };
  };

  let plenumAt: V3 = [0, -0.3, 0.55];
  const banks: ReturnType<typeof bankSolids>[] = [];
  if (kind === 'inline') {
    const b = bankSolids(0, 1, n);
    banks.push(b);
    // intake runners on the other side into a long plenum, throttle body at the front
    const iy = -exhaustSide;
    plenumAt = [0, iy * 0.36, 0.42];
    S.push(box(cam, plenumAt, mul(X, L / 2 - 0.03), mul(Y, 0.06), mul(Z, 0.06), blockM));
    for (let i = 0; i < n; i++) { const px = x0 + 0.08 + i * pitch; S.push(...tube(cam, [[px, iy * 0.16, 0.42], [px, iy * 0.27, 0.5], [px, iy * 0.33, 0.44]], 0.024, blockM, 9)); }
    S.push(cyl(cam, [x0 - 0.06, iy * 0.36, 0.42], X, 0.045, 0.08, CHROME, 16));
  } else {
    const half = (kind === 'flat' ? Math.PI / 2 : (engine.layout === 'V6' ? 60 : engine.layout === 'V12' ? 60 : engine.layout === 'V10' ? 72 : 90) * Math.PI / 360);
    banks.push(bankSolids(-half, -1, n / 2), bankSolids(half, 1, n / 2));
    if (kind === 'v') {
      // intake plenum in the valley, with an air box and throttle bodies
      plenumAt = [0, 0, 0.62];
      S.push(box(cam, plenumAt, mul(X, L / 2 - 0.04), mul(Y, 0.1), mul(Z, 0.07), blockM));
      for (let i = 0; i < n / 2; i++) for (const sg of [-1, 1]) { const px = x0 + 0.08 + i * pitch; S.push(...tube(cam, [[px, sg * 0.08, 0.6], [px, sg * 0.14, 0.52]], 0.022, blockM, 8)); }
      S.push(cyl(cam, [x0 - 0.07, 0, 0.64], X, 0.06, 0.1, CHROME, 18));
      if (racy) for (let i = 0; i < n / 2; i++) for (const sg of [-1, 1]) S.push(cyl(cam, [x0 + 0.08 + i * pitch, sg * 0.05, 0.72], Z, 0.026, 0.07, CHROME, 12, 0.034));
    } else {
      plenumAt = [0, 0, 0.46];
      S.push(axisBox(cam, plenumAt, L / 2 - 0.04, 0.12, 0.05, DARK));
      S.push(cyl(cam, [0.02, 0, 0.6], Z, 0.17, 0.08, BLACK, 26));                         // cooling fan / air box
    }
  }
  // ---- forced induction
  if (turbos) {
    const sides = turbos === 2 && banks.length === 2 ? [0, 1] : turbos === 2 ? [0, 0] : [0];
    sides.forEach((k, j) => {
      const b = banks[k], ex = kind === 'inline' ? exhaustSide : k ? 1 : -1;
      const c = add(b.hdr[Math.min(b.hdr.length - 1, Math.floor(b.hdr.length * (sides.length === 2 && banks.length === 1 ? (j ? 0.75 : 0.25) : 0.5)))], [0, ex * 0.07, 0.09]);
      S.push(cyl(cam, c, X, 0.075, 0.075, HEAT, 20));                                         // turbine housing
      S.push(cyl(cam, add(c, [0.085, 0, 0]), X, 0.07, 0.06, ALU, 20));                        // compressor housing
      S.push(cyl(cam, add(c, [0.13, 0, 0]), X, 0.04, 0.05, DARK, 14));                        // inlet
      S.push(...tube(cam, [add(c, [0.085, 0, 0.07]), add(c, [0.085, -ex * 0.05, 0.22]), add(plenumAt, [L / 2 - 0.08, 0, 0.03])], 0.026, STEEL, 10));
    });
  }
  if (blower) {
    S.push(axisBox(cam, add(plenumAt, [0, 0, 0.13]), L / 2 - 0.08, 0.1, 0.07, CHROME));
    for (let i = 0; i < 6; i++) S.push(axisBox(cam, add(plenumAt, [-L / 2 + 0.12 + i * ((L - 0.24) / 5), 0, 0.21]), 0.006, 0.09, 0.012, STEEL));
    S.push(cyl(cam, add(plenumAt, [-L / 2 + 0.02, 0, 0.13]), X, 0.06, 0.03, STEEL, 18));
  }
  // ---- belt drive at the front: crank, water pump, alternator, idler
  const fx = x0 - 0.07;
  const pul: [V3, number][] = [[[fx, 0, 0.18], 0.085], [[fx, 0.0, 0.42], 0.05], [[fx, -0.17, 0.44], 0.045], [[fx, 0.15, 0.32], 0.035]];
  if (blower) pul.push([add(plenumAt, [-L / 2 + 0.02, 0, 0.13]), 0.06]);
  for (const [c, r] of pul) S.push(cyl(cam, add(c, [-0.016, 0, 0]), X, r * 0.92, 0.012, STEEL, 22), cyl(cam, add(c, [-0.026, 0, 0]), X, r * 0.4, 0.01, DARK, 14));
  S.push(cyl(cam, [fx + 0.02, -0.2, 0.44], X, 0.07, 0.14, ALU, 18));                       // alternator body
  // belt: a rubber band on each pulley rim and straight straps along the outer tangents between them
  const cy0 = pul.reduce((a, [c]) => a + c[1], 0) / pul.length, cz0 = pul.reduce((a, [c]) => a + c[2], 0) / pul.length;
  const ring = pul.map(([c, r]) => ({ c, r, ang: Math.atan2(c[2] - cz0, c[1] - cy0) })).sort((p, q) => p.ang - q.ang);
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length];
    const dy = q.c[1] - p.c[1], dz = q.c[2] - p.c[2], len = Math.hypot(dy, dz) || 1;
    let ny = dz / len, nz = -dy / len;                                                       // perpendicular in the belt plane
    const my = (p.c[1] + q.c[1]) / 2 - cy0, mz = (p.c[2] + q.c[2]) / 2 - cz0;
    if (ny * my + nz * mz < 0) { ny = -ny; nz = -nz; }                                         // point away from the middle
    const a0: V3 = [p.c[0] - 0.005, p.c[1] + ny * (p.r + 0.006), p.c[2] + nz * (p.r + 0.006)], a1: V3 = [q.c[0] - 0.005, q.c[1] + ny * (q.r + 0.006), q.c[2] + nz * (q.r + 0.006)];
    S.push(box(cam, mul(add(a0, a1), 0.5), [0.012, 0, 0], mul(sub(a1, a0), 0.5), [0, ny * 0.006, nz * 0.006], RUBBER));
  });
  for (const [c, r] of pul) S.push(cyl(cam, c, X, r + 0.007, 0.024, RUBBER, 22));
  return { cam, solids: S, belts, bolts, marks };
}

// built drawings are shared by every card showing the same engine (the workshop shows many at once)
const CACHE = new Map<string, unknown>();
function cached<T>(k: string, make: () => T): T {
  if (CACHE.has(k)) return CACHE.get(k) as T;
  const v = make();
  if (CACHE.size > 80) CACHE.delete(CACHE.keys().next().value as string);
  CACHE.set(k, v);
  return v;
}

export const Engine2D = memo(function Engine2D({ engine, label, accent = '#e8b04a', className, compact = false }: Engine2DProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const kind = kindOf(engine.layout);
  const turbos = engine.aspiration === 'twinturbo' ? 2 : engine.aspiration === 'turbo' ? 1 : 0;
  const hybrid = (engine.hybridKw ?? 0) > 0;
  const text = label ?? (kind === 'ev' ? `EV · ${Math.round(engine.motorKw ?? 150)} kW` : `${engine.layout} · ${((engine.displacement ?? 2000) / 1000).toFixed(1)} L${turbos ? (turbos === 2 ? ' · twin-turbo' : ' · turbo') : engine.aspiration === 'supercharged' ? ' · supercharged' : ''}${hybrid ? ' · hybrid' : ''}`);
  const key = `${engine.layout}|${engine.aspiration}|${engine.valvetrain}|${engine.aluBlock}|${engine.redline}|${engine.hybridKw ?? 0}`;
  const art = useMemo(() => cached(key + (compact ? '|c' : ''), () => {
    const cam = camera({ eye: [-2.3, -2.6, 1.9], target: [0.05, 0, 0.32], focal: 300, cx: 0, cy: 0 });
    const b = engineSolids(engine, cam);
    const solids = b.solids.filter((s) => s.facets.length).sort((p, q) => q.depth - p.depth);
    // fit the drawing: bounding box of every projected point, padded, at the frame's aspect ratio
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of solids) for (const f of s.facets) for (const [x, y] of f.pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const pad = (x1 - x0) * 0.06, w0 = x1 - x0 + pad * 2, h0 = y1 - y0 + pad * 2 + (compact ? 0 : (x1 - x0) * 0.12);
    const ar = 280 / 190, w = Math.max(w0, h0 * ar), h = w / ar;
    const vx = (x0 + x1) / 2 - w / 2, vy = y1 + pad - h;
    return { solids: solids.map((s) => batch(s.facets)), belts: b.belts, bolts: b.bolts, marks: b.marks, vb: [vx, vy, w, h], ground: (y1 + pad * 0.4) };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [key, compact]);
  const [vx, vy, w, h] = art.vb, u = w / 280;
  return (
    <div className={'engine2d ' + (className ?? '')} role="img" aria-label={text}>
      <svg viewBox={`${vx.toFixed(1)} ${vy.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`} preserveAspectRatio="xMidYMid meet">
        <defs><radialGradient id={`s${id}`}><stop offset="0" stopColor="#000" stopOpacity="0.55" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient></defs>
        <ellipse cx={vx + w / 2} cy={art.ground} rx={w * 0.42} ry={h * 0.07} fill={`url(#s${id})`} />
        <g strokeWidth={0.5 * u} strokeLinejoin="round">
          {art.solids.map((layer, i) => <g key={i}>{layer.map((f, k) => <path key={k} d={f.d} fill={f.fill} stroke={f.fill} />)}</g>)}
        </g>
        {!compact && art.bolts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={0.9 * u} fill="#9aa4b1" stroke="#1b1f25" strokeWidth={0.35 * u} />)}
        {!compact && art.marks.map((m, i) => <text key={i} x={m.at[0]} y={m.at[1]} fontSize={7 * u} fontWeight="700" letterSpacing={0.8 * u} fill="#cfd8e3" opacity="0.75" fontFamily="system-ui, sans-serif" textAnchor="middle">{m.text}</text>)}
        {!compact && <g><rect x={vx + w / 2 - 78 * u} y={vy + 6 * u} width={156 * u} height={20 * u} rx={10 * u} fill="#0d1520" stroke={accent} strokeOpacity="0.55" strokeWidth={u} /><text x={vx + w / 2} y={vy + 20 * u} textAnchor="middle" fontSize={(text.length > 24 ? 8.5 : 11) * u} fontWeight="700" letterSpacing={1.2 * u} fill={accent} fontFamily="system-ui, sans-serif">{text.toUpperCase()}</text></g>}
      </svg>
    </div>
  );
});
