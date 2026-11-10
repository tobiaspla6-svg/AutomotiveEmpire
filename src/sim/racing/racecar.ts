// Race-car performance from its specification, development state and the regulations in force.
// The engine goes through the same mean-effective-pressure model as road engines (race flag:
// better breathing, lower friction, higher safe piston speed); aero and tyres are scaled from
// era reference levels in the regulations.
import type { DevLevels, EngineSpec, EngineStats, RaceCarSpec } from '../types';
import { CYL, computeEngine } from '../engineering';
import { clamp, kf } from '../util';
const kfBS = (y: number) => kf([[1950, 1.0], [1967, 1.3], [1990, 1.8], [2004, 2.3], [2014, 1.5], [2030, 1.5]], y);
import type { Regs } from './regs';

export interface RaceCarPerf {
  engine: EngineStats; powerKw: number; mass: number; cdA: number; clA: number; mu: number;
  reliability: number; tyreWear: number; fuelKgPerKwh: number; legal: string[]; awd: boolean; capped: boolean; forced: boolean;
}

export function raceEngineSpec(e: EngineSpec, regs: Regs): EngineSpec { return { ...e, hybridKw: regs.hybridKw }; }

export function checkLegal(e: EngineSpec, regs: Regs): string[] {
  const out: string[] = [];
  if (e.layout === 'EV') { out.push('Battery-electric powertrains are not eligible.'); return out; }
  const forced = e.aspiration !== 'na';
  if (forced && regs.maxDispForced <= 0) out.push('Forced induction is banned.');
  if (!forced && regs.maxDispNA <= 0) out.push('Naturally aspirated engines are not permitted — a turbo engine is mandatory.');
  const lim = forced ? regs.maxDispForced : regs.maxDispNA;
  if (lim > 0 && e.displacement > lim) out.push(`Displacement exceeds the ${lim} cc limit for ${forced ? 'forced-induction' : 'naturally aspirated'} engines.`);
  if (regs.cylinders && !regs.cylinders.includes(CYL[e.layout])) out.push(`Engine must have ${regs.cylinders.join(' or ')} cylinders.`);
  if (regs.layouts && !regs.layouts.includes(e.layout)) out.push(`Engine layout must be ${regs.layouts.join(' / ')}.`);
  if (forced && e.boost > regs.maxBoost + 1e-6) out.push(`Boost exceeds the ${regs.maxBoost.toFixed(1)} bar limit.`);
  return out;
}

export function computeRaceCar(spec: RaceCarSpec, dev: DevLevels, regs: Regs, techYear: number, wing: number, quality = 0.7): RaceCarPerf {
  const eSpec = raceEngineSpec(spec.engine, regs);
  const engine = computeEngine(eSpec, techYear, quality, true);
  const sc = regs.devScope;
  // recovered energy is only available for part of the lap: count the hybrid at its lap-average contribution
  const deploy = regs.hybridKw > 150 ? 0.35 : 0.8;
  let power = (engine.powerKw - regs.hybridKw * (1 - deploy)) * (1 + 0.05 * dev.engine * sc.engine);
  let capped = false;
  if (regs.powerCapKw > 0 && power > regs.powerCapKw) { power = regs.powerCapKw * (1 + 0.008 * dev.engine); capped = true; }
  const mass = regs.minWeight * (1 + Math.max(0, 0.07 - 0.06 * spec.weightEffort - 0.04 * dev.chassis * sc.chassis)) + 75;
  const a = 0.6 * wing + 0.4 * spec.aeroBias;
  const level = 0.82 + 0.26 * dev.aero * sc.aero + 0.04 * (quality - 0.5);
  const clA = regs.clA * level * (0.72 + 0.56 * a) * (0.97 + 0.06 * spec.stiffness);
  const cdA = regs.cdA * (1.06 - 0.08 * dev.aero * sc.aero) * (0.84 + 0.32 * a) * (1 + 0.04 * spec.cooling);
  const mu = regs.tyreMu * (0.97 + 0.04 * dev.chassis * sc.chassis) * (1 + 0.02 * (1 - spec.stiffness));
  const tyreWear = clamp(1 + 0.3 * (spec.stiffness - 0.5) + 0.12 * (a - 0.5) - 0.12 * dev.chassis, 0.6, 1.5);
  const stress = capped ? engine.powerKw / regs.powerCapKw : 1; // a detuned engine lives an easy life
  let reliability = regs.relRef + (engine.reliability - 70) / 250 + 0.07 * (spec.cooling - 0.5) + dev.reliability * (1 - regs.relRef) * 0.6 + (capped ? Math.min(0.04, (stress - 1) * 0.1) : 0) - 0.03 * spec.weightEffort;
  reliability = clamp(reliability, 0.25, 0.992);
  const etaBrake = engine.etaI * 0.86 * (1 + 0.03 * dev.engine);
  return { engine, powerKw: power, mass, cdA, clA, mu, reliability, tyreWear, fuelKgPerKwh: 1 / (etaBrake * 12.2), legal: checkLegal(eSpec, regs), awd: regs.awd, capped, forced: eSpec.aspiration === 'turbo' || eSpec.aspiration === 'twinturbo' };
}

/** Pick the redline that gives the most power without leaving the mechanically safe window. */
export function tuneRedline(e: EngineSpec, regs: Regs, techYear: number, quality = 0.7): number {
  let best = 6000, bestP = 0;
  for (let r = 5000; r <= 20000; r += 250) {
    const st = computeEngine({ ...e, redline: r, hybridKw: regs.hybridKw }, techYear, quality, true);
    if (st.pistonSpeed > st.pistonSpeedLimit * 1.0 || r > st.valveLimitRpm * 1.02) break;
    if (st.powerKw > bestP) { bestP = st.powerKw; best = r; }
  }
  return best;
}

export function defaultRaceEngine(regs: Regs, year: number, quality = 0.7): EngineSpec {
  const t = regs.typical;
  const forced = (t.aspiration ?? 'na') !== 'na';
  const e: EngineSpec = {
    layout: t.layout ?? 'V8', displacement: t.displacement ?? 3000, boreStroke: Math.round(kfBS(year) * 100) / 100, valvetrain: t.valvetrain ?? 'dohc4',
    aspiration: t.aspiration ?? 'na', boost: Math.min(t.boost ?? 1, regs.maxBoost || 1), compression: forced ? (year < 1990 ? 7.2 : 9.5) : year < 1965 ? 10 : year < 1990 ? 11.5 : 13,
    redline: 8000, cam: 0.95, fuelSystem: t.fuelSystem ?? (year < 1962 ? 'carb' : year < 1978 ? 'mfi' : year < 2005 ? 'efi' : 'di'), vvt: false, aluBlock: true,
    hybridKw: regs.hybridKw, motorKw: 0, batteryKwh: 0,
  };
  // back the boost / compression off until the engine is knock-free
  for (let i = 0; i < 12; i++) {
    const st = computeEngine(e, year, quality, true);
    if (st.knockMargin >= 0) break;
    if (forced && e.boost > 0.6 && i % 2 === 0) e.boost = Math.round((e.boost - 0.15) * 100) / 100; else e.compression = Math.max(6.5, e.compression - 0.4);
  }
  e.redline = tuneRedline(e, regs, year, quality);
  return e;
}
export function defaultRaceCar(regs: Regs, year: number, color = '#c8102e', color2 = '#ffffff'): RaceCarSpec {
  return { engine: defaultRaceEngine(regs, year), aeroBias: 0.5, weightEffort: 0.5, cooling: 0.5, stiffness: 0.5, color, color2 };
}
