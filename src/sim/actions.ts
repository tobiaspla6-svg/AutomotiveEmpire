// Player actions. Each function validates, mutates the GameState and returns an error message
// (string) when the action is not possible, or null on success.
import type { Company, ComponentCategory, DevLevels, Discipline, EngineFamily, Factory, GameState, StageId, RaceCarSpec, RegionId, SegmentId, TechArea, Trim, TrimLevel, VehicleModel, VehicleSpec } from './types';
import { COUNTRY, REGION_IDS } from '../data/world';
import { hasTech, missingTechs, TECH_BY_ID } from '../data/tech';
import { creditLimit, refreshStats, engineerCost, factoryBuildCost, factoryValue, lineShareUsed, makeModel, news, RESTRUCTURE, restructuringSaving, toolingCost, uid, unitCost, valuation } from './company';
import { priceGuide } from './pricing';
import { CYL, defaultVehicle } from './engineering';
import { aggregateTrims, faceliftCost, FACELIFT_AFTER, makeTrim, refreshTrim, trimView } from './trims';
import { annualSupply } from './market';
import { fxNow } from './regional';
import { emptySupply, inHouseCost, quote, STAGE_WEIGHT, supplierCapacity } from './supply';
import { CATEGORY_NAME, IN_HOUSE, SUPPLIER_BY_ID } from '../data/suppliers';
import {
  adoptFamilies, defaultChoice, engineFits, enginesOf, findVariant, makeFamily, makePlatform, makeVariant, planDevelopment, platformFits, platformsOf, standaloneCost, variantShare, SHARE,
  type EngineChoice, type PlatformChoice,
} from './families';
import { computeVehicle } from './engineering';
import { cpi, kf } from './util';
import { player } from './world';
import { getRegs, disciplineAvailable } from './racing/regs';
import { budgetRef, createDivision, driverSalary, overall, playerTeam, teamRegs, teamScale } from './racing/season';
import { askingSalary, attractiveness, buyoutFee, raceDriver, rivalsFor } from './racing/drivers';
import { checkLegal, raceEngineSpec } from './racing/racecar';
import { borrow, clearStock, dispose, repay, spend, type SpendKind } from './accounts';

/** Pay from cash plus unused credit and record the payment in the books under `kind`. */
const finite = (...xs: number[]) => xs.every((x) => typeof x === 'number' && Number.isFinite(x));
const pay = (c: Company, g: GameState, amount: number, kind: SpendKind): string | null => spend(c, amount, kind, creditLimit(c, g.year) - c.debt);

export function validateSpec(s: VehicleSpec): string[] {
  const e: string[] = [];
  const ev = s.engine.layout === 'EV';
  if (!ev && s.enginePos !== 'front' && s.drive === 'FWD') e.push('A mid- or rear-mounted engine cannot drive only the front wheels.');
  if (!ev && s.engine.displacement / CYL[s.engine.layout] < 150) e.push('Cylinders are too small (under 150 cc each).');
  if (!ev && s.engine.displacement / CYL[s.engine.layout] > 1000) e.push('Cylinders are too large (over 1,000 cc each).');
  if (ev && s.engine.batteryKwh < 5) e.push('Battery capacity is too small.');
  return e;
}

/** Which engine family and platform a new vehicle uses; anything left out is developed new with the car. */
export interface DevChoice { engine?: EngineChoice; platform?: PlatformChoice }

/**
 * Approve a vehicle programme. It develops whatever it does not re-use: a new engine family, a new variant of an
 * existing family, a new platform (see families.ts). A successor (`basedOn`) re-uses its predecessor's engine family
 * and platform automatically when the new specification still fits them.
 */
export function startDevelopment(g: GameState, name: string, spec: VehicleSpec, segment: SegmentId, basedOn?: string, choice: DevChoice = {}): string | null {
  const c = player(g);
  c.engines ??= []; c.platforms ??= [];
  if (!name.trim()) return 'Give the model a name.';
  if (c.engineers < 5) return 'You need at least 5 engineers to run a vehicle programme.';
  const base = basedOn ? c.models.find((x) => x.id === basedOn) : undefined;
  const auto = defaultChoice(c, spec, base);
  const engine: EngineChoice = choice.engine ?? auto.engine;
  const platform: PlatformChoice = choice.platform ?? auto.platform;
  const plan = planDevelopment(g, c, spec, engine, platform);
  if (!plan.ok) return plan.errors[0];
  const miss = missingTechs(plan.spec, c.tech);
  if (miss.length) return `Technology not yet available: ${miss.map((id) => TECH_BY_ID[id].name).join(', ')}.`;
  const inv = validateSpec(plan.spec);
  if (inv.length) return inv[0];
  const cost = plan.total, months = plan.months;
  // the whole budget is charged month by month through the ledger (see runPlayerMonth); approval only
  // checks that the company can fund the first stretch of the programme
  const firstQuarter = (cost / months) * 3;
  if (firstQuarter > c.cash + Math.max(0, creditLimit(c, g.year) - c.debt)) return `Not enough funds: the first three months of this programme cost $${(firstQuarter / 1e6).toFixed(1)}M.`;
  const m = makeModel(g, name.trim(), JSON.parse(JSON.stringify(plan.spec)), segment, c.tech, g.year);
  m.status = 'development'; m.devCostTotal = cost; m.devMonthsTotal = months; m.devMonthsLeft = months; m.devCostPaid = 0;
  if (base) m.generation = base.generation + 1;
  // engine: a new family, a new variant of an existing one, or an existing variant
  const bundled = { status: 'development' as const, ownerModelId: m.id, devMonthsLeft: months, devMonthsTotal: months, devCostPaid: 0 };
  if (plan.engine.kind === 'new') {
    const f = makeFamily(g, choice.engine?.kind === 'new' && choice.engine.name ? choice.engine.name : `${m.name} ${plan.spec.engine.layout === 'EV' ? 'drive unit' : plan.spec.engine.layout}`, plan.spec.engine, c.tech.engine, g.year);
    Object.assign(f, bundled, { devCostTotal: plan.engine.cost });
    f.variants[0].status = 'development'; f.variants[0].ownerModelId = m.id;
    c.engines.push(f); m.engineFamilyId = f.id; m.engineVariantId = f.variants[0].id;
  } else {
    const f = plan.engine.family!;
    let v = plan.engine.variant;
    if (!v) { v = makeVariant(g, f, plan.spec.engine, plan.engine.cost, plan.engine.months); v.ownerModelId = m.id; f.variants.push(v); }
    m.engineFamilyId = f.id; m.engineVariantId = v.id;
  }
  if (plan.platform.kind === 'new') {
    const pl = makePlatform(g, choice.platform?.kind === 'new' && choice.platform.name ? choice.platform.name : `${m.name} platform`, plan.spec, c.tech.chassis, g.year);
    Object.assign(pl, bundled, { devCostTotal: plan.platform.cost });
    c.platforms.push(pl); m.platformId = pl.id;
  } else m.platformId = plan.platform.platform!.id;
  // a new generation inherits its predecessor's trim line-up (not its stock or sales)
  if (base?.trims?.length) {
    m.trims = base.trims.map((t) => ({
      ...JSON.parse(JSON.stringify(t)), id: `t${g.nextId++}`, inventory: 0, inventoryValue: 0, built: 0, lastDemand: 0, lastUnitCost: 0, salesHistory: [], revenue: 0, cogs: 0,
      lastSales: { NA: 0, EU: 0, JP: 0, CN: 0, LATAM: 0, ROW: 0 }, engineVariantId: base.engineFamilyId === m.engineFamilyId ? t.engineVariantId : m.engineVariantId,
    }));
    for (const t of m.trims) refreshTrim(g, c, m, t);
  }
  c.models.push(m);
  const reused = [plan.engine.kind !== 'new' ? `the ${plan.engine.family!.name} engine family` : '', plan.platform.kind === 'existing' ? `the ${plan.platform.platform!.name}` : ''].filter(Boolean);
  news(g, 'company', `Programme approved: ${m.name}`, `Budget $${(cost / 1e6).toFixed(1)}M over about ${months} months${base ? ` (successor to the ${base.name})` : ''}${reused.length ? `, re-using ${reused.join(' and ')}` : ''}.${plan.waitsFor.length ? ` It cannot be signed off before ${plan.waitsFor.join(' and ')} is ready.` : ''}`);
  return null;
}
// ---- trims and facelifts
/**
 * Add a trim to a model. The first trim added to a model sold as one version also creates a "Standard" trim that
 * keeps the model's current specification, price and stock, so nothing on sale changes.
 */
export function addTrim(g: GameState, modelId: string, level: TrimLevel, price?: number): string | null {
  const c = player(g);
  const m = c.models.find((x) => x.id === modelId);
  if (!m) return 'Unknown model.';
  if (m.status === 'retired' || m.status === 'design') return 'Trims can be added to cars in development or on sale.';
  m.trims ??= [];
  if (m.trims.length >= 7) return 'A model can have at most seven trims.';
  if (!m.trims.length) {
    const std = makeTrim(g, c, m, 'mid', m.price, { name: 'Standard', engineVariantId: m.engineVariantId, interior: m.spec.interior, wheelDia: m.spec.wheelDia, tireCompound: m.spec.tireCompound, equipment: m.spec.equipment ?? 0, sport: m.spec.sport, tireWidth: m.spec.tireWidth, mix: 1 });
    std.inventory = m.inventory; std.inventoryValue = m.inventoryValue; std.lastSales = { ...m.lastSales }; std.lastDemand = m.lastDemand; std.lastUnitCost = m.lastUnitCost;
    m.trims.push(std);
  }
  const t = makeTrim(g, c, m, level, 0);
  if (m.trims.some((x) => x.name === t.name)) t.name = `${t.name} ${m.trims.length + 1}`;
  t.price = price && finite(price) && price > 0 ? Math.round(price) : Math.round(priceGuide(g, c, trimView(m, t), Math.max(5, (annualSupply(c, m) / 12) * t.mix)).recommended / 10) * 10;
  m.trims.push(t);
  aggregateTrims(m);
  return null;
}
export interface TrimPatch { name?: string; price?: number; mix?: number; cap?: number | null; engineVariantId?: string; gearbox?: Trim['gearbox']; interior?: Trim['interior']; wheelDia?: number; tireCompound?: Trim['tireCompound']; equipment?: number }
export function updateTrim(g: GameState, modelId: string, trimId: string, patch: TrimPatch): string | null {
  const c = player(g);
  const m = c.models.find((x) => x.id === modelId); const t = m?.trims?.find((x) => x.id === trimId);
  if (!m || !t) return 'Unknown trim.';
  if (patch.price !== undefined && (!finite(patch.price) || patch.price < 1)) return 'Enter a price above zero.';
  if (patch.mix !== undefined && (!finite(patch.mix) || patch.mix < 0)) return 'The production share cannot be negative.';
  if (patch.equipment !== undefined && !finite(patch.equipment)) return 'Invalid equipment level.';
  if (patch.cap !== undefined && patch.cap !== null && (!finite(patch.cap) || patch.cap < t.built)) return `A limited edition cannot be capped below the ${Math.ceil(t.built)} cars already built.`;
  if (patch.engineVariantId) {
    const f = enginesOf(c).find((x) => x.id === m.engineFamilyId);
    const v = f?.variants.find((x) => x.id === patch.engineVariantId);
    if (!v) return 'That engine is not a variant of this car\'s engine family.';
    if (v.status !== 'ready') return 'That variant is still being calibrated.';
  }
  const { cap, ...rest } = patch;
  Object.assign(t, rest);
  if (cap !== undefined) t.cap = cap === null ? undefined : Math.round(cap);
  if (patch.price !== undefined) t.price = Math.round(patch.price);
  refreshTrim(g, c, m, t);
  aggregateTrims(m);
  return null;
}
export function removeTrim(g: GameState, modelId: string, trimId: string): string | null {
  const c = player(g);
  const m = c.models.find((x) => x.id === modelId); const t = m?.trims?.find((x) => x.id === trimId);
  if (!m || !t) return 'Unknown trim.';
  if (t.inventory > 0.5) return 'Sell its stock first: set its production share to zero until the dealers have cleared it.';
  m.trims = m.trims!.filter((x) => x !== t);
  if (m.trims.length === 1 && m.trims[0].inventory <= 0.5) { // back to a single version
    const last = m.trims[0];
    m.spec = last.spec; m.price = last.price; m.trims = [];
    refreshStats(g, m, c);
  }
  aggregateTrims(m);
  return null;
}
/**
 * Set a model's price in one region (in dollars at today's exchange rate; it is then fixed in local currency, so its
 * dollar value moves with the currency). null returns the region to the world price. Trims move in proportion.
 */
export function setRegionalPrice(g: GameState, modelId: string, region: RegionId, usd: number | null): string | null {
  const m = player(g).models.find((x) => x.id === modelId);
  if (!m) return 'Unknown model.';
  if (!REGION_IDS.includes(region)) return 'Unknown region.';
  if (usd === null) { if (m.regional) delete m.regional[region]; return null; }
  if (!finite(usd) || usd < 1) return 'Enter a price above zero.';
  if (!(m.price > 0)) return 'Set the world price first.';
  m.regional ??= {};
  m.regional[region] = { ratio: usd / m.price, fx: fxNow(g, region) };
  return null;
}
/** Exclusivity strategy: build at most `cap` cars of this model a year (null removes the cap). Demand above it waits in the order book. */
export function setAnnualCap(g: GameState, modelId: string, cap: number | null): string | null {
  const m = player(g).models.find((x) => x.id === modelId);
  if (!m) return 'Unknown model.';
  if (cap === null) { m.annualCap = undefined; return null; }
  if (!finite(cap) || cap < 1) return 'Choose at least one car a year.';
  m.annualCap = Math.round(cap);
  return null;
}
/** Allocation policy and personalisation take-up for a model's or a trim's order book. */
export function setOrderPolicy(g: GameState, modelId: string, trimId: string | null, o: { allocation?: 'loyal' | 'open'; personal?: number }): string | null {
  const m = player(g).models.find((x) => x.id === modelId);
  if (!m) return 'Unknown model.';
  const t = trimId ? m.trims?.find((x) => x.id === trimId) : undefined;
  if (trimId && !t) return 'Unknown trim.';
  if (o.personal !== undefined && (!finite(o.personal) || o.personal < 0 || o.personal > 1)) return 'Personalisation take-up is between 0 and 100 %.';
  const target = t ?? m;
  if (o.allocation) target.allocation = o.allocation;
  if (o.personal !== undefined) target.personal = o.personal;
  return null;
}
/** A mid-life facelift: about a quarter of the car's own engineering budget over eight months; the car keeps selling. */
export function startFacelift(g: GameState, modelId: string): string | null {
  const c = player(g);
  const m = c.models.find((x) => x.id === modelId);
  if (!m || m.status !== 'production') return 'Only a car on sale can be facelifted.';
  if (m.facelift) return 'A facelift is already under way.';
  if (g.year - m.launchYear < FACELIFT_AFTER) return `A facelift makes sense after ${FACELIFT_AFTER} years on sale (this car: ${g.year - m.launchYear}).`;
  const { cost, months } = faceliftCost(m);
  if ((cost / months) * 3 > c.cash + Math.max(0, creditLimit(c, g.year) - c.debt)) return `Not enough funds: the first three months cost $${((cost / months) * 3 / 1e6).toFixed(1)}M.`;
  m.facelift = { monthsLeft: months, months, cost, paid: 0 };
  news(g, 'company', `Facelift approved: ${m.name}`, `$${(cost / 1e6).toFixed(1)}M over ${months} months.`);
  return null;
}

export function cancelDevelopment(g: GameState, modelId: string) {
  const c = player(g);
  const m = c.models.find((x) => x.id === modelId && x.status === 'development');
  if (!m) return;
  c.models = c.models.filter((x) => x !== m);
  // Architecture developed with this car: if another car in development uses it, that programme takes it over
  // together with its unpaid cost; otherwise it is dropped with the car.
  const heir = (has: (x: VehicleModel) => boolean) => c.models.find((x) => x.status === 'development' && has(x));
  for (const x of [...enginesOf(c), ...platformsOf(c)]) {
    if (x.ownerModelId !== m.id) continue;
    const h = heir((y) => y.engineFamilyId === x.id || y.platformId === x.id);
    if (h) {
      const left = Math.max(0, x.devCostTotal - x.devCostPaid);
      h.devCostTotal += left; x.ownerModelId = h.id;
      h.devMonthsLeft = Math.max(h.devMonthsLeft, x.devMonthsLeft); h.devMonthsTotal = Math.max(h.devMonthsTotal, h.devMonthsLeft);
      x.devCostTotal = x.devCostPaid + left; // the heir pays the rest
    }
  }
  for (const f of enginesOf(c)) for (const v of f.variants) if (v.ownerModelId === m.id) { const h = heir((y) => y.engineVariantId === v.id); if (h) v.ownerModelId = h.id; }
  if (c.engines) { c.engines = c.engines.filter((f) => f.ownerModelId !== m.id); for (const f of c.engines) f.variants = f.variants.filter((v) => v.ownerModelId !== m.id); }
  if (c.platforms) c.platforms = c.platforms.filter((p) => p.ownerModelId !== m.id);
  // money already spent stays in the books as development expense (sunk cost)
  news(g, 'company', `Programme cancelled: ${m.name}`, `$${(m.devCostPaid / 1e6).toFixed(1)}M of the $${(m.devCostTotal / 1e6).toFixed(1)}M budget had been spent and is written off.`);
}

// ---- stand-alone architecture programmes
/** Develop an engine family on its own, from a reference engine; any vehicle can use it once it is ready. */
export function startEngineFamily(g: GameState, name: string, engine: VehicleSpec['engine']): string | null {
  const c = player(g);
  c.engines ??= [];
  if (!name.trim()) return 'Give the engine family a name.';
  const ref = { ...defaultVehicle(g.year, 'sedan'), engine: JSON.parse(JSON.stringify(engine)) };
  const miss = missingTechs(ref, c.tech).filter((id) => ['dohc4', 'di', 'mfi', 'efi', 'turbo', 'twinturbo', 'vvt', 'hybrid', 'ev'].includes(id));
  if (miss.length) return `Technology not yet available: ${miss.map((id) => TECH_BY_ID[id].name).join(', ')}.`;
  const inv = validateSpec(ref); if (inv.length) return inv[0];
  if (c.engineers < 5) return 'You need at least 5 engineers to run an engineering programme.';
  const { cost, months } = standaloneCost(g, ref, 'engine', c.tech);
  if ((cost / months) * 3 > c.cash + Math.max(0, creditLimit(c, g.year) - c.debt)) return `Not enough funds: the first three months cost $${((cost / months) * 3 / 1e6).toFixed(1)}M.`;
  const f = makeFamily(g, name.trim(), ref.engine, c.tech.engine, g.year);
  Object.assign(f, { status: 'development', devCostTotal: cost, devMonthsTotal: months, devMonthsLeft: months, devCostPaid: 0 });
  f.variants[0].status = 'ready';
  c.engines.push(f);
  news(g, 'company', `Engine programme approved: ${f.name}`, `$${(cost / 1e6).toFixed(1)}M over about ${months} months. Any vehicle can use the family once it is signed off.`);
  return null;
}
/** Calibrate a new variant (displacement, aspiration, tune, hybrid) on an existing engine family. Paid up front. */
export function addEngineVariant(g: GameState, familyId: string, engine: VehicleSpec['engine']): string | null {
  const c = player(g);
  const f = enginesOf(c).find((x) => x.id === familyId);
  if (!f) return 'Unknown engine family.';
  const e = { ...JSON.parse(JSON.stringify(engine)), layout: f.layout, valvetrain: f.valvetrain, fuelSystem: f.fuelSystem, aluBlock: f.aluBlock, boreStroke: f.boreStroke };
  const why = engineFits(f, e); if (why.length) return why[0];
  if (findVariant(f, e)) return 'This variant already exists.';
  const ref = { ...defaultVehicle(g.year, 'sedan'), engine: e };
  const miss = missingTechs(ref, c.tech).filter((id) => ['turbo', 'twinturbo', 'vvt', 'hybrid'].includes(id));
  if (miss.length) return `Technology not yet available: ${miss.map((id) => TECH_BY_ID[id].name).join(', ')}.`;
  const st = computeVehicle(ref, { year: g.year, tech: c.tech });
  const k = variantShare(f, e);
  const cost = st.devCost * SHARE.engine * k, months = Math.round(3 + 20 * k);
  const err = pay(c, g, cost, 'dev'); if (err) return err;
  const v = makeVariant(g, f, e, cost, months);
  f.variants.push(v);
  news(g, 'company', `New variant for ${f.name}: ${v.name}`, `$${(cost / 1e6).toFixed(1)}M of calibration and durability testing, ready in about ${months} months.`);
  return null;
}
/** Develop a platform on its own, from a reference vehicle; compatible vehicles can share it once it is ready. */
export function startPlatform(g: GameState, name: string, ref: VehicleSpec): string | null {
  const c = player(g);
  c.platforms ??= [];
  if (!name.trim()) return 'Give the platform a name.';
  const miss = missingTechs(ref, c.tech).filter((id) => ['aluminium', 'carbon', 'safety1', 'safety2', 'safety3', 'multilink', 'awd'].includes(id));
  if (miss.length) return `Technology not yet available: ${miss.map((id) => TECH_BY_ID[id].name).join(', ')}.`;
  if (c.engineers < 5) return 'You need at least 5 engineers to run an engineering programme.';
  const { cost, months } = standaloneCost(g, ref, 'platform', c.tech);
  if ((cost / months) * 3 > c.cash + Math.max(0, creditLimit(c, g.year) - c.debt)) return `Not enough funds: the first three months cost $${((cost / months) * 3 / 1e6).toFixed(1)}M.`;
  const p = makePlatform(g, name.trim(), ref, c.tech.chassis, g.year);
  Object.assign(p, { status: 'development', devCostTotal: cost, devMonthsTotal: months, devMonthsLeft: months, devCostPaid: 0 });
  c.platforms.push(p);
  news(g, 'company', `Platform programme approved: ${p.name}`, `$${(cost / 1e6).toFixed(1)}M over about ${months} months.`);
  return null;
}
/** Stop a stand-alone engine-family or platform programme that no vehicle depends on. */
export function cancelArchitecture(g: GameState, id: string): string | null {
  const c = player(g);
  const f = enginesOf(c).find((x) => x.id === id), p = platformsOf(c).find((x) => x.id === id);
  const x = f ?? p;
  if (!x) return 'Unknown programme.';
  if (x.status !== 'development' || x.ownerModelId) return 'Only a stand-alone programme still in development can be cancelled.';
  if (c.models.some((m) => m.engineFamilyId === id || m.platformId === id)) return 'Vehicles in development depend on it.';
  if (f) c.engines = enginesOf(c).filter((y) => y !== f); else c.platforms = platformsOf(c).filter((y) => y !== p);
  news(g, 'company', `Programme cancelled: ${x.name}`, `$${(x.devCostPaid / 1e6).toFixed(1)}M had been spent and is written off.`);
  return null;
}
export function setPrice(g: GameState, modelId: string, price: number): string | null {
  const m = player(g).models.find((x) => x.id === modelId);
  if (!m) return 'Unknown model.';
  if (!finite(price) || price < 1) return 'Enter a price above zero.';
  if (m.trims?.length) { // a model sold in trims: every trim moves by the same proportion
    const k = price / (m.price || price);
    for (const t of m.trims) t.price = Math.max(1, Math.round(t.price * k));
    aggregateTrims(m);
    return null;
  }
  m.price = Math.round(price);
  return null;
}

export function addLine(g: GameState, factoryId: string, modelId: string, units: number): string | null {
  const c = player(g);
  const f = c.factories.find((x) => x.id === factoryId), m = c.models.find((x) => x.id === modelId);
  if (!f || !m) return 'Unknown factory or model.';
  if (m.status !== 'ready' && m.status !== 'production') return 'The model has not finished development.';
  if (f.capacity <= 0) return 'The factory is still under construction.';
  const free = f.capacity * (1 - lineShareUsed(f));
  if (!finite(units) || units <= 0) return 'Choose a line capacity.';
  if (units > free + 0.5) return `Only ${Math.floor(free)} units / month of free capacity in this plant.`;
  const tooling = toolingCost(m, units, { c, f });
  const err = pay(c, g, tooling, 'capex');
  if (err) return err;
  f.bookValue += tooling; // tooling is capitalised on the plant
  const ex = f.lines.find((l) => l.modelId === modelId);
  if (ex) { const oldU = ex.share * f.capacity; ex.share = (oldU + units) / f.capacity; ex.ramp = (ex.ramp * oldU + 0.3 * units) / (oldU + units); }
  else f.lines.push({ modelId, share: units / f.capacity, ramp: 0.3, target: -1 });
  if (!m.price) { // opening price: the recommended retail price at this line's volume (the player can change it at any time)
    m.price = Math.max(10, Math.round(priceGuide(g, c, m, units).recommended / 10) * 10);
  }
  return null;
}
export function removeLine(g: GameState, factoryId: string, modelId: string) {
  const f = player(g).factories.find((x) => x.id === factoryId);
  if (f) f.lines = f.lines.filter((l) => l.modelId !== modelId);
}
export function setLineTarget(g: GameState, factoryId: string, modelId: string, target: number) {
  const l = player(g).factories.find((x) => x.id === factoryId)?.lines.find((x) => x.modelId === modelId);
  if (l && finite(target)) l.target = target;
}
/** Share of the net list price that fleet buyers pay for a retired model's remaining stock. */
export const FLEET_CLEARANCE = 0.6;
export function retireModel(g: GameState, modelId: string) {
  const c = player(g);
  const m = c.models.find((x) => x.id === modelId); if (!m) return;
  m.status = 'retired';
  for (const f of c.factories) f.lines = f.lines.filter((l) => l.modelId !== modelId);
  let stock = '';
  if (m.inventory > 0) { // remaining stock goes to fleet buyers at a discount instead of sitting unsold forever
    const units = m.inventory, proceeds = (m.trims?.length ? m.trims.reduce((a, t) => a + t.inventory * t.price, 0) : units * m.price) * 0.88 * FLEET_CLEARANCE;
    clearStock(c, m, proceeds);
    stock = ` The remaining ${Math.round(units).toLocaleString()} cars in stock were sold to fleet buyers for $${(proceeds / 1e6).toFixed(1)}M.`;
  }
  news(g, 'company', `${m.name} leaves production`, `${Math.round(m.cumulativeUnits).toLocaleString()} built.${stock}`);
}

export const maxAutomation = (c: Company) => (hasTech(c.tech, 'auto80') ? 0.9 : hasTech(c.tech, 'auto60') ? 0.8 : hasTech(c.tech, 'auto30') ? 0.6 : 0.3);
export function buildFactory(g: GameState, name: string, country: string, capacity: number, automation: number): string | null {
  const c = player(g);
  if (!COUNTRY[country]) return 'Choose a country.';
  if (!finite(capacity, automation) || automation < 0) return 'Enter a capacity and an automation level.';
  if (capacity < 20) return 'Minimum capacity is 20 units per month.';
  if (automation > maxAutomation(c) + 1e-6) return `Your manufacturing technology allows at most ${Math.round(maxAutomation(c) * 100)}% automation.`;
  const cost = factoryBuildCost(capacity, automation, g.year);
  const err = pay(c, g, cost, 'capex');
  if (err) return err;
  c.factories.push({ id: uid(g, 'f'), name: name.trim() || `${COUNTRY[country].name} plant`, country, region: COUNTRY[country].region, capacity: 0, automation, lines: [], expansion: { add: capacity, monthsLeft: 15 }, builtYear: g.year, historical: false, disruption: 0, bookValue: cost });
  news(g, 'company', `Ground broken for a new plant in ${COUNTRY[country].name}`, `Capacity ${capacity.toLocaleString()} units per month; production can start in 15 months.`);
  return null;
}
export function expandFactory(g: GameState, factoryId: string, add: number): string | null {
  const c = player(g); const f = c.factories.find((x) => x.id === factoryId);
  if (!f) return 'Unknown factory.';
  if (f.expansion) return 'An expansion is already under way.';
  if (!finite(add) || add < 10) return 'Expansion too small.';
  const cost = factoryBuildCost(add, f.automation, g.year) * 0.85;
  const err = pay(c, g, cost, 'capex');
  if (err) return err;
  f.bookValue += cost;
  f.expansion = { add, monthsLeft: 9 };
  return null;
}
export function upgradeAutomation(g: GameState, factoryId: string, to: number): string | null {
  const c = player(g); const f = c.factories.find((x) => x.id === factoryId);
  if (!f) return 'Unknown factory.';
  if (!finite(to)) return 'Choose an automation level.';
  if (to <= f.automation) return 'Already at that level.';
  if (to > maxAutomation(c) + 1e-6) return `Manufacturing technology allows at most ${Math.round(maxAutomation(c) * 100)}% automation.`;
  const cost = automationCost(f.capacity, f.automation, to, g.year);
  const err = pay(c, g, cost, 'capex');
  if (err) return err;
  f.bookValue += cost;
  f.automation = to; f.disruption = Math.max(f.disruption, 1);
  return null;
}
export const automationCost = (capacity: number, from: number, to: number, year: number) => (factoryBuildCost(capacity, to, year) - factoryBuildCost(capacity, from, year)) * 1.3;
export function sellFactory(g: GameState, factoryId: string): string | null {
  const c = player(g); const f = c.factories.find((x) => x.id === factoryId);
  if (!f) return 'Unknown factory.';
  dispose(c, factoryValue(f, g.year) * 0.6, f.bookValue); // gain or loss against book value goes to the P&L
  c.factories = c.factories.filter((x) => x.id !== factoryId);
  news(g, 'company', `${f.name} sold`, 'The plant and its land are sold to an industrial investor.');
  return null;
}

export function setRd(g: GameState, area: TechArea, amount: number) { if (finite(amount)) player(g).rdBudget[area] = Math.max(0, amount); }
export function setMarketing(g: GameState, amount: number) { if (finite(amount)) player(g).marketingBudget = Math.max(0, amount); }
export function setEngineers(g: GameState, n: number): string | null {
  const c = player(g);
  if (!finite(n)) return 'Enter a number of engineers.';
  n = Math.max(0, Math.round(n));
  const d = n - c.engineers; if (!d) return null;
  const err = pay(c, g, Math.abs(d) * engineerCost(c, g.year) * (d > 0 ? 2 : 3), 'oneOff'); // recruitment or severance
  if (err) return err;
  c.engineers = n;
  return null;
}
/** Start a three-year restructuring programme (see RESTRUCTURE in company.ts). */
export function startRestructuring(g: GameState): string | null {
  const c = player(g);
  if (c.restructuring) return 'A restructuring programme is already under way.';
  const saving = restructuringSaving(g, c);
  if (!(saving > 0)) return 'There is nothing to restructure yet.';
  const err = pay(c, g, saving * RESTRUCTURE.upfrontYears, 'oneOff');
  if (err) return err;
  c.restructuring = RESTRUCTURE.months;
  c.reliabilityRep = Math.max(0, c.reliabilityRep - RESTRUCTURE.reputation);
  news(g, 'company', `${c.name} announces a restructuring programme`, `Severance and consultants cost about $${((saving * RESTRUCTURE.upfrontYears) / 1e6).toFixed(1)}M now; overheads should fall by about $${(saving / 1e6).toFixed(1)}M a year for three years (estimate).`);
  return null;
}
// ---- supply chain
/**
 * Sign (or replace) the supply contract for a component category: `commitment` car sets a month for `years` years,
 * optionally with a second source taking `secondShare` of the volume.
 */
export function signContract(g: GameState, cat: ComponentCategory, supplierId: string, commitment: number, years: number, secondId?: string, secondShare = 0.3): string | null {
  const c = player(g);
  const d = SUPPLIER_BY_ID[supplierId];
  if (!d || d.category !== cat || d.from > g.year || (d.to !== undefined && d.to < g.year)) return 'That supplier does not offer this component now.';
  if (!finite(commitment, years) || commitment < 1 || years < 1) return 'Choose a monthly volume and a term.';
  if (commitment > supplierCapacity(d, g.year) + 0.5) return `${d.name} can commit at most ${Math.floor(supplierCapacity(d, g.year)).toLocaleString()} sets a month.`;
  let price = quote(c, d, commitment * (secondId ? 1 - secondShare : 1), years, g.year);
  if (secondId) {
    const b = SUPPLIER_BY_ID[secondId];
    if (!b || b.category !== cat || b.id === d.id || b.from > g.year) return 'Choose a different second source for the same component.';
    if (!finite(secondShare) || secondShare <= 0 || secondShare >= 1) return 'The second source takes between 0 and 100 % of the volume.';
    // dual sourcing splits the volume, so each supplier gives a smaller volume discount
    price = price * (1 - secondShare) + quote(c, b, commitment * secondShare, years, g.year) * secondShare;
  }
  c.supply ??= emptySupply();
  c.supply.contracts[cat] = { supplierId, secondId, secondShare: secondId ? secondShare : undefined, commitment: Math.round(commitment), priceIndex: price, until: g.year + Math.round(years) - 1 };
  news(g, 'company', `New ${CATEGORY_NAME[cat].toLowerCase()} contract`, `${d.name}${secondId ? ` and ${SUPPLIER_BY_ID[secondId].name}` : ''}: ${Math.round(commitment).toLocaleString()} sets a month until ${g.year + Math.round(years) - 1} at ${(price * 100).toFixed(1)}% of the market price.`);
  return null;
}
/** End a contract early: a break fee of three months of the committed volume's supplier margin. */
export function endContract(g: GameState, cat: ComponentCategory): string | null {
  const c = player(g);
  const k = c.supply?.contracts[cat];
  if (!k) return 'No contract for this component.';
  const value = c.models.filter((m) => m.status === 'production').reduce((a, m) => a + m.stats.partsCost, 0) / Math.max(1, c.models.filter((m) => m.status === 'production').length);
  const fee = k.commitment * 3 * value * 0.02;
  const err = pay(c, g, fee, 'oneOff'); if (err) return err;
  delete c.supply!.contracts[cat];
  news(g, 'company', `${CATEGORY_NAME[cat]} contract ended`, `Break fee $${(fee / 1e6).toFixed(1)}M. Parts are bought at market terms from now on.`);
  return null;
}
/** Build an in-house component plant (vertical integration). */
export function buildInHouse(g: GameState, cat: ComponentCategory, capacity: number): string | null {
  const c = player(g);
  if (!(cat in IN_HOUSE)) return 'This component is not made in-house in this game.';
  if (!finite(capacity) || capacity < 50) return 'Choose a capacity of at least 50 sets a month.';
  if (cat === 'batteries' && !hasTech(c.tech, 'ev')) return 'Battery cell production needs electric-vehicle technology.';
  if (!c.factories.length) return 'You need a car plant first.';
  const cost = inHouseCost(cat, capacity, g.year);
  const err = pay(c, g, cost, 'capex'); if (err) return err;
  c.books.otherAssets += cost; // capitalised; depreciates with the other non-plant assets
  c.supply ??= emptySupply();
  const prev = c.supply.inHouse[cat];
  c.supply.inHouse[cat] = { capacity: (prev?.capacity ?? 0) + Math.round(capacity), capex: (prev?.capex ?? 0) + cost };
  news(g, 'company', `In-house ${CATEGORY_NAME[cat].toLowerCase()}`, `$${(cost / 1e6).toFixed(1)}M for ${Math.round(capacity).toLocaleString()} sets a month: no supplier margin on that volume, but running costs of about $${((cost * 0.012) / 1e6).toFixed(2)}M a month.`);
  return null;
}
/** Months of components to hold as safety stock (0–2). */
export function setSafetyStock(g: GameState, months: number): string | null {
  if (!finite(months) || months < 0 || months > 2) return 'Choose between 0 and 2 months.';
  const c = player(g);
  c.supply ??= emptySupply();
  c.supply.safetyStock = months;
  c.supply.buffer = Math.min(c.supply.buffer, months);
  return null;
}
/** Expand one production stage of a plant (relieve a bottleneck) — six months of work. */
export function expandStage(g: GameState, factoryId: string, stage: StageId, add: number): string | null {
  const c = player(g);
  const f = c.factories.find((x) => x.id === factoryId);
  if (!f) return 'Unknown factory.';
  if (f.stageWork) return 'A stage expansion is already under way at this plant.';
  if (!finite(add) || add <= 0) return 'Choose the extra capacity.';
  const cost = stageCost(f, stage, add, g.year);
  const err = pay(c, g, cost, 'capex'); if (err) return err;
  f.bookValue += cost;
  f.stageWork = { stage, add: Math.round(add), monthsLeft: 6 };
  return null;
}
export const stageCost = (f: Factory, stage: StageId, add: number, year: number) => factoryBuildCost(add, f.automation, year) * STAGE_WEIGHT[stage] * 1.15;
/** How thoroughly a plant inspects its cars (0–1): more labour per car, fewer defects reaching customers. */
export function setInspection(g: GameState, factoryId: string, level: number): string | null {
  const f = player(g).factories.find((x) => x.id === factoryId);
  if (!f) return 'Unknown factory.';
  if (!finite(level) || level < 0 || level > 1) return 'Choose a level between 0 and 1.';
  f.inspection = level;
  return null;
}

export const dealerCostPerUnit = (g: GameState, c: Company, r: RegionId) => 1500 * cpi(g.year) * (r === c.homeRegion ? 1 : 1.35);
export function investDealers(g: GameState, region: RegionId, amount: number): string | null {
  const c = player(g);
  if (!finite(amount) || amount <= 0) return 'Enter an amount.';
  const setup = c.reach[region] <= 0 ? 5e6 * cpi(g.year) : 0;
  if (amount <= setup) return `Entering a new region costs at least $${(setup / 1e6).toFixed(1)}M for an importer and parts depot.`;
  const err = pay(c, g, amount, 'capex');
  if (err) return err;
  c.books.otherAssets += amount; // dealer network and importer set-up are long-lived assets
  const add = (amount - setup) / dealerCostPerUnit(g, c, region);
  c.reach[region] += add;
  if (setup) news(g, 'company', `${c.name} enters a new market`, `A sales company and the first dealers open; distribution capacity ${Math.round(add).toLocaleString()} cars a year.`);
  return null;
}
export function takeLoan(g: GameState, amount: number): string | null {
  const c = player(g);
  if (!finite(amount) || amount <= 0) return 'Enter an amount to borrow.';
  const room = creditLimit(c, g.year) - c.debt;
  if (amount > room) return `Lenders will extend at most $${(Math.max(0, room) / 1e6).toFixed(1)}M more.`;
  borrow(c, amount); return null;
}
export function repayLoan(g: GameState, amount: number): string | null {
  const c = player(g);
  if (!finite(amount) || amount <= 0) return 'Enter an amount to repay.';
  const a = Math.min(amount, c.debt, c.cash);
  if (a <= 0) return 'Nothing to repay.';
  repay(c, a); return null;
}

export const acquisitionPrice = (c: Company, year: number) => valuation(c, year) * 1.3;
export function acquire(g: GameState, companyId: string): string | null {
  const p = player(g); const t = g.companies.find((x) => x.id === companyId);
  if (!t || !t.alive || t.isPlayer) return 'Not available.';
  if (g.mode === 'motorsport') return 'A racing team cannot acquire a manufacturer.';
  const price = acquisitionPrice(t, g.year);
  const err = pay(p, g, price, 'capex');
  if (err) return err;
  // purchase accounting: take over cash and debt, carry the plants at fair value, the rest is goodwill
  p.cash += t.cash; p.books.pending.acquiredCash += t.cash;
  p.debt += t.debt; // assumed debt is a non-cash liability, not a financing cash flow
  let plants = 0;
  for (const f of t.factories) { f.name = `${t.name} — ${f.name}`; f.historical = false; f.bookValue = factoryValue(f, g.year); plants += f.bookValue; p.factories.push(f); }
  const goodwill = price - t.cash + t.debt - plants;
  if (goodwill >= 0) p.books.otherAssets += goodwill; else p.books.pending.assetGain += -goodwill; // bargain purchase
  for (const m of t.models) { if (m.status !== 'production') continue; m.name = `${t.name} ${m.name}`; m.endYear = undefined; m.inventory = 0; m.inventoryValue = 0; p.models.push(m); }
  adoptFamilies(g, p); // the acquired cars join (or found) shared engine families and platforms
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
  const err = pay(c, g, B * 0.5, 'motorsport');
  if (err) return err;
  c.motorsport = createDivision(g, c, { discipline, teamName: teamName.trim() || `${c.name} Racing`, color: c.color, color2: c.color2, facilities: 2, staff: 58, ownerGrant: 0, sponsorLevel: 0.3, target: 6, scale: 0.7 }, g.rng);
  news(g, 'motorsport', `${c.name} goes racing`, `A motorsport division is founded to contest the ${c.motorsport.championship.name}. Results will shape the brand; its costs appear in the parent company's accounts, and its technology feeds back into road-car research.`);
  return null;
}
export function closeMotorsport(g: GameState) {
  const c = player(g); if (!c.motorsport || g.mode === 'motorsport') return;
  news(g, 'motorsport', `${c.motorsport.teamName} withdraws from racing`, 'The programme is wound up.');
  c.motorsport = null; c.msGlow *= 0.5;
}

// ---- motorsport management
/** What signing this driver would take: asking salary, transfer fee, and whether stronger teams are interested. */
export function driverTerms(g: GameState, driverId: string) {
  const c = player(g); const div = c.motorsport!;
  const ch = div.championship, team = playerTeam(div), regs = teamRegs(team, ch.year);
  const d = ch.drivers.find((x) => x.id === driverId) ?? div.academy?.juniors.find((x) => x.id === driverId);
  if (!d) return null;
  const attr = attractiveness(ch, team, teamScale(div));
  const rivals = rivalsFor(ch, d, team, attr);
  // a driver still adapting from another category is paid for what they deliver this season
  const ask = askingSalary(d, driverSalary(raceDriver(d, ch.discipline), regs, ch.year), attr, rivals);
  const fee = d.teamId && d.teamId !== team.id ? buyoutFee(d, ch.year) : 0;
  return { ask, fee, rivals, attractiveness: attr, backing: d.backing ?? 0 };
}
/**
 * Sign a driver for `years`. `offer` is the yearly salary offered (default: exactly what the driver asks); an offer
 * below the ask is refused. A driver under contract elsewhere is bought out for a transfer fee. Re-signing your own
 * driver renegotiates at today's asking price.
 */
export function signDriver(g: GameState, driverId: string, years: number, replaceId?: string, offer?: number): string | null {
  const c = player(g); const div = c.motorsport; if (!div) return 'No racing programme.';
  const ch = div.championship, team = playerTeam(div), regs = teamRegs(team, ch.year);
  const d = ch.drivers.find((x) => x.id === driverId); if (!d) return 'Unknown driver.';
  if (!finite(years) || years < 1) return 'Choose a contract length.';
  if (offer !== undefined && (!finite(offer) || offer < 0)) return 'Enter a salary.';
  const terms = driverTerms(g, driverId)!;
  const salary = offer ?? terms.ask;
  if (salary < terms.ask - 1) return `${d.name} wants at least $${(terms.ask / 1e6).toFixed(2)}M a year to drive for ${team.name}${terms.rivals ? ` (${terms.rivals} stronger team${terms.rivals > 1 ? 's are' : ' is'} interested)` : ''}.`;
  if (d.teamId === team.id) { d.contractEnd = ch.year + Math.round(years) - 1; d.salary = salary; d.contracted = salary; return null; }
  const seats = regs.carsPerTeam * regs.driversPerCar;
  if (replaceId) { const err = releaseDriver(g, replaceId); if (err) return err; }
  if (team.drivers.length >= seats) return 'No free seat — release a driver first.';
  const err = pay(c, g, salary * 0.1 + terms.fee, 'motorsport'); // signing fee and any transfer fee
  if (err) return err;
  if (d.teamId) { // bought out: the other team signs the best free agent in the driver's place
    const from = ch.teams.find((t) => t.id === d.teamId);
    if (from) {
      from.drivers = from.drivers.filter((id) => id !== d.id);
      const repl = ch.drivers.filter((x) => !x.teamId && !x.academy).sort((a, b) => overall(b) - overall(a))[0];
      if (repl) { repl.teamId = from.id; repl.contractEnd = ch.year + 1; from.drivers.push(repl.id); }
    }
  }
  d.teamId = team.id; d.contractEnd = ch.year + Math.round(years) - 1; d.salary = salary; d.contracted = salary; team.drivers.push(d.id);
  news(g, 'motorsport', `${d.name} signs for ${team.name}`, `${Math.round(years)}-year contract at $${(salary / 1e6).toFixed(2)}M a year${terms.fee ? `, after a $${(terms.fee / 1e6).toFixed(2)}M transfer fee` : ''}${d.backing ? `; brings $${(d.backing / 1e6).toFixed(2)}M a year of sponsorship` : ''}.`);
  return null;
}
/** Set the junior academy level (0–3). Setting up a level costs a tenth of a season's budget; running it is in the season budget. */
export function setAcademy(g: GameState, level: number): string | null {
  const c = player(g); const div = c.motorsport; if (!div) return 'No racing programme.';
  if (!finite(level) || level < 0 || level > 3) return 'Choose a level from 0 to 3.';
  const now = div.academy?.level ?? 0;
  level = Math.round(level);
  if (level > now) {
    const B = budgetRef(teamRegs(playerTeam(div), div.championship.year), g.year);
    const err = pay(c, g, B * 0.03 * (level - now), 'capex'); if (err) return err;
    c.books.otherAssets += B * 0.03 * (level - now);
  }
  div.academy ??= { level: 0, juniors: [] };
  div.academy.level = level;
  if (level === 0) div.academy.juniors = [];
  return null;
}
/** Promote an academy junior (17 or older) to a race seat on a cheap three-year rookie contract. */
export function promoteJunior(g: GameState, juniorId: string, replaceId?: string): string | null {
  const c = player(g); const div = c.motorsport; if (!div?.academy) return 'No academy.';
  const j = div.academy.juniors.find((x) => x.id === juniorId); if (!j) return 'Unknown junior.';
  if (j.age < 17) return `${j.name} is too young to race (${j.age}).`;
  const ch = div.championship, team = playerTeam(div), regs = teamRegs(team, ch.year);
  if (replaceId) { const err = releaseDriver(g, replaceId); if (err) return err; }
  if (team.drivers.length >= regs.carsPerTeam * regs.driversPerCar) return 'No free seat — release a driver first.';
  div.academy.juniors = div.academy.juniors.filter((x) => x !== j);
  j.academy = false; j.teamId = team.id; j.contractEnd = ch.year + 2; j.salary = driverSalary(j, regs, ch.year) * 0.4; j.contracted = j.salary;
  ch.drivers.push(j); team.drivers.push(j.id);
  news(g, 'motorsport', `${j.name} promoted from the academy`, `A three-year rookie contract at $${(j.salary / 1e6).toFixed(2)}M a year.`);
  return null;
}
export function releaseDriver(g: GameState, driverId: string): string | null {
  const c = player(g); const div = c.motorsport; if (!div) return 'No racing programme.';
  const ch = div.championship, team = playerTeam(div);
  const d = ch.drivers.find((x) => x.id === driverId); if (!d || d.teamId !== team.id) return 'Not your driver.';
  const err = pay(c, g, d.salary * 0.3 * Math.max(1, d.contractEnd - ch.year + 1), 'motorsport');
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
  const cost = facilityCost(g, c, div.facilities[key]);
  const err = pay(c, g, cost, 'capex');
  if (err) return err;
  c.books.otherAssets += cost;
  div.facilities[key]++; return null;
}
export const staffCost = (g: GameState, c: Company, skill: number) => budgetRef(teamRegs(playerTeam(c.motorsport!), g.year), g.year) * 0.035 * Math.exp((skill - 60) / 22);
export function recruitStaff(g: GameState, key: keyof NonNullable<Company['motorsport']>['staff']): string | null {
  const c = player(g); const div = c.motorsport; if (!div) return 'No racing programme.';
  if (div.staff[key] >= 97) return 'You already employ the best in the business.';
  const err = pay(c, g, staffCost(g, c, div.staff[key]), 'motorsport');
  if (err) return err;
  div.staff[key] = Math.min(98, div.staff[key] + 5); return null;
}
export function setDevBudget(g: GameState, amount: number) { const d = player(g).motorsport; if (d && finite(amount)) d.devBudget = Math.max(0, amount); }
export function setDevFocus(g: GameState, f: DevLevels) { const d = player(g).motorsport; if (d) d.devFocus = { ...f }; }

/** Commit a new race-car design. Changing the architecture costs money and resets part of the development. */
export function redesignRaceCar(g: GameState, spec: RaceCarSpec): string | null {
  const c = player(g); const div = c.motorsport; if (!div) return 'No racing programme.';
  const team = playerTeam(div), regs = teamRegs(team, div.championship.year);
  const legal = checkLegal(raceEngineSpec(spec.engine, regs), regs);
  if (legal.length) return legal[0];
  const { engineNew, chassisNew } = redesignKinds(team.car, spec);
  const cost = redesignCost(g, c, team.car, spec);
  const err = pay(c, g, cost, 'motorsport');
  if (err) return err;
  if (engineNew) { team.dev.engine *= 0.5; team.dev.reliability *= 0.6; }
  if (chassisNew) { team.dev.aero *= 0.8; team.dev.chassis *= 0.8; }
  team.car = JSON.parse(JSON.stringify(spec)); team.color = spec.color; team.color2 = spec.color2;
  div.carDesignedYear = g.year;
  news(g, 'motorsport', `${team.name} reveals a ${engineNew ? 'new car' : 'revised car'}`, `Design and build cost $${(cost / 1e6).toFixed(2)}M.${engineNew ? ' A new engine architecture means part of the development work starts again.' : ''}`);
  return null;
}
export const raceCarRedesignCost = (g: GameState, c: Company) => budgetRef(teamRegs(playerTeam(c.motorsport!), g.year), g.year);
/** What a change of race car costs. A small team builds fewer chassis and spares (and buys more parts in) than a works team, so it pays less. */
export function redesignKinds(old: RaceCarSpec, spec: RaceCarSpec) {
  const engineNew = old.engine.layout !== spec.engine.layout || old.engine.displacement !== spec.engine.displacement || old.engine.aspiration !== spec.engine.aspiration || old.engine.valvetrain !== spec.engine.valvetrain;
  const engineTune = JSON.stringify(old.engine) !== JSON.stringify(spec.engine);
  const chassisNew = Math.abs(old.aeroBias - spec.aeroBias) > 0.15 || Math.abs(old.stiffness - spec.stiffness) > 0.25 || Math.abs(old.weightEffort - spec.weightEffort) > 0.2 || Math.abs(old.cooling - spec.cooling) > 0.25;
  return { engineNew, engineTune, chassisNew };
}
export function redesignCost(g: GameState, c: Company, old: RaceCarSpec, spec: RaceCarSpec): number {
  const div = c.motorsport!; const team = playerTeam(div);
  const B = budgetRef(teamRegs(team, div.championship.year), g.year);
  const { engineNew, engineTune, chassisNew } = redesignKinds(old, spec);
  return B * ((engineNew ? 0.12 : engineTune ? 0.02 : 0) + (chassisNew ? 0.06 : 0) + spec.weightEffort * 0.02) * (0.4 + 0.6 * teamScale(div));
}
export { driverSalary, kf };
