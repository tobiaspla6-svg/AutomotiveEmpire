// Graphics quality presets (Phase 4). Stored per browser; every 3D view reads the same setting.
import { useSyncExternalStore } from 'react';

export type Quality = 'low' | 'medium' | 'high';

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
}

export const QUALITY: Record<Quality, QualitySettings> = {
  low: { dpr: [0.75, 1], lod: 1, envRes: 128, shadows: 'none', shadowRes: 256, tireSegments: 48, antialias: false },
  medium: { dpr: [1, 1.5], lod: 1, envRes: 256, shadows: 'contact', shadowRes: 512, tireSegments: 72, antialias: true },
  high: { dpr: [1, 2], lod: 0, envRes: 512, shadows: 'soft', shadowRes: 1024, tireSegments: 96, antialias: true },
};
export const QUALITY_NAME: Record<Quality, string> = { low: 'Low', medium: 'Medium', high: 'High' };

const KEY = 'ae.graphics.quality';
function read(): Quality {
  try {
    const v = globalThis.localStorage?.getItem(KEY);
    if (v === 'low' || v === 'medium' || v === 'high') return v;
  } catch { /* storage blocked: use the default */ }
  return 'high';
}
let current: Quality = read();
const listeners = new Set<() => void>();

export function setQuality(q: Quality) {
  current = q;
  try { globalThis.localStorage?.setItem(KEY, q); } catch { /* not persisted */ }
  for (const l of listeners) l();
}
export const getQuality = () => current;
export function useQuality(): [Quality, QualitySettings] {
  const q = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => current, () => current);
  return [q, QUALITY[q]];
}
