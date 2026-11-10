import type { RegionId, SegmentId, BodyType, Scores } from '../sim/types';
import { cpi, kf, type KF } from '../sim/util';

// ---------------------------------------------------------------------------------------------
// World / market reference data.
// DATA STATUS: region market sizes are rounded approximations of historical new-vehicle sales
// (order-of-magnitude correct, compiled from memory of public industry statistics). Segment mixes,
// preference weights, tariffs and wage curves are ESTIMATED GAME DATA tuned for plausible play.
// ---------------------------------------------------------------------------------------------

export const REGIONS: { id: RegionId; name: string; short: string }[] = [
  { id: 'NA', name: 'North America', short: 'N. America' },
  { id: 'EU', name: 'Europe', short: 'Europe' },
  { id: 'JP', name: 'Japan & Korea', short: 'Japan/Korea' },
  { id: 'CN', name: 'China', short: 'China' },
  { id: 'LATAM', name: 'Latin America', short: 'Lat. America' },
  { id: 'ROW', name: 'Rest of World', short: 'Rest of World' },
];
export const REGION_IDS: RegionId[] = REGIONS.map((r) => r.id);
export const REGION_NAME: Record<RegionId, string> = Object.fromEntries(REGIONS.map((r) => [r.id, r.name])) as Record<RegionId, string>;

/** Annual new light-vehicle sales, million units (approximate historical). */
export const REGION_VOLUME: Record<RegionId, KF> = {
  NA: [[1950, 7.0], [1960, 7.4], [1970, 10.5], [1980, 11.5], [1990, 16], [2000, 20], [2010, 14], [2015, 20.5], [2020, 17], [2025, 19]],
  EU: [[1950, 1.6], [1960, 5.2], [1970, 9.5], [1980, 12.5], [1990, 17.5], [2000, 19.5], [2010, 18.5], [2015, 18.8], [2020, 16], [2025, 17.5]],
  JP: [[1950, 0.03], [1960, 0.45], [1970, 4.2], [1980, 5.4], [1990, 8.7], [2000, 7.4], [2010, 6.5], [2020, 6.5], [2025, 6.3]],
  CN: [[1950, 0.001], [1970, 0.08], [1980, 0.2], [1990, 0.6], [2000, 2.1], [2005, 5.8], [2010, 18], [2015, 24.6], [2020, 25], [2025, 30]],
  LATAM: [[1950, 0.2], [1960, 0.5], [1970, 1.2], [1980, 2.4], [1990, 2.3], [2000, 3.8], [2010, 6], [2020, 4.5], [2025, 5.2]],
  ROW: [[1950, 0.4], [1960, 0.9], [1970, 2.0], [1980, 3.6], [1990, 4.5], [2000, 6], [2010, 10], [2020, 10], [2025, 12]],
};

export interface SegmentDef {
  id: SegmentId; name: string; price2020: number; elasticity: number;
  weights: Partial<Record<keyof Scores, number>>;
  share: KF; // share of world volume
  regionBias: Partial<Record<RegionId, number>>;
  bodyFit: Partial<Record<BodyType, number>>;
}
/** How segment prices moved in real terms (exotics and luxury cars were relatively cheaper in the past). */
const REAL_PRICE: Partial<Record<SegmentId, KF>> = {
  supercar: [[1950, 0.38], [1970, 0.45], [1990, 0.62], [2010, 0.9], [2020, 1]], luxury: [[1950, 0.6], [1990, 0.8], [2020, 1]], premium: [[1950, 0.7], [2020, 1]],
};
const REAL_DEFAULT: KF = [[1950, 0.8], [1990, 0.9], [2020, 1]];
export const SEGMENTS: SegmentDef[] = [
  { id: 'budget', name: 'Budget / City', price2020: 16000, elasticity: 3.2,
    weights: { economy: 0.3, reliability: 0.25, practicality: 0.2, comfort: 0.1, safety: 0.1, performance: 0.05 },
    share: [[1950, 0.3], [1980, 0.33], [2000, 0.3], [2020, 0.2]], regionBias: { NA: 0.5, EU: 1.3, JP: 1.4, CN: 1.1, LATAM: 1.6, ROW: 1.4 },
    bodyFit: { hatch: 1, sedan: 0.92, wagon: 0.85, coupe: 0.6, suv: 0.75, roadster: 0.4, pickup: 0.5, supercar: 0.1 } },
  { id: 'family', name: 'Family / Mid-size', price2020: 27000, elasticity: 2.6,
    weights: { comfort: 0.2, practicality: 0.2, reliability: 0.2, economy: 0.15, safety: 0.15, performance: 0.05, prestige: 0.05 },
    share: [[1950, 0.4], [1980, 0.36], [2000, 0.3], [2020, 0.2]], regionBias: { NA: 1.1, EU: 1.0, JP: 0.9, CN: 1.1, LATAM: 0.8, ROW: 0.9 },
    bodyFit: { sedan: 1, wagon: 1, hatch: 0.9, suv: 0.85, coupe: 0.6, pickup: 0.5, roadster: 0.3, supercar: 0.1 } },
  { id: 'premium', name: 'Premium / Executive', price2020: 54000, elasticity: 1.8,
    weights: { comfort: 0.25, prestige: 0.25, performance: 0.15, safety: 0.1, reliability: 0.1, drivability: 0.1, practicality: 0.05 },
    share: [[1950, 0.07], [1980, 0.08], [2000, 0.1], [2020, 0.11]], regionBias: { NA: 1.1, EU: 1.3, JP: 0.8, CN: 1.1, LATAM: 0.4, ROW: 0.6 },
    bodyFit: { sedan: 1, wagon: 0.9, coupe: 0.9, suv: 0.95, hatch: 0.7, roadster: 0.7, supercar: 0.4, pickup: 0.3 } },
  { id: 'luxury', name: 'Luxury', price2020: 115000, elasticity: 1.2,
    weights: { comfort: 0.35, prestige: 0.35, performance: 0.1, safety: 0.1, reliability: 0.1 },
    share: [[1950, 0.012], [1980, 0.01], [2020, 0.012]], regionBias: { NA: 1.3, EU: 1.0, JP: 0.7, CN: 1.3, LATAM: 0.3, ROW: 0.9 },
    bodyFit: { sedan: 1, suv: 0.95, coupe: 0.85, wagon: 0.6, roadster: 0.6, supercar: 0.4, hatch: 0.2, pickup: 0.2 } },
  { id: 'sports', name: 'Sports', price2020: 46000, elasticity: 1.9,
    weights: { performance: 0.4, drivability: 0.2, prestige: 0.15, reliability: 0.1, comfort: 0.05, economy: 0.05, practicality: 0.05 },
    share: [[1950, 0.02], [1970, 0.04], [1990, 0.035], [2020, 0.02]], regionBias: { NA: 1.4, EU: 1.1, JP: 0.9, CN: 0.4, LATAM: 0.3, ROW: 0.5 },
    bodyFit: { coupe: 1, roadster: 1, hatch: 0.8, supercar: 0.9, sedan: 0.7, wagon: 0.4, suv: 0.3, pickup: 0.2 } },
  { id: 'supercar', name: 'Supercar / Exotic', price2020: 290000, elasticity: 0.9,
    weights: { performance: 0.5, prestige: 0.35, drivability: 0.15 },
    share: [[1950, 0.0003], [1970, 0.0005], [1990, 0.0005], [2010, 0.0006], [2020, 0.0008]], regionBias: { NA: 1.3, EU: 1.3, JP: 0.7, CN: 0.7, LATAM: 0.2, ROW: 1.2 },
    bodyFit: { supercar: 1, coupe: 0.85, roadster: 0.85, sedan: 0.3, suv: 0.3, hatch: 0.1, wagon: 0.1, pickup: 0.05 } },
  { id: 'suv', name: 'SUV / Crossover', price2020: 37000, elasticity: 2.2,
    weights: { practicality: 0.3, comfort: 0.2, safety: 0.15, reliability: 0.15, prestige: 0.1, economy: 0.1 },
    share: [[1950, 0.02], [1980, 0.04], [1995, 0.1], [2010, 0.22], [2020, 0.36], [2025, 0.4]], regionBias: { NA: 1.3, EU: 0.9, JP: 0.7, CN: 1.1, LATAM: 0.9, ROW: 1.0 },
    bodyFit: { suv: 1, wagon: 0.6, pickup: 0.6, hatch: 0.3, sedan: 0.2, coupe: 0.1, roadster: 0.05, supercar: 0.05 } },
  { id: 'pickup', name: 'Pickup / Commercial', price2020: 33000, elasticity: 2.2,
    weights: { practicality: 0.4, reliability: 0.3, economy: 0.1, comfort: 0.1, performance: 0.1 },
    share: [[1950, 0.17], [1980, 0.16], [2020, 0.12]], regionBias: { NA: 1.7, EU: 0.6, JP: 0.8, CN: 0.6, LATAM: 1.3, ROW: 1.3 },
    bodyFit: { pickup: 1, suv: 0.5, wagon: 0.45, hatch: 0.1, sedan: 0.1, coupe: 0.05, roadster: 0.02, supercar: 0.02 } },
];
export const segPrice = (seg: SegmentId, year: number) => SEG[seg].price2020 * cpi(year) * kf(REAL_PRICE[seg] ?? REAL_DEFAULT, year);
export const SEGMENT_IDS: SegmentId[] = SEGMENTS.map((s) => s.id);
export const SEG: Record<SegmentId, SegmentDef> = Object.fromEntries(SEGMENTS.map((s) => [s.id, s])) as Record<SegmentId, SegmentDef>;

export interface CountryDef { id: string; name: string; region: RegionId; wage2020: number; wageCurve: KF }
const EARLY: KF = [[1950, 0.25], [1980, 0.9], [2000, 1]];
export const COUNTRIES: CountryDef[] = [
  { id: 'USA', name: 'United States', region: 'NA', wage2020: 38, wageCurve: [[1950, 0.55], [2000, 1]] },
  { id: 'Germany', name: 'Germany', region: 'EU', wage2020: 46, wageCurve: EARLY },
  { id: 'Italy', name: 'Italy', region: 'EU', wage2020: 32, wageCurve: EARLY },
  { id: 'UK', name: 'United Kingdom', region: 'EU', wage2020: 31, wageCurve: [[1950, 0.35], [1980, 0.85], [2000, 1]] },
  { id: 'France', name: 'France', region: 'EU', wage2020: 39, wageCurve: EARLY },
  { id: 'Sweden', name: 'Sweden', region: 'EU', wage2020: 42, wageCurve: [[1950, 0.4], [1980, 0.95], [2000, 1]] },
  { id: 'Spain', name: 'Spain', region: 'EU', wage2020: 25, wageCurve: [[1950, 0.12], [1990, 0.8], [2005, 1]] },
  { id: 'Japan', name: 'Japan', region: 'JP', wage2020: 30, wageCurve: [[1950, 0.1], [1985, 0.8], [1995, 1]] },
  { id: 'South Korea', name: 'South Korea', region: 'JP', wage2020: 26, wageCurve: [[1950, 0.03], [1975, 0.08], [2000, 0.6], [2015, 1]] },
  { id: 'China', name: 'China', region: 'CN', wage2020: 7, wageCurve: [[1950, 0.04], [1990, 0.06], [2010, 0.5], [2020, 1]] },
  { id: 'Mexico', name: 'Mexico', region: 'LATAM', wage2020: 5, wageCurve: [[1950, 0.5], [2000, 1]] },
  { id: 'Brazil', name: 'Brazil', region: 'LATAM', wage2020: 8, wageCurve: [[1950, 0.4], [2000, 1]] },
  { id: 'India', name: 'India', region: 'ROW', wage2020: 3, wageCurve: [[1950, 0.3], [2000, 0.6], [2020, 1]] },
];
export const COUNTRY: Record<string, CountryDef> = Object.fromEntries(COUNTRIES.map((c) => [c.id, c]));

/** Import tariff into a region for vehicles not built there (fraction of price; simplified history). */
export const TARIFF: Record<RegionId, KF> = {
  NA: [[1950, 0.1], [1970, 0.035], [2020, 0.025]],
  EU: [[1950, 0.25], [1970, 0.11], [2020, 0.1]],
  JP: [[1950, 0.4], [1970, 0.2], [1978, 0.0], [2020, 0.0]],
  CN: [[1950, 2.0], [1990, 1.8], [2001, 0.7], [2006, 0.25], [2018, 0.15]],
  LATAM: [[1950, 0.6], [1990, 0.5], [2000, 0.35]],
  ROW: [[1950, 0.4], [2000, 0.25], [2020, 0.2]],
};
/** Real pump-price index of fuel relative to "normal" (shocks come from events on top of this). */
export const FUEL_BASE: KF = [[1950, 0.9], [1970, 0.8], [1985, 1.1], [1998, 0.8], [2008, 1.4], [2016, 0.95], [2022, 1.35], [2025, 1.15]];
/** How willing the market is to buy battery-electric cars (charging infrastructure, familiarity). */
export const EV_ACCEPTANCE: KF = [[1990, 0.08], [2008, 0.2], [2013, 0.4], [2018, 0.7], [2021, 0.95], [2025, 1.1]];
