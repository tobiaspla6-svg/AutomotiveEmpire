// Hardware capability detection for the 3D views (Phase 4C).
//
// The game must stay playable on any machine: with no WebGL at all the 3D views are replaced by illustrations, on
// software rendering or small devices the Low preset is used, and the High preset is never chosen automatically —
// the player opts in (the FPS test says whether the machine can take it).
import type { Quality } from './quality';

export interface HardwareInfo {
  webgl: 'webgl2' | 'webgl1' | 'none';
  /** unmasked GPU string when the browser exposes it, otherwise 'unknown' */
  renderer: string;
  /** a CPU rasteriser (SwiftShader, llvmpipe, …): works, but far too slow for the heavier presets */
  software: boolean;
  mobile: boolean;
  cores: number;
  /** navigator.deviceMemory (GB, capped at 8 by browsers; Chromium only) */
  memoryGB: number | null;
}

const SOFTWARE_RE = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen|lavapipe/i;
export const isSoftwareRenderer = (renderer: string) => SOFTWARE_RE.test(renderer);

/** The preset used when the player leaves graphics on "Automatic". Never High. */
export function recommendQuality(h: HardwareInfo): Quality | 'off' {
  if (h.webgl === 'none') return 'off';
  if (h.software || h.mobile) return 'low';
  if (h.cores <= 2 || (h.memoryGB !== null && h.memoryGB <= 2)) return 'low';
  return 'medium';
}

/** What a measured average frame rate says about a preset: smooth enough to step up, fine, or too slow. */
export function judgeFps(avgFps: number, quality: Quality): 'step-up' | 'ok' | 'step-down' {
  if (avgFps < 30) return quality === 'low' ? 'ok' : 'step-down';
  if (avgFps >= 55 && quality !== 'high') return 'step-up';
  return 'ok';
}

let cached: HardwareInfo | null = null;
const NONE: HardwareInfo = { webgl: 'none', renderer: 'none', software: false, mobile: false, cores: 1, memoryGB: null };

export function detectHardware(): HardwareInfo {
  if (cached) return cached;
  if (typeof document === 'undefined') return (cached = NONE);
  const nav = navigator as Navigator & { deviceMemory?: number };
  const base = {
    mobile: /android|iphone|ipad|ipod|mobile/i.test(nav.userAgent ?? '') || (nav.maxTouchPoints ?? 0) > 2 && /mac/i.test(nav.platform ?? ''),
    cores: nav.hardwareConcurrency ?? 4,
    memoryGB: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
  };
  try {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
    const gl = gl2 ?? (canvas.getContext('webgl') as WebGLRenderingContext | null);
    if (!gl) return (cached = { ...NONE, ...base });
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return (cached = { ...base, webgl: gl2 ? 'webgl2' : 'webgl1', renderer, software: isSoftwareRenderer(renderer) });
  } catch {
    return (cached = { ...NONE, ...base });
  }
}

/** Test hook: forget the cached probe. */
export const resetHardwareCache = () => { cached = null; };

// -------------------------------------------------------------------------------- runtime failure
// If a WebGL context is lost or a 3D view throws, every later view shows its illustration instead of retrying
// forever; the player can switch 3D back on in the settings.
let failed = false;
const failListeners = new Set<() => void>();
export const webglFailed = () => failed;
export function reportWebglFailure() { if (!failed) { failed = true; for (const l of failListeners) l(); } }
export function clearWebglFailure() { failed = false; for (const l of failListeners) l(); }
export const onWebglFailure = (cb: () => void) => { failListeners.add(cb); return () => { failListeners.delete(cb); }; };
