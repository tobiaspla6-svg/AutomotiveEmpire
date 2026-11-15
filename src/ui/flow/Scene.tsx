// Shared pieces of the Flow screens: asset URLs, a scene that keeps the background's own aspect ratio (no stretching,
// no cropped wheels) with controls positioned in the background's native pixels, and the layered GT-01.
import type { CSSProperties, ReactNode } from 'react';
import anchors from '../../../public/flow/gt01/anchors.json';

const BASE = (import.meta.env?.BASE_URL ?? '/');
export const flowUrl = (p: string) => `${BASE}flow/${p}`;

/** Native sizes of the cleaned backgrounds (public/flow/bg/provenance.json). */
export const BG = {
  inicio: { src: 'bg/inicio.webp', w: 917, h: 768 },
  headquarters: { src: 'bg/headquarters.webp', w: 1376, h: 578 },
  taller: { src: 'bg/taller.webp', w: 1060, h: 516 },
  fabrica: { src: 'bg/fabrica.webp', w: 1376, h: 556 },
  garaje: { src: 'bg/garaje.webp', w: 944, h: 600 },
  cofres: { src: 'bg/cofres.webp', w: 1376, h: 636 },
  configuracion: { src: 'bg/configuracion.webp', w: 1376, h: 768 },
} as const;
export type BgId = keyof typeof BG;

/** Position a box given in the background's native pixels, as percentages of the scene. */
export const at = (bg: BgId, x: number, y: number, w?: number, h?: number): CSSProperties => {
  const b = BG[bg];
  return { left: `${(x / b.w) * 100}%`, top: `${(y / b.h) * 100}%`, ...(w !== undefined ? { width: `${(w / b.w) * 100}%` } : {}), ...(h !== undefined ? { height: `${(h / b.h) * 100}%` } : {}) };
};

/** A scene at the background's aspect ratio. Children are absolutely positioned inside it (use `at`). */
export function Scene({ bg, children, className, label }: { bg: BgId; children?: ReactNode; className?: string; label?: string }) {
  const b = BG[bg];
  return <div className={'fs-scene ' + (className ?? '')} style={{ aspectRatio: `${b.w} / ${b.h}` }} role={label ? 'region' : undefined} aria-label={label}>
    <img className="fs-bg" src={flowUrl(b.src)} alt="" width={b.w} height={b.h} decoding="async" draggable={false} />
    {children}
  </div>;
}

// ---------------------------------------------------------------------------------------------------- GT-01
export const GT01 = { w: 1376, h: 768, anchors } as const;
const RIDE: Record<string, number> = { 'ride-low': 6, 'ride-stock': 0, 'ride-raised': -6 };   // native px (≈3.7 mm each)
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
/** Source paint luminance of the original blue (measured on the body panels). */
const SRC_L = 0.13;

/**
 * The GT-01 from its derived layers: shadow, body, repaint through the paint mask, and the two wheels at their
 * measured anchors. Ride height moves body and shadow against the fixed wheels. Nothing is stretched: the box keeps
 * the original's aspect ratio. `parts` that have no layer yet do not change the drawing (the studio says so).
 */
export function GT01Car({ paint = '#2a4f86', ride = 'ride-stock', className, label, style }: { paint?: string; ride?: string; className?: string; label?: string; style?: CSSProperties }) {
  const safe = /^#[0-9a-f]{6}$/i.test(paint) ? paint : '#2a4f86';
  const dy = ((RIDE[ride] ?? 0) / GT01.h) * 100;
  const L = lum(safe);
  // `color` blending keeps the original shading and takes hue and saturation from the paint; a second masked layer
  // lifts or lowers the lightness towards the chosen colour (white, silver or black paints).
  const lift = L > SRC_L ? Math.min(0.9, (L - SRC_L) / (1 - SRC_L)) : 0, drop = L < SRC_L ? Math.min(0.8, (SRC_L - L) / SRC_L) : 0;
  const mask: CSSProperties = { WebkitMaskImage: `url(${flowUrl('gt01/paint-mask.png')})`, maskImage: `url(${flowUrl('gt01/paint-mask.png')})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%' };
  const wl = anchors.wheelLayers as Record<string, { box: number[] }>;
  const wheel = (k: 'front' | 'rear') => { const [x, y, w, h] = wl[k].box; return <img key={k} className="gt01-wheel" data-wheel={k} src={flowUrl(`gt01/wheel-${k}.webp`)} alt="" style={{ left: `${(x / GT01.w) * 100}%`, top: `${(y / GT01.h) * 100}%`, width: `${(w / GT01.w) * 100}%`, height: `${(h / GT01.h) * 100}%` }} />; };
  return <div className={'gt01 ' + (className ?? '')} style={{ aspectRatio: `${GT01.w} / ${GT01.h}`, ...style }} role="img" aria-label={label ?? 'GT-01'} data-paint={safe} data-ride={ride}>
    <div className="gt01-move" style={{ transform: `translateY(${dy}%)` }}>
      <img className="gt01-layer" src={flowUrl('gt01/shadow.webp')} alt="" />
      <img className="gt01-layer" src={flowUrl('gt01/body.webp')} alt="" />
      <div className="gt01-layer gt01-paint" style={{ ...mask, background: safe, mixBlendMode: 'color' }} />
      {lift > 0.02 && <div className="gt01-layer gt01-paint" style={{ ...mask, background: `rgba(255,255,255,${(lift * 0.85).toFixed(2)})`, mixBlendMode: 'soft-light' }} />}
      {lift > 0.35 && <div className="gt01-layer gt01-paint" style={{ ...mask, background: `rgba(255,255,255,${((lift - 0.35) * 0.9).toFixed(2)})`, mixBlendMode: 'screen' }} />}
      {drop > 0.02 && <div className="gt01-layer gt01-paint" style={{ ...mask, background: `rgba(0,0,0,${(drop * 0.6).toFixed(2)})`, mixBlendMode: 'multiply' }} />}
    </div>
    {wheel('rear')}{wheel('front')}
  </div>;
}

/** A cut-out of the GT-01 original (for part thumbnails): shows the body layer's region [x, y, w, h]. */
export function GT01Crop({ rect, paint }: { rect: [number, number, number, number]; paint?: string }) {
  const [x, y, w, h] = rect;
  return <div className="gt01-crop" style={{ aspectRatio: `${w} / ${h}` }}>
    <GT01Car paint={paint} style={{ position: 'absolute', width: `${(GT01.w / w) * 100}%`, left: `${(-x / w) * 100}%`, top: `${(-y / h) * 100}%` }} />
  </div>;
}
