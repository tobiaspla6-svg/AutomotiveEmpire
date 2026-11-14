// Phase 4D: fuzz the player action API on live games. Checks: no exceptions, finite numbers, every cash movement is booked,
// and an action that reports success actually changes the state.
import { newCeoGame, newMotorsportGame, advanceMonth, player } from '../src/sim/world';
import * as A from '../src/sim/actions';
import { resolveDecision } from '../src/sim/events';
import { makeRng, rnd } from '../src/sim/rng';
import { SUPPLIERS } from '../src/data/suppliers';
import { REGION_IDS } from '../src/data/world';
import { defaultVehicle } from '../src/sim/engineering';
import type { GameState } from '../src/sim/types';

const _r = makeRng(Number(process.argv[2] ?? 99)); const rng = () => rnd(_r);
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rng() * a.length)];
const num = () => pick([-1, 0, 0.5, 1, 7, 50, 333, 1e4, 3e5, 2e6, 4e7, 1e9, NaN, Infinity] as number[]);
const sane = () => pick([1, 5, 20, 100, 400, 1500, 5e4, 1e6, 1.5e7]);
const issues = new Map<string, string>();
const flag = (k: string, v: string) => { if (!issues.has(k)) { issues.set(k, v); console.log('  ✗', k, v); } };
const nonFinite = (root: unknown): string | null => { const seen = new Set<unknown>(); let out: string | null = null; const w = (v: unknown, p: string) => { if (out) return; if (typeof v === 'number') { if (!Number.isFinite(v)) out = p; return; } if (!v || typeof v !== 'object' || seen.has(v)) return; seen.add(v); for (const [k, x] of Object.entries(v)) w(x, `${p}.${k}`); }; w(root, '$'); return out; };
const snap = (g: GameState) => { const c = player(g); return JSON.stringify([c.cash, c.debt, c.factories, c.models.map((m) => [m.price, m.status, m.trims, m.annualCap, m.regional, m.orders, m.allocation]), c.supply, c.engineers, c.rdBudget, c.marketingBudget, c.reach, c.tech, c.motorsport, c.restructuring, g.companies.length, c.engines, c.platforms, c.models.map((m) => [m.facelift, m.trims?.length, m.status])]); };
const money = (g: GameState) => { const c = player(g), b = c.books.pending; return (c.cash - c.debt) + b.dev + b.motorsport + b.oneOff + b.capex - b.income - b.proceeds - b.acquiredCash; };

function ops(g: GameState): [string, () => string | null | void][] {
  const c = player(g);
  const m = () => pick(c.models), f = () => pick(c.factories);
  const cats = ['metals', 'electronics', 'semiconductors', 'tires', 'transmissions', 'seats', 'glass', 'interior'] as const;
  return [
    ['setPrice', () => c.models.length ? A.setPrice(g, m().id, pick([num(), sane()])) : null],
    ['addLine', () => c.factories.length && c.models.length ? A.addLine(g, f().id, m().id, pick([num(), sane()])) : null],
    ['removeLine', () => c.factories.length && c.models.length ? A.removeLine(g, f().id, m().id) : null],
    ['setLineTarget', () => c.factories.length && c.models.length ? A.setLineTarget(g, f().id, m().id, pick([num(), sane()])) : null],
    ['buildFactory', () => A.buildFactory(g, 'N', pick(['Germany', 'China', 'Mexico', 'Atlantis']), pick([num(), sane()]), pick([0, 0.3, 0.6, 0.9, 1.5, -1, NaN]))],
    ['expandFactory', () => c.factories.length ? A.expandFactory(g, f().id, pick([num(), sane()])) : null],
    ['upgradeAutomation', () => c.factories.length ? A.upgradeAutomation(g, f().id, pick([0, 0.3, 0.6, 0.9, 5, NaN])) : null],
    ['sellFactory', () => c.factories.length > 1 ? A.sellFactory(g, f().id) : null],
    ['setRd', () => A.setRd(g, pick(['engine', 'chassis', 'aero', 'electronics', 'manufacturing'] as const), pick([num(), sane()]))],
    ['setMarketing', () => A.setMarketing(g, pick([num(), sane()]))],
    ['setEngineers', () => A.setEngineers(g, pick([num(), 50, 300, 1000]))],
    ['restructure', () => A.startRestructuring(g)],
    ['signContract', () => { const cat = pick(cats); const s = SUPPLIERS.filter((x: any) => x.category === cat); return A.signContract(g, cat, pick(s).id, pick([num(), sane()]), pick([num(), 1, 3, 10]), rng() < 0.3 ? pick(s).id : undefined, pick([0.3, 0.5, 1, 0, NaN])); }],
    ['endContract', () => A.endContract(g, pick(cats))],
    ['buildInHouse', () => A.buildInHouse(g, pick(cats), pick([num(), sane()]))],
    ['safetyStock', () => A.setSafetyStock(g, pick([-1, 0, 1, 2, 3, NaN]))],
    ['expandStage', () => c.factories.length ? A.expandStage(g, f().id, pick(['press', 'body', 'paint', 'powertrain', 'assembly'] as any), pick([num(), sane()])) : null],
    ['inspection', () => c.factories.length ? A.setInspection(g, f().id, pick([-1, 0, 0.5, 1, 2, NaN])) : null],
    ['dealers', () => A.investDealers(g, pick(REGION_IDS), pick([num(), sane()]))],
    ['takeLoan', () => A.takeLoan(g, pick([num(), sane()]))],
    ['repayLoan', () => A.repayLoan(g, pick([num(), sane()]))],
    ['regional', () => c.models.length ? A.setRegionalPrice(g, m().id, pick(REGION_IDS), pick([null, num(), sane()])) : null],
    ['annualCap', () => c.models.length ? A.setAnnualCap(g, m().id, pick([null, num(), sane()])) : null],
    ['addTrim', () => c.models.length ? A.addTrim(g, m().id, pick(['entry', 'mid', 'premium', 'sport', 'luxury', 'performance', 'limited'] as any), pick([undefined, num(), sane()])) : null],
    ['removeTrim', () => { const x = m(); return x?.trims?.length ? A.removeTrim(g, x.id, pick(x.trims).id) : null; }],
    ['facelift', () => c.models.length ? A.startFacelift(g, m().id) : null],
    ['retire', () => c.models.length > 1 ? A.retireModel(g, m().id) : null],
    ['startDev', () => { const s = defaultVehicle(g.year, pick(['hatch', 'sedan', 'coupe', 'suv', 'pickup'] as const)); if (rng() < 0.4) s.engine.displacement = pick([800, 1600, 2500, 4000, 6500, num()]); return A.startDevelopment(g, 'F' + g.nextId, s, pick(['budget', 'family', 'premium', 'luxury', 'sports', 'suv', 'pickup'] as const)); }],
    ['cancelDev', () => c.models.length ? A.cancelDevelopment(g, m().id) : null],
    ['acquire', () => A.acquire(g, pick(g.companies).id)],
  ];
}

let totalOps = 0;
for (const [label, mkGame] of [
  ['CEO toyota 2000', () => newCeoGame({ makerId: 'toyota', year: 2000, difficulty: 'normal', historyMode: 'historical', seed: 5 })],
  ['CEO ferrari 1985', () => newCeoGame({ makerId: 'ferrari', year: 1985, difficulty: 'normal', historyMode: 'historical', seed: 6 })],
  ['CEO tesla 2018', () => newCeoGame({ makerId: 'tesla', year: 2018, difficulty: 'hard', historyMode: 'historical', seed: 7 })],
] as const) {
  console.log('==', label);
  const g = (mkGame as () => GameState)();
  for (let round = 0; round < 40 && !g.gameOver; round++) {
    const list = ops(g);
    for (let k = 0; k < 25; k++) {
      const [name, fn] = pick(list);
      const before = snap(g), m0 = money(g);
      let res: string | null | void;
      try { res = fn(); } catch (e) { flag(`THROW ${name}`, String((e as Error).stack?.split('\n').slice(0, 3).join(' | '))); continue; }
      totalOps++;
      const nf = nonFinite(g); if (nf) flag(`NONFINITE after ${name}`, nf);
      const dm = money(g) - m0;
      if (name !== 'acquire' /* takes over the target's debt as a non-cash liability: booked as goodwill, see accounts.ts */ && Math.abs(dm) > 1) flag(`UNBOOKED CASH ${name}`, `Δ${dm.toFixed(0)} (cash/debt moved without a ledger entry) [${label}]`);
      if ((res === null || res === undefined) && snap(g) === before && !['removeLine', 'sellFactory', 'retire', 'cancelDev', 'regional', 'annualCap', 'setLineTarget', 'setMarketing', 'setEngineers', 'setRd', 'inspection', 'safetyStock', 'removeTrim', 'setPrice'].includes(name) /* same-value sets and void actions are legitimately silent */) flag(`NOOP-SUCCESS ${name}`, `returned success but nothing changed [${label}]`);
    }
    for (let i = 0; i < 3 && !g.gameOver; i++) { if (g.decision) resolveDecision(g, 0, g.rng); advanceMonth(g); const nf = nonFinite(g); if (nf) flag('NONFINITE tick', nf); }
  }
  console.log(`  ${g.month}/${g.year} gameOver=${g.gameOver?.reason ?? 'no'}`);
}
console.log(`\nops ${totalOps}; distinct issues ${issues.size}`);
for (const [k, v] of issues) console.log(' -', k, v);
