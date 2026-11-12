// Historical and procedurally generated events.
//
// Historical events: real events on their real dates (month precision). The *effects* are
// simplified gameplay estimates of what the event did to the car industry.
// In "historical" mode every event fires on its date. In "alternative history" mode each event
// is re-rolled when the game is created: it may not happen at all, may arrive up to two years
// early or late, and its magnitude is scaled — a plausible divergence, not a random walk.
import type { Company, Decision, GameState, Modifier, RegionId, VehicleModel } from './types';
import { chance, pick, rnd, rndInt, rndRange, type Rng } from './rng';
import { charge, receive } from './accounts';
import { annualRevenue, engineerCost, news, TECH_AREAS, AREA_NAME } from './company';
import { REGION_IDS, REGION_NAME } from '../data/world';
import { cpi } from './util';
import { engineKey, familyOf, platformKey, platformOf } from './families';
import { inspectionHazard } from './supply';

type Mod = Omit<Modifier, 'id' | 'label' | 'monthsLeft'>;
export interface HistEvent { id: string; year: number; month: number; title: string; body: string; mods: (Mod & { months: number })[]; special?: string; weight?: number }

export const HISTORICAL_EVENTS: HistEvent[] = [
  { id: 'korea', year: 1950, month: 6, title: 'Korean War begins', body: 'Steel, rubber and copper are diverted to military production. Material prices climb; procurement orders give Japanese industry a lifeline.',
    mods: [{ months: 30, materialCost: 1.14, demand: { JP: 1.25 } }] },
  { id: 'lemans55', year: 1955, month: 6, title: 'Disaster at the 24-hour race', body: 'More than eighty spectators are killed in the worst accident in motor-racing history. Several countries suspend racing, Mercedes-Benz withdraws from motorsport, and circuits everywhere face expensive safety work.',
    mods: [{ months: 30, motorsportCost: 1.2 }], special: 'msSafety' },
  { id: 'suez', year: 1956, month: 10, title: 'Suez Crisis', body: 'The canal is closed and fuel is rationed across Western Europe. Buyers turn to the smallest, thriftiest cars.',
    mods: [{ months: 8, fuelPrice: 1.4, demand: { EU: 0.88 }, segment: { budget: 1.18, luxury: 0.85, sports: 0.85 } }] },
  { id: 'recession58', year: 1957, month: 9, title: 'Recession in the United States', body: 'The sharpest post-war downturn so far cuts American car sales by almost a third and opens the door to compact imports.',
    mods: [{ months: 12, demand: { NA: 0.78 }, segment: { budget: 1.15 } }] },
  { id: 'safetyact', year: 1966, month: 9, title: 'US National Traffic and Motor Vehicle Safety Act', body: 'After "Unsafe at Any Speed", Washington mandates seat belts, collapsible steering columns and crash standards. Safety becomes a selling point — and a cost.',
    mods: [{ months: 48, materialCost: 1.02 }], special: 'safety' },
  { id: 'cleanair', year: 1970, month: 12, title: 'US Clean Air Act', body: 'Emissions must fall by 90% by 1975. Catalytic converters, unleaded fuel and electronic engine management are on the way; power outputs will suffer first.',
    mods: [{ months: 60, materialCost: 1.03 }] },
  { id: 'nixon', year: 1971, month: 8, title: 'End of the Bretton Woods system', body: 'The dollar floats. Currency swings begin to reshape where it pays to build cars.',
    mods: [{ months: 24, interest: 0.01, importPenalty: { NA: 0.94 } }] },
  { id: 'oil73', year: 1973, month: 10, title: 'Oil crisis', body: 'An OPEC embargo quadruples the price of crude. Queues at filling stations, Sunday driving bans and speed limits follow. Large, thirsty and fast cars become almost unsellable.',
    mods: [{ months: 20, fuelPrice: 1.9, demandAll: 0.84, segment: { budget: 1.25, sports: 0.7, supercar: 0.5, luxury: 0.78, pickup: 0.88 }, motorsportCost: 1.1 }] },
  { id: 'oil79', year: 1979, month: 1, title: 'Second oil shock', body: 'Revolution in Iran halves its oil exports. Fuel prices double again, interest rates soar and the American market collapses toward small imports.',
    mods: [{ months: 30, fuelPrice: 1.7, demandAll: 0.93, demand: { NA: 0.8 }, segment: { budget: 1.2, supercar: 0.7, luxury: 0.85 } }, { months: 40, interest: 0.05 }] },
  { id: 'ver', year: 1981, month: 5, title: 'Voluntary export restraints', body: 'Japan agrees to limit car exports to the United States. Building where you sell becomes the way around quotas (simplified in-game as a penalty on all cars imported into North America).',
    mods: [{ months: 150, importPenalty: { NA: 0.86 } }] },
  { id: 'plaza', year: 1985, month: 9, title: 'Plaza Accord', body: 'The yen and the Deutschmark rise sharply against the dollar. Exporting to America gets much harder; transplant factories multiply.',
    mods: [{ months: 36, importPenalty: { NA: 0.88 } }] },
  { id: 'black87', year: 1987, month: 10, title: 'Black Monday', body: 'Stock markets lose a fifth of their value in a day. Buyers of expensive cars pause.',
    mods: [{ months: 10, segment: { luxury: 0.88, supercar: 0.85, premium: 0.95 } }] },
  { id: 'wall', year: 1989, month: 11, title: 'Fall of the Berlin Wall', body: 'Eastern Europe opens up. Millions of new customers and a reunification boom lift European demand.',
    mods: [{ months: 36, demand: { EU: 1.08 } }] },
  { id: 'gulf', year: 1990, month: 8, title: 'Gulf War and recession', body: 'Oil spikes after the invasion of Kuwait and the major economies slide into recession. The speculative supercar bubble of the late 1980s bursts.',
    mods: [{ months: 8, fuelPrice: 1.3 }, { months: 26, demandAll: 0.91, segment: { supercar: 0.55, luxury: 0.85, sports: 0.85 } }] },
  { id: 'bubble', year: 1991, month: 3, title: 'Japanese asset bubble bursts', body: 'Land and share prices collapse; Japan enters a "lost decade". The domestic market shrinks and ambitious engineering programmes are cancelled.',
    mods: [{ months: 72, demand: { JP: 0.86 } }] },
  { id: 'imola', year: 1994, month: 5, title: 'A black weekend in Grand Prix racing', body: 'Two drivers lose their lives at one race meeting. Sweeping safety changes to cars and circuits follow, at considerable cost to every team.',
    mods: [{ months: 24, motorsportCost: 1.1 }], special: 'msSafety' },
  { id: 'asia97', year: 1997, month: 7, title: 'Asian financial crisis', body: 'Currencies collapse from Thailand to South Korea. Regional car sales fall by half in some markets and indebted manufacturers are pushed into mergers.',
    mods: [{ months: 24, demand: { JP: 0.88, ROW: 0.8 } }] },
  { id: 'sept11', year: 2001, month: 9, title: 'September 11 attacks', body: 'Consumer confidence collapses; American makers answer with zero-percent financing that protects volume and destroys margins.',
    mods: [{ months: 14, demand: { NA: 0.92 }, segment: { luxury: 0.9, supercar: 0.88 } }] },
  { id: 'wto', year: 2001, month: 12, title: 'China joins the WTO', body: 'Tariffs fall and joint ventures multiply. The Chinese car market begins a decade of explosive growth.',
    mods: [{ months: 72, demand: { CN: 1.12 } }] },
  { id: 'oil08', year: 2008, month: 6, title: 'Oil at $147 a barrel', body: 'Record fuel prices crush demand for trucks and SUVs just as credit markets begin to seize up.',
    mods: [{ months: 6, fuelPrice: 1.45, segment: { suv: 0.8, pickup: 0.8, budget: 1.1 } }] },
  { id: 'gfc', year: 2008, month: 9, title: 'Global financial crisis', body: 'Lehman Brothers fails and car loans dry up. Sales fall by a third in North America; two of Detroit\'s three giants head for bankruptcy and governments step in. Credit is scarce and expensive.',
    mods: [{ months: 22, demand: { NA: 0.72, EU: 0.86, JP: 0.84, LATAM: 0.94, ROW: 0.92 }, segment: { luxury: 0.8, supercar: 0.7, premium: 0.9 }, interest: 0.035, motorsportCost: 1.15 }], special: 'msExodus' },
  { id: 'scrappage', year: 2009, month: 3, title: 'Scrappage schemes', body: 'Governments pay drivers to trade old cars for new ones. Small-car sales jump for a few months.',
    mods: [{ months: 9, segment: { budget: 1.22, family: 1.06 }, demand: { EU: 1.06 } }] },
  { id: 'tohoku', year: 2011, month: 3, title: 'Tōhoku earthquake and tsunami', body: 'Japan\'s supply chain is severed: plants across the country stop for weeks and shortages of paints, chips and resins ripple around the world.',
    mods: [{ months: 5, production: { JP: 0.55 }, productionAll: 0.95, materialCost: 1.04 }] },
  { id: 'diesel', year: 2015, month: 9, title: 'Diesel emissions scandal', body: 'Defeat devices are found in millions of diesel cars. Fines run to tens of billions, regulators tighten real-world testing, and the industry\'s investment swings decisively toward electric cars.',
    mods: [{ months: 72, evDemand: 1.18, demand: { EU: 0.98 } }], special: 'diesel' },
  { id: 'tradewar', year: 2018, month: 7, title: 'Tariff war', body: 'Tariffs on steel, aluminium and imported cars go up between the United States and China. Global supply chains get more expensive.',
    mods: [{ months: 24, materialCost: 1.04, importPenalty: { CN: 0.9, NA: 0.95 } }] },
  { id: 'covid', year: 2020, month: 3, title: 'COVID-19 pandemic', body: 'Factories and showrooms close around the world. Production stops for weeks; demand collapses, then returns faster than supply.',
    mods: [{ months: 3, productionAll: 0.4, demandAll: 0.6 }, { months: 12, demandAll: 0.9, motorsportCost: 1.1 }] },
  { id: 'chips', year: 2021, month: 1, title: 'Semiconductor shortage', body: 'Chip makers cannot keep up with a rebounding car industry. Millions of vehicles go unbuilt while half-finished cars wait for parts.',
    mods: [{ months: 26, productionAll: 0.86 }] },
  { id: 'energy22', year: 2022, month: 2, title: 'Energy and commodity shock', body: 'War in Ukraine sends energy, nickel and wiring-harness prices soaring. European demand weakens; interest in electric cars keeps growing.',
    mods: [{ months: 14, materialCost: 1.14, fuelPrice: 1.35, demand: { EU: 0.91 }, evDemand: 1.08, interest: 0.02 }] },
];

export function buildSchedule(mode: GameState['historyMode'], startYear: number, rng: Rng): GameState['schedule'] {
  const out: GameState['schedule'] = [];
  for (const e of HISTORICAL_EVENTS) {
    if (e.year < startYear) continue;
    if (mode === 'historical') { out.push({ id: e.id, year: e.year, month: e.month, scale: 1 }); continue; }
    if (!chance(rng, 0.72)) continue; // in this timeline it never happens
    const shift = rndInt(rng, -24, 24);
    const t = e.year * 12 + (e.month - 1) + shift;
    if (t < startYear * 12 + 2) continue;
    out.push({ id: e.id, year: Math.floor(t / 12), month: (t % 12) + 1, scale: rndRange(rng, 0.55, 1.45) });
  }
  return out;
}

const scaleNum = (v: number, s: number) => 1 + (v - 1) * s;
function scaleMod(m: Mod, s: number): Mod {
  const sm = <T extends string>(r?: Partial<Record<T, number>>) => r && (Object.fromEntries(Object.entries(r).map(([k, v]) => [k, scaleNum(v as number, s)])) as Partial<Record<T, number>>);
  return {
    demand: sm(m.demand), segment: sm(m.segment), production: sm(m.production), importPenalty: sm(m.importPenalty),
    demandAll: m.demandAll && scaleNum(m.demandAll, s), fuelPrice: m.fuelPrice && scaleNum(m.fuelPrice, s), materialCost: m.materialCost && scaleNum(m.materialCost, s),
    productionAll: m.productionAll && scaleNum(m.productionAll, s), motorsportCost: m.motorsportCost && scaleNum(m.motorsportCost, s), evDemand: m.evDemand && scaleNum(m.evDemand, s),
    interest: m.interest && m.interest * s,
  };
}
export function addModifier(g: GameState, label: string, months: number, mod: Mod) {
  g.macro.modifiers.push({ id: `mod${g.nextId++}`, label, monthsLeft: months, ...mod });
}

export function fireHistorical(g: GameState, rng: Rng) {
  for (const sch of g.schedule) {
    if (sch.year !== g.year || sch.month !== g.month || g.fired.includes(sch.id)) continue;
    const e = HISTORICAL_EVENTS.find((x) => x.id === sch.id);
    if (!e) continue;
    g.fired.push(e.id);
    const alt = g.historyMode === 'alternative';
    e.mods.forEach((m) => { const { months, ...rest } = m; addModifier(g, e.title, Math.max(2, Math.round(months * (alt ? 0.6 + 0.4 * sch.scale : 1))), scaleMod(rest, sch.scale)); });
    const tag = alt ? (e.year === sch.year && e.month === sch.month ? 'historical' : `alternative timeline · really happened ${e.month}/${e.year}`) : 'historical';
    news(g, 'historical', e.title, e.body, tag);
    if (e.special === 'diesel') {
      const candidates = g.companies.filter((c) => c.alive && c.specialization === 'mass' && c.baseVolume > 1e6);
      const target = alt ? (candidates.length ? pick(rng, candidates) : null) : g.companies.find((c) => c.alive && c.dataId === 'vw') ?? null;
      if (target) {
        const fine = Math.max(annualRevenue(target), target.baseVolume * 20000) * 0.08 * sch.scale;
        charge(target, fine); target.prestige = Math.max(0, target.prestige - 6); target.reliabilityRep = Math.max(0, target.reliabilityRep - 5);
        news(g, 'market', `${target.name} at the centre of the emissions scandal`, `Fines, recalls and settlements cost the company about $${(fine / 1e9).toFixed(1)} billion and badly damage trust in the brand.`);
      }
    }
    if (e.special === 'msExodus') {
      for (const c of g.companies) if (c.motorsport && c.isPlayer) c.motorsport.sponsors.forEach((s) => { s.annual *= 0.8; });
    }
  }
}

// ------------------------------------------------------------------------------ procedural

const REGION_PICK: RegionId[] = REGION_IDS;

/** At most one procedural event per month. Some open a decision the player must answer. */
export function rollRandomEvent(g: GameState, p: Company, rng: Rng) {
  if (g.decision) return;
  const base = g.difficulty === 'hard' ? 0.17 : g.difficulty === 'easy' ? 0.1 : 0.135;
  if (!chance(rng, base * (g.historyMode === 'alternative' ? 1.25 : 1))) return;
  const hasCars = p.factories.length > 0 && p.models.some((m) => m.status === 'production');
  const table: [number, () => void][] = [];
  const add = (w: number, fn: () => void) => table.push([w, fn]);
  const money = (x: number) => `$${x >= 1e9 ? (x / 1e9).toFixed(2) + 'B' : x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : (x / 1e3).toFixed(0) + 'k'}`;

  if (hasCars) {
    add(1.2, () => {
      const f = pick(rng, p.factories);
      const cost = Math.max(0.3e6 * cpi(g.year), f.capacity * 30 * cpi(g.year) * rndRange(rng, 6, 12));
      setDecision(g, { id: 'strike', title: `Strike threat at ${f.name}`, body: `The workforce at ${f.name} demands a better deal after months of overtime. Union leaders give you a week.`,
        options: [
          { label: 'Settle', detail: `One-off cost of ${money(cost)}. Production continues.`, effect: 'pay' },
          { label: 'Hold firm', detail: 'Risk a walk-out: two months at a quarter of normal output (60% chance).', effect: 'risk' },
        ], data: { factory: f.id, cost } });
    });
    add(1.0, () => {
      const f = pick(rng, p.factories);
      f.disruption = Math.max(f.disruption, 1);
      news(g, 'company', `Supplier failure halts ${f.name}`, 'A fire at a single-source parts supplier stops deliveries. Output at the plant falls to a quarter for a month.');
    });
    add(1.3, () => {
      // a defect surfaces in the engine family with the highest hazard (volume × weak engine reliability × new design)
      const fam = pickDefectFamily(g, p, rng);
      if (!fam || !chance(rng, (100 - fam.reliability) / 55)) return;
      setDecision(g, defectDecision(g, p, fam));
    });
    add(1.0, () => {
      const m = p.models.filter((x) => x.status === 'production').sort((a, b) => b.launchYear - a.launchYear)[0];
      if (!m) return;
      const good = m.stats.scores.performance + m.stats.scores.comfort + m.stats.scores.reliability > 165;
      for (const r of REGION_IDS) p.awareness[r] = Math.min(100, Math.max(0, p.awareness[r] + (good ? 6 : -3)));
      news(g, 'company', good ? `Magazines rave about the ${m.name}` : `Lukewarm reviews for the ${m.name}`,
        good ? 'A clean sweep of comparison tests puts the car on every shopping list. Awareness rises in all markets.' : 'Road testers find it outclassed by newer rivals. Awareness slips.');
    });
    add(0.6, () => {
      const f = pick(rng, p.factories);
      const cost = f.capacity * 400 * cpi(g.year);
      f.disruption = Math.max(f.disruption, 2); charge(p, cost);
      news(g, 'company', `Fire at ${f.name}`, `The paint shop is badly damaged. Repairs cost ${money(cost)} and output is cut for two months.`);
    });
    add(0.7, () => {
      const grant = Math.max(1e6 * cpi(g.year), annualRevenue(p) * 0.01);
      receive(p, grant);
      news(g, 'company', 'Regional development grant', `The government of ${p.country} rewards investment in local jobs with a ${money(grant)} grant.`);
    });
  }
  add(1.0, () => {
    const r = pick(rng, REGION_PICK); const up = chance(rng, 0.5);
    addModifier(g, `${REGION_NAME[r]}: ${up ? 'boom' : 'downturn'}`, rndInt(rng, 10, 20), { demand: { [r]: up ? rndRange(rng, 1.07, 1.14) : rndRange(rng, 0.84, 0.93) } as Partial<Record<RegionId, number>> });
    news(g, 'world', up ? `Economic boom in ${REGION_NAME[r]}` : `Downturn in ${REGION_NAME[r]}`, up ? 'Rising incomes and easy credit lift new-car demand.' : 'Unemployment rises and households postpone big purchases.', 'generated');
  });
  add(0.8, () => {
    const up = chance(rng, 0.55);
    addModifier(g, up ? 'Raw-material price spike' : 'Raw-material glut', rndInt(rng, 8, 16), { materialCost: up ? rndRange(rng, 1.07, 1.15) : rndRange(rng, 0.9, 0.95) });
    news(g, 'world', up ? 'Steel and aluminium prices jump' : 'Commodity prices slide', up ? 'Every car you build costs more until the market settles.' : 'Cheaper materials widen margins for a while.', 'generated');
  });
  add(0.6, () => {
    const r = pick(rng, REGION_PICK); const strong = chance(rng, 0.5);
    addModifier(g, `${REGION_NAME[r]}: currency ${strong ? 'surge' : 'slump'}`, rndInt(rng, 10, 18), { importPenalty: { [r]: strong ? 1.1 : 0.9 } as Partial<Record<RegionId, number>> });
    news(g, 'world', `Currency ${strong ? 'surge' : 'slump'} in ${REGION_NAME[r]}`, strong ? 'Imports become cheaper for local buyers.' : 'Imported cars become expensive; local production gains an edge.', 'generated');
  });
  add(0.5, () => {
    const up = chance(rng, 0.5);
    addModifier(g, up ? 'Central banks tighten' : 'Cheap money', rndInt(rng, 12, 24), { interest: up ? 0.015 : -0.01 });
    news(g, 'finance', up ? 'Interest rates rise' : 'Interest rates fall', up ? 'Debt gets more expensive to service.' : 'Borrowing costs ease.', 'generated');
  });
  add(0.5, () => {
    const up = chance(rng, 0.6);
    addModifier(g, up ? 'Fuel price spike' : 'Cheap fuel', rndInt(rng, 6, 12), { fuelPrice: up ? rndRange(rng, 1.12, 1.25) : rndRange(rng, 0.85, 0.93) });
    news(g, 'world', up ? 'Fuel prices climb' : 'Fuel prices fall', up ? 'Economy matters more in the showroom.' : 'Buyers worry less about consumption.', 'generated');
  });
  if (p.engineers > 0) {
    add(0.8, () => {
      const a = pick(rng, TECH_AREAS);
      p.tech[a] += 0.5;
      news(g, 'company', `Engineering breakthrough: ${AREA_NAME[a]}`, 'A skunk-works project pays off. Technology level in this area advances by half a year.');
    });
    add(0.6, () => {
      const cost = engineerCost(p, g.year) * Math.max(5, p.engineers * 0.04) * 6;
      setDecision(g, { id: 'poach', title: 'A rival is poaching your engineers', body: 'A competitor is offering large signing bonuses to a group of your best people.',
        options: [
          { label: 'Counter-offer', detail: `Retention bonuses cost ${money(cost)}.`, effect: 'pay' },
          { label: 'Let them go', detail: 'Lose 6% of your engineers and a little know-how in one area.', effect: 'lose' },
        ], data: { cost } });
    });
  }
  if (p.motorsport) {
    add(1.0, () => {
      const amt = Math.max(0.2e6 * cpi(g.year), p.motorsport!.sponsors.reduce((a, s) => a + s.annual, 0) * rndRange(rng, 0.08, 0.2));
      const names = ['Meridian Bank', 'Altus Oil', 'Kestrel Watches', 'Nordlys Telecom', 'Vantor Tools', 'Sable Logistics', 'Orion Insurance', 'Halcyon Airlines', 'Corvin Energy', 'Tessera Software'];
      const name = pick(rng, names.filter((n) => !p.motorsport!.sponsors.some((s) => s.name === n)).concat(['Atlas Lubricants']));
      p.motorsport!.sponsors.push({ name, annual: amt });
      news(g, 'motorsport', `New sponsor: ${name}`, `${name} (a fictional company) joins the team for ${money(amt)} per year.`);
    });
  }
  add(0.4, () => {
    p.prestige = Math.min(100, p.prestige + 2);
    news(g, 'company', 'A star turn', `A ${p.name} plays a leading role in the year's biggest film. The brand's prestige gets a lift.`);
  });
  const total = table.reduce((a, [w]) => a + w, 0);
  let x = rnd(rng) * total;
  for (const [w, fn] of table) { x -= w; if (x <= 0) { fn(); return; } }
}

function setDecision(g: GameState, d: Decision) { g.decision = d; }

// ------------------------------------------------------------------------------- engine families & platforms
/** Key of the engine a model uses: its explicit family (Phase 3) or, without one, layout + aspiration + displacement band. */
export function engineFamily(m: VehicleModel): string { return engineKey(m); }
const onSale = (m: VehicleModel) => m.status === 'production' || (m.status === 'ready' && m.inventory > 0);
export interface DefectGroup { kind: 'engine' | 'platform'; key: string; name: string; models: VehicleModel[]; units: number; reliability: number; hazard: number; layout: string }
function groups(g: GameState, c: Company, kind: DefectGroup['kind']) {
  const out = new Map<string, DefectGroup>();
  for (const m of c.models) {
    if (!onSale(m)) continue;
    const key = kind === 'engine' ? engineKey(m) : platformKey(m);
    const named = kind === 'engine' ? familyOf(c, m)?.name : platformOf(c, m)?.name;
    const x = out.get(key) ?? { kind, key, name: named ?? '', models: [], units: 0, reliability: 100, hazard: 0, layout: m.spec.engine.layout };
    x.models.push(m);
    x.units += m.salesHistory.slice(-24).reduce((a, b) => a + b, 0);
    x.reliability = Math.min(x.reliability, kind === 'engine' ? m.stats.engine.reliability : m.stats.scores.reliability);
    out.set(key, x);
  }
  const insp = inspectionHazard(c); // thorough quality inspection catches faults before cars reach customers
  for (const x of out.values()) {
    const young = x.models.some((m) => m.designYear >= g.year - 2) ? 1.5 : 1; // early production of a new design
    // structural and suspension faults are rarer than engine faults
    x.hazard = x.units * Math.pow((100 - x.reliability) / 50, 2) * young * (kind === 'platform' ? 0.5 : 1) * insp;
  }
  return out;
}
/** Cars of each engine family sold in the last two years, their weakest engine reliability and a defect hazard. */
export const engineFamilies = (g: GameState, c: Company) => groups(g, c, 'engine');
/** The same for platforms (structure, suspension, crash structure). */
export const platformGroups = (g: GameState, c: Company) => groups(g, c, 'platform');
export function pickDefectFamily(g: GameState, c: Company, rng: Rng): DefectGroup | null {
  const all = [...engineFamilies(g, c).values(), ...platformGroups(g, c).values()].filter((f) => f.units > 200 && f.hazard > 0);
  const total = all.reduce((a, f) => a + f.hazard, 0);
  if (!total) return null;
  let r = rnd(rng) * total;
  for (const f of all) { r -= f.hazard; if (r <= 0) return f; }
  return all[all.length - 1];
}
/** The decision put to the player when a defect is found in an engine family. */
export const engineDefectDecision = (g: GameState, c: Company, key: string): Decision => defectDecision(g, c, engineFamilies(g, c).get(key)!);
/** … or in a platform. */
export const platformDefectDecision = (g: GameState, c: Company, key: string): Decision => defectDecision(g, c, platformGroups(g, c).get(key)!);
export function defectDecision(g: GameState, c: Company, f: DefectGroup): Decision {
  const eng = f.kind === 'engine';
  // repair cost per car: a share of the engine, or of the structure and running gear
  const perCar = f.models.reduce((a, m) => a + (eng ? (m.stats.costBreakdown.Powertrain ?? m.stats.partsCost * 0.25) : (m.stats.costBreakdown.Chassis ?? 0) + (m.stats.costBreakdown['Running gear'] ?? 0)), 0) / f.models.length;
  const cost = Math.max(f.units * perCar * (eng ? 0.12 : 0.1), 0.2e6 * cpi(g.year));
  const names = f.models.map((m) => m.name);
  const all = c.models.filter(onSale).reduce((a, m) => a + m.salesHistory.slice(-24).reduce((x, y) => x + y, 0), 0) || 1;
  const share = f.units / all;
  const part = eng ? (f.layout === 'EV' ? 'electric drive unit' : `${f.layout} engine`) : 'platform (suspension mounts and structure)';
  const label = f.name ? `${f.name} ${eng ? '' : ''}`.trim() : part;
  const money = (x: number) => `$${x >= 1e9 ? (x / 1e9).toFixed(2) + 'B' : x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : (x / 1e3).toFixed(0) + 'k'}`;
  return {
    id: 'recall', title: `Defect found in the ${eng ? part : 'platform'} of the ${names.join(', ')}`,
    body: `Warranty engineers trace a pattern of failures to the ${part}${f.name ? ` (${label})` : ''} shared by ${names.length > 1 ? `${names.length} models` : 'the ' + names[0]} — about ${Math.round(f.units).toLocaleString()} cars built in the last two years, ${Math.round(share * 100)}% of your sales. Its reliability rating is ${Math.round(f.reliability)}/100.`,
    options: [
      { label: 'Recall every car', detail: `Costs ${money(cost)}. Buyers' trust in these models dips for a few months; your reliability reputation takes a small hit. The fix makes the ${eng ? 'engine' : 'platform'} more reliable from now on.`, effect: 'recall' },
      { label: 'Fix quietly at service', detail: `Costs ${money(cost * 0.25)}. 40% chance the press finds out: then a forced recall at 1.5× the cost, a large reputation loss and buyers shunning every model with this ${eng ? 'engine' : 'platform'}.`, effect: 'quiet' },
    ],
    data: { cost, model: names.join(', '), family: f.key, kind: f.kind, share, units: f.units },
  };
}
/** Record a defect in the history of the family or platform it came from (drives its future reliability). */
function recordDefect(g: GameState, c: Company, kind: string, key: string, what: 'recall' | 'quiet' | 'exposed', units: number) {
  const id = key.replace(/^(fam|plat):/, '');
  const x = kind === 'platform' ? (c.platforms ?? []).find((p) => p.id === id) : (c.engines ?? []).find((f) => f.id === id);
  if (x) x.history.push({ y: g.year, kind: what, units: Math.round(units) });
}

export function resolveDecision(g: GameState, optionIdx: number, rng: Rng) {
  const d = g.decision; if (!d) return;
  const p = g.companies.find((c) => c.id === g.playerId)!;
  const eff = d.options[optionIdx].effect;
  const cost = Number(d.data?.cost ?? 0);
  if (d.id === 'strike') {
    if (eff === 'pay') { charge(p, cost); news(g, 'company', 'Strike averted', 'A settlement is signed and the lines keep running.'); }
    else if (chance(rng, 0.6)) { const f = p.factories.find((x) => x.id === d.data?.factory); if (f) f.disruption = 2; news(g, 'company', 'Walk-out', 'The workforce strikes. Output at the plant collapses for two months.'); }
    else news(g, 'company', 'The union backs down', 'Without support for a strike, the dispute fades away.');
  } else if (d.id === 'recall') {
    const family = d.data?.family ? String(d.data.family) : null;
    const share = Number(d.data?.share ?? 0.3);
    const kind = String(d.data?.kind ?? 'engine');
    const units = Number(d.data?.units ?? 0);
    const keyOf = (m: VehicleModel) => (kind === 'platform' ? platformKey(m) : engineKey(m));
    const affected = family ? p.models.filter((m) => keyOf(m) === family) : p.models.filter((m) => m.name === d.data?.model);
    if (eff === 'recall') {
      charge(p, cost); p.reliabilityRep = Math.max(0, p.reliabilityRep - (1 + 3 * share));
      for (const m of affected) m.recallRisk = Math.max(m.recallRisk ?? 0, 0.25);
      if (family) recordDefect(g, p, kind, family, 'recall', units);
      news(g, 'company', `${d.data?.model} recalled`, 'The recall is handled promptly. Owners are reassured, though showroom traffic dips for a while.');
    } else {
      charge(p, cost * 0.25);
      if (chance(rng, 0.4)) {
        p.reliabilityRep = Math.max(0, p.reliabilityRep - (5 + 8 * share)); p.prestige = Math.max(0, p.prestige - 4); charge(p, cost * 1.5);
        for (const m of affected) m.recallRisk = 1;
        if (family) recordDefect(g, p, kind, family, 'exposed', units);
        news(g, 'company', 'Cover-up exposed', `Journalists reveal the hidden defect in the ${d.data?.model}. A forced recall, fines and a battered reputation follow; buyers avoid every model with that engine.`);
      } else { if (family) recordDefect(g, p, kind, family, 'quiet', units); news(g, 'company', 'Quiet fix', 'Cars are repaired at their next service. Nobody notices.'); }
    }
  } else if (d.id === 'poach') {
    if (eff === 'pay') { charge(p, cost); news(g, 'company', 'Team retained', 'Your engineers stay.'); }
    else { p.engineers = Math.round(p.engineers * 0.94); const a = pick(rng, TECH_AREAS); p.tech[a] -= 0.3; news(g, 'company', 'Engineers leave', `A design group departs for a rival, taking ${AREA_NAME[a].toLowerCase()} know-how with them.`); }
  }
  g.decision = null;
}
