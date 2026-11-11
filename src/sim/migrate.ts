// Save-game versioning. Every load path (IndexedDB slot, imported file, pasted text) goes through
// `prepareLoadedGame`, which validates the data and upgrades older saves in place.
//
//   v1 → v2  accounting rework: inventory carried as an asset, fixed-asset book values, cash-flow
//            and balance-sheet lines in the ledger, pending between-tick postings.
import type { Company, GameState, MonthLedger } from './types';
import { emptyLedger, factoryValue } from './company';
import { emptyPending, openBooks } from './accounts';

export const SAVE_VERSION = 2;

function migrateCompanyV1(g: GameState, c: Company) {
  const legacy = c as Company & { books?: Company['books'] };
  // stock built under v1 was expensed when built; carry it at its last unit cost from now on
  for (const m of c.models) if (typeof m.inventoryValue !== 'number' || !Number.isFinite(m.inventoryValue)) m.inventoryValue = Math.max(0, m.inventory) * (m.lastUnitCost || m.stats.partsCost);
  for (const f of c.factories) if (typeof f.bookValue !== 'number' || !Number.isFinite(f.bookValue)) f.bookValue = factoryValue(f, g.year);
  const template = emptyLedger(g) as unknown as Record<string, number>;
  for (const L of c.ledger as unknown as Record<string, number>[]) for (const k of Object.keys(template)) if (typeof L[k] !== 'number') L[k] = 0;
  for (const L of c.ledger as MonthLedger[]) { if (!L.equity) L.equity = L.cash - L.debt; }
  if (!legacy.books) legacy.books = { otherAssets: 0, pending: emptyPending(), close: { cash: 0, debt: 0, inventoryValue: 0, fixedAssets: 0 } };
  openBooks(c);
}

/** Validate and upgrade a parsed save. Throws an Error with a player-facing message. */
export function prepareLoadedGame(raw: unknown): GameState {
  const g = raw as GameState;
  if (!g || typeof g !== 'object' || !Array.isArray(g.companies) || !g.playerId || typeof g.year !== 'number' || !g.companies.some((c) => c.id === g.playerId)) {
    throw new Error('This is not an Automotive Empire save.');
  }
  const v = typeof g.version === 'number' ? g.version : 1;
  if (v > SAVE_VERSION) throw new Error(`This save comes from a newer version of the game (save format ${v}; this build reads up to ${SAVE_VERSION}).`);
  if (v < 2) for (const c of g.companies) migrateCompanyV1(g, c);
  g.version = SAVE_VERSION;
  return g;
}
