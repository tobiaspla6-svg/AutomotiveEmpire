// Strategic identity of each manufacturer: how it prices, where it spends, how it reacts.
//
// DATA STATUS: ESTIMATED GAME DATA. The profiles paraphrase widely known business characteristics
// of each company (pricing discipline, cost leadership, engineering focus); the numbers are tuning
// parameters of the simulation, not published figures.
import type { SegmentId, TechArea } from '../sim/types';
import type { MakerDef } from './manufacturers';

export interface Strategy {
  /** Short identity shown in the setup and company screens. */
  title: string;
  summary: string;
  /** List price as a multiple of what buyers consider the car to be worth (1 = at value). */
  pricePosition: number;
  /** Exceptions by segment (e.g. a volume maker's profitable trucks). */
  segPosition?: Partial<Record<SegmentId, number>>;
  /** Smallest margin over unit cost the company accepts; below it the price goes up whatever the market says. */
  minMargin: number;
  /** 0…1: how readily it follows a rival's price cut in a segment it competes in. */
  priceFollow: number;
  /** Research and marketing as shares of revenue. */
  rdIntensity: number; marketing: number;
  /** Research priorities (weights for the five areas). */
  focus: Record<TechArea, number>;
  /** Years between re-engineering a long-running nameplate. */
  refreshYears: number;
  /** What it does after a loss-making year. */
  crisis: 'cut-costs' | 'cut-prices' | 'hold-prices';
  /** Build fewer cars than it could sell (protects exclusivity and residual values). */
  restraint: number;
  strengths: string[]; risks: string[];
}

const even: Record<TechArea, number> = { engine: 1, chassis: 1, aero: 1, electronics: 1, manufacturing: 1 };

const ARCHETYPE: Record<MakerDef['archetype'], Strategy> = {
  exotic: {
    title: 'Exclusive sports cars', summary: 'Hand-built performance cars in small numbers at very high margins.',
    pricePosition: 1.0, minMargin: 0.35, priceFollow: 0, rdIntensity: 0.07, marketing: 0.02, focus: { engine: 1.6, chassis: 1.3, aero: 1.4, electronics: 0.7, manufacturing: 0.3 },
    refreshYears: 7, crisis: 'hold-prices', restraint: 0.1, strengths: ['Pricing power', 'Brand prestige'], risks: ['Tiny volumes carry every fixed cost', 'A weak model hurts the whole company'],
  },
  sports: {
    title: 'Sports-car specialist', summary: 'Engineering-led sports cars with strong margins.',
    pricePosition: 1.03, minMargin: 0.2, priceFollow: 0.1, rdIntensity: 0.06, marketing: 0.025, focus: { engine: 1.4, chassis: 1.4, aero: 1.1, electronics: 0.9, manufacturing: 0.6 },
    refreshYears: 8, crisis: 'cut-costs', restraint: 0.03, strengths: ['Margins', 'Engineering reputation'], risks: ['Narrow range', 'Sports-car demand is cyclical'],
  },
  premium: {
    title: 'Premium manufacturer', summary: 'Technology and status at a price premium over the mainstream.',
    pricePosition: 1.02, minMargin: 0.14, priceFollow: 0.3, rdIntensity: 0.055, marketing: 0.03, focus: { engine: 1.1, chassis: 1.0, aero: 0.8, electronics: 1.4, manufacturing: 0.8 },
    refreshYears: 7, crisis: 'cut-costs', restraint: 0, strengths: ['Price premium', 'Technology'], risks: ['High fixed costs', 'Brand dilution when chasing volume'],
  },
  mass: {
    title: 'Volume manufacturer', summary: 'Affordable cars in very large numbers on thin margins.',
    pricePosition: 0.96, minMargin: 0.06, priceFollow: 0.6, rdIntensity: 0.04, marketing: 0.03, focus: { engine: 0.9, chassis: 0.8, aero: 0.6, electronics: 0.9, manufacturing: 1.8 },
    refreshYears: 6, crisis: 'cut-prices', restraint: 0, strengths: ['Scale', 'Dealer reach'], risks: ['Thin margins', 'Exposed to recessions and price wars'],
  },
};

const OVERRIDE: Record<string, Partial<Strategy>> = {
  ferrari: {
    title: 'Racing-bred exclusivity', summary: 'Builds one car fewer than the market wants. Never discounts; racing sells the road cars and the road cars pay for the racing.',
    pricePosition: 1.06, minMargin: 0.42, priceFollow: 0, restraint: 0.15, rdIntensity: 0.09,
    strengths: ['The strongest pricing power in the industry', 'Limited-series flagships sell out before launch', 'Racing heritage'], risks: ['Dependent on a handful of models', 'Formula 1 is a permanent cost'],
  },
  lamborghini: {
    title: 'Dramatic design, bold engines', summary: 'Extroverted supercars priced just below the oldest rival; a super-SUV pays the bills in the modern era.',
    pricePosition: 0.98, minMargin: 0.3, restraint: 0.08,
    strengths: ['Design', 'V12 flagship'], risks: ['Historically fragile finances', 'Small dealer network'],
  },
  mclaren: {
    title: 'Racing technology for the road', summary: 'Carbon-fibre cars developed like racing cars. Brilliant engineering, a thin range and little financial cushion.',
    pricePosition: 0.95, minMargin: 0.22, rdIntensity: 0.1, crisis: 'cut-prices',
    strengths: ['Carbon structures', 'Aerodynamics'], risks: ['No volume model to carry development', 'Weak residual values'],
  },
  porsche: {
    title: 'Engineering excellence at industrial scale', summary: 'Sports cars built with volume-maker discipline, the highest margins of any series producer, and SUVs that fund the icons.',
    pricePosition: 1.06, minMargin: 0.24, rdIntensity: 0.07, segPosition: { suv: 1.06, premium: 1.0 },
    strengths: ['Margins near 20 %', 'Reliability unusual for a sports car', 'Motorsport as a development tool'], risks: ['One nameplate carries the brand', 'Engineering cost'],
  },
  bmw: {
    title: 'The driver’s premium car', summary: 'Sporting saloons and engines above all; a full premium range built in flexible plants.',
    pricePosition: 1.03, minMargin: 0.15, focus: { engine: 1.5, chassis: 1.3, aero: 0.8, electronics: 1.2, manufacturing: 0.9 },
    strengths: ['Engines', 'Driving dynamics', 'Flexible production'], risks: ['Smaller than its rivals', 'Needs constant technical leadership'],
  },
  mercedes: {
    title: 'Engineered like no other car', summary: 'Safety, comfort and status. The flagship saloon sets the technology the rest of the industry follows.',
    pricePosition: 1.05, minMargin: 0.16, focus: { engine: 1.0, chassis: 1.0, aero: 0.8, electronics: 1.6, manufacturing: 0.8 }, segPosition: { luxury: 1.06 },
    strengths: ['Luxury pricing', 'Safety technology'], risks: ['Costly engineering', 'Quality lapses damage the name quickly'],
  },
  audi: {
    title: 'Progress through technology', summary: 'All-wheel drive, aerodynamics and interiors; shares platforms with its parent group to hold costs down.',
    pricePosition: 1.0, minMargin: 0.13, focus: { engine: 1.1, chassis: 1.0, aero: 1.3, electronics: 1.3, manufacturing: 1.0 },
    strengths: ['All-wheel drive', 'Shared platforms'], risks: ['Third among the German premium makers for much of its history'],
  },
  jaguar: {
    title: 'Grace, space and pace', summary: 'Beautiful, fast cars at tempting prices — with patchy quality and never quite enough money.',
    pricePosition: 0.92, minMargin: 0.1, crisis: 'cut-prices', rdIntensity: 0.045,
    strengths: ['Design', 'Value against German rivals'], risks: ['Reliability reputation', 'Under-investment'],
  },
  toyota: {
    title: 'Relentless manufacturing efficiency', summary: 'Lean production, reliability and long-term planning. Prices sit a little under the car’s worth; costs sit far under everyone else’s.',
    pricePosition: 0.97, minMargin: 0.08, priceFollow: 0.35, rdIntensity: 0.045, crisis: 'cut-costs',
    focus: { engine: 1.0, chassis: 0.7, aero: 0.6, electronics: 1.0, manufacturing: 2.2 }, segPosition: { luxury: 0.9, premium: 0.94 },
    strengths: ['Lowest build cost at scale', 'Reliability', 'Hybrid leadership'], risks: ['Conservative styling and performance', 'Slow to change direction'],
  },
  honda: {
    title: 'The engine company', summary: 'High-revving, efficient engines and clever packaging; independent and engineering-led.',
    pricePosition: 0.98, minMargin: 0.08, priceFollow: 0.4, rdIntensity: 0.055, crisis: 'cut-costs',
    focus: { engine: 1.9, chassis: 0.9, aero: 0.6, electronics: 0.9, manufacturing: 1.4 },
    strengths: ['Engines', 'Reliability'], risks: ['Smaller scale than Toyota', 'Thin premium presence'],
  },
  nissan: {
    title: 'Technology in the mainstream', summary: 'Ambitious engineering and bold bets, with finances that swing from boom to crisis.',
    pricePosition: 0.94, minMargin: 0.05, priceFollow: 0.7,
    strengths: ['Sports-car heritage', 'Early electric cars'], risks: ['Debt', 'Discounting habit'],
  },
  ford: {
    title: 'Mass production and trucks', summary: 'Large scale, sharp prices on cars and fat margins on pickups. Powerful in North America, exposed when that market turns.',
    pricePosition: 0.93, minMargin: 0.05, priceFollow: 0.8, segPosition: { pickup: 1.06, sports: 0.85, suv: 1.0 },
    strengths: ['The best-selling truck line', 'Scale', 'Affordable performance'], risks: ['Dependence on North America', 'Car margins close to zero'],
  },
  gm: {
    title: 'A car for every purse and purpose', summary: 'Many brands on shared engineering across the widest price range; enormous scale and enormous overheads.',
    pricePosition: 0.94, minMargin: 0.05, priceFollow: 0.8, segPosition: { pickup: 1.05, luxury: 0.95, sports: 0.9 },
    strengths: ['Scale', 'Trucks and SUVs'], risks: ['Legacy costs', 'Brand overlap'],
  },
  vw: {
    title: 'The people’s car, built on platforms', summary: 'One architecture under many cars and brands; solid, slightly dearer than rivals, dominant in Europe and China.',
    pricePosition: 1.0, minMargin: 0.06, priceFollow: 0.4, rdIntensity: 0.05,
    strengths: ['Platform sharing', 'Europe and China'], risks: ['High home-market labour costs', 'Complexity'],
  },
  fiat: {
    title: 'Small cars for everyone', summary: 'Masters of the cheap, clever small car; strong at home and in Latin America, weak everywhere margins are made.',
    pricePosition: 0.9, minMargin: 0.04, priceFollow: 0.8, rdIntensity: 0.03,
    strengths: ['Small-car packaging', 'Low prices'], risks: ['Margins', 'Reliability reputation', 'Home-market dependence'],
  },
  renault: {
    title: 'Cars for living', summary: 'Inventive body styles for the European mainstream and a low-cost brand for everyone else.',
    pricePosition: 0.93, minMargin: 0.05, priceFollow: 0.7,
    strengths: ['Packaging innovation', 'Low-cost entry brand'], risks: ['Europe-dependent', 'Thin margins'],
  },
  hyundai: {
    title: 'Fast follower', summary: 'Starts cheap, learns quickly and climbs: every generation closes more of the gap while undercutting the leaders.',
    pricePosition: 0.88, minMargin: 0.05, priceFollow: 0.9, rdIntensity: 0.05, refreshYears: 5,
    strengths: ['Price', 'Rapid improvement', 'Long warranties'], risks: ['Little brand prestige to begin with'],
  },
  tesla: {
    title: 'Software-defined electric cars', summary: 'Batteries, motors and software in-house, sold direct. Cuts prices aggressively when volume matters more than margin.',
    pricePosition: 1.0, minMargin: 0.1, priceFollow: 0.2, rdIntensity: 0.08, marketing: 0.002, crisis: 'cut-prices', refreshYears: 9,
    focus: { engine: 1.7, chassis: 0.7, aero: 1.1, electronics: 1.9, manufacturing: 1.3 },
    strengths: ['Electric powertrain cost', 'No dealer margin to share', 'Software'], risks: ['Build quality', 'Ageing model range', 'Capital hunger'],
  },
};

export function strategyOf(def: Pick<MakerDef, 'id' | 'archetype'> | null | undefined, archetype: MakerDef['archetype'] | 'motorsport' = 'mass'): Strategy {
  const base = ARCHETYPE[def?.archetype ?? (archetype === 'motorsport' ? 'sports' : archetype)] ?? ARCHETYPE.mass;
  return { ...base, focus: { ...even, ...base.focus }, ...(def ? OVERRIDE[def.id] ?? {} : {}) };
}
/** Price position of a company in a segment. */
export const positionIn = (s: Strategy, seg: SegmentId) => s.segPosition?.[seg] ?? s.pricePosition;
