// Vehicle asset catalogue (Phase 4).
//
// Each entry describes one GLB asset: what it can represent (category, bodies, era, engine positions), its native
// dimensions and the range it may be stretched to, where the wheels attach, which materials can be recoloured,
// which components can be swapped, its levels of detail and its licence. The adapter (adapter.ts) only shows an
// asset for a car it is compatible with; everything else keeps the procedural renderer, which always works.
//
// Racing categories are part of the same contract (category 'race' + discipline + era + livery slots); no racing
// asset exists yet, so race cars use the procedural models in CarModel.tsx.
import type { BodyType, Discipline } from '../../sim/types';

export type AssetCategory = 'road' | 'race';
export type RimId = 'rim_sport5' | 'rim_turbine10' | 'rim_multi15';

export interface AssetLod {
  url: string;
  /** triangles in the file (from the export log), for budgeting */
  tris: number;
  bytes: number;
}

export interface VehicleAsset {
  id: string;
  name: string;
  category: AssetCategory;
  /** road assets: the body styles this asset can stand in for */
  bodies: BodyType[];
  /** race assets: the discipline (none yet) */
  discipline?: Discipline;
  /** model years whose design language it fits [from, to] */
  era: [number, number];
  enginePositions: ('front' | 'mid' | 'rear')[];
  /** LODs from most to least detailed */
  lods: AssetLod[];
  wheels: { url: string; bytes: number; rims: RimId[]; tireProfile: string };
  /** native geometry (metres, Y up, +X forward, glTF axes) */
  native: {
    length: number; width: number; height: number; wheelbase: number; trackF: number; trackR: number;
    frontAxleX: number; rearAxleX: number; frontX: number; rearX: number;
    tireRadius: number; rimDia: number; archRadius: number; clearance: number;
  };
  /** the range the adapter may stretch it to; outside it the car is shown at the nearest supported size */
  compatible: {
    length: [number, number]; width: [number, number]; height: [number, number]; wheelbase: [number, number];
    rimDia: [number, number]; rideOffset: [number, number];
  };
  /** wheel attachment nodes in the GLB (hub centres) */
  wheelMounts: { FL: string; FR: string; RL: string; RR: string };
  /** material slots the game may override */
  materials: { paint: string[]; trim: string; caliper: string; upholstery: string; accent: string; rim: string };
  /** swappable component nodes */
  components: {
    grille: { ice: string; ev: string };
    exhaust: { single: string; dual: string; quad: string };
    aero: { lip: string; wing: string; splitter: string; skirts: string };
    interior: string;
  };
  /** livery slots (race assets): material names that take team colours */
  livery?: { primary: string; secondary: string; number?: string };
  license: { author: string; license: string; source: string; notes: string };
  /** reference images that guided the modelling (see docs/asset-pipeline.md) */
  references?: string[];
}

const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
const at = (p: string) => `${base}assets/vehicles/${p}`;

export const SEDAN_REF: VehicleAsset = {
  id: 'sedan-ref',
  name: 'Reference executive saloon',
  category: 'road',
  bodies: ['sedan'],
  era: [2005, 2035],
  enginePositions: ['front'],
  lods: [
    { url: at('sedan-ref/sedan.lod0.glb'), tris: 315480, bytes: 1061144 },
    { url: at('sedan-ref/sedan.lod1.glb'), tris: 109130, bytes: 728188 },
    { url: at('sedan-ref/sedan.lod2.glb'), tris: 49349, bytes: 485344 },
  ],
  wheels: { url: at('sedan-ref/wheels.glb'), bytes: 259596, rims: ['rim_sport5', 'rim_turbine10', 'rim_multi15'], tireProfile: at('sedan-ref/tire_profile.json') },
  native: {
    length: 4.825, width: 1.89, height: 1.446, wheelbase: 2.9, trackF: 1.62, trackR: 1.63,
    frontAxleX: 1.45, rearAxleX: -1.45, frontX: 2.335, rearX: -2.49,
    tireRadius: 0.339, rimDia: 19, archRadius: 0.378, clearance: 0.17,
  },
  compatible: {
    length: [4.25, 5.3], width: [1.7, 1.96], height: [1.34, 1.56], wheelbase: [2.6, 3.2],
    rimDia: [16, 22], rideOffset: [-0.05, 0.06],
  },
  wheelMounts: { FL: 'wheel_FL', FR: 'wheel_FR', RL: 'wheel_RL', RR: 'wheel_RR' },
  materials: { paint: ['paint', 'paint_body'], trim: 'trim_chrome', caliper: 'caliper', upholstery: 'int_upholstery', accent: 'int_accent', rim: 'rim_alloy' },
  components: {
    grille: { ice: 'grille_ice', ev: 'grille_ev' },
    exhaust: { single: 'exhaust_single', dual: 'exhaust_dual', quad: 'exhaust_quad' },
    aero: { lip: 'aero_lip_spoiler', wing: 'aero_wing', splitter: 'aero_splitter', skirts: 'aero_skirts' },
    interior: 'interior',
  },
  license: {
    author: 'Automotive Empire project',
    license: 'Original work made for this project (no third-party geometry, textures or trademarks); distributed under the project\'s licence.',
    source: 'tools/blender/sedan/build.py (Blender 4.5 LTS); source scene assets-src/sedan-ref/sedan.blend',
    notes: 'Original design; proportions are generic for a mid-size saloon and no production car was traced. The plate is blank.',
  },
};

/** Every vehicle asset. Racing assets (category 'race') will join here per discipline and era. */
export const VEHICLE_ASSETS: VehicleAsset[] = [SEDAN_REF];

export const RIM_FOR_STYLE: Record<'multispoke' | 'turbine' | 'fivespoke', RimId> = {
  multispoke: 'rim_multi15', turbine: 'rim_turbine10', fivespoke: 'rim_sport5',
};
