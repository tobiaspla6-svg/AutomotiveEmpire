// Phase 4E: the 36 founder set-ups of the Phase 4D sweep, each played with three commercial strategies.
//
//   A  basic (the 4D audit): one line at 80 % of the plant, the opening (recommended) price, $150k a month of marketing,
//      nothing else ever.
//   B  reasonable: price at the car's value price (never below unit cost + 8 %), sustainable marketing (3 % of revenue),
//      dealers bought in the home region only while each car earns a positive contribution and sales are limited by
//      demand (at most 8 % of cash a year), line sized to sales and grown when it sells out, an idle engineering team
//      trimmed to 25 once the car is on sale.
//   B2 the same commercial strategy as B, but starting from the design the studio now proposes for the speciality
//      (engineering.ts starterVehicle): shows what a product decision changes.
//   C  aggressive: price 5 % under value (never below unit cost + 3 %), marketing 7 % of revenue, dealers in the home
//      region and North America with up to 25 % of cash a year, the whole plant tooled, borrowing to keep two months of
//      costs in hand, engineers trimmed to 25.
//
// Every decision uses only what the player sees at that moment: the price guide of the Vehicles screen (value price,
// unit cost, recommended price), last year's sales, stock, cash and the dealer cost of the Market screen. No future
// information, no edits to the game state outside the action API.
//
// Run: npx tsx scripts/audit-founder-strategies.ts [out.json]   (≈10 minutes)
import * as fs from 'node:fs';
import { capitalOptions, newFounderGame, advanceMonth, player } from '../src/sim/world';
import * as A from '../src/sim/actions';
import { defaultVehicle, starterVehicle } from '../src/sim/engineering';
import { resolveDecision } from '../src/sim/events';
import { annualProfit, annualRevenue, lineShareUsed } from '../src/sim/company';
import { priceGuide, DEALER_NET } from '../src/sim/pricing';
import { segVolume } from '../src/sim/market';
import { REGION_IDS, SEGMENTS } from '../src/data/world';
import { cpi } from '../src/sim/util';
import type { GameState, MonthLedger, RegionId } from '../src/sim/types';

type Strat = 'A' | 'B' | 'C' | 'B2';
export interface Row {
  year: number; cap: number; sp: string; diff: string; strat: Strat;
  y5: Snap | null; y10: Snap | null; alive5: boolean; alive10: boolean; firstProfitYear: number | null; firstOperatingProfitYear: number | null; minCash: number; dealerSpend: number; startCash: number;
}
interface Snap { units: number; profit: number; operating: number; revenue: number; cash: number; debt: number; share: number; reach: number; price: number; unitCost: number; costs: Record<string, number> }

const worldVolume = (year: number) => REGION_IDS.reduce((a, r) => a + SEGMENTS.reduce((s, sd) => s + segVolume(r, sd.id, year), 0), 0);

export function play(year: number, cap: number, sp: 'mass' | 'sports', diff: 'normal' | 'hard', strat: Strat, seed = 777): Row {
  const g: GameState = newFounderGame({ name: 'T', country: 'Germany', year, capital: capitalOptions(year)[cap + 1], specialization: sp, factory: cap === 0 ? 1 : 2, engineers: 1, research: 1, workforce: 1, color: '#1f5fbf', difficulty: diff, historyMode: 'alternative', seed });
  const p = player(g);
  const startCash = p.cash;
  const s = strat === 'B2' ? starterVehicle(year, sp) : defaultVehicle(year, sp === 'mass' ? 'hatch' : 'coupe'); if (sp === 'sports' && strat !== 'B2') { s.engine.displacement = 2000; s.drive = 'RWD'; }
  A.startDevelopment(g, 'Alpha', s, sp === 'mass' ? 'budget' : 'sports');
  const step = () => { if (g.decision) resolveDecision(g, 0, g.rng); advanceMonth(g); };
  const m = p.models[0];
  let n = 0; while (m && m.status === 'development' && n++ < 100 && !g.gameOver) step();
  const f = p.factories[0];
  let dealerSpend = 0;
  const lineCap = () => f.capacity * (f.lines.find((l) => l.modelId === m.id)?.share ?? 0);
  const sold12 = () => m.salesHistory.slice(-12).reduce((a, b) => a + b, 0);
  const home = p.homeRegion as RegionId;

  // ---- launch
  if (!g.gameOver && f) {
    if (strat === 'A') { A.addLine(g, f.id, m.id, Math.floor(f.capacity * 0.8)); A.setMarketing(g, 150000); }
    else {
      A.addLine(g, f.id, m.id, strat === 'C' ? f.capacity : Math.max(10, Math.floor(f.capacity * 0.3)));
      A.setEngineers(g, 25);
    }
  }
  /** B and C: the yearly (and launch) commercial review. */
  const review = () => {
    if (strat === 'A' || g.gameOver) return;
    const guide = priceGuide(g, p, m, Math.max(1, lineCap()));
    const B = strat === 'B' || strat === 'B2';
    const floor = (guide.unitCost / DEALER_NET) * (B ? 1.08 : 1.03);
    A.setPrice(g, m.id, Math.max(guide.value * (B ? 1 : 0.95), floor));
    const contribution = m.price * DEALER_NET - guide.unitCost;
    const rev = annualRevenue(p);
    A.setMarketing(g, Math.max((B ? 0.03 : 0.07) * rev / 12, (B ? 50e3 : 300e3) * cpi(g.year)));
    const sold = sold12(), capYr = lineCap() * 12;
    // grow the line when it sells out
    if (sold >= capYr * 0.85 && m.inventory < lineCap()) { const free = Math.floor(f.capacity * (1 - lineShareUsed(f))); if (free > 0) A.addLine(g, f.id, m.id, Math.min(free, Math.max(10, Math.floor(lineCap() * 0.5)))); }
    // dealers: only when each car earns money and sales are demand-limited (not capacity-limited)
    if (contribution > 0 && sold < capYr * 0.85) {
      // grow the network by half (B) or double it (C) in a year, never by more than a share of the cash in hand —
      // the Market screen shows the reach each $ buys (dealerCostPerUnit)
      const cashCap = p.cash * (B ? 0.08 : 0.25);
      const regions: RegionId[] = B ? [home] : [home, home === 'NA' ? 'EU' : 'NA'];
      for (const r of regions) {
        const setup = p.reach[r] <= 0 ? 5e6 * cpi(g.year) : 0;
        const grow = Math.max(p.reach[r], 500) * (B ? 0.5 : 1);
        const amount = Math.min(cashCap / regions.length, setup + grow * A.dealerCostPerUnit(g, p, r));
        if (amount > setup + 1e5 && !A.investDealers(g, r, amount)) dealerSpend += amount;
      }
    }
  };
  review();
  let firstProfitYear: number | null = null, firstOperatingProfitYear: number | null = null, minCash = p.cash;
  let y5: Snap | null = null, y10: Snap | null = null, alive5 = false;
  const last12 = () => p.ledger.slice(-12);
  const tot = (k: keyof MonthLedger) => last12().reduce((a, l) => a + (l[k] as number), 0);
  const snap = (): Snap => ({ units: sold12(), profit: annualProfit(p), operating: tot('profit') + tot('tax') + tot('interest') - tot('assetGains'), revenue: annualRevenue(p), price: m.price, unitCost: m.lastUnitCost,
    costs: Object.fromEntries((['cogs', 'factoryFixed', 'wages', 'marketing', 'other', 'depreciation', 'interest', 'logistics', 'dev', 'rd', 'oneOff'] as const).map((k) => [k, tot(k)])), cash: p.cash, debt: p.debt, share: sold12() / worldVolume(g.year), reach: REGION_IDS.reduce((a, r) => a + p.reach[r], 0) });
  for (let i = 1; i <= 120 && !g.gameOver; i++) {
    step();
    if (strat === 'C' && p.cash < 2 * Math.abs(p.ledger.at(-1)?.profit ?? 0)) A.takeLoan(g, Math.abs(p.ledger.at(-1)?.profit ?? 0) * 2);
    minCash = Math.min(minCash, p.cash - p.debt);
    if (i % 12 === 0) {
      if (firstProfitYear === null && annualProfit(p) > 0) firstProfitYear = i / 12;
      if (firstOperatingProfitYear === null && tot('units') > 0 && tot('profit') + tot('tax') + tot('interest') - tot('assetGains') > 0) firstOperatingProfitYear = i / 12;
      if (i === 60) { y5 = snap(); alive5 = true; }
      if (i === 120) y10 = snap();
      review();
    }
  }
  return { year, cap, sp, diff, strat, y5, y10, alive5: alive5 && !(g.gameOver && !y5), alive10: !g.gameOver, firstProfitYear, firstOperatingProfitYear, minCash, dealerSpend, startCash };
}

if (process.argv[1]?.endsWith('audit-founder-strategies.ts')) {
  const out = process.argv[2];
  const rows: Row[] = [];
  for (const year of [1965, 1990, 2015]) for (const cap of [0, 1, 2]) for (const sp of ['mass', 'sports'] as const) for (const diff of ['normal', 'hard'] as const) for (const strat of (process.env.STRATS ?? 'A,B,C,B2').split(',') as Strat[]) {
    const r = play(year, cap, sp, diff, strat);
    rows.push(r);
    const s = r.y10 ?? r.y5;
    console.log(`${year} cap${cap} ${sp.padEnd(6)} ${diff.padEnd(6)} ${strat}: ${r.alive10 ? 'alive ' : 'BANKRUPT'} y5 units ${r.y5?.units ?? '-'} profit ${r.y5 ? (r.y5.profit / 1e6).toFixed(1) : '-'}M | y10 units ${r.y10?.units ?? '-'} profit ${r.y10 ? (r.y10.profit / 1e6).toFixed(1) : '-'}M (operating ${r.y10 ? (r.y10.operating / 1e6).toFixed(1) : '-'}M) cash ${s ? (s.cash / 1e6).toFixed(0) : '-'}M debt ${s ? (s.debt / 1e6).toFixed(0) : '-'}M share ${s ? (s.share * 100).toFixed(4) : '-'}% firstProfitYr ${r.firstProfitYear ?? '-'} dealers ${(r.dealerSpend / 1e6).toFixed(0)}M`);
  }
  if (out) fs.writeFileSync(out, JSON.stringify(rows, null, 1));
}
