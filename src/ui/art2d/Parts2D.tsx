// Technical illustrations of the parts the workshop offers, in true perspective with the shared solids: chassis
// structures (ladder frame, steel or aluminium monocoque, tubular space frame, carbon tub), gearboxes (manual, automatic,
// dual clutch), one corner of each suspension type, brakes from drums to carbon-ceramic discs, and tyres by compound
// and width. Same renderer and lighting as the cars and engines.
import { memo } from 'react';
import type { BrakeType, ChassisType, Gearbox, SuspType, TireCompound } from '../../sim/types';
import { MAT, SolidArt, abox, box, coil, cyl, over, tube, type Mat, type Solid } from './solids';
import type { Projector, V3 } from './vector3d';

const X: V3 = [1, 0, 0], Y: V3 = [0, 1, 0], Z: V3 = [0, 0, 1];

export const Chassis2D = memo(function Chassis2D({ type }: { type: ChassisType }) {
  const build = (cam: Projector) => {
    const S: Solid[] = [];
    const m: Mat = type === 'aluminium' ? MAT.alu : type === 'spaceframe' ? { c: [214, 170, 70], spec: 0.4 } : type === 'carbon' ? MAT.carbon : type === 'ladder' ? MAT.iron : { c: [142, 150, 160], spec: 0.35 };
    if (type === 'ladder') {
      for (const y of [-0.42, 0.42]) S.push(abox(cam, [2, y, 0.3], 2, 0.05, 0.1, m));
      for (const x of [0.15, 1.1, 2.0, 2.9, 3.85]) S.push(abox(cam, [x, 0, 0.3], 0.05, 0.42, 0.07, m));
      S.push(abox(cam, [-0.02, 0, 0.3], 0.04, 0.62, 0.08, MAT.steel));
      for (const x of [0.6, 3.4]) for (const y of [-0.5, 0.5]) S.push(cyl(cam, [x, y, 0.42], Z, 0.05, 0.22, MAT.spring, 10));
      return S;
    }
    if (type === 'carbon') {
      S.push(abox(cam, [2, 0, 0.32], 0.9, 0.6, 0.2, m), abox(cam, [2.0, -0.62, 0.38], 0.85, 0.06, 0.26, m), abox(cam, [2.0, 0.62, 0.38], 0.85, 0.06, 0.26, m));
      S.push(abox(cam, [1.12, 0, 0.55], 0.06, 0.6, 0.4, m), abox(cam, [2.9, 0, 0.6], 0.08, 0.6, 0.45, m));
      S.push(...tube(cam, [[2.85, -0.45, 1.0], [2.8, -0.35, 1.25], [2.8, 0.35, 1.25], [2.85, 0.45, 1.0]], 0.04, MAT.chrome));
      for (const y of [-0.35, 0.35]) S.push(...tube(cam, [[1.1, y, 0.35], [0.2, y * 0.8, 0.35]], 0.035, MAT.alu), ...tube(cam, [[2.95, y, 0.4], [3.9, y * 0.8, 0.4]], 0.035, MAT.alu));
      return S;
    }
    if (type === 'spaceframe') {
      const r = 0.028, lo = 0.25, hi = 0.75;
      const corners = (z: number, w: number): V3[] => [[0.2, -w, z], [3.8, -w, z], [3.8, w, z], [0.2, w, z], [0.2, -w, z]];
      S.push(...tube(cam, corners(lo, 0.6), r, m), ...tube(cam, [[0.6, -0.5, hi], [3.4, -0.5, hi]], r, m), ...tube(cam, [[0.6, 0.5, hi], [3.4, 0.5, hi]], r, m));
      for (const x of [0.6, 1.5, 2.4, 3.4]) for (const y of [-0.55, 0.55]) S.push(...tube(cam, [[x, y, lo], [x, y * 0.9, hi]], r, m));
      for (const [a, b] of [[0.6, 1.5], [1.5, 2.4], [2.4, 3.4]]) for (const y of [-0.55, 0.55]) S.push(...tube(cam, [[a, y, lo], [b, y * 0.9, hi]], r, m));
      for (const x of [0.6, 2.4, 3.4]) S.push(...tube(cam, [[x, -0.5, hi], [x, 0.5, hi]], r, m));
      S.push(...tube(cam, [[2.4, -0.48, hi], [2.3, -0.35, 1.2], [2.3, 0.35, 1.2], [2.4, 0.48, hi]], r * 1.3, m));
      return S;
    }
    // steel or aluminium monocoque: floor pan, sills, bulkheads, pillars and roof rails
    S.push(abox(cam, [2, 0, 0.2], 1.6, 0.62, 0.03, m), abox(cam, [2, -0.66, 0.3], 1.1, 0.05, 0.12, m), abox(cam, [2, 0.66, 0.3], 1.1, 0.05, 0.12, m));
    S.push(abox(cam, [0.95, 0, 0.55], 0.04, 0.62, 0.33, m), abox(cam, [3.15, 0, 0.6], 0.05, 0.62, 0.38, m));
    for (const y of [-0.62, 0.62]) {
      S.push(...tube(cam, [[1.0, y, 0.85], [1.55, y * 0.92, 1.3], [2.9, y * 0.92, 1.32], [3.3, y, 0.9]], 0.035, m));
      S.push(abox(cam, [2.2, y * 0.95, 0.8], 0.05, 0.035, 0.5, m));
      S.push(...tube(cam, [[0.95, y * 0.9, 0.55], [0.15, y * 0.8, 0.5]], 0.05, m), ...tube(cam, [[3.15, y * 0.9, 0.55], [3.95, y * 0.8, 0.6]], 0.05, m));
    }
    if (type === 'aluminium') for (const [x, y] of [[0.95, -0.62], [0.95, 0.62], [3.15, -0.62], [3.15, 0.62]]) S.push(abox(cam, [x, y, 0.55], 0.08, 0.06, 0.1, MAT.chrome));
    return S;
  };
  return <SolidArt build={build} eye={[-2.2, -3.6, 2.6]} target={[2, 0, 0.5]} deps={'ch' + type} className="part2d" label={type} />;
});

export const Gearbox2D = memo(function Gearbox2D({ type, gears = 5 }: { type: Gearbox; gears?: number }) {
  const build = (cam: Projector) => {
    const S: Solid[] = [];
    if (type === 'auto') {
      S.push(cyl(cam, [0, 0, 0.4], X, 0.36, 0.3, MAT.alu, 26, 0.3), cyl(cam, [0.55, 0, 0.36], X, 0.26, 0.8, MAT.alu, 22, 0.2), abox(cam, [0.55, 0, 0.08], 0.38, 0.2, 0.04, MAT.iron));
      S.push(...tube(cam, [[0.3, -0.22, 0.4], [0.5, -0.4, 0.3], [0.9, -0.4, 0.3]], 0.02, MAT.steel));
    } else {
      S.push(cyl(cam, [0, 0, 0.4], X, type === 'dct' ? 0.33 : 0.34, 0.28, MAT.alu, 26, 0.26), abox(cam, [0.55, 0, 0.36], 0.4, 0.2, 0.22, MAT.alu));
      for (let i = 0; i < Math.min(10, gears); i++) S.push(abox(cam, [0.22 + i * (0.68 / Math.max(1, gears - 1)), -0.205, 0.36], 0.012, 0.01, 0.18, MAT.iron));
      if (type === 'manual') S.push(...tube(cam, [[0.6, 0, 0.58], [0.6, 0, 1.0]], 0.02, MAT.chrome), cyl(cam, [0.6, 0, 1.05], Z, 0.06, 0.08, MAT.black, 14));
      else S.push(abox(cam, [0.55, 0.0, 0.66], 0.22, 0.14, 0.08, MAT.black), cyl(cam, [0.05, 0, 0.4], X, 0.18, 0.32, MAT.steel, 20));
    }
    S.push(cyl(cam, [1.05, 0, 0.36], X, 0.06, 0.25, MAT.steel, 14));
    return S;
  };
  return <SolidArt build={build} eye={[-1.6, -2.6, 1.7]} target={[0.5, 0, 0.45]} deps={'gb' + type + gears} className="part2d" label={type} />;
});

export const Suspension2D = memo(function Suspension2D({ type }: { type: SuspType }) {
  const build = (cam: Projector) => {
    const S: Solid[] = [];
    // the wheel hub and brake disc at the outer end, the body mount inboard
    S.push(cyl(cam, [0, -0.62, 0.35], Y, 0.2, 0.03, MAT.steel, 22), cyl(cam, [0, -0.6, 0.35], Y, 0.07, 0.08, MAT.alu, 14));
    if (type === 'solid') {
      S.push(cyl(cam, [0, 0, 0.35], Y, 0.06, 1.2, MAT.iron, 14), cyl(cam, [0, 0.3, 0.35], Y, 0.16, 0.16, MAT.iron, 18));
      for (let k = 0; k < 4; k++) S.push(box(cam, [0, -0.42, 0.24 - k * 0.025], [0.55 - k * 0.1, 0, 0.018 * k], [0, 0.04, 0], [0, 0, 0.012], MAT.steel));
      S.push(cyl(cam, [0.25, -0.35, 0.65], [0.15, 0, 1], 0.035, 0.6, MAT.dark, 10));
      return S;
    }
    const upright: V3 = [0, -0.5, 0.35];
    S.push(abox(cam, upright, 0.05, 0.04, 0.16, MAT.alu));
    if (type === 'macpherson') {
      S.push(cyl(cam, [0, -0.44, 0.75], [0, 0.15, 1], 0.04, 0.7, MAT.steel, 12), ...coil(cam, [0, -0.43, 0.8], [0, 0.15, 1], 0.1, 0.35, 5, 0.015, MAT.spring));
      S.push(...tube(cam, [[0, -0.5, 0.2], [0.25, 0.1, 0.22], [-0.25, 0.1, 0.22], [0, -0.5, 0.2]], 0.025, MAT.iron));
    } else {
      const arms = type === 'wishbone' ? [0.2, 0.5] : [0.18, 0.3, 0.52];
      for (const z of arms) S.push(...tube(cam, [[0, -0.5, z], [0.22, 0.1, z + 0.02], [-0.22, 0.1, z + 0.02], [0, -0.5, z]], 0.022, type === 'multilink' ? MAT.alu : MAT.iron));
      if (type === 'multilink') S.push(...tube(cam, [[0.06, -0.5, 0.35], [0.4, 0.05, 0.4]], 0.02, MAT.alu));
      S.push(cyl(cam, [0.05, -0.25, 0.62], [0, 0.4, 1], 0.035, 0.55, MAT.dark, 10), ...coil(cam, [0.05, -0.25, 0.64], [0, 0.4, 1], 0.08, 0.3, 5, 0.013, MAT.spring));
    }
    return S;
  };
  return <SolidArt build={build} eye={[-1.6, -2.2, 1.3]} target={[0, -0.2, 0.42]} deps={'su' + type} className="part2d" label={type} />;
});

export const Brake2D = memo(function Brake2D({ type }: { type: BrakeType }) {
  const build = (cam: Projector) => {
    const S: Solid[] = [];
    const face = (r: number, y: number, m: Mat, k: number, seg = 30) => over(cyl(cam, [0, y, 0], Y, r, 0.004, m, seg), k);
    if (type === 'drum') {
      S.push(cyl(cam, [0, 0, 0], Y, 0.42, 0.24, MAT.iron, 30));
      for (let k = 0; k < 5; k++) S.push(cyl(cam, [0, -0.08 + k * 0.04, 0], Y, 0.45, 0.014, MAT.iron, 30));
      S.push(face(0.2, -0.125, MAT.steel, 1, 22), face(0.08, -0.13, MAT.dark, 2, 14));
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; S.push(over(cyl(cam, [Math.cos(a) * 0.14, -0.15, Math.sin(a) * 0.14], Y, 0.022, 0.05, MAT.chrome, 8), 3)); }
      return S;
    }
    const disc: Mat = type === 'ceramic' ? { c: [70, 72, 78], spec: 0.5 } : MAT.steel;
    const thick = type === 'disc' ? 0.04 : 0.1, f = -thick / 2 - 0.002;
    S.push(cyl(cam, [0, 0, 0], Y, 0.48, thick, disc, 40));
    if (type !== 'disc') for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; S.push(over(box(cam, [Math.cos(a) * 0.48, 0, Math.sin(a) * 0.48], [Math.cos(a) * 0.004, 0, Math.sin(a) * 0.004], [0, thick * 0.32, 0], [-Math.sin(a) * 0.014, 0, Math.cos(a) * 0.014], MAT.black), 1)); }
    S.push(face(0.24, f - 0.002, MAT.alu, 2, 26), face(0.1, f - 0.006, MAT.dark, 3, 16));
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + 0.3; S.push(over(cyl(cam, [Math.cos(a) * 0.16, f - 0.02, Math.sin(a) * 0.16], Y, 0.02, 0.03, MAT.chrome, 8), 4)); }
    if (type !== 'disc') for (let k = 0; k < 30; k++) { const a = (k / 30) * Math.PI * 2, r = 0.31 + (k % 3) * 0.045; S.push(face(0.012, f, MAT.black, 2, 6), over(cyl(cam, [Math.cos(a) * r, f, Math.sin(a) * r], Y, 0.013, 0.004, MAT.black, 6), 2)); }
    // calliper straddling the disc at the top right, in front of it
    const cal: Mat = type === 'ceramic' ? MAT.gold : type === 'vented' ? MAT.red : MAT.iron;
    const big = type === 'ceramic' ? 1.3 : type === 'vented' ? 1.12 : 0.9;
    S.push(over(box(cam, [0.27, -0.02, 0.27], [0.12 * big, 0, -0.12 * big], [0, thick / 2 + 0.07, 0], [0.07, 0, 0.07], cal), 5));
    return S;
  };
  return <SolidArt build={build} eye={[-1.9, -2.4, 1.0]} target={[0, 0, 0]} deps={'br' + type} className="part2d" label={type} />;
});

export const Tyre2D = memo(function Tyre2D({ compound, width = 205 }: { compound: TireCompound; width?: number }) {
  const build = (cam: Projector) => {
    const w = Math.max(0.16, Math.min(0.36, width / 1000)), S: Solid[] = [];
    S.push(cyl(cam, [0, 0, 0], Y, 0.48, w, MAT.rubber, 40));
    const grooves = compound === 'semislick' ? 0 : compound === 'sport' ? 2 : compound === 'touring' ? 3 : 4;
    for (let k = 0; k < grooves; k++) S.push(cyl(cam, [0, -w / 2 + ((k + 1) / (grooves + 1)) * w, 0], Y, 0.482, 0.012, { c: [8, 8, 9] }, 40));
    const sw = -w / 2 - 0.002, face = (r: number, m: Mat, k: number, seg = 40) => over(cyl(cam, [0, sw - k * 0.001, 0], Y, r, 0.003, m, seg), k);
    const band: Mat = { c: compound === 'semislick' ? [210, 50, 40] : compound === 'sport' ? [230, 190, 60] : compound === 'touring' ? [200, 205, 210] : [90, 190, 120] };
    S.push(face(0.405, band, 1), face(0.39, MAT.rubber, 2), face(0.33, MAT.chrome, 3, 32), face(0.3, MAT.dark, 4, 32));
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; S.push(over(box(cam, [Math.cos(a) * 0.17, sw - 0.012, Math.sin(a) * 0.17], [Math.cos(a) * 0.13, 0, Math.sin(a) * 0.13], [0, 0.006, 0], [-Math.sin(a) * 0.02, 0, Math.cos(a) * 0.02], MAT.chrome), 5)); }
    S.push(face(0.06, MAT.alu, 6, 16));
    return S;
  };
  return <SolidArt build={build} eye={[-1.5, -2.5, 0.9]} target={[0, 0, 0]} deps={'ty' + compound + width} className="part2d" label={compound} />;
});

