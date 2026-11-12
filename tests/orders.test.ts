// Order books, exclusivity, personalisation and the price of rarity (Phase 3).
import { describe, expect, it } from 'vitest';
import * as A from '../src/sim/actions';
import { defaultEngine, defaultVehicle } from '../src/sim/engineering';
import { priceLevels, waitingMonths } from '../src/sim/orders';
import { trimsOf } from '../src/sim/trims';
import { scarcityPremium } from '../src/sim/market';
import type { Company, GameState, VehicleModel } from '../src/sim/types';
import { ceo, founder, nonFinitePaths, player, step } from './helpers';

/** A sports car on sale for a prestigious founder company (so that rarity and personalisation are worth something). */
function exotic(): { g: GameState; p: Company; m: VehicleModel } {
  const g = founder({ year: 2015, specialization: 'sports' }); const p = player(g);
  p.prestige = 90;
  A.investDealers(g, 'EU', 400e6); A.investDealers(g, 'NA', 300e6);
  const s = defaultVehicle(2015, 'coupe'); s.drive = 'RWD'; s.interior = 'premium'; s.quality = 0.7; s.tireCompound = 'sport'; s.sport = 0.7;
  s.engine = { ...defaultEngine(2015), layout: 'V8', displacement: 4000, redline: 8000, cam: 0.6 };
  expect(A.startDevelopment(g, 'GT', s, 'sports')).toBeNull();
  const m = p.models[0];
  let i = 0; while (m.status === 'development' && i++ < 80) step(g);
  expect(A.addLine(g, p.factories[0].id, m.id, 1500)).toBeNull();
  step(g, 3);
  return { g, p, m };
}
const books = (c: Company, from: number) => {
  let prev = c.ledger[from - 1];
  for (const L of c.ledger.slice(from)) {
    expect(Math.abs(L.cash - L.cashStart - (L.operatingCash + L.investingCash + L.financingCash))).toBeLessThan(1e-3 + Math.abs(L.cash) * 1e-9);
    if (prev) expect(Math.abs(L.equity - prev.equity - L.profit)).toBeLessThan(1e-3 + Math.abs(L.equity) * 1e-9);
    prev = L;
  }
};

describe('order books', () => {
  it('an exclusivity cap limits production and turns unmet demand into a waiting list served first', () => {
    const { g, p, m } = exotic();
    const free = m.lastDemand;
    expect(free).toBeGreaterThan(50);
    const from = p.ledger.length;
    expect(A.setAnnualCap(g, m.id, Math.round(free * 12 * 0.4))).toBeNull(); // build 40 % of what the market wants
    step(g, 6);
    const built = p.ledger.slice(-3).reduce((a, l) => a + l.production, 0);
    expect(m.orders!).toBeGreaterThan(0);
    expect(waitingMonths(p, m)).toBeGreaterThan(0.5);
    const sold = m.salesHistory.slice(-3).reduce((a, b) => a + b, 0);
    expect(sold).toBeLessThanOrEqual(m.annualCap! / 4 + 1); // never more than the cap allows (plus stock already built)
    expect(built).toBeGreaterThan(0);
    // without the cap, and with a higher price that brings demand below what the line can build, the list is worked down
    const queue = m.orders!;
    A.setAnnualCap(g, m.id, null);
    A.setPrice(g, m.id, m.price * 1.4);
    step(g, 6);
    expect(m.orders!).toBeLessThan(queue);
    books(p, from);
    expect(nonFinitePaths(g)).toEqual([]);
  });
  it('a capped car is worth more to buyers and to collectors than its list price suggests', () => {
    const { g, p, m } = exotic();
    const open = priceLevels(g, p, m).willingness;
    A.setAnnualCap(g, m.id, 300);
    step(g, 4);
    const lv = priceLevels(g, p, m);
    expect(lv.willingness).toBeGreaterThan(open * 1.2);
    expect(lv.collector).toBeGreaterThan(lv.willingness);
  });
  it('a limited-edition trim keeps a waiting list and never delivers more than its run', () => {
    const { g, m } = exotic();
    expect(A.addTrim(g, m.id, 'limited')).toBeNull();
    const lim = trimsOf(m)[1];
    A.updateTrim(g, m.id, lim.id, { cap: 120, mix: 0.05 });
    step(g, 18);
    const delivered = lim.salesHistory.reduce((a, b) => a + b, 0);
    expect(lim.built).toBeLessThanOrEqual(120 + 1e-6);
    expect(delivered).toBeLessThanOrEqual(lim.built + 1e-6);
    expect(lim.orders ?? 0).toBeGreaterThanOrEqual(0);
    const lv = priceLevels(g, player(g), m, lim);
    expect(lv.willingness).toBeGreaterThan(trimsOf(m)[0].price);
  });
  it('allocating to loyal customers keeps more buyers waiting and builds prestige', () => {
    const run = (allocation: 'loyal' | 'open') => {
      const { g, p, m } = exotic();
      A.setAnnualCap(g, m.id, Math.round(m.lastDemand * 12 * 0.3));
      A.setOrderPolicy(g, m.id, null, { allocation });
      const pr = p.prestige; step(g, 8);
      return { orders: m.orders!, prestige: p.prestige - pr };
    };
    const loyal = run('loyal'), open = run('open');
    expect(loyal.orders).toBeGreaterThan(open.orders);
    expect(loyal.prestige).toBeGreaterThanOrEqual(open.prestige);
  });
  it('personalisation earns more per car for a desirable badge, and costs something to deliver', () => {
    const { g, p, m } = exotic();
    const a = JSON.parse(JSON.stringify(g)) as GameState, b = JSON.parse(JSON.stringify(g)) as GameState;
    A.setOrderPolicy(b, m.id, null, { personal: 0.8 });
    expect(A.setOrderPolicy(b, m.id, null, { personal: 2 })).toMatch(/between/);
    step(a, 3); step(b, 3);
    const rev = (x: GameState) => player(x).ledger.slice(-3).reduce((s, l) => s + l.revenue, 0) / Math.max(1, player(x).ledger.slice(-3).reduce((s, l) => s + l.units, 0));
    const prod = (x: GameState) => player(x).ledger.slice(-3).reduce((s, l) => s + l.production, 0) / Math.max(1, player(x).factories[0].lastOutput ?? 1);
    expect(rev(b)).toBeGreaterThan(rev(a) * 1.1);
    expect(prod(b)).toBeGreaterThan(prod(a));
    void p;
  });
});

describe('the price of rarity', () => {
  it('limited flagships of great marques fetch collector prices; series sports cars do not', () => {
    const f80 = player(ceo({ makerId: 'ferrari', year: 2026 })).models.find((x) => x.name === 'F80')!;
    expect(f80.price).toBeGreaterThan(2.6e6); // real list price about $3.9M (was $1.6M before this change, $555k before Phase 2)
    expect(f80.price).toBeLessThan(5e6);
    const p22 = player(ceo({ makerId: 'porsche', year: 2022 }));
    expect(p22.models.find((x) => x.name === '911 (992)')!.price).toBeLessThan(130e3); // a series sports car stays a series sports car
    const ford = player(ceo({ makerId: 'ford', year: 2025 }));
    expect(ford.models.find((x) => x.name === 'Mustang (S650)')!.price).toBeLessThan(60e3);
  });
  it('the premium for rarity grows with the era, only for desirable badges', () => {
    expect(scarcityPremium('supercar', 2025, 97, 120)).toBeGreaterThan(scarcityPremium('supercar', 2002, 97, 120) * 1.5);
    expect(scarcityPremium('supercar', 2025, 45, 120)).toBe(1);
    expect(scarcityPremium('sports', 2025, 97, 100000)).toBe(1);
  });
});
