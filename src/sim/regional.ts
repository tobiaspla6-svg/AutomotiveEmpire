// Regional pricing (Phase 3).
//
// The books stay in US dollars. A car sells at its world (dollar) list price everywhere unless the player sets a
// REGIONAL PRICE for a market. A regional price is fixed in local currency, so its dollar value moves with the
// region's exchange rate (currency exposure). What buyers in a region will pay also depends on PURCHASING POWER
// and on SALES TAXES (VAT and registration taxes added on top of the list price); tariffs and the cost of shipping
// cars from another region already exist. Demand in each region compares the price buyers see there with what a
// car is worth to them there, so a regional price competes with the rivals in that region only.
//
// DATA STATUS: ESTIMATED GAME DATA. Purchasing-power levels and tax rates are rounded orders of magnitude by
// region and era, not statistics; exchange rates are a generated, mean-reverting index (1.0 = the start level),
// not historical rates.
import type { GameState, RegionId, VehicleModel } from './types';
import { REGION_IDS } from '../data/world';
import { hashStr } from './rng';
import { clamp, kf, type KF } from './util';

/** What a car is worth to buyers relative to North America (purchasing power and price levels). */
export const PPP: Record<RegionId, KF> = {
  NA: [[1950, 1]], EU: [[1950, 0.78], [1970, 0.88], [1990, 0.96], [2020, 0.95]], JP: [[1950, 0.45], [1970, 0.75], [1990, 1.0], [2020, 0.9]],
  CN: [[1950, 0.35], [1990, 0.5], [2010, 0.78], [2025, 0.88]], LATAM: [[1950, 0.6], [2020, 0.66]], ROW: [[1950, 0.6], [2020, 0.72]],
};
/** Sales and registration taxes paid by buyers on top of the list price (rounded regional averages). */
export const SALES_TAX: Record<RegionId, number> = { NA: 0.07, EU: 0.2, JP: 0.1, CN: 0.13, LATAM: 0.22, ROW: 0.15 };
const AVG_TAX = 0.14;
export const CURRENCY: Record<RegionId, string> = { NA: 'US dollar', EU: 'European currencies', JP: 'yen / won', CN: 'yuan', LATAM: 'Latin American currencies', ROW: 'other currencies' };

/** Current exchange-rate index of a region's currency (local units per dollar, 1.0 = start level; NA is the dollar). */
export const fxNow = (g: GameState, r: RegionId) => (r === 'NA' ? 1 : g.macro.fx?.[r] ?? 1);
/** One month of currency movement: a mean-reverting walk driven by a hash of the date (it does not consume the game's random numbers). */
export function updateFx(g: GameState) {
  g.macro.fx ??= {};
  for (const r of REGION_IDS) {
    if (r === 'NA') continue;
    const h = (k: number) => (hashStr(`${r}:${g.year}:${g.month}:${k}`) % 10000) / 10000;
    const noise = (h(1) + h(2) + h(3) + h(4) - 2) * 1.73; // ≈ standard normal
    const vol = r === 'LATAM' ? 0.03 : r === 'EU' || r === 'JP' ? 0.018 : 0.014;
    const x = g.macro.fx[r] ?? 1;
    g.macro.fx[r] = clamp(x * Math.exp(vol * noise - 0.03 * Math.log(x)), 0.4, 2.5);
  }
}
/** How much a car is worth to buyers in a region relative to the world value price (purchasing power and taxes). */
export const regionalValue = (g: GameState, r: RegionId) => kf(PPP[r], g.year) * (1 + AVG_TAX) / (1 + SALES_TAX[r]);
/** Dollar value of a model's (or trim's) list price in a region, as a multiple of its world price. */
export function regionalFactor(g: GameState, m: Pick<VehicleModel, 'regional'>, r: RegionId): number {
  const o = m.regional?.[r];
  return o ? o.ratio * (o.fx / fxNow(g, r)) : 1;
}
/** Price in dollars that a region's buyers are charged (before taxes and tariffs). */
export const regionalPrice = (g: GameState, m: Pick<VehicleModel, 'regional' | 'price'>, r: RegionId) => m.price * regionalFactor(g, m, r);
/** Local price in the region's currency index units (what the dealer's price list shows). */
export const localPrice = (g: GameState, m: Pick<VehicleModel, 'regional' | 'price'>, r: RegionId) => regionalPrice(g, m, r) * fxNow(g, r);
