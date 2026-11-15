// Achievements and company level (Phase 5). Every achievement is a fact read from the simulation (cars built and
// sold, engines developed, plants abroad, operating results, championships); nothing is granted for clicking. Each is
// claimed once: the claim is stored in the save, gives experience (company level), earned credits and, for a few, a
// specific cosmetic blueprint. Rewards never add money, demand, horsepower or capacity to the simulation.
import type { Company, GameState } from './types';
import { BLUEPRINTS, emptyArcade, lifetimeSales } from './progression';
import { annualUnits } from './company';
import { player } from './world';
import { REGION_IDS } from '../data/world';

export type AchievementGroup = 'production' | 'sales' | 'engineering' | 'industry' | 'finance' | 'racing' | 'market';
export interface Achievement {
  id: string; group: AchievementGroup; es: string; en: string; descEs: string; descEn: string;
  xp: number; credits: number;
  /** a cosmetic blueprint given with the claim (only if it exists in the current era) */
  blueprint?: string;
  /** progress toward the goal, from the simulation */
  progress: (g: GameState, c: Company) => { value: number; target: number };
}

const builtCars = (c: Company) => Math.floor(c.models.reduce((a, m) => a + Math.max(0, m.cumulativeUnits || 0), 0));
const onSale = (c: Company) => c.models.filter((m) => m.status === 'production' || m.status === 'ready');
const hasEngine = (c: Company, test: (layout: string, asp: string, hybrid: number) => boolean) => onSale(c).some((m) => test(m.spec.engine.layout, m.spec.engine.aspiration, m.spec.engine.hybridKw || 0));
const last12 = (c: Company) => c.ledger.slice(-12);
const operating12 = (c: Company) => last12(c).reduce((a, l) => a + l.profit + l.tax + l.interest - l.assetGains, 0);
const capacity = (c: Company) => c.factories.reduce((a, f) => a + f.capacity, 0);
const bool = (v: boolean) => ({ value: v ? 1 : 0, target: 1 });

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first-programme', group: 'engineering', es: 'Primer proyecto', en: 'First programme', descEs: 'Aprobá el desarrollo de tu primer vehículo.', descEn: 'Approve the development of your first vehicle.', xp: 40, credits: 20, progress: (_g, c) => bool(c.models.length > 0) },
  { id: 'first-car', group: 'production', es: 'Sale de fábrica', en: 'Off the line', descEs: 'Fabricá tu primer automóvil.', descEn: 'Build your first car.', xp: 50, credits: 25, progress: (_g, c) => ({ value: Math.min(1, builtCars(c)), target: 1 }) },
  { id: 'built-100', group: 'production', es: 'Los primeros 100', en: 'The first hundred', descEs: 'Fabricá 100 automóviles.', descEn: 'Build 100 cars.', xp: 80, credits: 40, progress: (_g, c) => ({ value: Math.min(100, builtCars(c)), target: 100 }) },
  { id: 'sold-10k', group: 'sales', es: '10.000 clientes', en: '10,000 customers', descEs: 'Vendé 10.000 unidades.', descEn: 'Sell 10,000 cars.', xp: 150, credits: 80, blueprint: 'five-spoke', progress: (_g, c) => ({ value: Math.min(10000, lifetimeSales(c)), target: 10000 }) },
  { id: 'sold-100k', group: 'sales', es: 'Marca popular', en: 'Household name', descEs: 'Vendé 100.000 unidades.', descEn: 'Sell 100,000 cars.', xp: 300, credits: 200, blueprint: 'aero-gt', progress: (_g, c) => ({ value: Math.min(100000, lifetimeSales(c)), target: 100000 }) },
  { id: 'sold-1m', group: 'sales', es: 'Un millón', en: 'One million', descEs: 'Vendé 1.000.000 de unidades.', descEn: 'Sell 1,000,000 cars.', xp: 600, credits: 600, blueprint: 'prototype', progress: (_g, c) => ({ value: Math.min(1e6, lifetimeSales(c)), target: 1e6 }) },
  { id: 'first-v8', group: 'engineering', es: 'Ocho cilindros', en: 'Eight cylinders', descEs: 'Fabricá un auto con motor V8, V10 o V12.', descEn: 'Build a car with a V8, V10 or V12.', xp: 120, credits: 60, blueprint: 'race-v8', progress: (_g, c) => bool(hasEngine(c, (l) => l === 'V8' || l === 'V10' || l === 'V12' || l === 'F12')) },
  { id: 'first-turbo', group: 'engineering', es: 'Bajo presión', en: 'Under pressure', descEs: 'Fabricá un auto con turbo o compresor.', descEn: 'Build a car with a turbo or supercharger.', xp: 100, credits: 50, blueprint: 'twinturbo', progress: (_g, c) => bool(hasEngine(c, (_l, a) => a !== 'na')) },
  { id: 'first-electrified', group: 'engineering', es: 'Electrificado', en: 'Electrified', descEs: 'Fabricá un auto eléctrico o híbrido.', descEn: 'Build an electric or hybrid car.', xp: 160, credits: 80, blueprint: 'hybrid', progress: (_g, c) => bool(hasEngine(c, (l, _a, h) => l === 'EV' || h > 0)) },
  // a founder's speciality can start an area up to two years ahead, so leadership means three years ahead of the calendar
  { id: 'tech-leader', group: 'engineering', es: 'Líder tecnológico', en: 'Technology leader', descEs: 'Llevá un área de investigación tres años por delante del calendario.', descEn: 'Take one research area three years ahead of the calendar.', xp: 200, credits: 120, blueprint: 'carbon-frame', progress: (g, c) => { const lead = Math.max(...Object.values(c.tech)) - (g.year + (g.month - 1) / 12); return { value: Math.max(0, Math.min(3, Math.floor(lead * 10) / 10)), target: 3 }; } },
  { id: 'three-models', group: 'market', es: 'Gama completa', en: 'A full range', descEs: 'Tené tres modelos a la venta al mismo tiempo.', descEn: 'Have three models on sale at once.', xp: 150, credits: 80, progress: (_g, c) => ({ value: Math.min(3, onSale(c).length), target: 3 }) },
  { id: 'abroad', group: 'industry', es: 'Planta internacional', en: 'International plant', descEs: 'Abrí una fábrica fuera de tu región.', descEn: 'Open a plant outside your home region.', xp: 200, credits: 120, progress: (_g, c) => bool(c.factories.some((f) => f.capacity > 0 && f.region !== c.homeRegion)) },
  // the largest founder plant is 5,000 a month, so this asks for real growth beyond it
  { id: 'capacity-10000', group: 'industry', es: 'Gran industria', en: 'Heavy industry', descEs: 'Alcanzá 10.000 autos al mes de capacidad.', descEn: 'Reach 10,000 cars a month of capacity.', xp: 250, credits: 150, blueprint: 'spaceframe', progress: (_g, c) => ({ value: Math.min(10000, Math.round(capacity(c))), target: 10000 }) },
  { id: 'three-regions', group: 'market', es: 'Tres continentes', en: 'Three continents', descEs: 'Tené concesionarios en tres regiones.', descEn: 'Have dealers in three regions.', xp: 180, credits: 100, progress: (_g, c) => ({ value: Math.min(3, REGION_IDS.filter((r) => c.reach[r] > 0).length), target: 3 }) },
  { id: 'profitable-year', group: 'finance', es: 'Año rentable', en: 'A profitable year', descEs: 'Cerrá 12 meses con beneficio operativo vendiendo autos.', descEn: 'Make an operating profit over 12 months selling cars.', xp: 220, credits: 120, progress: (_g, c) => bool(last12(c).length === 12 && last12(c).some((l) => l.units > 0) && operating12(c) > 0) },
  { id: 'margin-10', group: 'finance', es: 'Margen de campeón', en: 'Champion margins', descEs: 'Ganá un 10 % de tus ingresos en 12 meses.', descEn: 'Earn 10 % of revenue over 12 months.', xp: 300, credits: 180, progress: (_g, c) => { const r = last12(c).reduce((a, l) => a + l.revenue, 0), p = last12(c).reduce((a, l) => a + l.profit, 0); return { value: r > 0 ? Math.max(0, Math.min(10, Math.round((p / r) * 1000) / 10)) : 0, target: 10 }; } },
  { id: 'top-ten', group: 'market', es: 'Entre los diez', en: 'Top ten', descEs: 'Entrá entre los diez fabricantes que más venden.', descEn: 'Become one of the ten best-selling makers.', xp: 350, credits: 200, progress: (g, c) => { const mine = annualUnits(c), better = g.companies.filter((x) => x.alive && x !== c && annualUnits(x) > mine).length; return bool(mine > 0 && better < 10); } },
  { id: 'champion', group: 'racing', es: 'Campeones', en: 'Champions', descEs: 'Ganá un campeonato de equipos.', descEn: 'Win a teams\' championship.', xp: 500, credits: 300, blueprint: 'endurance', progress: (_g, c) => bool(!!c.motorsport?.history.some((h) => h.playerTeamPos === 1)) },
];

/** Experience needed for each company level (same table as progression.ts). */
export const LEVELS = [0, 100, 250, 450, 750, 1150, 1700, 2400, 3300, 4500] as const;
export const levelOf = (xp: number) => { let l = 1; for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i]) l = i + 1; return l; };
export const companyLevel = (c: Company) => levelOf(c.arcade?.xp ?? 0);
export const nextLevelXp = (xp: number) => LEVELS.find((v) => v > xp) ?? null;

export interface AchievementView { a: Achievement; value: number; target: number; done: boolean; claimed: boolean }
export function achievementViews(g: GameState, c: Company): AchievementView[] {
  return ACHIEVEMENTS.map((a) => { const p = a.progress(g, c); return { a, value: p.value, target: p.target, done: p.value >= p.target, claimed: !!c.arcade?.achievements?.[a.id] }; });
}

/** Claim a reached achievement once. Returns an error message or the rewards given. */
export function claimAchievement(g: GameState, id: string): string | { xp: number; credits: number; blueprint: string | null; level: number } {
  const c = player(g);
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return 'Unknown achievement.';
  const arc = c.arcade ??= emptyArcade();
  arc.achievements ??= {};
  if (arc.achievements[id]) return 'Achievement already claimed.';
  const p = a.progress(g, c);
  if (p.value < p.target) return 'Achievement not reached yet.';
  arc.achievements[id] = { y: g.year, m: g.month };
  arc.xp = (arc.xp ?? 0) + a.xp;
  arc.credits += a.credits;
  let blueprint: string | null = null;
  const bp = a.blueprint ? BLUEPRINTS.find((b) => b.id === a.blueprint) : undefined;
  if (bp && bp.firstYear <= g.year) { arc.inventory[bp.id] = (arc.inventory[bp.id] ?? 0) + 1; blueprint = bp.id; }
  return { xp: a.xp, credits: a.credits, blueprint, level: levelOf(arc.xp) };
}
