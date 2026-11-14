// Phase 4E: turn docs/calibration-4e/{before,after}.json (from audit-founder-strategies.ts) into markdown tables.
// Run: npx tsx scripts/summarize-founder-sweep.ts > docs/calibration-4e/tables.md
import * as fs from 'node:fs';
import type { Row } from './audit-founder-strategies';

const load = (f: string): Row[] => JSON.parse(fs.readFileSync(`docs/calibration-4e/${f}.json`, 'utf8'));
const before = load('before'), after = load('after');
const med = (xs: number[]) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const M = (x: number) => (Number.isFinite(x) ? (x / 1e6).toFixed(1) : '—');
const N = (x: number) => (Number.isFinite(x) ? Math.round(x).toLocaleString('en-US') : '—');
const P = (x: number) => (Number.isFinite(x) ? (x * 100).toFixed(3) + '%' : '—');
const key = (r: Row) => `${r.year}|${r.cap}|${r.sp}|${r.diff}|${r.strat}`;
const out: string[] = [];
const STRAT_NAME: Record<string, string> = { A: 'A basic', B: 'B reasonable', B2: 'B2 reasonable + starter design', C: 'C aggressive' };

function eraTable(rows: Row[], title: string) {
  out.push(`### ${title}`, '', 'Six set-ups per cell (3 capital levels × 2 specialities). Medians over the set-ups that are still trading at that date; operating = profit before interest, tax and asset gains (it leaves out the interest earned on the founding capital).', '');
  out.push('| Era | Difficulty | Strategy | Alive 5 y | Alive 10 y | Units/yr y5 | Units/yr y10 | Operating y10 $M | Net profit y10 $M | Cash y10 $M | Debt y10 $M | World share y10 | First year with an operating profit |');
  out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const year of [1965, 1990, 2015]) for (const diff of ['normal', 'hard']) for (const strat of ['A', 'B', 'B2', 'C']) {
    const set = rows.filter((r) => r.year === year && r.diff === diff && r.strat === strat);
    if (!set.length) continue;
    const y5 = set.filter((r) => r.y5).map((r) => r.y5!), y10 = set.filter((r) => r.y10).map((r) => r.y10!);
    const fp = set.map((r) => r.firstOperatingProfitYear).filter((x): x is number => x !== null);
    out.push(`| ${year} | ${diff} | ${STRAT_NAME[strat]} | ${set.filter((r) => r.alive5).length}/6 | ${set.filter((r) => r.alive10).length}/6 | ${N(med(y5.map((s) => s.units)))} | ${N(med(y10.map((s) => s.units)))} | ${M(med(y10.map((s) => s.operating)))} | ${M(med(y10.map((s) => s.profit)))} | ${M(med(y10.map((s) => s.cash)))} | ${M(med(y10.map((s) => s.debt)))} | ${P(med(y10.map((s) => s.share)))} | ${fp.length ? `${fp.length}/6, median yr ${med(fp)}` : 'none'} |`);
  }
  out.push('');
}

function strategyComparison(rows: Row[], label: string) {
  const by = new Map(rows.map((r) => [key(r), r]));
  let bBeatsA = 0, n = 0, bSurvives = 0, aSurvives = 0, cWorse = 0;
  for (const r of rows.filter((x) => x.strat === 'A')) {
    const b = by.get(key({ ...r, strat: 'B' })), c = by.get(key({ ...r, strat: 'C' }));
    if (!b) continue; n++;
    const opA = r.y10?.operating ?? -Infinity, opB = b.y10?.operating ?? -Infinity, opC = c?.y10?.operating ?? -Infinity;
    if (opB > opA) bBeatsA++;
    if (b.alive10) bSurvives++; if (r.alive10) aSurvives++;
    if (opC < opB) cWorse++;
  }
  out.push(`- ${label}: B has the better 10-year operating result than A in **${bBeatsA}/${n}** set-ups; survival A ${aSurvives}/${n}, B ${bSurvives}/${n}; aggressive C does worse than B in ${cWorse}/${n} (it buys growth at a price).`);
}

function difficultyComparison(rows: Row[], label: string) {
  const by = new Map(rows.map((r) => [key(r), r]));
  let harder = 0, same = 0, easier = 0;
  const gaps: number[] = [], worth: number[] = [];
  for (const r of rows.filter((x) => x.diff === 'normal' && x.strat !== 'A')) {
    const h = by.get(key({ ...r, diff: 'hard' })); if (!h) continue;
    const on = r.y10?.operating ?? (r.y5 ? r.y5.operating : -1e12), oh = h.y10?.operating ?? (h.y5 ? h.y5.operating : -1e12);
    const un = r.y10?.units ?? 0, uh = h.y10?.units ?? 0;
    if (oh < on - 1e5 || uh < un - 1 || (r.alive10 && !h.alive10)) harder++; else if (Math.abs(oh - on) <= 1e5 && uh === un) same++; else easier++;
    if (Number.isFinite(on) && Number.isFinite(oh) && r.y10 && h.y10) { gaps.push(oh - on); worth.push((h.y10.cash - h.y10.debt) - (r.y10.cash - r.y10.debt)); }
  }
  let slower = 0, faster = 0, pairs = 0;
  for (const r of rows.filter((x) => x.diff === 'normal')) {
    const h = by.get(key({ ...r, diff: 'hard' })); if (!h || !r.y5) continue; pairs++;
    const un = r.y5.units, uh = h.y5?.units ?? 0;
    if (uh < un) slower++; else if (uh > un) faster++;
  }
  out.push(`- ${label}: cars sold in year 5, hard vs normal (all strategies): fewer on hard in **${slower}/${pairs}** pairs, more in ${faster}.`);
  out.push(`- ${label}: with strategies that invest (B, B2, C), hard is harder than normal (lower operating result, fewer cars or bankrupt where normal survives) in **${harder}** pairs, identical in ${same}, easier in ${easier}; median operating gap hard − normal ${M(med(gaps))} $M/yr, median gap in cash minus debt after 10 years ${M(med(worth))} $M.`);
}

out.push('# Founder sweep — tables', '', 'Generated by `scripts/summarize-founder-sweep.ts` from `before.json` (code at `phase4d-gameplay-audit`, commit cd1cdbf) and `after.json` (this branch). Each row of the JSON is one 10-year game; the strategies are described at the top of `scripts/audit-founder-strategies.ts`.', '');
out.push('## Summary', '');
strategyComparison(before, 'Before');
strategyComparison(after, 'After');
difficultyComparison(before, 'Before');
difficultyComparison(after, 'After');
// normal-difficulty games must be identical before and after for A, B, C: the calibration changed nothing on normal
const bk = new Map(before.map((r) => [key(r), r]));
const changedNormal = after.filter((r) => r.diff === 'normal' && r.strat !== 'B2' && JSON.stringify(bk.get(key(r))) !== JSON.stringify(r)).length;
out.push(`- Normal difficulty, strategies A/B/C: ${changedNormal} of ${after.filter((r) => r.diff === 'normal' && r.strat !== 'B2').length} games differ between before and after (0 = the simulation is unchanged on normal).`);
out.push('');
eraTable(before, 'Before (phase4d-gameplay-audit)');
eraTable(after, 'After (this branch)');

out.push('### Every set-up, 10 years, after', '', '| Era | Capital | Speciality | Difficulty | Strategy | Alive | Units y5 | Units y10 | Operating y10 $M | Net y10 $M | Cash $M | Debt $M | Share y10 | Dealers bought $M |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of after) {
  const s = r.y10 ?? r.y5;
  out.push(`| ${r.year} | ${['small', 'medium', 'large'][r.cap]} | ${r.sp} | ${r.diff} | ${r.strat} | ${r.alive10 ? 'yes' : r.alive5 ? 'to 5 y' : 'no'} | ${N(r.y5?.units ?? NaN)} | ${N(r.y10?.units ?? NaN)} | ${M(r.y10?.operating ?? NaN)} | ${M(r.y10?.profit ?? NaN)} | ${M(s?.cash ?? NaN)} | ${M(s?.debt ?? NaN)} | ${P(r.y10?.share ?? NaN)} | ${M(r.dealerSpend)} |`);
}
console.log(out.join('\n'));
