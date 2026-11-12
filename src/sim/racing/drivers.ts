// The driver market (Phase 3).
//
//  • Development: every driver has a POTENTIAL. Young drivers close a third of the gap each year, drivers
//    in their prime hold their level, and from 33 they decline. Consistency grows with experience.
//  • Category specialisation: a driver belongs to single-seaters, prototypes, GT or touring cars. A driver
//    from another category needs up to two seasons to adapt (−3 pace per season left).
//  • Negotiation: a driver asks a salary from their market value, how attractive the team is (results,
//    works backing, size) and how many stronger teams are interested; offers below the ask are refused.
//    Drivers under contract elsewhere can be bought out (transfer fee) and still have to agree.
//  • Competition: every January the AI teams, strongest first, sign free agents who are clearly better
//    than their weakest driver; elite drivers do not stay free for long.
//  • Routes for small teams: an ACADEMY that develops juniors (promoted on cheap contracts), PAY DRIVERS who
//    bring sponsorship, veterans who ask less, and experienced drivers from other categories.
// DATA STATUS: every driver is fictional; salaries, backing and development rates are estimated game data.
import type { Championship, Discipline, Driver, GameState, MotorsportDivision, RaceTeam } from '../types';
import { gauss, rnd, rndInt, rndRange, type Rng } from '../rng';
import { clamp } from '../util';
import type { Regs } from './regs';

export type DriverGroup = 'single' | 'proto' | 'gt' | 'touring';
export const GROUP: Record<Discipline, DriverGroup> = { f1: 'single', hypercar: 'proto', lmdh: 'proto', gt: 'gt', touring: 'touring' };
export const GROUP_NAME: Record<DriverGroup, string> = { single: 'single-seaters', proto: 'prototypes', gt: 'GT cars', touring: 'touring cars' };

export const overallOf = (d: Driver) => 0.45 * d.pace + 0.2 * d.consistency + 0.15 * d.racecraft + 0.1 * d.wet + 0.1 * d.tyre;
export const potentialOf = (d: Driver) => Math.max(d.pace, d.potential ?? d.pace);
/** Overall rating the driver would reach at their potential pace (same scale as overallOf). */
export const potentialOverall = (d: Driver) => overallOf({ ...d, pace: potentialOf(d) });
export const specialtyOf = (d: Driver, discipline: Discipline): DriverGroup => d.specialty ?? GROUP[discipline];
/** Pace in this category this season: a driver from another category loses 3 points per season still to adapt. */
export const effectivePace = (d: Driver, discipline: Discipline) => (specialtyOf(d, discipline) !== GROUP[discipline] ? d.pace - 3 * (d.adapt ?? 0) : d.pace);
/** Rating this season in this category (adaptation applied): what teams pay for and race with. */
export const effectiveOverall = (d: Driver, discipline: Discipline) => overallOf(raceDriver(d, discipline));
/** The driver as seen in a race of this category (adaptation applied). */
export const raceDriver = (d: Driver, discipline: Discipline): Driver => (d.adapt ? { ...d, pace: effectivePace(d, discipline) } : d);

/** One year of development: towards potential when young, steady in the prime, decline from 33. */
export function developDriver(d: Driver, rng: Rng) {
  d.age++;
  const pot = potentialOf(d);
  let delta: number;
  if (d.age <= 25) delta = clamp((pot - d.pace) * 0.33 + gauss(rng) * 1, -1, 5);
  else if (d.age <= 32) delta = clamp((pot - d.pace) * 0.15 + gauss(rng) * 0.7, -1.5, 2);
  else delta = -rndRange(rng, 0.5, 2.5);
  d.pace = clamp(Math.round(d.pace + delta), 40, 99);
  if (d.potential !== undefined && d.age > 32) d.potential = Math.max(d.pace, d.potential - 1.5);
  d.consistency = clamp(Math.round(d.consistency + (d.age < 30 ? 0.8 : -0.3)), 40, 99);
  d.racecraft = clamp(Math.round(d.racecraft + (d.age < 28 ? 0.6 : 0)), 40, 99);
  if (d.adapt) d.adapt = Math.max(0, d.adapt - 1);
}

/** 0–1: how attractive a seat in this team is (recent results, works backing, size). */
export function attractiveness(ch: Championship, team: RaceTeam, scale = 1): number {
  const pts = ch.teamPoints[team.id] ?? 0;
  const ranked = [...ch.teams].sort((a, b) => (ch.teamPoints[b.id] ?? 0) - (ch.teamPoints[a.id] ?? 0) || b.tier - a.tier);
  const pos = ranked.findIndex((t) => t.id === team.id);
  const form = ch.results.length && pts > 0 ? 1 - pos / Math.max(1, ch.teams.length - 1) : team.isPlayer ? 0.4 : team.tier;
  return clamp(0.45 * form + 0.25 * (team.companyId && !team.isPlayer ? 1 : team.isPlayer ? 0.4 : 0.3) + 0.3 * clamp((scale - 0.5) / 0.9, 0, 1), 0, 1);
}
/** Stronger teams that would sign this driver now: they field a weaker driver and the driver is elite. */
export function rivalsFor(ch: Championship, d: Driver, me: RaceTeam, myAttr: number): number {
  const now = effectiveOverall(d, ch.discipline); // other teams also judge a driver by this season's level
  if (now < 78) return 0;
  let n = 0;
  for (const t of ch.teams) {
    if (t.id === me.id || t.id === d.teamId) continue;
    if (attractiveness(ch, t, 0.5 + t.tier) <= myAttr) continue;
    const weakest = Math.min(...t.drivers.map((id) => { const x = ch.drivers.find((y) => y.id === id); return x ? overallOf(x) : 100; }));
    if (now > weakest + 2) n++;
  }
  return n;
}
/**
 * The salary a driver asks to join this team: market value (rating, age), discounted by an attractive team,
 * raised by competing interest, lowered for veterans and for drivers who bring sponsorship (whose backing is
 * paid on top, see seasonBudget).
 */
export function askingSalary(d: Driver, base: number, attr: number, rivals: number): number {
  const age = d.age >= 35 ? 0.7 : d.age >= 33 ? 0.85 : d.age <= 22 ? 0.8 : 1;
  return base * (1.3 - 0.6 * attr) * (1 + 0.15 * Math.min(4, rivals)) * age;
}
/** Transfer fee to buy a driver out of a contract with another team: 60 % of the remaining salary plus 30 % of a year. */
export const buyoutFee = (d: Driver, year: number) => d.salary * (0.6 * Math.max(0, d.contractEnd - year + 1) + 0.3);

/**
 * January market for one championship: drivers from other categories become available, some free agents bring
 * sponsorship, and the AI teams (strongest first) upgrade a weak seat when a clearly better free agent exists.
 */
export function marketWindow(g: GameState, ch: Championship, div: MotorsportDivision | null, rng: Rng, year: number, make: (rating: number) => Driver, regs: Regs, salary: (d: Driver) => number): string[] {
  const news: string[] = [];
  // a few free agents bring sponsorship (pay drivers): typically capable, rarely brilliant
  const free = ch.drivers.filter((d) => !d.teamId && d.backing === undefined);
  for (const d of free) if (overallOf(d) < 80 && rnd(rng) < 0.18) d.backing = salary(d) * rndRange(rng, 1.5, 4);
  // AI transfer window
  const seats = regs.carsPerTeam * regs.driversPerCar;
  for (const t of [...ch.teams].filter((x) => !x.isPlayer).sort((a, b) => b.tier - a.tier)) {
    if (t.drivers.length < seats) continue;
    const mine = t.drivers.map((id) => ch.drivers.find((x) => x.id === id)!).filter(Boolean);
    // teams sign for this season: a driver still adapting from another category is rated at today's level
    const now = (x: Driver) => effectiveOverall(x, ch.discipline);
    const weakest = mine.sort((a, b) => now(a) - now(b))[0];
    const best = ch.drivers.filter((x) => !x.teamId && !x.academy && now(x) > now(weakest) + 3 && x.age < 38).sort((a, b) => now(b) - now(a))[0];
    if (!best || rnd(rng) > 0.35 + 0.5 * t.tier) continue;
    weakest.teamId = null; t.drivers = t.drivers.filter((id) => id !== weakest.id);
    best.teamId = t.id; best.contractEnd = year + rndInt(rng, 1, 2); best.backing = undefined; t.drivers.push(best.id);
    if (overallOf(best) >= 84) news.push(`${t.name} sign ${best.name}`);
  }
  // the academy
  if (div?.academy) news.push(...runAcademy(div, rng, year, make));
  void g;
  return news;
}

/**
 * The summer "silly season": three experienced drivers from other categories make themselves available for next
 * season (one a star in their own category). Whoever signs them first gets them; the AI teams move in January.
 */
export function scoutDrivers(ch: Championship, rng: Rng, make: (rating: number) => Driver, salary: (d: Driver) => number): string[] {
  const group = GROUP[ch.discipline];
  const others = (['single', 'proto', 'gt', 'touring'] as DriverGroup[]).filter((x) => x !== group);
  const out: string[] = [];
  for (let i = 0; i < 3; i++) {
    const d = make(i === 0 ? rndRange(rng, 82, 90) : rndRange(rng, 72, 84));
    d.age = rndInt(rng, 26, 36); d.specialty = others[rndInt(rng, 0, others.length - 1)]; d.adapt = 2;
    d.potential = d.pace; d.salary = salary(d) * 0.85;
    ch.drivers.push(d);
    if (i === 0) out.push(`${d.name}, a star in ${GROUP_NAME[d.specialty]}, is looking for a seat in ${ch.name} for next season (rated ${Math.round(overallOf(d))}, needs time to adapt).`);
  }
  return out;
}

// ------------------------------------------------------------------------------------------- academy

/** Yearly cost of an academy level, as a share of the category's budget reference. */
export const ACADEMY_COST = [0, 0.012, 0.024, 0.04];
/** Each January: juniors develop, the oldest leave unless promoted, and new juniors join (one per level). */
export function runAcademy(div: MotorsportDivision, rng: Rng, year: number, make: (rating: number) => Driver): string[] {
  const a = div.academy!;
  const news: string[] = [];
  for (const j of a.juniors) {
    j.age++;
    j.pace = clamp(Math.round(j.pace + clamp((potentialOf(j) - j.pace) * (0.25 + 0.08 * a.level) + gauss(rng), 0, 8)), 40, 99);
    j.consistency = clamp(j.consistency + 2, 40, 99); j.racecraft = clamp(j.racecraft + 2, 40, 99);
  }
  const leaving = a.juniors.filter((j) => j.age > 21);
  for (const j of leaving) news.push(`${j.name} leaves the academy for a seat elsewhere`);
  a.juniors = a.juniors.filter((j) => j.age <= 21);
  for (let i = 0; i < a.level; i++) {
    const j = make(rndRange(rng, 48, 60));
    j.age = rndInt(rng, 15, 17); j.academy = true;
    j.potential = clamp(Math.round(68 + 5 * a.level + rndRange(rng, 0, 18)), 60, 99);
    a.juniors.push(j);
  }
  void year;
  return news;
}
