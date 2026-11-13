// Executive insights: the few things in the company that need attention right now, ranked. Pure functions of the game
// state with no strings — the interface turns an insight's `kind` and `args` into a localised headline, the reason it
// matters and a button that takes the player to the right screen. Read-only: it never changes the game.
import type { Company, GameState, Objective, StageId, VehicleModel } from './types';
import { REGION_IDS } from '../data/world';
import { annualProfit, annualRevenue, creditLimit, devEngineersNeeded, lineShareUsed } from './company';
import { bottleneck, stagesOf } from './supply';

export type Severity = 'critical' | 'warning' | 'opportunity' | 'info';
export type InsightKind =
  | 'overLimit' | 'cashRunway' | 'noVehicles' | 'readyNoLine' | 'noPrice' | 'belowCost' | 'bottleneck' | 'idleCapacity'
  | 'soldOut' | 'supplyDisruption' | 'engineersShort' | 'boardDeadline' | 'boardConfidence' | 'ageingRange' | 'costlyDebt';
export type InsightView = 'vehicles' | 'factories' | 'market' | 'finance' | 'research' | 'company' | 'motorsport';

export interface Insight {
  id: string;
  severity: Severity;
  kind: InsightKind;
  /** values the message needs (names, amounts, counts); localisation decides how to phrase them */
  args: Record<string, string | number>;
  /** the screen that fixes it */
  view: InsightView;
}

const RANK: Record<Severity, number> = { critical: 0, warning: 1, opportunity: 2, info: 3 };
const sold = (m: VehicleModel) => REGION_IDS.reduce((a, r) => a + m.lastSales[r], 0);

/** Average monthly change of cash over the last three months (negative = burning cash). */
export function cashTrend(c: Company): number {
  const l = c.ledger.slice(-3);
  return l.length ? l.reduce((a, x) => a + (x.cash - x.cashStart), 0) / l.length : 0;
}

/** How close an objective is to being met, 0..1 (progress means different things per kind). */
export function objectiveRatio(o: Objective): number {
  if (o.done) return 1;
  if (o.failed) return 0;
  switch (o.kind) {
    case 'profit': return o.progress > 0 ? 0.7 : 0.1;
    case 'debt': return o.progress <= o.target ? 1 : Math.max(0, Math.min(1, o.target / Math.max(o.progress, 1)));
    case 'volume': case 'prestige': case 'reliability': case 'share': return Math.max(0, Math.min(1, o.target > 0 ? o.progress / o.target : 0));
    default: return 0;
  }
}

export function companyInsights(g: GameState, c: Company): Insight[] {
  const out: Insight[] = [];
  const add = (i: Insight) => out.push(i);
  const prod = c.models.filter((m) => m.status === 'production');
  const dev = c.models.filter((m) => m.status === 'development');
  const ready = c.models.filter((m) => m.status === 'ready');
  const ms = !!c.motorsport && g.mode === 'motorsport';

  if (c.troubleMonths > 0) add({ id: 'overLimit', severity: 'critical', kind: 'overLimit', args: { months: c.troubleMonths, limit: creditLimit(c, g.year), debt: c.debt }, view: 'finance' });

  const burn = cashTrend(c);
  if (burn < 0 && c.ledger.length >= 2) {
    const headroom = Math.max(0, creditLimit(c, g.year) - c.debt);
    const months = (c.cash + headroom * 0.5) / -burn;
    if (months < 9) add({ id: 'cashRunway', severity: months < 3 ? 'critical' : 'warning', kind: 'cashRunway', args: { months: Math.max(0, Math.round(months * 10) / 10), burn: -burn }, view: 'finance' });
  }

  if (!c.models.length && !c.motorsport && !ms) add({ id: 'noVehicles', severity: 'warning', kind: 'noVehicles', args: {}, view: 'vehicles' });
  for (const m of ready) add({ id: `ready:${m.id}`, severity: 'warning', kind: 'readyNoLine', args: { name: m.name }, view: 'factories' });
  for (const m of prod.filter((x) => x.price <= 0)) add({ id: `price:${m.id}`, severity: 'critical', kind: 'noPrice', args: { name: m.name }, view: 'vehicles' });
  for (const m of prod.filter((x) => x.price > 0 && x.lastUnitCost > 0 && x.price * 0.88 < x.lastUnitCost)) {
    add({ id: `cost:${m.id}`, severity: 'warning', kind: 'belowCost', args: { name: m.name, net: m.price * 0.88, cost: m.lastUnitCost }, view: 'vehicles' });
  }

  for (const f of c.factories) {
    const b = bottleneck(f);
    if (b && f.lastOutput !== undefined && f.capacity > 0) {
      const cap = stagesOf(f)[b];
      if (f.lastOutput >= cap * 0.9) add({ id: `bn:${f.id}`, severity: 'warning', kind: 'bottleneck', args: { name: f.name, stage: b as StageId, cap: Math.round(cap), nominal: Math.round(f.capacity) }, view: 'factories' });
    }
  }
  const cap = c.factories.reduce((a, f) => a + f.capacity, 0);
  const used = c.factories.reduce((a, f) => a + f.capacity * lineShareUsed(f), 0);
  if (cap > 0 && prod.length && used / cap < 0.5 && c.ledger.length >= 3) add({ id: 'idle', severity: 'warning', kind: 'idleCapacity', args: { util: Math.round((used / cap) * 100) }, view: 'factories' });

  for (const m of prod) {
    const s = sold(m);
    if (m.lastDemand > 0 && m.inventory < 1 && s < m.lastDemand * 0.9) add({ id: `sold:${m.id}`, severity: 'opportunity', kind: 'soldOut', args: { name: m.name, demand: Math.round(m.lastDemand), sold: Math.round(s) }, view: 'factories' });
  }

  const dis = c.supply ? Object.entries(c.supply.disrupted).filter(([, mo]) => mo > 0) : [];
  if (dis.length) add({ id: 'supply', severity: 'warning', kind: 'supplyDisruption', args: { suppliers: dis.length, months: Math.max(...dis.map(([, mo]) => mo)), loss: Math.round((c.supply?.lastLoss ?? 0) * 100) }, view: 'factories' });

  if (dev.length) {
    const need = dev.reduce((a, m) => a + devEngineersNeeded(g, c, m), 0);
    if (c.engineers < need * 0.8) add({ id: 'eng', severity: 'warning', kind: 'engineersShort', args: { need: Math.round(need), have: c.engineers }, view: 'research' });
  }

  if (c.board) {
    if (c.board.confidence < 35) add({ id: 'conf', severity: c.board.confidence < 20 ? 'critical' : 'warning', kind: 'boardConfidence', args: { confidence: Math.round(c.board.confidence) }, view: 'company' });
    for (const o of c.board.objectives) {
      if (!o.done && !o.failed && o.byYear <= g.year + 1 && objectiveRatio(o) < 0.8) add({ id: `obj:${o.id}`, severity: 'warning', kind: 'boardDeadline', args: { text: o.text, year: o.byYear, pct: Math.round(objectiveRatio(o) * 100) }, view: 'company' });
    }
  }

  for (const m of prod) {
    const age = m.launchYear ? g.year - m.launchYear : 0;
    if (age >= 7 && !m.facelift) add({ id: `age:${m.id}`, severity: 'info', kind: 'ageingRange', args: { name: m.name, years: age }, view: 'vehicles' });
  }

  if (c.debt > 0 && c.cash > c.debt * 0.6 && c.interestRate > 0.06 && annualProfit(c) > 0 && annualRevenue(c) > 0) {
    add({ id: 'debt', severity: 'opportunity', kind: 'costlyDebt', args: { rate: Math.round(c.interestRate * 1000) / 10, debt: c.debt, cash: c.cash }, view: 'finance' });
  }

  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
