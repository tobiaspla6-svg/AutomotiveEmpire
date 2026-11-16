// Audit R-01: fuel retirements at the end of timed (GT) races, isolated with fixed seeds and no human input.
//   npx tsx scripts/audit/r01-gt-fuel.ts
// For each seed a GT team is created in 2015 and the first timed rounds are simulated with the strategists on
// automatic. Counted: cars that retired "out of fuel", and how many of those did so AFTER the nominal duration
// (i.e. on the way to the flag). The same table before and after a change shows what it did.
import { newMotorsportGame, player } from '../../src/sim/world';
import { buildRaceConfig } from '../../src/sim/racing/season';
import { RaceSim } from '../../src/sim/racing/race';

const seeds = [11, 22, 33, 44, 55, 66, 77, 88];
let races = 0, cars = 0, fuelOut = 0, fuelOutAfterTime = 0;
const rows: string[] = [];
for (const seed of seeds) {
  const g = newMotorsportGame({ makerId: null, teamName: 'R01 GT', discipline: 'gt', year: 2015, budget: 1, facilities: 3, staff: 65, target: 6, color: '#aa2222', color2: '#ffffff', difficulty: 'normal', historyMode: 'historical', seed });
  const c = player(g), div = c.motorsport!;
  for (let round = 0; round < 3 && round < div.championship.rounds.length; round++) {
    div.championship.nextRound = round;
    const cfg = buildRaceConfig(g, c, div);
    if (cfg.laps) continue;                               // only timed races
    const sim = new RaceSim(cfg);
    sim.runToEnd();
    const out = sim.cars.filter((x) => x.status === 'out' && x.outReason === 'out of fuel');
    const late = sim.log.filter((l) => /out of fuel/.test(l.text) && l.t >= cfg.duration).length;
    races++; cars += sim.cars.length; fuelOut += out.length; fuelOutAfterTime += late;
    rows.push(`seed ${seed} round ${round + 1} ${cfg.duration / 3600} h: ${sim.cars.length} cars, out of fuel ${out.length} (after the time limit: ${late}), flag at ${(sim.leaderFinishT / 60).toFixed(1)} min`);
  }
}
console.log(rows.join('\n'));
console.log(JSON.stringify({ races, cars, fuelOut, fuelOutAfterTime, sharePct: +((fuelOut / cars) * 100).toFixed(1) }));
