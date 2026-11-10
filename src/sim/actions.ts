// Player actions. Each function validates, mutates the GameState and returns an error message
// (string) when the action is not possible, or null on success.
import type { Company, DevLevels, Discipline, GameState, RaceCarSpec, RegionId, SegmentId, TechArea, VehicleSpec } from './types';
import { COUNTRY, REGION_IDS } from '../data/world';
import { hasTech, missingTechs, TECH_BY_ID } from '../data/tech';
import { creditLimit, engineerCost, factoryBuildCost, factoryValue, lineShareUsed, makeModel, news, toolingCost, uid, unitCost, valuation } from './company';
import { suggestedPrice } from './market';
import { CYL } from './engineering';
import { cpi, kf } from './util';
import { player } from './world';
import { getRegs, disciplineAvailable } from './racing/regs';
import { budgetRef, createDivision, driverSalary, playerTeam, teamRegs } from './racing/season';
import { checkLegal, raceEngineSpec } from './racing/racecar';

const pay = (c: Company, g: GameState, amount: number): string | null => {
  if (amount > c.cash + Math.max(0, creditLimit(c, g.year) - c.debt)) return `Not enough funds: this costs $${(amount / 1e6).toFixed(1)}M.`;
  c.cash -= amount;
  if (c.cash < 0) { c.debt += -c.cash; c.cash = 0; }
  return null;
};

export function validateSpec(s: VehicleSpec): string[] {
  const e: string[] = [];
  const ev = s.engine.layout === 'EV';
  if (!ev && s.enginePos !== 'front' && s.drive === 'FWD') e.push('A mid- or rear-mounted engine cannot drive only the front wheels.');
  if (!ev && s.engine.displacement / CYL[s.engine.layout] < 150) e.push('Cylinders are too small (under 150 cc each).');
  if (!ev && s.engine.displacement / CYL[s.engine.layout] > 1000) e.push('Cylinders are too large (over 1,000 cc each).');
  if (ev && s.engine.batteryKwh < 5) e.push('Battery capacity is too small.');
  return e;
}

export function startDevelopment(g: GameState, name: string, spec: VehicleSpec, segment: SegmentId, basedOn?: string): string | null {
  const c = player(g);
  if (!name.trim()) return 'Give the model a name.';
  const miss = missingTechs(spec, c.tech);
  if (miss.length) return `Technology not yet available: ${miss.map((id) => TECH_BY_ID[id].name).join(', ')}.`;
  const inv = validateSpec(spec);
  if (inv.length) return inv[0];
  if (c.engineers < 5) return 'You need at least 5 engineers to run a vehicle programme.';
  const m = makeModel(g, name.trim(), JSON.parse(JSON.stringify(spec)), segment, c.tech, g.year);
  const base = basedOn ? c.models.find((x) => x.id === basedOn) : undefined;
  let cost = m.stats.devCost, months = m.stats.devMonths;
  if (base) {
    // a new generation re-uses whatever is carried over from the previous car
    const sameEngine = JSON.stringify({ ...base.spec.engine, redline: 0, cam: 0, boost: 0, compression: 0 }) === JSON.stringify({ ...spec.engine, redline: 0, cam: 0, boost: 0, compression: 0 });
    const samePlatform = base.spec.body === spec.body && base.spec.chassis === spec.chassis && base.spec.enginePos === spec.enginePos && base.spec.drive === spec.drive && Math.abs(base.spec.size - spec.size) < 0.03;
    const k = 1 - (sameEngine ? 0.3 : 0) - (samePlatform ? 0.35 : 0);
    cost *= k; months = Math.max(8, Math.round(months * (0.45 + 0.55 * k)));
    m.generation = base.generation + 1;
  }
  m.status = 'development'; m.devCostTotal = cost; m.devMonthsTotal = months; m.devMonthsLeft = months;
  const upfront = cost * 0.45 * 0.15;
  const err = pay(c, g, upfront);
  if (err) return err;
  m.devCostPaid = upfront;
  c.models.push(m);
  news(g, 'company', `Programme approved: ${m.name}`, `Budget $${(cost / 1e6).toFixed(1)}M over about ${months} months${base ? ` (successor to the ${base.name})` : ''}.`);
  return null;
}
export function cancelDevelopment(g: GameState, modelId: string) {
  const c = player(g);
  c.models = c.models.filter((m) => !(m.id === modelId && m.status === 'development'));
}
export function setPrice(g: GameState, modelId: string, price: number) { const m = player(g).models.find((x) => x.id === modelId); if (m) m.price = Math.max(0, price); }

export function addLine(g: GameState, factoryId: string, modelId: string, units: number): string | null {
  const c = player(g);
  const f = c.factories.find((x) => x.id === factoryId), m = c.models.find((x) => x.id === modelId);
  if (!f || !m) return 'Unknown factory or model.';
  if (m.status !== 'ready' && m.status !== 'production') return 'The model has not finished development.';
  if (f.capacity <= 0) return 'The factory is still under construction.';
  const free = f.capacity * (1 - lineShareUsed(f));
  if (units <= 0) return 'Choose a line capacity.';
  if (units > free + 0.5) return `Only ${Math.floor(free)} units / month of free capacity in this plant.`;
  const err = pay(c, g, toolingCost(m, units));
  if (err) return err;
  const ex = f.lines.find((l) => l.modelId === modelId);
  if (ex) { const oldU = ex.share * f.capacity; ex.share = (oldU + units) / f.capacity; ex.ramp = (ex.ramp * oldU + 0.3 * units) / (oldU + units); }
  else f.lines.push({ modelId, share: units / f.capacity, ramp: 0.3, target: -1 });
  if (!m.price) { // sensible opening price: the segment-positioned price, but never below cost plus a margin at this line's volume
    const cost = unitCost(g, m, f, units);
    m.price = Math.round(Math.max(suggestedPrice(m, c, g.year), (cost * 1.2) / 0.88) / 10) * 10;
  }
  return null;
}
export function removeLine(g: GameState, factoryId: string, modelId: string) {
  const f = player(g).factories.find((x) => x.id === factoryId);
  if (f) f.lines = f.lines.filter((l) => l.modelId !== modelId);
}
export function setLineTarget(g: GameState, factoryId: string, modelId: string, target: number) {
  const l = player(g).factories.find((x) => x.id === factoryId)?.lines.find((x) => x.modelId === modelId);
  if (l) l.target = target;
}
export function retireModel(g: GameState, modelId: string) {
  const c = player(g);
  const m = c.models.find((x) => x.id === modelId); if (!m) return;
  m.status = 'retired';
  for (const f of c.factories) f.lines = f.lines.filter((l) => l.modelId !== modelId);
  news(g, 'company', `${m.name} leaves production`, `${Math.round(m.cumulativeUnits).toLocaleString()} built.`);
}

export const maxAutomation = (c: Company) => (hasTech(c.tech, 'auto80') ? 0.9 : hasTech(c.tech, 'auto60') ? 0.8 : hasTech(c.tech, 'auto30') ? 0.6 : 0.3);
export function buildFactory(g: GameState, name: string, country: string, capacity: number, automation: number): string | null {
  const c = player(g);
  if (!COUNTRY[country]) return 'Choose a country.';
  if (capacity < 20) return 'Minimum capacity is 20 units per month.';
  if (automation > maxAutomation(c) + 1e-6) return `Your manufacturing technology allows at most ${Math.round(maxAutomation(c) * 100)}% automation.`;
  const err = pay(c, g, factoryBuildCost(capacity, automation, g.year));
  if (err) return err;
  c.factories.push({ id: uid(g, 'f'), name: name.trim() || `${COUNTRY[country].name} plant`, country, region: COUNTRY[country].region, capacity: 0, automation, lines: [], expansion: { add: capacity, monthsLeft: 15 }, builtYear: g.year, historical: false, disruption: 0 });
  news(g, 'company', `Ground broken for a new plant in ${COUNTRY[country].name}`, `Capacity ${capacity.toLocaleString()} units per month; production can start in 15 months.`);
  return null;
}
export function expandFactory(g: GameState, factoryId: string, add: number): string | null {
  const c = player(g); const f = c.factories.find((x) => x.id === factoryId);
  if (!f) return 'Unknown factory.';
  if (f.expansion) return 'An expansion is already under way.';
  if (add < 10) return 'Expansion too small.';
  const err = pay(c, g, factoryBuildCost(add, f.automation, g.year) * 0.85);
  if (err) return err;
  f.expansion = { add, monthsLeft: 9 };
  return null;
}
export function upgradeAutomation(g: GameState, factoryId: string, to: number): string | null {
  const c = player(g); const f = c.factories.find((x) => x.id === factoryId);
  if (!f) return 'Unknown factory.';
  if (to <= f.automation) return 'Already at that level.';
  if (to > maxAutomation(c) + 1e-6) return `Manufacturing technology allows at most ${Math.round(maxAutomation(c) * 100)}% automation.`;
  const err = pay(c, g, automationCost(f.capacity, f.automation, to, g.year));
  if (err) return err;
  f.automation = to; f.disruption = Math.max(f.disruption, 1);
  return null;
}
export const automationCost = (capacity: number, from: number, to: number, year: number) => (factoryBuildCost(capacity, to, year) - factoryBuildCost(capacity, from, year)) * 1.3;
export function sellFactory(g: GameState, factoryId: string): string | null {
  const c = player(g); const f = c.factories.find((x) => x.id === factoryId);
  if (!f) return 'Unknown factory.';
  c.cash += factoryValue(f, g.year) * 0.6;
  c.factories = c.factories.filter((x) => x.id !== factoryId);
  news(g, 'company', `${f.name} sold`, 'The plant and its land are sold to an industrial investor.');
  return null;
}

export function setRd(g: GameState, area: TechArea, amount: number) { player(g).rdBudget[area] = Math.max(0, amount); }
export function setMarketing(g: GameState, amount: number) { player(g).marketingBudget = Math.max(0, amount); }
export function setEngineers(g: GameState, n: number): string | null {
  const c = player(g); n = Math.max(0, Math.round(n));
  const d = n - c.engineers; if (!d) return null;
  const err = pay(c, g, Math.abs(d) * engineerCost(c, g.year) * (d > 0 ? 2 : 3)); // recruitment or severance
  if (err) return err;
  c.engineers = n;
  return null;
}
export const dealerCostPerUnit = (g: GameState, c: Company, r: RegionId) => 1500 * cpi(g.year) * (r === c.homeRegion ? 1 : 1.35);
export function investDealers(g: GameState, region: RegionId, amount: number): string | null {
  const c = player(g);
  if (amount <= 0) return 'Enter an amount.';
  const setup = c.reach[region] <= 0 ? 5e6 * cpi(g.year) : 0;
  if (amount <= setup) return `Entering a new region costs at least $${(setup / 1e6).toFixed(1)}M for an importer and parts depot.`;
  const err = pay(c, g, amount);
  if (err) return err;
  const add = (amount - setup) / dealerCostPerUnit(g, c, region);
  c.reach[region] += add;
  if (setup) news(g, 'company', `${c.name} enters a new market`, `A sales company and the first dealers open; distribution capacity ${Math.round(add).toLocaleString()} cars a year.`);
  return null;
}
export function takeLoan(g: GameState, amount: number): string | null {
  const c = player(g);
  const room = creditLimit(c, g.year) - c.debt;
  if (amount > room) return `Lenders will extend at most $${(Math.max(0, room) / 1e6).toFixed(1)}M more.`;
  c.debt += amount; c.cash += amount; return null;
}
export function repayLoan(g: GameState, amount: number): string | null {
  const c = player(g); const a = Math.min(amount, c.debt, c.cash);
  if (a <= 0) return 'Nothing to repay.';
  c.debt -= a; c.cash -= a; return null;
}

export const acquisitionPrice = (c: Company, year: number) => valuation(c, year) * 1.3;
export function acquire(g: GameState, companyId: string): string | null {
  const p = player(g); const t = g.companies.find((x) => x.id === companyId);
  if (!t || !t.alive || t.isPlayer) return 'Not available.';
  if (g.mode === 'motorsport') return 'A racing team cannot acquire a manufacturer.';
  const price = acquisitionPrice(t, g.year);
  const err = pay(p, g, price);
  if (err) return err;
  p.cash += t.cash; p.debt += t.debt;
  for (const f of t.factories) { f.name = `${t.name} — ${f.name}`; f.historical = false; p.factories.push(f); }
  for (const m of t.models) { if (m.status !== 'production') continue; m.name = `${t.name} ${m.name}`; m.endYear = undefined; m.inventory = 0; p.models.push(m); }
  const volP = Math.max(1, REGION_IDS.reduce((a, r) => a + p.reach[r], 0)), volT = REGION_IDS.reduce((a, r) => a + t.reach[r], 0);
  for (const r of REGION_IDS) { p.reach[r] += t.reach[r] * 0.85; p.awareness[r] = Math.max(p.awareness[r], t.awareness[r] * 0.8); }
  const w = volT / (volP + volT);
  p.reliabilityRep = p.reliabilityRep * (1 - w) + t.reliabilityRep * w;
  p.prestige = Math.max(p.prestige * (1 - w * 0.6) + t.prestige * w * 0.6, Math.min(p.prestige, t.prestige));
  for (const k of ['engine', 'chassis', 'aero', 'electronics', 'manufacturing'] as TechArea[]) p.tech[k] = Math.max(p.tech[k], t.tech[k] - 0.5);
  p.engineers += Math.round(t.engineers * 0.7);
  t.alive = false; t.models = []; t.factories = [];
  news(g, 'company', `${p.name} acquires ${t.name}`, `The $${(price / 1e9).toFixed(2)}B takeover brings ${t.name}'s plants, dealer network, engineers and model range into the group. Its cars are now yours to build, price, redesign or retire.`);
  return null;
}

export function establishMotorsport(g: GameState, discipline: Discipline, teamName: string): string | null {
  const c = player(g);
  if (c.motorsport) return 'You already run a racing programme.';
  if (!disciplineAvailable(discipline, g.year)) return 'This category does not exist yet.';
  const B = budgetRef(getRegs(discipline, g.year), g.year);
  const err = pay(c, g, B * 0.5);
  if (err) return err;
  c.motorsport = createDivision(g, c, { discipline, teamName: teamName.trim() || `${c.name} Racing`, color: c.color, color2: c.color2, facilities: 2, staff: 58, ownerGrant: 0, sponsorLevel: 0.3, target: 6 }, g.rng);
  news(g, 'motorsport', `${c.name} goes racing`, `A motorsport division is founded to contest the ${c.motorsport.championship.name}. Results will shape the brand; its costs appear in the parent company's accounts, and its technology feeds back into road-car research.`);
  return null;
}
export function closeMotorsport(g: GameState) {
  const c = player(g); if (!c.motorsport || g.mode === 'motorsport') return;
  news(g, 'motorsport', `${c.motorsport.teamName} withdraws from racing`, 'The programme is wound up.');
  c.motorsport = null; c.msGlow *= 0.5;
}

// ---- motorsport management
export function signDriver(g: GameState, driverId: string, years: number, replaceId?: string): string | null {
  const c = player(g); const div = c.motorsport; if (!div) return 'No racing programme.';
  const ch = div.championship, team = playerTeam(div), regs = teamRegs(team, ch.year);
  const d = ch.drivers.find((x) => x.id === driverId); if (!d) return 'Unknown driver.';
  if (d.teamId === team.id) { d.contractEnd = ch.year + years; return null; }
  if (d.teamId) return 'This driver is under contract elsewhere.';
  const seats = regs.carsPerTeam * regs.driversPerCar;
  if (replaceId) { const err = releaseDriver(g, replaceId); if (err) return err; }
  if (team.drivers.length >= seats) return 'No free seat — release a driver first.';
  const err = pay(c, g, d.salary * 0.1); // signing fee
  if (err) return err;
  d.teamId = team.id; d.contractEnd = ch.year + years - 1; team.drivers.push(d.id);
  news(g, 'motorsport', `${d.name} signs for ${team.name}`, `${years}-year contract at $${(d.salary / 1e6).toFixed(2)}M a year.`);
  return null;
}
export function releaseDriver(g: GameState, driverId: string): string | null {
  const c = player(g); const div = c.motorsport; if (!div) return 'No racing programme.';
  const ch = div.championship, team = playerTeam(div);
  const d = ch.drivers.find((x) => x.id === driverId); if (!d || d.teamId !== team.id) return 'Not your driver.';
  const err = pay(c, g, d.salary * 0.3 * Math.max(1, d.contractEnd - ch.year + 1));
  if (err) return err;
  d.teamId = null; team.drivers = team.drivers.filter((id) => id !== driverId);
  return null;
}
export function swapDriverOrder(g: GameState, i: number, j: number) {
  const div = player(g).motorsport; if (!div) return;
  const t = playerTeam(div); if (i < 0 || j < 0 || i >= t.drivers.length || j >= t.drivers.length) return;
  [t.drivers[i], t.drivers[j]] = [t.drivers[j], t.drivers[i]];
}
export const facilityCost = (g: GameState, c: Company, level: number) => budgetRef(teamRegs(playerTeam(c.motorsport!), g.year), g.year) * 0.1 * (level + 1);
export function upgradeFacility(g: GameState, key: keyof NonNullable<Company['motorsport']>['facilities']): string | null {
  const c = player(g); const div = c.motorsport; if (!div) return 'No racing programme.';
  if (div.facilities[key] >= 5) return 'Already state of the art.';
  const err = pay(c, g, facilityCost(g, c, div.facilities[key]));
  if (err) return err;
  div.facilities[key]++; return null;
}
export const staffCost = (g: GameState, c: Company, skill: number) => budgetRef(teamRegs(playerTeam(c.motorsport!), g.year), g.year) * 0.035 * Math.exp((skill - 60) / 22);
export function recruitStaff(g: GameState, key: keyof NonNullable<Company['motorsport']>['staff']): string | null {
  const c = player(g); const div = c.motorsport; if (!div) return 'No racing programme.';
  if (div.staff[key] >= 97) return 'You already employ the best in the business.';
  const err = pay(c, g, staffCost(g, c, div.staff[key]));
  if (err) return err;
  div.staff[key] = Math.min(98, div.staff[key] + 5); return null;
}
export function setDevBudget(g: GameState, amount: number) { const d = player(g).motorsport; if (d) d.devBudget = Math.max(0, amount); }
export function setDevFocus(g: GameState, f: DevLevels) { const d = player(g).motorsport; if (d) d.devFocus = { ...f }; }
export function setOwnerGrant(g: GameState, perYear: number) { const d = player(g).motorsport; if (d && g.mode !== 'motorsport') d.ownerGrant = 0 * perYear; }

/** Commit a new race-car design. Changing the architecture costs money and resets part of the development. */
export function redesignRaceCar(g: GameState, spec: RaceCarSpec): string | null {
  const c = player(g); const div = c.motorsport; if (!div) return 'No racing programme.';
  const team = playerTeam(div), regs = teamRegs(team, div.championship.year);
  const legal = checkLegal(raceEngineSpec(spec.engine, regs), regs);
  if (legal.length) return legal[0];
  const old = team.car;
  const engineNew = old.engine.layout !== spec.engine.layout || old.engine.displacement !== spec.engine.displacement || old.engine.aspiration !== spec.engine.aspiration || old.engine.valvetrain !== spec.engine.valvetrain;
  const engineTune = JSON.stringify(old.engine) !== JSON.stringify(spec.engine);
  const chassisNew = Math.abs(old.aeroBias - spec.aeroBias) > 0.15 || Math.abs(old.stiffness - spec.stiffness) > 0.25 || Math.abs(old.weightEffort - spec.weightEffort) > 0.2 || Math.abs(old.cooling - spec.cooling) > 0.25;
  const B = budgetRef(regs, g.year);
  const cost = B * ((engineNew ? 0.12 : engineTune ? 0.02 : 0) + (chassisNew ? 0.06 : 0) + spec.weightEffort * 0.02);
  const err = pay(c, g, cost);
  if (err) return err;
  if (engineNew) { team.dev.engine *= 0.5; team.dev.reliability *= 0.6; }
  if (chassisNew) { team.dev.aero *= 0.8; team.dev.chassis *= 0.8; }
  team.car = JSON.parse(JSON.stringify(spec)); team.color = spec.color; team.color2 = spec.color2;
  div.carDesignedYear = g.year;
  news(g, 'motorsport', `${team.name} reveals a ${engineNew ? 'new car' : 'revised car'}`, `Design and build cost $${(cost / 1e6).toFixed(2)}M.${engineNew ? ' A new engine architecture means part of the development work starts again.' : ''}`);
  return null;
}
export const raceCarRedesignCost = (g: GameState, c: Company) => budgetRef(teamRegs(playerTeam(c.motorsport!), g.year), g.year);
export { driverSalary, kf };
