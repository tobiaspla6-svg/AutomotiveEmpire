import { pendingRound } from '../sim/racing/season';
// UI state. The GameState itself is a plain mutable object owned by the simulation; React is
// told to re-render by bumping `tick` after every mutation.
import { create } from 'zustand';
import type { GameState } from '../sim/types';
import { advanceMonth, player } from '../sim/world';
import { resolveDecision } from '../sim/events';
import { localSaves } from './saves';

export type Screen = 'menu' | 'setup-ceo' | 'setup-founder' | 'setup-motorsport' | 'game' | 'race';
interface Store {
  screen: Screen; game: GameState | null; tick: number; view: string; toast: { text: string; bad: boolean; id: number } | null; busy: boolean;
  confirm: { text: string; yes: () => void } | null; ask: (text: string, yes: () => void) => void; answer: (ok: boolean) => void;
  go: (s: Screen) => void; setView: (v: string) => void;
  start: (g: GameState) => void; quit: () => void;
  act: (fn: (g: GameState) => string | null | void, okText?: string) => boolean;
  advance: (months?: number, racesConfirmed?: boolean) => void; decide: (i: number) => void;
  notify: (text: string, bad?: boolean) => void; save: (slot?: string) => Promise<void>;
}
let toastId = 0;
/** Explicit player preference: let batch advances simulate race weekends on their own (off by default). */
export const autosimRaces = () => { try { return localStorage.getItem('ae.race.autosim') === '1'; } catch { return false; } };
const lang = () => { try { return localStorage.getItem('ae.lang') === 'es' ? 'es' : 'en'; } catch { return 'en'; } };
export const useStore = create<Store>((set, get) => ({
  screen: 'menu', game: null, tick: 0, view: 'hq2d', toast: null, busy: false, confirm: null,
  ask: (text, yes) => set({ confirm: { text, yes } }),
  answer: (ok) => { const c = get().confirm; set({ confirm: null }); if (ok && c) c.yes(); },
  go: (screen) => set({ screen }),
  setView: (view) => set({ view }),
  start: (game) => { const p = player(game); set({ game, screen: 'game', view: game.mode === 'motorsport' || (!p.factories.length && !p.models.length && p.motorsport) ? 'motorsport' : 'hq2d', tick: get().tick + 1 }); void get().save('autosave'); },
  quit: () => set({ game: null, screen: 'menu' }),
  notify: (text, bad = false) => { const id = ++toastId; set({ toast: { text, bad, id } }); setTimeout(() => { if (get().toast?.id === id) set({ toast: null }); }, 4200); },
  act: (fn, okText) => {
    const g = get().game; if (!g) return false;
    let err: string | null | void;
    try { err = fn(g); } catch (e) { err = `That action failed: ${(e as Error).message}`; console.error(e); }
    set({ tick: get().tick + 1 });
    if (typeof err === 'string') { get().notify(err, true); return false; }
    if (okText) get().notify(okText);
    return true;
  },
  advance: (months = 1, racesConfirmed = false) => {
    const g = get().game; if (!g || get().busy) return;
    // Audit AE-08: "+3 months" used to simulate every race weekend on the way without saying so. A batch now stops when
    // a race weekend comes up; if one is already waiting, the player is asked before it is simulated. The preference
    // "ae.race.autosim" = "1" (Settings) restores automatic simulation, chosen explicitly.
    const p0 = player(g), es = lang() === 'es';
    if (months > 1 && !racesConfirmed && !autosimRaces() && pendingRound(g, p0)) {
      const r = pendingRound(g, p0)!;
      get().ask(es ? `Hay un fin de semana de carrera pendiente (${r.name}). Si avanzás varios meses se simula automáticamente, junto con las demás carreras del período.\n\nAceptar: simular las carreras del período. Cancelar: volver para disputarla.` : `A race weekend is waiting (${r.name}). Advancing several months simulates it automatically, with the other races of the period.\n\nOK: simulate the races of the period. Cancel: go back and run it yourself.`, () => get().advance(months, true));
      return;
    }
    set({ busy: true });
    // let the "working" state paint before a potentially heavy tick (endurance races are simulated in full)
    setTimeout(() => {
      try {
        let stoppedForRace = false;
        for (let i = 0; i < months && !g.gameOver && !g.decision; i++) {
          if (i > 0 && !racesConfirmed && !autosimRaces() && pendingRound(g, player(g))) { stoppedForRace = true; break; }
          advanceMonth(g);
        }
        if (stoppedForRace) get().notify(es ? 'El avance se detuvo: hay un fin de semana de carrera. Disputalo o simulalo desde el aviso.' : 'Stopped: a race weekend is here. Run it or simulate it from the banner.');
        void get().save('autosave');
      } catch (e) {
        // never autosave a half-simulated month; the previous autosave is still intact
        console.error(e);
        get().notify(`The simulation hit an error and this month was not saved: ${(e as Error).message}. Load your last save to continue.`, true);
      } finally {
        set({ tick: get().tick + 1, busy: false });
      }
    }, 15);
  },
  decide: (i) => { const g = get().game; if (!g) return; resolveDecision(g, i, g.rng); set({ tick: get().tick + 1 }); },
  save: async (slot = 'autosave') => { const g = get().game; if (!g) return; try { await localSaves.save(slot, g); } catch (e) { get().notify('Could not write the save: ' + (e as Error).message, true); } },
}));
/** Subscribe a component to simulation changes and get the current game + player company. */
export function useGame() {
  const game = useStore((s) => s.game)!;
  useStore((s) => s.tick);
  return { g: game, p: player(game) };
}
