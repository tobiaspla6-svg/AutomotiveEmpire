// Deterministic, serialisable pseudo-random numbers (mulberry32).
// Every random draw in the game goes through an Rng object whose single integer of
// state lives in the save file, so a given save + the same inputs always replays identically.
export interface Rng { s: number }

export function makeRng(seed: number): Rng { return { s: seed >>> 0 || 1 }; }

export function rnd(r: Rng): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rndRange = (r: Rng, lo: number, hi: number) => lo + (hi - lo) * rnd(r);
export const rndInt = (r: Rng, lo: number, hi: number) => Math.floor(rndRange(r, lo, hi + 1));
export const chance = (r: Rng, p: number) => rnd(r) < p;
export const pick = <T>(r: Rng, arr: readonly T[]): T => arr[Math.floor(rnd(r) * arr.length)];
/** Approximately normal(0,1) via sum of uniforms — cheap and bounded, good enough for lap-time noise. */
export const gauss = (r: Rng) => (rnd(r) + rnd(r) + rnd(r) + rnd(r) - 2) * 1.7320508;
export function hashStr(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function shuffle<T>(r: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd(r) * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
