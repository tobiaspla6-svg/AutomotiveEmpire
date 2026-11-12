// Decision impact forecasts (Phase 2).
//
// To estimate what a decision does, the game applies it to a copy of the world and plays that copy
// and an untouched copy forward for a few months from the same random state, then compares them.
// The difference is the decision's effect through the real simulation (costs, depreciation, interest,
// demand, capacity), not a separate rule of thumb. It is an ESTIMATE: the future the copies play out is
// one possible future, and anything decided later changes it.
import type { Company, GameState } from './types';
import { advanceMonth, player } from './world';
import { creditLimit } from './company';
import { equity } from './accounts';

export interface Snapshot { cash: number; debt: number; headroom: number; equity: number; monthlyProfit: number; monthlyCash: number; units: number }
export interface Impact {
  /** the action's own error message, if it would be refused */
  error: string | null;
  /** cash paid (or borrowed) immediately */
  upfront: number;
  /** steady monthly effect on profit and on cash once the first months are past (negative = cost) */
  monthlyProfit: number; monthlyCash: number;
  /** cumulative effect on net cash (cash − debt) after the horizon */
  netCash: number;
  horizon: number;
  before: Snapshot; after: Snapshot;
  risks: string[];
}

const clone = (g: GameState): GameState => JSON.parse(JSON.stringify(g));

function snap(c: Company, g: GameState): Snapshot {
  const L = c.ledger.slice(-3);
  const n = Math.max(1, L.length);
  return {
    cash: c.cash, debt: c.debt, headroom: creditLimit(c, g.year) - c.debt, equity: equity(c),
    monthlyProfit: L.reduce((a, l) => a + l.profit, 0) / n, monthlyCash: L.reduce((a, l) => a + (l.cash - l.cashStart), 0) / n,
    units: L.reduce((a, l) => a + l.units, 0) / n,
  };
}
function play(g: GameState, months: number) {
  for (let i = 0; i < months && !g.gameOver; i++) {
    g.decision = null; // decisions in the copies are left unanswered: both copies skip them alike
    advanceMonth(g);
  }
}

/** Estimate the impact of `action` (any function that mutates a game and returns an error string or null). */
export function forecast(g: GameState, action: (g: GameState) => string | null | void, horizon = 6): Impact {
  const base = clone(g), test = clone(g);
  const p0 = player(test);
  const cash0 = p0.cash - p0.debt;
  const liquidity0 = p0.cash + Math.max(0, creditLimit(p0, test.year) - p0.debt);
  const err = action(test) ?? null;
  if (typeof err === 'string') {
    const s = snap(player(g), g);
    return { error: err, upfront: 0, monthlyProfit: 0, monthlyCash: 0, netCash: 0, horizon, before: s, after: s, risks: [] };
  }
  const upfront = cash0 - (p0.cash - p0.debt);
  play(base, horizon); play(test, horizon);
  const b = player(base), t = player(test);
  const before = snap(b, base), after = snap(t, test);
  const risks: string[] = [];
  if (after.headroom < 0) risks.push('Debt would exceed the credit limit: lenders refuse more credit, and insolvency follows if it lasts.');
  else if (after.headroom < Math.max(5e6, Math.abs(after.monthlyCash) * 6) && after.monthlyCash < 0) risks.push(`Credit headroom would cover only about ${Math.max(0, Math.floor(after.headroom / Math.max(1, -after.monthlyCash)))} months of the projected cash burn.`);
  if (upfront > 0.6 * liquidity0) risks.push(`Uses ${Math.round((upfront / Math.max(1, liquidity0)) * 100)}% of the company's liquidity (cash plus unused credit): a few weak months could turn into a cash crisis.`);
  if (test.gameOver && !base.gameOver) risks.push(`In this projection the company does not survive: ${test.gameOver.reason}`);
  if (after.monthlyProfit < 0 && before.monthlyProfit >= 0) risks.push('The company would turn loss-making.');
  return {
    error: null, upfront, horizon, before, after, risks,
    monthlyProfit: after.monthlyProfit - before.monthlyProfit, monthlyCash: after.monthlyCash - before.monthlyCash,
    netCash: (t.cash - t.debt) - (b.cash - b.debt),
  };
}
