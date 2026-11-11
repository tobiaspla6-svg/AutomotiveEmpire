// Real-car reference figures for the engineering calibration suite.
//
// Each entry names a row of the historical catalogue and the published figures of the variant that
// row represents (same engine, same driven wheels, the launch or volume version).
//
// SOURCES: manufacturer-published technical data (power, DIN/EU kerb weight, 0–100 km/h, top speed)
// and contemporary road tests, written from memory and rounded. They are reference points, not
// measurements: published 0–100 times of the same car differ by ±0.3 s between sources, pre-1972
// American power figures are converted from SAE gross to an approximate net value, and "dry"
// weights quoted by supercar makers are converted to an approximate kerb weight (+90…+130 kg).
// `limited: true` marks an electronically limited (or gearing-limited) top speed: the car could
// go faster, so the simulation is only required not to be slower.

import { MAKER } from '../src/data/manufacturers';
import { makerTech, specFromRow, tunedFinalDrive } from '../src/sim/ai';
import { computeVehicle } from '../src/sim/engineering';
import { clamp } from '../src/sim/util';

export type BenchClass = 'affordable' | 'sedan' | 'utility' | 'sports' | 'supercar' | 'hypercar' | 'ev';

export interface Benchmark {
  cls: BenchClass; maker: string; row: string; label: string; year: number;
  kw: number; kg: number; t100: number; top: number; limited?: boolean;
}

const b = (cls: BenchClass, maker: string, row: string, label: string, year: number, kw: number, kg: number, t100: number, top: number, limited = false): Benchmark =>
  ({ cls, maker, row, label, year, kw, kg, t100, top, limited });

export const BENCHMARKS: Benchmark[] = [
  // ---- affordable cars
  b('affordable', 'vw', 'Beetle (Type 1)', 'VW Beetle 1200 (34 PS)', 1961, 25, 740, 32, 115),
  b('affordable', 'renault', '5', 'Renault 5 TL', 1972, 32, 785, 20, 135),
  b('affordable', 'vw', 'Golf (Mk1)', 'VW Golf 1.1', 1974, 37, 780, 16.5, 140),
  b('affordable', 'toyota', 'Corolla (E80/E90)', 'Toyota Corolla 1.6', 1983, 60, 940, 11.8, 165),
  b('affordable', 'honda', 'Civic (6th/7th gen)', 'Honda Civic 1.6i', 1995, 78, 1080, 10.6, 187),
  b('affordable', 'ford', 'Fiesta (Mk6/Mk7)', 'Ford Fiesta 1.0 EcoBoost', 2012, 74, 1090, 11.2, 180),
  b('affordable', 'vw', 'Golf (Mk7)', 'VW Golf 1.4 TSI (140 PS)', 2012, 103, 1270, 8.4, 212),
  b('affordable', 'honda', 'Civic (10th gen)', 'Honda Civic 1.5 Turbo', 2016, 134, 1290, 8.2, 220),
  b('affordable', 'toyota', 'Corolla (E210)', 'Toyota Corolla 1.8 Hybrid', 2019, 90, 1370, 10.9, 180, true),
  // ---- sedans
  b('sedan', 'gm', 'Chevrolet Impala', 'Chevrolet Impala 327 (net)', 1962, 135, 1650, 10.5, 175),
  b('sedan', 'bmw', '5 Series (E12)', 'BMW 525', 1973, 107, 1380, 10.5, 193),
  b('sedan', 'mercedes', 'S-Class (W126)', 'Mercedes-Benz 500 SE', 1980, 177, 1620, 8.1, 225),
  b('sedan', 'bmw', '3 Series (E30)', 'BMW 325i', 1985, 126, 1180, 8.3, 217),
  b('sedan', 'ford', 'Taurus', 'Ford Taurus 3.0', 1986, 104, 1400, 10.5, 185),
  b('sedan', 'toyota', 'Camry (XV10/XV20)', 'Toyota Camry 2.2', 1992, 97, 1320, 10.5, 190),
  b('sedan', 'bmw', '3 Series (E46)', 'BMW 323i', 1998, 125, 1370, 8.0, 231),
  b('sedan', 'toyota', 'Camry (XV70)', 'Toyota Camry Hybrid', 2018, 155, 1580, 8.3, 180, true),
  b('sedan', 'bmw', '3 Series (G20)', 'BMW 330i', 2019, 190, 1545, 5.8, 250, true),
  b('sedan', 'mercedes', 'S-Class (W223)', 'Mercedes-Benz S 450', 2021, 270, 2000, 5.4, 250, true),
  // ---- SUVs and pickups
  b('utility', 'toyota', 'Land Cruiser 60/80', 'Toyota Land Cruiser FJ62', 1985, 115, 2050, 15, 155),
  b('utility', 'bmw', 'X5 (G05)', 'BMW X5 xDrive40i', 2019, 250, 2135, 5.5, 243),
  b('utility', 'toyota', 'RAV4 (XA50)', 'Toyota RAV4 Hybrid AWD', 2019, 163, 1700, 8.1, 180, true),
  b('utility', 'ford', 'F-150 (14th gen)', 'Ford F-150 3.5 EcoBoost 4x4', 2021, 298, 2250, 5.9, 175, true),
  // ---- sports cars
  b('sports', 'porsche', '356', 'Porsche 356 A 1600', 1956, 44, 850, 15, 160),
  b('sports', 'jaguar', 'E-Type', 'Jaguar E-Type 4.2', 1964, 180, 1315, 7.3, 235),
  b('sports', 'ford', 'Mustang', 'Ford Mustang 289 (net)', 1965, 135, 1340, 8.8, 185),
  b('sports', 'nissan', 'Datsun 240Z', 'Datsun 240Z', 1970, 105, 1040, 8.7, 200),
  b('sports', 'porsche', '911', 'Porsche 911 2.7', 1974, 110, 1075, 8.5, 210),
  b('sports', 'vw', 'Golf GTI (Mk1)', 'VW Golf GTI', 1976, 81, 810, 9.0, 182),
  b('sports', 'bmw', 'M3 (E30)', 'BMW M3', 1986, 147, 1200, 6.7, 235),
  b('sports', 'porsche', '911 (964)', 'Porsche 911 Carrera 2', 1989, 184, 1350, 5.7, 260),
  b('sports', 'toyota', 'Supra (A80)', 'Toyota Supra Twin Turbo', 1993, 243, 1570, 5.1, 250, true),
  b('sports', 'honda', 'S2000', 'Honda S2000', 1999, 177, 1260, 6.2, 241),
  b('sports', 'nissan', '350Z', 'Nissan 350Z', 2003, 206, 1525, 5.9, 250, true),
  b('sports', 'renault', 'Alpine A110', 'Alpine A110', 2017, 185, 1100, 4.5, 250, true),
  b('sports', 'honda', 'Civic Type R', 'Honda Civic Type R', 2017, 235, 1380, 5.8, 272),
  b('sports', 'porsche', '911 (992)', 'Porsche 911 Carrera', 2019, 283, 1505, 4.2, 293),
  b('sports', 'gm', 'Chevrolet Corvette (C8)', 'Chevrolet Corvette Stingray', 2020, 369, 1655, 3.3, 300),
  b('sports', 'ford', 'Mustang (S650)', 'Ford Mustang GT', 2024, 358, 1780, 4.9, 250, true),
  // ---- supercars
  b('supercar', 'mercedes', '300 SL', 'Mercedes-Benz 300 SL', 1954, 158, 1300, 9.0, 240),
  b('supercar', 'lamborghini', 'Miura', 'Lamborghini Miura P400', 1966, 257, 1250, 6.7, 276),
  b('supercar', 'ferrari', '365 GTB/4', 'Ferrari 365 GTB/4 Daytona', 1968, 259, 1500, 5.7, 278),
  b('supercar', 'porsche', '911 Turbo (930)', 'Porsche 911 Turbo 3.3', 1978, 221, 1300, 5.4, 260),
  b('supercar', 'lamborghini', 'Countach', 'Lamborghini Countach LP500 S', 1982, 276, 1480, 5.4, 290),
  b('supercar', 'ferrari', 'Testarossa', 'Ferrari Testarossa', 1984, 287, 1630, 5.8, 290),
  b('supercar', 'ferrari', 'F40', 'Ferrari F40', 1987, 352, 1250, 4.1, 324),
  b('supercar', 'honda', 'NSX', 'Honda NSX', 1990, 201, 1370, 5.9, 270),
  b('supercar', 'ferrari', 'F355', 'Ferrari F355', 1994, 280, 1450, 4.7, 295),
  b('supercar', 'ferrari', '360 Modena', 'Ferrari 360 Modena', 1999, 294, 1390, 4.5, 295),
  b('supercar', 'ford', 'GT', 'Ford GT', 2005, 410, 1520, 3.8, 330),
  b('supercar', 'audi', 'R8', 'Audi R8 4.2', 2007, 309, 1560, 4.6, 301),
  b('supercar', 'nissan', 'GT-R (R35)', 'Nissan GT-R', 2008, 353, 1740, 3.5, 310),
  b('supercar', 'ferrari', '458 Italia', 'Ferrari 458 Italia', 2009, 419, 1485, 3.4, 325),
  b('supercar', 'mercedes', 'SLS AMG', 'Mercedes-Benz SLS AMG', 2010, 420, 1620, 3.8, 317),
  b('supercar', 'toyota', 'Lexus LFA', 'Lexus LFA', 2010, 412, 1480, 3.7, 325),
  b('supercar', 'lamborghini', 'Aventador', 'Lamborghini Aventador LP700-4', 2011, 515, 1750, 2.9, 350),
  b('supercar', 'lamborghini', 'Huracán', 'Lamborghini Huracán LP610-4', 2014, 449, 1550, 3.2, 325),
  b('supercar', 'mercedes', 'AMG GT', 'Mercedes-AMG GT S', 2015, 375, 1570, 3.8, 310),
  b('supercar', 'mclaren', '720S', 'McLaren 720S', 2017, 530, 1419, 2.9, 341),
  b('supercar', 'ferrari', '812 Superfast', 'Ferrari 812 Superfast', 2017, 588, 1630, 2.9, 340),
  b('supercar', 'ferrari', 'F8 Tributo', 'Ferrari F8 Tributo', 2019, 530, 1435, 2.9, 340),
  b('supercar', 'ferrari', '296 GTB', 'Ferrari 296 GTB', 2022, 610, 1600, 2.9, 330),
  b('supercar', 'ferrari', '12Cilindri', 'Ferrari 12Cilindri', 2024, 610, 1700, 2.9, 340),
  // ---- hypercars
  b('hypercar', 'porsche', '959', 'Porsche 959', 1986, 331, 1450, 3.7, 317),
  b('hypercar', 'jaguar', 'XJ220', 'Jaguar XJ220', 1992, 404, 1470, 3.9, 343),
  b('hypercar', 'mclaren', 'F1', 'McLaren F1', 1993, 461, 1140, 3.2, 386),
  b('hypercar', 'porsche', 'Carrera GT', 'Porsche Carrera GT', 2004, 450, 1380, 3.9, 330),
  b('hypercar', 'porsche', '918 Spyder', 'Porsche 918 Spyder', 2013, 652, 1675, 2.6, 345),
  b('hypercar', 'mclaren', 'P1', 'McLaren P1', 2013, 674, 1490, 2.8, 350, true),
  b('hypercar', 'ferrari', 'SF90 Stradale', 'Ferrari SF90 Stradale', 2020, 735, 1700, 2.5, 340, true), // top speed set by gearing, not by drag
  b('hypercar', 'lamborghini', 'Revuelto', 'Lamborghini Revuelto', 2023, 746, 1900, 2.5, 350, true),
  b('hypercar', 'ferrari', 'F80', 'Ferrari F80', 2025, 883, 1650, 2.15, 350, true),
  b('hypercar', 'mclaren', 'W1', 'McLaren W1', 2025, 938, 1500, 2.7, 350, true),
  // ---- electric cars (top speeds are limited by the manufacturer)
  b('ev', 'nissan', 'Leaf', 'Nissan Leaf', 2011, 80, 1520, 11.5, 145, true),
  b('ev', 'tesla', 'Model S', 'Tesla Model S 85', 2012, 270, 2108, 5.6, 210, true),
  b('ev', 'bmw', 'i3', 'BMW i3', 2013, 125, 1270, 7.2, 150, true),
  b('ev', 'tesla', 'Model X', 'Tesla Model X 90D', 2016, 310, 2390, 5.0, 250, true),
  b('ev', 'gm', 'Chevrolet Bolt EV', 'Chevrolet Bolt EV', 2017, 150, 1616, 7.3, 146, true),
  b('ev', 'tesla', 'Model 3', 'Tesla Model 3 RWD', 2018, 208, 1650, 5.8, 225, true),
  b('ev', 'jaguar', 'I-Pace', 'Jaguar I-Pace EV400', 2018, 294, 2133, 4.8, 200, true),
  b('ev', 'porsche', 'Taycan', 'Porsche Taycan 4S', 2020, 390, 2215, 4.0, 250, true),
  b('ev', 'vw', 'ID.3', 'VW ID.3 Pro', 2020, 150, 1730, 7.3, 160, true),
  b('ev', 'hyundai', 'Ioniq 5', 'Hyundai Ioniq 5 RWD', 2021, 160, 1910, 7.4, 185, true),
  b('ev', 'tesla', 'Cybertruck', 'Tesla Cybertruck AWD', 2024, 447, 2995, 4.3, 180, true),
];

/** The benchmark car exactly as the game builds it from its catalogue row (same code path as a new game). */
export function simulateBenchmark(bm: Benchmark) {
  const def = MAKER[bm.maker];
  const row = def.models.find((r) => r.name === bm.row);
  if (!row) throw new Error(`no catalogue row ${bm.maker} / ${bm.row}`);
  const year = clamp(row.from, 1946, 2030);
  const tech = makerTech(def, year);
  const spec = specFromRow(row, def);
  spec.finalDrive = tunedFinalDrive(spec, year, tech);
  return { spec, year, tech, st: computeVehicle(spec, { year, tech }) };
}

/**
 * Cars the catalogue cannot describe well, with the reason. They are still tested, against a wider band.
 *  - McLaren F1: a one-off lightweight (1,140 kg, bespoke tyres, no wing) that era-typical supercar rules over-weigh.
 *  - Alpine A110: a very compact all-aluminium car; the catalogue builds mid-engined sports cars of volume makers in steel.
 */
export const KNOWN_OUTLIERS: Record<string, string> = {
  'McLaren F1': 'bespoke lightweight construction and low-drag body',
  'Alpine A110': 'compact all-aluminium structure',
};
