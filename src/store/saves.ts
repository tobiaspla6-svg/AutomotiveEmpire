// Persistent local saves in IndexedDB (no backend). The SaveBackend interface is the seam where
// an optional cloud backend (e.g. Supabase) could be plugged in later; none is connected.
import type { GameState } from '../sim/types';
import { prepareLoadedGame } from '../sim/migrate';

export interface SaveMeta { slot: string; name: string; mode: string; year: number; month: number; savedAt: number; company: string; cash: number }
export interface SaveBackend {
  list(): Promise<SaveMeta[]>;
  load(slot: string): Promise<GameState | null>;
  save(slot: string, g: GameState): Promise<void>;
  remove(slot: string): Promise<void>;
}

const DB = 'automotive-empire', STORE = 'saves';
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB, 1);
    rq.onupgradeneeded = () => { rq.result.createObjectStore(STORE, { keyPath: 'slot' }); };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((res, rej) => {
    const t = db.transaction(STORE, mode);
    const rq = fn(t.objectStore(STORE));
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
    t.oncomplete = () => db.close();
  }));
}
const meta = (slot: string, g: GameState): SaveMeta => {
  const p = g.companies.find((c) => c.id === g.playerId);
  return { slot, name: g.name, mode: g.mode, year: g.year, month: g.month, savedAt: Date.now(), company: p?.name ?? '', cash: p?.cash ?? 0 };
};

export const localSaves: SaveBackend = {
  async list() { const all = await tx<{ slot: string; meta: SaveMeta }[]>('readonly', (s) => s.getAll()); return all.map((x) => x.meta).sort((a, b) => b.savedAt - a.savedAt); },
  async load(slot) { const r = await tx<{ game: GameState } | undefined>('readonly', (s) => s.get(slot)); return r?.game ?? null; },
  async save(slot, g) { g.savedAt = Date.now(); await tx('readwrite', (s) => s.put({ slot, meta: meta(slot, g), game: g })); },
  async remove(slot) { await tx('readwrite', (s) => s.delete(slot)); },
};

export function exportToFile(g: GameState) {
  const blob = new Blob([JSON.stringify(g)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${g.name.replace(/[^\w-]+/g, '_')}_${g.year}-${String(g.month).padStart(2, '0')}.aesave.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export async function importFromFile(file: File): Promise<GameState> {
  let raw: unknown;
  try { raw = JSON.parse(await file.text()); } catch { throw new Error('This file is not an Automotive Empire save.'); }
  return prepareLoadedGame(raw);
}
/** Load a slot and upgrade it to the current save format. Throws with a player-facing message. */
export async function loadSlot(slot: string): Promise<GameState> {
  const raw = await localSaves.load(slot);
  if (!raw) throw new Error('Save not found.');
  return prepareLoadedGame(raw);
}
