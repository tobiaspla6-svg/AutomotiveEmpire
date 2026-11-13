// Automotive studio viewer (Phase 4): light-panel HDR environment, neutral tone mapping, soft contact shadows,
// camera presets, zoom, smooth 360° rotation, fullscreen inspection, quality presets and an FPS benchmark.
// It only displays what it is given; it never computes gameplay.
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, MeshReflectorMaterial, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { QUALITY_NAME, setQuality, useQuality, type Quality, type QualitySettings } from './quality';

const BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
/** "Studio Small 09" by Sergej Majboroda, Poly Haven, CC0 1.0 (public domain); 1k Radiance HDR, 1.6 MB. */
export const STUDIO_HDR = `${BASE}assets/env/studio_small_09_1k.hdr`;

/** Generated light-panel studio (no download): softboxes and strip lights rendered into an HDR cube map. */
function PanelEnvironment({ envRes }: { envRes: number }) {
  return (
    <Environment resolution={envRes} frames={1} background={false}>
      <color attach="background" args={['#07080a']} />
      <SkyDome />
      <Lightformer form="rect" intensity={2.4} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 4.5, 1]} />
      <Lightformer form="rect" intensity={4} position={[0, 2.6, -6]} rotation={[0, 0, 0]} scale={[16, 0.6, 1]} />
      <Lightformer form="rect" intensity={4} position={[0, 2.6, 6]} rotation={[0, Math.PI, 0]} scale={[16, 0.6, 1]} />
      <Lightformer form="rect" intensity={1.2} position={[0, 0.9, -6]} rotation={[0, 0, 0]} scale={[16, 0.25, 1]} />
      <Lightformer form="rect" intensity={1.2} position={[0, 0.9, 6]} rotation={[0, Math.PI, 0]} scale={[16, 0.25, 1]} />
      <Lightformer form="rect" intensity={1.6} position={[8, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[5, 3, 1]} color="#fff1dd" />
      <Lightformer form="rect" intensity={1.3} position={[-8, 2.5, 0]} rotation={[0, Math.PI / 2, 0]} scale={[5, 3, 1]} color="#dfe8ff" />
    </Environment>
  );
}

/** Photographed studio (CC0 HDRI) plus two long strip lights for crisp highlight lines along the flanks. */
function HdrEnvironment({ envRes }: { envRes: number }) {
  return (
    <Environment files={STUDIO_HDR} resolution={envRes} frames={1} background={false} environmentIntensity={0.72}>
      <Lightformer form="rect" intensity={2.2} position={[0, 2.6, -7]} rotation={[0, 0, 0]} scale={[16, 0.45, 1]} />
      <Lightformer form="rect" intensity={2.2} position={[0, 2.6, 7]} rotation={[0, Math.PI, 0]} scale={[16, 0.45, 1]} />
    </Environment>
  );
}

/** Studio lighting. With `hdr`, the photographed studio is used once downloaded; until then, or if it fails,
 *  the generated light panels light the car. */
export function Studio({ envRes = 256, keyShadow = false, shadowRes = 1024, hdr = false }: { envRes?: number; keyShadow?: boolean; shadowRes?: number; hdr?: boolean }) {
  const panels = <PanelEnvironment envRes={envRes} />;
  return (
    <>
      <ambientLight intensity={0.06} />
      <directionalLight position={[3.5, 8, -2.5]} intensity={hdr ? 0.7 : 1.1} castShadow={keyShadow} shadow-mapSize={[shadowRes, shadowRes]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} shadow-camera-near={1} shadow-camera-far={20} />
      {hdr ? <ViewerBoundary fallback={panels}><Suspense fallback={panels}><HdrEnvironment envRes={envRes} /></Suspense></ViewerBoundary> : panels}
    </>
  );
}

/** Studio cyclorama inside the environment map: dark floor, a soft bright horizon band and a dim ceiling.
 *  The horizon band is what draws the long reflection line along a car's flanks. */
function SkyDome() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {},
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vDir;
      void main(){
        float y = vDir.y;
        vec3 floorC = vec3(0.20, 0.205, 0.215);
        vec3 wallC = vec3(0.07, 0.072, 0.08);
        vec3 ceilC = vec3(0.03, 0.031, 0.036);
        vec3 c = mix(floorC, wallC, smoothstep(-0.16, -0.06, y));
        c = mix(c, ceilC, smoothstep(0.2, 0.75, y));
        c += vec3(0.95, 0.96, 0.98) * exp(-pow((y + 0.1) / 0.045, 2.0));
        gl_FragColor = vec4(c, 1.0);
      }`,
  }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  return <mesh scale={30} material={mat}><sphereGeometry args={[1, 48, 24]} /></mesh>;
}

function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  return t;
}

function Floor({ reflect = false }: { reflect?: boolean }) {
  const tex = useMemo(() => (typeof document !== 'undefined' ? floorTexture() : null), []);
  useEffect(() => () => tex?.dispose(), [tex]);
  if (reflect) return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
      <circleGeometry args={[9, 72]} />
      <MeshReflectorMaterial resolution={512} mixBlur={1.4} mixStrength={2.2} blur={[300, 80]} roughness={0.75} depthScale={0.6} minDepthThreshold={0.4} maxDepthThreshold={1.2}
        color="#141619" metalness={0.4} mirror={0.35} alphaMap={tex ?? undefined} transparent />
    </mesh>
  );
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
      <circleGeometry args={[9, 72]} />
      <meshStandardMaterial color="#16181c" roughness={0.55} metalness={0.25} alphaMap={tex ?? undefined} transparent envMapIntensity={0.6} />
    </mesh>
  );
}

// ------------------------------------------------------------------------------------------------ camera
export type ViewName = 'front34' | 'side' | 'rear34' | 'front' | 'rear' | 'top';
export const VIEWS: Record<ViewName, { az: number; el: number; k: number; label: string }> = {
  front34: { az: -38, el: 9, k: 1, label: 'Front ¾' },
  side: { az: -90, el: 3, k: 1.05, label: 'Side' },
  rear34: { az: -142, el: 10, k: 1, label: 'Rear ¾' },
  front: { az: 0, el: 6, k: 0.92, label: 'Front' },
  rear: { az: 180, el: 7, k: 0.92, label: 'Rear' },
  top: { az: -90, el: 68, k: 1.08, label: 'Top' },
};

interface Rig { view: ViewName | null; dist: number; seq: number }

function CameraRig({ rig, target, rotate, minD, maxD }: { rig: Rig; target: [number, number, number]; rotate: boolean; minD: number; maxD: number }) {
  const ctl = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const anim = useRef<{ from: THREE.Spherical; to: THREE.Spherical; t: number } | null>(null);
  const t = useMemo(() => new THREE.Vector3(...target), [target]);
  useEffect(() => {
    const off = camera.position.clone().sub(t);
    const from = new THREE.Spherical().setFromVector3(off);
    let to: THREE.Spherical;
    if (rig.view) {
      const v = VIEWS[rig.view];
      const az = (v.az * Math.PI) / 180, el = (v.el * Math.PI) / 180;
      const d = rig.dist * v.k;
      to = new THREE.Spherical().setFromVector3(new THREE.Vector3(Math.cos(el) * Math.cos(az) * d, Math.sin(el) * d, Math.cos(el) * Math.sin(az) * d));
      // take the short way round
      while (to.theta - from.theta > Math.PI) to.theta -= 2 * Math.PI;
      while (to.theta - from.theta < -Math.PI) to.theta += 2 * Math.PI;
    } else {
      to = from.clone();
      to.radius = THREE.MathUtils.clamp(rig.dist, minD, maxD);
    }
    anim.current = { from, to, t: 0 };
  }, [rig.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    const a = anim.current;
    if (a) {
      a.t = Math.min(1, a.t + dt / 0.7);
      const e = a.t < 0.5 ? 4 * a.t ** 3 : 1 - (-2 * a.t + 2) ** 3 / 2;
      const s = new THREE.Spherical(
        a.from.radius + (a.to.radius - a.from.radius) * e,
        a.from.phi + (a.to.phi - a.from.phi) * e,
        a.from.theta + (a.to.theta - a.from.theta) * e,
      );
      camera.position.copy(new THREE.Vector3().setFromSpherical(s).add(t));
      camera.lookAt(t);
      if (a.t >= 1) anim.current = null;
    }
    ctl.current?.update();
  });
  return <OrbitControls ref={ctl} makeDefault enablePan={false} enableDamping dampingFactor={0.08} minDistance={minD} maxDistance={maxD} maxPolarAngle={Math.PI / 2 - 0.02} autoRotate={rotate && !anim.current} autoRotateSpeed={0.6} target={target} />;
}

/** The car is static, so shadow maps are rendered once per change of the shown car, not every frame. */
function StaticShadows({ version }: { version: string }) {
  const { gl } = useThree();
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
  }, [gl, version]);
  return null;
}

/** Exposes the live scene for automated browser tests and benchmarks (read-only use). */
function InspectHook() {
  const { scene, gl, camera, controls } = useThree();
  useEffect(() => {
    const w = globalThis as { __aeViewer?: unknown };
    w.__aeViewer = { scene, gl, camera, controls };
    return () => { if ((w.__aeViewer as { scene?: unknown } | undefined)?.scene === scene) w.__aeViewer = undefined; };
  }, [scene, gl, camera, controls]);
  return null;
}

// --------------------------------------------------------------------------------------------- benchmark
export interface BenchResult { quality: Quality; seconds: number; frames: number; avgFps: number; p95Ms: number; worstMs: number; drawCalls: number; triangles: number; dpr: number; width: number; height: number; renderer: string }

function Bench({ run, onDone, quality }: { run: number; onDone: (r: BenchResult) => void; quality: Quality }) {
  const { gl, size } = useThree();
  const st = useRef<{ t0: number; times: number[]; last: number; calls: number; tris: number } | null>(null);
  useEffect(() => {
    if (run > 0) { st.current = { t0: performance.now(), times: [], last: performance.now(), calls: 0, tris: 0 }; gl.info.autoReset = false; gl.info.reset(); }
  }, [run, gl]);
  useFrame(() => {
    const s = st.current;
    if (!s) return;
    const now = performance.now();
    s.times.push(now - s.last);
    s.last = now;
    // totals of the previous frame (every pass: shadows, reflections, the scene)
    s.calls = gl.info.render.calls;
    s.tris = gl.info.render.triangles;
    gl.info.reset();
    if (now - s.t0 >= 5000) {
      const ts = (s.times.length > 8 ? s.times.slice(3) : s.times).sort((a, b) => a - b);
      const total = ts.reduce((a, b) => a + b, 0);
      const ctx = gl.getContext() as WebGL2RenderingContext;
      const dbg = ctx.getExtension('WEBGL_debug_renderer_info');
      const r: BenchResult = {
        quality, seconds: total / 1000, frames: ts.length, avgFps: ts.length / (total / 1000),
        p95Ms: ts[Math.floor(ts.length * 0.95)] ?? 0, worstMs: ts[ts.length - 1] ?? 0,
        drawCalls: s.calls, triangles: s.tris, dpr: gl.getPixelRatio(), width: size.width, height: size.height,
        renderer: dbg ? String(ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'unknown',
      };
      st.current = null;
      gl.info.autoReset = true;
      (globalThis as { __aeBench?: BenchResult }).__aeBench = r;
      onDone(r);
    }
  });
  return null;
}

// ------------------------------------------------------------------------------------------ error boundary
/** Keeps a 3D failure (bad asset, GPU loss) inside the viewer: shows the fallback instead of breaking the screen. */
export class ViewerBoundary extends Component<{ fallback: ReactNode; children: ReactNode; onError?: (e: Error) => void }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { this.props.onError?.(err); }
  render() { return this.state.err ? this.props.fallback : this.props.children; }
}

// ------------------------------------------------------------------------------------------------ viewer
export interface CarViewerProps {
  children: ReactNode;
  autoRotate?: boolean;
  height?: number | string;
  distance?: number;
  /** show the inspection toolbar (camera presets, zoom, fullscreen, quality, benchmark) */
  controls?: boolean;
  target?: [number, number, number];
  initialView?: ViewName;
  /** changes whenever the displayed car changes (static shadows are re-rendered then) */
  sceneVersion?: string;
}

export function CarViewer({ children, autoRotate = true, height, distance = 7.2, controls = false, target = [0, 0.62, 0], initialView = 'front34', sceneVersion }: CarViewerProps) {
  const [quality, Q] = useQuality();
  const wrap = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState(autoRotate);
  const [rig, setRig] = useState<Rig>({ view: initialView, dist: distance, seq: 0 });
  const [bench, setBench] = useState(0);
  const [result, setResult] = useState<BenchResult | null>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const f = () => setFull(document.fullscreenElement === wrap.current);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);
  const go = (view: ViewName | null, dist = rig.dist) => setRig((r) => ({ view, dist, seq: r.seq + 1 }));
  const v0 = VIEWS[initialView];
  const az = (v0.az * Math.PI) / 180, el = (v0.el * Math.PI) / 180;
  const cam: [number, number, number] = [target[0] + Math.cos(el) * Math.cos(az) * distance, target[1] + Math.sin(el) * distance, target[2] + Math.cos(el) * Math.sin(az) * distance];
  return (
    <div ref={wrap} className={'cv' + (full ? ' full' : '')} style={{ height: full ? '100%' : height ?? '100%' }}>
      <Canvas key={quality} shadows={Q.shadows === 'soft' ? { type: THREE.PCFShadowMap } : false} dpr={Q.dpr} camera={{ position: cam, fov: 30, near: 0.1, far: 80 }}
        gl={{ antialias: Q.antialias, preserveDrawingBuffer: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0, outputColorSpace: THREE.SRGBColorSpace, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#0e1013']} />
        <fog attach="fog" args={['#0e1013', 14, 26]} />
        <InspectHook />
        <Studio envRes={Q.envRes} keyShadow={Q.shadows === 'soft'} shadowRes={Q.shadowRes} hdr={Q.hdr} />
        <ViewerBoundary fallback={null}>{children}</ViewerBoundary>
        <Floor reflect={Q.shadows === 'soft'} />
        {Q.shadows !== 'none' && <ContactShadows key={sceneVersion ?? 'live'} frames={sceneVersion ? 2 : Infinity} position={[0, 0.002, 0]} opacity={0.85} scale={11} blur={Q.shadows === 'soft' ? 2.6 : 2.2} far={2.4} resolution={Q.shadowRes} color="#000000" />}
        {Q.shadows === 'soft' && sceneVersion && <StaticShadows version={sceneVersion} />}
        <CameraRig rig={rig} target={target} rotate={rotate || bench > 0 && !result} minD={2.6} maxD={16} />
        <Bench run={bench} quality={quality} onDone={(r) => setResult(r)} />
      </Canvas>
      {controls && <Toolbar quality={quality} Q={Q} rotate={rotate} setRotate={setRotate} go={go} dist={rig.dist} full={full}
        onFull={() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined); else wrap.current?.requestFullscreen?.().catch(() => undefined); }}
        onBench={() => { setResult(null); setBench((b) => b + 1); }} benching={bench > 0 && !result} result={result} />}
    </div>
  );
}

function Toolbar({ quality, rotate, setRotate, go, dist, full, onFull, onBench, benching, result }: {
  quality: Quality; Q: QualitySettings; rotate: boolean; setRotate: (v: boolean) => void; go: (v: ViewName | null, d?: number) => void; dist: number;
  full: boolean; onFull: () => void; onBench: () => void; benching: boolean; result: BenchResult | null;
}) {
  return (
    <>
      <div className="vtool views" role="toolbar" aria-label="Camera views">
        {(Object.keys(VIEWS) as ViewName[]).map((k) => <button key={k} className="vbtn" onClick={() => go(k)}>{VIEWS[k].label}</button>)}
      </div>
      <div className="vtool right" role="toolbar" aria-label="Viewer controls">
        <button className="vbtn" aria-label="Zoom in" title="Zoom in" onClick={() => go(null, Math.max(2.6, dist * 0.82))}>+</button>
        <button className="vbtn" aria-label="Zoom out" title="Zoom out" onClick={() => go(null, Math.min(16, dist / 0.82))}>−</button>
        <button className={'vbtn' + (rotate ? ' on' : '')} title="Turntable rotation" onClick={() => setRotate(!rotate)}>⟳</button>
        <button className="vbtn" title={full ? 'Exit full screen' : 'Full screen inspection'} onClick={onFull}>{full ? '⤡' : '⤢'}</button>
        <select className="vsel" aria-label="Graphics quality" value={quality} onChange={(e) => setQuality(e.target.value as Quality)}>
          {(Object.keys(QUALITY_NAME) as Quality[]).map((q) => <option key={q} value={q}>{QUALITY_NAME[q]} quality</option>)}
        </select>
        <button className="vbtn" title="Measure frame rate for 5 seconds" disabled={benching} onClick={onBench}>{benching ? 'Measuring…' : 'FPS test'}</button>
      </div>
      {result && <div className="vbench" role="status">{result.avgFps.toFixed(0)} FPS avg · p95 {result.p95Ms.toFixed(1)} ms · {result.drawCalls} draw calls · {(result.triangles / 1000).toFixed(0)}k triangles · {result.width}×{result.height} @{result.dpr}x · {QUALITY_NAME[result.quality]}</div>}
    </>
  );
}
