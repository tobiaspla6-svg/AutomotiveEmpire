// Tuning Empire prototype: modification catalogue, compatibility and builds.
//
// A part changes physical hardware parameters (airflow, boost capability, intercooler effectiveness, injector flow,
// clutch capacity, ratios, grip, mass). It never applies a universal "+x % power". What the engine then produces is
// computed by engine.ts from that hardware and the calibration, so the same part gives different results on
// different engines and can be useless (or limited by something else) on its own.
//
// A Stage is a named, curated set of parts plus a calibration for ONE engine code: installing it installs those
// parts and that map, and is refused if any part does not fit or the map exceeds the hardware.
import type { Aspiration, Calibration, Drive, Tyre, Vehicle } from './types';

export type PartCategory = 'ecu' | 'intake' | 'exhaust' | 'turbo' | 'intercooler' | 'injectors' | 'clutch' | 'gearbox' | 'differential' | 'tyres' | 'weight';
export const CATEGORIES: PartCategory[] = ['ecu', 'intake', 'exhaust', 'turbo', 'intercooler', 'injectors', 'clutch', 'gearbox', 'differential', 'tyres', 'weight'];

/** Explicit hardware changes. Every field is optional; a part sets only what it physically changes. */
export interface PartEffect {
  /** extra airflow capacity (fraction) that fades in from `flowFromRpm` (restriction matters at high rpm) */
  flowGain?: number; flowFromRpm?: number;
  /** turbocharger: maximum boost it can make (bar), rpm where it reaches full boost, response time constant (s) */
  turbo?: { maxBoostBar: number; fullBoostRpm: number; lagS: number };
  /** intercooler effectiveness (0–1); a stock top-mount ≈ 0.55, a front-mount ≈ 0.75 */
  intercoolerEff?: number;
  injectorCcMin?: number;
  clutchCapNm?: number;
  gears?: number[]; shiftTimeS?: number;
  finalDrive?: number; diffTraction?: number;
  tyre?: Tyre;
  massDeltaKg?: number;
  /** the ECU can be recalibrated (without it the calibration must stay stock) */
  remappable?: boolean;
}

export interface Part {
  id: string; category: PartCategory; name: string; price: number;
  fits: { engineCodes?: string[]; aspiration?: Aspiration; platforms?: string[]; gearboxPatterns?: string[]; drives?: Drive[]; wheelInch?: number[] };
  effect: PartEffect;
}

export interface Stage { id: string; name: string; engineCode: string; parts: string[]; calibration: Omit<Calibration, 'launchRpm' | 'shiftRpm'> & Partial<Pick<Calibration, 'launchRpm' | 'shiftRpm'>> }

/** Why a part cannot be installed on this vehicle (null = it fits). */
export function partFitProblem(p: Part, v: Vehicle): string | null {
  const f = p.fits, e = v.engine, d = v.drivetrain;
  if (f.engineCodes && !f.engineCodes.includes(e.code)) return `${p.name}: hecho para el motor ${f.engineCodes.join('/')}; este auto tiene ${e.code}`;
  if (f.aspiration && f.aspiration !== e.aspiration) return `${p.name}: necesita un motor ${f.aspiration === 'turbo' ? 'turbo' : 'atmosférico'}`;
  if (f.platforms && !f.platforms.includes(v.platform)) return `${p.name}: hecho para la plataforma ${f.platforms.join('/')}; este auto es ${v.platform}`;
  if (f.gearboxPatterns && !f.gearboxPatterns.includes(d.gearboxPattern)) return `${p.name}: campana de caja ${f.gearboxPatterns.join('/')}; este auto tiene ${d.gearboxPattern}`;
  if (f.drives && !f.drives.includes(d.drive)) return `${p.name}: para autos ${f.drives.join('/')}; este es ${d.drive}`;
  if (f.wheelInch && !f.wheelInch.includes(v.tyre.wheelInch)) return `${p.name}: para llantas de ${f.wheelInch.join('/')} pulgadas; este auto usa ${v.tyre.wheelInch}`;
  return null;
}

export interface Build { vehicle: Vehicle; parts: string[]; calibration: Calibration }
/** The hardware after the parts are fitted (what engine.ts and drag.ts compute with). */
export interface Hardware {
  vehicle: Vehicle;
  turbo: { maxBoostBar: number; fullBoostRpm: number; lagS: number } | null;
  intercoolerEff: number;
  flow: { gain: number; fromRpm: number }[];
  injectorCcMin: number;
  remappable: boolean;
}

/** Stock turbo of a turbo engine: what the factory boost needs, no more (it is already near its limit). */
export const stockTurbo = (v: Vehicle) => v.engine.aspiration === 'turbo' ? { maxBoostBar: v.engine.stockBoostBar + 0.25, fullBoostRpm: 3400, lagS: 0.45 } : null;
export const STOCK_INTERCOOLER = 0.55;

export function stockCalibration(v: Vehicle): Calibration {
  return { boostBar: v.engine.stockBoostBar, revLimit: v.engine.revLimit, launchRpm: Math.round(Math.min(v.engine.revLimit * 0.55, 4000)), shiftRpm: v.engine.revLimit, timingDeg: 0 };
}

/**
 * Fit parts to a vehicle: one part per category (a second part of the same category replaces the first), each checked
 * for fit. Returns the resulting hardware and every problem; an incompatible part is NOT installed.
 */
export function fitParts(base: Vehicle, ids: string[], catalogue: Record<string, Part>): { hw: Hardware; installed: string[]; errors: string[] } {
  const errors: string[] = [];
  const byCat = new Map<PartCategory, Part>();
  for (const id of ids) {
    const p = catalogue[id];
    if (!p) { errors.push(`pieza desconocida: ${id}`); continue; }
    const why = partFitProblem(p, base);
    if (why) { errors.push(why); continue; }
    byCat.set(p.category, p);
  }
  const v: Vehicle = JSON.parse(JSON.stringify(base));
  const hw: Hardware = { vehicle: v, turbo: stockTurbo(base), intercoolerEff: base.engine.aspiration === 'turbo' ? STOCK_INTERCOOLER : 0, flow: [], injectorCcMin: base.engine.injectorCcMin, remappable: false };
  for (const p of byCat.values()) {
    const e = p.effect;
    if (e.flowGain) hw.flow.push({ gain: e.flowGain, fromRpm: e.flowFromRpm ?? 0 });
    if (e.turbo) hw.turbo = { ...e.turbo };
    if (e.intercoolerEff !== undefined) hw.intercoolerEff = e.intercoolerEff;
    if (e.injectorCcMin) hw.injectorCcMin = e.injectorCcMin;
    if (e.clutchCapNm) v.drivetrain.clutchCapNm = e.clutchCapNm;
    if (e.gears) v.drivetrain.gears = [...e.gears];
    if (e.shiftTimeS) v.drivetrain.shiftTimeS = e.shiftTimeS;
    if (e.finalDrive) v.drivetrain.finalDrive = e.finalDrive;
    if (e.diffTraction) v.drivetrain.diffTraction = e.diffTraction;
    if (e.tyre) v.tyre = { ...e.tyre };
    if (e.massDeltaKg) v.massKg += e.massDeltaKg;
    if (e.remappable) hw.remappable = true;
  }
  return { hw, installed: [...byCat.values()].map((p) => p.id), errors };
}

/** Problems with a calibration on this hardware (empty = the ECU accepts it). Knock limit: see engine.ts. */
export function calibrationProblems(hw: Hardware, c: Calibration): string[] {
  const e = hw.vehicle.engine, errs: string[] = [];
  const stock = stockCalibration(hw.vehicle);
  const mapChanged = c.boostBar !== stock.boostBar || c.revLimit !== stock.revLimit || c.timingDeg !== 0;
  if (mapChanged && !hw.remappable) errs.push('la ECU de serie no se puede recalibrar: instalá antes una reprogramación o una ECU programable');
  if (c.revLimit > e.mechanicalLimitRpm) errs.push(`corte de vueltas ${c.revLimit} por encima del límite de la distribución (${e.mechanicalLimitRpm})`);
  if (c.revLimit < e.idleRpm + 2000) errs.push('corte de vueltas demasiado bajo');
  if (e.aspiration === 'na' && c.boostBar !== 0) errs.push('un motor atmosférico no tiene presión de turbo que ajustar');
  if (hw.turbo && c.boostBar > hw.turbo.maxBoostBar) errs.push(`${c.boostBar} bar supera lo que puede dar este turbo (${hw.turbo.maxBoostBar} bar)`);
  if (c.boostBar < 0) errs.push('la presión no puede ser negativa');
  if (c.timingDeg > knockLimitDeg(hw, c.boostBar)) errs.push(`avance +${c.timingDeg}° detona a ${c.boostBar} bar con este intercooler (límite +${knockLimitDeg(hw, c.boostBar).toFixed(1)}°)`);
  if (c.launchRpm < e.idleRpm || c.launchRpm > c.revLimit) errs.push('régimen de largada fuera del rango ralentí…corte');
  if (c.shiftRpm > c.revLimit) errs.push('punto de cambio por encima del corte');
  return errs;
}

/** Spare advance before knock: less with more boost and hotter charge (simplified, documented in docs/phase6). */
export function knockLimitDeg(hw: Hardware, boostBar: number): number {
  const e = hw.vehicle.engine;
  if (e.aspiration === 'na') return 3;
  const extra = Math.max(0, boostBar - e.stockBoostBar);
  return 4 - extra * 6 * (1.2 - hw.intercoolerEff);
}

/** Resolve a stage for a vehicle: its parts (each must fit) and its calibration (must pass on that hardware). */
export function applyStage(v: Vehicle, s: Stage, catalogue: Record<string, Part>, extra: string[] = []): { build: Build | null; errors: string[] } {
  if (s.engineCode !== v.engine.code) return { build: null, errors: [`${s.name} es para el motor ${s.engineCode}; este auto tiene ${v.engine.code}`] };
  const { hw, errors } = fitParts(v, [...s.parts, ...extra], catalogue);
  const cal: Calibration = { ...stockCalibration(v), ...s.calibration };
  cal.shiftRpm = Math.min(cal.shiftRpm, cal.revLimit);
  const calErr = calibrationProblems(hw, cal);
  const all = [...errors, ...calErr];
  return { build: all.length ? null : { vehicle: v, parts: [...s.parts, ...extra], calibration: cal }, errors: all };
}
