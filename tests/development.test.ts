import { describe, expect, it } from 'vitest';
import { cancelDevelopment, startDevelopment, setEngineers } from '../src/sim/actions';
import { defaultVehicle } from '../src/sim/engineering';
import type { GameState, VehicleModel } from '../src/sim/types';
import { founder, player, step } from './helpers';

/** Develop to completion and return the model plus the 'dev' expense recorded in the ledger. */
function develop(g: GameState, m: VehicleModel) {
  const p = player(g);
  const start = p.ledger.length;
  let guard = 0;
  while (m.status === 'development' && guard++ < 400) step(g);
  return { ledgerDev: p.ledger.slice(start).reduce((a, l) => a + l.dev, 0), months: p.ledger.length - start };
}

describe('development budget reconciliation', () => {
  it('a programme costs exactly its approved budget, all of it through the P&L', () => {
    const g = founder();
    const p = player(g);
    const cash0 = p.cash;
    expect(startDevelopment(g, 'Probe', defaultVehicle(2000, 'hatch'), 'budget')).toBeNull();
    const m = p.models[0];
    expect(p.cash).toBe(cash0); // approval itself moves no money outside the ledger
    const budget = m.devCostTotal;
    const { ledgerDev } = develop(g, m);
    expect(m.status).toBe('ready');
    expect(m.devCostPaid / budget).toBeCloseTo(1, 9);
    expect(ledgerDev / budget).toBeCloseTo(1, 9);
  });

  for (const [label, engineers] of [['understaffed (slower)', 6], ['overstaffed (faster)', 4000]] as const) {
    it(`${label}: duration changes, total cost does not`, () => {
      const g = founder();
      const p = player(g);
      expect(setEngineers(g, engineers)).toBeNull();
      startDevelopment(g, 'Probe', defaultVehicle(2000, 'sedan'), 'family');
      const m = p.models[0];
      const { ledgerDev, months } = develop(g, m);
      expect(ledgerDev / m.devCostTotal).toBeCloseTo(1, 9);
      if (engineers < 10) expect(months).toBeGreaterThan(m.devMonthsTotal);
      else expect(months).toBeLessThan(m.devMonthsTotal);
    });
  }

  it('concurrent programmes each reconcile, and the ledger equals their sum', () => {
    const g = founder();
    const p = player(g);
    startDevelopment(g, 'A', defaultVehicle(2000, 'hatch'), 'budget');
    startDevelopment(g, 'B', defaultVehicle(2000, 'suv'), 'suv');
    const [a, b] = p.models;
    const start = p.ledger.length;
    let guard = 0;
    while ((a.status === 'development' || b.status === 'development') && guard++ < 400) step(g);
    const ledgerDev = p.ledger.slice(start).reduce((x, l) => x + l.dev, 0);
    expect(a.devCostPaid / a.devCostTotal).toBeCloseTo(1, 9);
    expect(b.devCostPaid / b.devCostTotal).toBeCloseTo(1, 9);
    expect(ledgerDev / (a.devCostTotal + b.devCostTotal)).toBeCloseTo(1, 9);
  });

  it('a new generation re-using platform and engine is cheaper, and still reconciles', () => {
    const g = founder();
    const p = player(g);
    const spec = defaultVehicle(2000, 'hatch');
    startDevelopment(g, 'Gen1', spec, 'budget');
    develop(g, p.models[0]);
    const first = p.models[0];
    expect(startDevelopment(g, 'Gen2', { ...spec, quality: spec.quality }, 'budget', first.id)).toBeNull();
    const second = p.models[1];
    expect(second.generation).toBe(2);
    expect(second.devCostTotal).toBeLessThan(first.devCostTotal * 0.5);
    const { ledgerDev } = develop(g, second);
    expect(ledgerDev / second.devCostTotal).toBeCloseTo(1, 9);
  });

  it('cancelling keeps the money already spent and charges nothing more', () => {
    const g = founder();
    const p = player(g);
    startDevelopment(g, 'Probe', defaultVehicle(2000, 'hatch'), 'budget');
    const m = p.models[0];
    step(g, 5);
    const spent = m.devCostPaid;
    const recorded = p.ledger.reduce((a, l) => a + l.dev, 0);
    expect(recorded).toBeCloseTo(spent, 3);
    cancelDevelopment(g, m.id);
    step(g, 3);
    expect(p.ledger.slice(-3).reduce((a, l) => a + l.dev, 0)).toBe(0);
    expect(p.models).toHaveLength(0);
  });

  it('an old save with a partly paid programme (previous 61.75 % scheme) completes at the full budget', () => {
    const g = founder();
    const p = player(g);
    startDevelopment(g, 'Probe', defaultVehicle(2000, 'hatch'), 'budget');
    const m = p.models[0];
    // state as the old code left it after approval: 6.75 % paid up front outside the ledger
    m.devCostPaid = m.devCostTotal * 0.0675;
    const { ledgerDev } = develop(g, m);
    expect(m.devCostPaid / m.devCostTotal).toBeCloseTo(1, 9);
    expect((ledgerDev + m.devCostTotal * 0.0675) / m.devCostTotal).toBeCloseTo(1, 9);
  });
});
