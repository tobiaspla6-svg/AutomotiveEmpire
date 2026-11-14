// Phase 4E: founder economics. The demand model is unchanged; what changed is how the game guides a new maker (the first
// design it proposes, the studio's cost-versus-worth warning, the idle-engineers insight, the "sell what your lines can
// build" step) and the hard difficulty's entry barriers. These tests pin those changes and the two properties the
// calibration must keep: better commercial decisions do better, and the hard difficulty is harder.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import * as A from '../src/sim/actions';
import { capitalOptions, newFounderGame, player } from '../src/sim/world';
import { computeVehicle, defaultVehicle, starterVehicle } from '../src/sim/engineering';
import { missingTechs } from '../src/data/tech';
import { valuePrice } from '../src/sim/market';
import { headOffice, unitCost } from '../src/sim/company';
import { cpi } from '../src/sim/util';
import { companyInsights } from '../src/sim/insights';
import { onboardingSteps } from '../src/sim/onboarding';
import { setLang } from '../src/i18n';
import { useStore } from '../src/store/game';
import { Studio } from '../src/ui/Studio';
import { play } from '../scripts/audit-founder-strategies';
import { founder, step } from './helpers';

const newFounder = (year: number, sp: string, difficulty: 'normal' | 'hard' = 'normal') =>
  newFounderGame({ name: 'T', country: 'Germany', year, capital: capitalOptions(year)[2], specialization: sp, factory: 2, engineers: 1, research: 1, workforce: 1, color: '#123456', difficulty, historyMode: 'alternative', seed: 42 });
const newFounderGameWith = (factory: number) => newFounderGame({ name: 'T', country: 'Germany', year: 2015, capital: capitalOptions(2015)[3], specialization: 'mass', factory, engineers: 1, research: 1, workforce: 1, color: '#123456', difficulty: 'normal', historyMode: 'alternative', seed: 42 });
/** Break-even list price at 480 cars a month in a conventional German plant, over the car's value price in `segment`. */
function costOverWorth(year: number, sp: string, spec: ReturnType<typeof defaultVehicle>, segment: 'budget' | 'sports' | 'premium' | 'suv') {
  const g = newFounder(year, sp); const p = player(g);
  const stats = computeVehicle(spec, { year, tech: p.tech });
  const m = { stats, segment, spec, frozenTech: p.tech, designYear: year, cumulativeUnits: 0 } as never;
  return unitCost(g, m, { country: 'Germany', automation: 0.3 }, 480) / 0.88 / valuePrice(m, p, year);
}

describe('the first design a founder is offered', () => {
  for (const sp of ['mass', 'sports', 'luxury', 'offroad', 'ev']) {
    it(`${sp}: a valid design the founder has the technology for, in every era it can start`, () => {
      for (const year of sp === 'ev' ? [2008, 2020, 2035] : [1950, 1965, 1990, 2015, 2035]) {
        const s = starterVehicle(year, sp);
        expect(A.validateSpec(s), `${sp} ${year}`).toEqual([]);
        expect(missingTechs(s, player(newFounder(year, sp)).tech), `${sp} ${year}`).toEqual([]);
      }
    });
  }
  it('the affordable-cars starter costs less to build, relative to what budget buyers pay, than the generic default', () => {
    for (const year of [1965, 1990, 2015]) expect(costOverWorth(year, 'mass', starterVehicle(year, 'mass'), 'budget')).toBeLessThan(costOverWorth(year, 'mass', defaultVehicle(year, 'hatch'), 'budget') * 0.9);
  });
  it('...but it is still harder to build a cheap car at small volume in 2015 than in 1965 (no flattening of eras)', () => {
    expect(costOverWorth(2015, 'mass', starterVehicle(2015, 'mass'), 'budget')).toBeGreaterThan(costOverWorth(1965, 'mass', starterVehicle(1965, 'mass'), 'budget') * 1.2);
  });
  it('rules of the game are untouched: the generic default design is the same as before', () => {
    const s = defaultVehicle(2015, 'sedan');
    expect([s.body, s.quality, s.interior, s.engine.displacement]).toEqual(['sedan', 0.5, 'standard', 1800]);
  });
});

describe('information for the player', () => {
  beforeAll(() => {
    const mem = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  });
  const studioHtml = (spec: ReturnType<typeof defaultVehicle>, lang: 'en' | 'es' = 'en') => {
    const g = founder({ year: 2015 });
    useStore.getState().start(g); setLang(lang);
    Object.assign(useStore.getInitialState(), useStore.getState());
    const html = renderToString(createElement(Studio, { init: spec, initName: 'Test', onClose: () => undefined }));
    setLang('en');
    return html;
  };
  it('the studio says when a design costs more to build than its buyers think it is worth (EN and ES)', () => {
    const rich = defaultVehicle(2015, 'hatch'); rich.quality = 1; rich.interior = 'luxury';
    expect(studioHtml(rich)).toContain('data-warn="cost-above-worth"');
    expect(studioHtml(rich, 'es')).toContain('solo para cubrir costes');
  });
  it('an idle engineering team is reported with its yearly cost; a busy one is not', () => {
    const g = newFounder(2015, 'sports'); const p = player(g);
    step(g, 3);
    const idle = companyInsights(g, p).find((i) => i.kind === 'idleEngineers');
    expect(idle).toBeDefined();
    expect(Number(idle!.args.have)).toBe(p.engineers);
    expect(Number(idle!.args.cost)).toBeGreaterThan(0);
    expect(A.startDevelopment(g, 'Busy', starterVehicle(2015, 'sports'), 'sports')).toBeNull();
    expect(companyInsights(g, p).some((i) => i.kind === 'idleEngineers')).toBe(false);
  });
  it('interest on the founding capital does not complete the "operating profit" step', () => {
    const g = newFounder(1990, 'sports'); const p = player(g);
    step(g, 6); // 1990: high interest rates, a large cash pile, no cars
    expect(p.ledger.some((l) => l.profit > 0)).toBe(true);
    expect(onboardingSteps(g, p).find((s) => s.id === 'profit')!.done).toBe(false);
  });
});

describe('head-office overhead scales with the size of the maker', () => {
  it('a volume maker pays what it always paid; a workshop pays a fifth; nothing pays more than before', () => {
    const big = player(newFounderGameWith(3)), small = player(newFounderGameWith(1)), mid = player(newFounderGameWith(2));
    expect(headOffice(big, 2015)).toBeCloseTo(0.4e6 * cpi(2015));   // 5,000 a month: unchanged
    expect(headOffice(small, 2015)).toBeCloseTo(0.4e6 * cpi(2015) * 0.2); // 60 a month: the floor
    expect(headOffice(mid, 2015)).toBeGreaterThan(headOffice(small, 2015));
    expect(headOffice(mid, 2015)).toBeLessThan(headOffice(big, 2015));
  });
});

describe('difficulty', () => {
  it('hard: the same founder starts less known, with fewer dealers, and dealers cost more', () => {
    const n = player(newFounder(2015, 'sports', 'normal')), h = player(newFounder(2015, 'sports', 'hard'));
    expect(h.awareness[h.homeRegion]).toBeLessThan(n.awareness[n.homeRegion]);
    expect(h.reach[h.homeRegion]).toBeLessThan(n.reach[n.homeRegion]);
    expect(h.cash).toBe(n.cash); // no money taken away
    const gn = newFounder(2015, 'sports', 'normal'), gh = newFounder(2015, 'sports', 'hard');
    expect(A.dealerCostPerUnit(gh, player(gh), 'EU')).toBeCloseTo(A.dealerCostPerUnit(gn, player(gn), 'EU') * A.HARD_DEALER_COST);
  });
});

describe('decisions matter, nothing is guaranteed (10-year founder runs)', () => {
  it('2015 sports founder: the reasonable strategy outsells and out-earns the basic one; hard is harder', { timeout: 120000 }, () => {
    const a = play(2015, 1, 'sports', 'normal', 'A'), b = play(2015, 1, 'sports', 'normal', 'B'), bh = play(2015, 1, 'sports', 'hard', 'B');
    expect(b.y10!.units).toBeGreaterThan(a.y10!.units * 5);
    expect(b.y10!.operating).toBeGreaterThan(a.y10!.operating);
    expect(bh.y10!.operating).toBeLessThan(b.y10!.operating);
  });
  it('2015 budget-car founder with the generic design loses money even with dealers: a reasonable strategy is not a guarantee', { timeout: 120000 }, () => {
    const b = play(2015, 1, 'mass', 'normal', 'B');
    expect(b.y10!.operating).toBeLessThan(0);
  });
});
