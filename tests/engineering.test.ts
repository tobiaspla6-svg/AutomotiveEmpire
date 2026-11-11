import { describe, expect, it } from 'vitest';
import { computeEngine, computeVehicle, defaultEngine, defaultVehicle, G, RHO } from '../src/sim/engineering';
import { makeRng, pick, rnd, rndRange } from '../src/sim/rng';
import type { BodyType, EngineLayout, Tech, VehicleSpec } from '../src/sim/types';

const tech = (y: number): Tech => ({ engine: y, chassis: y, aero: y, electronics: y, manufacturing: y });
const stats = (s: VehicleSpec, y: number) => computeVehicle(s, { year: y, tech: tech(y) });

describe('calibration against well-known real cars (±~20 %)', () => {
  it('1975 1.5 L front-drive hatchback (~51 kW, 0–100 ≈ 13 s, ≈ 160 km/h)', () => {
    const s = defaultVehicle(1975, 'hatch');
    s.size = 0.93; s.engine = { ...defaultEngine(1975), displacement: 1457, valvetrain: 'sohc', compression: 8.2, redline: 6000 }; s.gears = 4; s.drive = 'FWD'; s.tireWidth = 155;
    const v = stats(s, 1975);
    expect(v.powerKw).toBeGreaterThan(45); expect(v.powerKw).toBeLessThan(62);
    expect(v.mass).toBeGreaterThan(780); expect(v.mass).toBeLessThan(1050);
    expect(v.zeroTo100).toBeGreaterThan(10.5); expect(v.zeroTo100).toBeLessThan(15.5);
    expect(v.topSpeed).toBeGreaterThan(145); expect(v.topSpeed).toBeLessThan(180);
  });
  it('2020 2.0 L turbo premium sedan (~190 kW, 0–100 ≈ 6 s, ≈ 6.5 L/100 km)', () => {
    const s = defaultVehicle(2020, 'sedan');
    s.engine = { ...defaultEngine(2020), displacement: 1998, aspiration: 'turbo', boost: 1.1, compression: 10.2, redline: 6500 };
    s.gearbox = 'auto'; s.gears = 8; s.drive = 'RWD'; s.finalDrive = 3.2; s.tireWidth = 225; s.interior = 'premium'; s.suspRear = 'multilink';
    const v = stats(s, 2020);
    expect(v.powerKw).toBeGreaterThan(160); expect(v.powerKw).toBeLessThan(230);
    expect(v.zeroTo100).toBeGreaterThan(5.0); expect(v.zeroTo100).toBeLessThan(7.5);
    expect(v.fuelCombined).toBeGreaterThan(5.0); expect(v.fuelCombined).toBeLessThan(8.5);
  });
  it('2022 60 kWh rear-drive electric sedan (208 kW, 0–100 ≈ 6 s, ≈ 14–15 kWh/100 km)', () => {
    const s = defaultVehicle(2022, 'sedan');
    s.engine = { ...defaultEngine(2022), layout: 'EV', motorKw: 208, batteryKwh: 60 }; s.drive = 'RWD'; s.gearbox = 'auto'; s.tireWidth = 235; s.aeroOpt = 0.9;
    const v = stats(s, 2022);
    expect(v.engine.isEV).toBe(true);
    expect(v.zeroTo100).toBeGreaterThan(4.8); expect(v.zeroTo100).toBeLessThan(7.5);
    expect(v.fuelCombined).toBeGreaterThan(11); expect(v.fuelCombined).toBeLessThan(19);
    expect(v.rangeKm).toBeGreaterThan(300); expect(v.rangeKm).toBeLessThan(550);
  });
});

describe('design changes move the numbers the right way', () => {
  const base = () => { const s = defaultVehicle(2005, 'sedan'); s.drive = 'RWD'; return s; };
  it('more displacement → more power and torque', () => {
    const a = base(), b = base(); b.engine.displacement = 3000;
    expect(stats(b, 2005).powerKw).toBeGreaterThan(stats(a, 2005).powerKw);
    expect(stats(b, 2005).torqueNm).toBeGreaterThan(stats(a, 2005).torqueNm);
  });
  it('turbocharging the same engine raises torque', () => {
    const a = base(), b = base(); b.engine.aspiration = 'turbo'; b.engine.boost = 0.8; b.engine.compression = 9;
    expect(stats(b, 2005).torqueNm).toBeGreaterThan(stats(a, 2005).torqueNm * 1.25);
  });
  it('a bigger, heavier car accelerates more slowly', () => {
    const a = base(), b = base(); b.size = 1.15; b.interior = 'luxury'; b.chassis = 'ladder';
    expect(stats(b, 2005).mass).toBeGreaterThan(stats(a, 2005).mass);
    expect(stats(b, 2005).zeroTo100).toBeGreaterThan(stats(a, 2005).zeroTo100);
  });
  it('a big wing adds drag and downforce: lower top speed, more grip', () => {
    const a = base(), b = base(); b.wing = 1;
    const sa = stats(a, 2005), sb = stats(b, 2005);
    expect(sb.cd).toBeGreaterThan(sa.cd);
    expect(sb.downforce200).toBeGreaterThan(sa.downforce200);
    expect(sb.topSpeed).toBeLessThan(sa.topSpeed);
  });
  it('stickier tyres stop shorter and corner harder', () => {
    const a = base(), b = base(); a.tireCompound = 'economy'; b.tireCompound = 'semislick';
    expect(stats(b, 2005).braking100).toBeLessThan(stats(a, 2005).braking100);
    expect(stats(b, 2005).lateralG).toBeGreaterThan(stats(a, 2005).lateralG);
  });
  it('carbon chassis is lighter and dearer than steel', () => {
    const a = base(), b = base(); b.chassis = 'carbon';
    expect(stats(b, 2005).mass).toBeLessThan(stats(a, 2005).mass);
    expect(stats(b, 2005).partsCost).toBeGreaterThan(stats(a, 2005).partsCost);
  });
});

describe('physical limits hold for any design', () => {
  const LAYOUTS: EngineLayout[] = ['I3', 'I4', 'I6', 'V6', 'V8', 'V12', 'F6', 'EV'];
  const BODIES: BodyType[] = ['hatch', 'sedan', 'coupe', 'supercar', 'suv', 'pickup', 'roadster', 'wagon'];
  const rng = makeRng(42);
  const designs = Array.from({ length: 150 }, () => {
    const y = Math.round(rndRange(rng, 1950, 2026));
    const s = defaultVehicle(y, pick(rng, BODIES));
    s.engine.layout = pick(rng, LAYOUTS);
    if (s.engine.layout === 'EV') { s.engine.motorKw = Math.round(rndRange(rng, 40, 600)); s.engine.batteryKwh = Math.round(rndRange(rng, 20, 120)); }
    else {
      const cyl = { I3: 3, I4: 4, I6: 6, V6: 6, V8: 8, V12: 12, F6: 6 }[s.engine.layout as 'I4'];
      s.engine.displacement = Math.round(cyl * rndRange(rng, 250, 650));
      s.engine.aspiration = pick(rng, ['na', 'na', 'turbo', 'supercharged'] as const);
      s.engine.redline = Math.round(rndRange(rng, 4500, 8500));
    }
    s.size = rndRange(rng, 0.85, 1.15); s.wing = rnd(rng) < 0.3 ? rnd(rng) : 0; s.quality = rnd(rng);
    s.drive = s.enginePos === 'front' ? pick(rng, ['FWD', 'RWD', 'AWD'] as const) : 'RWD';
    return { y, s };
  });

  it('every computed figure is finite and positive where it must be', () => {
    for (const { y, s } of designs) {
      const v = stats(s, y);
      for (const k of ['mass', 'powerKw', 'torqueNm', 'zeroTo100', 'topSpeed', 'braking100', 'lateralG', 'fuelCombined', 'partsCost', 'devCost', 'devMonths', 'labourHours'] as const) {
        expect(Number.isFinite(v[k]), `${k} for ${y} ${s.body} ${s.engine.layout}`).toBe(true);
        expect(v[k]).toBeGreaterThan(0);
      }
      for (const sc of Object.values(v.scores)) { expect(sc).toBeGreaterThanOrEqual(0); expect(sc).toBeLessThanOrEqual(100); }
    }
  });
  it('top speed never needs more power than the engine delivers (½ρ·CdA·v³ ≤ P)', () => {
    for (const { y, s } of designs) {
      const v = stats(s, y);
      const vt = v.topSpeed / 3.6;
      expect(0.5 * RHO * v.cdA * vt ** 3).toBeLessThanOrEqual(v.powerKw * 1000 * 1.001);
    }
  });
  it('braking and cornering stay within what tyres can do', () => {
    for (const { y, s } of designs) {
      const v = stats(s, y);
      const vb = 100 / 3.6;
      // even a race tyre with downforce cannot decelerate a road car at more than ~1.8 g from 100 km/h
      expect(v.braking100).toBeGreaterThan((vb * vb) / (2 * 1.8 * G));
      expect(v.lateralG).toBeGreaterThan(0.35);
      expect(v.lateralG).toBeLessThan(2.0);
    }
  });
  it('engines respect thermodynamic bounds', () => {
    for (const { y, s } of designs) {
      if (s.engine.layout === 'EV') continue;
      const e = computeEngine(s.engine, y, s.quality);
      const otto = 1 - Math.pow(s.engine.compression, -0.4); // ideal air-standard Otto efficiency
      expect(e.etaI).toBeLessThan(otto);
      expect(e.bmepPeak).toBeGreaterThan(3);
      expect(e.bmepPeak).toBeLessThan(s.engine.aspiration === 'na' ? 16 : 32);
    }
  });
});
