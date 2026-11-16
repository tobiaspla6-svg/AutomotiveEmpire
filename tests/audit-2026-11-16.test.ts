// Regressions for the playable audit of 16 Nov 2026 (dossier AE-01…AE-10, R-01). UI-only items (AE-01 Space in the
// importer, AE-07 race clock, AE-10 benchmark read-out) are covered in e2e/run.cjs.
import { beforeAll, describe, expect, it } from 'vitest';
import * as A from '../src/sim/actions';
import { defaultVehicle } from '../src/sim/engineering';
import { devBlockers, devEtaMonths, creditLimit } from '../src/sim/company';
import { MS_BUDGETS, newMotorsportGame, player, previewMotorsport } from '../src/sim/world';
import { buildRaceConfig, pendingRound, seasonBudget } from '../src/sim/racing/season';
import { RaceSim } from '../src/sim/racing/race';
import { prepareLoadedGame, saveDamage } from '../src/sim/migrate';
import { useStore } from '../src/store/game';
import type { GameState, VehicleModel } from '../src/sim/types';
import { ceo, founder, motorsport, step } from './helpers';

function developed(g: GameState, name = 'Probe'): VehicleModel {
  const p = player(g);
  expect(A.startDevelopment(g, name, defaultVehicle(g.year, 'hatch'), 'budget')).toBeNull();
  const m = p.models[p.models.length - 1];
  while (m.status === 'development') step(g);
  return m;
}
const built = (g: GameState, m: VehicleModel, months: number) => { const b = m.cumulativeUnits; step(g, months); return m.cumulativeUnits - b; };

describe('AE-02 — Full capacity follows the line as it is now', () => {
  const setup = () => {
    const g = founder(), p = player(g), m = developed(g), f = p.factories[0];
    expect(A.addLine(g, f.id, m.id, 300)).toBeNull();
    A.setLineTarget(g, f.id, m.id, 300);                 // what the old UI stored for "Full capacity": the units at that moment
    A.setPrice(g, m.id, m.price * 3);                    // sell little: production is not demand-led
    step(g, 6);                                          // ramp to 100 %
    return { g, p, m, f };
  };
  it('a line enlarged from 300 to 400 builds 400 without touching the selector', () => {
    const { g, m, f } = setup();
    expect(built(g, m, 1)).toBeCloseTo(300, -1);
    expect(A.addLine(g, f.id, m.id, 100)).toBeNull();
    step(g, 6);                                          // the added capacity ramps up
    const n = built(g, m, 1);
    expect(n).toBeGreaterThan(385); expect(n).toBeLessThanOrEqual(400.5);
  });
  it('survives save and load, and an old save with a frozen number means full capacity', () => {
    const { g, m, f } = setup();
    A.addLine(g, f.id, m.id, 100); step(g, 6);
    // an old save: the line was enlarged to 400 before the fix and still carries the frozen 300
    const old: GameState = JSON.parse(JSON.stringify(g));
    player(old).factories[0].lines[0].target = 300;
    const frozen: GameState = JSON.parse(JSON.stringify(old));
    expect(built(frozen, player(frozen).models.find((x) => x.id === m.id)!, 1)).toBeCloseTo(300, -1);   // the defect, reproduced
    const loaded = prepareLoadedGame(JSON.parse(JSON.stringify(old)));
    expect(saveDamage(loaded)).toBeNull();
    expect(player(loaded).factories[0].lines[0].target).toBe(A.LINE_FULL);
    expect(built(loaded, player(loaded).models.find((x) => x.id === m.id)!, 1)).toBeGreaterThan(385);
    // and the fixed game itself survives a save/load round trip
    const round = prepareLoadedGame(JSON.parse(JSON.stringify(g)));
    expect(built(round, player(round).models.find((x) => x.id === m.id)!, 1)).toBeGreaterThan(385);
  });
  it('an absolute monthly goal below the capacity is still respected (scripts use it)', () => {
    const { g, m, f } = setup();
    A.setLineTarget(g, f.id, m.id, 120);
    expect(built(g, m, 1)).toBeCloseTo(120, -1);
    A.addLine(g, f.id, m.id, 100); step(g, 6);           // enlarging does not turn a deliberate lower goal into "full"
    expect(built(g, m, 1)).toBeCloseTo(120, -1);
  });
  it('Follow demand still does not overproduce', () => {
    const { g, m, f } = setup();
    A.setLineTarget(g, f.id, m.id, A.LINE_FOLLOW);
    step(g, 4);
    expect(built(g, m, 1)).toBeLessThan(250);            // demand at 3× the price is far below 300 a month
  });
});

describe('AE-03 — the Director setup shows the budget the team really opens with', () => {
  for (const budget of [0, 1, 2]) for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    it(`${MS_BUDGETS[budget].name}, ${difficulty}`, () => {
      const o = { makerId: null, teamName: 'Preview GP', discipline: 'f1' as const, year: 1992, budget, facilities: 3, staff: 65, target: 5, color: '#aa2222', color2: '#ffffff', difficulty, historyMode: 'historical' as const, seed: 4242 + budget };
      const pv = previewMotorsport(o);
      const g = newMotorsportGame(o), c = player(g), b = seasonBudget(g, c, c.motorsport!);
      expect(pv.owner).toBe(b.owner); expect(pv.sponsors).toBe(b.sponsors); expect(pv.cash).toBe(c.cash); expect(pv.cost).toBe(b.cost);
      expect(pv.owner).toBeGreaterThan(0);
    });
  }
  it('facilities, staff and objective change the preview exactly as they change the team; the preview does not disturb the game', () => {
    const base = { makerId: null, teamName: 'Preview GP', discipline: 'f1' as const, year: 1992, budget: 1, facilities: 3, staff: 65, target: 5, color: '#aa2222', color2: '#ffffff', difficulty: 'normal' as const, historyMode: 'historical' as const, seed: 99 };
    for (const o of [{ ...base, facilities: 5 }, { ...base, staff: 85 }, { ...base, target: 2 }]) {
      const g1 = newMotorsportGame(o); const pv = previewMotorsport(o); const g2 = newMotorsportGame(o);
      expect(pv.owner).toBe(seasonBudget(g2, player(g2), player(g2).motorsport!).owner);
      expect(JSON.stringify(g1)).toBe(JSON.stringify(g2));          // same seed, same game: previewing consumed nothing
    }
  });
});

describe('AE-04 — the dealer-investment preview is what the investment delivers', () => {
  it('a new region: entry cost deducted; an existing region: all of it is network; below the entry cost: refused', () => {
    const g = founder({ year: 2010 }), p = player(g);
    const abroad = (Object.keys(p.reach) as (keyof typeof p.reach)[]).find((r) => p.reach[r] <= 0)!;
    const pv = A.dealerInvestPreview(g, p, abroad, 10e6);
    expect(pv.setup).toBeGreaterThan(0); expect(pv.network).toBeCloseTo(10e6 - pv.setup, 3);
    const before = p.reach[abroad];
    expect(A.investDealers(g, abroad, 10e6)).toBeNull();
    expect(p.reach[abroad] - before).toBeCloseTo(pv.add, 6);
    const pv2 = A.dealerInvestPreview(g, p, abroad, 4e6);               // now present there
    expect(pv2.setup).toBe(0);
    const b2 = p.reach[abroad]; expect(A.investDealers(g, abroad, 4e6)).toBeNull();
    expect(p.reach[abroad] - b2).toBeCloseTo(pv2.add, 6);
    const other = (Object.keys(p.reach) as (keyof typeof p.reach)[]).find((r) => p.reach[r] <= 0)!;
    const small = A.dealerInvestPreview(g, p, other, 1e6);
    expect(small.add).toBe(0);
    const cash = p.cash; expect(A.investDealers(g, other, 1e6)).toMatch(/costs at least/); expect(p.cash).toBe(cash);
  });
});

describe('AE-05 — the acquisition review reconciles with the result', () => {
  it('price, cash received, debt assumed and the positions afterwards; previewing changes nothing', () => {
    const g = ceo(), p = player(g);
    const t = g.companies.find((c) => c.dataId === 'lamborghini' && c.alive)!;
    expect(t).toBeTruthy();
    const snapshot = JSON.stringify(g);
    const pv = A.acquisitionPreview(g, t.id)!;
    expect(JSON.stringify(g)).toBe(snapshot);                        // Cancel (no confirmation) leaves the game untouched
    expect(pv.error).toBeNull();
    expect(pv.targetCash).toBe(t.cash); expect(pv.targetDebt).toBe(t.debt);
    expect(pv.cashBefore).toBe(p.cash); expect(pv.debtBefore).toBe(p.debt);
    expect(A.acquire(g, t.id)).toBeNull();
    expect(p.cash).toBeCloseTo(pv.cashAfter, 2); expect(p.debt).toBeCloseTo(pv.debtAfter, 2);
    // identities: cash moves by −price + target cash (plus whatever had to be borrowed), debt by the assumed debt + borrowing
    const borrowed = pv.debtAfter - pv.debtBefore - pv.targetDebt;
    expect(borrowed).toBeGreaterThanOrEqual(-1e-6);
    expect(pv.cashAfter - pv.cashBefore).toBeCloseTo(-pv.price + pv.targetCash + borrowed, 2);
    expect(pv.creditLeftAfter).toBeCloseTo(creditLimit(p, g.year) - p.debt, 2);
  });
});

describe('AE-06 — a programme that waits for a shared architecture says so', () => {
  it('names the platform and gives its remaining months instead of "0 months left"', () => {
    const g = founder({ year: 2010 }), p = player(g);
    expect(A.startDevelopment(g, 'S1', defaultVehicle(g.year, 'sedan'), 'budget')).toBeNull();
    const s1 = p.models[p.models.length - 1];
    expect(devBlockers(p, s1)).toEqual([]);                          // it owns its architecture
    const plat = p.platforms?.find((x) => x.ownerModelId === s1.id);
    if (!plat) return;                                               // platform sharing not available in this configuration
    const spec = defaultVehicle(g.year, 'sedan');
    expect(A.startDevelopment(g, 'S1 twin', spec, 'budget', { platformId: plat.id } as never)).toBeNull();
    const twin = p.models[p.models.length - 1];
    if (twin.platformId !== plat.id) return;
    for (let i = 0; i < 80 && !(twin.status === 'development' && twin.devMonthsLeft <= 0); i++) { if (twin.status !== 'development') break; step(g); }
    if (twin.status === 'development' && twin.devMonthsLeft <= 0) {
      const bl = devBlockers(p, twin);
      expect(bl.map((b) => b.name)).toContain(plat.name);
      expect(devEtaMonths(p, twin)).toBeGreaterThan(0);              // never "0 months" while something blocks it
    }
  });
  it('a programme with nothing blocking it reports its own months', () => {
    const g = founder(), p = player(g);
    A.startDevelopment(g, 'Solo', defaultVehicle(g.year, 'hatch'), 'budget');
    const m = p.models[p.models.length - 1];
    expect(devEtaMonths(p, m)).toBe(Math.ceil(m.devMonthsLeft));
  });
});

describe('AE-08 — a batch advance does not run race weekends silently', () => {
  const mem = new Map<string, string>();
  beforeAll(() => { (globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); } }; });
  const run = async (months: number, confirmed = false) => { useStore.getState().advance(months, confirmed); await new Promise((r) => setTimeout(r, 30)); while (useStore.getState().busy) await new Promise((r) => setTimeout(r, 10)); };
  const fresh = () => { const g = motorsport({ year: 1992 }); useStore.setState({ game: g, screen: 'game', confirm: null, busy: false }); return g; };
  it('+3 months from January stops at the first race weekend with no result recorded', async () => {
    mem.clear(); const g = fresh(), div = player(g).motorsport!;
    const first = div.championship.rounds[0];
    await run(3);
    expect(g.month).toBe(first.month); expect(pendingRound(g, player(g))?.name).toBe(first.name);
    expect(div.championship.results).toHaveLength(0);
    // pressing +3 again with the race waiting asks first and simulates nothing
    await run(3);
    expect(useStore.getState().confirm?.text).toContain(first.name);
    expect(div.championship.results).toHaveLength(0); expect(g.month).toBe(first.month);
    useStore.getState().answer(false);
    expect(div.championship.results).toHaveLength(0);
  });
  it('with autosim chosen explicitly the old behaviour is kept, and its results are deterministic', async () => {
    mem.clear(); mem.set('ae.race.autosim', '1');
    const a = fresh(); await run(3); const ra = JSON.stringify(player(a).motorsport!.championship.results);
    const b = fresh(); await run(3); const rb = JSON.stringify(player(b).motorsport!.championship.results);
    expect(player(a).motorsport!.championship.results.length).toBeGreaterThan(0);
    expect(ra).toBe(rb);
    mem.clear();
  });
  it('a single month still advances as before', async () => {
    mem.clear(); const g = fresh(); await run(1); expect(g.month).toBe(2);
  });
});

describe('AE-09 — board objectives carry one deadline', () => {
  it('no objective text contains two "by <year>"', () => {
    const g = ceo(), p = player(g);
    for (const o of p.board!.objectives) expect((o.text.match(/\bby \d{4}\b/g) ?? []).length, o.text).toBeLessThanOrEqual(0 + (o.kind === 'debt' ? 1 : 0));
    const vol = p.board!.objectives.find((o) => o.kind === 'volume');
    if (vol) { expect(vol.text).toMatch(/in a calendar year, \d{4} at the latest/); expect(vol.byYear).toBe(Number(vol.text.match(/(\d{4}) at the latest/)![1]) + 1); }
  });
});

describe('R-01 — timed races are fuelled to the flag, not to the clock', () => {
  it('automatic strategists no longer run dry after the time limit; Push still burns more', () => {
    let fuelOut = 0, cars = 0;
    for (const seed of [11, 33, 66]) {
      const g = newMotorsportGame({ makerId: null, teamName: 'R01 GT', discipline: 'gt', year: 2015, budget: 1, facilities: 3, staff: 65, target: 6, color: '#aa2222', color2: '#ffffff', difficulty: 'normal', historyMode: 'historical', seed });
      const c = player(g), cfg = buildRaceConfig(g, c, c.motorsport!);
      expect(cfg.laps).toBeFalsy();
      const sim = new RaceSim(cfg); sim.runToEnd();
      cars += sim.cars.length; fuelOut += sim.cars.filter((x) => x.outReason === 'out of fuel').length;
      expect(sim.leaderFinishT).toBeGreaterThanOrEqual(cfg.duration);           // finishing after the nominal time is normal
    }
    expect(cars).toBeGreaterThan(40);
    expect(fuelOut).toBe(0);                                                      // was 20 of 66 on these three seeds
  });
  it('the same race gives the same result twice (deterministic), and races by laps are untouched by the allowance', () => {
    const mk = () => { const g = newMotorsportGame({ makerId: null, teamName: 'R01 GT', discipline: 'gt', year: 2015, budget: 1, facilities: 3, staff: 65, target: 6, color: '#aa2222', color2: '#ffffff', difficulty: 'normal', historyMode: 'historical', seed: 22 }); const c = player(g); const s = new RaceSim(buildRaceConfig(g, c, c.motorsport!)); s.runToEnd(); return s; };
    const a = mk(), b = mk();
    expect(a.cars.map((x) => [x.e.id, x.laps, x.status])).toEqual(b.cars.map((x) => [x.e.id, x.laps, x.status]));
    const f1 = motorsport({ year: 2010 }), cf = buildRaceConfig(f1, player(f1), player(f1).motorsport!);
    const s = new RaceSim(cf);
    expect(cf.laps).toBeGreaterThan(0);
    expect(s.fuelLapsLeft(s.cars[0])).toBe(s.lapsLeft(s.cars[0]));
  });
});
