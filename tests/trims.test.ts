// Trims, facelifts and generations (Phase 3).
import { describe, expect, it } from 'vitest';
import * as A from '../src/sim/actions';
import { defaultVehicle } from '../src/sim/engineering';
import { computeMarket, valuePrice, annualSupply } from '../src/sim/market';
import { enginesOf } from '../src/sim/families';
import { productionMix, trimKey, trimView, trimsOf, faceliftCost, TRIM_PRESETS } from '../src/sim/trims';
import { equity, inventoryValue } from '../src/sim/accounts';
import type { Company, GameState, VehicleModel } from '../src/sim/types';
import { founder, nonFinitePaths, player, step } from './helpers';

function books(c: Company, from: number) {
  let prev = c.ledger[from - 1];
  for (const L of c.ledger.slice(from)) {
    expect(Math.abs(L.cash - L.cashStart - (L.operatingCash + L.investingCash + L.financingCash))).toBeLessThan(1e-3 + Math.abs(L.cash) * 1e-9);
    if (prev) expect(Math.abs(L.equity - prev.equity - L.profit)).toBeLessThan(1e-3 + Math.abs(L.equity) * 1e-9);
    prev = L;
  }
}
/** A company with one car on sale and a turbo variant of its engine ready. */
function onSale(): { g: GameState; p: Company; m: VehicleModel } {
  const g = founder({ year: 2010 }); const p = player(g);
  A.investDealers(g, 'EU', 300e6);
  expect(A.startDevelopment(g, 'Civic', defaultVehicle(2010, 'hatch'), 'budget')).toBeNull();
  const m = p.models[0];
  let i = 0; while (m.status === 'development' && i++ < 80) step(g);
  const f = enginesOf(p)[0];
  expect(A.addEngineVariant(g, f.id, { ...m.spec.engine, aspiration: 'turbo', boost: 1.0, compression: 9.6, cam: 0.6, redline: 7000 })).toBeNull();
  expect(A.addLine(g, p.factories[0].id, m.id, 1500)).toBeNull();
  step(g, 8); // stock builds, the variant finishes calibration
  expect(f.variants.every((v) => v.status === 'ready')).toBe(true);
  return { g, p, m };
}

describe('trims', () => {
  it('the first trim keeps the car on sale unchanged: a Standard trim takes over its specification, price and stock', () => {
    const { g, p, m } = onSale();
    const stock = m.inventory, value = m.inventoryValue, price = m.price, eq = equity(p);
    expect(stock).toBeGreaterThan(0);
    expect(A.addTrim(g, m.id, 'entry')).toBeNull();
    const [std, entry] = trimsOf(m);
    expect(std.name).toBe('Standard'); expect(std.inventory).toBeCloseTo(stock, 9); expect(std.inventoryValue).toBeCloseTo(value, 6);
    expect(std.price).toBe(price); expect(std.stats.zeroTo100).toBeCloseTo(m.stats.zeroTo100, 6);
    expect(entry.inventory).toBe(0);
    expect(inventoryValue(p)).toBeCloseTo(value, 3); expect(equity(p)).toBeCloseTo(eq, 3);
  });
  it('each trim is its own car: engine, equipment, cost and price differ in the right direction', () => {
    const { g, m } = onSale();
    for (const lv of ['entry', 'sport', 'luxury'] as const) expect(A.addTrim(g, m.id, lv)).toBeNull();
    const t = Object.fromEntries(trimsOf(m).map((x) => [x.level === 'mid' ? 'std' : x.level, x]));
    expect(t.sport.stats.powerKw).toBeGreaterThan(t.std.stats.powerKw * 1.1); // the turbo variant
    expect(t.sport.stats.zeroTo100).toBeLessThan(t.std.stats.zeroTo100);
    expect(t.entry.stats.partsCost).toBeLessThan(t.std.stats.partsCost);
    expect(t.luxury.stats.partsCost).toBeGreaterThan(t.std.stats.partsCost);
    expect(t.luxury.stats.scores.comfort).toBeGreaterThan(t.entry.stats.scores.comfort + 10);
    // recommended prices follow content
    expect(t.entry.price).toBeLessThan(t.luxury.price);
    expect(t.sport.price).toBeGreaterThan(t.entry.price);
    expect(TRIM_PRESETS.limited.mix).toBeLessThan(TRIM_PRESETS.mid.mix);
  });
  it('production follows the mix, a limited edition stops at its cap, and the books stay balanced', () => {
    const { g, p, m } = onSale();
    A.addTrim(g, m.id, 'entry'); A.addTrim(g, m.id, 'limited');
    const [std, entry, lim] = trimsOf(m);
    A.updateTrim(g, m.id, std.id, { mix: 0.6 }); A.updateTrim(g, m.id, entry.id, { mix: 0.3 }); A.updateTrim(g, m.id, lim.id, { mix: 0.1, cap: 300 });
    const mix = productionMix(m);
    expect(mix.get(std.id)!).toBeCloseTo(0.6, 9);
    A.setLineTarget(g, p.factories[0].id, m.id, 1500); // build flat out
    const from = p.ledger.length;
    const built0 = [std.built, entry.built];
    step(g, 1);
    const dStd = std.built - built0[0], dEntry = entry.built - built0[1];
    expect(dStd / dEntry).toBeCloseTo(2, 6);
    let i = 0; while (lim.built < 299 && i++ < 24) { step(g); expect(lim.built).toBeLessThanOrEqual(300 + 1e-6); }
    expect(lim.built).toBeGreaterThan(299);
    step(g, 2);
    expect(lim.built).toBeLessThanOrEqual(300 + 1e-6);
    expect(productionMix(m).has(lim.id)).toBe(false);
    // the model's figures are the sums of its trims
    expect(m.inventory).toBeCloseTo(trimsOf(m).reduce((a, t) => a + t.inventory, 0), 6);
    expect(m.inventoryValue).toBeCloseTo(trimsOf(m).reduce((a, t) => a + t.inventoryValue, 0), 3);
    books(p, from);
    expect(nonFinitePaths(g)).toEqual([]);
  });
  it('sales and contribution are tracked per trim and add up to the company\'s', () => {
    const { g, p, m } = onSale();
    A.addTrim(g, m.id, 'entry'); A.addTrim(g, m.id, 'sport');
    const from = p.ledger.length;
    const r0 = trimsOf(m).map((t) => [t.revenue, t.cogs]);
    step(g, 6);
    const L = p.ledger.slice(from);
    const rev = trimsOf(m).reduce((a, t, i) => a + t.revenue - r0[i][0], 0), cogs = trimsOf(m).reduce((a, t, i) => a + t.cogs - r0[i][1], 0);
    expect(rev).toBeCloseTo(L.reduce((a, l) => a + l.revenue, 0), 0);
    expect(cogs).toBeCloseTo(L.reduce((a, l) => a + l.cogs, 0), 0);
    expect(trimsOf(m).every((t) => t.salesHistory.length >= 6)).toBe(true);
    expect(trimsOf(m).filter((t) => t.revenue > 0).length).toBe(3);
  });
  it('trims compete with each other: pricing one up moves buyers to its siblings', () => {
    const { g, m } = onSale();
    A.addTrim(g, m.id, 'entry');
    const [std, entry] = trimsOf(m);
    const d = (mk: ReturnType<typeof computeMarket>, t: typeof std) => Object.values(mk.demand.get(trimKey(m, t)) ?? {}).reduce((a, b) => a + b, 0);
    const before = computeMarket(g);
    A.updateTrim(g, m.id, std.id, { price: std.price * 1.3 });
    const after = computeMarket(g);
    expect(d(after, std)).toBeLessThan(d(before, std) * 0.75);
    expect(d(after, entry)).toBeGreaterThan(d(before, entry));
    // the model's demand is the sum of its trims'
    const sum = d(after, std) + d(after, entry);
    expect(Object.values(after.demand.get(m.id)!).reduce((a, b) => a + b, 0)).toBeCloseTo(sum, 6);
  });
  it('a limited edition is worth more than the same car built without limit', () => {
    const { g, p, m } = onSale();
    A.addTrim(g, m.id, 'limited');
    const lim = trimsOf(m)[1];
    const view = trimView(m, lim);
    const unlimited = valuePrice(view, p, g.year, annualSupply(p, m));
    const limited = valuePrice(view, p, g.year, lim.cap!);
    expect(limited).toBeGreaterThanOrEqual(unlimited); // only a desirable badge turns scarcity into price (see pricing tests)
  });
  it('a trim with stock cannot be removed; at zero mix its stock sells and it can go', () => {
    const { g, m } = onSale();
    A.addTrim(g, m.id, 'entry');
    const [std, entry] = trimsOf(m);
    A.setLineTarget(g, player(g).factories[0].id, m.id, 1500);
    step(g, 2);
    A.setLineTarget(g, player(g).factories[0].id, m.id, -1); // back to following demand
    expect(entry.inventory).toBeGreaterThan(0);
    expect(A.removeTrim(g, m.id, entry.id)).toMatch(/stock/);
    A.updateTrim(g, m.id, entry.id, { mix: 0 });
    let i = 0; while (entry.inventory > 0.5 && i++ < 24) step(g);
    expect(A.removeTrim(g, m.id, entry.id)).toBeNull();
    expect(trimsOf(m).length === 0 || trimsOf(m)[0] === std).toBe(true);
  });
  it('rejects invalid trim input', () => {
    const { g, m } = onSale();
    A.addTrim(g, m.id, 'entry');
    const t = trimsOf(m)[1];
    for (const bad of [0, -1, NaN]) expect(A.updateTrim(g, m.id, t.id, { price: bad })).toMatch(/price/);
    expect(A.updateTrim(g, m.id, t.id, { mix: -0.1 })).toMatch(/negative/);
    expect(A.updateTrim(g, m.id, t.id, { engineVariantId: 'nope' })).toMatch(/variant/);
  });
});

describe('facelifts and generations', () => {
  it('a facelift needs three years on sale, costs exactly its budget and makes the car new again to buyers', () => {
    const { g, p, m } = onSale();
    expect(A.startFacelift(g, m.id)).toMatch(/after 3 years/);
    step(g, 36);
    const { cost } = faceliftCost(m);
    const base = JSON.parse(JSON.stringify(g)) as GameState; // the same world without the facelift
    const from = p.ledger.length;
    expect(A.startFacelift(g, m.id)).toBeNull();
    expect(A.startFacelift(g, m.id)).toMatch(/already/);
    step(g, 8); step(base, 8);
    expect(m.facelift).toBeNull(); expect(m.facelifts).toBe(1);
    const devExtra = p.ledger.slice(from).reduce((a, l) => a + l.dev, 0) - player(base).ledger.slice(from).reduce((a, l) => a + l.dev, 0);
    expect(devExtra).toBeCloseTo(cost, -2);
    expect(m.launchYear).toBe(g.month === 1 ? g.year - 1 : g.year);
    const mb = player(base).models[0];
    expect(m.stats.scores.comfort).toBeGreaterThan(mb.stats.scores.comfort);
    const dem = (x: GameState, mm: VehicleModel) => Object.values(computeMarket(x).demand.get(mm.id)!).reduce((a, b) => a + b, 0);
    expect(dem(g, m)).toBeGreaterThan(dem(base, mb) * 1.05);
  });
  it('a new generation inherits the trim line-up, not the stock', () => {
    const { g, p, m } = onSale();
    A.addTrim(g, m.id, 'entry'); A.addTrim(g, m.id, 'sport');
    expect(A.startDevelopment(g, 'Civic Mk2', JSON.parse(JSON.stringify(m.spec)), 'budget', m.id)).toBeNull();
    const n = p.models[p.models.length - 1];
    expect(n.generation).toBe(2);
    expect(trimsOf(n).map((t) => t.name)).toEqual(trimsOf(m).map((t) => t.name));
    expect(trimsOf(n).every((t) => t.inventory === 0 && t.revenue === 0)).toBe(true);
    expect(n.engineFamilyId).toBe(m.engineFamilyId);
  });
});
