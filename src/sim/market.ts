// Market model: how many cars each model sells in each region every month.
//
//   demand(model, region) = segmentVolume(region, segment) / 12 × macro
//                           × D·q / ( Σ_all models D·q + D_other·q̄ )
//
// D is the distribution strength a company devotes to the model in that region (dealer reach,
// units/year); q is the model's appeal — exp(β·utility) from the segment's weighted 0–100 scores,
// brand reputation, model age, awareness and (for EVs) market acceptance, times the response to
// its price. "Other" stands for every manufacturer that is not individually simulated and is
// assumed to be of average appeal.
//
// Price (Phase 2). Every car has a VALUE PRICE: what buyers of its segment consider a fair price
// for this car from this brand — the segment's reference price scaled by how good the car is, by
// the brand's pricing power and, for prestige goods from prestigious makers, by how scarce it is.
// Demand responds to the ratio of the price actually asked (plus tariff) to that value price with
// the segment's elasticity, and falls away ever faster the further the price is pushed above it.
import type { Company, GameState, RegionId, SegmentId, VehicleModel } from './types';
import { EV_ACCEPTANCE, FUEL_BASE, REGION_IDS, REGION_VOLUME, SEG, SEGMENTS, SEGMENT_IDS, TARIFF, segPrice } from '../data/world';
import { clamp, cpi, kf } from './util';
import { dealerMix, hasTrims, trimKey, trimView, trimsOf } from './trims';

const shareCache = new Map<string, number>();
/** Annual unit volume of a segment in a region. */
export function segVolume(region: RegionId, seg: SegmentId, year: number): number {
  const key = `${region}:${seg}:${year}`;
  const c = shareCache.get(key);
  if (c !== undefined) return c;
  let sum = 0, mine = 0;
  for (const s of SEGMENTS) {
    const v = kf(s.share, year) * (s.regionBias[region] ?? 1);
    sum += v;
    if (s.id === seg) mine = v;
  }
  const out = kf(REGION_VOLUME[region], year) * 1e6 * (mine / sum);
  shareCache.set(key, out);
  return out;
}

export function fuelPrice(g: GameState): number {
  let f = kf(FUEL_BASE, g.year + (g.month - 1) / 12);
  for (const m of g.macro.modifiers) if (m.fuelPrice) f *= m.fuelPrice;
  return f;
}
export function macroDemand(g: GameState, region: RegionId, seg: SegmentId): number {
  let d = 1 + g.macro.cycle;
  for (const m of g.macro.modifiers) {
    if (m.demandAll) d *= m.demandAll;
    if (m.demand?.[region]) d *= m.demand[region]!;
    if (m.segment?.[seg]) d *= m.segment[seg]!;
  }
  return d;
}
export const modProduct = (g: GameState, pick: (m: GameState['macro']['modifiers'][number]) => number | undefined) =>
  g.macro.modifiers.reduce((a, m) => a * (pick(m) ?? 1), 1);

export function builtInRegion(c: Company, modelId: string, region: RegionId): boolean {
  for (const f of c.factories) if (f.region === region) for (const l of f.lines) if (l.modelId === modelId) return true;
  return false;
}
export function tariff(g: GameState, c: Company, m: VehicleModel, region: RegionId): number {
  if (builtInRegion(c, m.id, region)) return 0;
  let t = kf(TARIFF[region], g.year);
  if (region === 'NA' && m.segment === 'pickup' && g.year >= 1964) t = 0.25; // "chicken tax" on light trucks
  return t;
}

export function modelWeights(c: Company): Map<string, number> {
  const w = new Map<string, number>();
  const active = c.models.filter((m) => m.status === 'production' || (m.status === 'ready' && m.inventory > 0));
  if (!active.length) return w;
  let total = 0;
  if (c.isPlayer) {
    for (const m of active) {
      let cap = 0;
      for (const f of c.factories) for (const l of f.lines) if (l.modelId === m.id) cap += f.capacity * l.share;
      // dealers push what can be supplied: line capacity, or the stock on hand once a line is gone
      const wm = Math.max(cap, m.inventory / 2, 1);
      w.set(m.id, wm);
      total += wm;
    }
  } else {
    for (const m of active) { w.set(m.id, m.volumeWeight); total += m.volumeWeight; }
  }
  for (const [k, v] of w) w.set(k, v / total);
  return w;
}

// ------------------------------------------------------------------------------------ value & price

/**
 * How buyers of each segment turn a car's qualities into willingness to pay.
 *  u0 / p0  : utility and brand prestige of a typical car of the segment (measured on the historical catalogue)
 *  beta     : how steeply the value price rises with the car's utility
 *  brand    : pricing power of brand prestige;  reliab : of the reliability reputation
 *  top      : extra pull of the very grandest names (prestige above 80) — what separates an exotic maker's
 *             luxury car from an excellent executive saloon
 *  scarcity : how much rarity adds for a prestigious maker (0 = a mass-market good)
 */
export const VALUE: Record<SegmentId, { u0: number; p0: number; beta: number; brand: number; reliab: number; top: number; scarcity: number }> = {
  budget: { u0: 0.61, p0: 45, beta: 0.8, brand: 0.3, reliab: 0.8, top: 0, scarcity: 0 },
  family: { u0: 0.6, p0: 50, beta: 1.0, brand: 1.0, reliab: 0.8, top: 0, scarcity: 0 },
  premium: { u0: 0.71, p0: 70, beta: 1.4, brand: 1.0, reliab: 0.4, top: 0, scarcity: 0 },
  luxury: { u0: 0.9, p0: 80, beta: 1.7, brand: 1.6, reliab: 0.3, top: 0.5, scarcity: 0.2 },
  sports: { u0: 0.61, p0: 55, beta: 2.2, brand: 1.6, reliab: 0.3, top: 0, scarcity: 0.15 },
  supercar: { u0: 0.82, p0: 90, beta: 2.0, brand: 1.8, reliab: 0.2, top: 0, scarcity: 0.5 },
  suv: { u0: 0.64, p0: 48, beta: 1.1, brand: 0.8, reliab: 0.6, top: 0, scarcity: 0 },
  pickup: { u0: 0.62, p0: 45, beta: 0.9, brand: 0.4, reliab: 0.8, top: 0, scarcity: 0 },
};
const brandIndex = (prestige: number, top: number) => 0.7 + (0.6 * prestige) / 100 + (top * Math.max(0, prestige - 80) ** 2) / 400;
/** Steepness of the extra penalty for asking more than the value price. */
export const OVERPRICE_K = 2;
/** Largest scarcity premium. */
export const MAX_SCARCITY = 8;

/** Segment-weighted utility of a car, 0…1. */
export function utilityOf(m: Pick<VehicleModel, 'stats'>, seg: SegmentId): number {
  const def = SEG[seg];
  let u = 0;
  for (const k in def.weights) u += (def.weights as Record<string, number>)[k] * ((m.stats.scores as unknown as Record<string, number>)[k] / 100);
  return u;
}
const worldVolCache = new Map<string, number>();
/** Annual world volume of a segment. */
export function worldSegVolume(seg: SegmentId, year: number): number {
  const key = `${seg}:${year}`;
  let v = worldVolCache.get(key);
  if (v === undefined) { v = REGION_IDS.reduce((a, r) => a + segVolume(r, seg, year), 0); worldVolCache.set(key, v); }
  return v;
}
/** Yearly volume of an ordinary model of the segment (3 % of the segment): fewer than this and a car counts as scarce. */
export const scarcityRef = (seg: SegmentId, year: number) => worldSegVolume(seg, year) * 0.03;

/** Cars a year the company can put on the market: line capacity for the player, distribution weight for the others. */
export function annualSupply(c: Company, m: VehicleModel, weight?: number): number {
  if (c.isPlayer) {
    // a trim (id "model#trim") gets its share of the model's lines
    const [baseId, trim] = m.id.split('#');
    let cap = 0;
    for (const f of c.factories) for (const l of f.lines) if (l.modelId === baseId) cap += f.capacity * l.share;
    return Math.max(cap * 12 * (trim ? m.volumeWeight : 1), m.inventory, 12);
  }
  const w = weight ?? modelWeights(c).get(m.id) ?? 0;
  return Math.max(REGION_IDS.reduce((a, r) => a + c.reach[r], 0) * w, 12);
}
/** Scarcity premium: only for prestige segments, only for makers whose badge is desirable, growing as supply shrinks. */
export function scarcityPremium(seg: SegmentId, year: number, prestige: number, supply: number): number {
  const k = VALUE[seg].scarcity;
  if (k <= 0 || !(supply > 0)) return 1;
  const raw = clamp(Math.pow(scarcityRef(seg, year) / supply, k), 1, MAX_SCARCITY);
  return 1 + (raw - 1) * clamp((prestige - 50) / 40, 0, 1);
}
/**
 * Value price: the price at which this car, from this company, is neither a bargain nor dear in its segment.
 * `supply` (cars a year) adds the scarcity premium; leave it out for the price of an unconstrained volume model.
 */
export function valuePrice(m: Pick<VehicleModel, 'stats' | 'segment'>, c: Pick<Company, 'prestige' | 'reliabilityRep'>, year: number, supply?: number): number {
  const v = VALUE[m.segment];
  const quality = Math.exp(v.beta * (utilityOf(m, m.segment) - v.u0));
  const brand = Math.pow(brandIndex(c.prestige, v.top) / brandIndex(v.p0, v.top), v.brand);
  const trust = Math.pow((0.82 + (0.3 * c.reliabilityRep) / 100) / 1.0, v.reliab);
  return segPrice(m.segment, year) * quality * brand * trust * (supply ? scarcityPremium(m.segment, year, c.prestige, supply) : 1);
}
/** Demand multiplier for a price `ratio` times the value price (1 at the value price). */
export function priceResponse(seg: SegmentId, ratio: number): number {
  const x = Math.log(clamp(ratio, 0.35, 50)); // cutting the price by more than about two thirds wins no further buyers
  return Math.exp(-SEG[seg].elasticity * x - (x > 0 ? OVERPRICE_K * x * x : 0));
}

export function appeal(g: GameState, c: Company, m: VehicleModel, region: RegionId, fuel: number, value?: number): number {
  if (!(m.price > 0) || !Number.isFinite(m.price)) return 0; // no valid price: not on sale (a 0 price would make appeal infinite)
  const def = SEG[m.segment];
  const s = m.stats.scores;
  const u = utilityOf(m, m.segment) + (fuel - 1) * 0.25 * ((s.economy - 50) / 100);
  let q = Math.exp(4 * (u - 0.5)) * (def.bodyFit[m.spec.body] ?? 0.3);
  const eff = m.price * (1 + tariff(g, c, m, region));
  q *= priceResponse(m.segment, eff / (value ?? valuePrice(m, c, g.year, annualSupply(c, m))));
  const wP = def.weights.prestige ?? 0, wR = def.weights.reliability ?? 0;
  q *= Math.pow(0.55 + (0.9 * c.prestige) / 100, wP * 3 + 0.3);
  q *= Math.pow(0.7 + (0.6 * c.reliabilityRep) / 100, wR * 3 + 0.3);
  if (m.segment === 'sports' || m.segment === 'supercar') q *= 0.7 + (0.6 * c.sportiness) / 100;
  const age = m.launchYear ? g.year - m.launchYear + (g.month - m.launchMonth) / 12 : 0;
  q *= clamp(1.12 - 0.035 * age, 0.55, 1.12);
  if (m.spec.engine.layout === 'EV') {
    q *= kf(EV_ACCEPTANCE, g.year) * modProduct(g, (x) => x.evDemand);
    if (m.stats.rangeKm < 300) q *= clamp(m.stats.rangeKm / 300, 0.2, 1);
  }
  if (s.safety < 25) q *= 0.6;
  if (m.recallRisk > 0) q *= 1 - 0.3 * Math.min(1, m.recallRisk); // lost trust after a defect (recovers over months)
  q *= 0.4 + (0.6 * c.awareness[region]) / 100;
  if (c.homeRegion === region) q *= 1.12;
  const imp = modProduct(g, (x) => (builtInRegion(c, m.id, region) ? 1 : x.importPenalty?.[region]));
  return q * imp;
}

export interface MarketEntry { company: Company; model: VehicleModel; D: number; q: number; demand: number }
export interface MarketResult {
  demand: Map<string, Record<RegionId, number>>; // model id -> monthly demand per region
  cells: Record<string, { volume: number; entries: MarketEntry[]; other: number }>; // `${region}:${seg}`
}

export function computeMarket(g: GameState): MarketResult {
  const fuel = fuelPrice(g);
  const cells: MarketResult['cells'] = {};
  for (const r of REGION_IDS) for (const s of SEGMENT_IDS) cells[`${r}:${s}`] = { volume: (segVolume(r, s, g.year) / 12) * macroDemand(g, r, s), entries: [], other: 0 };
  for (const c of g.companies) {
    if (!c.alive) continue;
    const w = modelWeights(c);
    for (const m of c.models) {
      const wm = w.get(m.id);
      if (!wm) continue;
      if (hasTrims(m)) {
        // every trim is a car of its own to buyers; the dealers split their attention by the trims' mix and stock
        const dm = dealerMix(m);
        const supply = annualSupply(c, m, wm);
        for (const t of trimsOf(m)) {
          const share = dm.get(t.id) ?? 0;
          if (share <= 0) continue;
          const view = trimView(m, t); view.volumeWeight = share;
          const tSupply = Math.max(12, t.cap !== undefined ? Math.min(supply * share, t.cap) : supply * share);
          const value = valuePrice(view, c, g.year, tSupply);
          for (const r of REGION_IDS) {
            const D = c.reach[r] * wm * share;
            if (D <= 0) continue;
            cells[`${r}:${m.segment}`].entries.push({ company: c, model: view, D, q: appeal(g, c, view, r, fuel, value), demand: 0 });
          }
        }
        continue;
      }
      const value = valuePrice(m, c, g.year, annualSupply(c, m, wm));
      for (const r of REGION_IDS) {
        const D = c.reach[r] * wm;
        if (D <= 0) continue;
        cells[`${r}:${m.segment}`].entries.push({ company: c, model: m, D, q: appeal(g, c, m, r, fuel, value), demand: 0 });
      }
    }
  }
  const demand: MarketResult['demand'] = new Map();
  for (const r of REGION_IDS) for (const s of SEGMENT_IDS) {
    const key = `${r}:${s}`;
    const cell = cells[key];
    let sumDq = 0, sumD = 0, aiDq = 0, aiD = 0;
    for (const e of cell.entries) { sumDq += e.D * e.q; sumD += e.D; if (!e.company.isPlayer) { aiDq += e.D * e.q; aiD += e.D; } }
    const qBar = aiD > 0 ? aiDq / aiD : 1;
    const dOther = (g.otherShare[key] ?? 0.3) * segVolume(r, s, g.year);
    const denom = sumDq + dOther * qBar;
    cell.other = denom > 0 ? (cell.volume * dOther * qBar) / denom : cell.volume;
    for (const e of cell.entries) {
      e.demand = denom > 0 ? (cell.volume * e.D * e.q) / denom : 0;
      let rec = demand.get(e.model.id);
      if (!rec) { rec = { NA: 0, EU: 0, JP: 0, CN: 0, LATAM: 0, ROW: 0 }; demand.set(e.model.id, rec); }
      rec[r] += e.demand;
    }
    void sumD;
  }
  // a model with trims: its demand is the sum of its trims' demand
  for (const c of g.companies) for (const m of c.models) {
    if (!hasTrims(m)) continue;
    const rec: Record<RegionId, number> = { NA: 0, EU: 0, JP: 0, CN: 0, LATAM: 0, ROW: 0 };
    let any = false;
    for (const t of trimsOf(m)) { const d = demand.get(trimKey(m, t)); if (!d) continue; any = true; for (const r of REGION_IDS) rec[r] += d[r]; }
    if (any) demand.set(m.id, rec);
  }
  return { demand, cells };
}

/** Value price of the car as an unconstrained volume model (kept for callers that have no supply figure). */
export function suggestedPrice(m: VehicleModel, c: Company, year: number): number {
  return valuePrice(m, c, year);
}

/** Which segment a design fits best (utility × body fit, penalising distance from the segment's price band). */
export function suggestSegment(scores: Record<string, number>, body: string, unitCost: number, year: number): SegmentId {
  let best: SegmentId = 'family', bestV = -1e9;
  for (const def of SEGMENTS) {
    let u = 0;
    for (const k in def.weights) u += (def.weights as Record<string, number>)[k] * (scores[k] / 100);
    const price = segPrice(def.id, year);
    const v = u + 0.25 * Math.log((def.bodyFit as Record<string, number>)[body] ?? 0.2) - 0.22 * Math.abs(Math.log((unitCost * 1.45) / price));
    if (v > bestV) { bestV = v; best = def.id; }
  }
  return best;
}
