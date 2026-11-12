// Supply chain and production stages (Phase 3).
//
// SUPPLY. A car's purchased parts fall into nine component categories; each category's share of the
// parts cost comes from the car's own cost breakdown (an electric car depends on batteries, a luxury car
// on interior materials). Without contracts a company buys at average market terms (index 1.0): that is
// how every company bought before Phase 3. A CONTRACT with a supplier commits a monthly volume for some
// years in exchange for a lower price (bigger commitments and longer terms, lower prices), at that
// supplier's quality and delivery reliability; below 90 % of the commitment the shortfall is paid for
// (take-or-pay). Volume above the commitment is bought on the market at index 1.0. A disrupted supplier
// delivers 30 % of its share for one to three months: the gap is covered from the component safety stock,
// then by spot buying (at +25 %, up to 20 % of the month's needs), and what remains is lost output. A
// second source halves the exposure; an IN-HOUSE plant removes the supplier margin (index 0.85) at the
// price of capital and fixed costs.
//
// STAGES. A plant has five stages — body (stamping and welding), paint, powertrain, final assembly and
// quality inspection — each with its own monthly capacity; the slowest one limits the plant. Inspection
// thoroughness costs labour per car and lowers the defect hazard of the cars the plant builds.
import type { Company, ComponentCategory, Contract, Factory, GameState, StageId, SupplyState, VehicleModel, VehicleStats } from './types';
import { CATEGORIES, CATEGORY_NAME, IN_HOUSE, SUPPLIER_BY_ID, type SupplierDef } from '../data/suppliers';
import { clamp, cpi, kf } from './util';

// ------------------------------------------------------------------------------------------- shares

/** Share of a car's purchased-parts cost in each component category (the rest is made in-house or not modelled). */
export function categoryShares(st: VehicleStats): Record<ComponentCategory, number> {
  const cb = st.costBreakdown, total = st.partsCost || 1, f = (k: string) => (cb[k] ?? 0) / total;
  return {
    metals: (f('Chassis') + f('Body & paint')) * 0.6,
    electronics: f('Safety & electronics') * 0.55,
    semiconductors: f('Safety & electronics') * 0.35 + f('Powertrain') * 0.04,
    // an electric car's powertrain is mostly its traction battery
    batteries: st.engine.isEV ? f('Powertrain') * 0.75 : 0,
    tires: f('Running gear') * 0.25,
    transmissions: f('Driveline') * 0.8,
    seats: f('Interior') * 0.35,
    glass: 0.025,
    interior: f('Interior') * 0.45,
  };
}
/** Does this car need traction batteries? (electric cars; a hybrid's small pack is bought with the engine). */
export const usesBatteries = (st: VehicleStats) => st.engine.isEV;

// ---------------------------------------------------------------------------------------- suppliers

/** Monthly car sets a supplier can commit to one customer at capacity 1.0, by era. */
export const capacityRef = (year: number) => kf([[1950, 6000], [1980, 15000], [2000, 30000], [2020, 45000]], year);
export const supplierCapacity = (d: SupplierDef, year: number) => d.capacity * capacityRef(year);

/** Price a supplier quotes: bigger commitments (share of its capacity) and longer terms earn discounts; a supplier far from the company's plants charges for logistics. */
export function quote(c: Company, d: SupplierDef, commitment: number, years: number, year: number): number {
  const vol = 0.1 * clamp(commitment / supplierCapacity(d, year), 0, 1);
  const term = years >= 5 ? 0.05 : years >= 3 ? 0.03 : years >= 2 ? 0.015 : 0;
  const far = c.factories.some((f) => f.region === d.region) ? 1 : 1.03;
  return d.price * (1 - vol) * (1 - term) * far;
}

export function emptySupply(): SupplyState {
  return { contracts: {}, inHouse: {}, disrupted: {}, safetyStock: 0, buffer: 0, lastLoss: 0, lastSpot: 0, lastPenalty: 0 };
}

/** Quality of a category as the company buys it (market average 0.7). */
function categoryQuality(c: Company, cat: ComponentCategory, year: number): number {
  const ih = c.supply?.inHouse[cat];
  if (ih) return 0.6 + 0.35 * clamp((c.tech.manufacturing - year + 3) / 6, 0, 1);
  const k = c.supply?.contracts[cat];
  if (!k) return 0.7;
  const a = SUPPLIER_BY_ID[k.supplierId], b = k.secondId ? SUPPLIER_BY_ID[k.secondId] : undefined;
  const s2 = b ? (k.secondShare ?? 0.3) : 0;
  return (a?.quality ?? 0.7) * (1 - s2) + (b?.quality ?? 0.7) * s2;
}
/**
 * Reliability points the company's component sourcing adds to (or takes from) its cars, weighted by the car's
 * category shares: buying better parts than the market average makes better cars. About ±3 points at the extremes.
 */
export function sourcingReliability(c: Company | undefined, st: VehicleStats, year: number): number {
  if (!c?.supply) return 0;
  const sh = categoryShares(st);
  let w = 0, q = 0;
  for (const cat of CATEGORIES) { const x = sh[cat]; if (x <= 0) continue; w += x; q += x * categoryQuality(c, cat, year); }
  return w > 0 ? clamp((q / w - 0.7) * 15, -4, 4) : 0;
}

// ---------------------------------------------------------------------------------------- monthly

export interface SupplyMonth {
  /** share of planned output that can be built (1 = no shortage) */
  factor: number;
  /** parts price index per category this month (applied to that category's share of parts cost) */
  index: Partial<Record<ComponentCategory, number>>;
  /** take-or-pay penalties and in-house fixed costs to book this month */
  penalty: number; fixed: number;
  /** categories that held production back, for the news */
  short: ComponentCategory[];
}

/**
 * Settle one month of component supply for `need` car sets (and `needBattery` sets of traction batteries), worth
 * `partsValue` per set on average. Uses no randomness: disruptions are rolled separately (rollDisruptions).
 */
export function settleSupply(g: GameState, c: Company, need: number, needBattery: number, partsValue: number, shares: Record<ComponentCategory, number>): SupplyMonth {
  const sup = c.supply;
  const out: SupplyMonth = { factor: 1, index: {}, penalty: 0, fixed: 0, short: [] };
  if (!sup || need <= 0) return out;
  let worst = 1;
  for (const cat of CATEGORIES) {
    const n = cat === 'batteries' ? needBattery : need;
    const ih = sup.inHouse[cat];
    if (ih) out.fixed += ih.capex * 0.012; // upkeep, staff and depreciation-like running cost of the component plant
    const k = sup.contracts[cat];
    if (n <= 0) continue;
    // volume and price from each source
    let cheap = 0, cheapCost = 0; // contracted / in-house volume and its cost index × volume
    let lost = 0;
    if (ih) { const v = Math.min(n, ih.capacity); cheap += v; cheapCost += v * 0.85; }
    if (k && n > cheap) {
      const covered = Math.min(n - cheap, k.commitment);
      const s2 = k.secondId ? (k.secondShare ?? 0.3) : 0;
      const hit = (id: string | undefined, share: number) => (id && sup.disrupted[id] > 0 ? share * 0.7 : 0);
      const missing = covered * (hit(k.supplierId, 1 - s2) + hit(k.secondId, s2));
      cheap += covered - missing; cheapCost += (covered - missing) * k.priceIndex;
      lost += missing;
      // take-or-pay below 90 % of the commitment
      const shortfall = Math.max(0, k.commitment * 0.9 - covered);
      out.penalty += shortfall * partsValue * shares[cat] * 0.08;
    }
    const market = Math.max(0, n - cheap - lost);
    // a disrupted contract's gap: safety stock first, then spot purchases, then lost output
    let spot = 0;
    if (lost > 0) {
      const fromBuffer = Math.min(lost, sup.buffer * n);
      if (fromBuffer > 0) { sup.buffer = Math.max(0, sup.buffer - fromBuffer / n); lost -= fromBuffer; cheap += fromBuffer; cheapCost += fromBuffer * (k?.priceIndex ?? 1); }
      spot = Math.min(lost, 0.2 * n); lost -= spot;
      if (lost > 0) { worst = Math.min(worst, 1 - lost / n); out.short.push(cat); }
    }
    const bought = cheap + market + spot;
    out.index[cat] = bought > 0 ? (cheapCost + market * 1 + spot * 1.25) / bought : 1;
    sup.lastSpot += spot * partsValue * shares[cat] * 0.25;
  }
  // safety stock refills by a quarter of a month's needs per month, at a holding cost of 1.5 % a month of its value
  if (sup.safetyStock > 0) {
    sup.buffer = Math.min(sup.safetyStock, sup.buffer + 0.25);
    out.fixed += sup.safetyStock * need * partsValue * 0.015;
  }
  out.factor = worst;
  return out;
}
/** Disruption roll for every supplier the company has a contract with (called once a month). */
export function rollDisruptions(g: GameState, c: Company, rnd: () => number): string[] {
  const sup = c.supply; if (!sup) return [];
  const news: string[] = [];
  for (const id of Object.keys(sup.disrupted)) if (sup.disrupted[id] > 0) sup.disrupted[id]--;
  const ids = new Set<string>();
  for (const k of Object.values(sup.contracts)) { if (!k) continue; ids.add(k.supplierId); if (k.secondId) ids.add(k.secondId); }
  for (const id of ids) {
    const d = SUPPLIER_BY_ID[id]; if (!d || (sup.disrupted[id] ?? 0) > 0) continue;
    if (rnd() < 1 - d.reliability) {
      sup.disrupted[id] = 1 + Math.floor(rnd() * 3);
      news.push(`${d.name} (${CATEGORY_NAME[d.category].toLowerCase()}) cannot deliver in full for ${sup.disrupted[id]} month(s).`);
    }
  }
  // contracts end
  for (const cat of CATEGORIES) { const k = sup.contracts[cat]; if (k && k.until < g.year) { delete sup.contracts[cat]; news.push(`The ${CATEGORY_NAME[cat].toLowerCase()} contract has expired: parts are bought at market terms until a new one is signed.`); } }
  return news;
}
/** Price index of a car's parts given this month's category indices. */
export function partsIndex(shares: Record<ComponentCategory, number>, idx: Partial<Record<ComponentCategory, number>>, battery: boolean): number {
  let x = 1;
  for (const cat of CATEGORIES) { if (cat === 'batteries' && !battery) continue; const i = idx[cat]; if (i !== undefined) x += shares[cat] * (i - 1); }
  return x;
}
/** Steady-state parts price index of a car under the company's current contracts (no disruption), for estimates. */
export function contractIndex(c: Company, m: Pick<VehicleModel, 'stats'>): number {
  const sup = c.supply; if (!sup) return 1;
  const sh = categoryShares(m.stats);
  let x = 1;
  for (const cat of CATEGORIES) {
    if (cat === 'batteries' && !usesBatteries(m.stats)) continue;
    const ih = sup.inHouse[cat], k = sup.contracts[cat];
    const i = ih ? 0.85 : k ? k.priceIndex : 1;
    x += sh[cat] * (i - 1);
  }
  return x;
}
export const inHouseCost = (cat: ComponentCategory, capacity: number, year: number) => (IN_HOUSE[cat] ?? 0) * capacity * cpi(year);

// ------------------------------------------------------------------------------------------- stages

export const STAGES: StageId[] = ['body', 'paint', 'powertrain', 'assembly', 'inspection'];
export const STAGE_NAME: Record<StageId, string> = { body: 'Body shop (stamping and welding)', paint: 'Paint shop', powertrain: 'Engine and powertrain', assembly: 'Final assembly', inspection: 'Quality inspection' };
/** Share of a plant's investment in each stage. */
export const STAGE_WEIGHT: Record<StageId, number> = { body: 0.35, paint: 0.2, powertrain: 0.2, assembly: 0.2, inspection: 0.05 };
export const stagesOf = (f: Factory): Record<StageId, number> => f.stages ?? { body: f.capacity, paint: f.capacity, powertrain: f.capacity, assembly: f.capacity, inspection: f.capacity };
/** Capacity the plant can actually run at: its slowest stage (never above its nominal capacity). */
export function effectiveCapacity(f: Factory): number {
  const s = stagesOf(f);
  return Math.min(f.capacity, ...STAGES.map((k) => s[k]));
}
export function bottleneck(f: Factory): StageId | null {
  const s = stagesOf(f);
  const min = Math.min(...STAGES.map((k) => s[k]));
  return min < f.capacity - 1e-6 ? STAGES.find((k) => s[k] === min) ?? null : null;
}
export const inspectionOf = (f: Factory) => clamp(f.inspection ?? 0.5, 0, 1);
/** Extra labour hours per car for inspection above (or below) the standard level. */
export const inspectionHours = (f: Pick<Factory, 'inspection'>) => 6 * (clamp(f.inspection ?? 0.5, 0, 1) - 0.5);
/** Defect hazard multiplier from the company's inspection, weighted by plant capacity: 1.0 at the standard level, 0.7 at the most thorough, 1.3 when skipped. */
export function inspectionHazard(c: Company): number {
  const cap = c.factories.reduce((a, f) => a + f.capacity, 0);
  if (!cap) return 1;
  const x = c.factories.reduce((a, f) => a + f.capacity * inspectionOf(f), 0) / cap;
  return 1.3 - 0.6 * x;
}
export type { Contract };
