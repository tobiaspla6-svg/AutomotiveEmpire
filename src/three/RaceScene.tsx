// 3D view of a race. It never decides anything: every frame it reads car distances from the
// RaceSim state (interpolated between the last two simulation steps) and places the cars on the
// circuit centre line.
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { RaceSim } from '../sim/racing/race';
import { trackGeom, trackPos, type TrackGeom } from '../sim/racing/tracks';
import { RaceCar } from './CarModel';
import type { Discipline } from '../sim/types';

const HALF = 6.5;
function ribbon(g: TrackGeom, half: number, lateral = 0, lift = 0, from = 0, to = -1): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = [];
  const end = to < 0 ? g.n : to;
  const count = end - from;
  for (let k = 0; k <= count; k++) {
    const i = (from + k) % g.n;
    const nx = -g.hz[i], nz = g.hx[i];
    pos.push(g.x[i] + nx * (lateral - half), g.y[i] + lift, g.z[i] + nz * (lateral - half), g.x[i] + nx * (lateral + half), g.y[i] + lift, g.z[i] + nz * (lateral + half));
    if (k < count) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function Track({ g, wet }: { g: TrackGeom; wet: number }) {
  const { road, kerbL, kerbR, pit, line, trees } = useMemo(() => {
    const pitLen = Math.round(520 / g.ds), pitFrom = (g.n - Math.round(260 / g.ds)) % g.n;
    // deterministic scenery: trees scattered around the circuit, kept clear of the asphalt
    const pts: number[] = [];
    let seed = 12345 + g.n;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const b = g.bounds, m = 260;
    for (let k = 0; k < 1500 && pts.length < 420 * 3; k++) {
      const x = b.minX - m + rnd() * (b.maxX - b.minX + 2 * m), z = b.minZ - m + rnd() * (b.maxZ - b.minZ + 2 * m);
      let near = 1e9, yy = 0;
      for (let i = 0; i < g.n; i += 6) { const d = (g.x[i] - x) ** 2 + (g.z[i] - z) ** 2; if (d < near) { near = d; yy = g.y[i]; } }
      if (near > 55 * 55 && near < 420 * 420) pts.push(x, yy, z);
    }
    return { road: ribbon(g, HALF, 0, 0.02), kerbL: ribbon(g, 0.6, -HALF - 0.6, 0.015), kerbR: ribbon(g, 0.6, HALF + 0.6, 0.015), pit: ribbon(g, 3, HALF + 7, 0.02, pitFrom, pitFrom + pitLen), line: ribbon(g, HALF, 0, 0.035, 0, 1), trees: pts };
  }, [g]);
  const treeRef = useRef<THREE.InstancedMesh>(null);
  useMemo(() => { /* matrices are set once the mesh exists */ }, []);
  const setTrees = (m: THREE.InstancedMesh | null) => {
    (treeRef as MutableRefObject<THREE.InstancedMesh | null>).current = m;
    if (!m) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < trees.length / 3; i++) { const s = 0.7 + ((i * 37) % 10) / 12; o.position.set(trees[i * 3], trees[i * 3 + 1] + 4.5 * s, trees[i * 3 + 2]); o.scale.set(s, s, s); o.updateMatrix(); m.setMatrixAt(i, o.matrix); }
    m.instanceMatrix.needsUpdate = true;
  };
  const cx = (g.bounds.minX + g.bounds.maxX) / 2, cz = (g.bounds.minZ + g.bounds.maxZ) / 2;
  const roadColor = new THREE.Color('#3b3d42').lerp(new THREE.Color('#1c1e22'), Math.min(1, wet * 1.6));
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.6, cz]}><planeGeometry args={[12000, 12000]} /><meshStandardMaterial color={wet > 0.3 ? '#2f4a2a' : '#3f6b35'} roughness={1} /></mesh>
      <mesh geometry={road}><meshStandardMaterial color={roadColor} roughness={Math.max(0.25, 0.92 - wet * 0.9)} metalness={wet * 0.3} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={kerbL}><meshStandardMaterial color="#b9382f" roughness={0.8} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={kerbR}><meshStandardMaterial color="#d8d8d8" roughness={0.8} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={pit}><meshStandardMaterial color="#4a4c52" roughness={0.9} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={line}><meshStandardMaterial color="#f2f2f2" roughness={0.6} side={THREE.DoubleSide} /></mesh>
      <instancedMesh ref={setTrees} args={[undefined, undefined, trees.length / 3]}><coneGeometry args={[3.4, 10, 7]} /><meshLambertMaterial color="#3d7a3c" /></instancedMesh>
    </group>
  );
}

function Cars({ sim, alpha, discipline, year, selected, camMode }: { sim: RaceSim; alpha: MutableRefObject<number>; discipline: Discipline; year: number; selected: MutableRefObject<number>; camMode: MutableRefObject<string> }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const g = sim.geom;
  const tmp = useMemo(() => ({ x: 0, y: 0, z: 0, hx: 1, hz: 0 }), []);
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: { target: THREE.Vector3; update: () => void } | null };
  const camPos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const lastMode = useRef('orbit');
  useFrame((_, dtReal) => {
    const a = alpha.current;
    for (const c of sim.cars) {
      const grp = refs.current[c.idx];
      if (!grp) continue;
      if (c.status === 'out') { grp.visible = false; continue; }
      grp.visible = true;
      const dist = c.prevDist + (c.dist - c.prevDist) * a;
      const inPit = c.status === 'pit';
      // side by side on the grid and while overtaking; pit lane runs to the right of the main straight
      const lateral = inPit ? HALF + 7 : c.passing >= 0 ? -2.6 : dist < 0 ? (c.grid % 2 ? -2.4 : 2.4) : c.status === 'fin' ? 0 : ((c.idx % 3) - 1) * 0.5;
      trackPos(g, dist, lateral, tmp);
      grp.position.set(tmp.x, tmp.y + 0.03, tmp.z);
      grp.rotation.y = Math.atan2(-tmp.hz, tmp.hx);
    }
    if (camMode.current === 'orbit' && lastMode.current !== 'orbit') { // back to the overview: restore the high vantage point
      const b = g.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
      camera.position.set(cx + span * 0.15, span * 0.75, cz + span * 0.85);
      camera.lookAt(cx, 0, cz);
      if (controls) { controls.target.set(cx, 0, cz); controls.update(); }
    }
    lastMode.current = camMode.current;
    const sel = sim.cars[selected.current];
    const sg = sel ? refs.current[sel.idx] : null;
    if (sg && camMode.current !== 'orbit') {
      const h = sg.rotation.y, fx = Math.cos(h), fz = -Math.sin(h);
      if (camMode.current === 'chase') camPos.set(sg.position.x - fx * 11, sg.position.y + 3.6, sg.position.z - fz * 11);
      else if (camMode.current === 'tv') camPos.set(sg.position.x - fz * 26 + fx * 8, sg.position.y + 9, sg.position.z + fx * 26 + fz * 8);
      else camPos.set(sg.position.x - fx * 4, sg.position.y + 60, sg.position.z - fz * 4);
      // follow smoothly at watchable speeds; at high time-warp (or after a cut) jump straight to the car
      if (camera.position.distanceTo(camPos) > 90) camera.position.copy(camPos);
      else camera.position.lerp(camPos, 1 - Math.exp(-dtReal * (camMode.current === 'chase' ? 9 : 5)));
      look.set(sg.position.x + fx * 4, sg.position.y + 0.8, sg.position.z + fz * 4);
      camera.lookAt(look);
      if (controls) controls.target.copy(look);
    }
  });
  return (
    <>
      {sim.cars.map((c) => (
        <group key={c.e.id} ref={(el) => { refs.current[c.idx] = el; }}>
          <RaceCar discipline={discipline} year={year} color={c.e.color} color2={c.e.color2} wing={c.e.wing} number={c.e.number} />
          {c.e.isPlayer && <mesh position={[0, 2.6, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.5, 1, 4]} /><meshBasicMaterial color="#e8b04a" /></mesh>}
        </group>
      ))}
    </>
  );
}

export function RaceScene({ sim, alpha, selected, camMode, discipline, year, wet }: { sim: RaceSim; alpha: MutableRefObject<number>; selected: MutableRefObject<number>; camMode: MutableRefObject<string>; discipline: Discipline; year: number; wet: number }) {
  const g = trackGeom(sim.cfg.trackId);
  const cx = (g.bounds.minX + g.bounds.maxX) / 2, cz = (g.bounds.minZ + g.bounds.maxZ) / 2;
  const span = Math.max(g.bounds.maxX - g.bounds.minX, g.bounds.maxZ - g.bounds.minZ);
  const sky = wet > 0.25 ? '#59636d' : '#8fb7dd';
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [cx + span * 0.15, span * 0.75, cz + span * 0.85], fov: 38, near: 1, far: 30000 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, span * 1.2, span * (wet > 0.25 ? 3 : 6)]} />
      <hemisphereLight args={['#dfeaff', '#49603c', wet > 0.25 ? 0.75 : 1.0]} />
      <directionalLight position={[cx + 800, 1400, cz + 500]} intensity={wet > 0.25 ? 0.7 : 1.9} />
      <Track g={g} wet={wet} />
      <Cars sim={sim} alpha={alpha} discipline={discipline} year={year} selected={selected} camMode={camMode} />
      <OrbitControls makeDefault target={[cx, 0, cz]} maxPolarAngle={Math.PI / 2 - 0.05} minDistance={15} maxDistance={span * 3} />
    </Canvas>
  );
}
