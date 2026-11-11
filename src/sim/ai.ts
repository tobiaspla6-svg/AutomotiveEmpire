// Builds full Company objects from the historical catalogue and runs the AI manufacturers.
// Historical model rows carry only real, coarse facts (name, years, engine layout, displacement,
// drivetrain). Everything else about a car is ESTIMATED here from era- and segment-typical
// engineering choices and then pushed through the same engineering model the player uses.
import type { Company, Factory, GameState, RegionId, Tech, VehicleModel, VehicleSpec } from './types';
import { MAKERS, makerStart, type MakerDef, type ModelRow } from '../data/manufacturers';
import { COUNTRY, REGION_IDS } from '../data/world';
import { BODY, CYL, computeVehicle, defaultVehicle } from './engineering';
import { emptyLedger, industryTech, makeModel, news, refreshStats, uid, unitCost, wage, zeroRegions, INTEREST_BASE, factoryValue } from './company';
import { emptyPending, openBooks } from './accounts';
import { suggestedPrice, type MarketResult } from './market';
import { clamp, cpi, kf, lerp } from './util';
import { rnd, type Rng } from './rng';

const era = (y: number, pts: [number, number][]) => kf(pts, y);

export function specFromRow(row: ModelRow, def: MakerDef): VehicleSpec {
  const y = clamp(row.from, 1946, 2030);
  const seg = row.seg;
  const exotic = def.archetype === 'exotic';
  const s = defaultVehicle(y, row.body);
  const e = s.engine;
  e.layout = row.layout;
  if (row.layout === 'EV') { e.motorKw = row.kw ?? 150; e.batteryKwh = row.kwh ?? 60; s.gearbox = 'auto'; }
  else {
    e.displacement = row.cc;
    e.aspiration = row.asp === 't' ? 'turbo' : row.asp === 'tt' ? 'twinturbo' : row.asp === 's' ? 'supercharged' : 'na';
    e.boost = row.asp === 's' ? 0.5 : y < 1985 ? 0.5 : y < 2003 ? 0.7 : 1.0;
    const usV8 = (row.layout === 'V8' || row.layout === 'I6') && def.country === 'USA' && y < 1996;
    const sporty = seg === 'sports' || seg === 'supercar' || def.archetype === 'sports' || exotic;
    e.valvetrain = usV8 ? 'ohv' : sporty ? (y < 1962 ? 'sohc' : y < 1984 ? 'dohc2' : 'dohc4') : y < 1966 ? 'ohv' : y < 1990 ? 'sohc' : 'dohc4';
    if (row.layout.startsWith('F') && y < 1990 && !exotic && seg !== 'supercar') e.valvetrain = y < 1964 ? 'ohv' : 'sohc';
    const turbo = e.aspiration === 'turbo' || e.aspiration === 'twinturbo';
    e.fuelSystem = y >= (turbo ? 2006 : 2012) ? 'di' : y >= (sporty || seg === 'premium' || seg === 'luxury' ? 1976 : 1987) ? 'efi' : 'carb';
    e.compression = era(y, [[1950, 7], [1965, 8.6], [1985, 9.5], [2005, 10.5], [2020, 11.5]]) + (sporty ? 0.5 : 0) - (turbo ? (e.fuelSystem === 'di' ? 1.2 : 2.2) : 0);
    e.cam = { budget: 0.25, family: 0.3, premium: 0.38, luxury: 0.3, sports: 0.55, supercar: 0.72, suv: 0.25, pickup: 0.2 }[seg];
    e.vvt = y >= (sporty ? 1992 : 2000);
    e.aluBlock = exotic || y >= 2002 || row.layout.startsWith('F');
    e.hybridKw = row.hybrid ?? 0;
    e.boreStroke = sporty ? 1.12 : usV8 ? 1.12 : 0.98;
    let red = { ohv: 4800, sohc: 5600, dohc2: 6500, dohc4: 6600 }[e.valvetrain] + (sporty ? 700 : 0) + (seg === 'supercar' ? 600 : 0) + clamp((y - 1960) * 12, 0, 700);
    if (y < 1960) red -= 500;
    // keep mean piston speed inside the era's safe limit
    const vCyl = row.cc / CYL[row.layout] / 1e6;
    const stroke = Math.cbrt((4 * vCyl) / (Math.PI * e.boreStroke ** 2));
    const spLim = 17 + 6 * clamp((y - 1950) / 70, 0, 1) + 1.2;
    e.redline = Math.round(Math.min(red, (spLim * 0.97 * 60) / (2 * stroke)) / 100) * 100;
  }
  s.quality = clamp({ budget: 0.35, family: 0.45, premium: 0.65, luxury: 0.85, sports: 0.55, supercar: 0.8, suv: 0.5, pickup: 0.45 }[seg] + (exotic ? 0.05 : 0) + (kf(def.reliability, y) - 60) / 250, 0.15, 1);
  s.size = { budget: 0.9, family: 1.0, premium: 1.05, luxury: 1.12, sports: 0.96, supercar: 1.0, suv: 1.0, pickup: 1.0 }[seg] * (row.cc > 0 && row.cc < 800 ? 0.88 : 1) * (y < 1965 && seg === 'budget' ? 0.95 : 1);
  const mclaren = def.id === 'mclaren';
  s.chassis = row.body === 'pickup' || (row.body === 'suv' && y < 1995) ? 'ladder' : mclaren ? 'carbon' : exotic && row.body !== 'suv' ? (y >= 1999 ? 'aluminium' : 'spaceframe') : 'steel';
  s.panels = mclaren ? 'carbon' : exotic ? 'aluminium' : row.name.includes('Corvette') ? 'fibreglass' : 'steel';
  s.enginePos = row.pos === 'm' ? 'mid' : row.pos === 'r' ? 'rear' : 'front';
  s.drive = row.drive === 'F' ? 'FWD' : row.drive === 'A' ? 'AWD' : 'RWD';
  if (row.layout !== 'EV') {
    const lux = seg === 'luxury' || seg === 'premium';
    const dct = (seg === 'supercar' && y >= 2009) || (exotic && y >= 2009) || (def.id === 'porsche' && y >= 2012);
    s.gearbox = dct ? 'dct' : (lux && y >= 1965) || (def.country === 'USA' && y >= 1955 && seg !== 'sports') || (y >= 2012 && seg !== 'sports' && seg !== 'budget') ? 'auto' : 'manual';
    s.gears = s.gearbox === 'dct' ? 7 : s.gearbox === 'auto' ? (y < 1982 ? 3 : y < 2001 ? 4 : y < 2006 ? 5 : y < 2013 ? 6 : 8)
      : (y < (seg === 'supercar' || seg === 'sports' ? 1965 : 1976) ? 4 : y < 1999 ? 5 : 6);
  }
  const perf = seg === 'sports' || seg === 'supercar';
  s.suspFront = perf || seg === 'luxury' ? 'wishbone' : 'macpherson';
  s.suspRear = row.body === 'pickup' ? 'solid' : perf ? (exotic || y >= 1985 ? 'wishbone' : y < 1962 ? 'solid' : 'macpherson')
    : (seg === 'premium' || seg === 'luxury') ? (y >= 1990 ? 'multilink' : y >= 1960 ? 'macpherson' : 'solid') : y < 1972 ? 'solid' : y >= 2005 && seg !== 'budget' ? 'multilink' : 'macpherson';
  s.sport = { budget: 0.2, family: 0.25, premium: 0.35, luxury: 0.15, sports: 0.65, supercar: 0.85, suv: 0.2, pickup: 0.1 }[seg];
  s.brakes = perf || seg === 'luxury' ? (y >= 2008 && seg === 'supercar' ? 'ceramic' : y >= 1968 ? 'vented' : y >= 1957 ? 'disc' : 'drum') : y >= 1992 ? 'vented' : y >= 1966 ? 'disc' : 'drum';
  const tw: Record<string, [number, number][]> = {
    budget: [[1950, 135], [1990, 165], [2020, 195]], family: [[1950, 155], [1990, 185], [2020, 215]], premium: [[1950, 170], [1990, 205], [2020, 245]],
    luxury: [[1950, 185], [1990, 225], [2020, 255]], sports: [[1950, 160], [1975, 195], [2000, 225], [2020, 255]],
    supercar: [[1950, 175], [1965, 205], [1985, 255], [2005, 295], [2020, 315]], suv: [[1950, 185], [1990, 225], [2020, 245]], pickup: [[1950, 180], [1990, 225], [2020, 265]],
  };
  s.tireWidth = Math.round(era(y, tw[seg]) / 5) * 5;
  s.tireCompound = seg === 'supercar' ? (y >= 1966 ? 'sport' : 'touring') : seg === 'sports' ? (y >= 1972 ? 'sport' : 'touring') : seg === 'budget' ? 'economy' : 'touring';
  s.wheelDia = Math.round(era(y, perf ? [[1950, 15], [1980, 15], [2000, 18], [2020, 20]] : [[1950, 14], [1980, 13.5], [2000, 15.5], [2020, 17.5]]) + (seg === 'luxury' || seg === 'suv' ? 1 : 0));
  s.wing = seg === 'supercar' && y >= 1975 ? (y >= 2000 ? 0.4 : 0.3) : seg === 'sports' && y >= 1985 ? 0.12 : 0;
  s.splitter = seg === 'supercar' && y >= 1985 ? 0.3 : 0;
  s.flatFloor = seg === 'supercar' && y >= 1995;
  s.aeroOpt = y < 1980 ? 0.2 : y < 2000 ? 0.5 : 0.7;
  s.interior = { budget: 'basic', family: 'standard', premium: 'premium', luxury: 'luxury', sports: exotic || (def.archetype === 'sports' && y >= 1985) ? 'premium' : 'standard', supercar: 'premium', suv: 'standard', pickup: y >= 2000 ? 'standard' : 'basic' }[seg] as VehicleSpec['interior'];
  if (seg === 'premium' && row.body === 'suv') s.interior = 'premium';
  s.seats = row.body === 'supercar' || row.body === 'roadster' ? 2 : BODY[row.body].seats;
  s.safety = clamp(Math.round(era(y, [[1950, 0], [1962, 0.6], [1975, 1.1], [1990, 1.8], [2000, 2.4], [2010, 3]]) + (seg === 'premium' || seg === 'luxury' ? 0.35 : 0)), 0, 3);
  s.color = def.color;
  s.finalDrive = 3.7;
  return s;
}

export function makerTech(def: MakerDef, year: number): Tech {
  const t = industryTech(year, -1);
  if (def.archetype === 'exotic') { t.engine += 2.5; t.chassis += 2.5; t.aero += 2.5; t.manufacturing -= 2; }
  if (def.archetype === 'sports') { t.engine += 2; t.chassis += 2; t.aero += 2; }
  if (def.archetype === 'premium') { t.engine += 1.5; t.chassis += 1; t.electronics += 2; }
  if (def.archetype === 'mass') t.manufacturing += kf(def.reliability, year) > 80 ? 3 : 1;
  return t;
}

/** Create the in-game model for a catalogue row. Final drive is chosen by a small search, price from segment positioning. */
export function modelFromRow(g: GameState, c: Company, def: MakerDef, row: ModelRow): VehicleModel {
  const designYear = clamp(row.from, 1946, g.year);
  const tech = makerTech(def, designYear);
  const spec = specFromRow(row, def);
  if (spec.engine.layout !== 'EV') {
    let best = 3.7, bestScore = -1;
    for (const fd of [2.7, 3.1, 3.5, 3.9, 4.3]) {
      spec.finalDrive = fd;
      const st = computeVehicle(spec, { year: designYear, tech });
      const sc = st.scores.performance + 0.5 * st.scores.economy;
      if (sc > bestScore) { bestScore = sc; best = fd; }
    }
    spec.finalDrive = best;
  }
  const m = makeModel(g, row.name, spec, row.seg, tech, designYear);
  m.historical = true; m.endYear = row.to; m.volumeWeight = row.w;
  m.status = 'production'; m.launchYear = designYear; m.launchMonth = 1;
  m.cumulativeUnits = 20000 * row.w;
  const cost = unitCost(g, m, { country: c.country, automation: 0.4 }, 500 * row.w);
  m.price = Math.max(cost * 1.22, suggestedPrice(m, c, g.year));
  m.lastUnitCost = cost;
  return m;
}

export function presenceAt(def: MakerDef, year: number): Record<RegionId, number> {
  const out = zeroRegions();
  REGION_IDS.forEach((r, i) => { out[r] = kf(def.presence.map(([y, a]) => [y, a[i]] as [number, number]), year); });
  const sum = REGION_IDS.reduce((a, r) => a + out[r], 0) || 1;
  for (const r of REGION_IDS) out[r] /= sum;
  return out;
}

/** Give each active model production lines, filling the factories with the most free capacity first. */
export function allocateLines(c: Company, monthlyVolume: number) {
  for (const f of c.factories) f.lines = [];
  const active = c.models.filter((m) => m.status === 'production');
  const wSum = active.reduce((a, m) => a + m.volumeWeight, 0) || 1;
  const free = new Map<Factory, number>(c.factories.map((f) => [f, f.capacity]));
  for (const m of [...active].sort((a, b) => b.volumeWeight - a.volumeWeight)) {
    let v = (monthlyVolume * m.volumeWeight) / wSum * 1.08;
    let guard = 0;
    while (v > 0.5 && guard++ < 6) {
      let bestF: Factory | null = null, bestFree = 0.5;
      for (const [f, fr] of free) if (fr > bestFree && !f.lines.some((l) => l.modelId === m.id)) { bestF = f; bestFree = fr; }
      if (!bestF) break;
      const take = Math.min(v, bestFree);
      bestF.lines.push({ modelId: m.id, share: take / bestF.capacity, ramp: 1, target: -1 });
      free.set(bestF, bestFree - take);
      v -= take;
    }
  }
}

export function companyFromMaker(g: GameState, def: MakerDef, isPlayer: boolean): Company {
  const year = g.year;
  const volume = kf(def.production, year);
  const pres = presenceAt(def, year);
  const reach = zeroRegions(), awareness = zeroRegions();
  for (const r of REGION_IDS) { reach[r] = volume * pres[r]; awareness[r] = pres[r] > 0.005 ? 70 : 25; }
  const c: Company = {
    id: def.id, name: def.name, country: def.country, homeRegion: COUNTRY[def.country].region, color: def.color, color2: def.color2,
    founded: def.founded, isPlayer, dataId: def.id, cash: 0, debt: 0, interestRate: 0.06, reach, awareness,
    prestige: kf(def.prestige, year), reliabilityRep: kf(def.reliability, year), sportiness: kf(def.sportiness, year),
    factories: [], models: [], tech: makerTech(def, year),
    rdBudget: { engine: 0, chassis: 0, aero: 0, electronics: 0, manufacturing: 0 }, engineers: 0, marketingBudget: 0, ledger: [],
    motorsport: null, board: null, alive: true, specialization: def.archetype, baseVolume: volume, taxAccrued: 0, ytdProfit: 0,
    msGlow: def.ms.some(([, a, b]) => year >= a && year <= b) ? 8 : 0, autoPrice: true, aiFactor: 1, troubleMonths: 0,
    books: { otherAssets: 0, pending: emptyPending(), close: { cash: 0, debt: 0, inventoryValue: 0, fixedAssets: 0 } },
  };
  for (const row of def.models) if (row.from <= year && row.to >= year) c.models.push(modelFromRow(g, c, def, row));
  if (!c.models.length) { // gap in the catalogue: keep the most recent model alive
    const prev = [...def.models].filter((r) => r.from <= year).sort((a, b) => b.to - a.to)[0] ?? def.models[0];
    c.models.push(modelFromRow(g, c, def, prev));
  }
  const plants = def.factories.filter((f) => f.from <= year);
  if (!plants.length) plants.push(def.factories[0]);
  const wts = plants.map((f, i) => (i === 0 || f.country === def.country ? 1 : 0.45));
  const wSum = wts.reduce((a, b) => a + b, 0);
  const auto = kf([[1950, 0.1], [1980, 0.35], [2000, 0.55], [2020, 0.7]], year) * (def.archetype === 'exotic' ? 0.4 : 1);
  plants.forEach((p, i) => c.factories.push({
    id: uid(g, 'f'), name: p.name, country: p.country, region: COUNTRY[p.country].region, capacity: Math.max(10, ((volume / 12) * 1.15 * wts[i]) / wSum),
    automation: auto, lines: [], expansion: null, builtYear: p.from, historical: true, disruption: 0, bookValue: 0,
  }));
  for (const f of c.factories) f.bookValue = factoryValue(f, year); // [E] plants carried at estimated depreciated value
  allocateLines(c, volume / 12);
  // [E] finances from the estimated "health" curve
  const wS = c.models.reduce((a, m) => a + m.volumeWeight, 0) || 1;
  const revenue = c.models.reduce((a, m) => a + (volume * m.volumeWeight) / wS * m.price * 0.88, 0);
  const h = kf(def.health, year);
  c.cash = (revenue / 12) * (0.6 + 4 * h);
  c.debt = revenue * Math.max(0, 0.55 - 0.5 * h);
  const eng = revenue * (def.archetype === 'mass' ? 0.012 : 0.03) / (12 * 1.6 * 170 * wage(def.country, year));
  c.engineers = Math.max(20, Math.round(eng));
  const rd = (revenue * (def.archetype === 'mass' ? 0.012 : 0.02)) / 12 / 5;
  c.rdBudget = { engine: rd, chassis: rd, aero: rd, electronics: rd, manufacturing: rd };
  c.marketingBudget = (revenue * 0.025) / 12;
  for (const m of c.models) { m.inventory = isPlayer ? ((volume * m.volumeWeight) / wS / 12) * 0.6 : 0; m.inventoryValue = m.inventory * m.lastUnitCost; }
  openBooks(c);
  return c;
}

/** AI manufacturers sell what the market asks for; their finances are a compact approximation. */
export function runAiMonth(g: GameState, c: Company, mk: MarketResult) {
  const L = emptyLedger(g);
  const home = c.factories[0] ?? { country: c.country, automation: 0.4 };
  for (const m of c.models) {
    if (m.status !== 'production') continue;
    const dem = mk.demand.get(m.id);
    let sold = 0;
    for (const r of REGION_IDS) { const n = dem ? dem[r] : 0; m.lastSales[r] = n; sold += n; }
    m.lastDemand = sold;
    if (sold <= 0) continue;
    const uc = unitCost(g, m, home, sold);
    m.lastUnitCost = uc; m.cumulativeUnits += sold;
    L.revenue += sold * m.price * 0.88; L.cogs += sold * uc; L.units += sold;
    m.salesHistory.push(Math.round(sold)); if (m.salesHistory.length > 60) m.salesHistory.shift();
  }
  L.other = L.revenue * 0.17 + c.baseVolume * 60 * cpi(g.year) / 12; // overheads, R&D, marketing, programmes
  L.interest = (c.debt * (g.macro.interestBase + 0.02)) / 12;
  // AI makers build to order (no inventory); between-tick postings (e.g. fines) already moved their cash
  const pd = c.books.pending;
  L.oneOff = pd.oneOff + pd.dev + pd.motorsport + pd.writeOff;
  L.otherIncome = pd.income;
  c.books.pending = emptyPending();
  const pre = L.revenue + L.otherIncome - L.cogs - L.other - L.interest - L.oneOff;
  L.tax = pre > 0 ? pre * 0.25 : 0;
  L.profit = pre - L.tax;
  c.cash += L.revenue - L.cogs - L.other - L.interest - L.tax;
  if (c.cash > 0 && c.debt > 0) { const pay = Math.min(c.cash * 0.1, c.debt); c.cash -= pay; c.debt -= pay; }
  if (c.cash < 0) { c.debt += -c.cash; c.cash = 0; }
  L.cash = c.cash; L.debt = c.debt;
  c.ledger.push(L); if (c.ledger.length > 60) c.ledger.shift();
}

/** January housekeeping for an AI manufacturer: follow (or drift from) history. */
export function runAiYear(g: GameState, c: Company, rng: Rng) {
  const def = MAKERS.find((d) => d.id === c.dataId);
  if (!def) return;
  // lineup: retire ended models, launch catalogue models, refresh ageing ones
  for (const m of c.models) if (m.status === 'production' && m.endYear !== undefined && m.endYear < g.year) m.status = 'retired';
  for (const row of def.models) {
    if (row.from === g.year && !c.models.some((m) => m.name === row.name && m.status === 'production')) {
      const m = modelFromRow(g, c, def, row); m.cumulativeUnits = 0;
      c.models.push(m);
      if (row.w >= 2 || row.seg === 'supercar') news(g, 'market', `${c.name} launches the ${row.name}`, `New ${row.seg} model enters the market.`);
    }
  }
  for (const m of c.models) {
    if (m.status !== 'production') continue;
    if (g.year - m.launchYear >= 9) { // long-running nameplates get re-engineered with current technology
      m.frozenTech = makerTech(def, g.year); m.launchYear = g.year; m.generation++; m.designYear = g.year;
    }
    m.price *= cpi(g.year) / cpi(g.year - 1);
  }
  if (!c.models.some((m) => m.status === 'production')) {
    const last = c.models[c.models.length - 1];
    if (last) { last.status = 'production'; last.endYear = 2099; last.frozenTech = makerTech(def, g.year); last.launchYear = g.year; }
  }
  c.models = c.models.filter((m) => m.status !== 'retired');
  // distribution strength follows the historical production curve, modulated by how the company is actually doing
  const noise = g.historyMode === 'alternative' ? 0.08 : 0.02;
  const margin = c.ledger.length ? c.ledger.slice(-12).reduce((a, l) => a + l.profit, 0) / Math.max(1, c.ledger.slice(-12).reduce((a, l) => a + l.revenue, 0)) : 0.03;
  c.aiFactor = clamp(c.aiFactor * (1 + clamp(margin, -0.1, 0.1) * 0.3 + (rnd(rng) - 0.5) * noise), 0.4, 2.2);
  const volume = kf(def.production, g.year) * c.aiFactor;
  c.baseVolume = volume;
  const pres = presenceAt(def, g.year);
  for (const r of REGION_IDS) { c.reach[r] = volume * pres[r]; c.awareness[r] = pres[r] > 0.005 ? 70 : 25; }
  c.prestige = lerp(c.prestige, kf(def.prestige, g.year), 0.3);
  c.reliabilityRep = lerp(c.reliabilityRep, kf(def.reliability, g.year), 0.3);
  c.sportiness = lerp(c.sportiness, kf(def.sportiness, g.year), 0.3);
  c.tech = makerTech(def, g.year);
  // new plants open on their historical dates
  for (const p of def.factories) {
    if (p.from === g.year && !c.factories.some((f) => f.name === p.name)) {
      c.factories.push({ id: uid(g, 'f'), name: p.name, country: p.country, region: COUNTRY[p.country].region, capacity: 10, automation: 0.5, lines: [], expansion: null, builtYear: g.year, historical: true, disruption: 0, bookValue: 0 });
    }
  }
  const wts = c.factories.map((f, i) => (i === 0 || f.country === c.country ? 1 : 0.45));
  const wSum = wts.reduce((a, b) => a + b, 0);
  c.factories.forEach((f, i) => { f.capacity = Math.max(10, ((volume / 12) * 1.15 * wts[i]) / wSum); });
  allocateLines(c, volume / 12);
  if (c.debt > 0 && c.cash <= 0 && c.debt > 1.2 * c.ledger.slice(-12).reduce((a, l) => a + l.revenue, 0)) {
    c.debt *= 0.4; c.aiFactor *= 0.85;
    news(g, 'market', `${c.name} restructures its debt`, 'Creditors accept a restructuring; plants are consolidated and volume targets cut.');
  }
  for (const m of c.models) refreshStats(g, m);
}

export const makersAvailable = (year: number) => MAKERS.filter((d) => makerStart(d) <= year);
export { INTEREST_BASE };
