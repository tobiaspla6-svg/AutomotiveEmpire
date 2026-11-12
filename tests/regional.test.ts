// Regional pricing (Phase 3).
import { describe, expect, it } from 'vitest';
import * as A from '../src/sim/actions';
import { defaultVehicle } from '../src/sim/engineering';
import { computeMarket } from '../src/sim/market';
import { fxNow, regionalFactor, regionalPrice, regionalValue, updateFx } from '../src/sim/regional';
import { REGION_IDS } from '../src/data/world';
import type { Company, GameState, RegionId, VehicleModel } from '../src/sim/types';
import { founder, nonFinitePaths, player, step } from './helpers';

function onSale(): { g: GameState; p: Company; m: VehicleModel } {
  const g = founder({ year: 2012 }); const p = player(g);
  for (const r of ['EU', 'NA', 'LATAM'] as RegionId[]) A.investDealers(g, r, 150e6);
  expect(A.startDevelopment(g, 'World', defaultVehicle(2012, 'hatch'), 'budget')).toBeNull();
  const m = p.models[0];
  let i = 0; while (m.status === 'development' && i++ < 80) step(g);
  expect(A.addLine(g, p.factories[0].id, m.id, 3000)).toBeNull();
  step(g, 3);
  return { g, p, m };
}
const demand = (g: GameState, m: VehicleModel) => computeMarket(g).demand.get(m.id)!;
const books = (c: Company, from: number) => {
  let prev = c.ledger[from - 1];
  for (const L of c.ledger.slice(from)) {
    expect(Math.abs(L.cash - L.cashStart - (L.operatingCash + L.investingCash + L.financingCash))).toBeLessThan(1e-3 + Math.abs(L.cash) * 1e-9);
    if (prev) expect(Math.abs(L.equity - prev.equity - L.profit)).toBeLessThan(1e-3 + Math.abs(L.equity) * 1e-9);
    prev = L;
  }
};

describe('regional prices', () => {
  it('without regional prices a car sells at its world price everywhere', () => {
    const { g, m } = onSale();
    for (const r of REGION_IDS) expect(regionalFactor(g, m, r)).toBe(1);
  });
  it('a lower price in one market wins buyers there and leaves the others alone', () => {
    const { g, m } = onSale();
    const before = demand(g, m);
    expect(A.setRegionalPrice(g, m.id, 'LATAM', m.price * 0.8)).toBeNull();
    const after = demand(g, m);
    expect(after.LATAM).toBeGreaterThan(before.LATAM * 1.2);
    expect(after.EU).toBeCloseTo(before.EU, 0);
    expect(after.NA).toBeCloseTo(before.NA, 0);
  });
  it('buyers in poorer markets and in high-tax markets value the same car less', () => {
    const { g } = onSale();
    expect(regionalValue(g, 'LATAM')).toBeLessThan(regionalValue(g, 'NA') * 0.8);
    expect(regionalValue(g, 'EU')).toBeLessThan(regionalValue(g, 'NA')); // VAT
  });
  it('revenue is booked per region at the dollar value of each regional price', () => {
    const { g, p, m } = onSale();
    A.setRegionalPrice(g, m.id, 'EU', m.price * 1.1);
    A.setRegionalPrice(g, m.id, 'LATAM', m.price * 0.85);
    const factor = Object.fromEntries(REGION_IDS.map((r) => [r, regionalFactor(g, m, r)])) as Record<RegionId, number>; // this month's exchange rates
    step(g);
    const L = p.ledger[p.ledger.length - 1];
    const expected = REGION_IDS.reduce((a, r) => a + m.lastSales[r] * m.price * factor[r], 0) * 0.88;
    expect(L.revenue).toBeCloseTo(expected, -2);
  });
  it('a price fixed in local currency loses dollar value when the currency weakens; the world price has no such exposure', () => {
    const { g, m } = onSale();
    A.setRegionalPrice(g, m.id, 'EU', m.price);
    const usd = regionalPrice(g, m, 'EU');
    g.macro.fx = { ...g.macro.fx, EU: fxNow(g, 'EU') * 1.25 }; // a quarter more euros per dollar
    expect(regionalPrice(g, m, 'EU')).toBeCloseTo(usd / 1.25, 6);
    expect(regionalPrice(g, m, 'NA')).toBe(m.price);
  });
  it("exchange rates drift but stay bounded, and do not consume the game's random numbers", () => {
    const { g } = onSale();
    const rng = JSON.stringify(g.rng);
    const a = JSON.parse(JSON.stringify(g)) as GameState, b = JSON.parse(JSON.stringify(g)) as GameState;
    for (let i = 0; i < 120; i++) { updateFx(a); updateFx(b); a.month = (a.month % 12) + 1; b.month = a.month; if (a.month === 1) { a.year++; b.year++; } }
    expect(a.macro.fx).toEqual(b.macro.fx);
    for (const r of REGION_IDS) { expect(fxNow(a, r)).toBeGreaterThan(0.4); expect(fxNow(a, r)).toBeLessThan(2.5); }
    expect(fxNow(a, 'NA')).toBe(1);
    expect(REGION_IDS.some((r) => Math.abs(fxNow(a, r) - 1) > 0.02)).toBe(true);
    expect(JSON.stringify(g.rng)).toBe(rng);
  });
  it('keeps the books balanced through a year of regional prices and currency moves; rejects invalid prices', () => {
    const { g, p, m } = onSale();
    const from = p.ledger.length;
    A.setRegionalPrice(g, m.id, 'EU', m.price * 1.05); A.setRegionalPrice(g, m.id, 'NA', m.price * 0.95);
    step(g, 12);
    books(p, from);
    expect(nonFinitePaths(g)).toEqual([]);
    for (const bad of [0, -1, NaN]) expect(A.setRegionalPrice(g, m.id, 'EU', bad)).toMatch(/price/);
    expect(A.setRegionalPrice(g, m.id, 'EU', null)).toBeNull();
    expect(regionalFactor(g, m, 'EU')).toBe(1);
  });
});
