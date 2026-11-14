// Phase 4F: steady-state economics of a founder's car at different plant sizes (60, 600, 1,500, 3,000, 5,000 cars a
// month), from the game's own cost and market functions. For each size: investment (plant, tooling, the dealer network
// needed to sell the plant's output at the competitive price), fixed and variable costs, unit cost, contribution,
// break-even volume, operating result and return on investment at full sale — and whether the market can absorb it.
//
// "Competitive price" = the car's value price for that supply (it includes the scarcity premium a small series earns).
// The demand per unit of dealer reach is measured with computeMarket on a live 2015 world (the car placed on sale in the
// founder's home market). This script only ANALYSES: it builds a scratch world and reads the rules; it plays nothing.
//
// Run: npx tsx scripts/industrial-economics.ts [year] [country]
import { capitalOptions, newFounderGame, player } from '../src/sim/world';
import { starterVehicle } from '../src/sim/engineering';
import { factoryBuildCost, factoryFixedCost, headOffice, makeModel, unitCost, engineerCost } from '../src/sim/company';
import { computeMarket, valuePrice, segVolume } from '../src/sim/market';
import { dealerCostPerUnit, maxAutomation } from '../src/sim/actions';
import { DEALER_NET } from '../src/sim/pricing';
import { PLANT_DEPRECIATION, OTHER_DEPRECIATION } from '../src/sim/accounts';
import { cpi } from '../src/sim/util';
import { COUNTRY } from '../src/data/world';
import type { SegmentId } from '../src/sim/types';

const year = Number(process.argv[2] ?? 2015), country = process.argv[3] ?? 'Germany';
const M = (x: number) => (x / 1e6).toFixed(1);
const K = (x: number) => Math.round(x).toLocaleString('en-US');
const SIZES = [60, 600, 1500, 3000, 5000];

export interface Econ {
  product: string; cap: number; automation: number; plant: number; tooling: number; reach: number; dealers: number; investment: number;
  unitCost: number; unitCostY3: number; price: number; contribution: number; fixedYear: number; depreciationYear: number;
  breakEvenMonth: number; revenueYear: number; operatingYear: number; roi: number; payback: number; demandShare: number; cellVolume: number;
}

export function economics(product: 'mass' | 'sports' | 'luxury', sp = product, yr = year, ctry = country): Econ[] {
  const g = newFounderGame({ name: 'T', country: ctry, year: yr, capital: capitalOptions(yr)[3], specialization: sp, factory: 2, engineers: 1, research: 1, workforce: 1, color: '#fff', difficulty: 'normal', historyMode: 'alternative', seed: 5 });
  const p = player(g);
  const seg: SegmentId = product === 'mass' ? 'budget' : product === 'sports' ? 'sports' : 'premium';
  const m = makeModel(g, 'Probe', starterVehicle(yr, product), seg, p.tech, yr);
  m.status = 'production'; m.launchYear = yr; m.launchMonth = 1;
  p.models.push(m);
  const f = p.factories[0];
  const out: Econ[] = [];
  const cpiY = cpi(yr);
  for (const cap of SIZES) {
    // the cheapest automation level (full cost per car) the founder's technology allows
    let best: Econ | null = null;
    for (const automation of [0.05, 0.3, 0.6, 0.8, 0.9].filter((a) => a <= maxAutomation(p) + 1e-9)) {
      f.capacity = cap; f.automation = automation; f.lines = [{ modelId: m.id, share: 1, ramp: 1, target: -1 }];
      const plant = factoryBuildCost(cap, automation, yr), tooling = m.stats.toolingPerUnitCapacity * cap;
      const unit = unitCost(g, m, f, cap), unitY3 = unitCost(g, { ...m, cumulativeUnits: cap * 36 }, f, cap);
      const price = valuePrice(m, p, yr, cap * 12);
      m.price = price;
      // reach the home dealer network needs to sell the plant's output at that price (bisection on the real market;
      // demand saturates as the network grows, so this is not a straight line)
      const saveReach = p.reach[p.homeRegion];
      const salesAt = (r: number) => { p.reach[p.homeRegion] = r; const d = computeMarket(g).demand.get(m.id); return d ? Object.values(d).reduce((a, x) => a + x, 0) * 12 : 0; };
      let lo = 0, hi = cap * 12 * 40, reach = Infinity;
      if (salesAt(hi) >= cap * 12) { for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (salesAt(mid) >= cap * 12) hi = mid; else lo = mid; } reach = hi; }
      p.reach[p.homeRegion] = saveReach;
      const dealers = Number.isFinite(reach) ? Math.max(0, reach - saveReach) * dealerCostPerUnit(g, p, p.homeRegion) : Infinity;
      const revenueYear = cap * 12 * price * DEALER_NET;
      const variable = unitY3 + 150 * cpiY + price * DEALER_NET * (0.035 + 0.03); // logistics, revenue-linked overhead and marketing
      const contribution = price * DEALER_NET - variable;
      const fixedYear = (factoryFixedCost(f, yr) + headOffice(p, yr) + 25 * engineerCost(p, yr)) * 12 + reach * 5 * cpiY * 12;
      const depreciationYear = (plant + tooling) * PLANT_DEPRECIATION + dealers * OTHER_DEPRECIATION;
      const operatingYear = cap * 12 * contribution - fixedYear - depreciationYear;
      const investment = plant + tooling + dealers;
      const e: Econ = {
        product, cap, automation, plant, tooling, reach, dealers, investment, unitCost: unit, unitCostY3: unitY3, price, contribution, fixedYear, depreciationYear,
        breakEvenMonth: contribution > 0 ? (fixedYear + depreciationYear) / contribution / 12 : Infinity, revenueYear, operatingYear,
        roi: operatingYear / investment, payback: operatingYear + depreciationYear > 0 ? investment / (operatingYear + depreciationYear) : Infinity,
        demandShare: (cap * 12) / segVolume(p.homeRegion, seg, yr), cellVolume: segVolume(p.homeRegion, seg, yr),
      };
      if (!best || (Number.isFinite(e.operatingYear) && e.operatingYear > best.operatingYear)) best = e;
    }
    out.push(best!);
  }
  return out;
}

if (process.argv[1]?.endsWith('industrial-economics.ts')) {
  console.log(`# Steady-state economics, ${year}, plant in ${COUNTRY[country].name} (best automation for each size; cost after 3 years of learning)\n`);
  for (const product of ['mass', 'sports', 'luxury'] as const) {
    const rows = economics(product);
    console.log(`## ${product === 'mass' ? 'Budget car (lean hatchback)' : product === 'sports' ? 'Sports coupé' : 'Premium saloon'} — home-market segment ${K(rows[0].cellVolume)} cars a year\n`);
    console.log('| Capacity / month | Automation | Plant $M | Tooling $M | Reach needed | Dealers $M | Investment $M | Unit cost yr1 / yr3 | Competitive price | Contribution / car | Fixed + depreciation $M/yr | Break-even / month | Operating at full sale $M/yr | ROI | Cash payback (yrs) | Share of home segment |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const e of rows) console.log(`| ${K(e.cap)} | ${Math.round(e.automation * 100)} % | ${M(e.plant)} | ${M(e.tooling)} | ${K(e.reach)} | ${M(e.dealers)} | ${M(e.investment)} | $${K(e.unitCost)} / $${K(e.unitCostY3)} | $${K(e.price)} | $${K(e.contribution)} | ${M(e.fixedYear + e.depreciationYear)} | ${Number.isFinite(e.breakEvenMonth) ? K(e.breakEvenMonth) : 'never'} | ${M(e.operatingYear)} | ${(e.roi * 100).toFixed(1)} % | ${Number.isFinite(e.payback) ? e.payback.toFixed(1) : 'never'} | ${(e.demandShare * 100).toFixed(2)} % |`);
    console.log('');
  }
}
