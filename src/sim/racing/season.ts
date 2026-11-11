// Championships: grids, drivers, calendars, results, development and season roll-over.
// Team names of non-manufacturer entrants, all sponsors and every driver are FICTIONAL.
// Manufacturer entries follow the real eras in which each brand ran a works programme in that
// category (data/manufacturers.ts), under generic unofficial team names.
import type { CarResult, Championship, Company, DevLevels, Discipline, Driver, GameState, MotorsportDivision, RaceTeam, Round, Tech } from '../types';
import { MAKERS, type MsGroup } from '../../data/manufacturers';
import { chance, gauss, hashStr, makeRng, pick, rnd, rndInt, rndRange, shuffle, type Rng } from '../rng';
import { clamp, cpi } from '../util';
import { modProduct } from '../market';
import { receive } from '../accounts';
import { news, uid } from '../company';
import { getRegs, DISC_NAME, type Regs } from './regs';
import { computeRaceCar, defaultRaceCar, checkLegal, raceEngineSpec } from './racecar';
import { lapSim } from './lapsim';
import { makeWeather, RaceSim, type RaceConfig, type RaceEntry, type Weather } from './race';
import { TRACK, trackGeom } from './tracks';

const FIRST: Record<string, string[]> = {
  GBR: ['James', 'Oliver', 'Harry', 'Callum', 'Edward', 'Tom', 'Alfie', 'George'], ITA: ['Luca', 'Matteo', 'Alessandro', 'Davide', 'Enzo', 'Riccardo', 'Paolo', 'Stefano'],
  FRA: ['Julien', 'Antoine', 'Mathieu', 'Hugo', 'Pascal', 'Lucien', 'Rémi', 'Théo'], GER: ['Lukas', 'Felix', 'Jonas', 'Maximilian', 'Dieter', 'Klaus', 'Niklas', 'Tobias'],
  BRA: ['Rafael', 'Thiago', 'Bruno', 'Caio', 'Marcelo', 'Gustavo', 'Diego', 'Leandro'], ESP: ['Javier', 'Alvaro', 'Sergio', 'Pablo', 'Iker', 'Marcos', 'Diego', 'Raúl'],
  USA: ['Tyler', 'Cody', 'Jake', 'Ryan', 'Logan', 'Chase', 'Austin', 'Mason'], JPN: ['Hiroshi', 'Kenta', 'Yuto', 'Takumi', 'Daiki', 'Ren', 'Shota', 'Kazuki'],
  FIN: ['Mika', 'Jari', 'Antti', 'Eero', 'Ville', 'Lauri', 'Oskari', 'Tuomas'], AUS: ['Jack', 'Lachlan', 'Mitch', 'Cooper', 'Riley', 'Angus', 'Flynn', 'Darcy'],
  NED: ['Daan', 'Sem', 'Bram', 'Jasper', 'Ruben', 'Thijs', 'Lars', 'Niels'], ARG: ['Mateo', 'Facundo', 'Joaquín', 'Nicolás', 'Tomás', 'Agustín', 'Emiliano', 'Franco'],
};
const LAST: Record<string, string[]> = {
  GBR: ['Ashworth', 'Pemberton', 'Whitlock', 'Hargreave', 'Calloway', 'Stanhope', 'Braddock', 'Merriweather', 'Thackeray', 'Lindqvist-Shaw'], ITA: ['Bellandi', 'Carrazza', 'Montefiore', 'Scarpetti', 'Vianello', 'Rossellini', 'Tagliaferro', 'Bonacorsi', 'Marchetto', 'Devoto'],
  FRA: ['Delacroix', 'Marchand', 'Beaumont', 'Lefèvre', 'Garnier', 'Rousselot', 'Vasseur-Blanc', 'Charpentier', 'Moreau', 'Tessier'], GER: ['Brandt', 'Eisenhardt', 'Falkner', 'Vogelsang', 'Lindemann', 'Reuter', 'Steinbach', 'Kessler', 'Aldinger', 'Wolfram'],
  BRA: ['Cardoso', 'Figueira', 'Nascimento', 'Teixeira', 'Barreto', 'Queiroz', 'Valadares', 'Monteiro', 'Pacheco', 'Sampaio'], ESP: ['Ibarra', 'Castellanos', 'Morales', 'Zubiri', 'Navarro', 'Olmedo', 'Carrasco', 'Benavides', 'Quintana', 'Solís'],
  USA: ['Harlan', 'Whitaker', 'Bledsoe', 'Kincaid', 'Maddox', 'Thornton', 'Prescott', 'Lockhart', 'Sawyer', 'Delaney'], JPN: ['Nakagawa', 'Hoshino-Abe', 'Matsuura', 'Kuroda', 'Fujikawa', 'Onishi', 'Takeda', 'Mizuno', 'Sakamoto', 'Ueda'],
  FIN: ['Koskinen', 'Lehtonen', 'Virtanen', 'Salminen', 'Rautio', 'Heikkilä', 'Nurmi', 'Laaksonen', 'Peltola', 'Järvinen'], AUS: ['Harrington', 'McAllister', 'Whitfield', 'Garrity', 'Thorne', 'Kavanagh', 'Brightwell', 'Sutherland', 'Rowe', 'Dunmore'],
  NED: ['van Dijk', 'de Graaf', 'Hoekstra', 'Verbeek', 'Kuipers', 'van Leeuwen', 'Bosman', 'Dekker', 'Smeets', 'Postma'], ARG: ['Ferreyra', 'Giménez', 'Paredes', 'Acosta', 'Villalba', 'Ledesma', 'Quiroga', 'Bustos', 'Maldonado', 'Cabrera'],
};
const NATS = Object.keys(FIRST);
const PRIVATEERS: [string, string, string][] = [
  ['Scuderia Aurora', '#d4a017', '#1a1a2e'], ['Kestrel Racing', '#2a9d8f', '#f1f1f1'], ['Team Nordwind', '#1d4e89', '#f4d35e'], ['Ashford Engineering', '#3a5a40', '#dad7cd'],
  ['Écurie Lumière', '#5f0f40', '#f2e9e4'], ['Vortex Motorsport', '#7b2cbf', '#e0aaff'], ['Pacific Racing Developments', '#0077b6', '#ff9e00'], ['Blackburn & Hale', '#222222', '#e63946'],
  ['Tasman Speed', '#e76f51', '#264653'], ['Equipe Mistral', '#8ecae6', '#023047'], ['Halvorsen Autosport', '#bc4749', '#f2e8cf'], ['Ridgeline Racing', '#606c38', '#fefae0'],
  ['Silverstream GP', '#adb5bd', '#212529'], ['Corsa Verde', '#2d6a4f', '#ffffff'], ['Atlas Competition', '#9d0208', '#ffba08'], ['Meridian Performance', '#3d348b', '#f7b801'],
];
const SPONSORS = ['Meridian Bank', 'Altus Oil', 'Kestrel Watches', 'Nordlys Telecom', 'Vantor Tools', 'Sable Logistics', 'Orion Insurance', 'Halcyon Airlines'];
const GROUP: Record<Discipline, MsGroup> = { f1: 'f1', hypercar: 'proto', lmdh: 'proto', gt: 'gt', touring: 'touring' };
const LMDH_MAKERS = ['porsche', 'bmw', 'gm', 'honda', 'lamborghini', 'renault'];
const SERIES_WEIGHT: Record<Discipline, number> = { f1: 1, hypercar: 0.8, lmdh: 0.7, gt: 0.4, touring: 0.3 };

export const budgetRef = (regs: Regs, year: number) => regs.budget2020 * cpi(year);
export const playerTeam = (div: MotorsportDivision) => div.championship.teams.find((t) => t.id === div.teamId)!;
export const teamRegs = (t: RaceTeam, year: number) => getRegs(t.ruleset, year);
export const overall = (d: Driver) => 0.45 * d.pace + 0.2 * d.consistency + 0.15 * d.racecraft + 0.1 * d.wet + 0.1 * d.tyre;

export function makeDriver(g: GameState, rng: Rng, level: number, regs: Regs, year: number): Driver {
  const nat = pick(rng, NATS);
  const base = clamp(level + gauss(rng) * 5, 45, 99);
  const a = () => clamp(Math.round(base + gauss(rng) * 6), 40, 99);
  const d: Driver = {
    id: uid(g, 'd'), name: `${pick(rng, FIRST[nat])} ${pick(rng, LAST[nat])}`, nat, age: rndInt(rng, 19, 37),
    pace: clamp(Math.round(base), 40, 99), consistency: a(), racecraft: a(), wet: a(), tyre: a(), salary: 0, contractEnd: year + rndInt(rng, 0, 2), teamId: null, wins: 0, titles: 0,
  };
  d.salary = driverSalary(d, regs, year);
  return d;
}
export const driverSalary = (d: Driver, regs: Regs, year: number) => budgetRef(regs, year) * 0.012 * Math.exp((overall(d) - 70) / 9);

function calendar(discipline: Discipline, year: number, regs: Regs): Round[] {
  const mk = (trackId: string, name: string, month: number, hours: number, scale = 1): Round => {
    const t = TRACK[trackId];
    return { trackId, name, month, hours, laps: hours ? 0 : Math.ceil(regs.raceKm / t.km), done: false, pointsScale: scale };
  };
  if (discipline === 'f1') {
    const ids = ['lakeshore', 'pearl', 'catalan', 'riviera', 'redrock', 'silverdale', 'rheinring', 'ardennes', 'parco', 'kiso', 'serra'];
    const n = Math.min(regs.rounds, ids.length);
    const use = n >= ids.length ? ids : ['riviera', 'ardennes', 'silverdale', 'rheinring', 'parco', 'redrock', 'catalan', 'serra', 'kiso', 'lakeshore', 'pearl'].slice(0, n).sort((a, b) => ids.indexOf(a) - ids.indexOf(b));
    return use.map((id, i) => mk(id, `Grand Prix of ${TRACK[id].country}`, 3 + Math.floor((i * 9) / use.length), 0));
  }
  if (discipline === 'hypercar' || discipline === 'lmdh') {
    const modern = year >= 2012;
    return [mk('pearl', '6 Hours of the Desert Pearl', 3, 6), mk('ardennes', '6 Hours of the Ardennes', 4, 6), mk('ouest', "24 Hours of the Circuit de l'Ouest", 6, 24, 2),
      mk('parco', '6 Hours of the Parco', 7, 6), mk('serra', '6 Hours of Serra Azul', 8, 6), mk('redrock', '6 Hours of Red Rock', 9, 6), mk('kiso', '6 Hours of Kiso', 10, 6),
      ...(modern ? [mk('silverdale', '8 Hours of Silverdale', 11, 8, 1.5)] : [])];
  }
  if (discipline === 'gt') {
    return [mk('parco', 'Parco 2 Hours', 4, 2), mk('silverdale', 'Silverdale 2 Hours', 5, 2), mk('rheinring', 'Rheinring 2 Hours', 5, 2), mk('ardennes', 'Ardennes 6 Hours', 7, 6, 2),
      mk('catalan', 'Turons 2 Hours', 8, 2), mk('redrock', 'Red Rock 2 Hours', 9, 2), mk('kiso', 'Kiso 2 Hours', 9, 2), mk('lakeshore', 'Lakeshore 2 Hours', 10, 2), mk('pearl', 'Desert Pearl 2 Hours', 11, 2)];
  }
  const ids = ['catalan', 'parco', 'rheinring', 'silverdale', 'riviera', 'ardennes', 'redrock', 'serra', 'kiso', 'lakeshore'];
  return ids.map((id, i) => mk(id, `Race of ${TRACK[id].country}`, 3 + Math.floor((i * 9) / ids.length), 0));
}

function aiTeam(g: GameState, name: string, color: string, color2: string, companyId: string | null, tier: number, ruleset: Discipline, year: number): RaceTeam {
  const regs = getRegs(ruleset, year);
  const car = defaultRaceCar(regs, year, color, color2);
  const h = (hashStr(name + year) % 1000) / 1000;
  car.aeroBias = 0.35 + 0.3 * h; car.stiffness = 0.3 + 0.4 * ((h * 7) % 1); car.cooling = 0.4 + 0.3 * ((h * 13) % 1); car.weightEffort = 0.3 + 0.6 * tier;
  return { id: uid(g, 't'), name, companyId, isPlayer: false, color, color2, tier, ruleset, car, dev: { aero: 0.1 + 0.55 * tier, engine: 0.1 + 0.55 * tier, chassis: 0.1 + 0.55 * tier, reliability: 0.15 + 0.5 * tier },
    drivers: [], pitCrew: Math.round(50 + 40 * tier), strategy: Math.round(45 + 45 * tier) };
}
function makerEntries(discipline: Discipline, year: number): typeof MAKERS {
  const grp = GROUP[discipline];
  return MAKERS.filter((m) => m.ms.some(([gp, a, b]) => gp === grp && year >= a && year <= b));
}
const makerTier = (id: string, discipline: Discipline, year: number) => 0.55 + 0.4 * ((hashStr(id + discipline + Math.floor(year / 4)) % 1000) / 1000);
const makerRuleset = (id: string, discipline: Discipline, year: number): Discipline => (discipline === 'hypercar' || discipline === 'lmdh') && year >= 2023 ? (LMDH_MAKERS.includes(id) ? 'lmdh' : 'hypercar') : discipline === 'lmdh' ? 'hypercar' : discipline;

function fillGrid(g: GameState, ch: Championship, rng: Rng, playerCompanyId: string | null) {
  const regs = getRegs(ch.discipline, ch.year);
  const want = regs.teams;
  const makers = makerEntries(ch.discipline, ch.year).filter((m) => m.id !== playerCompanyId);
  // drop works teams whose programme has ended, add those that start
  for (const t of [...ch.teams]) {
    if (t.isPlayer || !t.companyId) continue;
    if (!makers.some((m) => m.id === t.companyId)) {
      ch.teams.splice(ch.teams.indexOf(t), 1);
      for (const d of ch.drivers) if (d.teamId === t.id) d.teamId = null;
      news(g, 'motorsport', `${t.name} withdraws`, `The manufacturer ends its ${DISC_NAME[ch.discipline]} programme.`);
    }
  }
  for (const m of makers) {
    if (ch.teams.some((t) => t.companyId === m.id)) continue;
    const t = aiTeam(g, `${m.name} Works Team`, m.color, m.color2, m.id, makerTier(m.id, ch.discipline, ch.year), makerRuleset(m.id, ch.discipline, ch.year), ch.year);
    ch.teams.push(t);
    if (ch.results.length || ch.teams.length > 3) news(g, 'motorsport', `${m.name} enters ${ch.name}`, 'A new works team joins the grid.');
  }
  const used = new Set(ch.teams.map((t) => t.name));
  const pool = shuffle(rng, PRIVATEERS.filter((p) => !used.has(p[0])));
  while (ch.teams.length < want && pool.length) {
    const p = pool.pop()!;
    ch.teams.push(aiTeam(g, p[0], p[1], p[2], null, rndRange(rng, 0.12, 0.62), makerRuleset('', ch.discipline, ch.year), ch.year));
  }
  while (ch.teams.length > Math.max(want, 2)) { // trim the weakest privateers
    const weakest = ch.teams.filter((t) => !t.isPlayer && !t.companyId).sort((a, b) => a.tier - b.tier)[0] ?? ch.teams.filter((t) => !t.isPlayer).sort((a, b) => a.tier - b.tier)[0];
    if (!weakest) break;
    ch.teams.splice(ch.teams.indexOf(weakest), 1);
    for (const d of ch.drivers) if (d.teamId === weakest.id) d.teamId = null;
  }
  // seats
  const seats = regs.carsPerTeam * regs.driversPerCar;
  for (const t of ch.teams) t.drivers = t.drivers.filter((id) => ch.drivers.some((d) => d.id === id && d.teamId === t.id));
  const need = ch.teams.length * seats + 10;
  while (ch.drivers.length < need) ch.drivers.push(makeDriver(g, rng, rndRange(rng, 58, 86), regs, ch.year));
  const free = () => ch.drivers.filter((d) => !d.teamId).sort((a, b) => overall(b) - overall(a));
  for (const t of [...ch.teams].filter((x) => !x.isPlayer).sort((a, b) => b.tier - a.tier)) {
    while (t.drivers.length < seats) {
      const f = free(); if (!f.length) break;
      const d = f[Math.min(f.length - 1, Math.floor(Math.abs(gauss(rng)) * 2.5 + (1 - t.tier) * 3))];
      d.teamId = t.id; d.contractEnd = Math.max(d.contractEnd, ch.year + rndInt(rng, 0, 2)); t.drivers.push(d.id);
    }
  }
}

export function createChampionship(g: GameState, discipline: Discipline, year: number, rng: Rng, playerCompanyId: string | null): Championship {
  const regs = getRegs(discipline, year);
  const base: Discipline = discipline === 'lmdh' ? 'hypercar' : discipline;
  const ch: Championship = { discipline: base, year, name: `${getRegs(base, year).seriesName}`, rounds: calendar(base, year, getRegs(base, year)), nextRound: 0, teams: [], drivers: [], driverPoints: {}, teamPoints: {}, results: [] };
  void regs;
  fillGrid(g, ch, rng, playerCompanyId);
  return ch;
}

export interface DivisionOpts { discipline: Discipline; teamName: string; color: string; color2: string; facilities: number; staff: number; ownerGrant: number; sponsorLevel: number; target: number }

export function createDivision(g: GameState, c: Company, o: DivisionOpts, rng: Rng): MotorsportDivision {
  const ch = createChampionship(g, o.discipline, g.year, rng, c.dataId);
  const regs = getRegs(o.discipline, g.year);
  const B = budgetRef(regs, g.year);
  // the player replaces the weakest privateer so the grid size stays the same
  const drop = ch.teams.filter((t) => !t.companyId).sort((a, b) => a.tier - b.tier)[0];
  if (drop && ch.teams.length >= getRegs(ch.discipline, g.year).teams) { ch.teams.splice(ch.teams.indexOf(drop), 1); for (const d of ch.drivers) if (d.teamId === drop.id) d.teamId = null; }
  const team: RaceTeam = {
    id: uid(g, 't'), name: o.teamName, companyId: c.id, isPlayer: true, color: o.color, color2: o.color2, tier: 0.5, ruleset: o.discipline,
    car: defaultRaceCar(regs, g.year, o.color, o.color2), dev: { aero: 0.08 + o.staff / 400, engine: 0.08 + o.staff / 400, chassis: 0.08 + o.staff / 400, reliability: 0.1 + o.staff / 400 },
    drivers: [], pitCrew: o.staff, strategy: o.staff,
  };
  ch.teams.push(team);
  const div: MotorsportDivision = {
    discipline: o.discipline, teamId: team.id, teamName: o.teamName, founded: g.year, championship: ch,
    facilities: { windTunnel: o.facilities, simulator: o.facilities, workshop: o.facilities, engineShop: o.facilities },
    staff: { technical: o.staff, aero: o.staff, raceOps: o.staff, strategy: o.staff },
    devBudget: (B * 0.2) / 12, devFocus: { aero: 1, engine: 1, chassis: 1, reliability: 1 }, ownerGrant: o.ownerGrant,
    sponsors: [], history: [], seasonIncome: 0, seasonCost: 0, carDesignedYear: g.year,
    objective: { id: 'pos', kind: 'position', text: `Finish in the top ${o.target} of the teams' championship`, target: o.target, byYear: g.year + 1, progress: 0, done: false, failed: false },
  };
  const names = shuffle(rng, [...SPONSORS]);
  const total = B * o.sponsorLevel;
  div.sponsors = [{ name: names[0], annual: total * 0.6 }, { name: names[1], annual: total * 0.4 }].filter((s) => s.annual > 0);
  ensureDrivers(g, div, rng, true);
  // skip rounds that have already passed this year
  for (const r of ch.rounds) if (r.month < g.month) { r.done = true; ch.nextRound++; }
  return div;
}

/** Fill empty seats with the best affordable free agents (used at creation and as a safety net before a race). */
export function ensureDrivers(g: GameState, div: MotorsportDivision, rng: Rng, initial = false) {
  const ch = div.championship, team = playerTeam(div);
  const regs = teamRegs(team, ch.year);
  const seats = regs.carsPerTeam * regs.driversPerCar;
  team.drivers = team.drivers.filter((id) => ch.drivers.some((d) => d.id === id && d.teamId === team.id));
  while (team.drivers.length < seats) {
    const free = ch.drivers.filter((d) => !d.teamId).sort((a, b) => overall(b) - overall(a));
    if (!free.length) { ch.drivers.push(makeDriver(g, rng, 60, regs, ch.year)); continue; }
    const d = initial ? free[Math.min(free.length - 1, 3 + team.drivers.length)] : free[free.length - 1 - Math.min(2, free.length - 1)];
    d.teamId = team.id; d.contractEnd = ch.year + (initial ? 1 : 0); team.drivers.push(d.id);
    if (!initial) news(g, 'motorsport', `${d.name} drafted in`, `With a seat empty before the race, ${team.name} signs ${d.name} for the rest of the season.`);
  }
}

export function divisionTech(c: Company, div: MotorsportDivision, year: number): { techYear: number; quality: number } {
  const hasRoadCars = c.factories.length > 0;
  const parent = hasRoadCars ? (c.tech.engine + c.tech.aero + c.tech.chassis) / 3 : year - 1;
  return { techYear: Math.max(parent, year - 2) + div.staff.technical / 50, quality: clamp(0.4 + div.staff.technical / 220 + div.facilities.engineShop * 0.04, 0.3, 1) };
}

const wingCache = new Map<string, number>();
function bestWing(team: RaceTeam, regs: Regs, techYear: number, quality: number, trackId: string, year: number): number {
  const key = `${team.id}:${trackId}:${year}:${team.dev.aero.toFixed(2)}`;
  const hit = wingCache.get(key); if (hit !== undefined) return hit;
  const geom = trackGeom(trackId);
  let best = 0.5, bt = 1e9;
  for (const w of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    const p = computeRaceCar(team.car, team.dev, regs, techYear, w, quality);
    const t = lapSim(geom, { mass: p.mass + 30, powerW: p.powerKw * 900, cdA: p.cdA, clA: p.clA, mu: p.mu, awd: p.awd }).time;
    if (t < bt) { bt = t; best = w; }
  }
  if (wingCache.size > 500) wingCache.clear();
  wingCache.set(key, best);
  return best;
}
export function wingTable(c: Company, div: MotorsportDivision, trackId: string): { wing: number; time: number; vMax: number }[] {
  const team = playerTeam(div), regs = teamRegs(team, div.championship.year), { techYear, quality } = divisionTech(c, div, div.championship.year), geom = trackGeom(trackId);
  return [0, 0.25, 0.5, 0.75, 1].map((w) => {
    const p = computeRaceCar(team.car, team.dev, regs, techYear, w, quality);
    const r = lapSim(geom, { mass: p.mass + 30, powerW: p.powerKw * 900, cdA: p.cdA, clA: p.clA, mu: p.mu, awd: p.awd });
    return { wing: w, time: r.time, vMax: r.vMax * 3.6 };
  });
}

export interface PlayerRaceChoices { wing: number[]; startCompound: (string | undefined)[]; auto: boolean[] }

const roundSeed = (g: GameState, ch: Championship) => hashStr(`${g.id}:${ch.year}:${ch.nextRound}:${ch.discipline}`);
/** Weather for the next round. Pure: safe to call while rendering the race briefing. */
export function raceWeather(g: GameState, div: MotorsportDivision): Weather {
  const ch = div.championship, round = ch.rounds[ch.nextRound], track = TRACK[round.trackId];
  const duration = round.hours ? round.hours * 3600 : round.laps * (track.km / 5.5) * 100;
  return makeWeather(track, duration, makeRng(roundSeed(g, ch) ^ 0x51ed27));
}

export function buildRaceConfig(g: GameState, c: Company, div: MotorsportDivision, choices?: PlayerRaceChoices): RaceConfig {
  const ch = div.championship;
  const round = ch.rounds[ch.nextRound];
  const seed = roundSeed(g, ch);
  const rng = makeRng(seed ^ 0x9e3779b9);
  ensureDrivers(g, div, rng);
  const baseRegs = getRegs(ch.discipline, ch.year);
  const entries: RaceEntry[] = [];
  let num = 1;
  for (const team of ch.teams) {
    let regs = teamRegs(team, ch.year);
    let spec = team.car;
    if (checkLegal(raceEngineSpec(spec.engine, regs), regs).length) { // an illegal car is replaced by a conservative legal customer engine
      spec = { ...spec, engine: defaultRaceCar(regs, ch.year).engine };
      if (team.isPlayer) news(g, 'motorsport', 'Scrutineering: engine not legal', 'Your race engine does not comply with this season\'s regulations. A detuned customer unit is fitted for this event — redesign the car.');
    }
    const tq = team.isPlayer ? divisionTech(c, div, ch.year) : { techYear: ch.year - 1 + team.tier * 3, quality: 0.45 + 0.45 * team.tier };
    const autoWing = bestWing({ ...team, car: spec }, regs, tq.techYear, tq.quality, round.trackId, ch.year);
    for (let i = 0; i < regs.carsPerTeam; i++) {
      const ids = team.drivers.slice(i * regs.driversPerCar, (i + 1) * regs.driversPerCar);
      const drivers = ids.map((id) => ch.drivers.find((d) => d.id === id)!).filter(Boolean);
      if (!drivers.length) continue;
      const wing = team.isPlayer && choices ? choices.wing[i] ?? autoWing : clamp(autoWing + (rnd(rng) - 0.5) * 0.2, 0, 1);
      const perf = computeRaceCar(spec, team.dev, regs, tq.techYear, wing, tq.quality);
      entries.push({
        id: `${team.id}:${i}`, teamId: team.id, teamName: team.name, carIdx: i, number: num++, color: team.color, color2: team.color2, isPlayer: team.isPlayer,
        drivers, perf, pitCrew: team.isPlayer ? div.staff.raceOps : team.pitCrew, strategy: team.isPlayer ? div.staff.strategy : team.strategy, wing,
        startCompound: team.isPlayer ? choices?.startCompound[i] : undefined, auto: team.isPlayer ? choices?.auto[i] ?? true : true,
      });
    }
  }
  const weather = raceWeather(g, div);
  return { seed, trackId: round.trackId, regs: baseRegs, year: ch.year, name: round.name, laps: round.laps, duration: round.hours * 3600, entries, weather, pointsScale: round.pointsScale };
}

export function standings(ch: Championship) {
  const teams = [...ch.teams].sort((a, b) => (ch.teamPoints[b.id] ?? 0) - (ch.teamPoints[a.id] ?? 0) || b.tier - a.tier);
  const drivers = ch.drivers.filter((d) => d.teamId).sort((a, b) => (ch.driverPoints[b.id] ?? 0) - (ch.driverPoints[a.id] ?? 0) || overall(b) - overall(a));
  return { teams, drivers };
}

/** Record a finished race: points, reputation effects, news, AI development, and season end. */
export function applyRaceResult(g: GameState, c: Company, div: MotorsportDivision, sim: RaceSim) {
  const ch = div.championship;
  const round = ch.rounds[ch.nextRound];
  const results = sim.results();
  const regs = getRegs(ch.discipline, ch.year);
  for (const r of results) {
    const entry = sim.cfg.entries.find((e) => e.teamId === r.teamId && e.carIdx === r.carIdx)!;
    for (const d of entry.drivers) ch.driverPoints[d.id] = (ch.driverPoints[d.id] ?? 0) + r.points;
    ch.teamPoints[r.teamId] = (ch.teamPoints[r.teamId] ?? 0) + r.points;
    if (r.pos === 1 && r.status === 'finished') for (const d of entry.drivers) d.wins++;
  }
  const fast = sim.fastest.idx >= 0 ? sim.cars[sim.fastest.idx].e.drivers[0].name : '';
  ch.results.push({ round: ch.nextRound, trackId: round.trackId, name: round.name, results, fastest: fast, weather: sim.cfg.weather.label });
  round.done = true; ch.nextRound++;
  const mine = results.filter((r) => r.teamId === div.teamId);
  const best = mine.reduce((a, r) => (r.status === 'finished' && r.pos < a ? r.pos : a), 99);
  const w = SERIES_WEIGHT[div.discipline] * round.pointsScale;
  const winner = results[0];
  const wTeam = ch.teams.find((t) => t.id === winner.teamId)!;
  const wDrv = ch.drivers.find((d) => d.id === winner.driverId);
  if (best === 1) { c.msGlow += 3 * w; news(g, 'motorsport', `Victory at the ${round.name}!`, `${div.teamName} wins. ${mine.map((r) => `Car ${r.carIdx + 1}: ${r.status === 'finished' ? 'P' + r.pos : 'DNF (' + r.reason + ')'}`).join(' · ')}`, 'win'); }
  else {
    if (best <= 3) c.msGlow += 1.2 * w; else if (best <= 6) c.msGlow += 0.3 * w;
    news(g, 'motorsport', `${round.name}: ${wDrv?.name ?? '—'} wins for ${wTeam.name}`, `${div.teamName}: ${mine.map((r) => `Car ${r.carIdx + 1} ${r.status === 'finished' ? 'P' + r.pos : 'DNF (' + r.reason + ')'}`).join(' · ')}`);
  }
  if (wTeam.companyId && !wTeam.isPlayer) { const comp = g.companies.find((x) => x.id === wTeam.companyId); if (comp) { comp.prestige = Math.min(100, comp.prestige + 0.15 * w); comp.sportiness = Math.min(100, comp.sportiness + 0.25 * w); } }
  for (const t of ch.teams) if (!t.isPlayer) for (const k of ['aero', 'engine', 'chassis', 'reliability'] as (keyof DevLevels)[]) t.dev[k] = Math.min(1, t.dev[k] + (0.012 + 0.03 * t.tier) * (1 - t.dev[k]));
  void regs;
  if (ch.nextRound >= ch.rounds.length) endSeason(g, c, div);
}

/** Simulate the next round without watching it. */
export function quickSimRound(g: GameState, c: Company, div: MotorsportDivision) {
  const sim = new RaceSim(buildRaceConfig(g, c, div));
  sim.runToEnd();
  applyRaceResult(g, c, div, sim);
  return sim;
}

function endSeason(g: GameState, c: Company, div: MotorsportDivision) {
  const ch = div.championship;
  const regs = getRegs(ch.discipline, ch.year);
  const B = budgetRef(regs, ch.year);
  const st = standings(ch);
  const champT = st.teams[0], champD = st.drivers[0];
  const pos = st.teams.findIndex((t) => t.id === div.teamId) + 1;
  const n = st.teams.length;
  const prize = B * 0.5 * Math.pow(1 - (pos - 1) / n, 1.5);
  receive(c, prize); div.seasonIncome += prize;
  if (champD) champD.titles++;
  const w = SERIES_WEIGHT[div.discipline];
  if (pos === 1) c.msGlow += 9 * w; else if (pos <= 3) c.msGlow += 3 * w;
  if (champT.companyId && !champT.isPlayer) { const comp = g.companies.find((x) => x.id === champT.companyId); if (comp) comp.prestige = Math.min(100, comp.prestige + 1.5 * w); }
  div.history.push({ year: ch.year, discipline: div.discipline, driverChampion: champD ? `${champD.name}` : '—', teamChampion: champT.name, playerTeamPos: pos, playerPoints: ch.teamPoints[div.teamId] ?? 0 });
  const mult = clamp(1.25 - 0.5 * ((pos - 1) / Math.max(1, n - 1)), 0.8, 1.25);
  for (const s of div.sponsors) s.annual *= mult;
  news(g, 'motorsport', `${ch.year} ${ch.name}: ${champT.name} are champions`, `Drivers' title: ${champD?.name ?? '—'}. ${div.teamName} finish P${pos} of ${n} and receive $${(prize / 1e6).toFixed(1)}M in prize money. Sponsors ${mult >= 1 ? 'raise' : 'cut'} their backing by ${Math.abs(Math.round((mult - 1) * 100))}%.`, pos === 1 ? 'win' : undefined);
  if (div.objective && !div.objective.done) {
    div.objective.progress = pos;
    if (pos <= div.objective.target) { div.objective.done = true; if (c.board) c.board.confidence = Math.min(100, c.board.confidence + 20); news(g, 'motorsport', 'Season objective achieved', div.objective.text); }
    else if (ch.year >= div.objective.byYear) {
      const miss = pos - div.objective.target;
      if (c.board) c.board.confidence -= Math.min(22, 8 + 4 * miss) * (g.difficulty === 'hard' ? 1.3 : g.difficulty === 'easy' ? 0.7 : 1);
      news(g, 'motorsport', 'Season objective missed', `${div.objective.text} — the owners are losing patience and reset their expectations.`);
      const tgt = Math.min(n, Math.max(div.objective.target, pos - 1)); // expectations follow reality, confidence does not
      div.objective = { id: 'pos', kind: 'position', text: `Finish in the top ${tgt} of the teams' championship`, target: tgt, byYear: ch.year + 1, progress: pos, done: false, failed: false };
    } else if (c.board && pos <= div.objective.target + 1) c.board.confidence = Math.min(100, c.board.confidence + 4);
  } else if (div.objective?.done) {
    // owners now expect you to hold what you achieved (and to improve only if you already beat the target)
    const tgt = Math.max(1, Math.min(pos + 1, div.objective.target));
    if (c.board && pos <= tgt) c.board.confidence = Math.min(100, c.board.confidence + 5);
    div.objective = { id: 'pos', kind: 'position', text: `Finish in the top ${tgt} of the teams' championship`, target: tgt, byYear: ch.year + 2, progress: 0, done: false, failed: false };
  }
}

/** January: build the new season (new regulations, driver market, AI line-up, development carry-over). */
export function startSeason(g: GameState, c: Company, div: MotorsportDivision, rng: Rng) {
  const old = div.championship;
  if (old.nextRound < old.rounds.length && old.results.length) endSeason(g, c, div);
  const year = g.year;
  const oldRegs = getRegs(old.discipline, old.year), regs = getRegs(old.discipline, year);
  const changed = oldRegs.className !== regs.className;
  if (changed) news(g, 'motorsport', `New regulations: ${regs.className}`, regs.note, 'historical');
  // drivers: ageing, development, retirements, contracts
  for (const d of old.drivers) {
    d.age++;
    const delta = d.age < 25 ? rndRange(rng, 0, 2.5) : d.age > 33 ? -rndRange(rng, 0, 2.5) : rndRange(rng, -0.8, 0.8);
    d.pace = clamp(Math.round(d.pace + delta), 40, 99); d.consistency = clamp(Math.round(d.consistency + (d.age < 30 ? 0.8 : -0.3)), 40, 99);
    d.salary = driverSalary(d, regs, year);
  }
  const player = playerTeam(div);
  for (const d of [...old.drivers]) {
    const retiring = d.age >= 41 || (d.age >= 37 && chance(rng, 0.3));
    const expired = d.contractEnd < year;
    if (d.teamId === player.id) {
      if (retiring || expired) { news(g, 'motorsport', retiring ? `${d.name} retires` : `${d.name}'s contract has ended`, retiring ? 'A seat is open for next season.' : 'The driver is now a free agent. Re-sign or replace before the first race.'); d.teamId = null; }
    } else if (d.teamId && (retiring || (expired && chance(rng, 0.35)))) d.teamId = null;
    else if (d.teamId && expired) d.contractEnd = year + rndInt(rng, 0, 2);
    if (retiring) old.drivers.splice(old.drivers.indexOf(d), 1);
  }
  for (let i = 0; i < 6; i++) { const r = makeDriver(g, rng, rndRange(rng, 60, 84), regs, year); r.age = rndInt(rng, 18, 22); old.drivers.push(r); }
  const ch: Championship = { discipline: old.discipline, year, name: regs.seriesName, rounds: calendar(old.discipline, year, regs), nextRound: 0, teams: old.teams, drivers: old.drivers, driverPoints: {}, teamPoints: {}, results: [] };
  const keep = changed ? 0.2 : 0.55;
  for (const t of ch.teams) {
    for (const k of ['aero', 'engine', 'chassis', 'reliability'] as (keyof DevLevels)[]) t.dev[k] *= keep;
    if (!t.isPlayer) {
      t.tier = clamp(t.companyId ? makerTier(t.companyId, ch.discipline, year) : t.tier + (rnd(rng) - 0.5) * 0.15, 0.1, 0.97);
      t.ruleset = makerRuleset(t.companyId ?? '', ch.discipline, year);
      const r = getRegs(t.ruleset, year);
      if (changed || checkLegal(raceEngineSpec(t.car.engine, r), r).length) { const nc = defaultRaceCar(r, year, t.color, t.color2); nc.aeroBias = t.car.aeroBias; nc.stiffness = t.car.stiffness; nc.cooling = t.car.cooling; nc.weightEffort = t.car.weightEffort; t.car = nc; }
      for (const k of ['aero', 'engine', 'chassis', 'reliability'] as (keyof DevLevels)[]) t.dev[k] = Math.max(t.dev[k], 0.08 + 0.45 * t.tier);
    }
  }
  div.championship = ch;
  fillGrid(g, ch, rng, c.dataId);
  div.seasonIncome = 0; div.seasonCost = 0;
  // the whole paddock's money moves with the era: funding, sponsorship and spending plans scale with the category's budget level
  const ratio = budgetRef(regs, year) / budgetRef(oldRegs, old.year);
  div.ownerGrant *= ratio; div.devBudget *= ratio;
  for (const s of div.sponsors) s.annual *= ratio;
}

/** Monthly running costs, income and car development of the player's race team. */
export function motorsportMonth(g: GameState, c: Company): { cost: number; income: number } {
  const div = c.motorsport; if (!div) return { cost: 0, income: 0 };
  const ch = div.championship, team = playerTeam(div);
  const regs = teamRegs(team, ch.year);
  const B = budgetRef(regs, g.year);
  const staffAvg = (div.staff.technical + div.staff.aero + div.staff.raceOps + div.staff.strategy) / 4;
  const fac = div.facilities.windTunnel + div.facilities.simulator + div.facilities.workshop + div.facilities.engineShop;
  const salaries = team.drivers.reduce((a, id) => a + (ch.drivers.find((d) => d.id === id)?.salary ?? 0), 0);
  const costMult = modProduct(g, (m) => m.motorsportCost);
  const cost = ((B * 0.25 * (0.5 + staffAvg / 100) + B * 0.03 * (fac / 4) + B * 0.35 + salaries) / 12 + div.devBudget) * costMult;
  const income = (div.sponsors.reduce((a, s) => a + s.annual, 0) + div.ownerGrant) / 12;
  div.seasonCost += cost; div.seasonIncome += income;
  // development: diminishing returns on spend, scaled by staff and the relevant facility
  const pts = Math.pow(div.devBudget / ((B * 0.3) / 12), 0.6) * (0.5 + div.staff.technical / 100) * 0.05;
  const f = div.devFocus; const fs = f.aero + f.engine + f.chassis + f.reliability || 1;
  const facF = { aero: div.facilities.windTunnel, engine: div.facilities.engineShop, chassis: (div.facilities.simulator + div.facilities.workshop) / 2, reliability: div.facilities.workshop };
  for (const k of ['aero', 'engine', 'chassis', 'reliability'] as (keyof DevLevels)[]) {
    const staffF = k === 'aero' ? 0.5 + div.staff.aero / 100 : 1;
    team.dev[k] = Math.min(1, team.dev[k] + pts * ((f[k] / fs) * 4) * (0.4 + facF[k] / 5) * staffF * (1 - team.dev[k]) * 0.5);
  }
  team.pitCrew = div.staff.raceOps; team.strategy = div.staff.strategy;
  return { cost, income };
}

export function pendingRound(g: GameState, c: Company): Round | null {
  const div = c.motorsport; if (!div) return null;
  const ch = div.championship;
  if (ch.year !== g.year) return null;
  const r = ch.rounds[ch.nextRound];
  return r && !r.done && r.month <= g.month ? r : null;
}
export function divisionTechInfo(c: Company, div: MotorsportDivision, year: number): Tech {
  const t = divisionTech(c, div, year).techYear;
  return { engine: t, chassis: t, aero: t, electronics: t, manufacturing: t };
}
