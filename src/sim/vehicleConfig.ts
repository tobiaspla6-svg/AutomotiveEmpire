// Visual vehicle configuration (Phase 5C): what the design studio lets the player change, stored as structured data
// per vehicle (never as an image). Each body family has its own anchor version and the parts that have a real,
// approved visual asset are marked as such; parts without an asset can be chosen only where they make sense and the
// studio says which representation is missing. Structural changes (an open roof on a fixed-roof saloon) need another
// body family and are never simulated by hiding a layer. Mechanical changes are not here: they stay in the vehicle
// specification and go through the engineering workshop and the simulator's rules.
import type { BodyType, GameState, VehicleModel } from './types';
import { player } from './world';

/** Family assets: whether the body family has approved art at all. */
export type AssetState = 'available' | 'missing';
/**
 * Part art: `layer` = a separate, aligned layer that can change on its own (today: the two wheels, and ride height,
 * which moves the body layer against them); `base` = the part exists only inside the base body layer (it is drawn,
 * but it cannot be swapped or removed separately yet); `missing` = no art at all.
 */
export type PartArt = 'layer' | 'base' | 'missing';
export interface BodyFamily {
  id: string; es: string; en: string; anchorVersion: string | null; asset: AssetState;
  /** body types (simulation) this family can represent */
  bodies: BodyType[]; minYear: number;
  /** roof constructions this family's structure supports */
  roofs: RoofType[];
}
export type RoofType = 'fixed' | 'panoramic' | 'soft-top' | 'canvas-sunroof' | 'retractable-hardtop';

/** The GT-01 base derived from the Flow original; the open-top family is planned but has no asset. */
export const BODY_FAMILIES: BodyFamily[] = [
  { id: 'gt01-fastback', es: 'GT-01 fastback cuatro puertas', en: 'GT-01 four-door fastback', anchorVersion: 'gt01-native-1', asset: 'available', bodies: ['sedan', 'coupe'], minYear: 2005, roofs: ['fixed', 'panoramic', 'canvas-sunroof'] },
  { id: 'gt01-open', es: 'GT-01 descapotable (estructura propia)', en: 'GT-01 open top (own structure)', anchorVersion: null, asset: 'missing', bodies: ['roadster'], minYear: 2005, roofs: ['soft-top', 'retractable-hardtop'] },
];
export const familyFor = (body: BodyType, year: number): BodyFamily | null => BODY_FAMILIES.find((f) => f.asset === 'available' && f.bodies.includes(body) && year >= f.minYear) ?? null;

export type PartCategory = 'body' | 'bumpers' | 'lights' | 'handles' | 'mirrors' | 'wheels' | 'suspension' | 'paint' | 'roof' | 'interior' | 'powertrain' | 'aero';
export const PART_CATEGORIES: PartCategory[] = ['body', 'bumpers', 'lights', 'handles', 'mirrors', 'wheels', 'suspension', 'paint', 'roof', 'interior', 'powertrain', 'aero'];

export interface PartOption {
  id: string; slot: string; es: string; en: string; asset: PartArt;
  /** a different structure: the option belongs to another body family */
  family?: string;
  /** only for electrified powertrains */
  needsElectric?: boolean;
  /** cut-out of the original used as a thumbnail (native px of the GT-01 original), for parts that exist in it */
  thumb?: [number, number, number, number];
}

/** Every visual part the studio knows, with the state of its art (see PartArt). Options without art exist in the
 *  data model and can be recorded, but the studio says they are not drawn; nothing is faked. */
export const PARTS: Record<Exclude<PartCategory, 'paint' | 'interior' | 'powertrain'>, PartOption[]> = {
  body: [
    { id: 'body-standard', slot: 'bodykit', es: 'Carrocería estándar', en: 'Standard body', asset: 'base', thumb: [90, 190, 1200, 390] },
    { id: 'body-sport-kit', slot: 'bodykit', es: 'Kit deportivo (faldones)', en: 'Sport kit (skirts)', asset: 'missing' },
  ],
  bumpers: [
    { id: 'bumper-front-standard', slot: 'bumperFront', es: 'Paragolpes delantero estándar', en: 'Standard front bumper', asset: 'base', thumb: [86, 395, 160, 145] },
    { id: 'bumper-front-sport', slot: 'bumperFront', es: 'Paragolpes delantero deportivo', en: 'Sport front bumper', asset: 'missing' },
    { id: 'grille-standard', slot: 'grille', es: 'Parrilla de panal', en: 'Honeycomb grille', asset: 'base', thumb: [88, 410, 70, 100] },
  ],
  lights: [
    { id: 'headlamp-led-slim', slot: 'headlamps', es: 'Faros LED finos', en: 'Slim LED headlamps', asset: 'base', thumb: [110, 360, 112, 52] },
    { id: 'headlamp-matrix', slot: 'headlamps', es: 'Faros matriciales', en: 'Matrix headlamps', asset: 'missing' },
    { id: 'taillamp-blade', slot: 'taillamps', es: 'Pilotos traseros en cuchilla', en: 'Blade tail lamps', asset: 'base', thumb: [1178, 318, 104, 74] },
  ],
  handles: [
    { id: 'handle-conventional', slot: 'handles', es: 'Manijas convencionales', en: 'Conventional handles', asset: 'base', thumb: [664, 338, 88, 40] },
    { id: 'handle-flush', slot: 'handles', es: 'Manijas enrasadas', en: 'Flush handles', asset: 'missing' },
  ],
  mirrors: [
    { id: 'mirror-standard', slot: 'mirrors', es: 'Espejos de carrocería', en: 'Body-colour mirrors', asset: 'base', thumb: [532, 276, 76, 64] },
    { id: 'mirror-camera', slot: 'mirrors', es: 'Retrovisores de cámara', en: 'Camera mirrors', asset: 'missing' },
  ],
  wheels: [
    { id: 'wheel-gt01-twin5', slot: 'wheels', es: 'Llantas de cinco radios dobles', en: 'Twin five-spoke wheels', asset: 'layer', thumb: [226, 383, 192, 192] },
    { id: 'wheel-multispoke', slot: 'wheels', es: 'Llantas multirradio', en: 'Multi-spoke wheels', asset: 'missing' },
    { id: 'wheel-fivespoke', slot: 'wheels', es: 'Llantas de cinco radios', en: 'Five-spoke wheels', asset: 'missing' },
  ],
  suspension: [
    { id: 'ride-low', slot: 'rideHeight', es: 'Altura rebajada (−2 cm)', en: 'Lowered (−2 cm)', asset: 'layer' },
    { id: 'ride-stock', slot: 'rideHeight', es: 'Altura de serie', en: 'Stock height', asset: 'layer' },
    { id: 'ride-raised', slot: 'rideHeight', es: 'Altura elevada (+2 cm)', en: 'Raised (+2 cm)', asset: 'layer' },
  ],
  roof: [
    { id: 'roof-fixed', slot: 'roof', es: 'Techo fijo', en: 'Fixed roof', asset: 'base', thumb: [430, 190, 620, 120] },
    { id: 'roof-panoramic', slot: 'roof', es: 'Techo panorámico', en: 'Panoramic roof', asset: 'missing' },
    { id: 'roof-canvas-sunroof', slot: 'roof', es: 'Techo de lona', en: 'Canvas sunroof', asset: 'missing' },
    { id: 'roof-soft-top', slot: 'roof', es: 'Descapotable de lona', en: 'Soft top', asset: 'missing', family: 'gt01-open' },
    { id: 'roof-retractable-hardtop', slot: 'roof', es: 'Techo rígido retráctil', en: 'Retractable hard top', asset: 'missing', family: 'gt01-open' },
    { id: 'roof-solar', slot: 'roofAccessory', es: 'Panel solar en el techo', en: 'Solar roof panel', asset: 'missing', needsElectric: true },
  ],
  aero: [
    { id: 'aero-none', slot: 'spoiler', es: 'Sin alerón (labio integrado)', en: 'No spoiler (integrated lip)', asset: 'base', thumb: [1150, 290, 140, 80] },
    { id: 'aero-ducktail', slot: 'spoiler', es: 'Alerón ducktail', en: 'Ducktail spoiler', asset: 'missing' },
    { id: 'aero-wing', slot: 'spoiler', es: 'Alerón de competición', en: 'Racing wing', asset: 'missing' },
  ],
};
export const ROOF_OF: Record<string, RoofType> = { 'roof-fixed': 'fixed', 'roof-panoramic': 'panoramic', 'roof-canvas-sunroof': 'canvas-sunroof', 'roof-soft-top': 'soft-top', 'roof-retractable-hardtop': 'retractable-hardtop' };

export const PAINTS = ['#2a4f86', '#1d3557', '#315b45', '#7b1f24', '#c8352e', '#d8b16a', '#eeece5', '#9aa4b1', '#2b3038', '#101923'];
export type PaintFinishV = 'metallic' | 'solid' | 'pearl' | 'matte';
export const INTERIOR = {
  seats: ['comfort', 'sport', 'bucket'] as const,
  steering: ['round', 'flat-bottom', 'yoke'] as const,
  dashboard: ['analogue', 'digital', 'wide-screen'] as const,
  console: ['standard', 'floating'] as const,
  upholstery: ['cloth', 'leather', 'alcantara', 'vegan'] as const,
  trim: ['plastic', 'aluminium', 'wood', 'carbon'] as const,
  colour: ['#1b1d22', '#6b4a32', '#8f1d22', '#d9d3c4', '#2c3e57'] as const,
};
export interface InteriorConfig { seats: typeof INTERIOR.seats[number]; steering: typeof INTERIOR.steering[number]; dashboard: typeof INTERIOR.dashboard[number]; console: typeof INTERIOR.console[number]; upholstery: typeof INTERIOR.upholstery[number]; trim: typeof INTERIOR.trim[number]; colour: string }

export interface VehicleConfig {
  version: 1;
  bodyFamilyId: string;
  anchorVersion: string;
  /** slot → part id */
  parts: Record<string, string>;
  paint: string;
  finish: PaintFinishV;
  interior: InteriorConfig;
}

export const DEFAULT_PARTS: Record<string, string> = {
  bodykit: 'body-standard', bumperFront: 'bumper-front-standard', grille: 'grille-standard', headlamps: 'headlamp-led-slim', taillamps: 'taillamp-blade',
  handles: 'handle-conventional', mirrors: 'mirror-standard', wheels: 'wheel-gt01-twin5', rideHeight: 'ride-stock', roof: 'roof-fixed', spoiler: 'aero-none',
};
export function defaultConfig(paint = '#2a4f86', family = 'gt01-fastback'): VehicleConfig {
  const f = BODY_FAMILIES.find((x) => x.id === family)!;
  return { version: 1, bodyFamilyId: f.id, anchorVersion: f.anchorVersion ?? 'none', parts: { ...DEFAULT_PARTS }, paint, finish: 'metallic',
    interior: { seats: 'comfort', steering: 'round', dashboard: 'digital', console: 'standard', upholstery: 'leather', trim: 'aluminium', colour: '#1b1d22' } };
}

export const allParts = () => Object.values(PARTS).flat();
export const partById = (id: string) => allParts().find((p) => p.id === id);

/** Why an option cannot be fitted to this configuration (null = it can). Asset availability is reported separately. */
export function incompatibility(cfg: VehicleConfig, part: PartOption, ctx: { electric: boolean }, lang: 'es' | 'en' = 'es'): string | null {
  const es = lang === 'es';
  if (part.family && part.family !== cfg.bodyFamilyId) {
    const fam = BODY_FAMILIES.find((f) => f.id === part.family);
    return es ? `Necesita otra estructura: ${fam?.es ?? part.family}${fam?.asset === 'missing' ? ' (sin asset todavía)' : ''}.` : `Needs another structure: ${fam?.en ?? part.family}${fam?.asset === 'missing' ? ' (no asset yet)' : ''}.`;
  }
  const fam = BODY_FAMILIES.find((f) => f.id === cfg.bodyFamilyId);
  const roof = ROOF_OF[part.id];
  if (roof && fam && !fam.roofs.includes(roof)) return es ? 'Esta estructura no admite ese techo.' : 'This structure does not take that roof.';
  if (part.needsElectric && !ctx.electric) return es ? 'Requiere tren motriz eléctrico o híbrido.' : 'Needs an electric or hybrid powertrain.';
  if (part.id === 'roof-solar' && cfg.parts.roof !== 'roof-fixed' && cfg.parts.roof !== 'roof-panoramic') return es ? 'Solo sobre techo fijo o panorámico.' : 'Only on a fixed or panoramic roof.';
  return null;
}

/** Check a stored configuration: known family and anchors, known parts in their own slots, valid colours. */
export function validateConfig(cfg: unknown): string | null {
  if (!cfg || typeof cfg !== 'object') return 'not an object';
  const c = cfg as VehicleConfig;
  if (c.version !== 1) return 'unknown version';
  const fam = BODY_FAMILIES.find((f) => f.id === c.bodyFamilyId);
  if (!fam) return 'unknown body family';
  if (fam.anchorVersion && c.anchorVersion !== fam.anchorVersion) return 'anchor version does not match the family';
  if (!c.parts || typeof c.parts !== 'object') return 'no parts';
  for (const [slot, id] of Object.entries(c.parts)) { const p = partById(id); if (!p || p.slot !== slot) return `part ${id} is not a ${slot}`; }
  const hex = /^#[0-9a-f]{6}$/i;
  if (!hex.test(c.paint)) return 'bad paint';
  if (!['metallic', 'solid', 'pearl', 'matte'].includes(c.finish)) return 'bad finish';
  const i = c.interior;
  if (!i || !INTERIOR.seats.includes(i.seats) || !INTERIOR.steering.includes(i.steering) || !INTERIOR.dashboard.includes(i.dashboard) || !INTERIOR.console.includes(i.console) || !INTERIOR.upholstery.includes(i.upholstery) || !INTERIOR.trim.includes(i.trim) || !hex.test(i.colour)) return 'bad interior';
  return null;
}

/** Key under which a configuration is stored: a model id, or 'draft' for the next design. */
export type DesignKey = string;
export function configOf(c: { designs?: Record<string, VehicleConfig> }, key: DesignKey, model?: VehicleModel): VehicleConfig {
  const saved = c.designs?.[key];
  if (saved && !validateConfig(saved)) return saved;
  return defaultConfig(model?.spec.color && /^#[0-9a-f]{6}$/i.test(model.spec.color) ? model.spec.color : undefined);
}

/** Save a configuration for a model of the player (or the draft). Visual only: no money, no simulation effect. */
export function saveVehicleConfig(g: GameState, key: DesignKey, cfg: VehicleConfig): string | null {
  const c = player(g);
  if (key !== 'draft' && !c.models.some((m) => m.id === key)) return 'Unknown vehicle.';
  const err = validateConfig(cfg);
  if (err) return `Invalid configuration: ${err}.`;
  c.designs ??= {};
  c.designs[key] = JSON.parse(JSON.stringify(cfg));
  return null;
}
