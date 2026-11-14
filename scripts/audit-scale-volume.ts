// Phase 4F: does a car get volume discounts on its parts for the cars it BUILDS, or for the capacity its line is TOOLED
// for? Two identical founder games, same car, same price, same dealers; one tools a line for 600 cars a month, the other
// for 3,000 in the same 5,000-a-month plant. Both are told to build exactly 400 a month (the line's production target).
// Run: npx tsx scripts/audit-scale-volume.ts
import { capitalOptions, newFounderGame, advanceMonth, player } from '../src/sim/world';
import * as A from '../src/sim/actions';
import { starterVehicle } from '../src/sim/engineering';
import { resolveDecision } from '../src/sim/events';
import type { MonthLedger } from '../src/sim/types';

export function scaleProbe(lineUnits: number, year = 2015) {
  const g = newFounderGame({ name: 'T', country: 'Germany', year, capital: capitalOptions(year)[3], specialization: 'mass', factory: 3, engineers: 1, research: 1, workforce: 1, color: '#fff', difficulty: 'normal', historyMode: 'alternative', seed: 31 });
  const p = player(g);
  A.startDevelopment(g, 'Probe', starterVehicle(year, 'mass'), 'budget');
  const m = p.models[0];
  const step = () => { if (g.decision) resolveDecision(g, 0, g.rng); advanceMonth(g); };
  while (m.status === 'development') step();
  const e = A.addLine(g, p.factories[0].id, m.id, lineUnits);
  if (e) throw new Error(e);
  A.setPrice(g, m.id, 15000); A.setEngineers(g, 25);
  A.setLineTarget(g, p.factories[0].id, m.id, 400); // both build exactly 400 a month
  const capex0 = p.ledger.reduce((a, l) => a + l.capex, 0);
  for (let i = 0; i < 36; i++) step();
  const L = p.ledger.slice(-12);
  const sum = (k: keyof MonthLedger) => L.reduce((a, l) => a + (l[k] as number), 0);
  return { lineUnits, built: sum('units'), unitCost: m.lastUnitCost, tooling: p.ledger.reduce((a, l) => a + l.capex, 0) - capex0, cogs: sum('cogs'), depreciation: sum('depreciation'), operating: sum('profit') + sum('tax') + sum('interest') - sum('assetGains') };
}

if (process.argv[1]?.endsWith('audit-scale-volume.ts')) {
  for (const u of [600, 3000]) {
    const r = scaleProbe(u);
    console.log(`line tooled for ${u}/month: sold ${Math.round(r.built)} cars in year 3, unit cost $${Math.round(r.unitCost)}, tooling paid $${(r.tooling / 1e6).toFixed(1)}M, cost of sales $${(r.cogs / 1e6).toFixed(1)}M, depreciation $${(r.depreciation / 1e6).toFixed(1)}M, operating $${(r.operating / 1e6).toFixed(1)}M`);
  }
}
