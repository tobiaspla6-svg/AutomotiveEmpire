// Player preferences that the game really applies: sound volume, interface scale, reduced motion, high contrast.
// Stored in this browser only (never in the save); applied to <html> at start-up and whenever they change.
export interface Prefs { master: number; effects: number; uiScale: number; reduceMotion: boolean; highContrast: boolean }
export const DEFAULT_PREFS: Prefs = { master: 80, effects: 90, uiScale: 100, reduceMotion: false, highContrast: false };
const KEY = 'ae.prefs';
const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);

export function loadPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>;
    return { master: clamp(raw.master, 0, 100, DEFAULT_PREFS.master), effects: clamp(raw.effects, 0, 100, DEFAULT_PREFS.effects), uiScale: clamp(raw.uiScale, 80, 130, 100), reduceMotion: raw.reduceMotion === true, highContrast: raw.highContrast === true };
  } catch { return { ...DEFAULT_PREFS }; }
}
export function savePrefs(p: Prefs) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ } applyPrefs(p); }
export function applyPrefs(p: Prefs = loadPrefs()) {
  if (typeof document === 'undefined') return;
  const h = document.documentElement;
  h.classList.toggle('reduce-motion', p.reduceMotion);
  h.classList.toggle('high-contrast', p.highContrast);
  h.style.setProperty('zoom', p.uiScale === 100 ? '' : String(p.uiScale / 100));
}
/** Sound effect gain 0..1 (master × effects). */
export const sfxGain = () => { const p = loadPrefs(); return (p.master / 100) * (p.effects / 100); };
