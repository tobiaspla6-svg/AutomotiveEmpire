// Order books, allocations and collector values (Phase 3).
//
// A limited edition (a trim with a production cap) or a model whose maker caps its yearly production (an
// exclusivity strategy) does not lose the demand it cannot serve: buyers join a WAITING LIST that is served first
// as cars are built. Every month some give up — fewer when cars are allocated to loyal customers than when they go
// first come, first served. Allocating to loyal customers and keeping a waiting list also feed the brand's
// prestige. PERSONALISATION (bespoke paint, trim, details) adds revenue per car for a desirable badge, at a cost.
//
// Three prices are distinguished:
//   • the LIST PRICE the maker sets;
//   • buyers' WILLINGNESS TO PAY — the value price with its scarcity premium (see market.ts);
//   • the COLLECTOR VALUE on the secondary market — willingness to pay plus a premium for the queue that
//     cannot be served, growing a little every year once a limited run is sold out.
import type { Company, GameState, Trim, VehicleModel } from './types';
import { annualSupply, valuePrice } from './market';
import { trimView } from './trims';
import { clamp } from './util';

/** Does this car (a trim or a whole model) keep an order book? */
export const hasOrderBook = (m: VehicleModel, t?: Trim) => (t ? t.cap !== undefined || (t.orders ?? 0) > 0 : m.annualCap !== undefined || (m.orders ?? 0) > 0); // a waiting list is served until it is empty
/** Share of the waiting list that gives up each month. */
export const cancelRate = (allocation: 'loyal' | 'open' | undefined) => (allocation === 'loyal' ? 0.02 : 0.05);
/** Extra revenue per car from personalisation (share of list price), scaled by how much the badge is wanted. */
export const personalUplift = (personal: number, prestige: number) => 0.25 * clamp(personal, 0, 1) * clamp((prestige - 40) / 50, 0, 1);
/** Cost of personalisation per car (share of list price): materials and hand work. */
export const personalCost = (personal: number) => 0.08 * clamp(personal, 0, 1);

/** Months of production the waiting list represents. */
export function waitingMonths(c: Company, m: VehicleModel, t?: Trim): number {
  const orders = (t ? t.orders : m.orders) ?? 0;
  const perMonth = t ? Math.max(1, (annualSupply(c, m) / 12) * (t.mix || 0.01)) : Math.max(1, (m.annualCap ?? annualSupply(c, m)) / 12);
  return orders / perMonth;
}
export interface PriceLevels { list: number; willingness: number; collector: number; waitingMonths: number }
/** List price, willingness to pay and estimated collector value of a car with an order book. */
export function priceLevels(g: GameState, c: Company, m: VehicleModel, t?: Trim): PriceLevels {
  const view = t ? trimView(m, t) : m;
  const supply = t ? Math.max(12, t.cap ?? annualSupply(c, m) * (t.mix || 0.01)) : Math.max(12, Math.min(annualSupply(c, m), m.annualCap ?? Infinity));
  const willingness = valuePrice(view, c, g.year, supply);
  const wait = waitingMonths(c, m, t);
  const soldOut = t && t.cap !== undefined && t.built >= t.cap - 1e-6;
  const years = soldOut && m.launchYear ? Math.max(0, g.year - m.launchYear - 1) : 0;
  const desirable = clamp((c.prestige - 50) / 40, 0, 1);
  const collector = willingness * (1 + 0.12 * Math.log2(1 + wait) * desirable) * Math.pow(1 + 0.04 * desirable, years);
  return { list: t ? t.price : m.price, willingness, collector, waitingMonths: wait };
}
