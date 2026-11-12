// Shared engineering (Phase 3): engine families and vehicle platforms.
//
// A car is still described by one VehicleSpec — the physics, cost model and renderer read only that.
// What changes is where its parts come from:
//   • an ENGINE FAMILY fixes the block: layout, bore/stroke ratio, valvetrain, fuel system, block material
//     and a displacement envelope. VARIANTS of the family set displacement (by bore and stroke),
//     aspiration, boost, compression, rev limit, cam, variable timing and hybrid assistance.
//   • a PLATFORM fixes the structure: body-style group, chassis construction, engine position and bay
//     size, transaxle, drivetrains, suspension pick-up points, crash structure and a size (wheelbase and
//     track) range.
//   • the VEHICLE adds the body, size within the platform's range, panels, cabin, wheels, tyres, brakes,
//     aero, gearbox, tuning and build quality.
//
// Development cost of a car splits into those three parts (ENGINE 30 %, PLATFORM 35 %, VEHICLE 35 % —
// the shares the game already used for new-generation carry-over). A car that brings a new engine and
// a new platform pays all three, exactly as before; a car that re-uses them pays only its own share
// plus the calibration of any new engine variant. Shared parts are also bought in larger volumes
// (cheaper per car), tooled once per plant, mature with production — and fail together.
import type {
  BodyType, Company, EngineBay, EngineFamily, EngineLayout, EngineSpec, EngineVariant, GameState, Platform, PlatformClass, Tech, VehicleModel, VehicleSpec,
} from './types';
import { computeVehicle } from './engineering';
import { clamp } from './util';

export const SHARE = { engine: 0.3, platform: 0.35, vehicle: 0.35 } as const;
/** Displacement envelope of an engine family (by bore and stroke), relative to the displacement it was designed around. */
export const DISP_RANGE = [0.8, 1.25] as const;
/** Motor power envelope of an electric drive unit. */
export const MOTOR_RANGE = [0.5, 2] as const;
/** How far a platform stretches (wheelbase and track) around its base size. */
export const SIZE_STRETCH = 0.07;

export const BAY: Record<EngineLayout, EngineBay> = {
  I2: 'compact', I3: 'compact', I4: 'compact', F4: 'compact', EV: 'compact', I5: 'medium', V6: 'medium', F6: 'medium', I6: 'large', V8: 'large', V10: 'large', V12: 'large', F12: 'large',
};
const BAY_RANK: Record<EngineBay, number> = { compact: 0, medium: 1, large: 2 };
export const BAY_NAME: Record<EngineBay, string> = { compact: 'up to four cylinders', medium: 'up to a V6 / flat-six', large: 'any engine' };
export const PLATFORM_BODIES: Record<PlatformClass, BodyType[]> = {
  car: ['hatch', 'sedan', 'wagon', 'coupe', 'suv'],
  sports: ['coupe', 'roadster', 'supercar'],
  truck: ['pickup', 'suv'],
};
export const CLASS_NAME: Record<PlatformClass, string> = { car: 'Car (hatch, saloon, estate, coupé, crossover)', sports: 'Sports (coupé, roadster, supercar)', truck: 'Body-on-frame (pickup, SUV)' };
export const classOfBody = (b: BodyType, chassis?: string): PlatformClass => (b === 'pickup' || chassis === 'ladder' ? 'truck' : b === 'supercar' || b === 'roadster' ? 'sports' : 'car');

export const enginesOf = (c: Company): EngineFamily[] => c.engines ?? [];
export const platformsOf = (c: Company): Platform[] => c.platforms ?? [];
export const familyOf = (c: Company, m: VehicleModel) => (m.engineFamilyId ? enginesOf(c).find((f) => f.id === m.engineFamilyId) : undefined);
export const platformOf = (c: Company, m: VehicleModel) => (m.platformId ? platformsOf(c).find((p) => p.id === m.platformId) : undefined);
const live = (m: VehicleModel) => m.status !== 'retired';
export const familyUsers = (c: Company, id: string) => c.models.filter((m) => live(m) && m.engineFamilyId === id);
export const platformUsers = (c: Company, id: string) => c.models.filter((m) => live(m) && m.platformId === id);

// ------------------------------------------------------------------------------------------ engines

export function familyEngine(f: EngineFamily, v: EngineVariant): EngineSpec {
  return {
    layout: f.layout, displacement: v.displacement, boreStroke: f.boreStroke, valvetrain: f.valvetrain, aspiration: v.aspiration, boost: v.boost,
    compression: v.compression, redline: v.redline, cam: v.cam, fuelSystem: f.fuelSystem, vvt: v.vvt, aluBlock: f.aluBlock, hybridKw: v.hybridKw,
    motorKw: v.motorKw, batteryKwh: v.batteryKwh,
  };
}
/** Why an engine specification cannot be built on this family (empty = it can). */
export function engineFits(f: EngineFamily, e: EngineSpec): string[] {
  const why: string[] = [];
  if (e.layout !== f.layout) return [`The family is a ${f.layout === 'EV' ? 'electric drive unit' : f.layout} — a ${e.layout === 'EV' ? 'motor' : e.layout} needs a new family.`];
  if (f.layout === 'EV') {
    if (e.motorKw < f.baseMotorKw * MOTOR_RANGE[0] || e.motorKw > f.baseMotorKw * MOTOR_RANGE[1]) why.push(`Motor power must stay between ${Math.round(f.baseMotorKw * MOTOR_RANGE[0])} and ${Math.round(f.baseMotorKw * MOTOR_RANGE[1])} kW on this drive unit.`);
    return why;
  }
  if (e.valvetrain !== f.valvetrain) why.push('A different valvetrain means a new cylinder head: a new family.');
  if (e.fuelSystem !== f.fuelSystem) why.push('A different fuel system means a new family.');
  if (e.aluBlock !== f.aluBlock) why.push('A different block material means a new family.');
  if (Math.abs(e.boreStroke - f.boreStroke) > 0.05) why.push('The bore/stroke ratio can change by at most ±0.05 within a family.');
  const lo = f.baseDisplacement * DISP_RANGE[0], hi = f.baseDisplacement * DISP_RANGE[1];
  if (e.displacement < lo - 0.5 || e.displacement > hi + 0.5) why.push(`Displacement must stay between ${Math.round(lo)} and ${Math.round(hi)} cc on this block.`);
  return why;
}
const variantKey = (v: Pick<EngineVariant, 'displacement' | 'aspiration' | 'boost' | 'compression' | 'redline' | 'cam' | 'vvt' | 'hybridKw' | 'motorKw' | 'batteryKwh'>, ev: boolean) =>
  ev ? `${Math.round(v.motorKw)}:${Math.round(v.batteryKwh)}` : [Math.round(v.displacement), v.aspiration, v.aspiration === 'na' ? 0 : v.boost.toFixed(2), v.compression.toFixed(1), Math.round(v.redline / 100), v.cam.toFixed(2), v.vvt, Math.round(v.hybridKw)].join(':');
export function findVariant(f: EngineFamily, e: EngineSpec): EngineVariant | undefined {
  const k = variantKey(e, f.layout === 'EV');
  return f.variants.find((v) => variantKey(v, f.layout === 'EV') === k);
}
export function tuneOf(e: EngineSpec): EngineVariant['tune'] {
  if (e.layout === 'EV') return e.motorKw >= 250 ? 'performance' : 'standard';
  return e.cam >= 0.55 || (e.aspiration !== 'na' && e.boost >= 1.2) ? 'performance' : e.cam <= 0.2 || e.hybridKw > 0 ? 'economy' : 'standard';
}
export function variantName(f: Pick<EngineFamily, 'layout'>, e: EngineSpec): string {
  if (e.layout === 'EV') return `${Math.round(e.motorKw)} kW / ${Math.round(e.batteryKwh)} kWh`;
  const asp = { na: '', turbo: ' Turbo', twinturbo: ' Twin-turbo', supercharged: ' Supercharged' }[e.aspiration];
  return `${(e.displacement / 1000).toFixed(1)}${asp}${e.hybridKw > 0 ? ' Hybrid' : ''} (${tuneOf(e)})`;
  void f;
}
export function makeVariant(g: GameState, f: Pick<EngineFamily, 'layout'>, e: EngineSpec, devCost = 0, readyIn = 0): EngineVariant {
  return {
    id: `v${g.nextId++}`, name: variantName(f, e), tune: tuneOf(e), displacement: e.displacement, aspiration: e.aspiration, boost: e.boost, compression: e.compression,
    redline: e.redline, cam: e.cam, vvt: e.vvt, hybridKw: e.hybridKw, motorKw: e.motorKw, batteryKwh: e.batteryKwh, status: readyIn > 0 ? 'development' : 'ready', readyIn, devCost,
  };
}
export function makeFamily(g: GameState, name: string, e: EngineSpec, techYear: number, introYear: number): EngineFamily {
  const f: EngineFamily = {
    id: `ef${g.nextId++}`, name, layout: e.layout, boreStroke: e.boreStroke, valvetrain: e.valvetrain, fuelSystem: e.fuelSystem, aluBlock: e.aluBlock,
    baseDisplacement: e.displacement, baseMotorKw: e.motorKw, techYear, introYear, variants: [], history: [], cumulativeUnits: 0,
    status: 'ready', devMonthsLeft: 0, devMonthsTotal: 0, devCostPaid: 0, devCostTotal: 0,
  };
  f.variants.push(makeVariant(g, f, e));
  return f;
}

// ---------------------------------------------------------------------------------------- platforms

function drivesFor(s: VehicleSpec): Platform['drives'] {
  if (s.engine.layout === 'EV') return ['FWD', 'RWD', 'AWD'];
  if (s.enginePos === 'front') return s.drive === 'FWD' ? ['FWD', 'AWD'] : ['RWD', 'AWD'];
  return ['RWD', 'AWD'];
}
export function makePlatform(g: GameState, name: string, s: VehicleSpec, techYear: number, introYear: number): Platform {
  return {
    id: `pf${g.nextId++}`, name, cls: classOfBody(s.body, s.chassis), chassis: s.chassis, enginePos: s.enginePos, transaxle: !!s.transaxle && s.enginePos === 'front' && s.drive !== 'FWD',
    drives: drivesFor(s), bay: BAY[s.engine.layout], baseSize: s.size, sizeMin: s.size * (1 - SIZE_STRETCH), sizeMax: s.size * (1 + SIZE_STRETCH),
    suspFront: s.suspFront, suspRear: s.suspRear, safety: s.safety, techYear, introYear, history: [], cumulativeUnits: 0,
    status: 'ready', devMonthsLeft: 0, devMonthsTotal: 0, devCostPaid: 0, devCostTotal: 0,
  };
}
/** Why a vehicle specification cannot be built on this platform (empty = it can). */
export function platformFits(p: Platform, s: VehicleSpec): string[] {
  const why: string[] = [];
  if (!PLATFORM_BODIES[p.cls].includes(s.body)) why.push(`A ${s.body} body does not fit a ${p.cls} platform.`);
  if (s.chassis !== p.chassis) why.push('The chassis construction is fixed by the platform.');
  if (s.enginePos !== p.enginePos) why.push(`The platform carries its engine at the ${p.enginePos}.`);
  if (!p.drives.includes(s.drive)) why.push(`The platform supports ${p.drives.join(' / ')} only.`);
  if (BAY_RANK[BAY[s.engine.layout]] > BAY_RANK[p.bay]) why.push(`The engine bay takes ${BAY_NAME[p.bay]}.`);
  if (s.size < p.sizeMin - 1e-6 || s.size > p.sizeMax + 1e-6) why.push(`Size must stay between ${p.sizeMin.toFixed(2)} and ${p.sizeMax.toFixed(2)} on this platform.`);
  if (s.suspFront !== p.suspFront || s.suspRear !== p.suspRear) why.push('Suspension pick-up points are fixed by the platform.');
  if (s.safety !== p.safety) why.push('The crash structure is fixed by the platform.');
  if (p.enginePos === 'front' && s.drive !== 'FWD' && !!s.transaxle !== p.transaxle) why.push(p.transaxle ? 'The platform has a rear transaxle.' : 'The platform has no rear transaxle.');
  return why;
}
/** Make a specification follow a platform: fixed hardpoints are copied, size and drive are moved into range. The body is left alone. */
export function applyPlatform(s: VehicleSpec, p: Platform): VehicleSpec {
  const out: VehicleSpec = {
    ...s, chassis: p.chassis, enginePos: p.enginePos, suspFront: p.suspFront, suspRear: p.suspRear, safety: p.safety,
    size: clamp(s.size, p.sizeMin, p.sizeMax), drive: p.drives.includes(s.drive) ? s.drive : p.drives[0],
  };
  out.transaxle = p.enginePos === 'front' && out.drive !== 'FWD' ? p.transaxle : false;
  return out; // the body is the vehicle's own choice: an incompatible one is reported by platformFits, never swapped
}

// --------------------------------------------------------------------------------- maturity & sharing

/**
 * Reliability gained by an architecture in service: early faults are found and fixed. About +1.5 points a year
 * in production up to +6, and +2 for every open recall (up to +4); a quiet fix teaches nothing.
 */
export function maturity(x: { introYear: number; history: { kind: string }[] } | undefined, year: number): number {
  if (!x) return 0;
  const recalls = x.history.filter((h) => h.kind === 'recall' || h.kind === 'exposed').length;
  return Math.min(6, Math.max(0, year - x.introYear) * 1.5) + Math.min(4, recalls * 2);
}
export function maturityOf(c: Company | undefined, m: VehicleModel, year: number) {
  if (!c) return { engine: 0, platform: 0 };
  return { engine: maturity(familyOf(c, m), year), platform: maturity(platformOf(c, m), year) };
}

/** Grouping keys: explicit families and platforms, or — for AI makers, which do not model them — a key from the spec. */
export function engineKey(m: VehicleModel): string {
  if (m.engineFamilyId) return `fam:${m.engineFamilyId}`;
  const e = m.spec.engine;
  return e.layout === 'EV' ? `EV:${Math.round(e.motorKw / 25)}` : `${e.layout}:${e.aspiration}:${Math.round(Math.log(e.displacement) / Math.log(1.1))}`;
}
export function platformKey(m: VehicleModel): string {
  if (m.platformId) return `plat:${m.platformId}`;
  const s = m.spec;
  return `${classOfBody(s.body, s.chassis)}:${s.chassis}:${s.enginePos}:${Math.round(s.size * 10)}`;
}
/** Monthly rate a model is built at, for sharing purposes: line capacity for the player, recent sales for AI makers. */
function rate(c: Company, m: VehicleModel): number {
  if (c.isPlayer) {
    let cap = 0;
    for (const f of c.factories) for (const l of f.lines) if (l.modelId === m.id) cap += f.capacity * l.share;
    return cap;
  }
  return m.lastDemand;
}
export interface SharedVolume { engine: number; platform: number }
/** Monthly volume of this car's engine family and platform, counting the car itself at `own` units a month. */
export function sharedVolume(c: Company, m: VehicleModel, own: number): SharedVolume {
  const ek = engineKey(m), pk = platformKey(m);
  let engine = own, platform = own;
  for (const x of c.models) {
    if (x === m || (x.status !== 'production' && x.status !== 'ready')) continue;
    const r = rate(c, x);
    if (!r) continue;
    if (engineKey(x) === ek) engine += r;
    if (platformKey(x) === pk) platform += r;
  }
  return { engine, platform };
}

// ------------------------------------------------------------------------------------ programme plans

export type EngineChoice = { kind: 'new'; name?: string } | { kind: 'family'; familyId: string };
export type PlatformChoice = { kind: 'new'; name?: string } | { kind: 'platform'; platformId: string };
export interface DevPlan {
  ok: boolean; errors: string[];
  /** the car's specification after the platform's hardpoints are applied */
  spec: VehicleSpec;
  engine: { kind: 'new' | 'existing' | 'variant'; family?: EngineFamily; variant?: EngineVariant; cost: number; months: number };
  platform: { kind: 'new' | 'existing'; platform?: Platform; cost: number };
  vehicleCost: number; total: number; months: number;
  /** what the car would cost with everything new: the saving is fullCost − total */
  fullCost: number;
  /** a stand-alone family or platform still in development delays the car until it is ready */
  waitsFor: string[];
}

/** Calibration cost of a new variant on an existing engine family, as a share of the family's engineering cost. */
export function variantShare(f: EngineFamily, e: EngineSpec): number {
  const base = f.variants[0];
  let k = 0.06; // calibration, emissions and durability testing
  if (base && e.aspiration !== base.aspiration && (e.aspiration === 'na') !== (base.aspiration === 'na')) k += 0.12; // turbo hardware on an NA block (or back)
  if (e.hybridKw > 0 && !f.variants.some((v) => v.hybridKw > 0)) k += 0.1; // first hybrid system
  if (Math.abs(e.displacement - f.baseDisplacement) / f.baseDisplacement > 0.12) k += 0.04; // new crank, pistons or liners
  return k;
}

/** Plan a vehicle programme: what it re-uses, what it develops, what it costs and how long it takes. */
export function planDevelopment(g: GameState, c: Company, spec: VehicleSpec, engine: EngineChoice, platform: PlatformChoice, tech: Tech = c.tech): DevPlan {
  const errors: string[] = [];
  let s = JSON.parse(JSON.stringify(spec)) as VehicleSpec;
  let plat: Platform | undefined;
  if (platform.kind === 'platform') {
    plat = platformsOf(c).find((p) => p.id === platform.platformId);
    if (!plat) errors.push('Unknown platform.');
    else { s = applyPlatform(s, plat); errors.push(...platformFits(plat, s)); }
  }
  let fam: EngineFamily | undefined;
  if (engine.kind === 'family') {
    fam = enginesOf(c).find((f) => f.id === engine.familyId);
    if (!fam) errors.push('Unknown engine family.');
    else errors.push(...engineFits(fam, s.engine));
  }
  const st = computeVehicle(s, { year: g.year, tech });
  const full = st.devCost;
  const eShare = full * SHARE.engine, pShare = full * SHARE.platform, vShare = full * SHARE.vehicle;
  let eng: DevPlan['engine'];
  if (fam) {
    const v = findVariant(fam, s.engine);
    if (v) eng = { kind: 'existing', family: fam, variant: v, cost: 0, months: 0 };
    else { const k = variantShare(fam, s.engine); eng = { kind: 'variant', family: fam, cost: eShare * k, months: Math.round(3 + 20 * k) }; }
  } else eng = { kind: 'new', cost: eShare, months: st.devMonths };
  const pl: DevPlan['platform'] = plat ? { kind: 'existing', platform: plat, cost: 0 } : { kind: 'new', cost: pShare };
  const total = vShare + eng.cost + pl.cost;
  const k = total / full;
  const months = Math.max(8, Math.round(st.devMonths * (0.45 + 0.55 * k)), eng.kind === 'variant' ? eng.months : 0);
  const waitsFor: string[] = [];
  if (fam && fam.status !== 'ready' && !fam.ownerModelId) waitsFor.push(`${fam.name} (${Math.ceil(fam.devMonthsLeft)} months)`);
  if (plat && plat.status !== 'ready' && !plat.ownerModelId) waitsFor.push(`${plat.name} (${Math.ceil(plat.devMonthsLeft)} months)`);
  return { ok: errors.length === 0, errors, spec: s, engine: eng, platform: pl, vehicleCost: vShare, total, months, fullCost: full, waitsFor };
}

/**
 * What engineering re-uses unless told otherwise: the predecessor's architecture first, then any family or platform
 * the company already has (an existing variant before a new one); anything that does not fit is developed new.
 */
export function defaultChoice(c: Company, spec: VehicleSpec, base?: VehicleModel): { engine: EngineChoice; platform: PlatformChoice } {
  const fams = enginesOf(c), plats = platformsOf(c);
  const fitsE = (f: EngineFamily) => engineFits(f, spec.engine).length === 0;
  const baseFam = base?.engineFamilyId ? fams.find((f) => f.id === base.engineFamilyId) : undefined;
  const basePlat = base?.platformId ? plats.find((p) => p.id === base.platformId) : undefined;
  const fam = (baseFam && fitsE(baseFam) ? baseFam : undefined) ?? fams.find((f) => fitsE(f) && findVariant(f, spec.engine)) ?? fams.find(fitsE);
  const plat = (basePlat && platformFits(basePlat, spec).length === 0 ? basePlat : undefined) ?? plats.find((p) => platformFits(p, spec).length === 0);
  return { engine: fam ? { kind: 'family', familyId: fam.id } : { kind: 'new' }, platform: plat ? { kind: 'platform', platformId: plat.id } : { kind: 'new' } };
}

/** Cost and duration of developing an engine family or a platform on its own (from a reference car that uses it). */
export function standaloneCost(g: GameState, ref: VehicleSpec, what: 'engine' | 'platform', tech: Tech) {
  const st = computeVehicle(ref, { year: g.year, tech });
  // a stand-alone programme costs a little more than the bundled share: it has to be validated in mule cars
  const cost = st.devCost * (what === 'engine' ? SHARE.engine : SHARE.platform) * 1.08;
  const months = Math.max(10, Math.round(st.devMonths * (what === 'engine' ? 0.75 : 0.8)));
  return { cost, months };
}

/** Give a company explicit families and platforms for the cars it already builds (new CEO games, old saves, acquisitions). */
export function adoptFamilies(g: GameState, c: Company) {
  c.engines ??= []; c.platforms ??= [];
  for (const m of c.models) {
    if (m.status === 'retired' || m.status === 'design') continue;
    const intro = m.launchYear || m.designYear;
    if (!m.engineFamilyId) {
      let f = c.engines.find((x) => engineFits(x, m.spec.engine).length === 0);
      if (!f) { f = makeFamily(g, `${m.name} ${m.spec.engine.layout === 'EV' ? 'drive unit' : m.spec.engine.layout}`, m.spec.engine, m.frozenTech.engine, intro); c.engines.push(f); f.cumulativeUnits = m.cumulativeUnits; }
      else { f.introYear = Math.min(f.introYear, intro); f.cumulativeUnits += m.cumulativeUnits; }
      let v = findVariant(f, m.spec.engine);
      if (!v) { v = makeVariant(g, f, m.spec.engine); f.variants.push(v); }
      m.engineFamilyId = f.id; m.engineVariantId = v.id;
    }
    if (!m.platformId) {
      let p = c.platforms.find((x) => platformFits(x, m.spec).length === 0);
      if (!p) { p = makePlatform(g, `${m.name} platform`, m.spec, m.frozenTech.chassis, intro); c.platforms.push(p); p.cumulativeUnits = m.cumulativeUnits; }
      else { p.introYear = Math.min(p.introYear, intro); p.cumulativeUnits += m.cumulativeUnits; }
      m.platformId = p.id;
    }
  }
}
