// Phase 4F: industrial growth. Pins the two rule fixes found by the audit (parts are priced on the cars built, not on
// idle tooling; a dealer network cannot reach more buyers than a segment has) and the hard difficulty's non-financial
// handicaps (longer construction, slower brand building, rivals that defend their sales).
import { describe, expect, it } from 'vitest';
import * as A from '../src/sim/actions';
import { capitalOptions, newFounderGame, player } from '../src/sim/world';
import { playerCoverage, segVolume } from '../src/sim/market';
import { scaleProbe } from '../scripts/audit-scale-volume';
import { grow } from '../scripts/audit-industrial-strategies';
import { founder, step, ceo } from './helpers';

describe('volume discounts come from the cars built', () => {
  it('a line tooled for 3,000 a month that builds 400 pays what a 600-a-month line building 400 pays', () => {
    const small = scaleProbe(600), big = scaleProbe(3000);
    expect(big.built).toBeCloseTo(small.built, 0);
    expect(Math.abs(big.unitCost / small.unitCost - 1)).toBeLessThan(0.01);
    expect(big.operating).toBeLessThan(small.operating); // the idle tooling only adds depreciation
  }, 60000);
});

describe('distribution saturates at the size of the segment (player only)', () => {
  it('a small network counts in full, one as large as the segment 63 %, ten times the segment at most the segment', () => {
    const g = founder({ year: 2015 }), p = player(g);
    const V = segVolume('EU', 'sports', 2015);
    expect(playerCoverage(p, V * 0.01, 'EU', 'sports', 2015) / (V * 0.01)).toBeGreaterThan(0.99);
    expect(playerCoverage(p, V, 'EU', 'sports', 2015) / V).toBeCloseTo(1 - Math.exp(-1), 5);
    expect(playerCoverage(p, V * 10, 'EU', 'sports', 2015)).toBeLessThanOrEqual(V);
    const ai = g.companies.find((c) => !c.isPlayer)!;
    expect(playerCoverage(ai, V * 10, 'EU', 'sports', 2015)).toBe(V * 10); // AI reach is its own sales volume: untouched
  });
  it('a one-model sports maker cannot take most of its home segment by buying dealers', () => {
    const r = grow({ year: 2015, product: 'sports', capital: 3, factory: 2, difficulty: 'normal' }, 'S2');
    const y20 = r.years[19];
    expect(y20.units).toBeLessThan(segVolume('EU', 'sports', 2035) * 0.3);
    expect(y20.operating).toBeGreaterThan(0); // growing a sports maker still pays
  }, 120000);
});

describe('industrial decisions have consequences', () => {
  it('sports car at full capacity: expanding beats holding over 20 years; building far ahead of demand on medium capital fails', () => {
    const hold = grow({ year: 2015, product: 'sports', capital: 2, factory: 2, difficulty: 'normal' }, 'H');
    const s1 = grow({ year: 2015, product: 'sports', capital: 2, factory: 2, difficulty: 'normal' }, 'S1');
    const s3 = grow({ year: 2015, product: 'sports', capital: 2, factory: 2, difficulty: 'normal' }, 'S3');
    expect(s1.years[19].equity).toBeGreaterThan(hold.years[19].equity * 2);
    expect(s3.bankrupt).toBe(true);
  }, 120000);
  it('budget car: selling more from a small plant loses money; scale is what makes it pay', () => {
    const hold = grow({ year: 2015, product: 'mass', capital: 2, factory: 2, difficulty: 'normal' }, 'H');
    const big = grow({ year: 2015, product: 'mass', capital: 2, factory: 2, difficulty: 'normal' }, 'S3');
    expect(hold.years[9].operating).toBeLessThan(0);
    expect(big.years[9].operating).toBeGreaterThan(0);
    expect(big.years[9].unitCost).toBeLessThan(hold.years[9].unitCost * 0.85);
  }, 120000);
});

describe('hard difficulty without taking money away', () => {
  const pair = (difficulty: 'normal' | 'hard') => newFounderGame({ name: 'T', country: 'Germany', year: 2015, capital: capitalOptions(2015)[2], specialization: 'sports', factory: 2, engineers: 1, research: 1, workforce: 1, color: '#123456', difficulty, historyMode: 'alternative', seed: 9 });
  it('construction takes a quarter longer', () => {
    const n = pair('normal'), h = pair('hard');
    expect(A.buildMonths(n, 'plant')).toBe(15); expect(A.buildMonths(h, 'plant')).toBe(19);
    expect(A.buildMonths(n, 'expansion')).toBe(9); expect(A.buildMonths(h, 'expansion')).toBe(11);
    expect(A.buildMonths(h, 'stage')).toBe(8);
    expect(A.expandFactory(h, player(h).factories[0].id, 300)).toBeNull();
    expect(player(h).factories[0].expansion!.monthsLeft).toBe(11);
  });
  it('the same capital, and a brand that buyers get to know more slowly', () => {
    const n = pair('normal'), h = pair('hard');
    expect(player(h).cash).toBe(player(n).cash);
    const a0n = player(n).awareness.EU, a0h = player(h).awareness.EU;
    step(n, 12); step(h, 12);
    expect(player(h).awareness.EU - a0h).toBeLessThan(player(n).awareness.EU - a0n);
  });
  it('the rivals stay in business on hard', () => {
    const g = ceo({ makerId: 'toyota', year: 2000, difficulty: 'hard' });
    step(g, 24);
    expect(g.companies.filter((c) => !c.isPlayer && c.alive).length).toBe(g.companies.filter((c) => !c.isPlayer).length);
  });
});
