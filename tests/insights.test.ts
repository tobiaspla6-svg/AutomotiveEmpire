// Executive insights: ranked, read-only advice computed from the real simulation.
import { describe, expect, it } from 'vitest';
import * as A from '../src/sim/actions';
import { defaultVehicle } from '../src/sim/engineering';
import { companyInsights, objectiveRatio, cashTrend, type Insight } from '../src/sim/insights';
import { player } from '../src/sim/world';
import type { GameState, Objective } from '../src/sim/types';
import { ceo, founder, step } from './helpers';

const kinds = (list: Insight[]) => list.map((i) => i.kind);

describe('companyInsights', () => {
  it('a company with no vehicles is told to design one', () => {
    const g = founder({ year: 2005 });
    const list = companyInsights(g, player(g));
    expect(kinds(list)).toContain('noVehicles');
    expect(list.find((i) => i.kind === 'noVehicles')!.view).toBe('vehicles');
  });

  it('a finished car with no production line, and a car without a price, are flagged', () => {
    const g = founder({ year: 2005 });
    const p = player(g);
    expect(A.startDevelopment(g, 'Test', defaultVehicle(2005, 'hatch'), 'budget')).toBeNull();
    const m = p.models[0];
    let i = 0; while (m.status === 'development' && i++ < 80) step(g);
    expect(kinds(companyInsights(g, p))).toContain('readyNoLine');
    expect(A.addLine(g, p.factories[0].id, m.id, 800)).toBeNull();
    step(g, 2);
    m.price = 0;
    const list = companyInsights(g, p);
    expect(list.some((x) => x.kind === 'noPrice' && x.severity === 'critical' && x.args.name === m.name)).toBe(true);
  });

  it('a car sold below cost, and debt beyond the credit limit, are flagged with their numbers', () => {
    const g = founder({ year: 2005 });
    const p = player(g);
    expect(A.startDevelopment(g, 'Test', defaultVehicle(2005, 'hatch'), 'budget')).toBeNull();
    const m = p.models[0];
    let i = 0; while (m.status === 'development' && i++ < 80) step(g);
    expect(A.addLine(g, p.factories[0].id, m.id, 800)).toBeNull();
    step(g, 3);
    m.lastUnitCost = 20000; m.price = 10000;
    const below = companyInsights(g, p).find((x) => x.kind === 'belowCost')!;
    expect(below.severity).toBe('warning');
    expect(below.args.cost).toBe(20000);
    p.troubleMonths = 2;
    const crit = companyInsights(g, p).find((x) => x.kind === 'overLimit')!;
    expect(crit.severity).toBe('critical');
    expect(crit.args.months).toBe(2);
  });

  it('is sorted by severity, read-only and free of non-finite numbers', () => {
    const g = ceo({ makerId: 'toyota', year: 2000 });
    step(g, 6);
    const p = player(g);
    const before = JSON.stringify({ ...g, savedAt: 0 });
    const list = companyInsights(g, p);
    expect(JSON.stringify({ ...g, savedAt: 0 })).toBe(before);
    const rank = { critical: 0, warning: 1, opportunity: 2, info: 3 } as const;
    for (let k = 1; k < list.length; k++) expect(rank[list[k].severity]).toBeGreaterThanOrEqual(rank[list[k - 1].severity]);
    for (const i of list) for (const v of Object.values(i.args)) if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
    expect(new Set(list.map((i) => i.id)).size).toBe(list.length);
  });

  it('runway: a company burning cash gets a warning that gets critical when close', () => {
    const g = founder({ year: 2005 });
    const p = player(g);
    step(g, 4);
    for (const l of p.ledger.slice(-3)) { l.cashStart = l.cash + 5e6; }
    p.cash = 6e6;
    expect(cashTrend(p)).toBeLessThan(0);
    const r = companyInsights(g, p).find((x) => x.kind === 'cashRunway');
    expect(r).toBeDefined();
    expect(['warning', 'critical']).toContain(r!.severity);
  });
});

describe('objectiveRatio', () => {
  const o = (kind: Objective['kind'], target: number, progress: number, extra: Partial<Objective> = {}): Objective => ({ id: 'x', kind, text: '', target, byYear: 2000, progress, done: false, failed: false, ...extra });
  it('measures progress per kind', () => {
    expect(objectiveRatio(o('volume', 1000, 250))).toBeCloseTo(0.25, 9);
    expect(objectiveRatio(o('volume', 1000, 4000))).toBe(1);
    expect(objectiveRatio(o('debt', 100, 200))).toBeCloseTo(0.5, 9);
    expect(objectiveRatio(o('debt', 100, 80))).toBe(1);
    expect(objectiveRatio(o('profit', 0, 5))).toBeGreaterThan(0.5);
    expect(objectiveRatio(o('volume', 1000, 10, { done: true }))).toBe(1);
    expect(objectiveRatio(o('volume', 1000, 900, { failed: true }))).toBe(0);
  });
});

void (null as unknown as GameState);
