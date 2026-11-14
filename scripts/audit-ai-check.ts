// Phase 4E: do the AI manufacturers still compete as before? Runs a 2015 and a 1965 founder game for 10 years with a fixed
// basic player and prints the rivals' combined sales, the five largest makers and how many are still in business.
// Run on two checkouts and compare.  npx tsx scripts/audit-ai-check.ts
import { capitalOptions, newFounderGame, advanceMonth } from '../src/sim/world';
import { resolveDecision } from '../src/sim/events';
for (const year of [1965, 2015]) {
  const g = newFounderGame({ name: 'T', country: 'Germany', year, capital: capitalOptions(year)[2], specialization: 'sports', factory: 2, engineers: 1, research: 1, workforce: 1, color: '#fff', difficulty: (process.env.DIFF as 'normal' | 'hard') ?? 'normal', historyMode: 'historical', seed: 99 });
  for (let i = 0; i < 120; i++) { if (g.decision) resolveDecision(g, 0, g.rng); advanceMonth(g); }
  const ai = g.companies.filter((c) => !c.isPlayer);
  const units = (c: typeof ai[number]) => c.ledger.slice(-12).reduce((a, l) => a + l.units, 0);
  const top = [...ai].filter((c) => c.alive).sort((a, b) => units(b) - units(a)).slice(0, 5);
  console.log(`${year}+10: ${ai.filter((c) => c.alive).length}/${ai.length} rivals trading, rivals' sales ${Math.round(ai.reduce((a, c) => a + (c.alive ? units(c) : 0), 0)).toLocaleString('en-US')}/yr; top 5: ${top.map((c) => `${c.name} ${Math.round(units(c) / 1000)}k`).join(', ')}`);
}
