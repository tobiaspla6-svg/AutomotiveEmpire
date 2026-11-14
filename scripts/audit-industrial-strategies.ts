// Phase 4F: can a small car maker grow into a profitable industrial company through investment decisions?
//
// Every run is a founder game (Germany, a 600-a-month plant unless stated) that develops the speciality's starter design
// and then follows one growth strategy for up to 20 years, using only the game's actions (expandFactory, addLine,
// upgradeAutomation, buildFactory, investDealers, takeLoan, repayLoan, setPrice, setMarketing, setEngineers) with their
// real costs, construction times and credit limits. Decisions are taken once a year (January) from what the player
// sees: last year's sales, stock, cash, debt and credit room, the price guide (value price, unit cost), the cost of
// a dealer network and its size against the segment on the Market screen. Nothing reads the future and nothing edits the game state directly.
//
// Commercial policy shared by every strategy (the 4E "reasonable" strategy): price at the value price for the supply
// (never below unit cost + 8 %), marketing 3 % of revenue, dealers in the home region grown by half a year while sales
// fall short of the line and each car earns a contribution, engineers trimmed to 25 once the car is on sale.
//
//   H   hold        — never adds capacity (the 4E B2 strategy).
//   S1  conservative — own funds only: when last year's sales used ≥ 90 % of the line, the plant grows by half (and is
//                      automated to the technology's limit) if cash covers the work, the tooling and a year of fixed
//                      costs. No borrowing.
//   S2  debt-funded progressive — at ≥ 85 % the plant doubles; any shortfall is borrowed (up to 80 % of the credit
//                      room); debt is repaid when cash exceeds six months of costs.
//   S3  ahead of demand — at launch the plant is enlarged to 5,000 a month and fully automated, borrowing what is
//                      needed; the dealer network is then bought to match the plant, not the sales.
//   S4  aggressive commercial + capacity — the 4E "aggressive" commercial policy (5 % under value, marketing 7 %,
//                      dealers in two regions) combined with S2's debt-funded expansion.
//
// Run: npx tsx scripts/audit-industrial-strategies.ts [out.json]
import * as fs from 'node:fs';
import { capitalOptions, newFounderGame, advanceMonth, player } from '../src/sim/world';
import * as A from '../src/sim/actions';
import { starterVehicle } from '../src/sim/engineering';
import { resolveDecision } from '../src/sim/events';
import { annualRevenue, creditLimit, factoryBuildCost, lineShareUsed } from '../src/sim/company';
import { equity } from '../src/sim/accounts';
import { priceGuide, DEALER_NET } from '../src/sim/pricing';
import { segVolume } from '../src/sim/market';
import { REGION_IDS, SEGMENTS } from '../src/data/world';
import { cpi } from '../src/sim/util';
import type { GameState, MonthLedger, RegionId } from '../src/sim/types';

export type Growth = 'H' | 'S1' | 'S2' | 'S3' | 'S4';
export interface Setup { year: number; product: 'mass' | 'sports' | 'luxury'; capital: number; factory: number; difficulty: 'normal' | 'hard'; country?: string; engineers?: number; seed?: number }
export interface YearRow { yr: number; capacity: number; units: number; revenue: number; operating: number; net: number; cash: number; debt: number; equity: number; capex: number; headroom: number; trouble: number; price: number; unitCost: number; reach: number; share: number; costs: Record<string, number> }
export interface Run { setup: Setup; growth: Growth; years: YearRow[]; bankrupt: boolean; bankruptYear: number | null; startEquity: number; capexTotal: number; maxDebt: number; minHeadroom: number; troubleMonths: number }

const worldVolume = (year: number) => REGION_IDS.reduce((a, r) => a + SEGMENTS.reduce((s, sd) => s + segVolume(r, sd.id, year), 0), 0);

export function grow(setup: Setup, growth: Growth, years = 20): Run {
  const { year, product } = setup;
  const g: GameState = newFounderGame({ name: 'T', country: setup.country ?? 'Germany', year, capital: capitalOptions(year)[setup.capital], specialization: product, factory: setup.factory, engineers: 1, research: 1, workforce: 1, color: '#1f5fbf', difficulty: setup.difficulty, historyMode: 'alternative', seed: setup.seed ?? 777 });
  const p = player(g);
  const seg = product === 'mass' ? 'budget' : product === 'sports' ? 'sports' : 'premium';
  A.startDevelopment(g, 'Alpha', starterVehicle(year, product), seg);
  const m = p.models[0];
  const step = () => { if (g.decision) resolveDecision(g, 0, g.rng); advanceMonth(g); };
  let n = 0; while (m.status === 'development' && n++ < 100 && !g.gameOver) step();
  const f = p.factories[0];
  const home = p.homeRegion as RegionId;
  const aggressive = growth === 'S4';
  const lineCap = () => p.factories.reduce((a, x) => a + x.capacity * (x.lines.find((l) => l.modelId === m.id)?.share ?? 0), 0);
  const plantCap = () => p.factories.reduce((a, x) => a + x.capacity + (x.expansion?.add ?? 0), 0);
  const sold12 = () => m.salesHistory.slice(-12).reduce((a, b) => a + b, 0);
  const L12 = () => p.ledger.slice(-12);
  const tot = (k: keyof MonthLedger, l = L12()) => l.reduce((a, x) => a + (x[k] as number), 0);
  const monthlyCosts = () => { const l = p.ledger.slice(-3); return l.length ? (tot('factoryFixed', l) + tot('wages', l) + tot('marketing', l) + tot('other', l) + Math.max(0, tot('interest', l))) / l.length : 0; };
  const room = () => Math.max(0, creditLimit(p, g.year) - p.debt);
  const borrowFor = (amount: number) => { const short = amount - p.cash; if (short > 0 && growth !== 'S1') A.takeLoan(g, Math.min(short, room() * 0.8)); };
  const tool = () => { // tool any free capacity of the plants for the car
    for (const x of p.factories) { const free = Math.floor(x.capacity * (1 - lineShareUsed(x))); if (free >= 10 && x.capacity > 0) { const cost = m.stats.toolingPerUnitCapacity * free; borrowFor(cost); A.addLine(g, x.id, m.id, free); } }
  };
  const expand = (add: number) => {
    if (f.expansion) return;
    const work = factoryBuildCost(add, f.automation, g.year) * 0.85, tooling = m.stats.toolingPerUnitCapacity * add;
    if (growth === 'S1' && p.cash < work + tooling + 12 * monthlyCosts()) return;
    borrowFor(work);
    A.expandFactory(g, f.id, Math.round(add));
  };
  const automate = () => {
    const to = A.maxAutomation(p);
    if (f.automation >= to - 1e-6 || f.capacity <= 0) return;
    const cost = A.automationCost(f.capacity, f.automation, to, g.year);
    if (growth === 'S1' && p.cash < cost + 12 * monthlyCosts()) return;
    borrowFor(cost);
    A.upgradeAutomation(g, f.id, to);
  };

  // ---- launch: line, engineers, and S3's plant ahead of demand
  if (!g.gameOver) {
    A.addLine(g, f.id, m.id, growth === 'S3' ? f.capacity : Math.max(10, Math.floor(f.capacity * (aggressive ? 1 : 0.3))));
    A.setEngineers(g, Math.min(p.engineers, setup.engineers ?? 25));
    if (growth === 'S3') { automate(); expand(5000 - f.capacity); }
  }
  const review = () => {
    if (g.gameOver) return;
    const guide = priceGuide(g, p, m, Math.max(1, lineCap()));
    const floor = (guide.unitCost / DEALER_NET) * (aggressive ? 1.03 : 1.08);
    A.setPrice(g, m.id, Math.max(guide.value * (aggressive ? 0.95 : 1), floor));
    const contribution = m.price * DEALER_NET - guide.unitCost;
    A.setMarketing(g, Math.max((aggressive ? 0.07 : 0.03) * annualRevenue(p) / 12, (aggressive ? 300e3 : 50e3) * cpi(g.year)));
    const sold = sold12(), capYr = lineCap() * 12;
    // capacity
    if (growth === 'H') {
      if (sold >= capYr * 0.85 && m.inventory < lineCap()) { const free = Math.floor(f.capacity * (1 - lineShareUsed(f))); if (free > 0) A.addLine(g, f.id, m.id, Math.min(free, Math.max(10, Math.floor(lineCap() * 0.5)))); }
    } else if (contribution > 0) {
      const used = capYr > 0 ? sold / capYr : 0;
      const freeInPlant = f.capacity * (1 - lineShareUsed(f));
      if (used >= (growth === 'S1' ? 0.9 : 0.85)) {
        if (freeInPlant >= 10) tool();
        else if (growth !== 'S3') { automate(); expand(growth === 'S1' ? f.capacity * 0.5 : f.capacity); }
      }
    }
    // dealers: home network grown while sales fall short of the line (S3: sized to the plant, not to the sales)
    if (contribution > 0) {
      const target = growth === 'S3' ? plantCap() * 12 : capYr;
      if (sold < target * 0.85) {
        const regions: RegionId[] = aggressive ? [home, home === 'NA' ? 'EU' : 'NA'] : [home];
        for (const r of regions) {
          // the Market screen shows the network against the market: past the size of the car's segment more dealers
          // add few buyers (playerCoverage), so no strategy buys beyond it
          if (p.reach[r] >= segVolume(r, seg, g.year)) continue;
          const setup0 = p.reach[r] <= 0 ? 5e6 * cpi(g.year) : 0;
          const growBy = Math.max(p.reach[r], 500) * (aggressive || growth === 'S3' ? 1 : 0.5);
          let amount = setup0 + growBy * A.dealerCostPerUnit(g, p, r);
          const cashCap = p.cash * (aggressive ? 0.25 : growth === 'S3' ? 0.25 : 0.08);
          if (growth === 'S3' || aggressive) borrowFor(Math.min(amount, cashCap + room() * 0.3));
          amount = Math.min(amount, Math.max(cashCap, growth === 'S3' || aggressive ? p.cash * 0.5 : 0));
          if (amount > setup0 + 1e5) A.investDealers(g, r, amount);
        }
      }
    }
    // pay debt back when cash is comfortable
    if (p.debt > 0 && p.cash > 6 * monthlyCosts()) A.repayLoan(g, Math.min(p.debt, p.cash - 6 * monthlyCosts()));
  };
  review();
  const startEquity = equity(p);
  const out: YearRow[] = [];
  let bankruptYear: number | null = null, maxDebt = 0, minHeadroom = Infinity, troubleMonths = 0;
  for (let i = 1; i <= years * 12; i++) {
    if (g.gameOver) { bankruptYear ??= Math.ceil((i - 1) / 12); break; }
    step();
    // a finished expansion is tooled straight away (the work was planned for it)
    if (!f.expansion && f.capacity * (1 - lineShareUsed(f)) >= 10 && growth !== 'H' && lineCap() > 0 && !g.gameOver) {
      const free = Math.floor(f.capacity * (1 - lineShareUsed(f)));
      const cost = m.stats.toolingPerUnitCapacity * free;
      if (growth !== 'S1' || p.cash > cost + 6 * monthlyCosts()) { borrowFor(cost); A.addLine(g, f.id, m.id, free); }
    }
    maxDebt = Math.max(maxDebt, p.debt); minHeadroom = Math.min(minHeadroom, creditLimit(p, g.year) - p.debt + p.cash); if (p.troubleMonths > 0) troubleMonths++;
    if (i % 12 === 0) {
      const l = L12();
      out.push({ yr: i / 12, capacity: plantCap(), units: sold12(), revenue: tot('revenue', l), operating: tot('profit', l) + tot('tax', l) + tot('interest', l) - tot('assetGains', l), net: tot('profit', l), cash: p.cash, debt: p.debt, equity: equity(p), capex: tot('capex', l), headroom: creditLimit(p, g.year) - p.debt, trouble: p.troubleMonths, price: m.price, unitCost: m.lastUnitCost, reach: REGION_IDS.reduce((a, r) => a + p.reach[r], 0), share: sold12() / worldVolume(g.year),
        costs: Object.fromEntries((['cogs', 'factoryFixed', 'wages', 'marketing', 'other', 'logistics', 'depreciation', 'interest', 'oneOff', 'dev'] as const).map((k) => [k, tot(k, l)])) });
      review();
    }
  }
  if (g.gameOver && bankruptYear === null) bankruptYear = Math.ceil(p.ledger.length / 12);
  return { setup, growth, years: out, bankrupt: !!g.gameOver, bankruptYear: g.gameOver ? bankruptYear : null, startEquity, capexTotal: out.reduce((a, y) => a + y.capex, 0), maxDebt, minHeadroom, troubleMonths };
}

if (process.argv[1]?.endsWith('audit-industrial-strategies.ts')) {
  const runs: Run[] = [];
  const M = (x: number) => (x / 1e6).toFixed(0);
  const log = (r: Run, label: string) => {
    const y10 = r.years[9], y20 = r.years[19];
    console.log(`${label} ${r.growth.padEnd(2)} ${r.bankrupt ? `BANKRUPT y${r.bankruptYear}` : 'alive'} | y10 cap ${y10?.capacity ?? '-'} units ${y10?.units ?? '-'} op ${y10 ? M(y10.operating) : '-'}M | y20 cap ${y20?.capacity ?? '-'} units ${y20?.units ?? '-'} op ${y20 ? M(y20.operating) : '-'}M cash ${y20 ? M(y20.cash) : '-'} debt ${y20 ? M(y20.debt) : '-'} equity ${y20 ? M(y20.equity) : '-'}M (start ${M(r.startEquity)}) capex ${M(r.capexTotal)}M maxDebt ${M(r.maxDebt)}M trouble ${r.troubleMonths}`);
  };
  // main grid: 600-a-month start, budget car and sports car, medium and large capital
  for (const product of ['mass', 'sports'] as const) for (const capital of [2, 3]) for (const difficulty of ['normal', 'hard'] as const) for (const growth of ['H', 'S1', 'S2', 'S3', 'S4'] as const) {
    const r = grow({ year: 2015, product, capital, factory: 2, difficulty }, growth); runs.push(r);
    log(r, `2015 ${product.padEnd(6)} cap${capital} ${difficulty.padEnd(6)}`);
  }
  // workshops: a 60-a-month plant with a sports or premium car, a 25- or 5-engineer team, kept small or grown
  for (const product of ['sports', 'luxury'] as const) for (const capital of [1, 2]) for (const engineers of [25, 5]) for (const difficulty of ['normal', 'hard'] as const) for (const growth of ['H', 'S1'] as const) {
    const r = grow({ year: 2015, product, capital, factory: 1, difficulty, engineers }, growth); runs.push(r);
    log(r, `workshop ${product.padEnd(6)} cap${capital} eng${String(engineers).padEnd(2)} ${difficulty.padEnd(6)}`);
  }
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(runs));
}
