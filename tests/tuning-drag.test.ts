// Tuning Empire prototype (Phase 6): parts, compatibility, stages and the deterministic drag simulation.
import { describe, expect, it } from 'vitest';
import { PARTS, STAGES, VEHICLES } from '../src/tuning/data';
import { applyStage, calibrationProblems, fitParts, partFitProblem, stockCalibration, type Hardware } from '../src/tuning/parts';
import { dynoCurve, torqueAt } from '../src/tuning/engine';
import { G, simulateDrag, topSpeedKmh } from '../src/tuning/drag';
import type { Calibration, Vehicle } from '../src/tuning/types';

const stage = (id: string) => STAGES.find((s) => s.id === id)!;
const build = (v: Vehicle, parts: string[] = [], cal?: Partial<Calibration>) => {
  const { hw, errors } = fitParts(v, parts, PARTS);
  return { hw, cal: { ...stockCalibration(v), ...cal }, errors };
};
const staged = (v: Vehicle, id: string, extra: string[] = []) => {
  const r = applyStage(v, stage(id), PARTS, extra);
  if (!r.build) throw new Error(r.errors.join('; '));
  return { hw: fitParts(v, r.build.parts, PARTS).hw, cal: r.build.calibration };
};
const run = (b: { hw: Hardware; cal: Calibration }, o = {}) => simulateDrag(b.hw, b.cal, o);

describe('drag simulation: physics sanity', () => {
  it('is deterministic: the same data gives exactly the same result', () => {
    const b = staged(VEHICLES.kestrel, 'k20t-stage2');
    expect(run(b)).toEqual(run(b));
  });
  it('a car does not accelerate forever: it settles at its top speed', () => {
    const b = build(VEHICLES.atlas);
    const r = run(b, { distanceM: 30000, maxTimeS: 900, traceEveryS: 1 });
    const top = topSpeedKmh(b.hw, b.cal);
    expect(r.finalKmh).toBeLessThanOrEqual(top + 1);
    expect(r.finalKmh).toBeGreaterThan(top - 5);
    // speed stops growing (this car ends on its rev limiter in 5th: the limiter cuts and restores torque each step,
    // so an instantaneous acceleration sample is not zero, but speed over the last 10 s is flat)
    const last = r.trace[r.trace.length - 1], tenBefore = r.trace[r.trace.length - 11];
    expect(Math.abs(last.kmh - tenBefore.kmh)).toBeLessThan(0.1);
  });
  it('mass costs time: +200 kg is slower and traps lower', () => {
    const light = run(build(VEHICLES.atlas)), heavy = run(build({ ...VEHICLES.atlas, massKg: VEHICLES.atlas.massKg + 200 }));
    expect(heavy.et4).toBeGreaterThan(light.et4 + 0.4);
    expect(heavy.trap4Kmh).toBeLessThan(light.trap4Kmh - 3);
  });
  it('traction limits acceleration: never above μ·g on the driven wheels, and less grip means a slower start', () => {
    const b = staged(VEHICLES.atlas, 'k20t-stage3', ['clutch-a5-stage2']);
    const r = run(b);
    expect(r.peakAccelG).toBeLessThanOrEqual(b.hw.vehicle.tyre.mu * b.hw.vehicle.drivetrain.diffTraction + 1e-6);
    const wet = run(b, { env: { airDensity: 1.2, surfaceGrip: 0.6 } });
    expect(wet.et60ft).toBeGreaterThan(r.et60ft + 0.3);
    expect(wet.wheelspinS).toBeGreaterThan(r.wheelspinS);
    // a RWD car on street tyres spins: its launch is traction-limited, not power-limited
    const rwd = run(build(VEHICLES.kestrel));
    expect(rwd.wheelspinS).toBeGreaterThan(1);
    expect(rwd.et60ft).toBeGreaterThan(run(build(VEHICLES.atlas)).et60ft);   // same engine, AWD launches better
  });
  it('gear ratios change the result (close-ratio gearbox, shorter final drive)', () => {
    const base = run(staged(VEHICLES.kestrel, 'k20t-stage2', ['clutch-r5-twin', 'diff-r-lsd-41', 'tyres-16-drag']));
    const close = run(staged(VEHICLES.kestrel, 'k20t-stage2', ['clutch-r5-twin', 'diff-r-lsd-41', 'tyres-16-drag', 'gearbox-r5-close']));
    const short = run(staged(VEHICLES.kestrel, 'k20t-stage2', ['clutch-r5-twin', 'diff-r-lsd-439', 'tyres-16-drag']));
    expect(close.et4).not.toBeCloseTo(base.et4, 2);
    expect(short.et4).not.toBeCloseTo(base.et4, 2);
    expect(close.shifts.map((s) => s.kmh)).not.toEqual(base.shifts.map((s) => s.kmh));
  });
});

describe('more power is not automatically quicker', () => {
  it('on the stock clutch, diff and tyres, Stage 3 (+48 kW over Stage 2) gains almost nothing', () => {
    const s2 = staged(VEHICLES.kestrel, 'k20t-stage2'), s3 = staged(VEHICLES.kestrel, 'k20t-stage3');
    expect(dynoCurve(s3.hw, s3.cal).peakKw).toBeGreaterThan(dynoCurve(s2.hw, s2.cal).peakKw + 40);
    const r2 = run(s2), r3 = run(s3);
    expect(r2.et4 - r3.et4).toBeLessThan(0.1);
    expect(r3.clutchSlipS).toBeGreaterThan(5);           // the stock clutch cannot hold the torque
  });
  it('the big turbo trades low-down torque for peak power: less torque at 3 500 rpm, more at the top', () => {
    const s2 = staged(VEHICLES.atlas, 'k20t-stage2'), s3 = staged(VEHICLES.atlas, 'k20t-stage3');
    const at = (b: typeof s2, rpm: number) => dynoCurve(b.hw, b.cal).points.find((p) => p.rpm === rpm)!;
    expect(at(s3, 3500).nm).toBeLessThan(at(s2, 3500).nm);
    expect(at(s3, 6500).kw).toBeGreaterThan(at(s2, 6500).kw);
  });
  it('with a clutch, an LSD and drag radials the same Stage 3 power is finally usable', () => {
    const full = run(staged(VEHICLES.kestrel, 'k20t-stage3', ['clutch-r5-twin', 'diff-r-lsd-41', 'tyres-16-drag']));
    expect(full.et4).toBeLessThan(run(staged(VEHICLES.kestrel, 'k20t-stage3')).et4 - 2);
  });
  it('injectors cap power: Stage 1 is fuel-limited; bigger injectors lift the cap', () => {
    const s1 = staged(VEHICLES.kestrel, 'k20t-stage1');
    const d1 = dynoCurve(s1.hw, s1.cal);
    expect(d1.fuelLimited).toBe(true);
    const inj = dynoCurve(...Object.values(staged(VEHICLES.kestrel, 'k20t-stage1', ['injectors-k20t-750'])) as [Hardware, Calibration]);
    expect(inj.fuelLimited).toBe(false);
    expect(inj.peakKw).toBeGreaterThan(d1.peakKw);
  });
});

describe('parts and stages: compatibility', () => {
  it('an incompatible part is refused and not installed', () => {
    const m = VEHICLES.marlin;
    expect(partFitProblem(PARTS['intercooler-k20t-fmic'], m)).toMatch(/engine K20T/);
    expect(partFitProblem(PARTS['turbo-k20t-hybrid'], m)).toMatch(/K20T/);
    expect(partFitProblem(PARTS['clutch-r5-stage2'], VEHICLES.atlas)).toMatch(/bellhousing pattern R5/);
    expect(partFitProblem(PARTS['diff-r-lsd-41'], m)).toMatch(/RWD/);
    expect(partFitProblem(PARTS['tyres-16-semi'], m)).toMatch(/16-inch/);
    expect(partFitProblem(PARTS['weight-ks-strip'], VEHICLES.atlas)).toMatch(/platform KS/);
    const { hw, installed, errors } = fitParts(m, ['intercooler-k20t-fmic', 'intake-m18'], PARTS);
    expect(installed).toEqual(['intake-m18']);
    expect(errors).toHaveLength(1);
    expect(hw.intercoolerEff).toBe(0);
  });
  it('the same engine code shares engine parts across platforms; drivetrain parts do not cross', () => {
    expect(partFitProblem(PARTS['turbo-k20t-big'], VEHICLES.atlas)).toBeNull();
    expect(partFitProblem(PARTS['turbo-k20t-big'], VEHICLES.kestrel)).toBeNull();
    expect(partFitProblem(PARTS['clutch-a5-stage2'], VEHICLES.kestrel)).not.toBeNull();
  });
  it('a stage is a set of parts plus a calibration for one engine code', () => {
    expect(applyStage(VEHICLES.marlin, stage('k20t-stage1'), PARTS).errors[0]).toMatch(/for engine K20T/);
    const r = applyStage(VEHICLES.kestrel, stage('k20t-stage2'), PARTS);
    expect(r.errors).toEqual([]);
    const manual = fitParts(VEHICLES.kestrel, stage('k20t-stage2').parts, PARTS).hw;
    expect(fitParts(VEHICLES.kestrel, r.build!.parts, PARTS).hw).toEqual(manual);
    expect(r.build!.calibration.boostBar).toBe(1.35);
    // stages differ in hardware, not in a multiplier: each stage's parts are a strict superset of the previous one's
    const [s1, s2] = [stage('k20t-stage1'), stage('k20t-stage2')];
    expect(s1.parts.every((p) => s2.parts.includes(p))).toBe(true);
  });
  it('the ECU refuses calibrations the hardware cannot take', () => {
    const v = VEHICLES.kestrel;
    const stockHw = fitParts(v, [], PARTS).hw;
    expect(calibrationProblems(stockHw, stockCalibration(v))).toEqual([]);
    expect(calibrationProblems(stockHw, { ...stockCalibration(v), boostBar: 1.0 })).toEqual(expect.arrayContaining([expect.stringMatching(/stock ECU cannot be recalibrated/)]));
    const flashed = fitParts(v, ['ecu-k20t-flash'], PARTS).hw;
    expect(calibrationProblems(flashed, { ...stockCalibration(v), boostBar: 1.6 }).join(' ')).toMatch(/beyond what this turbo can make/);
    expect(calibrationProblems(flashed, { ...stockCalibration(v), revLimit: 8000 }).join(' ')).toMatch(/valvetrain limit/);
    expect(calibrationProblems(flashed, { ...stockCalibration(v), boostBar: 1.05, timingDeg: 4 }).join(' ')).toMatch(/knocks/);
    const na = fitParts(VEHICLES.marlin, ['ecu-m18-flash'], PARTS).hw;
    expect(calibrationProblems(na, { ...stockCalibration(VEHICLES.marlin), boostBar: 0.5 }).join(' ')).toMatch(/NA engine has no boost/);
  });
});

describe('engine model', () => {
  it('stock hardware and calibration reproduce the stock curve', () => {
    const b = build(VEHICLES.kestrel);
    for (const p of VEHICLES.kestrel.engine.torque.filter((x) => x.rpm < b.cal.revLimit)) {
      const boost = p.rpm >= 3400 ? 0.8 : undefined;
      if (boost === undefined) continue;
      expect(torqueAt(b.hw, b.cal, p.rpm, boost).nm).toBeCloseTo(p.nm, 0);
    }
  });
  it('the rev limiter cuts torque', () => {
    const b = build(VEHICLES.kestrel);
    expect(torqueAt(b.hw, b.cal, b.cal.revLimit, 0.8).nm).toBe(0);
  });
});

describe('validation against an empirical reference (Hale / Huntington trap-speed formula)', () => {
  // trap mph ≈ 234 × (wheel hp / lb)^(1/3); drag-racing literature quotes it to about ±5–10 % for cars that can put
  // their power down. Only configurations without a traction or clutch limit are compared.
  const hale = (b: { hw: Hardware; cal: Calibration }) => {
    const kw = dynoCurve(b.hw, b.cal).peakKw, whp = kw * 1.341 * b.hw.vehicle.drivetrain.efficiency, lb = (b.hw.vehicle.massKg + 80) * 2.2046;
    return 234 * Math.cbrt(whp / lb) * 1.609;
  };
  for (const [name, b] of [['Atlas stock (AWD)', () => build(VEHICLES.atlas)], ['Kestrel Stage 3 + clutch, LSD, drag radials', () => staged(VEHICLES.kestrel, 'k20t-stage3', ['clutch-r5-twin', 'diff-r-lsd-41', 'tyres-16-drag'])]] as const) {
    it(`${name}: trap speed within 8 % of the formula`, () => {
      const bb = b(), r = run(bb), ref = hale(bb);
      expect(Math.abs(r.trap4Kmh - ref) / ref).toBeLessThan(0.08);
    });
  }
  it('acceleration in g is reported in the same units as the traction bound', () => {
    expect(G).toBeCloseTo(9.81, 2);
  });
});
