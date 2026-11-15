// Shared pieces of the Flow screens: asset URLs, a scene that keeps the background's own aspect ratio (no stretching,
// no cropped wheels) with controls positioned in the background's native pixels, and the layered GT-01.
import type { CSSProperties, ReactNode } from 'react';
import anchors from '../../../public/flow/gt01/anchors.json';
import partsManifest from '../../../public/flow/gt01/parts.json';

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

type Finish = 'metallic' | 'solid' | 'pearl' | 'matte';
interface LayerRec { file: string; box: number[]; paintMask?: string }
const LAYERS = partsManifest.layers as Record<string, LayerRec>;
/** Order in which overlay parts are stacked (lower first). */
const OVERLAY_ORDER = ['roof-panoramic', 'handle-flush', 'bumper-front-sport', 'headlamp-matrix'];
const pct = (box: number[]): CSSProperties => ({ left: `${(box[0] / GT01.w) * 100}%`, top: `${(box[1] / GT01.h) * 100}%`, width: `${(box[2] / GT01.w) * 100}%`, height: `${(box[3] / GT01.h) * 100}%` });

/** The repaint of one mask: hue from the paint (keeping the original shading), lightness lift or drop, and the finish. */
function PaintStack({ mask, paint, finish, box }: { mask: string; paint: string; finish: Finish; box?: number[] }) {
  const L = lum(paint);
  const lift = L > SRC_L ? Math.min(0.9, (L - SRC_L) / (1 - SRC_L)) : 0, drop = L < SRC_L ? Math.min(0.8, (SRC_L - L) / SRC_L) : 0;
  const m: CSSProperties = { WebkitMaskImage: `url(${flowUrl(mask)})`, maskImage: `url(${flowUrl(mask)})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%', ...(box ? pct(box) : { inset: 0, width: '100%', height: '100%' }) };
  const n = parseInt(paint.slice(1), 16), rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const towardWhite = (k: number) => `rgb(${rgb.map((v) => Math.round(v + (255 - v) * k)).join(',')})`;
  return <>
    <div className="gt01-paint" style={{ ...m, background: paint, mixBlendMode: 'color' }} />
    {lift > 0.02 && <div className="gt01-paint" style={{ ...m, background: `rgba(255,255,255,${(lift * 0.85).toFixed(2)})`, mixBlendMode: 'soft-light' }} />}
    {lift > 0.35 && <div className="gt01-paint" style={{ ...m, background: `rgba(255,255,255,${((lift - 0.35) * 0.9).toFixed(2)})`, mixBlendMode: 'screen' }} />}
    {drop > 0.02 && <div className="gt01-paint" style={{ ...m, background: `rgba(0,0,0,${(drop * 0.6).toFixed(2)})`, mixBlendMode: 'multiply' }} />}
    {/* finishes: solid flattens the metallic flake, matte caps every reflection, pearl adds a colour shift */}
    {finish === 'solid' && <div className="gt01-paint" data-finish="solid" style={{ ...m, background: paint, opacity: 0.34 }} />}
    {finish === 'matte' && <div className="gt01-paint" data-finish="matte" style={{ ...m, background: towardWhite(0.18), mixBlendMode: 'darken', opacity: 0.9 }} />}
    {finish === 'matte' && <div className="gt01-paint" data-finish="matte" style={{ ...m, background: 'rgb(128,128,128)', mixBlendMode: 'saturation', opacity: 0.18 }} />}
    {finish === 'pearl' && <div className="gt01-paint" data-finish="pearl" style={{ ...m, background: 'linear-gradient(100deg, #ffd8f0 0%, #d4f0ff 42%, #fff1d2 78%, #e2dcff 100%)', mixBlendMode: 'soft-light', opacity: 0.75 }} />}
  </>;
}

/**
 * The GT-01 from its layers: shadow, body and its repaint, then the chosen part variants mounted at the boxes they
 * were drawn at (each with its own paint mask), then the two wheels at their measured anchors. Ride height moves the
 * body (and its parts) against the fixed wheels. The box keeps the original's aspect ratio. A part without a layer
 * (see sim/vehicleConfig) does not change the drawing; the studio says so.
 */
export function GT01Car({ paint = '#2a4f86', ride = 'ride-stock', parts, finish = 'metallic', className, label, style }: { paint?: string; ride?: string; parts?: Record<string, string>; finish?: Finish; className?: string; label?: string; style?: CSSProperties }) {
  const safe = /^#[0-9a-f]{6}$/i.test(paint) ? paint : '#2a4f86';
  const dy = ((RIDE[ride] ?? 0) / GT01.h) * 100;
  const chosen = new Set(Object.values(parts ?? {}));
  const overlays = OVERLAY_ORDER.filter((k) => chosen.has(k) && LAYERS[k]);
  const multispoke = chosen.has('wheel-multispoke');
  const wl = anchors.wheelLayers as Record<string, { box: number[] }>;
  const wheel = (k: 'front' | 'rear') => <img key={k} className="gt01-wheel" data-wheel={k} data-part={multispoke ? 'wheel-multispoke' : 'wheel-gt01-twin5'} src={flowUrl(multispoke ? 'gt01/' + LAYERS[`wheel-multispoke-${k}`].file : `gt01/wheel-${k}.webp`)} alt="" style={pct(wl[k].box)} />;
  return <div className={'gt01 ' + (className ?? '')} style={{ aspectRatio: `${GT01.w} / ${GT01.h}`, ...style }} role="img" aria-label={label ?? 'GT-01'} data-paint={safe} data-ride={ride} data-finish={finish} data-parts={overlays.join(' ')}>
    <div className="gt01-move" style={{ transform: `translateY(${dy}%)` }}>
      <img className="gt01-layer" src={flowUrl('gt01/shadow.webp')} alt="" />
      <img className="gt01-layer" src={flowUrl('gt01/body.webp')} alt="" />
      <PaintStack mask="gt01/paint-mask.png" paint={safe} finish={finish} />
      {overlays.map((k) => <span key={k} className="gt01-part" data-layer={k}>
        <img className="gt01-overlay" src={flowUrl('gt01/' + LAYERS[k].file)} alt="" style={pct(LAYERS[k].box)} />
        {LAYERS[k].paintMask && <PaintStack mask={'gt01/' + LAYERS[k].paintMask} paint={safe} finish={finish} box={LAYERS[k].box} />}
      </span>)}
    </div>
    {wheel('rear')}{wheel('front')}
  </div>;
}

/** A cut-out of the GT-01 original (for part thumbnails): shows the body layer's region [x, y, w, h]. */
export function GT01Crop({ rect, paint, parts, finish }: { rect: [number, number, number, number]; paint?: string; parts?: Record<string, string>; finish?: Finish }) {
  const [x, y, w, h] = rect;
  return <div className="gt01-crop" style={{ aspectRatio: `${w} / ${h}` }}>
    <GT01Car paint={paint} parts={parts} finish={finish} style={{ position: 'absolute', width: `${(GT01.w / w) * 100}%`, left: `${(-x / w) * 100}%`, top: `${(-y / h) * 100}%` }} />
  </div>;
}
