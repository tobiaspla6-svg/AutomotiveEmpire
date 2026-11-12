// Company-level simulation shared by the player and AI manufacturers:
// model bookkeeping, unit costs, factories, research, finance and the player's monthly tick.
import type { Company, Factory, GameState, MonthLedger, RegionId, SegmentId, Tech, TechArea, VehicleModel, VehicleSpec } from './types';
import { COUNTRY, REGION_IDS } from '../data/world';
import { computeVehicle } from './engineering';
import { clamp, cpi, kf } from './util';
import { modProduct, type MarketResult } from './market';
import { closeMonth, depreciate, mergePending } from './accounts';
import { enginesOf, familyOf, maturityOf, platformOf, platformsOf, sharedVolume, type SharedVolume } from './families';

export const uid = (g: GameState, p: string) => `${p}${g.nextId++}`;
export const TECH_AREAS: TechArea[] = ['engine', 'chassis', 'aero', 'electronics', 'manufacturing'];
export const AREA_NAME: Record<TechArea, string> = { engine: 'Powertrain', chassis: 'Chassis & materials', aero: 'Aerodynamics', electronics: 'Electronics & safety', manufacturing: 'Manufacturing' };
export const zeroRegions = (): Record<RegionId, number> => ({ NA: 0, EU: 0, JP: 0, CN: 0, LATAM: 0, ROW: 0 });

/** Nominal hourly manufacturing wage. */
export function wage(country: string, year: number): number {
  const c = COUNTRY[country] ?? COUNTRY.USA;
  return c.wage2020 * kf(c.wageCurve, year) * cpi(year);
}
export const engineerCost = (c: Company, year: number) => 1.6 * 170 * wage(c.country, year);
export const industryTech = (year: number, lead = -1): Tech => ({ engine: year + lead, chassis: year + lead, aero: year + lead, electronics: year + lead, manufacturing: year + lead });
export const materialIndex = (g: GameState) => g.macro.materialCost * modProduct(g, (m) => m.materialCost);
export const INTEREST_BASE: [number, number][] = [[1950, 0.04], [1970, 0.07], [1981, 0.15], [1990, 0.09], [2000, 0.065], [2010, 0.04], [2020, 0.035], [2023, 0.07], [2030, 0.05]];

export function makeModel(g: GameState, name: string, spec: VehicleSpec, segment: SegmentId, tech: Tech, designYear: number): VehicleModel {
  const stats = computeVehicle(spec, { year: g.year, tech });
  return {
    id: uid(g, 'm'), name, spec, segment, status: 'design', devMonthsLeft: 0, devMonthsTotal: 0, devCostPaid: 0, devCostTotal: 0,
    frozenTech: { ...tech }, designYear, launchYear: 0, launchMonth: 1, price: 0, inventory: 0, cumulativeUnits: 0, generation: 1, stats,
    historical: false, volumeWeight: 1, lastSales: zeroRegions(), lastDemand: 0, lastUnitCost: 0, salesHistory: [], lifetimeRevenue: 0, recallRisk: 0, inventoryValue: 0,
  };
}
/** Re-evaluate a model against the current year: costs inflate, and scores are relative to rising era norms. */
export function refreshStats(g: GameState, m: VehicleModel, owner?: Company) {
  const c = owner ?? (m.engineFamilyId || m.platformId ? g.companies.find((x) => x.models.includes(m)) : undefined);
  m.stats = computeVehicle(m.spec, { year: g.year, tech: m.frozenTech, maturity: maturityOf(c, m, g.year) });
}

/**
 * Cost to build one car at `monthlyVol` cars a month. Purchased parts get cheaper with volume; the engine and the
 * platform parts (structure, running gear, driveline) are bought at the volume of every car that shares them
 * (`shared`), the rest at this car's own volume.
 */
/** A vehicle can be signed off once every stand-alone architecture it uses is ready. */
export function dependenciesReady(c: Company, m: VehicleModel): boolean {
  const f = familyOf(c, m), p = platformOf(c, m);
  if (f && f.status !== 'ready' && f.ownerModelId !== m.id) return false;
  if (p && p.status !== 'ready' && p.ownerModelId !== m.id) return false;
  const v = f?.variants.find((x) => x.id === m.engineVariantId);
  if (v && v.status !== 'ready' && v.ownerModelId !== m.id) return false;
  return true;
}
/** Engineering sign-off of a vehicle and of the architecture developed with it. */
export function completeModel(g: GameState, c: Company, m: VehicleModel) {
  m.status = 'ready'; m.devMonthsLeft = 0;
  for (const x of [...enginesOf(c), ...platformsOf(c)]) {
    if (x.ownerModelId !== m.id) continue;
    x.status = 'ready'; x.devMonthsLeft = 0; x.devCostPaid = x.devCostTotal; x.introYear = g.year; delete x.ownerModelId;
  }
  for (const f of enginesOf(c)) for (const v of f.variants) if (v.ownerModelId === m.id) { v.status = 'ready'; v.readyIn = 0; delete v.ownerModelId; }
  refreshStats(g, m, c);
  news(g, 'company', `${m.name} is ready for production`, 'Engineering sign-off complete. Assign it to a factory line and set a price to start selling.', 'ready');
}

export function unitCost(g: GameState, m: VehicleModel, f: Factory | { country: string; automation: number }, monthlyVol: number, shared?: SharedVolume): number {
  const learning = Math.max(0.8, Math.pow(Math.max(m.cumulativeUnits, 500) / 500, -0.04));
  const vf = (v: number) => 1 + 1.5 / (1 + v / 100);
  const cb = m.stats.costBreakdown, total = m.stats.partsCost || 1;
  const eShare = shared ? (cb.Powertrain ?? 0) / total : 0;
  const pShare = shared ? ((cb.Chassis ?? 0) + (cb['Running gear'] ?? 0) + (cb.Driveline ?? 0)) / total : 0;
  const volumeFactor = shared ? eShare * vf(shared.engine) + pShare * vf(shared.platform) + (1 - eShare - pShare) * vf(monthlyVol) : vf(monthlyVol);
  // Manufacturing know-how ahead of (or behind) the industry when the car was engineered: less scrap and rework,
  // fewer hours per car. Three years ahead ≈ 4 % off parts and 9 % off labour.
  const lead = clamp(m.frozenTech.manufacturing - (m.designYear - 1), -6, 8);
  const parts = m.stats.partsCost * materialIndex(g) * volumeFactor * learning * (1 - 0.012 * lead);
  const labour = m.stats.labourHours * (1 - 0.65 * f.automation) * wage(f.country, g.year) * (1 - 0.03 * lead);
  return parts + labour;
}
/** Quick estimate used by the UI and by pricing before a factory is chosen. */
export function estimateUnitCost(g: GameState, c: Company, m: VehicleModel, monthlyVol = 0): number {
  const f = c.factories[0] ?? { country: c.country, automation: 0.3 };
  const own = monthlyVol || Math.max(20, m.lastDemand);
  return unitCost(g, m, f, own, sharedVolume(c, m, own));
}

/**
 * Restructuring programme: for three years administrative overheads fall by a quarter and plant fixed costs by a
 * tenth. Severance and consultants cost half a year of the expected saving up front, and the disruption costs a
 * little reliability reputation.
 */
export const RESTRUCTURE = { months: 36, overheadCut: 0.25, fixedCut: 0.1, upfrontYears: 0.5, reputation: 2 } as const;
/** Expected annual saving of a restructuring programme at the company's current size. */
export function restructuringSaving(g: GameState, c: Company): number {
  const rev = annualRevenue(c);
  const fixed = c.factories.reduce((a, f) => a + factoryFixedCost(f, g.year), 0) * 12;
  return rev * 0.035 * RESTRUCTURE.overheadCut + fixed * RESTRUCTURE.fixedCut;
}
export const factoryBuildCost = (capacity: number, automation: number, year: number) => capacity * 12 * 4000 * (1 + automation) * cpi(year) * kf([[1950, 0.5], [1990, 0.85], [2020, 1]], year);
export const factoryFixedCost = (f: Factory, year: number) => Math.max(f.capacity, 40) * (6 * wage(f.country, year) + 180 * cpi(year) * (1 + 1.5 * f.automation));
export const factoryValue = (f: Factory, year: number) => factoryBuildCost(f.capacity, f.automation, year) * 0.45;
export const lineShareUsed = (f: Factory) => f.lines.reduce((a, l) => a + l.share, 0);
/**
 * Line tooling for `units` a month. Engine machining (about a quarter of the tooling) and the platform's body-in-white
 * jigs and fixtures (about 40 %) are largely in place when the plant already builds another car with the same engine
 * family or platform.
 */
export function toolingCost(m: VehicleModel, units: number, at?: { c: Company; f: Factory }): number {
  let k = 1;
  if (at && (m.engineFamilyId || m.platformId)) {
    const others = at.f.lines.map((l) => at.c.models.find((x) => x.id === l.modelId)).filter((x): x is VehicleModel => !!x && x.id !== m.id);
    if (m.engineFamilyId && others.some((x) => x.engineFamilyId === m.engineFamilyId)) k -= TOOLING_SHARE.engine * 0.8;
    if (m.platformId && others.some((x) => x.platformId === m.platformId)) k -= TOOLING_SHARE.platform * 0.75;
  }
  return m.stats.toolingPerUnitCapacity * units * k;
}
export const TOOLING_SHARE = { engine: 0.25, platform: 0.4 } as const;

export function annualRevenue(c: Company): number { return c.ledger.slice(-12).reduce((a, l) => a + l.revenue, 0) * (12 / Math.max(1, Math.min(12, c.ledger.length))); }
export function annualProfit(c: Company): number { return c.ledger.slice(-12).reduce((a, l) => a + l.profit, 0) * (12 / Math.max(1, Math.min(12, c.ledger.length))); }
export function annualUnits(c: Company): number { return c.ledger.slice(-12).reduce((a, l) => a + l.units, 0) * (12 / Math.max(1, Math.min(12, c.ledger.length))); }
export function revenueBasis(c: Company): number {
  if (c.ledger.length >= 6) return annualRevenue(c);
  const act = c.models.filter((m) => m.status === 'production');
  const w = act.reduce((a, m) => a + m.volumeWeight, 0) || 1;
  return Math.max(annualRevenue(c), act.reduce((a, m) => a + (c.baseVolume * m.volumeWeight) / w * m.price * 0.88, 0));
}
export function creditLimit(c: Company, year: number): number {
  return Math.max(revenueBasis(c) * 0.5, 20e6 * cpi(year)) + c.factories.reduce((a, f) => a + factoryValue(f, year), 0) * 0.6;
}
export function valuation(c: Company, year: number): number {
  const rev = annualRevenue(c) || c.baseVolume * 20000 * cpi(year);
  const base = Math.max(0.55 * rev, 8 * annualProfit(c)) * (0.8 + c.prestige / 100);
  return Math.max(base + c.cash - c.debt, 0.15 * rev, 5e6 * cpi(year));
}
export function interestRate(g: GameState, c: Company): number {
  const base = g.macro.interestBase + g.macro.modifiers.reduce((a, m) => a + (m.interest ?? 0), 0);
  const lev = c.debt / Math.max(creditLimit(c, g.year), 1);
  return base + 0.02 * Math.min(lev, 2) + (g.difficulty === 'hard' ? 0.015 : g.difficulty === 'easy' ? -0.01 : 0);
}
export const researchRef = (year: number) => 1.5e6 * cpi(year) * kf([[1950, 0.15], [1980, 0.45], [2000, 0.8], [2020, 1]], year);
export const devEngineersNeeded = (g: GameState, c: Company, m: Pick<VehicleModel, 'devCostTotal' | 'devMonthsTotal'>) => Math.max(5, (m.devCostTotal * 0.3) / (Math.max(m.devMonthsTotal, 1) * engineerCost(c, g.year)));

export function emptyLedger(g: GameState): MonthLedger {
  return {
    y: g.year, m: g.month, revenue: 0, otherIncome: 0, cogs: 0, factoryFixed: 0, wages: 0, rd: 0, marketing: 0, dev: 0, logistics: 0, motorsport: 0, interest: 0, other: 0,
    oneOff: 0, depreciation: 0, assetGains: 0, tax: 0, profit: 0, production: 0, capex: 0, units: 0, operatingCash: 0, investingCash: 0, financingCash: 0,
    cashStart: 0, cash: 0, debt: 0, inventoryValue: 0, fixedAssets: 0, equity: 0,
  };
}

export function news(g: GameState, kind: GameState['news'][number]['kind'], title: string, body: string, tag?: string) {
  g.news.unshift({ y: g.year, m: g.month, title, body, kind, tag });
  if (g.news.length > 250) g.news.length = 250;
}

/** Player manufacturer: one month of production, sales, development, research and finance. */
export function runPlayerMonth(g: GameState, c: Company, mk: MarketResult, extra: { msCost: number; msIncome: number }): MonthLedger {
  const L = emptyLedger(g);
  const prodAll = modProduct(g, (m) => m.productionAll);

  // ---- factories & production
  const produced = new Map<string, number>();
  const costSum = new Map<string, number>();
  const lineCap = new Map<string, number>();
  for (const f of c.factories) for (const l of f.lines) lineCap.set(l.modelId, (lineCap.get(l.modelId) ?? 0) + f.capacity * l.share * l.ramp);
  for (const f of c.factories) {
    if (f.expansion) {
      f.expansion.monthsLeft--;
      if (f.expansion.monthsLeft <= 0) {
        const old = f.capacity; f.capacity += f.expansion.add; f.expansion = null;
        for (const l of f.lines) l.share *= old / f.capacity; // lines keep their absolute capacity
        news(g, 'company', `${f.name} expansion complete`, `Capacity is now ${Math.round(f.capacity).toLocaleString()} units per month.`);
      }
    }
    L.factoryFixed += factoryFixedCost(f, g.year) * (c.restructuring ? 1 - RESTRUCTURE.fixedCut : 1);
    const regionMult = prodAll * modProduct(g, (m) => m.production?.[f.region]) * (f.disruption > 0 ? 0.25 : 1);
    if (f.disruption > 0) f.disruption--;
    for (const l of f.lines) {
      const m = c.models.find((x) => x.id === l.modelId);
      if (!m || (m.status !== 'ready' && m.status !== 'production')) continue;
      const cap = f.capacity * l.share * l.ramp * regionMult;
      const totalCap = lineCap.get(m.id) || 1;
      const lastD = m.lastDemand > 0 ? m.lastDemand : totalCap * 0.6; // first month: build launch stock
      const desiredModel = Math.max(0, lastD * 1.03 + (0.6 * lastD - m.inventory) * 0.5);
      const target = l.target >= 0 ? l.target : desiredModel * ((f.capacity * l.share * l.ramp) / totalCap);
      const n = Math.max(0, Math.min(cap, target));
      l.ramp = Math.min(1, l.ramp + 0.2);
      if (n <= 0) continue;
      const uc = unitCost(g, m, f, totalCap, sharedVolume(c, m, totalCap));
      produced.set(m.id, (produced.get(m.id) ?? 0) + n);
      costSum.set(m.id, (costSum.get(m.id) ?? 0) + n * uc);
      L.production += n * uc; // paid now, held in inventory until the car is sold
    }
  }

  // ---- sales
  for (const m of c.models) {
    const made = produced.get(m.id) ?? 0;
    if (made > 0) {
      m.lastUnitCost = (costSum.get(m.id) ?? 0) / made;
      m.inventory += made;
      m.inventoryValue += costSum.get(m.id) ?? 0;
      m.cumulativeUnits += made;
      const fam = familyOf(c, m), plat = platformOf(c, m);
      if (fam) fam.cumulativeUnits += made;
      if (plat) plat.cumulativeUnits += made;
      if (m.status === 'ready') m.status = 'production';
    }
    const dem = mk.demand.get(m.id);
    let total = 0;
    if (dem) for (const r of REGION_IDS) total += dem[r];
    m.lastDemand = total;
    let sold = 0;
    const ratio = total > 0 ? Math.min(1, m.inventory / total) : 0;
    for (const r of REGION_IDS) {
      const n = dem ? dem[r] * ratio : 0;
      m.lastSales[r] = n;
      sold += n;
      if (n > 0) {
        const local = c.factories.some((f) => f.region === r && f.lines.some((l) => l.modelId === m.id));
        L.logistics += n * (local ? 150 : 700) * cpi(g.year);
      }
    }
    if (sold > 0) {
      if (!m.launchYear) {
        m.launchYear = g.year; m.launchMonth = g.month;
        news(g, 'company', `${c.name} ${m.name} goes on sale`, `First customer deliveries at ${Math.round(m.price).toLocaleString()} USD.`);
      }
      // cost of sales at the average cost of the stock on hand
      const cogs = m.inventory > 1e-9 ? m.inventoryValue * Math.min(1, sold / m.inventory) : 0;
      L.cogs += cogs;
      m.inventoryValue -= cogs;
      m.inventory -= sold;
      if (m.inventory < 1e-6) { m.inventory = 0; m.inventoryValue = 0; }
      const rev = sold * m.price * 0.88; // 12 % dealer margin
      L.revenue += rev; L.units += sold; m.lifetimeRevenue += rev;
    }
    L.logistics += m.inventory * (m.lastUnitCost || m.stats.partsCost) * 0.008; // stock financing & storage
    if (m.status === 'production' || m.salesHistory.length) { m.salesHistory.push(Math.round(sold)); if (m.salesHistory.length > 120) m.salesHistory.shift(); }
  }

  // ---- development projects (vehicles, and stand-alone engine-family and platform programmes, share the engineering staff)
  const projects = c.models.filter((m) => m.status === 'development');
  const parts = [...enginesOf(c), ...platformsOf(c)].filter((x) => x.status === 'development' && !x.ownerModelId);
  const need = projects.reduce((a, m) => a + (m.devMonthsLeft > 0 ? devEngineersNeeded(g, c, m) : 0), 0) + parts.reduce((a, x) => a + devEngineersNeeded(g, c, x), 0);
  const speed = need > 0 ? clamp(c.engineers / need, 0.25, 1.3) : 1;
  for (const x of parts) {
    const progress = Math.min(speed, x.devMonthsLeft);
    const share = x.devMonthsLeft > 0 ? progress / x.devMonthsLeft : 1;
    const spend = Math.max(0, x.devCostTotal - x.devCostPaid) * share;
    x.devCostPaid += spend; L.dev += spend;
    x.devMonthsLeft -= progress;
    if (x.devMonthsLeft <= 1e-9) {
      x.status = 'ready'; x.devMonthsLeft = 0; x.introYear = g.year;
      news(g, 'company', `${x.name} is ready`, 'The architecture is signed off. Vehicles that use it can now complete their own development.', 'ready');
    }
  }
  for (const f of enginesOf(c)) for (const v of f.variants) {
    if (v.status !== 'development' || v.ownerModelId) continue;
    v.readyIn = Math.max(0, v.readyIn - 1);
    if (v.readyIn <= 0) { v.status = 'ready'; news(g, 'company', `${f.name}: ${v.name} variant ready`, 'Calibration and durability testing are complete.', 'ready'); }
  }
  for (const m of projects) {
    if (m.devMonthsLeft <= 1e-9) { // the car is done but waits for a stand-alone engine family, variant or platform
      if (dependenciesReady(c, m)) completeModel(g, c, m);
      continue;
    }
    // The approved budget is spent in proportion to the work done: this month's share of the
    // remaining work pays the same share of the remaining budget. The final month therefore pays
    // exactly what is left and the programme always costs exactly devCostTotal, whatever the speed.
    const progress = Math.min(speed, m.devMonthsLeft);
    const share = m.devMonthsLeft > 0 ? progress / m.devMonthsLeft : 1;
    const spend = Math.max(0, m.devCostTotal - m.devCostPaid) * share;
    m.devCostPaid += spend; L.dev += spend;
    m.devMonthsLeft -= progress;
    // bundled engine family, variant and platform follow the car's programme
    const frac = m.devCostTotal > 0 ? m.devCostPaid / m.devCostTotal : 1;
    for (const x of [...enginesOf(c), ...platformsOf(c)]) if (x.ownerModelId === m.id) { x.devCostPaid = x.devCostTotal * frac; x.devMonthsLeft = m.devMonthsLeft; }
    if (m.devMonthsLeft <= 1e-9) {
      m.devMonthsLeft = 0;
      if (dependenciesReady(c, m)) completeModel(g, c, m);
      else news(g, 'company', `${m.name} waits for its architecture`, 'The vehicle work is complete, but the engine family or platform it uses is still in development.');
    }
  }

  // ---- research
  const ref = researchRef(g.year);
  const yNow = g.year + (g.month - 1) / 12;
  for (const a of TECH_AREAS) {
    const s = c.rdBudget[a];
    L.rd += s;
    if (s > 0) c.tech[a] += (1 / 12) * Math.sqrt(s / ref) * Math.max(0.15, 1 - 0.16 * (c.tech[a] - yNow + 2));
    if (c.tech[a] < yNow - 4) c.tech[a] = yNow - 4; // technology diffuses through suppliers and licensing
  }
  if (c.motorsport) { // technology transfer from the race programme
    const d = c.motorsport.championship.teams.find((t) => t.id === c.motorsport!.teamId)?.dev;
    if (d) { c.tech.aero += 0.012 * d.aero; c.tech.engine += 0.012 * d.engine; c.tech.chassis += 0.012 * d.chassis; }
  }

  // ---- overheads
  L.wages = c.engineers * engineerCost(c, g.year) + L.revenue * (c.restructuring ? 0.035 * (1 - RESTRUCTURE.overheadCut) : 0.035) + (c.factories.length ? 0.4e6 * cpi(g.year) : 0);
  if (c.restructuring) c.restructuring = Math.max(0, c.restructuring - 1);
  L.marketing = c.marketingBudget;
  const reachTotal = REGION_IDS.reduce((a, r) => a + c.reach[r], 0);
  L.other = reachTotal * 5 * cpi(g.year);
  L.motorsport = extra.msCost;
  L.revenue += extra.msIncome;
  c.interestRate = interestRate(g, c);
  L.interest = (c.debt * c.interestRate) / 12 - (c.cash > 0 ? (c.cash * Math.max(0, g.macro.interestBase - 0.02)) / 12 : 0);
  // cash paid or received inside this tick (between-tick postings already moved their cash)
  const tickCash = L.revenue - L.production - L.factoryFixed - L.wages - L.rd - L.marketing - L.dev - L.logistics - L.motorsport - L.interest - L.other;
  L.depreciation = depreciate(c);
  mergePending(c, L);
  const pre = L.revenue + L.otherIncome + L.assetGains
    - (L.cogs + L.factoryFixed + L.wages + L.rd + L.marketing + L.dev + L.logistics + L.motorsport + L.interest + L.other + L.oneOff + L.depreciation);
  c.ytdProfit += pre;
  L.tax = pre > 0 && c.ytdProfit > 0 ? Math.min(pre, c.ytdProfit) * 0.25 : 0;
  L.profit = pre - L.tax;
  c.cash += tickCash - L.tax;

  // ---- brand dynamics
  let wSum = 0, pre2 = 0, rel = 0, perf = 0;
  for (const m of c.models) {
    if (m.status !== 'production') continue;
    const w = Math.max(1, REGION_IDS.reduce((a, r) => a + m.lastSales[r], 0) * m.price);
    wSum += w; pre2 += w * m.stats.scores.prestige; rel += w * m.stats.scores.reliability; perf += w * m.stats.scores.performance;
  }
  if (wSum > 0) {
    // +8: familiarity of an established marque lifts its image above the bare product scores
    c.prestige += (clamp(pre2 / wSum + 8 + 0.4 * c.msGlow, 0, 100) - c.prestige) * 0.008;
    c.reliabilityRep += (rel / wSum - c.reliabilityRep) * 0.02;
    c.sportiness += (clamp(perf / wSum + c.msGlow, 0, 100) - c.sportiness) * 0.015;
  } else if (c.motorsport) {
    c.prestige += (clamp(40 + 1.5 * c.msGlow, 0, 100) - c.prestige) * 0.02;
    c.sportiness += (clamp(60 + 1.2 * c.msGlow, 0, 100) - c.sportiness) * 0.02;
  }
  c.msGlow *= 0.97;
  const intensity = (c.marketingBudget * 12) / (annualRevenue(c) + 50e6 * cpi(g.year));
  const awTarget = clamp(32 + 55 * (1 - Math.exp(-intensity / 0.03)) + c.prestige / 10 + 0.5 * c.msGlow, 0, 100);
  for (const r of REGION_IDS) c.awareness[r] += ((c.reach[r] > 0 ? awTarget : awTarget * 0.4) - c.awareness[r]) * 0.06;

  // ---- solvency: a cash shortfall is drawn on the credit line
  if (c.cash < 0) { L.financingCash += -c.cash; c.debt += -c.cash; c.cash = 0; }
  const limit = creditLimit(c, g.year);
  if (c.debt - c.cash > limit * 1.25) c.troubleMonths++; else c.troubleMonths = Math.max(0, c.troubleMonths - 1);
  closeMonth(c, L);
  c.ledger.push(L);
  if (c.ledger.length > 180) c.ledger.shift();
  return L;
}
