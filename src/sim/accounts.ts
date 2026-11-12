// Company bookkeeping.
//
// Every cash movement is recorded once:
//   • inside the monthly tick (runPlayerMonth) for production, sales, overheads, interest, tax;
//   • through `spend` / `receive` / `post*` below for anything that happens between ticks
//     (player actions, events, prize money). Those move cash immediately and queue an entry in
//     `books.pending`, which the next tick merges into its ledger.
//
// Two identities hold for every month and are covered by tests/accounting.test.ts:
//   equity_end − equity_start = profit            (equity = cash + inventory + fixed assets − debt)
//   cash_end − cash_start     = operating + investing + financing
// where operating cash is derived indirectly: profit + depreciation − non-cash gains − Δinventory.
import type { Books, Company, MonthLedger, Pending, VehicleModel } from './types';

export const PLANT_DEPRECIATION = 0.05; // per year: plants, expansions, automation and tooling (~20-year life)
export const OTHER_DEPRECIATION = 0.1; // per year: dealer networks, racing facilities, goodwill (~10-year life)

export const emptyPending = (): Pending => ({ dev: 0, motorsport: 0, oneOff: 0, income: 0, writeOff: 0, capex: 0, proceeds: 0, acquiredCash: 0, assetGain: 0, borrow: 0, repay: 0 });

export const inventoryValue = (c: Company) => c.models.reduce((a, m) => a + (m.inventoryValue || 0), 0);
export const fixedAssets = (c: Company) => c.factories.reduce((a, f) => a + (f.bookValue || 0), 0) + (c.books?.otherAssets ?? 0);
export const equity = (c: Company) => c.cash + inventoryValue(c) + fixedAssets(c) - c.debt;
export const balances = (c: Company): Books['close'] => ({ cash: c.cash, debt: c.debt, inventoryValue: inventoryValue(c), fixedAssets: fixedAssets(c) });

/** Start the books from the company's current position (new game, or after migrating an old save). */
export function openBooks(c: Company, otherAssets = c.books?.otherAssets ?? 0) {
  c.books = { otherAssets, pending: c.books?.pending ?? emptyPending(), close: { cash: 0, debt: 0, inventoryValue: 0, fixedAssets: 0 } };
  c.books.close = balances(c);
}

/** Pay `amount` in cash; any shortfall is drawn on the credit line (recorded as borrowing). */
function payCash(c: Company, amount: number) {
  c.cash -= amount;
  if (c.cash < 0) { c.books.pending.borrow += -c.cash; c.debt += -c.cash; c.cash = 0; }
}

export type SpendKind = 'dev' | 'motorsport' | 'oneOff' | 'capex';
/** Check affordability against cash plus unused credit, then pay and record. Returns an error or null. */
export function spend(c: Company, amount: number, kind: SpendKind, creditRoom: number): string | null {
  if (!Number.isFinite(amount) || amount < 0) return 'Invalid amount.';
  if (amount > c.cash + Math.max(0, creditRoom)) return `Not enough funds: this costs $${(amount / 1e6).toFixed(1)}M.`;
  payCash(c, amount);
  c.books.pending[kind] += amount;
  return null;
}
/** An expense that must be paid regardless of funds (fines, settlements): overdraws onto debt. */
export function charge(c: Company, amount: number, kind: Exclude<SpendKind, 'capex'> = 'oneOff') {
  if (!Number.isFinite(amount) || amount <= 0) return;
  payCash(c, amount);
  c.books.pending[kind] += amount;
}
/** Cash income outside sales: grants, prize money, fleet clearance. */
export function receive(c: Company, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  c.cash += amount;
  c.books.pending.income += amount;
}
export function borrow(c: Company, amount: number) { c.debt += amount; c.cash += amount; c.books.pending.borrow += amount; }
export function repay(c: Company, amount: number) { c.debt -= amount; c.cash -= amount; c.books.pending.repay += amount; }
/** Sell an asset with book value `book` for `proceeds` (the difference is a gain or loss). */
export function dispose(c: Company, proceeds: number, book: number) {
  c.cash += proceeds;
  c.books.pending.proceeds += proceeds;
  c.books.pending.assetGain += proceeds - book;
}
/** Remove a model's remaining stock: sell it to fleet buyers for `proceeds`, writing off its book value. */
export function clearStock(c: Company, m: VehicleModel, proceeds: number) {
  c.books.pending.writeOff += m.inventoryValue;
  m.inventory = 0; m.inventoryValue = 0;
  for (const t of m.trims ?? []) { t.inventory = 0; t.inventoryValue = 0; }
  receive(c, proceeds);
}

/** Monthly depreciation of fixed assets. Returns the (non-cash) expense. */
export function depreciate(c: Company): number {
  let d = 0;
  for (const f of c.factories) { const x = f.bookValue * (PLANT_DEPRECIATION / 12); f.bookValue -= x; d += x; }
  const o = c.books.otherAssets * (OTHER_DEPRECIATION / 12);
  c.books.otherAssets -= o;
  return d + o;
}

/** Move the between-tick postings into this month's ledger and clear them. */
export function mergePending(c: Company, L: MonthLedger) {
  const p = c.books.pending;
  L.dev += p.dev; L.motorsport += p.motorsport; L.oneOff += p.oneOff + p.writeOff;
  L.otherIncome += p.income; L.assetGains += p.assetGain; L.capex += p.capex;
  L.investingCash += -p.capex + p.proceeds + p.acquiredCash;
  L.financingCash += p.borrow - p.repay;
  c.books.pending = emptyPending();
}

/** Fill the balance-sheet and indirect cash-flow lines and roll the closing balances forward. */
export function closeMonth(c: Company, L: MonthLedger) {
  const open = c.books.close;
  const now = balances(c);
  L.cashStart = open.cash;
  L.cash = now.cash; L.debt = now.debt; L.inventoryValue = now.inventoryValue; L.fixedAssets = now.fixedAssets;
  L.equity = now.cash + now.inventoryValue + now.fixedAssets - now.debt;
  L.operatingCash = L.profit + L.depreciation - L.assetGains - (now.inventoryValue - open.inventoryValue);
  c.books.close = now;
}
