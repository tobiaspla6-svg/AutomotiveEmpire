// Pricing guidance and competitor pricing (Phase 2).
//
// The market (market.ts) decides how many cars sell at a given price. This module answers the
// questions around it:
//   • what does one car cost at the planned volume, including its share of development and tooling?
//   • what is the lowest price that pays the programme back (break-even price)?
//   • which price earns the most, given the demand curve and the cars a month that can be built
//     (recommended retail price), and what does each car then contribute?
//   • what do the other manufacturers charge, given their strategy?
//
// Every figure here is an ESTIMATE made with today's market: competitors move, tastes age and
// costs inflate. The interface labels them accordingly.
import type { Company, Factory, GameState, RegionId, SegmentId, VehicleModel } from './types';
import { MAKER } from '../data/manufacturers';
import { REGION_IDS, SEG } from '../data/world';
import { positionIn, strategyOf, type Strategy } from '../data/strategy';
import { unitCost } from './company';
import { sharedVolume } from './families';
import { contractIndex } from './supply';
import { annualSupply, appeal, computeMarket, fuelPrice, modelWeights, priceResponse, segVolume, tariff, valuePrice, type MarketResult } from './market';

/** Share of the list price the manufacturer keeps after the dealer's margin. */
export const DEALER_NET = 0.88;
/** Years a model is expected to stay on sale; development and tooling are spread over the cars built in that time. */
export const MODEL_LIFE: Record<SegmentId, number> = { budget: 6, family: 6, premium: 7, luxury: 8, sports: 7, supercar: 6, suv: 6, pickup: 8 };
/** A sensible first guess of monthly volume for a new car of each segment (the studio's planning slider starts here). */
export const TYPICAL_VOLUME: Record<SegmentId, number> = { budget: 3000, family: 2500, premium: 1200, luxury: 300, sports: 500, supercar: 40, suv: 2500, pickup: 2000 };

export function companyStrategy(c: Company): Strategy {
  return strategyOf(c.dataId ? MAKER[c.dataId] : null, c.specialization as 'mass');
}

function homeFactory(c: Company, m: VehicleModel): Factory | { country: string; automation: number } {
  for (const f of c.factories) if (f.lines.some((l) => l.modelId === m.id)) return f;
  return c.factories[0] ?? { country: c.country, automation: 0.3 };
}

/**
 * Demand curve of one car: returns a function price → cars a month worldwide (before supply limits),
 * holding every competitor at today's price. `monthlySupply` sets the dealer attention the car gets
 * and its scarcity.
 */
export function demandCurve(g: GameState, c: Company, m: VehicleModel, monthlySupply: number, mk: MarketResult = computeMarket(g)): (price: number) => number {
  const fuel = fuelPrice(g);
  const supplyYear = Math.max(12, monthlySupply * 12);
  const value = valuePrice(m, c, g.year, supplyYear);
  // share of the company's dealer network that sells this car
  const weights = modelWeights(c);
  let weight = weights.get(m.id) ?? 0;
  if (c.isPlayer) {
    let others = 0;
    const baseId = m.id.split('#')[0]; // a trim shares its model's lines
    for (const f of c.factories) for (const l of f.lines) if (l.modelId !== baseId && c.models.some((x) => x.id === l.modelId && x.status === 'production')) others += f.capacity * l.share;
    weight = monthlySupply / Math.max(monthlySupply + others, 1e-9);
  } else if (!weight) weight = 1 / (weights.size + 1);
  const probe = { ...m, price: value } as VehicleModel;
  const rows: { vol: number; D: number; base: number; rest: number; t: number }[] = [];
  for (const r of REGION_IDS as RegionId[]) {
    const D = c.reach[r] * weight;
    if (D <= 0) continue;
    const key = `${r}:${m.segment}`;
    const cell = mk.cells[key];
    let sumDq = 0, own = 0, aiDq = 0, aiD = 0;
    for (const e of cell.entries) { sumDq += e.D * e.q; if (e.model.id === m.id) own += e.D * e.q; if (!e.company.isPlayer) { aiDq += e.D * e.q; aiD += e.D; } }
    const qBar = aiD > 0 ? aiDq / aiD : 1;
    const dOther = (g.otherShare[key] ?? 0.3) * segVolume(r, m.segment, g.year);
    const t = tariff(g, c, m, r);
    // appeal at the value price with the price term divided out again: everything but the price
    const base = appeal(g, c, probe, r, fuel, value) / priceResponse(m.segment, 1 + t);
    rows.push({ vol: cell.volume, D, base, rest: sumDq - own + dOther * qBar, t });
  }
  return (price: number) => {
    if (!(price > 0)) return 0;
    let total = 0;
    for (const x of rows) {
      const Dq = x.D * x.base * priceResponse(m.segment, (price * (1 + x.t)) / value);
      total += (x.vol * Dq) / (x.rest + Dq);
    }
    return total;
  };
}

export interface PriceGuide {
  /** planned cars a month the figures are based on */
  volume: number;
  /** parts and labour per car at that volume */
  unitCost: number;
  /** development and line tooling spread over the cars of the model's planned life */
  devPerCar: number; toolingPerCar: number; lifeUnits: number;
  /** unit cost plus those shares */
  fullCost: number;
  /** list price at which a car covers its full cost after the dealer's margin */
  breakEven: number;
  /** what buyers consider the car to be worth at this volume (includes any scarcity premium) */
  value: number;
  /** price that earns the most contribution at this volume, never below the company's minimum margin */
  recommended: number;
  /** estimated cars a month at the recommended price (capped by the planned volume) */
  demand: number;
  /** estimated demand before the supply cap, at the recommended price */
  rawDemand: number;
  /** money each car contributes towards fixed costs at the recommended price, absolute and as a share of net revenue */
  contribution: number; contributionPct: number;
  /** false when even the best price does not cover the car's full cost */
  viable: boolean;
  /** true when the estimate had no market information (no dealers yet) and rests on value and cost alone */
  blind: boolean;
}

/** Contribution per car at a list price. */
export const contributionAt = (price: number, unit: number) => price * DEALER_NET - unit;

/**
 * Cost, break-even and recommended price of a car at a planned monthly volume.
 * `devCost` overrides the programme cost (e.g. a design that has not been started yet).
 */
export function priceGuide(g: GameState, c: Company, m: VehicleModel, monthlyVolume: number, o: { mk?: MarketResult; devCost?: number } = {}): PriceGuide {
  const volume = Math.max(1, monthlyVolume);
  const unit = unitCost(g, m, homeFactory(c, m), volume, sharedVolume(c, m, volume), contractIndex(c, m));
  const lifeUnits = MODEL_LIFE[m.segment] * 12 * volume;
  const devPerCar = (o.devCost ?? (m.devCostTotal || m.stats.devCost)) / lifeUnits;
  const toolingPerCar = (m.stats.toolingPerUnitCapacity * volume) / lifeUnits;
  const fullCost = unit + devPerCar + toolingPerCar;
  const breakEven = fullCost / DEALER_NET;
  const value = valuePrice(m, c, g.year, volume * 12);
  const strat = companyStrategy(c);
  const floor = (unit * (1 + strat.minMargin)) / DEALER_NET;
  const curve = demandCurve(g, c, m, volume, o.mk);
  const blind = curve(value) <= 0;
  let recommended = Math.max(value, floor), best = -Infinity;
  if (!blind) {
    for (let r = 0.5; r <= 3.001; r += 0.025) {
      const p = value * r;
      const profit = contributionAt(p, unit) * Math.min(curve(p), volume);
      if (profit > best) { best = profit; recommended = p; }
    }
    recommended = Math.max(recommended, floor);
  }
  const rawDemand = blind ? 0 : curve(recommended);
  const contribution = contributionAt(recommended, unit);
  return {
    volume, unitCost: unit, devPerCar, toolingPerCar, lifeUnits, fullCost, breakEven, value, recommended,
    demand: blind ? volume : Math.min(rawDemand, volume), rawDemand, contribution, contributionPct: contribution / (recommended * DEALER_NET),
    viable: recommended >= breakEven, blind,
  };
}

/**
 * List price an AI manufacturer asks: the car's value in its segment times the company's price
 * position, but never less than its unit cost plus the smallest margin its strategy accepts.
 */
export function aiTargetPrice(g: GameState, c: Company, m: VehicleModel, supply = annualSupply(c, m)): number {
  const strat = companyStrategy(c);
  const value = valuePrice(m, c, g.year, supply) * positionIn(strat, m.segment);
  // flagships built in handfuls are costed as a small series, not car by car: they are image products
  const cost = unitCost(g, m, homeFactory(c, m), Math.max(25, supply / 12), sharedVolume(c, m, Math.max(25, supply / 12)));
  return Math.max(value, (cost * (1 + strat.minMargin)) / DEALER_NET);
}

export { SEG as SEGMENT_DEFS };
