// Trims and facelifts (Phase 3).
//
// A model can be sold in several versions. Each trim keeps the model's body and platform and changes what
// buyers choose between: engine variant (from the model's engine family), gearbox, cabin, wheels and tyres,
// equipment, price and the share of production it gets. Every trim is its own car to the market (its own
// appeal, price and scarcity) and to the factory (its own unit cost), with its own stock and sales; the model's
// figures are the sums. A model without trims is sold as one version, exactly as before.
import type { Company, GameState, RegionId, Trim, TrimLevel, VehicleModel, VehicleSpec } from './types';
import { computeVehicle } from './engineering';
import { familyEngine, familyOf, maturityOf } from './families';
import { clamp } from './util';

const zero = (): Record<RegionId, number> => ({ NA: 0, EU: 0, JP: 0, CN: 0, LATAM: 0, ROW: 0 });

export interface TrimPreset {
  name: string; interior: Trim['interior']; equipment: number; wheel: number; tire?: Trim['tireCompound']; engine: 'economy' | 'base' | 'performance' | 'top';
  sport?: number; width?: number; mix: number; blurb: string;
}
/** Starting points for each trim level; every field can be changed afterwards. */
export const TRIM_PRESETS: Record<TrimLevel, TrimPreset> = {
  entry: { name: 'Entry', interior: 'basic', equipment: 0.1, wheel: -1, engine: 'economy', mix: 0.35, blurb: 'The price leader: smallest engine, basic cabin.' },
  mid: { name: 'Mid', interior: 'standard', equipment: 0.4, wheel: 0, engine: 'base', mix: 0.4, blurb: 'The volume seller.' },
  premium: { name: 'Premium', interior: 'premium', equipment: 0.7, wheel: 1, engine: 'base', mix: 0.15, blurb: 'Better cabin and more equipment at a higher price.' },
  sport: { name: 'Sport', interior: 'standard', equipment: 0.5, wheel: 1, tire: 'sport', engine: 'performance', sport: 0.7, width: 15, mix: 0.1, blurb: 'Stronger engine, firmer tuning, sport tyres.' },
  luxury: { name: 'Luxury', interior: 'luxury', equipment: 0.95, wheel: 1, engine: 'performance', mix: 0.08, blurb: 'Everything included.' },
  performance: { name: 'Performance', interior: 'premium', equipment: 0.7, wheel: 2, tire: 'semislick', engine: 'top', sport: 0.85, width: 30, mix: 0.05, blurb: 'The most powerful variant, track tyres.' },
  limited: { name: 'Limited Edition', interior: 'luxury', equipment: 1, wheel: 2, tire: 'sport', engine: 'top', sport: 0.8, width: 20, mix: 0.02, blurb: 'A numbered run: scarcity lifts what buyers will pay.' },
};
const TIRE_RANK: Record<Trim['tireCompound'], number> = { economy: 0, touring: 1, sport: 2, semislick: 3 };
export const TRIM_ORDER: TrimLevel[] = ['entry', 'mid', 'premium', 'sport', 'luxury', 'performance', 'limited'];

export const trimsOf = (m: VehicleModel): Trim[] => m.trims ?? [];
export const hasTrims = (m: VehicleModel) => (m.trims?.length ?? 0) > 0;
/** Market and demand key of a trim. */
export const trimKey = (m: VehicleModel, t: Trim) => `${m.id}#${t.id}`;
/** A trim seen as a car: the model with the trim's specification, figures and price. */
export const trimView = (m: VehicleModel, t: Trim): VehicleModel => ({ ...m, id: trimKey(m, t), spec: t.spec, stats: t.stats, price: t.price, inventory: t.inventory, lastDemand: t.lastDemand, trims: undefined });

/** The full specification of a trim: the model's car with the trim's choices applied. */
export function trimSpec(c: Company, m: VehicleModel, t: Trim): VehicleSpec {
  const s: VehicleSpec = JSON.parse(JSON.stringify(m.spec));
  const f = familyOf(c, m);
  const v = f?.variants.find((x) => x.id === t.engineVariantId);
  if (f && v) s.engine = familyEngine(f, v);
  if (t.gearbox && s.engine.layout !== 'EV') { s.gearbox = t.gearbox; if (t.gears) s.gears = t.gears; }
  s.interior = t.interior; s.wheelDia = clamp(t.wheelDia, 12, 22); s.tireCompound = t.tireCompound; s.equipment = clamp(t.equipment, 0, 1);
  if (t.sport !== undefined) s.sport = clamp(t.sport, 0, 1);
  if (t.tireWidth) s.tireWidth = clamp(t.tireWidth, 125, 345);
  return s;
}
export function refreshTrim(g: GameState, c: Company, m: VehicleModel, t: Trim) {
  t.spec = trimSpec(c, m, t);
  t.stats = computeVehicle(t.spec, { year: g.year, tech: m.frozenTech, maturity: maturityOf(c, m, g.year) });
}
export function refreshTrims(g: GameState, c: Company, m: VehicleModel) { for (const t of trimsOf(m)) refreshTrim(g, c, m, t); }

/** Pick the family variant a preset asks for among the ready ones. */
function pickVariant(c: Company, m: VehicleModel, want: TrimPreset['engine']): string | undefined {
  const f = familyOf(c, m);
  if (!f) return undefined;
  const ready = f.variants.filter((v) => v.status === 'ready');
  if (!ready.length) return m.engineVariantId;
  const power = (id: string) => { const v = ready.find((x) => x.id === id)!; return computeVehicle({ ...m.spec, engine: familyEngine(f, v) }, { year: 2000, tech: m.frozenTech }).engine.powerKw; };
  const sorted = [...ready].sort((a, b) => power(a.id) - power(b.id));
  if (want === 'base') return m.engineVariantId ?? sorted[Math.floor(sorted.length / 2)].id;
  if (want === 'economy') return (ready.find((v) => v.tune === 'economy') ?? sorted[0]).id;
  if (want === 'top') return sorted[sorted.length - 1].id;
  // performance: the strongest that is not the very top when there is a choice
  return (ready.find((v) => v.tune === 'performance') ?? sorted[Math.max(0, sorted.length - (sorted.length > 2 ? 2 : 1))]).id;
}
export function makeTrim(g: GameState, c: Company, m: VehicleModel, level: TrimLevel, price: number, over: Partial<Trim> = {}): Trim {
  const pr = TRIM_PRESETS[level];
  const t: Trim = {
    id: `t${g.nextId++}`, name: pr.name, level, engineVariantId: pickVariant(c, m, pr.engine), interior: pr.interior, wheelDia: m.spec.wheelDia + pr.wheel,
    // presets only ever upgrade tyres: a sport trim never gets less grip than the car it is based on
    tireCompound: pr.tire && TIRE_RANK[pr.tire] > TIRE_RANK[m.spec.tireCompound] ? pr.tire : m.spec.tireCompound, equipment: pr.equipment, sport: pr.sport !== undefined ? Math.max(pr.sport, m.spec.sport) : undefined,
    tireWidth: pr.width ? m.spec.tireWidth + pr.width : undefined, price, mix: pr.mix, cap: level === 'limited' ? 499 : undefined,
    spec: m.spec, stats: m.stats, inventory: 0, inventoryValue: 0, built: 0, lastSales: zero(), lastDemand: 0, lastUnitCost: 0, salesHistory: [], revenue: 0, cogs: 0,
    ...over,
  };
  refreshTrim(g, c, m, t);
  return t;
}

/** Trims still being built (a limited edition stops at its cap). */
export const buildable = (t: Trim) => t.cap === undefined || t.built < t.cap - 1e-6;
/** Production shares: the planned mix of the trims that can still be built, normalised. */
export function productionMix(m: VehicleModel): Map<string, number> {
  const out = new Map<string, number>();
  const ts = trimsOf(m).filter(buildable);
  const sum = ts.reduce((a, t) => a + Math.max(0, t.mix), 0);
  for (const t of ts) out.set(t.id, sum > 0 ? Math.max(0, t.mix) / sum : 1 / ts.length);
  return out;
}
/** Share of the dealers' attention each trim gets: its production share, plus a share for stock still on hand. */
export function dealerMix(m: VehicleModel): Map<string, number> {
  const ts = trimsOf(m);
  const prod = productionMix(m);
  const stock = ts.reduce((a, t) => a + t.inventory, 0);
  const raw = ts.map((t) => (prod.get(t.id) ?? 0) + (stock > 0 ? (0.5 * t.inventory) / stock : 0));
  const sum = raw.reduce((a, b) => a + b, 0);
  return new Map(ts.map((t, i) => [t.id, sum > 0 ? raw[i] / sum : 0]));
}
/** Keep the model's figures equal to the sums of its trims. */
export function aggregateTrims(m: VehicleModel) {
  const ts = trimsOf(m);
  if (!ts.length) return;
  m.inventory = ts.reduce((a, t) => a + t.inventory, 0);
  m.inventoryValue = ts.reduce((a, t) => a + t.inventoryValue, 0);
  m.lastDemand = ts.reduce((a, t) => a + t.lastDemand, 0);
  const sales = zero();
  for (const t of ts) for (const r of Object.keys(sales) as RegionId[]) sales[r] += t.lastSales[r];
  m.lastSales = sales;
  const mix = productionMix(m);
  // the model's list price is the production-weighted price of its trims (for tables and legacy readers)
  const w = ts.reduce((a, t) => a + (mix.get(t.id) ?? 0), 0);
  if (w > 0) m.price = ts.reduce((a, t) => a + t.price * (mix.get(t.id) ?? 0), 0) / w;
}
export const trimContribution = (t: Trim) => t.revenue - t.cogs;

// ------------------------------------------------------------------------------------------- facelifts

/** A facelift costs about a quarter of the car's own engineering share and takes eight months. */
export function faceliftCost(m: VehicleModel): { cost: number; months: number } {
  return { cost: m.stats.devCost * 0.35 * 0.25, months: 8 };
}
/** Years a model must have been on sale (or since its last facelift) before a facelift makes sense. */
export const FACELIFT_AFTER = 3;
