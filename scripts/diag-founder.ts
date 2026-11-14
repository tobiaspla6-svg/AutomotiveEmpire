// Phase 4E diagnosis: why does a modern founder sell so little? Decomposes the player's demand in its home market cell
// (see the formula at the top of src/sim/market.ts) for founders of 1965, 1990 and 2015, with the audit's set-up
// (Germany, second capital level, small plant, one car) and the audit's basic strategy A.
// Run: npx tsx scripts/diag-founder.ts
import { capitalOptions, newFounderGame, advanceMonth, player } from '../src/sim/world';
import * as A from '../src/sim/actions';
import { defaultVehicle } from '../src/sim/engineering';
import { resolveDecision } from '../src/sim/events';
import { computeMarket, valuePrice, utilityOf, priceResponse, annualSupply, segVolume, tariff } from '../src/sim/market';
import { regionalPrice, regionalValue } from '../src/sim/regional';
import { priceGuide } from '../src/sim/pricing';
import { engineerCost } from '../src/sim/company';
import { cpi } from '../src/sim/util';
import { SEG } from '../src/data/world';
import type { Company, GameState, MonthLedger, VehicleModel } from '../src/sim/types';

const M = (x: number) => (x / 1e6).toFixed(1);
/** The appeal factors of `appeal()` in market.ts, one by one. */
function factors(g: GameState, c: Company, m: VehicleModel) {
  const r = 'EU' as const;
  const def = SEG[m.segment], s = m.stats.scores;
  const product = Math.exp(4 * (utilityOf(m, m.segment) - 0.5)) * (def.bodyFit[m.spec.body] ?? 0.3);
  const value = valuePrice(m, c, g.year, annualSupply(c, m));
  const ratio = (regionalPrice(g, m, r) * (1 + tariff(g, c, m, r))) / (value * regionalValue(g, r));
  const wP = def.weights.prestige ?? 0, wR = def.weights.reliability ?? 0;
  const age = m.launchYear ? g.year - m.launchYear + (g.month - m.launchMonth) / 12 : 0;
  return {
    product, priceRatio: ratio, price: priceResponse(m.segment, ratio),
    prestige: Math.pow(0.55 + (0.9 * c.prestige) / 100, wP * 3 + 0.3), reliab: Math.pow(0.7 + (0.6 * c.reliabilityRep) / 100, wR * 3 + 0.3),
    sporty: m.segment === 'sports' || m.segment === 'supercar' ? 0.7 + (0.6 * c.sportiness) / 100 : 1,
    age: Math.min(1.12, Math.max(0.55, 1.12 - 0.035 * age)), aware: 0.4 + (0.6 * c.awareness[r]) / 100, home: c.homeRegion === r ? 1.12 : 1, safety: s.safety < 25 ? 0.6 : 1,
  };
}
const fmt = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(' · ');

for (const sp of ['mass', 'sports'] as const) for (const year of [1965, 1990, 2015]) {
  const g = newFounderGame({ name: 'T', country: 'Germany', year, capital: capitalOptions(year)[2], specialization: sp, factory: 2, engineers: 1, research: 1, workforce: 1, color: '#1f5fbf', difficulty: 'normal', historyMode: 'alternative', seed: 777 });
  const p = player(g);
  const s = defaultVehicle(year, sp === 'mass' ? 'hatch' : 'coupe'); if (sp === 'sports') { s.engine.displacement = 2000; s.drive = 'RWD'; }
  const seg = sp === 'mass' ? 'budget' : 'sports';
  A.startDevelopment(g, 'Alpha', s, seg);
  const step = () => { if (g.decision) resolveDecision(g, 0, g.rng); advanceMonth(g); };
  const m = p.models[0];
  let dev = 0; while (m.status === 'development' && dev++ < 100) step();
  const f = p.factories[0];
  A.addLine(g, f.id, m.id, Math.floor(f.capacity * 0.8)); A.setMarketing(g, 150000);
  for (let i = 0; i < 24; i++) step();
  const mk = computeMarket(g);
  const cell = mk.cells[`EU:${seg}`];
  const mine = cell.entries.find((e) => e.company.isPlayer)!;
  const ai = cell.entries.filter((e) => !e.company.isPlayer);
  const aiD = ai.reduce((a, e) => a + e.D, 0), aiDq = ai.reduce((a, e) => a + e.D * e.q, 0);
  const qBar = aiDq / Math.max(1, aiD);
  const dOther = (g.otherShare[`EU:${seg}`] ?? 0.3) * segVolume('EU', seg, g.year);
  const top = [...ai].sort((a, b) => b.D * b.q - a.D * a.q)[0];
  const guide = priceGuide(g, p, m, f.capacity * 0.8);
  const L12 = p.ledger.slice(-12);
  const sum = (k: keyof MonthLedger) => L12.reduce((a, l) => a + (l[k] as number), 0);
  const sold12 = m.salesHistory.slice(-12).reduce((a, b) => a + b, 0);
  console.log(`\n== ${sp.toUpperCase()} founder ${year}  (capital $${M(capitalOptions(year)[2])}M, plant ${f.capacity}/mo, dev ${dev} mo, CPI ${cpi(year).toFixed(2)})`);
  console.log(`  EU ${seg} cell: ${Math.round(cell.volume * 12).toLocaleString()} cars/yr; AI distribution in cell ${Math.round(aiD).toLocaleString()} (+ other ${Math.round(dOther).toLocaleString()}); player reach EU ${Math.round(p.reach.EU)} = ${(100 * p.reach.EU / (aiD + dOther)).toFixed(3)}% of distribution`);
  console.log(`  appeal q: player ${mine.q.toFixed(3)} vs AI avg ${qBar.toFixed(3)} (ratio ${(mine.q / qBar).toFixed(2)}); player share ${(100 * mine.demand / cell.volume).toFixed(3)}% → ${Math.round(mine.demand * 12)} cars/yr (line ${Math.round(f.capacity * 0.8 * 12)}/yr)`);
  console.log(`  player: ${fmt(factors(g, p, m))}`);
  console.log(`  top AI (${top.company.name} ${top.model.name}): ${fmt(factors(g, top.company, top.model))}`);
  console.log(`  brand: prestige ${p.prestige.toFixed(0)} (top AI ${top.company.prestige.toFixed(0)}), reliability ${p.reliabilityRep.toFixed(0)} (${top.company.reliabilityRep.toFixed(0)}), awareness EU ${p.awareness.EU.toFixed(0)} (${top.company.awareness.EU.toFixed(0)})`);
  console.log(`  price: list $${Math.round(m.price)} · value $${Math.round(guide.value)} · recommended $${Math.round(guide.recommended)} · unit cost $${Math.round(m.lastUnitCost)} → margin/car after dealer $${Math.round(m.price * 0.88 - m.lastUnitCost)}`);
  console.log(`  last 12 mo: sold ${sold12}, revenue ${M(sum('revenue'))}M, cogs ${M(sum('cogs'))}, plant fixed ${M(sum('factoryFixed'))}, wages ${M(sum('wages'))} (${p.engineers} eng × $${Math.round(engineerCost(p, g.year) * 12 / 1000)}k), marketing ${M(sum('marketing'))}, dealer upkeep ${M(sum('other'))}, depreciation ${M(sum('depreciation'))}, interest ${M(-sum('interest'))} → profit ${M(sum('profit'))}M; cash ${M(p.cash)}M`);
  const per = A.dealerCostPerUnit(g, p, 'EU');
  console.log(`  dealers: $${Math.round(per)} per car/yr of reach (${(per / m.price * 100).toFixed(1)}% of list price) · fixed cost per car sold $${Math.round((sum('factoryFixed') + sum('wages') + sum('marketing') + sum('other')) / Math.max(1, sold12))}`);
}
