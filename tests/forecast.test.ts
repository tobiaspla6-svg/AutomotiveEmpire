// Decision feedback (Phase 2): impact estimates are honest — read-only, reproducible, and they match
// what happens when the decision is actually taken from the same state.
import { describe, expect, it } from 'vitest';
import * as A from '../src/sim/actions';
import { forecast } from '../src/sim/forecast';
import { defaultVehicle } from '../src/sim/engineering';
import { factoryBuildCost } from '../src/sim/company';
import type { GameState } from '../src/sim/types';
import { ceo, founder, player, step } from './helpers';

function onSale(): GameState {
  const g = founder({ year: 2008 });
  A.investDealers(g, 'EU', 200e6);
  const p = player(g);
  A.startDevelopment(g, 'Base', defaultVehicle(2008, 'hatch'), 'budget');
  const m = p.models[0];
  while (m.status === 'development') step(g);
  A.addLine(g, p.factories[0].id, m.id, 1200);
  step(g, 3);
  return g;
}

describe('impact forecasts', () => {
  it('never change the real game and give the same answer twice', () => {
    const g = onSale();
    const before = JSON.stringify(g);
    const a = forecast(g, (gg) => A.buildFactory(gg, 'East', 'Spain', 2000, 0.4), 12);
    const b = forecast(g, (gg) => A.buildFactory(gg, 'East', 'Spain', 2000, 0.4), 12);
    expect(JSON.stringify(g)).toBe(before);
    expect(a).toEqual(b);
  });
  it('a refused decision reports the reason and no impact', () => {
    const g = onSale();
    const r = forecast(g, (gg) => A.takeLoan(gg, NaN));
    expect(r.error).toBeTruthy();
    expect(r.upfront).toBe(0);
  });
  it('a new plant: the up-front cost is its investment, and the forecast matches what then happens', () => {
    const g = onSale();
    const p = player(g);
    const cost = factoryBuildCost(2000, 0.4, g.year);
    const est = forecast(g, (gg) => A.buildFactory(gg, 'East', 'Spain', 2000, 0.4), 6);
    expect(est.error).toBeNull();
    expect(est.upfront).toBeCloseTo(cost, -3);
    expect(est.netCash).toBeLessThan(-cost * 0.95);
    expect(est.after.debt).toBeGreaterThanOrEqual(est.before.debt);
    // take the decision for real from the same state: the outcome equals the forecast
    const real = JSON.parse(JSON.stringify(g)) as GameState, base = JSON.parse(JSON.stringify(g)) as GameState;
    expect(A.buildFactory(real, 'East', 'Spain', 2000, 0.4)).toBeNull();
    for (let i = 0; i < 6; i++) { real.decision = null; base.decision = null; step(real); step(base); }
    const net = (x: GameState) => player(x).cash - player(x).debt;
    expect(net(real) - net(base)).toBeCloseTo(est.netCash, -3);
    void p;
  });
  it('a loan raises debt by its amount and costs interest every month', () => {
    const g = onSale();
    const est = forecast(g, (gg) => A.takeLoan(gg, 50e6), 12);
    expect(est.error).toBeNull();
    expect(est.after.debt - est.before.debt).toBeGreaterThan(45e6);
    expect(est.monthlyProfit).toBeLessThan(0); // interest
    expect(est.monthlyProfit).toBeGreaterThan(-3e6);
  });
  it('hiring engineers: a recruitment cost now and a higher wage bill every month', () => {
    const g = onSale();
    const p = player(g);
    const est = forecast(g, (gg) => A.setEngineers(gg, p.engineers + 200), 6);
    expect(est.upfront).toBeGreaterThan(0);
    expect(est.monthlyProfit).toBeLessThan(0);
  });
  it('warns when a decision would push the company past its credit limit', () => {
    const g = ceo({ makerId: 'jaguar', year: 2008 });
    const p = player(g);
    // borrow everything the lenders allow, then keep building plants until refused
    const est = forecast(g, (gg) => { const q = player(gg); for (let i = 0; i < 12; i++) { const e = A.buildFactory(gg, `P${i}`, 'UK', 3000, 0.5); if (e) { if (!i) return e; break; } } void q; return null; }, 12);
    expect(est.error).toBeNull();
    expect(est.after.headroom).toBeLessThan(est.before.headroom);
    expect(est.risks.length).toBeGreaterThan(0);
    void p;
  });
});
