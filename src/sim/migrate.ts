// Save-game versioning. Every load path (IndexedDB slot, imported file, pasted text) goes through
// `prepareLoadedGame`, which validates the data and upgrades older saves in place.
//
//   v1 → v2  accounting rework: inventory carried as an asset, fixed-asset book values, cash-flow
//            and balance-sheet lines in the ledger, pending between-tick postings.
//   v2 → v3  shared engineering: the player's cars are grouped into engine families and platforms
//            (cars whose engines and structures are compatible share them). Nothing else changes;
//            the optional Phase 2 fields keep their defaults.
import type { Company, GameState, MonthLedger } from './types';
import { emptyLedger, factoryValue } from './company';
import { emptyPending, openBooks } from './accounts';
import { adoptFamilies } from './families';
import { REGION_IDS } from '../data/world';

export const SAVE_VERSION = 3;

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
  if (v < 3) for (const c of g.companies) if (c.isPlayer) adoptFamilies(g, c);
  g.version = SAVE_VERSION;
  const damage = saveDamage(g);
  if (damage) throw new Error(`This save is damaged and cannot be loaded safely (${damage}).`);
  return g;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const AREAS = ['engine', 'chassis', 'aero', 'electronics', 'manufacturing'] as const;
const hasNums = (o: unknown, keys: readonly string[]) => isObj(o) && keys.every((k) => isNum(o[k]));

/**
 * Structural check of a save that is already at the current version: everything the interface and the monthly tick
 * read without guarding. A save that fails is refused with a message instead of being loaded, because loading it
 * would blank the whole interface (and, once autosaved, make "Resume" fail every time). Returns what is wrong, or null.
 */
export function saveDamage(g: GameState): string | null {
  if (!isNum(g.year) || !Number.isInteger(g.month) || g.month < 1 || g.month > 12) return 'the date is missing';
  if (!isObj(g.rng) || !isNum(g.rng.s)) return 'the random-number state is missing';
  if (!isObj(g.macro) || !Array.isArray(g.macro.modifiers) || !hasNums(g.macro, ['fuelPrice', 'materialCost', 'interestBase', 'cycle'])) return 'the world economy is missing';
  for (const k of ['news', 'schedule', 'fired'] as const) if (!Array.isArray(g[k])) return `the ${k} list is missing`;
  if (!isObj(g.otherShare)) return 'the market shares are missing';
  for (const c of g.companies) {
    const who = `company "${String((c as { name?: unknown }).name ?? '?')}"`;
    if (!isObj(c) || typeof c.id !== 'string' || typeof c.name !== 'string') return 'a company record is malformed';
    if (!hasNums(c, ['cash', 'debt', 'interestRate', 'prestige', 'reliabilityRep', 'engineers'])) return `${who} has no finances`;
    if (!hasNums(c.reach, REGION_IDS) || !hasNums(c.awareness, REGION_IDS)) return `${who} has no market reach`;
    if (!hasNums(c.tech, AREAS) || !hasNums(c.rdBudget, AREAS)) return `${who} has no technology levels`;
    for (const k of ['ledger', 'models', 'factories'] as const) if (!Array.isArray(c[k])) return `${who} has no ${k}`;
    // Phase 5 is optional for old saves, but malformed chest state must never
    // crash the collection panel or silently invent paid/earned currency.
    if (c.arcade !== undefined) {
      const a = c.arcade;
      if (!isObj(a) || !Array.isArray(a.claimedMilestones) ||
          !a.claimedMilestones.every((n: unknown) => isNum(n) && n >= 0) ||
          !isObj(a.inventory) || !Object.values(a.inventory).every((n) => isNum(n) && n >= 0) ||
          !isObj(a.equipped) || !Object.values(a.equipped).every((id) => typeof id === 'string') ||
          !isNum(a.credits) || a.credits < 0) return `${who} has damaged collectibles`;
    }
    if (!isObj(c.books) || !isObj(c.books.pending) || !isObj(c.books.close)) return `${who} has no books`;
    for (const m of c.models) {
      if (!isObj(m) || typeof m.id !== 'string' || !isObj(m.spec) || !isObj(m.stats) || !isObj(m.stats.scores)) return `${who} has a vehicle without its specification`;
      if (!Array.isArray(m.salesHistory) || !isObj(m.lastSales)) return `${who} has a vehicle without a sales record`;
      if (m.trims !== undefined && !Array.isArray(m.trims)) return `${who} has malformed trims`;
    }
    for (const f of c.factories) if (!isObj(f) || !Array.isArray(f.lines) || !isNum(f.capacity)) return `${who} has a malformed plant`;
    if (c.isPlayer && c.board !== null && !(isObj(c.board) && Array.isArray(c.board.objectives))) return 'the board record is missing';
  }
  return null;
}
