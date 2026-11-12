// Engineering calibration suite (Phase 2).
//
// 1. Benchmarks: 83 real cars from seven classes and eight decades, built by the game from its own
//    catalogue rows and compared with their published figures (see tests/benchmarks.ts for sources).
// 2. Mechanisms: the physical causes behind the figures (weight distribution, traction, launch
//    control, tyres, gearing, drag, mass) each move the result the right way and by a plausible amount.
//
// `npx tsx scripts/benchmarks.ts` prints the full table.
import { describe, expect, it } from 'vitest';
import { computeVehicle, defaultEngine, defaultVehicle, G, gearRatios, suggestFinalDrive } from '../src/sim/engineering';
import { MAKERS } from '../src/data/manufacturers';
import { makerTech, specFromRow, tunedFinalDrive } from '../src/sim/ai';
import type { Tech, VehicleSpec } from '../src/sim/types';
import { clamp } from '../src/sim/util';
import { BENCHMARKS, KNOWN_OUTLIERS, simulateBenchmark, type BenchClass } from './benchmarks';

const tech = (y: number): Tech => ({ engine: y, chassis: y, aero: y, electronics: y, manufacturing: y });
const stats = (s: VehicleSpec, y: number) => computeVehicle(s, { year: y, tech: tech(y) });
const rel = (sim: number, real: number) => sim / real - 1;

const results = BENCHMARKS.map((bm) => ({ bm, ...simulateBenchmark(bm) }));
const CLASSES: BenchClass[] = ['affordable', 'sedan', 'utility', 'sports', 'supercar', 'hypercar', 'ev'];

describe('benchmark cars against published figures', () => {
  it('covers every class and every decade from the 1950s to the 2020s', () => {
    for (const c of CLASSES) expect(results.filter((r) => r.bm.cls === c).length, c).toBeGreaterThanOrEqual(4);
    for (let d = 1950; d <= 2020; d += 10) expect(results.some((r) => r.bm.year >= d && r.bm.year < d + 10), `${d}s`).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(80);
  });

  it.each(results.map((r) => [r.bm.label, r] as const))('%s', (_label, r) => {
    const { bm, st } = r;
    const wide = bm.label in KNOWN_OUTLIERS ? 1.5 : 1;
    expect(Math.abs(rel(st.powerKw, bm.kw)), `power ${st.powerKw.toFixed(0)} kW vs ${bm.kw}`).toBeLessThan(0.25 * wide);
    expect(Math.abs(rel(st.mass, bm.kg)), `mass ${st.mass.toFixed(0)} kg vs ${bm.kg}`).toBeLessThan(0.2 * wide);
    expect(Math.abs(rel(st.zeroTo100, bm.t100)), `0–100 ${st.zeroTo100.toFixed(1)} s vs ${bm.t100}`).toBeLessThan(0.22 * wide);
    if (bm.limited) expect(st.topSpeed, `top speed ${st.topSpeed.toFixed(0)} km/h must reach the limited ${bm.top}`).toBeGreaterThan(bm.top * 0.88);
    else expect(Math.abs(rel(st.topSpeed, bm.top)), `top speed ${st.topSpeed.toFixed(0)} km/h vs ${bm.top}`).toBeLessThan(0.2 * wide);
  });

  it.each(CLASSES)('%s: mean error and bias of the class stay small', (cls) => {
    const rows = results.filter((r) => r.bm.cls === cls);
    const mae = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + Math.abs(f(r)), 0) / rows.length;
    const bias = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
    const accel = (r: (typeof rows)[number]) => rel(r.st.zeroTo100, r.bm.t100);
    expect(mae(accel), '0–100 mean absolute error').toBeLessThan(cls === 'utility' ? 0.16 : 0.12);
    expect(Math.abs(bias(accel)), '0–100 bias').toBeLessThan(0.08);
    expect(mae((r) => rel(r.st.powerKw, r.bm.kw)), 'power').toBeLessThan(0.12);
    expect(mae((r) => rel(r.st.mass, r.bm.kg)), 'mass').toBeLessThan(0.1);
    const free = rows.filter((r) => !r.bm.limited);
    if (free.length) expect(free.reduce((a, r) => a + Math.abs(rel(r.st.topSpeed, r.bm.top)), 0) / free.length, 'top speed').toBeLessThan(cls === 'utility' ? 0.1 : 0.08);
  });

  it('the cars from the Phase 2 bug report: modern rear-drive supercars reach 100 km/h in about three seconds', () => {
    const t = (label: string) => results.find((r) => r.bm.label === label)!.st.zeroTo100;
    expect(t('Ferrari 12Cilindri')).toBeGreaterThan(2.6); expect(t('Ferrari 12Cilindri')).toBeLessThan(3.25); // was 4.3 s, real 2.9 s
    expect(t('Ferrari 812 Superfast')).toBeLessThan(3.3); // was 4.4 s
    expect(t('McLaren 720S')).toBeLessThan(3.1);
    expect(t('Toyota Corolla 1.8 Hybrid')).toBeGreaterThan(8); // was 6.1 s: family cars are no longer sports cars
    expect(t('VW Golf 1.4 TSI (140 PS)')).toBeGreaterThan(7.4);
  });

  it('keeps the classes in the right order of performance', () => {
    const median = (cls: BenchClass, from: number) => {
      const v = results.filter((r) => r.bm.cls === cls && r.bm.year >= from).map((r) => r.st.zeroTo100).sort((a, b) => a - b);
      return v[Math.floor(v.length / 2)];
    };
    expect(median('hypercar', 2000)).toBeLessThan(median('supercar', 2000));
    expect(median('supercar', 2000)).toBeLessThan(median('sports', 2000));
    expect(median('sports', 2000)).toBeLessThan(median('sedan', 2000));
    expect(median('sedan', 2000)).toBeLessThan(median('affordable', 2000));
    // and every class got faster over the decades
    for (const cls of ['affordable', 'sedan', 'sports', 'supercar'] as BenchClass[]) {
      const old = results.filter((r) => r.bm.cls === cls && r.bm.year < 1985), modern = results.filter((r) => r.bm.cls === cls && r.bm.year >= 2005);
      const mean = (a: typeof old) => a.reduce((x, r) => x + r.st.zeroTo100, 0) / a.length;
      expect(mean(modern), cls).toBeLessThan(mean(old));
    }
  });

  it('no car out-accelerates its tyres, and power always covers the drag at top speed', () => {
    for (const { bm, st } of results) {
      expect(27.78 / st.zeroTo100, bm.label).toBeLessThan(1.45 * G); // mean acceleration to 100 km/h
      const v = st.topSpeed / 3.6;
      expect(0.5 * 1.225 * st.cdA * v ** 3, bm.label).toBeLessThanOrEqual(st.powerKw * 1000 * 1.001);
      if (st.zeroTo200 != null) expect(st.zeroTo200, bm.label).toBeGreaterThan(st.zeroTo100 * 2);
      if (st.passing80to120 != null) expect(st.passing80to120, bm.label).toBeGreaterThan(0.6);
    }
  });
});

describe('every catalogue car is physically plausible', () => {
  it('all 595 historical models: finite figures, sane mass, power density and acceleration for their class', () => {
    let n = 0;
    for (const def of MAKERS) for (const row of def.models) {
      const year = clamp(row.from, 1946, 2030), t = makerTech(def, year), spec = specFromRow(row, def);
      spec.finalDrive = tunedFinalDrive(spec, year, t);
      const st = computeVehicle(spec, { year, tech: t });
      const tag = `${def.name} ${row.name} (${row.from})`;
      n++;
      for (const k of ['mass', 'powerKw', 'zeroTo100', 'topSpeed', 'braking100', 'fuelCombined'] as const) expect(Number.isFinite(st[k]) && st[k] > 0, `${tag} ${k}`).toBe(true);
      expect(spec.size, tag).toBeGreaterThanOrEqual(0.75); expect(spec.size, tag).toBeLessThanOrEqual(1.15);
      expect(spec.finalDrive, tag).toBeGreaterThanOrEqual(2.2); expect(spec.finalDrive, tag).toBeLessThanOrEqual(5.5);
      expect(st.mass, tag).toBeGreaterThan(420); expect(st.mass, tag).toBeLessThan(3300);
      expect(st.weightFront, tag).toBeGreaterThan(0.33); expect(st.weightFront, tag).toBeLessThan(0.68);
      expect(27.78 / st.zeroTo100, tag).toBeLessThan(1.45 * G);
      if (spec.engine.layout !== 'EV') {
        const perLitre = (st.powerKw - spec.engine.hybridKw) / (spec.engine.displacement / 1000);
        expect(perLitre, `${tag} kW/L`).toBeGreaterThan(12);
        // road engines: ≈ 95 kW/L naturally aspirated at the very top, ≈ 230 kW/L for the most extreme turbo hybrids
        expect(perLitre, `${tag} kW/L`).toBeLessThan(spec.engine.aspiration === 'na' ? 100 : 240);
      }
      // mainstream cars are not supercars
      if (row.seg === 'budget' || row.seg === 'family') { expect(st.zeroTo100, tag).toBeGreaterThan(row.layout === 'EV' ? 4.5 : 6); expect(st.topSpeed, tag).toBeLessThan(270); }
      if (row.seg === 'supercar' && row.from >= 2010) expect(st.zeroTo100, tag).toBeLessThan(4.5);
    }
    expect(n).toBeGreaterThan(550);
  });
});

describe('the mechanisms behind acceleration', () => {
  /** A 600 kW front-engined rear-drive GT of 2024, the layout from the bug report. */
  const gt = (): VehicleSpec => {
    const s = defaultVehicle(2024, 'coupe');
    s.engine = { ...defaultEngine(2024), layout: 'V12', displacement: 6500, valvetrain: 'dohc4', compression: 13, redline: 9000, cam: 0.75, boreStroke: 1.2 };
    s.drive = 'RWD'; s.gearbox = 'dct'; s.gears = 7; s.sport = 0.85; s.quality = 0.9; s.chassis = 'aluminium'; s.panels = 'aluminium';
    s.tireWidth = 315; s.tireCompound = 'semislick'; s.wheelDia = 20; s.suspFront = 'wishbone'; s.suspRear = 'wishbone'; s.brakes = 'ceramic'; s.interior = 'premium'; s.seats = 2;
    s.transaxle = true;
    s.finalDrive = suggestFinalDrive(s, { year: 2024, tech: tech(2024) });
    return s;
  };
  const t100 = (f: (s: VehicleSpec) => void, y = 2024) => { const s = gt(); f(s); return stats(s, y); };

  it('the reference GT is traction-limited and reaches 100 km/h in about three seconds', () => {
    const v = stats(gt(), 2024);
    expect(v.powerKw).toBeGreaterThan(540);
    expect(v.zeroTo100).toBeGreaterThan(2.6); expect(v.zeroTo100).toBeLessThan(3.3);
    expect(v.weightFront).toBeGreaterThan(0.44); expect(v.weightFront).toBeLessThan(0.5);
  });
  it('weight distribution: a rear transaxle and a mid engine put more load on the driven wheels and launch harder', () => {
    const base = t100(() => {}), noTransaxle = t100((s) => { s.transaxle = false; }), mid = t100((s) => { s.enginePos = 'mid'; s.transaxle = false; });
    expect(noTransaxle.weightFront - base.weightFront).toBeGreaterThan(0.03);
    expect(noTransaxle.zeroTo100).toBeGreaterThan(base.zeroTo100 + 0.08);
    expect(mid.weightFront).toBeLessThan(base.weightFront);
    expect(mid.zeroTo100).toBeLessThan(base.zeroTo100);
    // and the option costs money and a little mass
    expect(base.partsCost).toBeGreaterThan(noTransaxle.partsCost);
  });
  it('driven wheels: all-wheel drive beats rear-drive off the line, front-drive is hopeless at this power', () => {
    const rwd = t100(() => {}), awd = t100((s) => { s.drive = 'AWD'; }), fwd = t100((s) => { s.drive = 'FWD'; s.transaxle = false; });
    expect(awd.zeroTo100).toBeLessThan(rwd.zeroTo100 - 0.2);
    expect(fwd.zeroTo100).toBeGreaterThan(rwd.zeroTo100 + 0.8);
  });
  it('tyres: each stickier compound and wider tyres shorten a traction-limited start', () => {
    const c = (['economy', 'touring', 'sport', 'semislick'] as const).map((k) => t100((s) => { s.tireCompound = k; }).zeroTo100);
    expect(c[0]).toBeGreaterThan(c[1]); expect(c[1]).toBeGreaterThan(c[2]); expect(c[2]).toBeGreaterThan(c[3]);
    expect(c[0] - c[3]).toBeGreaterThan(0.6);
    expect(t100((s) => { s.tireWidth = 225; }).zeroTo100).toBeGreaterThan(c[3]);
  });
  it('launch control and traction electronics: the same car is quicker with 2024 electronics than with those of 1990', () => {
    const modern = stats(gt(), 2024);
    const old = computeVehicle(gt(), { year: 2024, tech: { ...tech(2024), electronics: 1990 } });
    expect(old.zeroTo100).toBeGreaterThan(modern.zeroTo100 + 0.1);
    // a manual gearbox loses time on every change and cannot use launch control
    const manual = t100((s) => { s.gearbox = 'manual'; s.gears = 6; });
    expect(manual.zeroTo100).toBeGreaterThanOrEqual(modern.zeroTo100);
    expect(manual.quarterMile).toBeGreaterThan(modern.quarterMile + 0.25);
  });
  it('power-to-weight: when traction is not the limit, more power or less mass is faster in proportion', () => {
    const sedan = (kw: number, big = false) => {
      const s = defaultVehicle(2020, 'sedan'); s.engine = { ...defaultEngine(2020), layout: 'EV', motorKw: kw, batteryKwh: 70 }; s.drive = 'AWD'; s.gearbox = 'auto';
      if (big) { s.size = 1.15; s.interior = 'luxury'; }
      return stats(s, 2020);
    };
    const a = sedan(120), b = sedan(240), heavy = sedan(120, true);
    expect(b.zeroTo100).toBeLessThan(a.zeroTo100 * 0.65); // twice the power: far quicker, but not twice (drag, traction)
    expect(b.zeroTo100).toBeGreaterThan(a.zeroTo100 * 0.45);
    expect(heavy.mass).toBeGreaterThan(a.mass * 1.1);
    expect(heavy.zeroTo100).toBeGreaterThan(a.zeroTo100 * 1.06);
    // rolling acceleration follows power-to-weight too
    expect(b.passing80to120!).toBeLessThan(a.passing80to120! * 0.62);
    expect(b.zeroTo200!).toBeLessThan(a.zeroTo200 ?? 99);
  });
  it('gearing: a shorter final drive pulls harder at speed and lowers a rev-limited top speed; the suggested ratio is near the best top speed', () => {
    const s = defaultVehicle(2010, 'sedan'); s.drive = 'RWD'; s.engine.displacement = 2500; s.engine.layout = 'I6';
    const ctx = { year: 2010, tech: tech(2010) };
    const at = (fd: number) => computeVehicle({ ...s, finalDrive: fd }, ctx);
    expect(at(4.6).passing80to120!).toBeLessThanOrEqual(at(2.6).passing80to120!);
    let best = 0;
    for (let fd = 2.2; fd <= 5.5; fd += 0.1) best = Math.max(best, at(fd).topSpeed);
    const sug = suggestFinalDrive(s, ctx);
    expect(sug).toBeGreaterThanOrEqual(2.2); expect(sug).toBeLessThanOrEqual(5.5);
    expect(at(sug).topSpeed).toBeGreaterThan(best * 0.97);
    expect(at(5.5).topSpeed).toBeLessThan(best * 0.95); // far too short: runs into the rev limiter
    // a sports gearbox has a taller first gear and closer ratios than a touring box with the same top gear
    const touring = gearRatios(6, false, 0), sport = gearRatios(6, false, 1);
    expect(sport[0]).toBeLessThan(touring[0]); expect(sport[5]).toBeCloseTo(touring[5], 6);
    for (let i = 1; i < 6; i++) expect(sport[i]).toBeLessThan(sport[i - 1]);
  });
  it('drag: a powerful engine needs cooling air, wide tyres and wings cost top speed', () => {
    const base = t100(() => {});
    expect(t100((s) => { s.wing = 0.8; }).topSpeed).toBeLessThan(base.topSpeed - 8);
    expect(t100((s) => { s.tireWidth = 225; }).cd).toBeLessThan(base.cd);
    const mild = t100((s) => { s.engine.displacement = 3000; s.engine.layout = 'V6'; });
    expect(mild.cd).toBeLessThan(base.cd);
  });
  it('mass: safety equipment, luxury trim and size all add weight; a sport-focused cabin and exotic materials remove it', () => {
    const car = (f: (s: VehicleSpec) => void) => { const s = defaultVehicle(2015, 'sedan'); f(s); return stats(s, 2015).mass; };
    const base = car(() => {});
    expect(base).toBeGreaterThan(1250); expect(base).toBeLessThan(1650); // a 4.65 m family saloon of 2015
    expect(car((s) => { s.safety = 0; })).toBeLessThan(base - 120);
    expect(car((s) => { s.interior = 'luxury'; })).toBeGreaterThan(base + 100);
    expect(car((s) => { s.size = 1.12; })).toBeGreaterThan(base * 1.12);
    expect(car((s) => { s.sport = 1; })).toBeLessThan(car((s) => { s.sport = 0; }));
    expect(car((s) => { s.chassis = 'carbon'; s.panels = 'carbon'; })).toBeLessThan(base - 150);
  });
  it('electric cars: instant torque makes them quick to 100 km/h for their power, single-speed gearing caps the top speed', () => {
    const ev = defaultVehicle(2022, 'sedan'); ev.engine = { ...defaultEngine(2022), layout: 'EV', motorKw: 200, batteryKwh: 75 }; ev.drive = 'RWD'; ev.gearbox = 'auto';
    const ice = defaultVehicle(2022, 'sedan'); ice.engine = { ...defaultEngine(2022), displacement: 2000, aspiration: 'turbo', boost: 1.0, compression: 10 }; ice.drive = 'RWD'; ice.gearbox = 'auto'; ice.gears = 8;
    ice.finalDrive = suggestFinalDrive(ice, { year: 2022, tech: tech(2022) });
    const e = stats(ev, 2022), i = stats(ice, 2022);
    expect(e.mass).toBeGreaterThan(i.mass + 200); // the battery
    expect(e.zeroTo100).toBeLessThan(7.2);
    expect(e.topSpeed).toBeLessThan(265);
    const strong = { ...ev, engine: { ...ev.engine, motorKw: 600 } };
    expect(stats(strong, 2022).topSpeed).toBeLessThan(e.topSpeed + 12); // three times the power, same rotor speed limit
    expect(e.zeroTo100 / i.zeroTo100).toBeLessThan((e.mass / e.powerKw) / (i.mass / i.powerKw) * 1.05); // better than its power-to-weight alone would suggest
  });
});
