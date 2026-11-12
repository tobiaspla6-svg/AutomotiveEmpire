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

describe('20+ seasons: large teams are strong but do not hoard money', () => {
  it.each([
    ['f1', 1986], ['hypercar', 2000], ['f1', 2000],
  ] as const)('%s from %i, front-runner budget, 22 seasons', (d, y) => {
    const { g, rows, peak } = career(d, y, 2, 'prudent', 22);
    expect(rows.length).toBe(22);
    expect(insolvent(g)).toBe(false);
    expect(peak, 'net cash never exceeds about one season budget').toBeLessThan(1.5); // was 3.7–7×
    expect(median(rows.map((r) => r.pos)), 'a front-runner budget buys front-running results').toBeLessThanOrEqual(3);
    expect(nonFinitePaths(g)).toEqual([]);
  });
});

