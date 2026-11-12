// Game creation for the three modes and the monthly world tick.
// All three modes build the SAME world (every historical manufacturer of the chosen year as a
// full Company, the same market, events and championships) — they differ only in which company
// the player controls and what that company starts with.
import type { Company, Difficulty, Discipline, GameMode, GameState, HistoryMode, Objective, RegionId } from './types';
import { MAKER, MAKERS, makerStart, type MakerDef } from '../data/manufacturers';
import { COUNTRY, REGION_IDS, SEGMENT_IDS } from '../data/world';
import { companyFromMaker, runAiMonth, runAiYear } from './ai';
import { annualProfit, annualUnits, creditLimit, engineerCost, factoryBuildCost, industryTech, INTEREST_BASE, news, refreshStats, runPlayerMonth, uid, zeroRegions } from './company';
import { buildSchedule, fireHistorical, rollRandomEvent } from './events';
import { computeMarket, modelWeights, segVolume } from './market';
import { gauss, hashStr, makeRng } from './rng';
import { clamp, cpi, kf, MONTHS } from './util';
import { getRegs, disciplineAvailable } from './racing/regs';
import { adoptFamilies } from './families';
import { updateFx } from './regional';
import { breakEvenGrant, sponsorTarget, budgetRef, createDivision, motorsportMonth, pendingRound, quickSimRound, startSeason } from './racing/season';
import { emptyPending, openBooks } from './accounts';

export const player = (g: GameState): Company => g.companies.find((c) => c.id === g.playerId)!;
export const dateLabel = (g: GameState) => `${MONTHS[g.month - 1]} ${g.year}`;
import { SAVE_VERSION } from './migrate';
export { SAVE_VERSION };

function baseGame(mode: GameMode, year: number, difficulty: Difficulty, historyMode: HistoryMode, name: string, playerMaker: string | null, fixedSeed?: number): GameState {
  // a fixed seed makes a new game fully reproducible (used by the automated tests)
  const seed = (fixedSeed ?? (Date.now() ^ hashStr(name + year + mode))) >>> 0;
  const g: GameState = {
    version: SAVE_VERSION, id: `g${seed.toString(36)}`, name, mode, difficulty, historyMode, year, month: 1, startYear: year, rng: makeRng(seed), playerId: '', companies: [],
    macro: { fuelPrice: 1, materialCost: 1, interestBase: kf(INTEREST_BASE, year), modifiers: [], cycle: 0 }, otherShare: {}, news: [], decision: null,
    schedule: [], fired: [], gameOver: null, nextId: 1, savedAt: 0,
  };
  g.schedule = buildSchedule(historyMode, year, g.rng);
  for (const def of MAKERS) if (makerStart(def) <= year) g.companies.push(companyFromMaker(g, def, mode !== 'motorsport' && def.id === playerMaker));
  // share of every market cell served by manufacturers that are not individually simulated
  const sum: Record<string, number> = {};
  for (const c of g.companies) {
    if (c.isPlayer && mode === 'founder') continue;
    const w = modelWeights(c);
    for (const m of c.models) { const wm = w.get(m.id); if (!wm) continue; for (const r of REGION_IDS) sum[`${r}:${m.segment}`] = (sum[`${r}:${m.segment}`] ?? 0) + c.reach[r] * wm; }
  }
  for (const r of REGION_IDS) for (const s of SEGMENT_IDS) g.otherShare[`${r}:${s}`] = clamp(1 - (sum[`${r}:${s}`] ?? 0) / segVolume(r, s, year), 0.15, 0.97);
  return g;
}

function boardObjectives(g: GameState, c: Company, def: MakerDef): Objective[] {
  const y = g.year;
  const out: Objective[] = [
    { id: uid(g, 'o'), kind: 'profit', text: `Deliver a cumulative net profit over ${y}–${y + 2}`, target: 0, byYear: y + 3, progress: 0, done: false, failed: false },
  ];
  const health = kf(def.health, y);
  if (health < 0.3) out.push({ id: uid(g, 'o'), kind: 'debt', text: `Cut debt below $${(c.debt * 0.6 / 1e6).toFixed(0)}M by the end of ${y + 3}`, target: c.debt * 0.6, byYear: y + 4, progress: c.debt, done: false, failed: false });
  else { const tgt = Math.round((c.baseVolume * (def.archetype === 'exotic' ? 1.12 : 1.2)) / 10) * 10; out.push({ id: uid(g, 'o'), kind: 'volume', text: `Sell at least ${tgt.toLocaleString()} cars a year by ${y + 4}`, target: tgt, byYear: y + 5, progress: 0, done: false, failed: false }); }
  if (def.archetype === 'mass') out.push({ id: uid(g, 'o'), kind: 'reliability', text: `Raise the reliability reputation to ${Math.min(95, Math.round(c.reliabilityRep + 5))}`, target: Math.min(95, Math.round(c.reliabilityRep + 5)), byYear: y + 6, progress: c.reliabilityRep, done: false, failed: false });
  else out.push({ id: uid(g, 'o'), kind: 'prestige', text: `Keep brand prestige at ${Math.round(Math.max(55, c.prestige - 2))} or higher`, target: Math.round(Math.max(55, c.prestige - 2)), byYear: y + 6, progress: c.prestige, done: false, failed: false });
  return out;
}

export interface CeoSetup { makerId: string; year: number; difficulty: Difficulty; historyMode: HistoryMode; seed?: number }
export function newCeoGame(o: CeoSetup): GameState {
  const def = MAKER[o.makerId];
  const g = baseGame('ceo', o.year, o.difficulty, o.historyMode, `${def.name} ${o.year}`, o.makerId, o.seed);
  const c = g.companies.find((x) => x.id === o.makerId)!;
  g.playerId = c.id;
  const k = o.difficulty === 'easy' ? 1.4 : o.difficulty === 'hard' ? 0.7 : 1;
  c.cash *= k; c.debt = Math.min(c.debt * (2 - k), creditLimit(c, o.year) * 0.6);
  const era = def.eras.find((e) => o.year >= e.from && o.year <= e.to) ?? def.eras[0];
  c.board = { confidence: 60, objectives: boardObjectives(g, c, def), note: era.text };
  // an existing works racing programme comes with the job
  const prog = (['f1', 'proto', 'gt', 'touring'] as const).find((grp) => def.ms.some(([gp, a, b]) => gp === grp && o.year >= a && o.year <= b));
  if (prog) {
    const disc: Discipline = prog === 'proto' ? (o.year >= 2023 && ['porsche', 'bmw', 'gm', 'honda', 'lamborghini', 'renault'].includes(def.id) ? 'lmdh' : 'hypercar') : prog;
    if (disciplineAvailable(disc, o.year)) c.motorsport = createDivision(g, c, { discipline: disc, teamName: `${def.name} Works Team`, color: def.color, color2: def.color2, facilities: 3, staff: 72, ownerGrant: 0, sponsorLevel: 0.45, target: 3, scale: 1.1 }, g.rng);
  }
  news(g, 'company', `You are the new CEO of ${def.name}`, era.text, 'historical');
  if (def.ownershipNote) news(g, 'company', 'A note on ownership', def.ownershipNote);
  adoptFamilies(g, c);
  openBooks(player(g));
  return g;
}

export const SPECIALIZATIONS = [
  { id: 'sports', name: 'Sports cars', blurb: '+2 tech-years in chassis and aerodynamics, a sporty brand image.' },
  { id: 'luxury', name: 'Luxury & grand touring', blurb: 'Higher starting prestige and a craft workforce.' },
  { id: 'mass', name: 'Affordable cars', blurb: '+2 tech-years in manufacturing and a wider starting dealer network.' },
  { id: 'offroad', name: 'Utility & off-road', blurb: 'A reputation for toughness: reliability bonus.' },
  { id: 'ev', name: 'Electric vehicles', blurb: '+3 tech-years in powertrain and electronics (from 2005).' },
] as const;
export const FACTORY_SIZES = [{ name: 'None — contract a plant later', cap: 0 }, { name: 'Workshop (60 cars / month)', cap: 60 }, { name: 'Small plant (600 / month)', cap: 600 }, { name: 'Volume plant (5,000 / month)', cap: 5000 }];
export const ENGINEER_LEVELS = [{ name: 'Skeleton crew (25)', n: 25 }, { name: 'Design office (80)', n: 80 }, { name: 'Engineering centre (220)', n: 220 }];
export const RESEARCH_LEVELS = [{ name: 'Supplier technology (4 years behind)', lead: -4, cost: 0 }, { name: 'Up to date (1 year behind)', lead: -1, cost: 14e6 }, { name: 'Advanced laboratory (1 year ahead)', lead: 1, cost: 40e6 }];
export const WORKFORCE_LEVELS = [{ name: 'Craftsmen (hand-built)', auto: 0.05 }, { name: 'Conventional line', auto: 0.3 }, { name: 'Automated line', auto: 0.6 }];
export const capitalOptions = (year: number) => [80e6, 250e6, 800e6, 2500e6].map((v) => Math.round((v * cpi(year) * kf([[1950, 0.35], [1980, 0.6], [2010, 1]], year)) / 1e5) * 1e5);

export interface FounderSetup {
  name: string; country: string; year: number; capital: number; specialization: string; factory: number; engineers: number; research: number; workforce: number;
  color: string; difficulty: Difficulty; historyMode: HistoryMode;
  seed?: number;
}
export function founderCosts(o: FounderSetup) {
  const f = FACTORY_SIZES[o.factory];
  const auto = Math.min(WORKFORCE_LEVELS[o.workforce].auto, o.year < 1972 ? 0.3 : o.year < 1992 ? 0.6 : 0.8);
  const factory = f.cap ? factoryBuildCost(f.cap, auto, o.year) : 0;
  const eng = ENGINEER_LEVELS[o.engineers].n * 1.6 * 170 * (COUNTRY[o.country].wage2020 * kf(COUNTRY[o.country].wageCurve, o.year) * cpi(o.year)) * 3;
  const research = RESEARCH_LEVELS[o.research].cost * cpi(o.year) * kf([[1950, 0.15], [1980, 0.45], [2000, 0.8], [2020, 1]], o.year);
  return { factory, eng, research, total: factory + eng + research, auto };
}
export function newFounderGame(o: FounderSetup): GameState {
  const g = baseGame('founder', o.year, o.difficulty, o.historyMode, `${o.name} ${o.year}`, null, o.seed);
  const region: RegionId = COUNTRY[o.country].region;
  const costs = founderCosts(o);
  const tech = industryTech(o.year, RESEARCH_LEVELS[o.research].lead);
  const sp = o.specialization;
  if (sp === 'sports') { tech.chassis += 2; tech.aero += 2; }
  if (sp === 'mass') tech.manufacturing += 2;
  if (sp === 'ev') { tech.engine += 3; tech.electronics += 3; }
  const reach = zeroRegions(), awareness = zeroRegions();
  reach[region] = (sp === 'mass' ? 4000 : 900) * (o.capital / capitalOptions(o.year)[1]) ** 0.5;
  for (const r of REGION_IDS) awareness[r] = r === region ? 18 : 4;
  const c: Company = {
    id: 'player', name: o.name, country: o.country, homeRegion: region, color: o.color, color2: '#f2f2f2', founded: o.year, isPlayer: true, dataId: null,
    cash: o.capital - costs.total, debt: 0, interestRate: 0.06, reach, awareness,
    prestige: sp === 'luxury' ? 38 : sp === 'sports' ? 30 : 18, reliabilityRep: sp === 'offroad' ? 62 : 50, sportiness: sp === 'sports' ? 55 : 25,
    factories: [], models: [], tech, rdBudget: { engine: 0, chassis: 0, aero: 0, electronics: 0, manufacturing: 0 }, engineers: ENGINEER_LEVELS[o.engineers].n, marketingBudget: 0,
    ledger: [], motorsport: null, board: null, alive: true, specialization: sp, baseVolume: 0, taxAccrued: 0, ytdProfit: 0, msGlow: 0, autoPrice: true, aiFactor: 1, troubleMonths: 0,
    books: { otherAssets: 0, pending: emptyPending(), close: { cash: 0, debt: 0, inventoryValue: 0, fixedAssets: 0 } },
  };
  const f = FACTORY_SIZES[o.factory];
  if (f.cap) c.factories.push({ id: uid(g, 'f'), name: `${o.name} Works`, country: o.country, region, capacity: f.cap, automation: costs.auto, lines: [], expansion: null, builtYear: o.year, historical: false, disruption: 0, bookValue: costs.factory });
  g.companies.push(c);
  g.playerId = c.id;
  openBooks(c); // opening equity = capital left after the founding investments, plus the plant at cost
  news(g, 'company', `${o.name} is founded`, `A new manufacturer opens its doors in ${COUNTRY[o.country].name} with $${(c.cash / 1e6).toFixed(1)}M in the bank. Design your first car in the Vehicles studio, develop it, assign it to a production line and set a price.`);
  return g;
}

export interface MotorsportSetup {
  makerId: string | null; teamName: string; discipline: Discipline; year: number; budget: number; facilities: number; staff: number; target: number;
  color: string; color2: string; difficulty: Difficulty; historyMode: HistoryMode;
  seed?: number;
}
export const MS_BUDGETS = [{ name: 'Privateer', k: 0.55 }, { name: 'Midfield', k: 0.9 }, { name: 'Front-runner', k: 1.35 }];
export function newMotorsportGame(o: MotorsportSetup): GameState {
  const def = o.makerId ? MAKER[o.makerId] : null;
  const g = baseGame('motorsport', o.year, o.difficulty, o.historyMode, `${o.teamName} ${o.year}`, null, o.seed);
  const regs = getRegs(o.discipline, o.year);
  const B = budgetRef(regs, o.year);
  const k = MS_BUDGETS[o.budget].k;
  const country = def?.country ?? 'UK';
  const c: Company = {
    id: 'player', name: o.teamName, country, homeRegion: COUNTRY[country].region, color: o.color, color2: o.color2, founded: o.year, isPlayer: true, dataId: def?.id ?? null,
    cash: B * 0.3 * k, debt: 0, interestRate: 0.06, reach: zeroRegions(), awareness: zeroRegions(), prestige: def ? kf(def.prestige, o.year) : 30, reliabilityRep: 50, sportiness: def ? kf(def.sportiness, o.year) : 50,
    factories: [], models: [], tech: industryTech(o.year), rdBudget: { engine: 0, chassis: 0, aero: 0, electronics: 0, manufacturing: 0 }, engineers: 0, marketingBudget: 0,
    ledger: [], motorsport: null, board: { confidence: 60, objectives: [], note: def ? `You run the works ${regs.className} programme of ${def.name}. The board funds the team and expects results.` : 'You run an independent team. The owners fund it and expect results.' },
    alive: true, specialization: 'motorsport', baseVolume: 0, taxAccrued: 0, ytdProfit: 0, msGlow: 0, autoPrice: true, aiFactor: 1, troubleMonths: 0,
    books: { otherAssets: 0, pending: emptyPending(), close: { cash: 0, debt: 0, inventoryValue: 0, fixedAssets: 0 } },
  };
  g.companies.push(c);
  g.playerId = c.id;
  c.motorsport = createDivision(g, c, { discipline: o.discipline, teamName: o.teamName, color: o.color, color2: o.color2, facilities: o.facilities, staff: o.staff, ownerGrant: 0, sponsorLevel: sponsorTarget(1, k, 0.4), target: o.target, scale: k }, g.rng);
  // The owners fund what a reference team of this size needs to break even in mid-field. Better facilities or
  // staff than the reference cost more to run and come out of that envelope; leaner choices leave a margin.
  const grant = breakEvenGrant(g, c, c.motorsport) * (o.difficulty === 'easy' ? 1.08 : o.difficulty === 'hard' ? 0.93 : 1);
  c.motorsport.ownerGrant = grant; c.motorsport.ownerBase = grant;
  news(g, 'motorsport', `${o.teamName} enters the ${regs.seriesName}`, `${regs.className}. ${regs.note}`, 'historical');
  openBooks(player(g));
  return g;
}

function reviewBoard(g: GameState, c: Company) {
  const b = c.board; if (!b) return;
  const diff = g.difficulty === 'hard' ? 1.3 : g.difficulty === 'easy' ? 0.7 : 1;
  for (const o of b.objectives) {
    if (o.done || o.failed) continue;
    let ok = false;
    if (o.kind === 'profit') { o.progress += c.ledger.slice(-12).reduce((a, l) => a + l.profit, 0); ok = g.year >= o.byYear && o.progress > 0; }
    if (o.kind === 'volume') { o.progress = c.ledger.slice(-12).reduce((a, l) => a + l.units, 0); ok = o.progress >= o.target; }
    if (o.kind === 'prestige') { o.progress = c.prestige; ok = g.year >= o.byYear && c.prestige >= o.target; if (c.prestige < o.target - 8) { o.failed = true; } }
    if (o.kind === 'reliability') { o.progress = c.reliabilityRep; ok = c.reliabilityRep >= o.target; }
    if (o.kind === 'debt') { o.progress = c.debt; ok = c.debt <= o.target; }
    if (ok) { o.done = true; b.confidence = Math.min(100, b.confidence + 12); news(g, 'company', 'Board objective achieved', o.text); }
    else if (o.failed || g.year >= o.byYear) { o.failed = true; b.confidence -= 10 * diff; news(g, 'company', 'Board objective missed', `${o.text}. The board's confidence in you falls.`); }
  }
  if (c.ledger.slice(-12).reduce((a, l) => a + l.profit, 0) > 0) b.confidence = Math.min(100, b.confidence + 4); // a profitable year buys goodwill
  const def = c.dataId ? MAKER[c.dataId] : null;
  if (def && b.objectives.every((o) => o.done || o.failed)) { b.objectives = boardObjectives(g, c, def); news(g, 'company', 'The board sets new objectives', b.objectives.map((o) => o.text).join(' · ')); }
}

function newYear(g: GameState) {
  const p = player(g);
  for (const c of g.companies) {
    if (!c.alive) continue;
    c.ytdProfit = 0;
    if (!c.isPlayer) { runAiYear(g, c, g.rng); continue; }
    for (const m of c.models) {
      if (m.status === 'retired') continue;
      refreshStats(g, m);
      if (c.autoPrice && m.price > 0) m.price *= cpi(g.year) / cpi(g.year - 1);
    }
    if (c.motorsport) startSeason(g, c, c.motorsport, g.rng);
  }
  if (g.mode !== 'motorsport') reviewBoard(g, p);
  const last = p.ledger.slice(-12);
  const profit = last.reduce((a, l) => a + l.profit, 0), units = last.reduce((a, l) => a + l.units, 0), rev = last.reduce((a, l) => a + l.revenue, 0);
  news(g, 'finance', `${g.year - 1} annual report`, `Revenue $${(rev / 1e6).toFixed(1)}M, net ${profit >= 0 ? 'profit' : 'loss'} $${(Math.abs(profit) / 1e6).toFixed(1)}M${units ? `, ${Math.round(units).toLocaleString()} cars sold` : ''}. Cash $${(p.cash / 1e6).toFixed(1)}M, debt $${(p.debt / 1e6).toFixed(1)}M.`);
}

/** Advance the whole world by one month. */
export function advanceMonth(g: GameState) {
  if (g.gameOver || g.decision) return;
  const p = player(g);
  if (p.motorsport) { let guard = 0; while (pendingRound(g, p) && guard++ < 4) quickSimRound(g, p, p.motorsport); }
  const ms = motorsportMonth(g, p);
  const mk = computeMarket(g);
  for (const c of g.companies) {
    if (!c.alive) continue;
    if (c.isPlayer) runPlayerMonth(g, c, mk, { msCost: ms.cost, msIncome: ms.income }); else runAiMonth(g, c, mk);
  }
  // board & solvency
  const L = p.ledger[p.ledger.length - 1];
  const diff = g.difficulty === 'hard' ? 1.3 : g.difficulty === 'easy' ? 0.7 : 1;
  if (p.board) {
    const drift = g.mode === 'motorsport' ? 0 : L.profit > 0 ? 0.45 : -0.9 * diff; // a race team's cash flow is seasonal: judge it on results
    p.board.confidence = clamp(p.board.confidence + drift + (p.troubleMonths > 0 ? -2 : 0), 0, 100);
    if (p.board.confidence <= 0) g.gameOver = { reason: g.mode === 'motorsport' ? 'The owners have lost confidence and replaced you as team principal.' : 'The board has lost confidence in your leadership and dismissed you.' };
  }
  const limit = g.difficulty === 'easy' ? 12 : g.difficulty === 'hard' ? 4 : 7;
  if (p.troubleMonths === 1) news(g, 'finance', 'Credit limit exceeded', `Lenders refuse further credit. Restore solvency within ${limit} months or the company will be declared insolvent.`);
  if (p.troubleMonths >= limit) g.gameOver = { reason: `${p.name} could not pay its creditors and has been declared insolvent.` };
  // world state
  for (const m of g.macro.modifiers) m.monthsLeft--;
  g.macro.modifiers = g.macro.modifiers.filter((m) => m.monthsLeft > 0);
  g.macro.cycle = clamp(0.93 * g.macro.cycle + gauss(g.rng) * 0.011, -0.08, 0.08);
  updateFx(g); // exchange rates (deterministic: no random numbers consumed)
  g.month++;
  if (g.month > 12) { g.month = 1; g.year++; newYear(g); }
  g.macro.interestBase = kf(INTEREST_BASE, g.year + (g.month - 1) / 12);
  fireHistorical(g, g.rng);
  for (const m of p.models) if (m.recallRisk > 0) m.recallRisk = m.recallRisk < 0.02 ? 0 : m.recallRisk * 0.88; // trust returns over about a year
  if (!g.gameOver) rollRandomEvent(g, p, g.rng);
  void annualProfit; void annualUnits; void engineerCost;
}

/** Build one manufacturer for a given year without creating a whole world (used by the setup screens). */
export function previewCompany(makerId: string, year: number): { company: Company; objectives: Objective[]; era: string } {
  const def = MAKER[makerId];
  const g = { year, month: 1, nextId: 1, macro: { fuelPrice: 1, materialCost: 1, interestBase: kf(INTEREST_BASE, year), modifiers: [], cycle: 0 }, news: [], difficulty: 'normal', historyMode: 'historical' } as unknown as GameState;
  const company = companyFromMaker(g, def, true);
  company.debt = Math.min(company.debt, creditLimit(company, year) * 0.6);
  const era = (def.eras.find((e) => year >= e.from && year <= e.to) ?? def.eras[0]).text;
  return { company, objectives: boardObjectives(g, company, def), era };
}
