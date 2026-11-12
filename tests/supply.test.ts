// Supply chain and production stages (Phase 3).
import { describe, expect, it } from 'vitest';
import * as A from '../src/sim/actions';
import { defaultVehicle } from '../src/sim/engineering';
import { SUPPLIER_BY_ID, suppliersFor } from '../src/data/suppliers';
import { categoryShares, contractIndex, effectiveCapacity, inspectionHazard, quote, stagesOf, supplierCapacity } from '../src/sim/supply';
import { engineFamilies } from '../src/sim/events';
import { unitCost } from '../src/sim/company';
import type { Company, GameState, VehicleModel } from '../src/sim/types';
import { founder, nonFinitePaths, player, step } from './helpers';

function onSale(units = 1500): { g: GameState; p: Company; m: VehicleModel } {
  const g = founder({ year: 2012 }); const p = player(g);
  A.investDealers(g, 'EU', 300e6);
  expect(A.startDevelopment(g, 'Base', defaultVehicle(2012, 'hatch'), 'budget')).toBeNull();
  const m = p.models[0];
  let i = 0; while (m.status === 'development' && i++ < 80) step(g);
  expect(A.addLine(g, p.factories[0].id, m.id, units)).toBeNull();
  A.setLineTarget(g, p.factories[0].id, m.id, units); // build a steady volume
  step(g, 4);
  return { g, p, m };
}
const clone = (g: GameState) => JSON.parse(JSON.stringify(g)) as GameState;
const lastMonth = (g: GameState) => player(g).ledger[player(g).ledger.length - 1];
const perCar = (g: GameState) => lastMonth(g).production / Math.max(1, player(g).factories[0].lastOutput ?? 0);
function books(c: Company, from: number) {
  let prev = c.ledger[from - 1];
  for (const L of c.ledger.slice(from)) {
    expect(Math.abs(L.cash - L.cashStart - (L.operatingCash + L.investingCash + L.financingCash))).toBeLessThan(1e-3 + Math.abs(L.cash) * 1e-9);
    if (prev) expect(Math.abs(L.equity - prev.equity - L.profit)).toBeLessThan(1e-3 + Math.abs(L.equity) * 1e-9);
    prev = L;
  }
}

describe('suppliers and contracts', () => {
  it('categories follow the car: an electric car depends on batteries, a combustion car does not', () => {
    const ice = categoryShares(defaultVehicle(2020, 'sedan') && onSale().m.stats);
    expect(ice.batteries).toBe(0);
    expect(Object.values(ice).reduce((a, b) => a + b, 0)).toBeGreaterThan(0.25);
    expect(Object.values(ice).reduce((a, b) => a + b, 0)).toBeLessThan(0.8);
  });
  it('quotes: a bigger commitment and a longer term cost less; a supplier far from every plant costs more', () => {
    const { p, g } = onSale();
    const d = SUPPLIER_BY_ID['ruhr-stahl'], far = SUPPLIER_BY_ID['great-lakes-steel'];
    expect(quote(p, d, 20000, 1, g.year)).toBeLessThan(quote(p, d, 1000, 1, g.year));
    expect(quote(p, d, 1000, 5, g.year)).toBeLessThan(quote(p, d, 1000, 1, g.year));
    expect(quote(p, far, 1000, 1, g.year) / far.price).toBeGreaterThan(quote(p, d, 1000, 1, g.year) / d.price); // the founder's plant is in Europe
  });
  it('cheaper contracts lower the cost of every car built; without contracts nothing changes', () => {
    const { g, p } = onSale();
    const base = clone(g);
    for (const [cat, id] of [['metals', 'yellow-sea-metal'], ['electronics', 'pearl-river-elec'], ['tires', 'jade-rubber'], ['interior', 'mekong-materials']] as const) expect(A.signContract(g, cat, id, 1400, 5)).toBeNull();
    expect(contractIndex(p, p.models[0])).toBeLessThan(0.97);
    step(g); step(base);
    expect(perCar(g)).toBeLessThan(perCar(base) * 0.98);
    expect(player(base).supply).toBeUndefined();
  });
  it('take-or-pay: committing far more than you build is charged; within 90 % it is not', () => {
    const { g } = onSale(1000);
    const a = clone(g), b = clone(g);
    expect(A.signContract(a, 'glass', 'lumiere-verre', 5000, 3)).toBeNull();
    expect(A.signContract(b, 'glass', 'lumiere-verre', 1000, 3)).toBeNull();
    step(a); step(b);
    expect(player(a).supply!.lastPenalty).toBeGreaterThan(0);
    expect(player(b).supply!.lastPenalty).toBe(0);
  });
  it('a disrupted sole supplier cuts output; safety stock and a second source soften it', () => {
    const { g } = onSale();
    const run = (setup: (x: GameState) => void) => {
      const x = clone(g); setup(x);
      const sp = player(x).supply; if (sp) sp.disrupted['silicon-mesa'] = 3;
      step(x);
      return { loss: player(x).supply?.lastLoss ?? 0, spot: player(x).supply?.lastSpot ?? 0, out: player(x).factories[0].lastOutput ?? 0 };
    };
    const sole = run((x) => A.signContract(x, 'semiconductors', 'silicon-mesa', 1500, 3));
    const dual = run((x) => A.signContract(x, 'semiconductors', 'silicon-mesa', 1500, 3, 'formosa-wafer', 0.5));
    const stocked = run((x) => { A.signContract(x, 'semiconductors', 'silicon-mesa', 1500, 3); A.setSafetyStock(x, 1); player(x).supply!.buffer = 1; });
    const control = run(() => undefined as unknown as void);
    expect(sole.loss).toBeGreaterThan(0.3);
    expect(sole.spot).toBeGreaterThan(0);
    expect(dual.loss).toBeLessThan(sole.loss * 0.7);
    expect(stocked.loss).toBeLessThan(0.01);
    expect(control.loss).toBe(0); // market purchases are not exposed to one supplier
    expect(sole.out).toBeLessThan(control.out * 0.7);
  });
  it('a supplier cannot commit beyond its capacity, and invalid contracts are refused', () => {
    const { g } = onSale();
    const d = SUPPLIER_BY_ID['milano-tessuti'];
    expect(A.signContract(g, 'interior', d.id, supplierCapacity(d, g.year) * 2, 3)).toMatch(/at most/);
    expect(A.signContract(g, 'interior', 'ruhr-stahl', 100, 3)).toMatch(/does not offer/);
    expect(A.signContract(g, 'batteries', 'nordic-cell', 100, 3)).toMatch(/does not offer/); // founded 2016
    expect(A.signContract(g, 'interior', d.id, NaN, 3)).toMatch(/volume/);
    expect(suppliersFor('batteries', 2012).map((s) => s.id)).not.toContain('nordic-cell');
  });
  it('vertical integration: capital now, no supplier margin and running costs afterwards; the books balance', () => {
    const { g, p } = onSale();
    const from = p.ledger.length;
    const base = clone(g);
    expect(A.buildInHouse(g, 'seats', 1500)).toBeNull();
    expect(A.buildInHouse(g, 'glass', 1000)).toMatch(/not made in-house/);
    step(g, 6); step(base, 6);
    expect(perCar(g)).toBeLessThan(perCar(base));
    expect(lastMonth(g).factoryFixed).toBeGreaterThan(lastMonth(base).factoryFixed);
    books(p, from);
    expect(nonFinitePaths(g)).toEqual([]);
  });
  it('better bought-in parts make more reliable cars', () => {
    const { g, p, m } = onSale();
    const before = m.stats.scores.reliability;
    for (const [cat, id] of [['electronics', 'kanto-denso'], ['semiconductors', 'kyushu-chip'], ['tires', 'alpen-reifen'], ['transmissions', 'aichi-drive'], ['metals', 'nihon-kozai']] as const) expect(A.signContract(g, cat, id, 1500, 3)).toBeNull();
    step(g, 12); // January refresh
    expect(m.stats.scores.reliability).toBeGreaterThan(before);
    void p;
  });
});

describe('production stages', () => {
  it('the slowest stage limits the plant; expanding just that stage relieves it', () => {
    const { g, p } = onSale(2000);
    const f = p.factories[0];
    f.stages = { ...stagesOf(f), paint: 800 };
    expect(effectiveCapacity(f)).toBe(800);
    step(g);
    expect(f.lastOutput!).toBeLessThanOrEqual(800 + 1e-6);
    expect(f.lastOutput!).toBeGreaterThan(799); // the one line gets all the paint shop can do
    expect(A.expandStage(g, f.id, 'paint', 1500)).toBeNull();
    expect(A.expandStage(g, f.id, 'paint', 100)).toMatch(/already/);
    step(g, 7);
    expect(stagesOf(f).paint).toBe(2300);
    expect(f.lastOutput!).toBeGreaterThan(1999);
  });
  it('a plant expansion grows every stage', () => {
    const { g, p } = onSale();
    const f = p.factories[0];
    f.stages = { ...stagesOf(f) };
    const before = { ...f.stages };
    expect(A.expandFactory(g, f.id, 500)).toBeNull();
    step(g, 16);
    for (const k of Object.keys(before) as (keyof typeof before)[]) expect(f.stages[k]).toBeCloseTo(before[k] + 500, 6);
  });
  it('thorough inspection costs labour per car and lowers the defect hazard', () => {
    const { g, p, m } = onSale();
    const f = p.factories[0];
    const lax = unitCost(g, m, { ...f, inspection: 0 }, 1500), thorough = unitCost(g, m, { ...f, inspection: 1 }, 1500);
    expect(thorough).toBeGreaterThan(lax);
    A.setInspection(g, f.id, 0); const h0 = inspectionHazard(p);
    A.setInspection(g, f.id, 1); const h1 = inspectionHazard(p);
    expect(h1).toBeLessThan(h0 * 0.6);
    step(g, 6);
    const fam = [...engineFamilies(g, p).values()][0];
    A.setInspection(g, f.id, 0);
    const lazy = [...engineFamilies(g, p).values()][0];
    expect(lazy.hazard).toBeGreaterThan(fam.hazard * 1.5);
    expect(A.setInspection(g, f.id, 2)).toMatch(/between 0 and 1/);
  });
});
