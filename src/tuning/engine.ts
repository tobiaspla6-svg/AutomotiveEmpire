// Tuning Empire prototype: full-load torque from hardware and calibration.
//
// T(rpm, boost) = T_stock(rpm) × pressure ratio × charge-density ratio × flow factor × timing factor,
// then capped by what the injectors can fuel. Simplifications (documented in docs/phase6/TUNING.md):
//   - the stock torque curve already contains the engine's volumetric efficiency; changes are relative to it;
//   - pressure ratio (1 + boost) / (1 + stock boost at that rpm): mass flow scales with manifold pressure;
//   - charge temperature rises ≈ 90 K per bar of boost before the intercooler, which removes `eff` of it;
//   - intake/exhaust parts raise airflow capacity, mostly above a given rpm;
//   - ignition advance: ≈ 0.8 % torque per degree, bounded by the knock limit (parts.ts);
//   - fuel: brake-specific fuel consumption 0.50 (NA) / 0.60 (turbo) lb/hp·h at 80 % injector duty.
import type { Calibration } from './types';
import type { Hardware } from './parts';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** Stock torque at an rpm, linear between the measured points (0 beyond the curve). */
export function stockTorqueAt(hw: Hardware, rpm: number): number {
  const c = hw.vehicle.engine.torque;
  if (rpm <= c[0].rpm) return c[0].nm * Math.max(0, rpm / c[0].rpm);
  for (let i = 1; i < c.length; i++) if (rpm <= c[i].rpm) return lerp(c[i - 1].nm, c[i].nm, (rpm - c[i - 1].rpm) / (c[i].rpm - c[i - 1].rpm));
  const last = c[c.length - 1], prev = c[c.length - 2];
  return Math.max(0, last.nm + ((last.nm - prev.nm) / (last.rpm - prev.rpm)) * (rpm - last.rpm));   // falls off past the last point
}

/** Steady-state boost a turbo can hold at an rpm (bar), for a target. Below full-boost rpm it is still spooling. */
export function boostAvailable(turbo: Hardware['turbo'], target: number, rpm: number): number {
  if (!turbo) return 0;
  const spool = smooth(turbo.fullBoostRpm * 0.45, turbo.fullBoostRpm, rpm);
  return Math.min(target, turbo.maxBoostBar) * spool;
}

/** Boost along the rpm range with the stock turbo and stock boost: the conditions the stock curve was measured at. */
const stockBoostAt = (hw: Hardware, rpm: number) => {
  const e = hw.vehicle.engine;
  return e.aspiration === 'turbo' ? boostAvailable({ maxBoostBar: e.stockBoostBar + 0.25, fullBoostRpm: 3400, lagS: 0.45 }, e.stockBoostBar, rpm) : 0;
};
const chargeTempK = (boost: number, icEff: number) => 300 + 90 * boost * (1 - icEff);

/** Torque the injectors can fuel at an rpm (Nm). */
export function fuelLimitNm(hw: Hardware, rpm: number): number {
  const bsfc = hw.vehicle.engine.aspiration === 'turbo' ? 0.6 : 0.5;          // lb / hp·h
  const lbPerHour = (hw.injectorCcMin / 10.5) * 0.8;                          // cc/min → lb/h (gasoline) at 80 % duty
  const kw = (lbPerHour / bsfc) * 0.7457;
  return (kw * 1000) / Math.max(1, (rpm * 2 * Math.PI) / 60);
}

export interface TorqueResult { nm: number; airNm: number; fuelLimited: boolean }
/** Full-load torque at an rpm with a given actual manifold boost (bar). */
export function torqueAt(hw: Hardware, cal: Calibration, rpm: number, boost: number): TorqueResult {
  if (rpm >= cal.revLimit) return { nm: 0, airNm: 0, fuelLimited: false };   // limiter
  const e = hw.vehicle.engine;
  const b0 = stockBoostAt(hw, rpm);
  const pr = (1 + boost) / (1 + b0);
  const icStock = e.aspiration === 'turbo' ? 0.55 : 0;
  const density = chargeTempK(b0, icStock) / chargeTempK(boost, hw.intercoolerEff);
  let flow = 1;
  for (const f of hw.flow) flow += f.gain * smooth(f.fromRpm - 1200, f.fromRpm + 1200, rpm);
  const timing = 1 + 0.008 * cal.timingDeg;
  const airNm = stockTorqueAt(hw, rpm) * pr * density * flow * timing;
  const fuel = fuelLimitNm(hw, rpm);
  return { nm: Math.max(0, Math.min(airNm, fuel)), airNm, fuelLimited: airNm > fuel };
}

/** Full-load torque and power curves with steady-state boost (dyno sweep), every `step` rpm. */
export function dynoCurve(hw: Hardware, cal: Calibration, step = 250) {
  const pts: { rpm: number; nm: number; kw: number; boost: number; fuelLimited: boolean }[] = [];
  for (let rpm = 1000; rpm < cal.revLimit; rpm += step) {
    const boost = boostAvailable(hw.turbo, cal.boostBar, rpm);
    const t = torqueAt(hw, cal, rpm, boost);
    pts.push({ rpm, nm: t.nm, kw: (t.nm * rpm * 2 * Math.PI) / 60000, boost, fuelLimited: t.fuelLimited });
  }
  const peakKw = pts.reduce((a, p) => (p.kw > a.kw ? p : a), pts[0]);
  const peakNm = pts.reduce((a, p) => (p.nm > a.nm ? p : a), pts[0]);
  return { points: pts, peakKw: peakKw.kw, peakKwRpm: peakKw.rpm, peakNm: peakNm.nm, peakNmRpm: peakNm.rpm, fuelLimited: pts.some((p) => p.fuelLimited) };
}
