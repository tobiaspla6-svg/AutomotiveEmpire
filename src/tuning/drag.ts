// Tuning Empire prototype: deterministic drag-race simulation (no React, no randomness, fixed time step).
//
// Model per step (dt = 1 ms, semi-implicit Euler):
//   engine rpm   = wheel speed × overall ratio (engaged), or the launch rpm while the clutch slips at the start;
//   boost        = first-order lag (τ = turbo lag) towards what the turbo can hold at that rpm;
//   torque       = engine.ts torqueAt(rpm, boost), limited by the clutch's capacity;
//   wheel force  = torque × gear × final × efficiency / tyre radius;
//   traction     = μ × surface × differential share × load on the driven axle, with longitudinal weight transfer
//                  (m·a·h/L); above it the driver feathers the throttle and holds the tyres near peak slip, so
//                  only 0.97 of that limit is used (time spent there is reported as wheelspin);
//   resistance   = ½ ρ CdA v² + Crr m g;
//   inertia      = engine inertia reflected through the gearing + four wheels and tyres (effective mass);
//   shifts       = at the calibration's shift rpm, with zero drive force during the shift time.
// Not modelled (stated, not hidden): tyre slip ratio curves and heat, engine rpm flare during wheelspin, boost decay
// in a shift, driveline shock, wheelies, track temperature, reaction time (times are from the car's first movement).
import type { Calibration, Environment } from './types';
import { STANDARD_ENV } from './types';
import { boostAvailable, dynoCurve, torqueAt } from './engine';
import type { Hardware } from './parts';

export const G = 9.81;
export const DT = 0.001;
export const FT60 = 18.288, EIGHTH = 201.168, QUARTER = 402.336, TRAP = 20.1168;   // m (60 ft, 1/8 mi, 1/4 mi, 66 ft trap)
const WHEEL_INERTIA = 4 * 1.1;                                                  // kg·m² (four wheel-and-tyre sets)

export interface RunOptions { env?: Environment; distanceM?: number; maxTimeS?: number; traceEveryS?: number }
export interface DragResult {
  et60ft: number; et8: number; trap8Kmh: number; et4: number; trap4Kmh: number;
  finalKmh: number; distanceM: number; timeS: number;
  shifts: { t: number; toGear: number; kmh: number }[];
  wheelspinS: number; clutchSlipS: number; fuelLimited: boolean; peakAccelG: number;
  trace: { t: number; x: number; kmh: number; gear: number; rpm: number; boost: number; accelG: number }[];
}

export function simulateDrag(hw: Hardware, cal: Calibration, o: RunOptions = {}): DragResult {
  const env = o.env ?? STANDARD_ENV, v0 = hw.vehicle, d = v0.drivetrain, e = v0.engine, tyre = v0.tyre;
  const m = v0.massKg + 80;                                                         // with driver
  const L = v0.wheelbaseM, h = v0.cgHeightM, r = tyre.radiusM;
  const distance = o.distanceM ?? QUARTER, maxT = o.maxTimeS ?? 60, traceEvery = o.traceEveryS ?? 0.05;
  const shiftRpm = Math.min(cal.shiftRpm, cal.revLimit - 50);
  let t = 0, x = 0, v = 0, gear = 0, shiftLeft = 0, aPrev = 0, slipping = true;
  // staged on the launch rpm long enough for the turbo to reach what it holds there
  let boost = boostAvailable(hw.turbo, cal.boostBar, cal.launchRpm);
  let wheelspin = 0, clutchSlip = 0, fuelLimited = false, peakA = 0;
  const marks: Record<string, number> = {};
  const speedAt: { x: number; t: number }[] = [];
  const shifts: DragResult['shifts'] = [], trace: DragResult['trace'] = [];
  let nextTrace = 0;
  const cross = (key: string, at: number, xPrev: number, tPrev: number) => { if (marks[key] === undefined && x >= at) marks[key] = tPrev + ((at - xPrev) / (x - xPrev)) * (t - tPrev); };
  while (x < distance && t < maxT) {
    const ratio = d.gears[gear] * d.finalDrive;
    const wheelRpm = (v / r) * 60 / (2 * Math.PI);
    let rpm = wheelRpm * ratio;
    if (slipping && rpm >= cal.launchRpm) slipping = false;
    if (slipping) rpm = cal.launchRpm;
    rpm = Math.max(rpm, e.idleRpm);
    // shift up
    if (shiftLeft <= 0 && gear < d.gears.length - 1 && rpm >= shiftRpm) { gear++; shiftLeft = d.shiftTimeS; shifts.push({ t, toGear: gear + 1, kmh: v * 3.6 }); continue; }
    // boost follows the turbo's ability at this rpm with its lag
    const target = boostAvailable(hw.turbo, cal.boostBar, rpm);
    const tau = hw.turbo?.lagS ?? 0.1;
    boost += (target - boost) * Math.min(1, DT / tau);
    let F = 0;
    if (shiftLeft > 0) shiftLeft -= DT;
    else {
      const tq = torqueAt(hw, cal, rpm, boost);
      if (tq.fuelLimited) fuelLimited = true;
      let engineNm = tq.nm;
      if (engineNm > d.clutchCapNm) { engineNm = d.clutchCapNm; clutchSlip += DT; }   // clutch slips: capped transmission
      else if (slipping) clutchSlip += DT;
      F = (engineNm * ratio * d.efficiency) / r;
    }
    // traction on the driven axle with weight transfer from the previous step's acceleration
    const N = m * G, transfer = (m * Math.max(aPrev, 0) * h) / L;
    const Nd = d.drive === 'AWD' ? N : d.drive === 'RWD' ? (1 - v0.frontShare) * N + transfer : v0.frontShare * N - transfer;
    const Fmax = tyre.mu * env.surfaceGrip * d.diffTraction * Math.max(Nd, 0);
    // above the limit the driver feathers the throttle and holds the tyres near peak slip: 0.97 of peak grip.
    // Extra torque is then simply unusable (it is not punished by an invented rule).
    if (F > Fmax) { F = Fmax * 0.97; wheelspin += DT; }
    const resist = 0.5 * env.airDensity * v0.cdA * v * v + (v > 0.01 ? v0.crr * m * G : 0);
    const mEff = m + (WHEEL_INERTIA + (shiftLeft > 0 || slipping ? 0 : e.inertiaKgm2 * ratio * ratio * d.efficiency)) / (r * r);
    const a = Math.max((F - resist) / mEff, v > 0 ? -50 : 0);
    aPrev = a; peakA = Math.max(peakA, a / G);
    const xPrev = x, tPrev = t;
    v = Math.max(0, v + a * DT);
    x += v * DT;
    t += DT;
    cross('60', FT60, xPrev, tPrev); cross('8', EIGHTH, xPrev, tPrev); cross('4', QUARTER, xPrev, tPrev);
    speedAt.push({ x, t });
    if (t >= nextTrace) { trace.push({ t: +t.toFixed(3), x: +x.toFixed(2), kmh: +(v * 3.6).toFixed(2), gear: gear + 1, rpm: Math.round(rpm), boost: +boost.toFixed(3), accelG: +(a / G).toFixed(3) }); nextTrace += traceEvery; }
  }
  // trap speed: average over the last 66 ft before the mark, as timing lights measure it
  const trap = (mark: number) => {
    const tEnd = marks[mark === EIGHTH ? '8' : '4'];
    if (tEnd === undefined) return NaN;
    const startX = mark - TRAP;
    const s = speedAt.find((p) => p.x >= startX);
    return s ? (TRAP / (tEnd - s.t)) * 3.6 : NaN;
  };
  return {
    et60ft: marks['60'] ?? NaN, et8: marks['8'] ?? NaN, trap8Kmh: trap(EIGHTH), et4: marks['4'] ?? NaN, trap4Kmh: trap(QUARTER),
    finalKmh: v * 3.6, distanceM: x, timeS: t, shifts, wheelspinS: +wheelspin.toFixed(3), clutchSlipS: +clutchSlip.toFixed(3), fuelLimited, peakAccelG: +peakA.toFixed(3), trace,
  };
}

/** Highest speed where some gear still has more drive force than resistance, within the rev range (km/h). */
export function topSpeedKmh(hw: Hardware, cal: Calibration, env: Environment = STANDARD_ENV): number {
  const v0 = hw.vehicle, d = v0.drivetrain, m = v0.massKg + 80;
  let top = 0;
  for (let v = 1; v < 120; v += 0.1) {
    let ok = false;
    for (const g of d.gears) {
      const rpm = (v / v0.tyre.radiusM) * g * d.finalDrive * 60 / (2 * Math.PI);
      if (rpm >= cal.revLimit || rpm < v0.engine.idleRpm) continue;
      const tq = torqueAt(hw, cal, rpm, boostAvailable(hw.turbo, cal.boostBar, rpm)).nm;
      if ((Math.min(tq, d.clutchCapNm) * g * d.finalDrive * d.efficiency) / v0.tyre.radiusM >= 0.5 * env.airDensity * v0.cdA * v * v + v0.crr * m * G) { ok = true; break; }
    }
    if (ok) top = v;
  }
  return top * 3.6;
}

export { dynoCurve };
