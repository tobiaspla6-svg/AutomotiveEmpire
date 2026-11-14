// Phase 4D audit: plays a whole founder game through the real action API and checks economic invariants every month.
// Run: npx tsx scripts/audit-playthrough.ts
import { capitalOptions, newFounderGame, advanceMonth, player } from '../src/sim/world';
import * as A from '../src/sim/actions';
import { defaultVehicle } from '../src/sim/engineering';
import { resolveDecision } from '../src/sim/events';
import { equity } from '../src/sim/accounts';
import { prepareLoadedGame } from '../src/sim/migrate';
import type { GameState, VehicleModel } from '../src/sim/types';

const M = (x: number) => (x / 1e6).toFixed(2) + 'M';
const issues: string[] = [];
const bad = (id: string, msg: string) => { issues.push(`${id}: ${msg}`); console.log('  ✗', id, msg); };
const ok = (msg: string) => console.log('  ✓', msg);
const expectErr = (id: string, r: string | null, why: string) => { if (r === null) bad(id, `accepted: ${why}`); else ok(`${id} refused (${r.slice(0, 70)})`); };

function nonFinite(root: unknown): string[] {
  const out: string[] = [], seen = new Set<unknown>();
  const walk = (v: unknown, p: string) => { if (out.length > 8) return; if (typeof v === 'number') { if (!Number.isFinite(v)) out.push(p); return; } if (!v || typeof v !== 'object' || seen.has(v)) return; seen.add(v); for (const [k, x] of Object.entries(v)) walk(x, `${p}.${k}`); };
  walk(root, '$'); return out;
}
function step(g: GameState, n = 1) {
  for (let i = 0; i < n && !g.gameOver; i++) {
    if (g.decision) resolveDecision(g, 0, g.rng);
    const p = player(g); const inv0 = p.models.reduce((a, m) => a + m.inventory, 0);
    advanceMonth(g);
    const L = p.ledger[p.ledger.length - 1], P = p.ledger[p.ledger.length - 2];
    const nf = nonFinite(g); if (nf.length) bad('NONFINITE', `${g.month}/${g.year} ${nf.join(', ')}`);
    // accounting identities on the ledger itself: Δequity = profit and Δcash = operating + investing + financing
    if (P && Math.abs(L.equity - P.equity - L.profit) > 1000) bad('EQUITY', `${g.month}/${g.year} Δequity ${M(L.equity - P.equity)} vs profit ${M(L.profit)}`);
    if (Math.abs(L.cash - L.cashStart - (L.operatingCash + L.investingCash + L.financingCash)) > 1000) bad('CASHFLOW', `${g.month}/${g.year}`);
    for (const m of p.models) {
      if (m.inventory < -1e-6) bad('NEGINV', `${m.name} ${m.inventory}`);
      if (m.inventory > 0 && !(m.inventoryValue > 0)) bad('INVVAL', `${m.name} inv ${m.inventory} value ${m.inventoryValue}`);
      if (m.inventory === 0 && Math.abs(m.inventoryValue) > 1) bad('INVVAL0', `${m.name} value ${m.inventoryValue} with no stock`);
    }
    if (p.cash < -1) bad('NEGCASH', `${g.month}/${g.year} ${M(p.cash)}`);
    void inv0;
    void equity;
  }
}
const sales12 = (m: VehicleModel) => m.salesHistory.slice(-12).reduce((a, b) => a + b, 0);

console.log('== 1. Found a company');
const year = 2000;
const g = newFounderGame({ name: 'Aurelia Motors', country: 'Germany', year, capital: capitalOptions(year)[3], specialization: 'mass', factory: 3, engineers: 2, research: 1, workforce: 1, color: '#1f5fbf', difficulty: 'normal', historyMode: 'alternative', seed: 12345 });
let p = player(g);
console.log(`  cash ${M(p.cash)} plants ${p.factories.length} (cap ${p.factories[0].capacity}) engineers ${p.engineers}`);

console.log('== 2. Design several cars');
const mk = (kind: 'sedan' | 'coupe' | 'hatch' | 'suv', f: (s: ReturnType<typeof defaultVehicle>) => void) => { const s = defaultVehicle(year, kind as never); f(s); return s; };
const designs: [string, string, any][] = [
  ['Aurelia Citi', 'budget', mk('hatch', (s) => { s.engine.displacement = 1400; })],
  ['Aurelia Sport', 'sports', mk('coupe', (s) => { s.engine.displacement = 2000; s.engine.aspiration = 'turbo'; s.engine.boost = 0.9; s.drive = 'RWD'; s.tireCompound = 'sport'; s.sport = 0.6; })],
  ['Aurelia Duke', 'luxury', mk('sedan', (s) => { s.engine.displacement = 3000; })],
];
for (const [n, seg, s] of designs) { const r = A.startDevelopment(g, n, s, seg as never); console.log(`  ${n}: ${r ?? 'approved'}`); if (r) bad('DESIGN', `${n} refused: ${r}`); }
expectErr('DESIGN-EMPTYNAME', A.startDevelopment(g, '   ', defaultVehicle(year, 'sedan'), 'budget'), 'empty name');
{ const s = defaultVehicle(year, 'sedan'); s.engine.displacement = 99999; expectErr('DESIGN-HUGEENGINE', A.startDevelopment(g, 'x', s, 'budget'), '99 L engine'); }
{ const s = defaultVehicle(year, 'sedan'); (s.engine as any).displacement = NaN; expectErr('DESIGN-NAN', A.startDevelopment(g, 'x', s, 'budget'), 'NaN displacement'); }
p = player(g);
console.log('  cash after approvals', M(p.cash), 'models', p.models.map((m) => m.name + ':' + m.status + '/' + m.devMonthsLeft).join(', '));
step(g, 1);
p = player(g);
console.log('  after 1 month cash', M(p.cash), 'dev spent', p.models.map((m) => M(m.devCostPaid)).join(' '));

console.log('== 3. Develop (cheapest first)');
let guard = 0; while (p.models.some((m) => m.status === 'development') && guard++ < 120 && !g.gameOver) step(g, 1);
console.log(`  months ${guard}, cash ${M(p.cash)} debt ${M(p.debt)} models ${p.models.map((m) => `${m.name}:${m.status}`).join(', ')} gameOver=${g.gameOver?.reason ?? 'no'}`);

console.log('== 4. Premature / exploit probes before production');
const f0 = p.factories[0]; const mod = p.models[0];
expectErr('LINE-OVERCAP', A.addLine(g, f0.id, mod.id, f0.capacity * 5), 'line bigger than the plant');
expectErr('LINE-NEG', A.addLine(g, f0.id, mod.id, -50), 'negative line');
expectErr('PRICE-ZERO', A.setPrice(g, mod.id, 0), 'price 0');
expectErr('PRICE-NAN', A.setPrice(g, mod.id, NaN), 'NaN price');
expectErr('LOAN-NEG', A.takeLoan(g, -1e6), 'negative loan');
expectErr('LOAN-HUGE', A.takeLoan(g, 1e12), 'loan beyond credit limit');
expectErr('REPAY-NEG', A.repayLoan(g, -5), 'negative repay');
expectErr('FACTORY-TINY', A.buildFactory(g, 'x', 'Germany', 5, 0.3), '5/month plant');
expectErr('FACTORY-AUTO', A.buildFactory(g, 'x', 'Germany', 100, 5), '500% automation');


console.log('== 5. Lines, prices, trims, suppliers');
const ready = p.models.filter((m) => m.status === 'ready' || m.status === 'production');
for (const m of ready) {
  const free = f0.capacity * (1 - f0.lines.reduce((a, l) => a + l.share, 0));
  const u = Math.floor(Math.min(free, f0.capacity / Math.max(1, ready.length)));
  const r = A.addLine(g, f0.id, m.id, u); console.log(`  line ${m.name} ${u}/mo: ${r ?? 'ok'}; price ${Math.round(m.price)}`);
  if (r) bad('LINE', `${m.name}: ${r}`);
  console.log('   trim:', A.addTrim(g, m.id, 'sport' as never) ?? 'ok', ' region price:', A.setRegionalPrice(g, m.id, 'EU', Math.round(m.price * 1.1)) ?? 'ok', ' cap:', A.setAnnualCap(g, m.id, 3000) ?? 'ok');
}
for (const cat of ['metals', 'electronics', 'tires', 'seats', 'glass', 'interior', 'transmissions', 'semiconductors'] as const) {
  const { SUPPLIERS } = await import('../src/data/suppliers');
  const s = SUPPLIERS.find((x: any) => x.category === cat && x.from <= g.year && (x.to === undefined || x.to >= g.year));
  if (s) { const r = A.signContract(g, cat, s.id, 200, 3); console.log(`  contract ${cat} ${s.name}: ${r ?? 'ok'}`); if (r) bad('SUPPLIER', `${cat}: ${r}`); }
}
console.log('  marketing', A.setMarketing(g, 400000) ?? 'ok', 'dealers', A.investDealers(g, 'EU', 20e6) ?? 'ok');

console.log('== 6. Run 3 years, report every 6 months');
for (let i = 0; i < 36 && !g.gameOver; i++) {
  step(g, 1);
  if (i % 6 === 5) { const L = p.ledger[p.ledger.length - 1]; console.log(`  ${g.month}/${g.year} cash ${M(p.cash)} debt ${M(p.debt)} units/mo ${Math.round(L.units)} rev ${M(L.revenue)} profit ${M(L.profit)} | ${p.models.filter((m) => m.status === 'production').map((m) => `${m.name} s12=${sales12(m)} inv=${Math.round(m.inventory)} $${Math.round(m.price)} uc=${Math.round(m.lastUnitCost)}`).join(' | ')}`); }
}
for (const m of p.models.filter((x) => x.status === 'production')) {
  const inLine = p.factories.some((f) => f.lines.some((l) => l.modelId === m.id));
  if (!inLine && m.salesHistory.slice(-3).some((x) => x > 0) && m.inventory <= 0) bad('SELL-NOCAPACITY', `${m.name} sells without a line or stock`);
  if (m.price < m.lastUnitCost && sales12(m) > 0) console.log(`  ! ${m.name} sells below unit cost ($${Math.round(m.price)} < $${Math.round(m.lastUnitCost)})`);
}

console.log('== 7. Research / finance / loans');
for (const a of ['engine', 'chassis', 'aero', 'electronics', 'manufacturing'] as const) A.setRd(g, a, 3e6);
const t0 = JSON.stringify(p.tech); step(g, 24); console.log('  tech before', t0, '\n  tech after ', JSON.stringify(p.tech)); if (t0 === JSON.stringify(p.tech)) bad('RESEARCH', '24 months of R&D at 3M/mo/area changed no technology level');
const d0 = p.debt, c0 = p.cash; console.log('  loan', A.takeLoan(g, 5e6) ?? 'ok', 'Δcash', M(p.cash - c0), 'Δdebt', M(p.debt - d0)); console.log('  repay', A.repayLoan(g, 5e6) ?? 'ok');
const cashLoop = p.cash; for (let i = 0; i < 20; i++) { A.takeLoan(g, 1e6); A.repayLoan(g, 1e6); } if (p.cash < cashLoop - 1) bad('LOANLOOP', `borrow/repay loop leaked ${M(cashLoop - p.cash)}`); else ok('borrow/repay loop is cash-neutral');

console.log('== 8. Factory second plant + build/sell arbitrage');
{ const before = p.cash; const r = A.buildFactory(g, 'Aurelia East', 'Mexico', 100, 0.3); console.log('  build', r ?? 'ok', 'cost', M(before - p.cash)); const nf = p.factories[p.factories.length - 1]; const eq0 = equity(p); const r2 = A.sellFactory(g, nf.id); console.log('  immediate sell', r2 ?? 'ok', 'cash back', M(p.cash - (before - (before - p.cash)))); void eq0;
  const loss = before - p.cash; console.log('  net round-trip loss', M(loss)); if (loss < 0) bad('FACTORY-ARB', 'build+sell makes money'); }
{ console.log('  build north', A.buildFactory(g, 'Aurelia North', 'Mexico', 200, 0.3)); const nf = p.factories[p.factories.length - 1]; const r = A.addLine(g, nf.id, p.models[0].id, 50); expectErr('LINE-CONSTRUCTION', r, 'line in a plant under construction'); step(g, 16); console.log('  plant capacity after 16 mo', nf.capacity); }

console.log('== 9. Rivals');
const rivals = g.companies.filter((c) => !c.isPlayer && c.alive);
console.log(`  ${rivals.length} rivals alive; sample:`, rivals.slice(0, 3).map((c) => `${c.name} ${Math.round(c.ledger.at(-1)?.units ?? 0)}/mo`).join(', '));
if (!rivals.length) bad('RIVALS', 'no rivals in a founder game');

console.log('== 10. Years of play (autopilot, reacting to the market)');
for (let i = 0; i < 96 && !g.gameOver; i++) { step(g, 1); if (p.cash < 2e6 && p.debt < 1e6) A.takeLoan(g, 3e6); }
console.log(`  ${g.month}/${g.year} cash ${M(p.cash)} debt ${M(p.debt)} gameOver=${g.gameOver?.reason ?? 'no'} models ${p.models.map((m) => m.name + ':' + m.status).join(', ')}`);

console.log('== 11. Save / load round trip');
const json = JSON.stringify(g); const g2 = prepareLoadedGame(JSON.parse(json)); const j2 = JSON.stringify(g2);
if (json !== j2) bad('SAVE', 'JSON round trip is not identical'); else ok('JSON round trip identical');
const a = JSON.parse(json), b = JSON.parse(JSON.stringify(g2));
const a1 = structuredClone(g); const A1 = JSON.stringify(a1);
step(g, 12); const g3 = prepareLoadedGame(JSON.parse(A1)); step(g3, 12);
if (JSON.stringify(g) !== JSON.stringify(g3)) bad('SAVE-DETERMINISM', 'a reloaded game diverges from the original after 12 months (rng not saved?)'); else ok('reloaded game continues identically for 12 months');
void a; void b;

console.log('\nISSUES:', issues.length); for (const i of issues) console.log(' -', i);
