// A cut-away of one assembly plant in perspective, through its seven sectors: raw materials → body shop → paint →
// powertrain → final assembly → inspection → dispatch. Every bay has its own machinery, drawn as small solids with the
// vector renderer (coils and pallets, a stamping press and welding robots, a glass paint booth, engines on stands under a
// hoist, tyre stacks, a light tunnel over a rolling road, a car transporter). What is drawn follows the real plant: robots
// replace workers as automation rises, each bay's floor shows its load, the bottleneck pulses, cars move down the line
// while it is producing. Bays are clickable; the screen also offers real buttons for keyboard use.
import { memo, useMemo } from 'react';
import { add, batch, camera, cross, hexRgb, mul, norm, paint, rgbHex, satin, sub, surface, type Facet, type Projector, type RGB, type V3 } from './vector3d';

export type Sector = 'materials' | 'body' | 'paint' | 'powertrain' | 'assembly' | 'inspection' | 'dispatch';
export const SECTORS: Sector[] = ['materials', 'body', 'paint', 'powertrain', 'assembly', 'inspection', 'dispatch'];
export interface SectorLoad { use: number; bottleneck?: boolean; working?: boolean }

const BAY = 4.2, DEPTH = 8, N = 7;
type Mat = { c: RGB; spec?: number; metal?: boolean; alpha?: number };
const M = {
  floor: { c: [58, 66, 78] } as Mat, steel: { c: [150, 158, 168], spec: 0.5, metal: true } as Mat, dark: { c: [44, 50, 58], spec: 0.2 } as Mat,
  press: { c: [52, 82, 118], spec: 0.25 } as Mat, robot: { c: [236, 128, 36], spec: 0.35 } as Mat, wood: { c: [168, 122, 74], spec: 0.05 } as Mat,
  yellow: { c: [238, 182, 46], spec: 0.3 } as Mat, white: { c: [220, 226, 232], spec: 0.3 } as Mat, glass: { c: [150, 205, 235], spec: 0.6, alpha: 0.22 } as Mat,
  rubber: { c: [24, 25, 28], spec: 0.05 } as Mat, light: { c: [235, 250, 255], spec: 0 } as Mat, bare: { c: [178, 186, 194], spec: 0.45 } as Mat,
  coil: { c: [128, 136, 146], spec: 0.7, metal: true } as Mat, crate: { c: [92, 104, 118], spec: 0.1 } as Mat, blue: { c: [56, 120, 196], spec: 0.3 } as Mat,
};
const shadeOf = (m: Mat) => (n: V3, v: V3): RGB => (m.metal ? paint(m.c, n, v, { metal: 0.7, gloss: m.spec }) : satin(m.c, n, v, m.spec ?? 0.15));

interface Solid { facets: Facet[]; depth: number; alpha?: number; bay: number }
function box(cam: Projector, bay: number, c: V3, s: V3, m: Mat): Solid {
  const P = (i: number, j: number, k: number): V3 => [c[0] + i * s[0], c[1] + j * s[1], c[2] + k * s[2]];
  const faces: [V3, V3, V3, V3, V3][] = [
    [P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), [0, 0, 1]], [P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1), [0, -1, 0]],
    [P(-1, 1, -1), P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), [0, 1, 0]], [P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1), [-1, 0, 0]],
    [P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1), [1, 0, 0]],
  ];
  const out: Facet[] = [];
  for (const [a, b, cc, d, n] of faces) {
    const mid = mul(add(add(a, b), add(cc, d)), 0.25), view = norm(sub(mid, cam.eye));
    if (n[0] * view[0] + n[1] * view[1] + n[2] * view[2] > 0) continue;
    const q = [a, b, cc, d].map((p) => cam.project(p));
    out.push({ pts: q.map((p) => [p[0], p[1]] as [number, number]), depth: q.reduce((t, p) => t + p[2], 0) / 4, fill: rgbHex(shadeOf(m)(n, view)) });
  }
  return { facets: out, depth: out.reduce((t, f) => t + f.depth, 0) / Math.max(1, out.length), alpha: m.alpha, bay };
}
function cyl(cam: Projector, bay: number, c: V3, axis: V3, r: number, len: number, m: Mat, seg = 14): Solid {
  const a = norm(axis), t = norm(Math.abs(a[2]) < 0.9 ? cross(a, [0, 0, 1]) : cross(a, [1, 0, 0])), b = cross(a, t);
  const at = (u: number, v: number): V3 => { const g = u * Math.PI * 2; return add(add(c, mul(a, (v - 0.5) * len)), add(mul(t, Math.cos(g) * r), mul(b, Math.sin(g) * r))); };
  const f = surface(cam, seg, 1, at, shadeOf(m), { inside: (p) => add(c, mul(a, (p[0] - c[0]) * a[0] + (p[1] - c[1]) * a[1] + (p[2] - c[2]) * a[2])) });
  for (const sg of [-1, 1]) {
    const cc = add(c, mul(a, sg * len / 2)), n = mul(a, sg), view = norm(sub(cc, cam.eye));
    if (n[0] * view[0] + n[1] * view[1] + n[2] * view[2] > 0) continue;
    const q = Array.from({ length: seg }, (_, i) => cam.project(add(cc, add(mul(t, Math.cos((i / seg) * Math.PI * 2) * r), mul(b, Math.sin((i / seg) * Math.PI * 2) * r)))));
    f.push({ pts: q.map((p) => [p[0], p[1]] as [number, number]), depth: q.reduce((s, p) => s + p[2], 0) / seg - 0.01, fill: rgbHex(shadeOf(m)(n, view)) });
  }
  return { facets: f, depth: f.reduce((t, x) => t + x.depth, 0) / Math.max(1, f.length), bay };
}

/** A car on the line at a given stage: bare shell, painted, with wheels. */
function car(cam: Projector, bay: number, x: number, y: number, z: number, body: Mat, wheels: boolean, out: Solid[]) {
  out.push(box(cam, bay, [x, y, z + 0.42], [0.95, 0.42, 0.22], body), box(cam, bay, [x - 0.08, y, z + 0.86], [0.5, 0.36, 0.22], body));
  out.push(box(cam, bay, [x - 0.08, y - 0.37, z + 0.86], [0.45, 0.005, 0.15], { c: [30, 44, 60], spec: 0.6 }));
  if (wheels) for (const dx of [-0.6, 0.6]) for (const dy of [-0.42, 0.42]) out.push(cyl(cam, bay, [x + dx, y + dy, z + 0.3], [0, 1, 0], 0.27, 0.16, M.rubber, 12));
}
function robot(cam: Projector, bay: number, x: number, y: number, face: number, out: Solid[]) {
  out.push(cyl(cam, bay, [x, y, 0.15], [0, 0, 1], 0.3, 0.3, M.dark, 12), cyl(cam, bay, [x, y, 0.55], [0, 0, 1], 0.18, 0.5, M.robot, 10));
  out.push(box(cam, bay, [x + 0.1, y + face * 0.25, 1.2], [0.14, 0.14, 0.5], M.robot), box(cam, bay, [x + 0.35, y + face * 0.6, 1.62], [0.38, 0.12, 0.1], M.robot));
  out.push(cyl(cam, bay, [x + 0.68, y + face * 0.75, 1.45], [0, 0, 1], 0.05, 0.3, M.steel, 8));
}
function worker(cam: Projector, bay: number, x: number, y: number, vest: RGB, out: Solid[]) {
  // legs, torso in a high-visibility vest, arms, head and hard hat
  out.push(box(cam, bay, [x, y - 0.08, 0.36], [0.07, 0.07, 0.36], { c: [36, 46, 62] }), box(cam, bay, [x, y + 0.08, 0.36], [0.07, 0.07, 0.36], { c: [36, 46, 62] }));
  out.push(box(cam, bay, [x, y, 0.98], [0.13, 0.22, 0.27], { c: vest, spec: 0.2 }), box(cam, bay, [x + 0.05, y - 0.29, 0.92], [0.06, 0.06, 0.24], { c: vest }), box(cam, bay, [x + 0.12, y + 0.29, 1.0], [0.14, 0.06, 0.06], { c: vest }));
  out.push(cyl(cam, bay, [x, y, 1.38], [0, 0, 1], 0.11, 0.2, { c: [232, 196, 160] }, 10), cyl(cam, bay, [x, y, 1.5], [0, 0, 1], 0.14, 0.07, M.yellow, 10));
}

function buildPlant(load: Record<Sector, SectorLoad>, automation: number, color: string) {
  const cam = camera({ eye: [BAY * N / 2, -21, 15.5], target: [BAY * N / 2, DEPTH / 2, 0.6], focal: 520, cx: 0, cy: 0 });
  const paintM: Mat = { c: hexRgb(/^#[0-9a-f]{6}$/i.test(color) ? color : '#c8352e'), spec: 0.8, metal: true };
  const robots = automation >= 0.75 ? 2 : automation >= 0.4 ? 1 : 0, workers = Math.max(1, 3 - robots);
  const S: Solid[] = [];
  const lineY = 3.4;
  // conveyor through bays 2–6
  S.push(box(cam, -1, [BAY * 3.5, lineY, 0.12], [BAY * 2.55, 0.65, 0.12], M.dark));
  SECTORS.forEach((sec, i) => {
    const x0 = i * BAY, cx = x0 + BAY / 2;
    if (sec === 'materials') {
      for (const [dx, dy, dz] of [[-1, 1.6, 0.55], [0.2, 1.6, 0.55], [-0.4, 1.6, 1.5], [1.2, 1.6, 0.55]] as const) S.push(cyl(cam, i, [cx + dx, dy, dz], [0, 1, 0], 0.52, 0.9, M.coil, 16), cyl(cam, i, [cx + dx, dy - 0.46, dz], [0, 1, 0], 0.2, 0.02, M.dark, 10));
      for (const [dx, dy, h] of [[-1, 5.6, 0.7], [0.4, 5.6, 1.1], [-1, 6.9, 0.4], [0.4, 6.9, 0.9]] as const) S.push(box(cam, i, [cx + dx, dy, 0.1], [0.6, 0.55, 0.1], M.wood), box(cam, i, [cx + dx, dy, 0.2 + h / 2], [0.55, 0.5, h / 2], M.crate));
      S.push(box(cam, i, [cx + 1.3, 3.8, 0.5], [0.5, 0.35, 0.35], M.yellow), box(cam, i, [cx + 1.1, 3.8, 1.05], [0.25, 0.32, 0.25], { c: [30, 40, 52], spec: 0.5 }), box(cam, i, [cx + 1.85, 3.8, 0.9], [0.04, 0.3, 0.8], M.dark));
    }
    if (sec === 'body') {
      S.push(box(cam, i, [cx - 0.9, 6.3, 1.9], [0.9, 0.9, 1.9], M.press), box(cam, i, [cx - 0.9, 6.3, 4.0], [1.1, 1.1, 0.25], M.press), box(cam, i, [cx - 0.9, 6.3, 0.6], [0.7, 0.7, 0.3], M.steel));
      car(cam, i, cx + 0.3, lineY, 0.24, M.bare, false, S);
      for (let k = 0; k < robots + 1; k++) if (robots) robot(cam, i, cx - 0.6 + k * 1.6, lineY - 1.7, 1, S);
      for (let k = 0; k < (robots ? 0 : workers); k++) worker(cam, i, cx - 0.8 + k * 1.1, lineY - 1.4, [238, 182, 46], S);
    }
    if (sec === 'paint') {
      car(cam, i, cx, lineY, 0.24, paintM, false, S);
      for (let k = 0; k < Math.max(1, robots); k++) robot(cam, i, cx - 1 + k * 1.8, lineY + 1.5, -1, S);
      S.push(cyl(cam, i, [cx, lineY, 3.4], [1, 0, 0], 0.3, BAY - 0.6, M.steel, 12));
      S.push(box(cam, i, [cx, lineY, 1.6], [BAY / 2 - 0.25, 1.9, 1.6], M.glass));                      // glass booth (translucent)
    }
    if (sec === 'powertrain') {
      for (const [dx, dy] of [[-1.2, 6.2], [0, 6.2], [1.2, 6.2]] as const) S.push(box(cam, i, [cx + dx, dy, 0.4], [0.12, 0.12, 0.4], M.dark), box(cam, i, [cx + dx, dy, 1.0], [0.42, 0.3, 0.28], M.bare), box(cam, i, [cx + dx, dy, 1.36], [0.4, 0.22, 0.08], { c: [178, 36, 30], spec: 0.35 }));
      S.push(box(cam, i, [cx, lineY + 1.2, 3.5], [BAY / 2 - 0.1, 0.12, 0.12], M.yellow), box(cam, i, [cx + 0.3, lineY, 2.6], [0.03, 0.03, 0.8], M.steel), box(cam, i, [cx + 0.3, lineY, 1.75], [0.4, 0.28, 0.25], M.bare));
      car(cam, i, cx - 0.4, lineY, 0.24, paintM, false, S);
      for (let k = 0; k < workers; k++) worker(cam, i, cx - 1.2 + k * 1.1, lineY - 1.5, [76, 195, 255], S);
    }
    if (sec === 'assembly') {
      car(cam, i, cx, lineY, 0.24, paintM, true, S);
      for (const [dx, dy] of [[-1.3, 6.4], [-0.5, 6.4]] as const) for (let k = 0; k < 4; k++) S.push(cyl(cam, i, [cx + dx, dy, 0.12 + k * 0.24], [0, 0, 1], 0.32, 0.22, M.rubber, 12));
      for (let k = 0; k < workers + 1; k++) worker(cam, i, cx - 1.3 + k * 1.1, lineY - 1.4, [34, 197, 94], S);
      if (robots > 1) robot(cam, i, cx + 1.2, lineY + 1.6, -1, S);
    }
    if (sec === 'inspection') {
      for (const dx of [-1.1, 1.1]) S.push(box(cam, i, [cx + dx, lineY - 1.35, 1.4], [0.1, 0.1, 1.4], M.white), box(cam, i, [cx + dx, lineY + 1.35, 1.4], [0.1, 0.1, 1.4], M.white), box(cam, i, [cx + dx, lineY, 2.85], [0.1, 1.45, 0.1], M.white));
      for (let k = 0; k < 5; k++) S.push(box(cam, i, [cx - 0.8 + k * 0.4, lineY, 2.7], [0.06, 1.3, 0.03], M.light));
      for (const dx of [-0.6, 0.6]) S.push(cyl(cam, i, [cx + dx, lineY, 0.2], [0, 1, 0], 0.16, 1.1, M.steel, 10));
      car(cam, i, cx, lineY, 0.3, paintM, true, S);
      worker(cam, i, cx + 1.4, lineY - 1.6, [167, 139, 250], S);
    }
    if (sec === 'dispatch') {
      S.push(box(cam, i, [cx, 6.3, 0.55], [1.9, 0.75, 0.12], M.steel), box(cam, i, [cx - 2.0, 6.3, 0.9], [0.45, 0.75, 0.7], M.white), box(cam, i, [cx - 2.0, 5.53, 1.1], [0.36, 0.01, 0.3], { c: [30, 44, 60], spec: 0.6 }));
      for (const dx of [-1.4, 0.2, 1.5]) S.push(cyl(cam, i, [cx + dx, 6.3, 0.35], [0, 1, 0], 0.3, 1.6, M.rubber, 12));
      car(cam, i, cx - 0.7, 6.3, 0.67, paintM, true, S); car(cam, i, cx + 1.1, 6.3, 0.67, paintM, true, S);
      car(cam, i, cx, lineY - 0.2, 0.0, paintM, true, S);
    }
  });
  S.sort((a, b) => b.depth - a.depth);
  // fixed geometry: floor tiles per bay, the back wall with windows, roof trusses
  const P = (p: V3) => { const q = cam.project(p); return `${q[0].toFixed(1)},${q[1].toFixed(1)}`; };
  const quad = (a: V3, b: V3, c: V3, d: V3) => [a, b, c, d].map(P).join(' ');
  const bays = SECTORS.map((sec, i) => {
    const x0 = i * BAY + 0.08, x1 = (i + 1) * BAY - 0.08;
    return {
      sec, floor: quad([x0, 0, 0], [x1, 0, 0], [x1, DEPTH, 0], [x0, DEPTH, 0]),
      glow: quad([x0 + 0.25, 0.25, 0.01], [x1 - 0.25, 0.25, 0.01], [x1 - 0.25, DEPTH - 0.25, 0.01], [x0 + 0.25, DEPTH - 0.25, 0.01]),
      wall: quad([x0, DEPTH, 0], [x1, DEPTH, 0], [x1, DEPTH, 5.2], [x0, DEPTH, 5.2]),
      win: quad([x0 + 0.5, DEPTH - 0.01, 3.2], [x1 - 0.5, DEPTH - 0.01, 3.2], [x1 - 0.5, DEPTH - 0.01, 4.6], [x0 + 0.5, DEPTH - 0.01, 4.6]),
      label: cam.project([(x0 + x1) / 2, -0.9, 0]), hit: quad([x0, -1.6, 0], [x1, -1.6, 0], [x1, DEPTH, 5.2], [x0, DEPTH, 5.2]),
    };
  });
  const flow = [cam.project([BAY * 1.2, lineY, 0.3]), cam.project([BAY * 5.8, lineY, 0.3])];
  const lamps = Array.from({ length: N }, (_, i) => { const q = cam.project([i * BAY + BAY / 2, DEPTH - 0.4, 5.0]); return [q[0], q[1]] as [number, number]; });
  // fit
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const fit = (p: [number, number, number] | [number, number]) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); };
  for (const p of [[0, -0.9, 0], [BAY * N, -0.9, 0], [0, DEPTH, 5.4], [BAY * N, DEPTH, 5.4]] as V3[]) fit(cam.project(p));
  const lab = (x1 - x0) / 1120 * 44;                                                          // room for the labels under the floor
  const vb = [x0 - 6, y0 - 6, x1 - x0 + 12, y1 - y0 + 12 + lab];
  return { solids: S.map((s) => ({ paths: batch(s.facets), alpha: s.alpha, bay: s.bay })), bays, flow, lamps, vb };
}

export const FactoryLine2D = memo(function FactoryLine2D({ load, automation, color, active, onPick, labels }: { load: Record<Sector, SectorLoad>; automation: number; color: string; active: Sector; onPick: (s: Sector) => void; labels: Record<Sector, string> }) {
  const loadKey = SECTORS.map((s) => `${Math.round(load[s].use * 20)}${load[s].bottleneck ? 'b' : ''}`).join('|');
  const art = useMemo(() => buildPlant(load, automation, color), [loadKey, Math.round(automation * 10), color]);  // eslint-disable-line react-hooks/exhaustive-deps
  const producing = SECTORS.some((s) => load[s].working);
  const [vx, vy, vw, vh] = art.vb, u = vw / 1120;
  return (
    <div className="fl2d">
      <svg viewBox={`${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`} role="group" aria-label="Plant">
        <defs>
          <linearGradient id="fl-wallg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22334a" /><stop offset="1" stopColor="#141f2e" /></linearGradient>
        </defs>
        <rect x={vx} y={vy} width={vw} height={vh} fill="#0d1520" />
        {/* building shell: back wall with windows, floor tiles whose glow shows each sector's load */}
        {art.bays.map((b) => <g key={'w' + b.sec}><polygon points={b.wall} fill="url(#fl-wallg)" /><polygon points={b.win} fill="#7fb6e0" opacity="0.28" /></g>)}
        {art.lamps.map(([x, y], i) => <g key={'lp' + i}><rect x={x - 22 * u} y={y - 2 * u} width={44 * u} height={4 * u} rx={2 * u} fill="#eaf6ff" opacity="0.8" /><ellipse cx={x} cy={y + 8 * u} rx={40 * u} ry={10 * u} fill="#eaf6ff" opacity="0.06" /></g>)}
        {art.bays.map((b, i) => {
          const L = load[b.sec], tone = L.bottleneck ? '#ef4444' : L.use > 0.9 ? '#f59e0b' : L.use > 0.05 ? '#22c55e' : '#64748b';
          return <g key={'f' + b.sec}>
            <polygon points={b.floor} fill={i % 2 ? '#3a4352' : '#353e4c'} />
            <polygon points={b.glow} fill={tone} opacity={0.06 + Math.min(1, L.use) * 0.16} stroke={tone} strokeOpacity={active === b.sec ? 0.9 : 0.35} strokeWidth={(active === b.sec ? 2.4 : 1.2) * u} className={L.bottleneck ? 'fl-bottleneck-floor' : undefined} />
          </g>;
        })}
        {/* machinery, painted back to front */}
        <g strokeWidth={0.5 * u} strokeLinejoin="round">
          {art.solids.map((s, i) => <g key={i} opacity={s.alpha ?? 1} className={s.alpha ? 'fl-glass' : undefined}>{s.paths.map((p, k) => <path key={k} d={p.d} fill={p.fill} stroke={s.alpha ? '#cfe8f6' : p.fill} strokeOpacity={s.alpha ? 0.6 : 1} />)}</g>)}
        </g>
        {producing && <g className="fl-flow-dots">{[0, 1, 2, 3].map((k) => <circle key={k} r={3.5 * u} fill="#9fd6e5"><animateMotion dur="6s" begin={`${-k * 1.5}s`} repeatCount="indefinite" path={`M${art.flow[0][0]} ${art.flow[0][1]}L${art.flow[1][0]} ${art.flow[1][1]}`} /></circle>)}</g>}
        {/* labels and hit areas */}
        {art.bays.map((b) => {
          const L = load[b.sec], tone = L.bottleneck ? '#ef4444' : L.use > 0.9 ? '#f59e0b' : L.use > 0.05 ? '#22c55e' : '#64748b';
          const [lx, ly] = b.label;
          return <g key={'l' + b.sec} className={'fl-sector' + (active === b.sec ? ' on' : '') + (L.bottleneck ? ' fl-bottleneck' : '')} onClick={() => onPick(b.sec)}>
            <polygon points={b.hit} fill="#fff" opacity="0" />
            <rect x={lx - 62 * u} y={ly - 4 * u} width={124 * u} height={40 * u} rx={8 * u} fill="#0d1520" stroke={active === b.sec ? '#e8b04a' : '#2b3a4f'} strokeWidth={1.4 * u} />
            <text x={lx} y={ly + 13 * u} textAnchor="middle" fontSize={12 * u} fontWeight="700" fill="#e8eef6" fontFamily="system-ui, sans-serif">{labels[b.sec]}</text>
            <text x={lx} y={ly + 29 * u} textAnchor="middle" fontSize={11 * u} fill={tone} fontFamily="system-ui, sans-serif">{Math.round(L.use * 100)}%{L.bottleneck ? ' ▲' : ''}</text>
          </g>;
        })}
      </svg>
    </div>
  );
});
