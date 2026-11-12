// RenderDescriptor → visual plan (Phase 4).
//
// Pure data, no Three.js: decides whether a GLB asset can show this car and, if so, how to stretch it, where the
// wheels go and how big they are, which swappable components are visible and which materials to apply. Anything the
// asset cannot represent is listed in `notes` (or the plan falls back to the procedural renderer with a reason), so
// the interface never pretends a customisation is shown when it is not. No gameplay physics is computed here: every
// number comes from the descriptor, which comes from the simulation.
import type { RenderDescriptor } from '../../sim/render';
import type { PaintFinish, TrimLevel } from '../../sim/types';
import { RIM_FOR_STYLE, VEHICLE_ASSETS, type RimId, type VehicleAsset } from './catalog';

export type TrimStyle = 'chrome' | 'black' | 'satin';
export type AccentKind = 'wood' | 'aluminium' | 'carbon' | 'plastic';
export type Vec3 = [number, number, number];

export interface AssetPlan {
  kind: 'asset';
  asset: VehicleAsset;
  /** piecewise-linear remapping of x (native → target) that keeps the wheel arches round */
  xKnots: { native: number[]; target: number[] };
  scaleY: number;
  scaleZ: number;
  /** vertical offset of the body (ride height) */
  bodyLift: number;
  wheels: {
    rim: RimId; rimFinish: 'silver' | 'dark';
    /** rim seat diameter and width, tyre outer radius and section width (m) */
    rimDia: number; rimWidth: number; tireRadius: number; tireWidth: number;
    /** hub centres; right-hand wheels are mirrored (outboard face towards +z) */
    positions: { FL: Vec3; FR: Vec3; RL: Vec3; RR: Vec3 };
    caliperColor: string;
    brakeScale: number;
  };
  /** component node name → shown */
  visible: Record<string, boolean>;
  paint: { color: string; finish: PaintFinish };
  trimStyle: TrimStyle;
  interior: { upholstery: string; leather: boolean; accent: AccentKind };
  /** what the asset does not show, or shows clamped */
  notes: string[];
  /** target dimensions actually drawn */
  drawn: { length: number; width: number; height: number; wheelbase: number; track: number };
}
export interface ProceduralPlan { kind: 'procedural'; reason: string }
export type VisualPlan = AssetPlan | ProceduralPlan;

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const ARCH_KEEP = 0.45; // half length kept unscaled around each axle (the wheel-arch zone)

const isSporty = (l: TrimLevel | 'base') => l === 'sport' || l === 'performance';
const isPremium = (l: TrimLevel | 'base') => l === 'premium' || l === 'luxury' || l === 'limited';

/** The asset for a descriptor, or why there is none. */
export function pickAsset(d: RenderDescriptor, year?: number, assets: VehicleAsset[] = VEHICLE_ASSETS): VehicleAsset | string {
  const road = assets.filter((a) => a.category === 'road');
  const forBody = road.filter((a) => a.bodies.includes(d.body));
  if (!forBody.length) return `No 3D asset for the ${d.body} body yet — procedural preview.`;
  const forEngine = forBody.filter((a) => a.enginePositions.includes(d.engine.position));
  if (!forEngine.length) return `The ${d.body} asset is front-engined; a ${d.engine.position}-engined car uses the procedural preview.`;
  if (year !== undefined) {
    const inEra = forEngine.filter((a) => year >= a.era[0] && year <= a.era[1]);
    if (!inEra.length) return `No 3D asset in the design language of ${year} yet — procedural preview.`;
    return inEra[0];
  }
  return forEngine[0];
}

export function planVehicle(d: RenderDescriptor, year?: number, assets?: VehicleAsset[]): VisualPlan {
  const a = pickAsset(d, year, assets);
  if (typeof a === 'string') return { kind: 'procedural', reason: a };
  const n = a.native, c = a.compatible;
  const notes: string[] = [];
  // ---------------------------------------------------------------- body dimensions
  const L = clamp(d.length, c.length[0], c.length[1]);
  const WB = clamp(d.wheelbase, c.wheelbase[0], c.wheelbase[1]);
  const W = clamp(d.width, c.width[0], c.width[1]);
  const H = clamp(d.height, c.height[0], c.height[1]);
  if (L !== d.length || WB !== d.wheelbase || W !== d.width || H !== d.height) {
    notes.push(`Drawn at the nearest size this asset supports (${L.toFixed(2)} × ${W.toFixed(2)} × ${H.toFixed(2)} m, wheelbase ${WB.toFixed(2)} m).`);
  }
  const nFO = n.frontX - n.frontAxleX, nRO = n.rearAxleX - n.rearX;
  const over = Math.max(1.2, L - WB);
  const FO = Math.max(ARCH_KEEP + 0.15, over * (nFO / (nFO + nRO)));
  const RO = Math.max(ARCH_KEEP + 0.15, over - FO);
  const native = [n.rearX, n.rearAxleX - ARCH_KEEP, n.rearAxleX + ARCH_KEEP, n.frontAxleX - ARCH_KEEP, n.frontAxleX + ARCH_KEEP, n.frontX];
  const fa = WB / 2, ra = -WB / 2;
  const target = [ra - RO, ra - ARCH_KEEP, ra + ARCH_KEEP, fa - ARCH_KEEP, fa + ARCH_KEEP, fa + FO];
  const scaleY = H / n.height, scaleZ = W / n.width;
  // ---------------------------------------------------------------- wheels
  let rimDia = clamp(d.wheelDia, c.rimDia[0], c.rimDia[1]);
  if (rimDia !== d.wheelDia) notes.push(`${d.wheelDia}" wheels are drawn as ${rimDia}" (asset range ${c.rimDia[0]}–${c.rimDia[1]}").`);
  let tireR = d.tireRadius;
  // the arch opening is a circle around the native axle, stretched vertically with the body
  const archTop = (n.tireRadius + n.archRadius) * scaleY;
  const maxTire = n.archRadius * Math.min(1, scaleY) - 0.012;
  if (tireR > maxTire) {
    tireR = maxTire;
    notes.push(`Tyres larger than the wheel arches are drawn at ${(tireR * 2).toFixed(2)} m diameter.`);
  }
  if (tireR < rimDia * 0.0127 + 0.04) {
    rimDia = Math.max(c.rimDia[0], Math.floor((tireR - 0.045) / 0.0127));
    notes.push(`The tyre is too small for that rim; drawn on ${rimDia}" rims.`);
  }
  const tireW = clamp(d.tireWidth / 1000, 0.165, 0.335);
  const rimWidth = clamp(tireW * 0.88, 0.15, 0.31);
  const halfW = (n.width / 2) * scaleZ;
  const track = Math.min(d.track, 2 * (halfW - tireW * 0.55 - 0.012));
  // ---------------------------------------------------------------- ride height (body lift relative to the asset)
  let lift = clamp(d.rideHeight - n.clearance, c.rideOffset[0], c.rideOffset[1]);
  if (d.rideHeight - n.clearance > c.rideOffset[1]) notes.push('Ride height above the asset\'s suspension range; drawn at its highest setting.');
  const minLift = 2 * tireR + 0.012 - archTop; // the tyre must stay inside the arch
  if (lift < minLift) lift = minLift;
  // ---------------------------------------------------------------- components
  const e = d.engine;
  const exhaust = e.electric ? null : e.cylinders >= 8 || (d.sport > 0.7 && e.cylinders >= 6) ? 'quad' : e.cylinders <= 4 && e.aspiration === 'na' ? 'single' : 'dual';
  const ac = a.components;
  const visible: Record<string, boolean> = {
    [ac.grille.ice]: !e.electric, [ac.grille.ev]: e.electric,
    [ac.exhaust.single]: exhaust === 'single', [ac.exhaust.dual]: exhaust === 'dual', [ac.exhaust.quad]: exhaust === 'quad',
    [ac.aero.lip]: d.aero.wing > 0.05 && d.aero.wing <= 0.45, [ac.aero.wing]: d.aero.wing > 0.45,
    [ac.aero.splitter]: d.aero.splitter > 0.3, [ac.aero.skirts]: d.aero.flatFloor || d.aero.splitter > 0.6,
    [ac.interior]: true,
  };
  // ---------------------------------------------------------------- styling from the trim
  const lvl = d.trim.level;
  const sporty = isSporty(lvl) || d.sport > 0.75;
  const premium = isPremium(lvl);
  const rim: RimId = d.wheelStyle ? RIM_FOR_STYLE[d.wheelStyle] : sporty ? 'rim_sport5' : premium ? 'rim_turbine10' : 'rim_multi15';
  const finish: PaintFinish = d.finish ?? (lvl === 'limited' ? 'pearl' : lvl === 'entry' ? 'solid' : 'metallic');
  const trimStyle: TrimStyle = sporty ? 'black' : premium ? 'chrome' : 'satin';
  const interior = d.interior === 'luxury' ? { upholstery: '#7a4e32', leather: true, accent: 'wood' as AccentKind }
    : d.interior === 'premium' ? { upholstery: '#151516', leather: true, accent: (sporty ? 'carbon' : 'aluminium') as AccentKind }
      : d.interior === 'standard' ? { upholstery: '#3a3b3f', leather: false, accent: (sporty ? 'carbon' : 'aluminium') as AccentKind }
        : { upholstery: '#2a2a2c', leather: false, accent: 'plastic' as AccentKind };
  if (d.suspension.front !== 'macpherson' && d.suspension.front !== 'wishbone' && d.suspension.front !== 'multilink') notes.push('The suspension layout is engineering data and is not visible on this asset.');
  const y = tireR;
  return {
    kind: 'asset', asset: a,
    xKnots: { native, target },
    scaleY, scaleZ, bodyLift: lift,
    wheels: {
      rim, rimFinish: sporty ? 'dark' : 'silver', rimDia: rimDia * 0.0254, rimWidth, tireRadius: tireR, tireWidth: tireW,
      positions: { FL: [fa, y, -track / 2], FR: [fa, y, track / 2], RL: [ra, y, -track / 2], RR: [ra, y, track / 2] },
      caliperColor: sporty || d.sport > 0.6 ? '#b3141b' : '#2b2d31',
      brakeScale: rimDia / n.rimDia,
    },
    visible, paint: { color: d.color, finish }, trimStyle, interior, notes,
    drawn: { length: target[5] - target[0], width: W, height: H, wheelbase: WB, track },
  };
}

/** Map a native x coordinate through the stretch knots (piecewise linear). */
export function mapX(x: number, k: AssetPlan['xKnots']): number {
  const { native: a, target: b } = k;
  if (x <= a[0]) return b[0] + (x - a[0]);
  for (let i = 1; i < a.length; i++) {
    if (x <= a[i]) {
      const t = (x - a[i - 1]) / (a[i] - a[i - 1]);
      return b[i - 1] + t * (b[i] - b[i - 1]);
    }
  }
  return b[b.length - 1] + (x - a[a.length - 1]);
}
