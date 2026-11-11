// Prints the engineering calibration table: every benchmark car as the game builds it against the
// published figures of the real car.   npx tsx scripts/benchmarks.ts [class]
import { BENCHMARKS, simulateBenchmark as simulate } from '../tests/benchmarks';

const only = process.argv[2];
const pct = (a: number, r: number) => `${a >= r ? '+' : ''}${(((a - r) / r) * 100).toFixed(0)}%`.padStart(5);
const err: Record<string, number[][]> = {};
console.log('car'.padEnd(34), 'power kW      mass kg        0-100 s        top km/h      | layout');
for (const bm of BENCHMARKS) {
  if (only && bm.cls !== only) continue;
  const { spec: s, st } = simulate(bm);
  (err[bm.cls] ??= []).push([st.powerKw / bm.kw - 1, st.mass / bm.kg - 1, st.zeroTo100 / bm.t100 - 1, bm.limited ? 0 : st.topSpeed / bm.top - 1]);
  console.log(
    `${bm.label.padEnd(30)} ${String(bm.year)} ${st.powerKw.toFixed(0).padStart(4)}/${String(bm.kw).padEnd(4)}${pct(st.powerKw, bm.kw)} ${st.mass.toFixed(0).padStart(5)}/${String(bm.kg).padEnd(5)}${pct(st.mass, bm.kg)} `
    + `${st.zeroTo100.toFixed(1).padStart(5)}/${String(bm.t100).padEnd(5)}${pct(st.zeroTo100, bm.t100)} ${st.topSpeed.toFixed(0).padStart(4)}/${String(bm.top).padEnd(4)}${bm.limited ? ' lim ' : pct(st.topSpeed, bm.top)} `
    + `| ${s.drive} ${s.enginePos} wf${st.weightFront.toFixed(2)} ${s.tireWidth}${s.tireCompound[0]}${s.tireCompound[1]} ${s.gearbox}${s.gears} fd${s.finalDrive.toFixed(2)} sz${s.size.toFixed(2)}`,
  );
}
console.log('\nmean absolute error by class (power, mass, 0-100, top speed of unlimited cars):');
for (const [cls, rows] of Object.entries(err)) {
  const mae = (i: number) => (rows.reduce((a, r) => a + Math.abs(r[i]), 0) / rows.length * 100).toFixed(1).padStart(5) + '%';
  const bias = (i: number) => ((rows.reduce((a, r) => a + r[i], 0) / rows.length) * 100).toFixed(0).padStart(4) + '%';
  console.log(`  ${cls.padEnd(11)} n=${String(rows.length).padEnd(3)} MAE ${mae(0)} ${mae(1)} ${mae(2)} ${mae(3)}   bias ${bias(0)} ${bias(1)} ${bias(2)} ${bias(3)}`);
}
