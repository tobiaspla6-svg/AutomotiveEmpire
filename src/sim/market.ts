// Market model: how many cars each model sells in each region every month.
//
//   demand(model, region) = segmentVolume(region, segment) / 12 × macro
//                           × D·q / ( Σ_all models D·q + D_other·q̄ )
//
// D is the distribution strength a company devotes to the model in that region (dealer reach,
// units/year); q is the model's appeal — exp(β·utility) from the segment's weighted 0–100 scores,
// a constant-elasticity price term against the segment reference price, brand reputation,
// model age, awareness, tariffs and (for EVs) market acceptance. "Other" stands for every
// manufacturer that is not individually simulated and is assumed to be of average appeal.
import type { Company, GameState, RegionId, SegmentId, VehicleModel } from './types';
import { EV_ACCEPTANCE, FUEL_BASE, REGION_IDS, REGION_VOLUME, SEG, SEGMENTS, SEGMENT_IDS, TARIFF, segPrice } from '../data/world';
import { clamp, cpi, kf } from './util';

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
      w.set(m.id, Math.max(cap, 1));
      total += Math.max(cap, 1);
    }
  } else {
    for (const m of active) { w.set(m.id, m.volumeWeight); total += m.volumeWeight; }
  }
  for (const [k, v] of w) w.set(k, v / total);
  return w;
}

export function appeal(g: GameState, c: Company, m: VehicleModel, region: RegionId, fuel: number): number {
  const def = SEG[m.segment];
  const s = m.stats.scores;
  let u = 0;
  for (const k in def.weights) u += (def.weights as Record<string, number>)[k] * ((s as unknown as Record<string, number>)[k] / 100);
  u += (fuel - 1) * 0.25 * ((s.economy - 50) / 100);
  let q = Math.exp(4 * (u - 0.5)) * (def.bodyFit[m.spec.body] ?? 0.3);
  const ref = segPrice(m.segment, g.year);
  const eff = m.price * (1 + tariff(g, c, m, region));
  q *= Math.pow(eff / ref, -def.elasticity);
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
      for (const r of REGION_IDS) {
        const D = c.reach[r] * wm;
        if (D <= 0) continue;
        cells[`${r}:${m.segment}`].entries.push({ company: c, model: m, D, q: appeal(g, c, m, r, fuel), demand: 0 });
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
  return { demand, cells };
}

/** Price at which an average-appeal car of this quality would sit in its segment (UI hint + AI pricing). */
export function suggestedPrice(m: VehicleModel, c: Company, year: number): number {
  const def = SEG[m.segment];
  let u = 0;
  for (const k in def.weights) u += (def.weights as Record<string, number>)[k] * ((m.stats.scores as unknown as Record<string, number>)[k] / 100);
  const brand = 0.85 + (0.3 * c.prestige) / 100 * ((def.weights.prestige ?? 0) > 0.1 ? 1 : 0.4);
  return segPrice(m.segment, year) * Math.exp(1.3 * (u - 0.62)) * brand;
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
