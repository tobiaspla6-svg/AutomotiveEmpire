// Long motorsport careers in several eras and categories: cash, debt and results per season.
//   npx tsx scripts/motorsport-finance.ts [--verbose]
import { motorsport, player } from '../tests/helpers';
import { playSeasons, type Bot } from '../tests/msbots';
import type { Discipline } from '../src/sim/types';

const verbose = process.argv.includes('--verbose');
const M = (x: number) => `${(x / 1e6).toFixed(1)}M`;
export const CASES: [Discipline, number, 0 | 1 | 2, Bot][] = [
  ['f1', 1986, 2, 'passive'], ['f1', 1986, 2, 'prudent'], ['f1', 2000, 2, 'prudent'], ['f1', 1970, 1, 'prudent'], ['f1', 1990, 0, 'prudent'], ['f1', 1990, 0, 'redesign'],
  ['hypercar', 2000, 2, 'prudent'], ['gt', 2000, 2, 'prudent'], ['gt', 2005, 0, 'redesign'], ['touring', 1988, 0, 'redesign'], ['touring', 1990, 2, 'prudent'], ['touring', 1988, 0, 'passive'],
];
for (const [d, y0, budget, bot] of CASES) {
  const g = motorsport({ discipline: d, year: y0, budget, staff: budget === 0 ? 55 : budget === 2 ? 80 : 65, facilities: budget === 0 ? 2 : budget === 2 ? 4 : 3, target: budget === 2 ? 4 : budget === 0 ? 9 : 6 });
  const rows = playSeasons(g, 22, bot);
  const peak = Math.max(...rows.map((r) => (r.cash - r.debt) / r.B));
  const low = Math.min(...rows.map((r) => (r.cash - r.debt) / r.B));
  console.log(`${d.padEnd(8)} ${y0} ${['privateer', 'midfield', 'front-runner'][budget].padEnd(12)} ${bot.padEnd(8)} ${rows.length} seasons ${g.gameOver ? `ENDED ${g.year}: ${g.gameOver.reason}` : 'still running'} | net cash per season budget: peak ${peak.toFixed(2)}, low ${low.toFixed(2)}, final ${((player(g).cash - player(g).debt) / rows[rows.length - 1].B).toFixed(2)} | positions ${rows.map((r) => r.pos).join(',')}`);
  if (verbose) for (const r of rows) console.log(`   ${r.year} B ${M(r.B)} income ${M(r.income)} cost ${M(r.cost)} owner ${M(r.owner)} sponsors ${M(r.sponsors)} cash ${M(r.cash)} debt ${M(r.debt)} P${r.pos}`);
}
