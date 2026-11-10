// Procedural 3D cars. Nothing here is a stored model: every mesh is generated from the
// engineering specification (body type, dimensions, engine position, wheels, aero, colour),
// so the car on screen always reflects the design in the simulation.
import { useMemo } from 'react';
import * as THREE from 'three';
import type { BodyType, Discipline, VehicleSpec } from '../sim/types';
import { CYL, defaultVehicle, dims } from '../sim/engineering';

const sm = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface Station { x: number; yb: number; yt: number; w: number; wTop?: number; n?: number }
/** Loft a closed skin through super-elliptic cross-sections placed along the car's x axis. */
export function loft(st: Station[], M = 22, capFront = true, capRear = true): THREE.BufferGeometry {
  const N = st.length;
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i < N; i++) {
    const s = st[i], ex = 2 / (s.n ?? 4), h = s.yt - s.yb, ym = (s.yt + s.yb) / 2;
    for (let j = 0; j < M; j++) {
      const th = (j / M) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
      const px = Math.sign(c) * Math.pow(Math.abs(c), ex), py = Math.sign(sn) * Math.pow(Math.abs(sn), ex);
      const wy = lerp(s.w, s.wTop ?? s.w, (py + 1) / 2);
      pos.push(s.x, ym + (py * h) / 2, px * wy);
    }
  }
  for (let i = 0; i < N - 1; i++) for (let j = 0; j < M; j++) {
    const a = i * M + j, b = i * M + ((j + 1) % M), c = (i + 1) * M + j, d = (i + 1) * M + ((j + 1) % M);
    idx.push(a, b, c, b, d, c);
  }
  const cap = (i: number, front: boolean) => {
    const s = st[i], ci = pos.length / 3;
    pos.push(s.x, (s.yt + s.yb) / 2, 0);
    for (let j = 0; j < M; j++) { const a = i * M + j, b = i * M + ((j + 1) % M); if (front) idx.push(ci, b, a); else idx.push(ci, a, b); }
  };
  if (capFront) cap(0, true);
  if (capRear) cap(N - 1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

interface Prof { xA: number; xB: number; xC: number; xD: number; nose: number; cowl: number; belt: number; deck: number; tail: number; open?: boolean }
const PROF: Record<BodyType, Prof> = {
  sedan: { xA: 0.28, xB: 0.4, xC: 0.7, xD: 0.83, nose: 0.5, cowl: 0.63, belt: 0.65, deck: 0.63, tail: 0.57 },
  hatch: { xA: 0.26, xB: 0.38, xC: 0.84, xD: 0.97, nose: 0.5, cowl: 0.62, belt: 0.64, deck: 0.64, tail: 0.6 },
  wagon: { xA: 0.26, xB: 0.37, xC: 0.92, xD: 0.99, nose: 0.5, cowl: 0.6, belt: 0.62, deck: 0.62, tail: 0.6 },
  coupe: { xA: 0.32, xB: 0.46, xC: 0.66, xD: 0.9, nose: 0.5, cowl: 0.64, belt: 0.66, deck: 0.62, tail: 0.52 },
  roadster: { xA: 0.38, xB: 0.46, xC: 0.5, xD: 0.6, nose: 0.52, cowl: 0.68, belt: 0.7, deck: 0.68, tail: 0.58, open: true },
  supercar: { xA: 0.27, xB: 0.43, xC: 0.6, xD: 0.86, nose: 0.36, cowl: 0.58, belt: 0.62, deck: 0.64, tail: 0.6 },
  suv: { xA: 0.25, xB: 0.34, xC: 0.9, xD: 0.985, nose: 0.55, cowl: 0.62, belt: 0.62, deck: 0.62, tail: 0.6 },
  pickup: { xA: 0.27, xB: 0.35, xC: 0.52, xD: 0.57, nose: 0.56, cowl: 0.62, belt: 0.62, deck: 0.5, tail: 0.5 },
};

export interface CarGeo {
  body: THREE.BufferGeometry; glass: THREE.BufferGeometry | null; roof: THREE.BufferGeometry | null;
  L: number; W: number; H: number; clearance: number; tireR: number; tireW: number; axF: number; axR: number; track: number;
  topAt: (u: number) => number; halfW: (u: number) => number; prof: Prof; xOf: (u: number) => number;
}
const geoCache = new Map<string, CarGeo>();

export function buildRoadCar(s: VehicleSpec): CarGeo {
  const key = [s.body, s.size.toFixed(2), s.sport.toFixed(1), s.enginePos, s.tireWidth, s.engine.layout === 'EV'].join('|');
  const hit = geoCache.get(key);
  if (hit) return hit;
  const d = dims(s);
  const L = d.length, W = d.width, H = d.height;
  const p = { ...PROF[s.body] };
  if (s.body !== 'supercar' && s.enginePos !== 'front') { p.xA -= 0.05; p.xB -= 0.05; p.xC -= 0.04; p.nose -= 0.04; } // cab-forward when the engine sits behind
  const xOf = (u: number) => (0.5 - u) * L;
  const keys: [number, number][] = [[0, p.nose * 0.84], [0.05, p.nose], [p.xA, p.cowl], [(p.xA + p.xD) / 2, p.belt], [p.xD, p.deck], [0.96, p.tail], [1, p.tail * 0.9]];
  const topAt = (u: number) => {
    for (let i = 1; i < keys.length; i++) if (u <= keys[i][0]) { const [u0, y0] = keys[i - 1], [u1, y1] = keys[i]; return H * lerp(y0, y1, sm((u - u0) / (u1 - u0))); }
    return H * keys[keys.length - 1][1];
  };
  const halfW = (u: number) => (W / 2) * (1 - 0.2 * (1 - sm(u / 0.13)) - 0.13 * (1 - sm((1 - u) / 0.11)));
  // fenders: the body is never lower than the top of the tyres around each axle
  const uF = s.enginePos === 'front' ? 0.18 : 0.165, uR = uF + d.wheelbase / L;
  const baseTop = topAt;
  const fender = (u: number) => Math.max(0, 2 * d.tireR + 0.07 - baseTop(u)) * Math.max(Math.exp(-Math.pow((u - uF) / 0.075, 2)), Math.exp(-Math.pow((u - uR) / 0.075, 2)));
  const topB = (u: number) => baseTop(u) + fender(u);
  const bottom = (u: number) => d.clearance + 0.1 * H * (1 - sm(u / 0.09)) + 0.13 * H * (1 - sm((1 - u) / 0.11));
  const N = 54, body: Station[] = [];
  for (let i = 0; i < N; i++) { const u = i / (N - 1); body.push({ x: xOf(u), yb: bottom(u), yt: topB(u), w: halfW(u), wTop: halfW(u) * 0.93, n: 4.5 }); }
  const bodyG = loft(body, 24);
  let glass: THREE.BufferGeometry | null = null, roof: THREE.BufferGeometry | null = null;
  const g = (u: number) => (u < p.xB ? sm((u - p.xA) / (p.xB - p.xA)) : u <= p.xC ? 1 : 1 - sm((u - p.xC) / (p.xD - p.xC)));
  if (!p.open) {
    const gs: Station[] = [];
    const n2 = 34;
    for (let i = 0; i < n2; i++) {
      const u = lerp(p.xA + 0.004, p.xD - 0.004, i / (n2 - 1));
      const k = g(u), belt = topAt(u) - 0.03;
      gs.push({ x: xOf(u), yb: belt, yt: belt + 0.03 + (H - topAt(u)) * k, w: halfW(u) * 0.93, wTop: halfW(u) * lerp(0.93, 0.74, k), n: 3.2 });
    }
    glass = loft(gs, 20);
    const rs: Station[] = [];
    const u0 = p.xB - 0.012, u1 = p.xC + 0.012;
    for (let i = 0; i < 14; i++) { const u = lerp(u0, u1, i / 13), e = Math.min(1, Math.min(i, 13 - i) / 1.5); rs.push({ x: xOf(u), yb: H - 0.05 - 0.02 * (1 - e), yt: H + 0.008 * e - 0.02 * (1 - e), w: halfW(u) * 0.77, wTop: halfW(u) * 0.7, n: 3 }); }
    roof = loft(rs, 16);
  }
  const front = s.enginePos === 'front' ? 0.18 : 0.165;
  const axF = xOf(front), axR = xOf(front) - d.wheelbase;
  const geo: CarGeo = { body: bodyG, glass, roof, L, W, H, clearance: d.clearance, tireR: d.tireR, tireW: Math.max(0.12, s.tireWidth / 1000), axF, axR, track: d.track, topAt, halfW, prof: p, xOf };
  if (geoCache.size > 60) geoCache.clear();
  geoCache.set(key, geo);
  return geo;
}

const TIRE_MAT = new THREE.MeshStandardMaterial({ color: '#0d0d0f', roughness: 0.92, metalness: 0 });
const RIM_MAT = new THREE.MeshStandardMaterial({ color: '#b9bcc2', roughness: 0.35, metalness: 0.85 });
const DARK_MAT = new THREE.MeshStandardMaterial({ color: '#08090a', roughness: 0.8 });
const TRIM_MAT = new THREE.MeshStandardMaterial({ color: '#17181b', roughness: 0.6, metalness: 0.3 });
const HEAD_MAT = new THREE.MeshStandardMaterial({ color: '#fff7dd', emissive: '#fff1c0', emissiveIntensity: 0.9, roughness: 0.2 });
const TAIL_MAT = new THREE.MeshStandardMaterial({ color: '#c01818', emissive: '#a00808', emissiveIntensity: 0.9, roughness: 0.3 });
const GLASS_MAT = new THREE.MeshPhysicalMaterial({ color: '#0b1016', roughness: 0.06, metalness: 0.4, clearcoat: 1, transparent: true, opacity: 0.9 });
const CHROME_MAT = new THREE.MeshStandardMaterial({ color: '#d8dade', roughness: 0.18, metalness: 1 });

export function Wheel({ x, z, r, w, rim = 0.62, spokes = 5 }: { x: number; z: number; r: number; w: number; rim?: number; spokes?: number }) {
  const side = Math.sign(z) || 1;
  return (
    <group position={[x, r, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={TIRE_MAT} castShadow><cylinderGeometry args={[r, r, w, 28]} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, side * (w / 2 - 0.004)]} material={RIM_MAT}><cylinderGeometry args={[r * rim, r * rim, 0.02, 24]} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, side * (w / 2 + 0.004)]} material={DARK_MAT}><cylinderGeometry args={[r * rim * 0.22, r * rim * 0.22, 0.03, 12]} /></mesh>
      {Array.from({ length: spokes }, (_, i) => (
        <mesh key={i} rotation={[0, 0, (i / spokes) * Math.PI * 2]} position={[0, 0, side * (w / 2 + 0.007)]} material={TRIM_MAT}><boxGeometry args={[r * rim * 1.9, r * 0.09, 0.012]} /></mesh>
      ))}
    </group>
  );
}

export function usePaint(color: string) {
  return useMemo(() => new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 }), [color]);
}

/** A road car generated from its engineering specification. */
export function RoadCar({ spec, number }: { spec: VehicleSpec; number?: number }) {
  const geo = useMemo(() => buildRoadCar(spec), [spec.body, spec.size, spec.sport, spec.enginePos, spec.tireWidth, spec.engine.layout]);
  const paint = usePaint(spec.color);
  const { L, W, H, tireR, tireW, axF, axR, track, topAt, halfW, prof, xOf } = geo;
  const ev = spec.engine.layout === 'EV';
  const cyl = CYL[spec.engine.layout];
  const pipes = ev ? 0 : cyl <= 4 ? 1 : cyl <= 6 ? 2 : 4;
  const zW = track / 2 + 0.02;
  const noseY = topAt(0.02), tailY = topAt(0.985);
  const rimK = Math.min(0.8, (spec.wheelDia * 0.0127) / tireR);
  const wingW = W * 0.86, wingH = topAt(0.95) + 0.1 + spec.wing * 0.28;
  return (
    <group>
      <mesh geometry={geo.body} material={paint} castShadow />
      {geo.glass && <mesh geometry={geo.glass} material={GLASS_MAT} />}
      {geo.roof && <mesh geometry={geo.roof} material={paint} castShadow />}
      {/* wheel arches: dark discs flush with the flanks */}
      {[axF, axR].map((x, i) => <mesh key={i} position={[x, tireR, 0]} rotation={[Math.PI / 2, 0, 0]} material={DARK_MAT}><cylinderGeometry args={[tireR * 1.12, tireR * 1.12, halfW(0.5 - x / L) * 2 + 0.012, 28]} /></mesh>)}
      {[axF, axR].map((x) => [1, -1].map((sd) => <Wheel key={`${x}${sd}`} x={x} z={sd * (zW - tireW / 2 + 0.02)} r={tireR} w={tireW} rim={rimK} />))}
      {/* lights */}
      {[1, -1].map((sd) => <mesh key={'h' + sd} position={[xOf(0.012), noseY * 0.9, sd * halfW(0.03) * 0.72]} material={HEAD_MAT}><boxGeometry args={[0.06, H * 0.055, W * 0.17]} /></mesh>)}
      {[1, -1].map((sd) => <mesh key={'t' + sd} position={[xOf(0.992), tailY * 0.93, sd * halfW(0.97) * 0.72]} material={TAIL_MAT}><boxGeometry args={[0.05, H * 0.05, W * 0.2]} /></mesh>)}
      {/* grille / intake */}
      {!ev && spec.enginePos === 'front' && <mesh position={[xOf(0.004), noseY * 0.62, 0]} material={DARK_MAT}><boxGeometry args={[0.05, H * 0.13, W * 0.42]} /></mesh>}
      {spec.enginePos !== 'front' && !ev && [1, -1].map((sd) => <mesh key={'i' + sd} position={[xOf(spec.enginePos === 'mid' ? 0.62 : 0.78), topAt(0.6) * 0.72, sd * (halfW(0.62) - 0.01)]} material={DARK_MAT}><boxGeometry args={[L * 0.09, H * 0.13, 0.05]} /></mesh>)}
      {(spec.engine.aspiration !== 'na' || cyl >= 8) && spec.enginePos === 'front' && !ev && <mesh position={[xOf(0.15), topAt(0.15) + 0.012, 0]} material={paint}><boxGeometry args={[L * 0.12, 0.05, W * 0.2]} /></mesh>}
      {/* mirrors */}
      {[1, -1].map((sd) => <mesh key={'m' + sd} position={[xOf(prof.xA + 0.03), topAt(prof.xA) + 0.07, sd * (halfW(prof.xA) + 0.07)]} material={paint}><boxGeometry args={[0.1, 0.07, 0.16]} /></mesh>)}
      {/* exhausts */}
      {Array.from({ length: pipes }, (_, i) => {
        const z = pipes === 1 ? W * 0.22 : (i - (pipes - 1) / 2) * (pipes === 4 ? W * 0.16 : W * 0.44) + (pipes === 4 ? Math.sign(i - 1.5) * W * 0.13 : 0);
        return <mesh key={'e' + i} position={[xOf(1) - 0.02, geo.clearance + 0.07, z]} rotation={[0, 0, Math.PI / 2]} material={CHROME_MAT}><cylinderGeometry args={[0.035, 0.035, 0.12, 12]} /></mesh>;
      })}
      {/* aero */}
      {spec.wing > 0.05 && <group>
        <mesh position={[xOf(0.95), wingH, 0]} rotation={[0, 0, -0.12 - spec.wing * 0.25]} material={spec.panels === 'carbon' ? TRIM_MAT : paint} castShadow><boxGeometry args={[0.16 + 0.2 * spec.wing, 0.022, wingW]} /></mesh>
        {[1, -1].map((sd) => <mesh key={sd} position={[xOf(0.945), (wingH + topAt(0.95)) / 2, sd * wingW * 0.36]} material={TRIM_MAT}><boxGeometry args={[0.07, wingH - topAt(0.95), 0.02]} /></mesh>)}
      </group>}
      {spec.splitter > 0.05 && <mesh position={[xOf(0) + 0.02 + 0.06 * spec.splitter, geo.clearance + 0.012, 0]} material={TRIM_MAT}><boxGeometry args={[0.25, 0.02, W * 0.86]} /></mesh>}
      {spec.flatFloor && <mesh position={[xOf(1) + 0.08, geo.clearance + 0.06, 0]} rotation={[0, 0, 0.3]} material={TRIM_MAT}><boxGeometry args={[0.3, 0.02, W * 0.7]} /></mesh>}
      {/* open cars: windscreen and seats; pickups: load bed */}
      {prof.open && <group>
        <mesh position={[xOf(prof.xA + 0.035), topAt(prof.xA) + 0.14, 0]} rotation={[0, 0, 0.55]} material={GLASS_MAT}><boxGeometry args={[0.03, 0.34, W * 0.78]} /></mesh>
        <mesh position={[xOf(0.52), topAt(0.5) + 0.006, 0]} material={DARK_MAT}><boxGeometry args={[L * 0.2, 0.02, W * 0.66]} /></mesh>
        {[1, -1].map((sd) => <mesh key={sd} position={[xOf(0.6), topAt(0.6) + 0.07, sd * W * 0.2]} material={TRIM_MAT}><boxGeometry args={[0.1, 0.2, W * 0.22]} /></mesh>)}
      </group>}
      {spec.body === 'pickup' && <mesh position={[xOf(0.79), topAt(0.8) + 0.004, 0]} material={DARK_MAT}><boxGeometry args={[L * 0.36, 0.02, W * 0.74]} /></mesh>}
      {number !== undefined && [1, -1].map((sd) => <mesh key={'n' + sd} position={[xOf(0.48), topAt(0.5) * 0.62, sd * (halfW(0.5) + 0.004)]} rotation={[0, sd > 0 ? 0 : Math.PI, 0]}><circleGeometry args={[H * 0.14, 20]} /><meshStandardMaterial color="#f4f4f4" roughness={0.6} /></mesh>)}
    </group>
  );
}

// -------------------------------------------------------------------------------- race cars

export function raceRoadSpec(discipline: Discipline, year: number, color: string, wing: number): VehicleSpec {
  const s = defaultVehicle(year, discipline === 'touring' ? 'sedan' : year >= 1990 ? 'supercar' : 'coupe');
  s.color = color; s.sport = 1; s.size = discipline === 'touring' ? 0.97 : 1.02;
  s.tireWidth = discipline === 'touring' ? 245 : 305; s.wheelDia = 18; s.enginePos = 'front';
  s.wing = year >= 1970 ? 0.35 + 0.65 * wing : 0; s.splitter = year >= 1972 ? 0.8 : 0; s.flatFloor = year >= 1990; s.panels = 'carbon';
  s.engine.layout = 'V8';
  return s;
}

function OpenWheel({ year, color, color2, wing }: { year: number; color: string; color2: string; wing: number }) {
  const paint = usePaint(color), paint2 = usePaint(color2);
  const cigar = year < 1968, front = year < 1960, modern = year >= 1996, big = year >= 2017;
  const L = front ? 4.0 : cigar ? 3.9 : big ? 5.5 : modern ? 4.7 : 4.4;
  const wb = L * (cigar ? 0.6 : 0.64);
  const rF = cigar ? 0.34 : 0.33, rR = cigar ? 0.35 : big ? 0.36 : 0.34;
  const wF = cigar ? 0.14 : big ? 0.31 : 0.26, wR = cigar ? 0.17 : year < 1993 ? 0.45 : big ? 0.4 : 0.36;
  const track = cigar ? 1.3 : big ? 1.62 : 1.5;
  const xF = L * 0.5 - (cigar ? 0.55 : modern ? 1.05 : 0.8), xR = xF - wb;
  const body = useMemo(() => {
    const st: Station[] = [];
    const N = 30;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1), x = (0.5 - u) * L;
      let w: number, yt: number, yb: number;
      if (cigar) {
        const k = Math.sin(Math.PI * Math.pow(u, front ? 0.75 : 0.6));
        w = 0.1 + 0.3 * k; yt = 0.36 + 0.3 * k; yb = 0.36 - 0.2 * k;
      } else {
        const nose = sm(u / 0.34), tailTaper = 1 - 0.55 * sm((u - 0.62) / 0.38);
        w = (0.09 + 0.2 * nose) * tailTaper + 0.03;
        yb = modern ? lerp(0.3, 0.07, sm(u / 0.3)) : 0.09;
        yt = lerp(modern ? 0.42 : 0.24, 0.56, sm(u / 0.38)) * (1 - 0.4 * sm((u - 0.72) / 0.28)) + (u > 0.42 && u < 0.72 && year >= 1971 ? 0.3 * Math.sin(Math.PI * ((u - 0.42) / 0.3)) : 0);
      }
      st.push({ x, yb, yt, w, wTop: w * 0.75, n: cigar ? 2.2 : 3 });
    }
    return loft(st, 16);
  }, [L, cigar, front, modern, year]);
  const pods = year >= 1970;
  const podL = wb * 0.52;
  const cockpitX = front ? -L * 0.12 : cigar ? L * 0.05 : (xF + xR) / 2 + wb * 0.12;
  const rwW = big ? 1.0 : year >= 2009 ? 0.78 : 1.0, rwH = big ? 0.82 : year >= 2009 ? 0.95 : 0.85;
  return (
    <group>
      <mesh geometry={body} material={paint} castShadow />
      {pods && [1, -1].map((sd) => <mesh key={sd} position={[(xF + xR) / 2 - wb * 0.08, 0.26, sd * (track / 2 - 0.3)]} material={paint} castShadow><boxGeometry args={[podL, 0.34, 0.42]} /></mesh>)}
      {pods && <mesh position={[(xF + xR) / 2 - wb * 0.08, 0.075, 0]} material={TRIM_MAT}><boxGeometry args={[podL * 1.5, 0.03, track * 0.86]} /></mesh>}
      <mesh position={[cockpitX, cigar ? 0.72 : 0.62, 0]}><sphereGeometry args={[0.13, 14, 10]} /><meshStandardMaterial color={color2} roughness={0.35} /></mesh>
      {cigar && <mesh position={[cockpitX + 0.28, 0.7, 0]} rotation={[0, 0, 0.5]} material={GLASS_MAT}><boxGeometry args={[0.02, 0.16, 0.42]} /></mesh>}
      {year >= 2018 && <mesh position={[cockpitX + 0.12, 0.7, 0]} rotation={[Math.PI / 2, 0, 0]} material={TRIM_MAT}><torusGeometry args={[0.3, 0.025, 8, 20, Math.PI]} /></mesh>}
      {year >= 2018 && <mesh position={[cockpitX + 0.42, 0.62, 0]} material={TRIM_MAT}><boxGeometry args={[0.04, 0.2, 0.04]} /></mesh>}
      {!cigar && <group>
        <mesh position={[L / 2 - 0.12, modern ? 0.12 : 0.2, 0]} rotation={[0, 0, -0.08 - 0.12 * wing]} material={paint2} castShadow><boxGeometry args={[0.42, 0.02, big ? 1.95 : 1.4]} /></mesh>
        {[1, -1].map((sd) => <mesh key={sd} position={[L / 2 - 0.12, (modern ? 0.12 : 0.2) + 0.06, sd * (big ? 0.97 : 0.7)]} material={paint}><boxGeometry args={[0.44, 0.16, 0.015]} /></mesh>)}
        <mesh position={[xR - 0.42, rwH, 0]} rotation={[0, 0, -0.1 - 0.35 * wing]} material={paint2} castShadow><boxGeometry args={[0.36, 0.025, rwW]} /></mesh>
        <mesh position={[xR - 0.42, rwH - 0.14, 0]} rotation={[0, 0, -0.06 - 0.2 * wing]} material={paint2}><boxGeometry args={[0.26, 0.02, rwW]} /></mesh>
        {[1, -1].map((sd) => <mesh key={sd} position={[xR - 0.42, rwH - 0.2, sd * rwW * 0.5]} material={paint}><boxGeometry args={[0.5, 0.52, 0.015]} /></mesh>)}
        <mesh position={[xR - 0.36, 0.45, 0]} material={TRIM_MAT}><boxGeometry args={[0.06, 0.6, 0.06]} /></mesh>
      </group>}
      {[1, -1].map((sd) => <group key={sd}>
        <Wheel x={xF} z={sd * (track / 2)} r={rF} w={wF} rim={cigar ? 0.72 : 0.56} spokes={cigar ? 10 : 5} />
        <Wheel x={xR} z={sd * (track / 2)} r={rR} w={wR} rim={cigar ? 0.7 : 0.56} spokes={cigar ? 10 : 5} />
        <mesh position={[xF, rF, sd * track * 0.28]} material={TRIM_MAT}><boxGeometry args={[0.04, 0.03, track * 0.42]} /></mesh>
        <mesh position={[xR, rR, sd * track * 0.28]} material={TRIM_MAT}><boxGeometry args={[0.04, 0.03, track * 0.42]} /></mesh>
      </group>)}
    </group>
  );
}

function Prototype({ year, color, color2, wing }: { year: number; color: string; color2: string; wing: number }) {
  const paint = usePaint(color), paint2 = usePaint(color2);
  const open = year < 1968, L = year >= 1982 ? 4.8 : 4.3, W = year >= 1982 ? 1.96 : 1.8;
  const body = useMemo(() => {
    const st: Station[] = [];
    for (let i = 0; i < 40; i++) {
      const u = i / 39;
      const w = (W / 2) * (1 - 0.22 * (1 - sm(u / 0.14)) - 0.06 * (1 - sm((1 - u) / 0.1)));
      const arch = 0.14 * Math.exp(-Math.pow((u - 0.2) / 0.085, 2)) + 0.16 * Math.exp(-Math.pow((u - 0.8) / 0.09, 2));
      const yt = 0.3 + 0.2 * sm(u / 0.18) + arch * 0.9 + (year >= 1982 ? 0.06 * sm((u - 0.5) / 0.3) : 0);
      st.push({ x: (0.5 - u) * L, yb: 0.06 + 0.1 * (1 - sm(u / 0.06)), yt, w, wTop: w * 0.94, n: 5 });
    }
    return loft(st, 22);
  }, [L, W, year]);
  const cabin = useMemo(() => {
    const st: Station[] = [];
    for (let i = 0; i < 18; i++) { const u = i / 17, k = Math.sin(Math.PI * Math.pow(u, 0.7)); st.push({ x: L * 0.16 - u * L * 0.5, yb: 0.5, yt: 0.52 + 0.5 * k, w: 0.2 + 0.36 * k, wTop: 0.14 + 0.2 * k, n: 2.6 }); }
    return loft(st, 16);
  }, [L]);
  const r = 0.35, xF = L * 0.3, xR = -L * 0.3, hW = 0.95 + 0.1;
  return (
    <group>
      <mesh geometry={body} material={paint} castShadow />
      {!open && <mesh geometry={cabin} material={GLASS_MAT} />}
      {!open && <mesh position={[-L * 0.12, 1.0, 0]} material={paint}><boxGeometry args={[L * 0.3, 0.05, 0.5]} /></mesh>}
      {open && <mesh position={[0.2, 0.62, 0]} rotation={[0, 0, 0.6]} material={GLASS_MAT}><boxGeometry args={[0.02, 0.22, W * 0.7]} /></mesh>}
      {open && <mesh position={[-0.25, 0.72, 0.3]}><sphereGeometry args={[0.13, 12, 8]} /><meshStandardMaterial color={color2} /></mesh>}
      <mesh position={[0, 0.52, 0]} material={paint2}><boxGeometry args={[L * 0.9, 0.012, 0.22]} /></mesh>
      {year >= 2011 && <mesh position={[-L * 0.28, 0.9, 0]} material={paint}><boxGeometry args={[L * 0.34, 0.5, 0.02]} /></mesh>}
      {year >= 1968 && <group>
        <mesh position={[-L / 2 + 0.1, hW, 0]} rotation={[0, 0, -0.08 - 0.3 * wing]} material={paint2} castShadow><boxGeometry args={[0.36, 0.025, W * 0.92]} /></mesh>
        {[1, -1].map((sd) => <mesh key={sd} position={[-L / 2 + 0.14, (hW + 0.55) / 2, sd * W * 0.3]} material={TRIM_MAT}><boxGeometry args={[0.08, hW - 0.5, 0.02]} /></mesh>)}
        {[1, -1].map((sd) => <mesh key={'e' + sd} position={[-L / 2 + 0.1, hW - 0.04, sd * W * 0.46]} material={paint}><boxGeometry args={[0.42, 0.22, 0.015]} /></mesh>)}
      </group>}
      {[1, -1].map((sd) => <mesh key={sd} position={[L / 2 - 0.2, 0.42, sd * W * 0.36]} material={HEAD_MAT}><boxGeometry args={[0.1, 0.07, 0.22]} /></mesh>)}
      {[1, -1].map((sd) => <mesh key={'t' + sd} position={[-L / 2 + 0.02, 0.5, sd * W * 0.38]} material={TAIL_MAT}><boxGeometry args={[0.04, 0.05, 0.2]} /></mesh>)}
      {[xF, xR].map((x) => <mesh key={x} position={[x, r, 0]} rotation={[Math.PI / 2, 0, 0]} material={DARK_MAT}><cylinderGeometry args={[r * 1.12, r * 1.12, W * 0.985, 24]} /></mesh>)}
      {[xF, xR].map((x) => [1, -1].map((sd) => <Wheel key={`${x}${sd}`} x={x} z={sd * (W / 2 - 0.17)} r={r} w={0.32} rim={0.58} />))}
    </group>
  );
}

/** The right body style for a racing discipline and era, in team colours. */
export function RaceCar({ discipline, year, color, color2, wing = 0.5, number }: { discipline: Discipline; year: number; color: string; color2: string; wing?: number; number?: number }) {
  const road = useMemo(() => (discipline === 'gt' || discipline === 'touring' ? raceRoadSpec(discipline, year, color, wing) : null), [discipline, year, color, wing]);
  if (discipline === 'f1') return <OpenWheel year={year} color={color} color2={color2} wing={wing} />;
  if (discipline === 'hypercar' || discipline === 'lmdh') return <Prototype year={year} color={color} color2={color2} wing={wing} />;
  return <RoadCar spec={road!} number={number ?? 1} />;
}
