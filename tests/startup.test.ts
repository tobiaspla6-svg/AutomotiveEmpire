import { describe, expect, it } from 'vitest';
import { MAKERS, makerStart } from '../src/data/manufacturers';
import { DISCIPLINES } from '../src/sim/racing/regs';
import { annualUnits } from '../src/sim/company';
import { ceo, founder, motorsport, nonFinitePaths, player, step } from './helpers';

describe('Mode 1 — Historical CEO starts for every manufacturer', () => {
  for (const def of MAKERS) {
    const years = [...new Set([makerStart(def), Math.max(makerStart(def), 1990), 2020])];
    for (const year of years) {
      it(`${def.name} ${year}`, () => {
        const g = ceo({ makerId: def.id, year });
        const p = player(g);
        expect(p.dataId).toBe(def.id);
        expect(p.isPlayer).toBe(true);
        expect(p.models.filter((m) => m.status === 'production').length).toBeGreaterThan(0);
        expect(p.factories.length).toBeGreaterThan(0);
        expect(p.board?.objectives.length).toBeGreaterThan(0);
        expect(nonFinitePaths(g)).toEqual([]);
        step(g, 3);
        expect(nonFinitePaths(g)).toEqual([]);
      });
    }
  }
  it('manufacturers start from distinct conditions', () => {
    const a = player(ceo({ makerId: 'ferrari', year: 1990 })), b = player(ceo({ makerId: 'toyota', year: 1990 }));
    expect(b.baseVolume).toBeGreaterThan(a.baseVolume * 100);
    expect(a.prestige).toBeGreaterThan(b.prestige);
    expect(b.factories.length).toBeGreaterThan(a.factories.length);
  });
});

describe('Mode 2 — Company Founder', () => {
  it('starts with no products and the chosen plant', () => {
    const g = founder();
    const p = player(g);
    expect(p.models).toHaveLength(0);
    expect(p.factories).toHaveLength(1);
    expect(p.cash).toBeGreaterThan(0);
    expect(p.dataId).toBeNull();
    step(g, 6);
    expect(annualUnits(p)).toBe(0);
    expect(nonFinitePaths(g)).toEqual([]);
  });
});

describe('Mode 3 — Motorsport Director starts in every discipline', () => {
  for (const d of DISCIPLINES) {
    for (const year of [d.from, 2024]) {
      it(`${d.name} ${year}`, () => {
        const g = motorsport({ discipline: d.id, year });
        const p = player(g);
        const div = p.motorsport!;
        expect(div).toBeTruthy();
        expect(div.championship.teams.some((t) => t.isPlayer)).toBe(true);
        expect(div.championship.rounds.length).toBeGreaterThan(5);
        expect(p.models).toHaveLength(0);
        expect(nonFinitePaths(g)).toEqual([]);
      });
    }
  }
});
