// Shared fixtures for the simulation tests. Every game is created with a fixed seed so the
// whole run is reproducible.
import { capitalOptions, newCeoGame, newFounderGame, newMotorsportGame, advanceMonth, player, type CeoSetup, type FounderSetup, type MotorsportSetup } from '../src/sim/world';
import { resolveDecision } from '../src/sim/events';
import type { GameState } from '../src/sim/types';

export const SEED = 0x5eed1234;

export const ceo = (o: Partial<CeoSetup> = {}): GameState =>
  newCeoGame({ makerId: 'ferrari', year: 1985, difficulty: 'normal', historyMode: 'historical', seed: SEED, ...o });

export const founder = (o: Partial<FounderSetup> = {}): GameState => {
  const year = o.year ?? 2000;
  return newFounderGame({
    name: 'Test Motors', country: 'Germany', year, capital: capitalOptions(year)[3], specialization: 'mass', factory: 3, engineers: 2, research: 1, workforce: 1,
    color: '#1f5fbf', difficulty: 'easy', historyMode: 'historical', seed: SEED, ...o,
  });
};

export const motorsport = (o: Partial<MotorsportSetup> = {}): GameState =>
  newMotorsportGame({
    makerId: null, teamName: 'Test Racing', discipline: 'f1', year: 2010, budget: 1, facilities: 3, staff: 70, target: 5,
    color: '#aa2222', color2: '#ffffff', difficulty: 'normal', historyMode: 'historical', seed: SEED, ...o,
  });

/** Advance one month, answering any pending decision with its first option (deterministic). */
export function step(g: GameState, months = 1) {
  for (let i = 0; i < months && !g.gameOver; i++) {
    if (g.decision) resolveDecision(g, 0, g.rng);
    advanceMonth(g);
  }
}

/** Every number reachable from `root` must be finite. Returns the paths of offending values. */
export function nonFinitePaths(root: unknown, limit = 20): string[] {
  const out: string[] = [];
  const seen = new Set<unknown>();
  const walk = (v: unknown, path: string) => {
    if (out.length >= limit) return;
    if (typeof v === 'number') { if (!Number.isFinite(v)) out.push(`${path} = ${v}`); return; }
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (ArrayBuffer.isView(v)) return;
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(x, `${path}.${k}`);
  };
  walk(root, '$');
  return out;
}

export { player };
