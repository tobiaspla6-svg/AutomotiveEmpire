import { describe, expect, it } from 'vitest';
import * as A from '../src/sim/actions';
import { defaultVehicle } from '../src/sim/engineering';
import { equity, fixedAssets, inventoryValue } from '../src/sim/accounts';
import { prepareLoadedGame, SAVE_VERSION } from '../src/sim/migrate';
import type { Company, GameState, MonthLedger, VehicleModel } from '../src/sim/types';
import { ceo, founder, motorsport, nonFinitePaths, player, step } from './helpers';

const tol = (x: number) => Math.max(1, Math.abs(x)) * 1e-9;

/** Both bookkeeping identities for every recorded month of the player's ledger. */
function expectBooksBalance(c: Company, from = 0, opening?: { cash: number; equity: number }) {
  const months = c.ledger.slice(from);
  expect(months.length).toBeGreaterThan(0);
  let prev: Pick<MonthLedger, 'cash' | 'equity'> | undefined = opening ?? (from > 0 ? c.ledger[from - 1] : undefined);
  for (const L of months) {
    const tag = `${L.m}/${L.y}`;
    // cash-flow statement: operating (indirect) + investing + financing explains the change in cash
    const flows = L.operatingCash + L.investingCash + L.financingCash;
    expect(Math.abs(L.cash - L.cashStart - flows), `cash flow ${tag}`).toBeLessThan(tol(L.cash) + tol(flows) + 1e-3);
    // clean surplus: the change in equity is exactly the profit
    if (prev) {
      expect(Math.abs(L.cashStart - prev.cash), `continuity ${tag}`).toBeLessThan(1e-3);
      expect(Math.abs(L.equity - prev.equity - L.profit), `equity ${tag}`).toBeLessThan(tol(L.equity) + 1e-3);
    }
    expect(L.inventoryValue).toBeGreaterThanOrEqual(-1e-6);
    prev = L;
  }
}

/** Develop a car and put it into production at `units` per month; returns the model. */
function launch(g: GameState, units: number, body: 'hatch' | 'sedan' = 'hatch'): VehicleModel {
  const p = player(g);
  expect(A.startDevelopment(g, `Car ${p.models.length + 1}`, defaultVehicle(g.year, body), body === 'hatch' ? 'budget' : 'family')).toBeNull();
  const m = p.models[p.models.length - 1];
  let guard = 0;
  while (m.status === 'development' && guard++ < 200) step(g);
  expect(A.addLine(g, p.factories[0].id, m.id, units)).toBeNull();
  return m;
}

describe('inventory, cost of sales, cash flow and profit', () => {
  it('cars built but not yet sold are inventory, not expense', () => {
    const g = founder();
    const p = player(g);
    const m = launch(g, 3000);
    A.setLineTarget(g, p.factories[0].id, m.id, 3000); // build flat out
    A.setPrice(g, m.id, m.price * 3); // far too expensive: almost nothing sells
    const start = p.ledger.length;
    step(g, 4);
    const months = p.ledger.slice(start);
    const built = months.reduce((a, l) => a + l.production, 0);
    const cogs = months.reduce((a, l) => a + l.cogs, 0);
    expect(built).toBeGreaterThan(0);
    expect(cogs).toBeLessThan(built * 0.25);
    expect(m.inventory).toBeGreaterThan(1000);
    // stock is valued at what it cost to build (average over the months it was built)
    expect(m.inventoryValue / m.inventory).toBeGreaterThan(m.lastUnitCost * 0.9);
    expect(m.inventoryValue / m.inventory).toBeLessThan(m.lastUnitCost * 1.1);
    // inventory roll-forward: opening + built − cost of sales = closing
    const open = start > 0 ? p.ledger[start - 1].inventoryValue : 0;
    expect(months[months.length - 1].inventoryValue).toBeCloseTo(open + built - cogs, 0);
    expectBooksBalance(p);
  });

  it('cost of sales is released at the average cost of the stock', () => {
    const g = founder();
    const p = player(g);
    const m = launch(g, 2000);
    step(g, 6);
    for (const L of p.ledger.slice(-4)) {
      if (L.units <= 0) continue;
      const perCar = L.cogs / L.units;
      expect(perCar).toBeGreaterThan(m.lastUnitCost * 0.7);
      expect(perCar).toBeLessThan(m.lastUnitCost * 1.5);
    }
    expect(nonFinitePaths(p)).toEqual([]);
    expectBooksBalance(p);
  });

  it('a full company lifecycle keeps both identities every month', () => {
    const g = founder();
    const p = player(g);
    const m = launch(g, 2500);
    step(g, 3);
    expect(A.takeLoan(g, 50e6)).toBeNull();
    expect(A.investDealers(g, 'NA', 40e6)).toBeNull();
    expect(A.buildFactory(g, 'Second', 'Mexico', 1500, 0.3)).toBeNull();
    expect(A.expandFactory(g, p.factories[0].id, 500)).toBeNull();
    expect(A.upgradeAutomation(g, p.factories[0].id, Math.min(A.maxAutomation(p), p.factories[0].automation + 0.1))).toBeNull();
    expect(A.setEngineers(g, p.engineers + 40)).toBeNull();
    step(g, 2);
    expect(A.establishMotorsport(g, 'touring', 'Test Racing')).toBeNull();
    step(g, 4);
    expect(A.repayLoan(g, 20e6)).toBeNull();
    const m2 = launch(g, 800, 'sedan');
    step(g, 3);
    A.retireModel(g, m.id);
    expect(m.inventory).toBe(0);
    expect(m.inventoryValue).toBe(0);
    step(g, 2);
    expect(A.sellFactory(g, p.factories[1].id)).toBeNull();
    step(g, 14); // through a season end (prize money) and a January roll-over
    expect(m2.status).toBe('production');
    expect(nonFinitePaths(g)).toEqual([]);
    expectBooksBalance(p);
    // the closing balance sheet matches the live company
    const L = p.ledger[p.ledger.length - 1];
    expect(L.inventoryValue).toBeCloseTo(inventoryValue(p), 3);
    expect(L.fixedAssets).toBeCloseTo(fixedAssets(p), 3);
    expect(L.equity).toBeCloseTo(equity(p), 3);
  });

  it('retiring a model clears its stock to fleet buyers and books the result', () => {
    const g = founder();
    const p = player(g);
    const m = launch(g, 3000);
    A.setLineTarget(g, p.factories[0].id, m.id, 3000);
    A.setPrice(g, m.id, m.price * 3);
    step(g, 2);
    const units = m.inventory, value = m.inventoryValue, price = m.price;
    expect(units).toBeGreaterThan(0);
    A.retireModel(g, m.id);
    step(g);
    const L = p.ledger[p.ledger.length - 1];
    expect(L.otherIncome).toBeCloseTo(units * price * 0.88 * A.FLEET_CLEARANCE, 0);
    expect(L.oneOff).toBeGreaterThanOrEqual(value - 1e-6); // write-off of the stock's book value
    expectBooksBalance(p);
  });

  it('selling a plant records the gain or loss against its book value', () => {
    const g = ceo({ makerId: 'toyota', year: 2000, difficulty: 'easy' });
    const p = player(g);
    step(g);
    const f = p.factories[p.factories.length - 1];
    const book = f.bookValue;
    expect(A.sellFactory(g, f.id)).toBeNull();
    step(g);
    const L = p.ledger[p.ledger.length - 1];
    expect(L.investingCash).toBeGreaterThan(0);
    expect(L.assetGains).toBeCloseTo(L.investingCash - book, -3); // proceeds − book value
    expectBooksBalance(p);
  });

  it('an acquisition (cash and debt taken over, plants at fair value, goodwill) leaves equity unchanged', () => {
    const g = ceo({ makerId: 'toyota', year: 2000, difficulty: 'easy' });
    const p = player(g);
    step(g, 2);
    const target = g.companies.find((c) => c.dataId === 'porsche' && c.alive)!;
    const before = equity(p);
    expect(A.acquire(g, target.id)).toBeNull();
    expect(target.alive).toBe(false);
    expect(Math.abs(equity(p) - before)).toBeLessThan(tol(before) + 1);
    step(g, 3);
    expectBooksBalance(p);
  });

  it('a CEO career with events, decisions, motorsport and January roll-overs stays balanced', () => {
    const g = ceo({ makerId: 'ferrari', year: 1988 });
    step(g, 30);
    expect(nonFinitePaths(g)).toEqual([]);
    expectBooksBalance(player(g));
  });

  it('a motorsport team (sponsors, owner funding, prize money) stays balanced', () => {
    const g = motorsport({ discipline: 'gt', year: 2012 });
    const p = player(g);
    step(g, 26);
    expect(p.ledger.some((l) => l.otherIncome > 0)).toBe(true); // end-of-season prize money is in the P&L
    expectBooksBalance(p);
  });
});

describe('save format', () => {
  it(`upgrades a version-1 save to version ${SAVE_VERSION} and keeps it balanced afterwards`, () => {
    const g = founder();
    const p = player(g);
    const m = launch(g, 2000);
    step(g, 3);
    // reproduce a v1 save: none of the accounting fields existed
    const v1 = JSON.parse(JSON.stringify(g)) as Record<string, unknown> & GameState;
    v1.version = 1;
    for (const c of v1.companies) {
      delete (c as Partial<Company>).books;
      for (const f of c.factories) delete (f as Partial<typeof f>).bookValue;
      for (const x of c.models) delete (x as Partial<VehicleModel>).inventoryValue;
      for (const L of c.ledger) for (const k of ['otherIncome', 'oneOff', 'depreciation', 'assetGains', 'production', 'capex', 'operatingCash', 'investingCash', 'financingCash', 'cashStart', 'inventoryValue', 'fixedAssets', 'equity'] as const) delete (L as Partial<MonthLedger>)[k];
    }
    const up = prepareLoadedGame(JSON.parse(JSON.stringify(v1)));
    expect(up.version).toBe(SAVE_VERSION);
    const q = player(up);
    const mm = q.models.find((x) => x.id === m.id)!;
    expect(mm.inventoryValue).toBeCloseTo(mm.inventory * mm.lastUnitCost, 3);
    expect(q.factories.every((f) => f.bookValue > 0)).toBe(true);
    expect(nonFinitePaths(up)).toEqual([]);
    // legacy ledger lines carry no balance sheet; the books open at the moment of migration
    const opening = { cash: q.cash, equity: equity(q) };
    const from = q.ledger.length;
    step(up, 6);
    expectBooksBalance(q, from, opening);
    void p;
  });
  it('rejects saves from a newer format and data that is not a save', () => {
    const g = founder();
    expect(() => prepareLoadedGame({ ...JSON.parse(JSON.stringify(g)), version: SAVE_VERSION + 1 })).toThrow(/newer version/);
    expect(() => prepareLoadedGame({ hello: 'world' })).toThrow(/not an Automotive Empire save/);
    expect(() => prepareLoadedGame(null)).toThrow();
  });
});
