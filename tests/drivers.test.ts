// The motorsport driver market (Phase 3).
import { describe, expect, it } from 'vitest';
import * as A from '../src/sim/actions';
import { askingSalary, buyoutFee, developDriver, effectivePace, overallOf, raceDriver } from '../src/sim/racing/drivers';
import { budgetRef, playerTeam, seasonBudget, teamRegs } from '../src/sim/racing/season';
import { makeRng } from '../src/sim/rng';
import { prepareLoadedGame } from '../src/sim/migrate';
import type { Driver, GameState } from '../src/sim/types';
import { motorsport, nonFinitePaths, player, step } from './helpers';

const drv = (o: Partial<Driver>): Driver => ({ id: 'x', name: 'X', nat: 'GBR', age: 22, pace: 70, consistency: 70, racecraft: 70, wet: 70, tyre: 70, salary: 1e6, contractEnd: 2000, teamId: null, wins: 0, titles: 0, ...o });
const div = (g: GameState) => player(g).motorsport!;
const chOf = (g: GameState) => div(g).championship;
const seats = (g: GameState) => { const r = teamRegs(playerTeam(div(g)), chOf(g).year); return r.carsPerTeam * r.driversPerCar; };
const freeSeat = (g: GameState) => { const t = playerTeam(div(g)); while (t.drivers.length >= seats(g)) A.releaseDriver(g, t.drivers[t.drivers.length - 1]); };

describe('driver development', () => {
  it('young drivers grow toward their potential, drivers in their prime hold, veterans decline', () => {
    const rng = makeRng(7);
    const young = drv({ age: 19, pace: 70, potential: 90 }), prime = drv({ age: 28, pace: 85, potential: 85 }), old = drv({ age: 35, pace: 85 });
    for (let i = 0; i < 4; i++) { developDriver(young, rng); developDriver(prime, rng); developDriver(old, rng); }
    expect(young.pace).toBeGreaterThan(80);
    expect(Math.abs(prime.pace - 85)).toBeLessThanOrEqual(3);
    expect(old.pace).toBeLessThan(83);
  });
  it('a driver from another category needs up to two seasons to adapt', () => {
    const d = drv({ pace: 85, specialty: 'single', adapt: 2 });
    expect(effectivePace(d, 'hypercar')).toBe(79);
    expect(effectivePace(d, 'f1')).toBe(85); // home category
    expect(raceDriver(d, 'gt').pace).toBe(79);
    developDriver(d, makeRng(1));
    expect(d.adapt).toBe(1);
  });
});

describe('negotiation', () => {
  it('the ask falls for an attractive team, rises with competing interest, and is lower for veterans', () => {
    const d = drv({ age: 27 });
    expect(askingSalary(d, 1e6, 0.9, 0)).toBeLessThan(askingSalary(d, 1e6, 0.2, 0) * 0.7);
    expect(askingSalary(d, 1e6, 0.5, 3)).toBeGreaterThan(askingSalary(d, 1e6, 0.5, 0) * 1.4);
    expect(askingSalary({ ...d, age: 36 }, 1e6, 0.5, 0)).toBeLessThan(askingSalary(d, 1e6, 0.5, 0));
  });
  it('an offer below the ask is refused; at the ask the driver signs and the salary holds through the contract', () => {
    const g = motorsport({ discipline: 'f1', year: 2010, budget: 1 });
    freeSeat(g);
    const d = chOf(g).drivers.filter((x) => !x.teamId).sort((a, b) => overallOf(b) - overallOf(a))[2];
    const terms = A.driverTerms(g, d.id)!;
    expect(A.signDriver(g, d.id, 3, undefined, terms.ask * 0.8)).toMatch(/wants at least/);
    expect(A.signDriver(g, d.id, 3, undefined, terms.ask)).toBeNull();
    expect(d.teamId).toBe(playerTeam(div(g)).id);
    expect(d.contracted).toBeCloseTo(terms.ask, 6);
    const B0 = budgetRef(teamRegs(playerTeam(div(g)), 2010), 2010);
    step(g, 12); // into the next season
    const B1 = budgetRef(teamRegs(playerTeam(div(g)), 2011), 2011);
    expect(d.salary).toBeCloseTo(terms.ask * (B1 / B0), 0); // moves only with the category's budget level
  });
  it('a driver under contract elsewhere can be bought out; the other team fills the seat', () => {
    const g = motorsport({ discipline: 'f1', year: 2010, budget: 2 });
    freeSeat(g);
    const ch = chOf(g); const me = playerTeam(div(g));
    const target = ch.drivers.filter((x) => x.teamId && x.teamId !== me.id).sort((a, b) => overallOf(b) - overallOf(a))[3];
    const from = ch.teams.find((t) => t.id === target.teamId)!;
    const fee = buyoutFee(target, ch.year);
    expect(fee).toBeGreaterThan(target.salary * 0.3);
    const cash = player(g).cash - player(g).debt;
    const ask = A.driverTerms(g, target.id)!.ask;
    expect(A.signDriver(g, target.id, 2, undefined, ask)).toBeNull();
    expect(target.teamId).toBe(me.id);
    expect(from.drivers).not.toContain(target.id);
    expect(from.drivers.length).toBe(seats(g));
    expect(cash - (player(g).cash - player(g).debt)).toBeCloseTo(ask * 0.1 + fee, -2);
  });
});

describe('competition and routes for small teams', () => {
  it('AI teams sign clearly better free agents in the January window', () => {
    const g = motorsport({ discipline: 'f1', year: 2010, budget: 1 });
    const ch = chOf(g);
    const star = drv({ id: 'star', name: 'Star', age: 26, pace: 96, consistency: 92, racecraft: 92, wet: 90, tyre: 90, salary: 5e6 });
    ch.drivers.push(star);
    step(g, 12);
    expect(star.teamId).not.toBeNull();
    expect(star.teamId).not.toBe(playerTeam(div(g)).id);
  });
  it('pay drivers bring sponsorship that the season budget counts as income', () => {
    const g = motorsport({ discipline: 'gt', year: 2015, budget: 0 });
    freeSeat(g);
    const d = chOf(g).drivers.find((x) => !x.teamId)!;
    d.backing = 2e6;
    const before = seasonBudget(g, player(g), div(g));
    expect(A.signDriver(g, d.id, 2)).toBeNull();
    const after = seasonBudget(g, player(g), div(g));
    expect(after.backing).toBe(2e6);
    expect(after.sponsors - before.sponsors).toBeCloseTo(2e6, 0);
    const L0 = player(g).ledger.length;
    step(g, 1);
    expect(player(g).ledger[L0].revenue).toBeGreaterThan(2e6 / 12);
  });
  it('an academy brings juniors every year, develops them, and promotes them on cheap contracts', () => {
    const g = motorsport({ discipline: 'f1', year: 2010, budget: 0 });
    expect(A.setAcademy(g, 2)).toBeNull();
    const b = seasonBudget(g, player(g), div(g));
    expect(b.academy).toBeGreaterThan(0);
    step(g, 12);
    const a = div(g).academy!;
    expect(a.juniors.length).toBe(2);
    const j = a.juniors[0];
    const pace0 = j.pace;
    step(g, 24);
    expect(j.pace).toBeGreaterThan(pace0);
    while (j.age < 17) step(g, 12);
    freeSeat(g);
    expect(A.promoteJunior(g, j.id)).toBeNull();
    expect(j.teamId).toBe(playerTeam(div(g)).id);
    const regs = teamRegs(playerTeam(div(g)), chOf(g).year);
    expect(j.salary).toBeLessThan(budgetRef(regs, chOf(g).year) * 0.012 * Math.exp((overallOf(j) - 70) / 9) * 0.5);
  });
  it('a privateer can recruit competitive drivers: mid-grid within its usual budget, top-quartile at a premium', () => {
    for (const [d, y] of [['f1', 1995], ['gt', 2010], ['touring', 2000]] as const) {
      const g = motorsport({ discipline: d, year: y, budget: 0 });
      step(g, 7); // the summer market: drivers from other categories become available (plus veterans and pay drivers)
      const ch = chOf(g); const me = playerTeam(div(g));
      const grid = ch.drivers.filter((x) => x.teamId && x.teamId !== me.id).map(overallOf).sort((a, b) => a - b);
      const pct = (p: number) => grid[Math.floor(grid.length * p)];
      const B = budgetRef(teamRegs(me, ch.year), ch.year);
      // rated at full strength once adapted to the category (at most two seasons)
      const free = ch.drivers.filter((x) => !x.teamId).map((x) => ({ o: overallOf(x), net: A.driverTerms(g, x.id)!.ask - (x.backing ?? 0) }));
      const affordable = free.filter((x) => x.net <= B * 0.04);
      expect(Math.max(...affordable.map((x) => x.o)), `${d} ${y}: best within a privateer's driver budget`).toBeGreaterThanOrEqual(pct(0.4));
      const topQuartile = free.filter((x) => x.o >= pct(0.75));
      expect(topQuartile.length, `${d} ${y}: a top-quartile driver is on the market`).toBeGreaterThan(0);
      expect(Math.min(...topQuartile.map((x) => x.net)), `${d} ${y}`).toBeLessThan(B * 0.3);
      // and passivity has a price: the January window takes the best of them for the works teams
    }
  });
});

describe('saves', () => {
  it('drivers and divisions from before the driver market load and play on', () => {
    const g = motorsport({ discipline: 'gt', year: 2012, budget: 1 });
    step(g, 3);
    const raw = JSON.parse(JSON.stringify(g)) as GameState;
    const dv = raw.companies.find((c) => c.id === raw.playerId)!.motorsport!;
    delete dv.academy;
    for (const d of dv.championship.drivers) { delete d.potential; delete d.specialty; delete d.adapt; delete d.backing; delete d.contracted; delete d.academy; }
    const up = prepareLoadedGame(raw);
    step(up, 14);
    expect(nonFinitePaths(up)).toEqual([]);
    expect(player(up).motorsport!.history.length).toBeGreaterThan(0);
  });
});
