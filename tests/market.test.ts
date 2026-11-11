import { describe, expect, it } from 'vitest';
import { computeMarket, segVolume } from '../src/sim/market';
import { REGION_IDS, SEGMENT_IDS } from '../src/data/world';
import { ceo, founder, step } from './helpers';

describe('market demand conservation', () => {
  for (const [label, make] of [['CEO 1985', () => ceo()], ['CEO 2015 Toyota', () => ceo({ makerId: 'toyota', year: 2015 })], ['Founder 2000', () => founder()]] as const) {
    it(`${label}: every unit of segment demand goes to a modelled car or to "other"`, () => {
      const g = make();
      step(g, 2);
      const mk = computeMarket(g);
      for (const r of REGION_IDS) for (const s of SEGMENT_IDS) {
        const cell = mk.cells[`${r}:${s}`];
        const allocated = cell.entries.reduce((a, e) => a + e.demand, 0) + cell.other;
        expect(Number.isFinite(allocated)).toBe(true);
        expect(allocated).toBeCloseTo(cell.volume, 6);
        for (const e of cell.entries) expect(e.demand).toBeGreaterThanOrEqual(0);
      }
      // per-model demand adds up to the cell entries
      let fromModels = 0, fromCells = 0;
      for (const rec of mk.demand.values()) for (const r of REGION_IDS) fromModels += rec[r];
      for (const cell of Object.values(mk.cells)) for (const e of cell.entries) fromCells += e.demand;
      expect(fromModels).toBeCloseTo(fromCells, 4);
    });
  }
  it('segment volumes add up to the regional market', () => {
    for (const y of [1950, 1985, 2020, 2026]) for (const r of REGION_IDS) {
      const total = SEGMENT_IDS.reduce((a, s) => a + segVolume(r, s, y), 0);
      expect(total).toBeGreaterThan(0);
      expect(Number.isFinite(total)).toBe(true);
    }
  });
});
