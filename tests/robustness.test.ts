import { describe, expect, it } from 'vitest';
import * as A from '../src/sim/actions';
import { computeMarket } from '../src/sim/market';
import { defaultVehicle } from '../src/sim/engineering';
import { raceWeather } from '../src/sim/racing/season';
import { buildRaceConfig } from '../src/sim/racing/season';
import { REGION_IDS } from '../src/data/world';
import type { GameState, VehicleModel } from '../src/sim/types';
import { founder, motorsport, nonFinitePaths, player, step } from './helpers';

function onSale(g: GameState): VehicleModel {
  const p = player(g);
  A.startDevelopment(g, 'Probe', defaultVehicle(g.year, 'hatch'), 'budget');
  const m = p.models[p.models.length - 1];
  while (m.status === 'development') step(g);
  expect(A.addLine(g, p.factories[0].id, m.id, 1500)).toBeNull();
  step(g, 2);
  expect(m.status).toBe('production');
  return m;
}
const aiDemand = (g: GameState, seg: string) => {
  const mk = computeMarket(g);
  let ai = 0;
  for (const r of REGION_IDS) for (const e of mk.cells[`${r}:${seg}`].entries) if (!e.company.isPlayer) ai += e.demand;
  return ai;
};

describe('invalid input cannot corrupt the game', () => {
  it('a zero or invalid price is rejected and never zeroes competitors\' sales', () => {
    const g = founder();
    const m = onSale(g);
    const before = aiDemand(g, m.segment);
    for (const bad of [0, -5, NaN, Infinity]) {
      expect(A.setPrice(g, m.id, bad)).toMatch(/price/i);
      expect(m.price).toBeGreaterThan(0);
    }
    expect(aiDemand(g, m.segment)).toBeCloseTo(before, 3);
    // even a corrupted save with price 0 only takes that car off the market
    m.price = 0;
    const mk = computeMarket(g);
    for (const cell of Object.values(mk.cells)) for (const e of cell.entries) expect(Number.isFinite(e.demand)).toBe(true);
    expect(aiDemand(g, m.segment)).toBeGreaterThan(before * 0.99);
    step(g, 2);
    expect(nonFinitePaths(g)).toEqual([]);
  });

  it('non-finite amounts are rejected by every money action', () => {
    const g = founder();
    const p = player(g);
    const snapshot = JSON.stringify([p.cash, p.debt, p.reach, p.rdBudget, p.marketingBudget, p.engineers]);
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(A.takeLoan(g, bad)).not.toBeNull();
      expect(A.repayLoan(g, bad)).not.toBeNull();
      expect(A.investDealers(g, 'EU', bad)).not.toBeNull();
      expect(A.setEngineers(g, bad)).not.toBeNull();
      expect(A.buildFactory(g, 'X', 'Germany', bad, 0.2)).not.toBeNull();
      expect(A.expandFactory(g, p.factories[0].id, bad)).not.toBeNull();
      A.setRd(g, 'engine', bad);
      A.setMarketing(g, bad);
    }
    expect(JSON.stringify([p.cash, p.debt, p.reach, p.rdBudget, p.marketingBudget, p.engineers])).toBe(snapshot);
    expect(A.takeLoan(g, -10e6)).not.toBeNull();
    expect(A.repayLoan(g, -10e6)).not.toBeNull();
    expect(nonFinitePaths(g)).toEqual([]);
  });
});

describe('stock is never stranded', () => {
  it('a model whose production line was removed keeps selling its stock alongside a model still in production', () => {
    const g = founder();
    const p = player(g);
    expect(A.investDealers(g, 'EU', 400e6)).toBeNull(); // enough dealers for real demand
    const keep = onSale(g);
    const old = onSale(g);
    const price = old.price;
    A.setLineTarget(g, p.factories[0].id, old.id, 1500);
    A.setPrice(g, old.id, price * 2.5); // overpriced: stock piles up
    step(g, 3);
    A.removeLine(g, p.factories[0].id, old.id);
    A.setPrice(g, old.id, price); // run-out sale at the normal price
    const stock = old.inventory;
    expect(stock).toBeGreaterThan(500);
    step(g, 6);
    const sold = old.salesHistory.slice(-6).reduce((a, b) => a + b, 0);
    const keptSold = keep.salesHistory.slice(-6).reduce((a, b) => a + b, 0);
    // the run-out model gets a fair share of the dealers while its stock lasts (not ~0 %)
    expect(sold).toBeGreaterThan(stock * 0.25);
    expect(keptSold).toBeGreaterThan(0);
  });
});

describe('race briefing is read-only', () => {
  it('the weather forecast matches the race and reading it changes nothing', () => {
    const g = motorsport({ discipline: 'f1', year: 1990 });
    const p = player(g);
    const div = p.motorsport!;
    div.championship.teams.find((t) => t.isPlayer)!.car.engine.displacement = 9000; // illegal car → scrutineering news on build
    const before = JSON.stringify(g);
    for (let i = 0; i < 5; i++) raceWeather(g, div);
    expect(JSON.stringify(g)).toBe(before);
    const forecast = raceWeather(g, div).forecast;
    expect(buildRaceConfig(g, p, div).weather.forecast).toBe(forecast);
  });
});
