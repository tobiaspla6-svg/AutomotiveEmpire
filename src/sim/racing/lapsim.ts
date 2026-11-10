// Quasi-steady-state lap-time simulation (point-mass with aerodynamic downforce and a friction
// circle). For every sample of the circuit:
//   corner limit   m·v²·κ = µ·(m·g + ½ρ·ClA·v²)   →   v_max = sqrt( µ·g / (κ − µ·½ρ·ClA/m) )
//   forward pass   accelerate with min(traction left in the friction circle, P/(m·v)) − drag
//   backward pass  brake with the grip left in the friction circle + drag
// Lap time is the integral of ds / v. This is the classic method used by simple lap-time tools;
// it ignores transients, load transfer, tyre thermal behaviour and elevation.
import { G, RHO } from '../engineering';
import type { TrackGeom } from './tracks';

export interface LapInput { mass: number; powerW: number; cdA: number; clA: number; mu: number; awd: boolean }
export interface LapResult { time: number; v: Float32Array; vMax: number; vMin: number; energyKwh: number; fullThrottle: number }

export function lapSim(g: TrackGeom, p: LapInput): LapResult {
  const n = g.n, ds = g.ds;
  const k = (0.5 * RHO * p.clA) / p.mass;
  const kd = (0.5 * RHO * p.cdA) / p.mass;
  const VCAP = 115;
  const lim = new Float32Array(n);
  let slow = 0;
  for (let i = 0; i < n; i++) {
    const c = g.curv[i];
    const den = c - p.mu * k;
    lim[i] = c > 2e-4 && den > 1e-6 ? Math.min(VCAP, Math.sqrt((p.mu * G) / den)) : VCAP;
    if (lim[i] < lim[slow]) slow = i;
  }
  const v = new Float32Array(n);
  const tractionFrac = p.awd ? 0.92 : 0.6;
  v[slow] = lim[slow];
  let energy = 0, wot = 0;
  // forward pass (twice round so the start value does not matter)
  for (let step = 0; step < 2 * n; step++) {
    const i = (slow + step) % n, j = (i + 1) % n;
    const vi = Math.max(v[i], 5);
    const aMax = p.mu * (G + k * vi * vi);
    const fl = Math.min(1, (vi * vi * g.curv[i]) / aMax);
    const grip = aMax * Math.sqrt(1 - fl * fl) * tractionFrac;
    const aPow = p.powerW / (p.mass * vi);
    const a = Math.min(grip, aPow) - kd * vi * vi - 0.015 * G;
    const vn = Math.min(lim[j], Math.sqrt(Math.max(vi * vi + 2 * a * ds, 25)));
    if (step < n || vn < v[j] || v[j] === 0) v[j] = vn;
  }
  // backward pass (braking)
  for (let step = 0; step < 2 * n; step++) {
    const i = (slow - step + 2 * n) % n, h = (i - 1 + n) % n;
    const vi = v[i];
    const aMax = p.mu * (G + k * vi * vi);
    const fl = Math.min(1, (vi * vi * g.curv[i]) / aMax);
    const brake = aMax * Math.sqrt(1 - fl * fl) * 0.97 + kd * vi * vi;
    const vb = Math.sqrt(vi * vi + 2 * brake * ds);
    if (vb < v[h]) v[h] = vb;
  }
  let time = 0, vMax = 0, vMin = 1e9;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const va = 0.5 * (v[i] + v[j]);
    const dt = ds / va;
    time += dt;
    if (v[i] > vMax) vMax = v[i];
    if (v[i] < vMin) vMin = v[i];
    if (v[j] >= v[i] - 0.01) { // on the throttle
      const aPow = p.powerW / (p.mass * va);
      const aNeed = (v[j] * v[j] - v[i] * v[i]) / (2 * ds) + kd * va * va + 0.015 * G;
      const frac = Math.min(1, Math.max(0, aNeed / aPow));
      energy += p.powerW * frac * dt;
      if (frac > 0.9) wot += dt;
    }
  }
  return { time, v, vMax, vMin, energyKwh: energy / 3.6e6, fullThrottle: wot / time };
}
