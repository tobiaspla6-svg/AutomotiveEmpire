// Scripted team principals for the motorsport finance simulations (tests and scripts/motorsport-finance.ts).
import * as A from '../src/sim/actions';
import { budgetRef, overall, RESERVE_ALLOWED, seasonBudget, teamRegs, playerTeam, teamScale } from '../src/sim/racing/season';
import { defaultRaceCar } from '../src/sim/racing/racecar';
import type { GameState } from '../src/sim/types';
import { player, step } from './helpers';

export type Bot = 'passive' | 'prudent' | 'redesign';

/** Keep the car legal for the current rules (a new car when the regulations demand one). */
export function keepLegal(g: GameState, everyYear = false, flip = { v: false }) {
  const div = player(g).motorsport!; const team = playerTeam(div); const regs = teamRegs(team, g.year);
  const legal = defaultRaceCar(regs, g.year, team.color, team.color2);
  if (everyYear) { // a different engine and aero philosophy every season: the costly habit from the bug report
    flip.v = !flip.v;
    legal.engine.displacement = Math.round(legal.engine.displacement * (flip.v ? 0.97 : 1));
    legal.aeroBias = flip.v ? 0.2 : 0.8;
    A.redesignRaceCar(g, legal);
  } else if (legal.engine.layout !== team.car.engine.layout || legal.engine.displacement !== team.car.engine.displacement) A.redesignRaceCar(g, legal);
}

/**
 * What a sensible principal does every January: size the development budget to what the season's forecast
 * allows (paying a third of any debt back each year), and invest a reserve beyond what the owners allow in
 * facilities and people.
 */
export function prudentJanuary(g: GameState) {
  const p = player(g); const div = p.motorsport!;
  const B = budgetRef(teamRegs(playerTeam(div), div.championship.year), g.year);
  // fill empty seats (retirements, ended contracts) with the best free agent the team can pay
  const ch = div.championship, team = playerTeam(div), regs = teamRegs(team, ch.year);
  const seats = regs.carsPerTeam * regs.driversPerCar;
  for (let guard = 0; team.drivers.length < seats && guard < seats; guard++) {
    const free = ch.drivers.filter((d) => !d.teamId && d.salary <= B * 0.025 * teamScale(div)).sort((a, b) => overall(b) - overall(a));
    if (!free.length || A.signDriver(g, free[0].id, 2)) break;
  }
  const b = seasonBudget(g, p, div);
  const net = p.cash - p.debt;
  const room = b.balance + (net - 0.2 * b.cost) / 3;
  A.setDevBudget(g, Math.min((B * 0.5) / 12, Math.max(0, div.devBudget + room / 12)));
  const after = seasonBudget(g, p, div);
  if (net > RESERVE_ALLOWED * after.cost * 1.5) {
    for (const k of ['windTunnel', 'engineShop', 'simulator', 'workshop'] as const) if (p.cash - p.debt > RESERVE_ALLOWED * after.cost * 1.5) A.upgradeFacility(g, k);
    for (const k of ['technical', 'aero', 'raceOps', 'strategy'] as const) if (p.cash - p.debt > RESERVE_ALLOWED * after.cost * 1.5) A.recruitStaff(g, k);
  }
}

export interface SeasonRow { year: number; B: number; cash: number; debt: number; pos: number; income: number; cost: number; owner: number; sponsors: number }

/** Play `years` seasons with a bot; returns one row per completed season. */
export function playSeasons(g: GameState, years: number, bot: Bot): SeasonRow[] {
  const p = player(g); const rows: SeasonRow[] = []; const flip = { v: false };
  for (let y = 0; y < years && !g.gameOver; y++) {
    keepLegal(g, bot === 'redesign', flip);
    if (bot !== 'passive') prudentJanuary(g);
    const div = p.motorsport!;
    const B = budgetRef(teamRegs(playerTeam(div), div.championship.year), g.year);
    const owner = div.ownerGrant, sponsors = div.sponsors.reduce((a, s) => a + s.annual, 0);
    step(g, 12);
    const h = p.motorsport!.history.find((x) => x.year === g.year - 1);
    const L = p.ledger.slice(-12);
    rows.push({ year: g.year - 1, B, cash: p.cash, debt: p.debt, pos: h?.playerTeamPos ?? 0, income: L.reduce((a, l) => a + l.revenue + l.otherIncome, 0), cost: L.reduce((a, l) => a + l.motorsport + l.oneOff, 0), owner, sponsors });
  }
  return rows;
}
