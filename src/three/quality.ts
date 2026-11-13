// Graphics quality presets. Stored per browser; every 3D view reads the same setting.
//
// The player's preference is Automatic (default: chosen from the detected hardware, never High), Low, Medium, High
// or Off (no 3D at all). `useQuality()` gives the preset actually in force for a view that is being drawn.
import { useSyncExternalStore } from 'react';
import { detectHardware, onWebglFailure, recommendQuality, webglFailed, type HardwareInfo } from './hardware';

export type Quality = 'low' | 'medium' | 'high';
export type QualityPref = 'auto' | Quality | 'off';

export interface QualitySettings {
  /** device-pixel-ratio range for the canvas */
  dpr: [number, number];
  /** asset level of detail (0 = most detailed) */
  lod: number;
  /** studio environment map resolution (cube face size) */
  envRes: number;
  shadows: 'none' | 'contact' | 'soft';
  shadowRes: number;
  /** tyre lathe segments */
  tireSegments: number;
  antialias: boolean;
  /** light the studio with the HDR photograph (otherwise generated light panels; no download) */
  hdr: boolean;
  /** physically transmissive glass and lamp lenses (an extra render pass) */
  transmission: boolean;
}

export const QUALITY: Record<Quality, QualitySettings> = {
  low: { dpr: [0.75, 1], lod: 2, envRes: 128, shadows: 'none', shadowRes: 256, tireSegments: 48, antialias: false, hdr: false, transmission: false },
  medium: { dpr: [1, 1.5], lod: 1, envRes: 256, shadows: 'contact', shadowRes: 512, tireSegments: 72, antialias: true, hdr: true, transmission: false },
  high: { dpr: [1, 2], lod: 0, envRes: 512, shadows: 'soft', shadowRes: 1024, tireSegments: 96, antialias: true, hdr: true, transmission: true },
};
export const QUALITY_NAME: Record<Quality, string> = { low: 'Low', medium: 'Medium', high: 'High' };

const KEY = 'ae.graphics.quality';
const PREFS: QualityPref[] = ['auto', 'low', 'medium', 'high', 'off'];
function read(): QualityPref {
  try {
    const v = globalThis.localStorage?.getItem(KEY) as QualityPref | null;
    if (v && PREFS.includes(v)) return v;
  } catch { /* storage blocked: use the default */ }
  return 'auto';
}
let pref: QualityPref = read();
const listeners = new Set<() => void>();
let version = 0; // bumped on every change (preference or a WebGL failure) so subscribed views re-render
const emit = () => { version++; for (const l of listeners) l(); };
onWebglFailure(emit);
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

export function setQualityPref(q: QualityPref) {
  pref = q;
  try { globalThis.localStorage?.setItem(KEY, q); } catch { /* not persisted */ }
  emit();
}
/** Pick a concrete preset (used by the viewer's quality menu). */
export const setQuality = (q: Quality) => setQualityPref(q);
export const getQualityPref = () => pref;

/** The preset in force: the preference, resolved against the hardware. 'off' when 3D is unavailable or unwanted. */
export function resolveQuality(p: QualityPref, hw: HardwareInfo, failed = false): Quality | 'off' {
  if (failed || hw.webgl === 'none' || p === 'off') return 'off';
  if (p === 'auto') return recommendQuality(hw);
  return p;
}
export const effectiveQuality = (): Quality | 'off' => resolveQuality(pref, detectHardware(), webglFailed());
export const getQuality = (): Quality => { const q = effectiveQuality(); return q === 'off' ? 'low' : q; };

/** The preset for a view that is drawing (never 'off' — views are not mounted when 3D is off). */
export function useQuality(): [Quality, QualitySettings] {
  useSyncExternalStore(subscribe, () => version, () => version);
  const q = getQuality();
  return [q, QUALITY[q]];
}
/** Whether 3D views should be drawn at all, plus the player's raw preference and the detected hardware. */
export function useGraphics() {
  useSyncExternalStore(subscribe, () => version, () => version);
  const hardware = detectHardware();
  const effective = resolveQuality(pref, hardware, webglFailed());
  return { pref, effective, enabled: effective !== 'off', hardware, recommended: recommendQuality(hardware), failed: webglFailed() };
}
