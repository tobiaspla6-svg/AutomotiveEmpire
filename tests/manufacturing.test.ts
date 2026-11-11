import { describe, expect, it } from 'vitest';
import * as A from '../src/sim/actions';
import { defaultVehicle } from '../src/sim/engineering';
import { unitCost } from '../src/sim/company';
import { REGION_IDS } from '../src/data/world';
import type { GameState, VehicleModel } from '../src/sim/types';
import { founder, player, step } from './helpers';

function developed(g: GameState): VehicleModel {
  const p = player(g);
  A.startDevelopment(g, 'Probe', defaultVehicle(g.year, 'hatch'), 'budget');
  const m = p.models[p.models.length - 1];
  while (m.status === 'development') step(g);
  return m;
}

describe('manufacturing', () => {
  it('a new line ramps up from 30 % and never builds more than its capacity', () => {
    const g = founder();
    const p = player(g);
    const m = developed(g);
    const f = p.factories[0];
    expect(A.addLine(g, f.id, m.id, 2000)).toBeNull();
    A.setLineTarget(g, f.id, m.id, 1e9); // ask for more than the line can make
    A.setPrice(g, m.id, m.price * 4); // and sell almost nothing, so stock piles up
    const built: number[] = [];
    for (let i = 0; i < 6; i++) {
      const before = m.cumulativeUnits;
      step(g);
      built.push(m.cumulativeUnits - before);
    }
    const ramp = [0.3, 0.5, 0.7, 0.9, 1, 1];
    built.forEach((n, i) => expect(n).toBeLessThanOrEqual(2000 * ramp[i] * 1.0001 + 1e-6));
    expect(built[0]).toBeCloseTo(600, 0);
    // full rate is reached once ramped up (random supply disruptions may cut individual months to 25 %)
    expect(Math.max(...built.slice(4))).toBeCloseTo(2000, 0);
  });

  it('sales never exceed demand or the cars available', () => {
    const g = founder();
    const p = player(g);
    const m = developed(g);
    A.addLine(g, p.factories[0].id, m.id, 300); // small line, demand will outstrip it
    for (let i = 0; i < 10; i++) {
      const stockBefore = m.inventory, builtBefore = m.cumulativeUnits;
      step(g);
      const sold = REGION_IDS.reduce((a, r) => a + m.lastSales[r], 0);
      const available = stockBefore + (m.cumulativeUnits - builtBefore);
      expect(sold).toBeLessThanOrEqual(m.lastDemand + 1e-6);
      expect(sold).toBeLessThanOrEqual(available + 1e-6);
      expect(m.inventory).toBeGreaterThanOrEqual(0);
    }
  });

  it('unit cost falls with volume and with automation, and rises with wages', () => {
    const g = founder();
    const m = developed(g);
    const base = { country: 'Germany', automation: 0.3 };
    expect(unitCost(g, m, base, 5000)).toBeLessThan(unitCost(g, m, base, 50));
    expect(unitCost(g, m, { ...base, automation: 0.8 }, 1000)).toBeLessThan(unitCost(g, m, base, 1000));
    expect(unitCost(g, m, { ...base, country: 'Mexico' }, 1000)).toBeLessThan(unitCost(g, m, base, 1000));
  });

  it('a new plant produces nothing for 15 months; an expansion adds capacity after 9', () => {
    const g = founder();
    const p = player(g);
    expect(A.buildFactory(g, 'New', 'Spain', 800, 0.2)).toBeNull();
    const f = p.factories[1];
    expect(f.capacity).toBe(0);
    step(g, 14);
    expect(f.capacity).toBe(0);
    step(g, 1);
    expect(f.capacity).toBe(800);
    expect(A.expandFactory(g, f.id, 400)).toBeNull();
    step(g, 8);
    expect(f.capacity).toBe(800);
    step(g, 1);
    expect(f.capacity).toBe(1200);
  });
});
