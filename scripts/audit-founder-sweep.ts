// Phase 4D: can a sensible founder survive? Sweeps founder set-ups with a simple, reasonable strategy.
import { capitalOptions, newFounderGame, advanceMonth, player } from '../src/sim/world';
import * as A from '../src/sim/actions';
import { defaultVehicle } from '../src/sim/engineering';
import { resolveDecision } from '../src/sim/events';
import { annualProfit, annualUnits } from '../src/sim/company';
import { priceGuide } from '../src/sim/pricing';
const M = (x: number) => (x / 1e6).toFixed(0) + 'M';
const rows: string[] = [];
for (const year of [1965, 1990, 2015]) for (const cap of [0, 1, 2]) for (const sp of ['mass', 'sports'] as const) for (const diff of ['normal', 'hard'] as const) {
  const g = newFounderGame({ name: 'T', country: 'Germany', year, capital: capitalOptions(year)[cap + 1], specialization: sp, factory: cap === 0 ? 1 : 2, engineers: 1, research: 1, workforce: 1, color: '#1f5fbf', difficulty: diff, historyMode: 'alternative', seed: 777 });
  const p = player(g); const c0 = p.cash;
  const s = defaultVehicle(year, sp === 'mass' ? 'hatch' : 'coupe'); if (sp === 'sports') { s.engine.displacement = 2000; s.drive = 'RWD'; }
  const err = A.startDevelopment(g, 'Alpha', s, sp === 'mass' ? 'budget' : 'sports');
  let note = err ?? '';
  const step = () => { if (g.decision) resolveDecision(g, 0, g.rng); advanceMonth(g); };
  let n = 0; while (!err && p.models[0].status === 'development' && n++ < 100 && !g.gameOver) step();
  const m = p.models[0];
  if (!err && !g.gameOver) {
    const f = p.factories[0]; const units = Math.floor(f.capacity * 0.8);
    note += A.addLine(g, f.id, m.id, units) ?? '';
    A.setMarketing(g, 150000); 
  }
  let firstProfitYear = 0, minCash = p.cash;
  const sold: number[] = [];
  for (let i = 0; i < 120 && !g.gameOver; i++) { step(); minCash = Math.min(minCash, p.cash); if (i % 12 === 11) { sold.push(Math.round(annualUnits(p))); if (!firstProfitYear && annualProfit(p) > 0) firstProfitYear = i / 12 + 1; } }
  rows.push(`${year} cap${cap} ${sp} ${diff}: start ${M(c0)} devMonths ${n} → ${g.gameOver ? 'GAMEOVER y' + (g.year - year) : 'alive'} cash ${M(p.cash)} debt ${M(p.debt)} firstProfitYr ${firstProfitYear || '-'} units/yr ${sold.join('/')} ${note}`);
}
console.log(rows.join('\n'));
