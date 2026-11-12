// Motorsport finances (Phase 2): long careers in several eras and categories, and each mechanism alone.
//
// Before Phase 2 (same seeds): a front-runner F1 team 1986→2010 ended with $4.7B and a front-running
// hypercar team with 7× its season budget in the bank; every privateer went insolvent within 2–15
// seasons even without spending a cent more than the default (F1 1990: insolvent in 1992; touring 1988
// redesigning yearly: insolvent in 1994).
import { describe, expect, it } from 'vitest';
import * as A from '../src/sim/actions';
import { prepareLoadedGame } from '../src/sim/migrate';
import { budgetRef, playerTeam, prizeMoney, RESERVE_ALLOWED, seasonBudget, sponsorTarget, startSeason, teamRegs, teamScale } from '../src/sim/racing/season';
import { defaultRaceCar } from '../src/sim/racing/racecar';
import type { Discipline, GameState, MotorsportDivision } from '../src/sim/types';
import { motorsport, nonFinitePaths, player, step } from './helpers';
import { playSeasons, type Bot } from './msbots';

const team = (d: Discipline, year: number, budget: 0 | 1 | 2) =>
  motorsport({ discipline: d, year, budget, staff: budget === 0 ? 55 : budget === 2 ? 80 : 65, facilities: budget === 0 ? 2 : budget === 2 ? 4 : 3, target: budget === 2 ? 4 : budget === 0 ? 9 : 6 });
const career = (d: Discipline, year: number, budget: 0 | 1 | 2, bot: Bot, seasons: number) => {
  const g = team(d, year, budget);
  const rows = playSeasons(g, seasons, bot);
  return { g, rows, peak: Math.max(...rows.map((r) => (r.cash - r.debt) / r.B)), low: Math.min(...rows.map((r) => (r.cash - r.debt) / r.B)) };
};
const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
const insolvent = (g: GameState) => !!g.gameOver && /insolvent/.test(g.gameOver.reason);

describe('the mechanisms', () => {
  it('running costs grow with team size, staff, facilities and development; the budget adds up', () => {
    const g = team('f1', 2010, 1); const p = player(g); const div = p.motorsport!;
    const b = seasonBudget(g, p, div);
    expect(b.cost).toBeCloseTo(b.personnel + b.facilities + b.carBuild + b.travel + b.drivers + b.development, 3);
    expect(b.balance).toBeCloseTo(b.sponsors + b.owner + b.prize - b.cost, 3);
    expect(seasonBudget(g, p, div, { scale: 1.35 }).cost).toBeGreaterThan(b.cost * 1.15);
    expect(seasonBudget(g, p, div, { staffAvg: 90 }).personnel).toBeGreaterThan(b.personnel * 1.1);
    expect(seasonBudget(g, p, div, { facAvg: 5 }).facilities).toBeGreaterThan(b.facilities);
    expect(seasonBudget(g, p, div, { devBudget: 0 }).cost).toBeCloseTo(b.cost - b.development, 3);
    // a season's money matches the ledger: monthly charges are a twelfth of the annual plan
    const before = p.ledger.length; step(g, 1);
    expect(p.ledger[before].motorsport).toBeCloseTo(seasonBudget(g, p, div).cost / 12, -3);
  });
  it('a new team is set up to break even at its target position with standard development', () => {
    for (const [d, y, budget] of [['f1', 1990, 0], ['f1', 2010, 1], ['hypercar', 2015, 2], ['touring', 1995, 0], ['gt', 2020, 2]] as const) {
      const g = motorsport({ discipline: d, year: y, budget, facilities: 3, staff: 65, target: 5 });
      const p = player(g); const div = p.motorsport!;
      const b = seasonBudget(g, p, div);
      const B = budgetRef(teamRegs(playerTeam(div), y), y);
      expect(Math.abs(b.sponsors + b.owner + prizeMoney(B, 5, div.championship.teams.length) - b.cost) / b.cost, `${d} ${y}`).toBeLessThan(0.15);
    }
  });
  it('sponsorship follows results towards a ceiling instead of compounding', () => {
    const g = team('f1', 2005, 2); const p = player(g); const div = p.motorsport!;
    const B = budgetRef(teamRegs(playerTeam(div), 2005), 2005);
    const cap = sponsorTarget(B, teamScale(div), 1);
    div.sponsors.forEach((s) => { s.annual *= 3; }); // far above what any result justifies
    const start = div.sponsors.reduce((a, s) => a + s.annual, 0);
    step(g, 37); // three season ends
    const ratio = budgetRef(teamRegs(playerTeam(div), 2008), 2008) / B; // every budget moves with the category's level each January
    const after = div.sponsors.reduce((a, s) => a + s.annual, 0) / ratio;
    expect(after).toBeLessThan(start * 0.6); // halfway to the target every season, not ×1.25 a year
    expect(after).toBeLessThan(cap * 1.2);
    expect(sponsorTarget(B, 1.35, 1)).toBeGreaterThan(sponsorTarget(B, 1.35, 0) * 2.5); // results matter
    expect(sponsorTarget(B, 1.35, 0.5)).toBeGreaterThan(sponsorTarget(B, 0.55, 0.5) * 1.6); // so does size
  });
  it('owners hold back funding from a team sitting on cash, and rescue a team they believe in', () => {
    const roll = (cash: number, debt: number, confidence: number) => {
      const g = team('f1', 2010, 1); const p = player(g); const div = p.motorsport!;
      step(g, 11);
      p.cash = cash; p.debt = debt; p.board!.confidence = confidence;
      g.year++; startSeason(g, p, div, g.rng);
      return { div, base: div.ownerBase!, run: seasonBudget(g, p, div).cost };
    };
    const rich = roll(2e9, 0, 60);
    expect(rich.div.ownerGrant).toBeLessThan(rich.base * 0.5);
    const normal = roll(10e6, 0, 60);
    expect(normal.div.ownerGrant).toBeCloseTo(normal.base, 0);
    const trusted = roll(0, 60e6, 70), doubted = roll(0, 60e6, 20);
    expect(trusted.div.ownerGrant).toBeGreaterThan(trusted.base);
    expect(trusted.div.ownerGrant - trusted.base).toBeLessThanOrEqual(0.25 * trusted.run + 1);
    expect(doubted.div.ownerGrant).toBeCloseTo(doubted.base, 0);
    expect(RESERVE_ALLOWED).toBeGreaterThan(0);
  });
  it('a new engine and chassis cost a privateer less than a works-size team, and still cost real money', () => {
    const cost = (budget: 0 | 2) => {
      const g = team('f1', 2010, budget); const p = player(g); const div = p.motorsport!;
      const t = playerTeam(div); const spec = defaultRaceCar(teamRegs(t, 2010), 2010, t.color, t.color2);
      spec.engine.displacement = Math.round(spec.engine.displacement * 0.97); spec.aeroBias = t.car.aeroBias > 0.5 ? 0.2 : 0.8;
      return A.redesignCost(g, p, t.car, spec) / budgetRef(teamRegs(t, 2010), 2010);
    };
    expect(cost(0)).toBeLessThan(cost(2) * 0.8);
    expect(cost(0)).toBeGreaterThan(0.1);
  });
  it('prize money: every entrant gets a base fee, the champion several times more', () => {
    expect(prizeMoney(100, 10, 10)).toBeGreaterThan(5);
    expect(prizeMoney(100, 1, 10)).toBeGreaterThan(prizeMoney(100, 10, 10) * 5);
    for (let p = 2; p <= 10; p++) expect(prizeMoney(100, p, 10)).toBeLessThan(prizeMoney(100, p - 1, 10));
  });
});

describe('saves from before Phase 2', () => {
  it('a version-2 motorsport save without team size or agreed funding loads and plays on', () => {
    const g = team('gt', 2012, 1); step(g, 5);
    const raw = JSON.parse(JSON.stringify(g)) as GameState;
    const div = raw.companies.find((c) => c.id === raw.playerId)!.motorsport as Partial<MotorsportDivision>;
    delete div.scale; delete div.ownerBase;
    const up = prepareLoadedGame(raw);
    const p = player(up);
    expect(teamScale(p.motorsport!)).toBeCloseTo(0.9, 9);
    step(up, 14);
    expect(nonFinitePaths(up)).toEqual([]);
    expect(p.motorsport!.ownerBase).toBeGreaterThan(0);
    expect(p.motorsport!.history.length).toBeGreaterThan(0);
  });
});
