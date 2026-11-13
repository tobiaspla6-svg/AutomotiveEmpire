// A drawn car shown wherever a 3D view is not available yet (still loading), not wanted (graphics off), or not
// possible (no WebGL). It is a side-view silhouette built from a few proportions, tinted with the car's colour — so
// the interface keeps its character and gameplay stays fully usable without a GPU.
import { memo } from 'react';

import type { BodyType, Discipline } from '../../sim/types';

export type PosterKind = 'sedan' | 'coupe' | 'hatch' | 'suv' | 'pickup' | 'formula' | 'prototype';
const SHAPE: Record<PosterKind, { body: string; glass: string; wheels: [number, number]; r: number }> = {
  sedan: { body: 'M20 118c0-8 4-14 14-17l34-10c12-12 26-22 44-24h58c20 0 34 8 46 22l40 10c10 3 14 10 14 19v10c0 4-3 7-7 7H27c-4 0-7-3-7-7z', glass: 'M110 90l12-16c6-3 14-4 24-4h28c12 0 22 6 30 20z', wheels: [82, 262], r: 19 },
  coupe: { body: 'M18 118c0-9 5-15 15-18l40-9c13-14 28-25 48-27h46c18 0 32 8 44 22l40 11c10 3 15 9 15 18v10c0 4-3 7-7 7H25c-4 0-7-3-7-7z', glass: 'M118 72c12-9 24-14 40-14h28c12 0 24 7 34 18l-6 8H108z', wheels: [82, 262], r: 19 },
  hatch: { body: 'M24 118c0-8 4-14 13-17l28-8c10-16 22-26 42-28h64c12 0 22 6 30 16l24 22c6 3 11 8 11 15v10c0 4-3 7-7 7H31c-4 0-7-3-7-7z', glass: 'M98 70c8-8 18-14 34-14h42c10 0 20 6 28 16l12 18H92z', wheels: [80, 258], r: 19 },
  suv: { body: 'M20 120c0-8 3-14 11-17l22-8c8-18 20-30 38-32h96c14 0 24 8 32 22l22 14c8 4 12 10 12 20v9c0 4-3 7-7 7H27c-4 0-7-3-7-7z', glass: 'M96 68c6-8 16-14 30-14h82c10 0 18 6 26 18l8 14H90z', wheels: [84, 262], r: 22 },
  pickup: { body: 'M18 120c0-8 4-14 12-17l24-8c8-14 20-24 38-26h64c6 0 10 3 12 8l6 14h98c6 0 10 4 10 10v19c0 4-3 7-7 7H25c-4 0-7-3-7-7z', glass: 'M96 70c6-7 14-12 26-12h46l6 22H92z', wheels: [84, 270], r: 22 },
  formula: { body: 'M8 124l56-10 44-6 22-14 20-4 40 2 36 10 54 4 24 6v12H8z', glass: 'M150 98l14-12h24l10 14z', wheels: [72, 282], r: 21 },
  prototype: { body: 'M10 124c0-8 6-12 16-14l66-10c14-12 32-20 52-20h60c18 0 32 6 44 18l56 14c8 2 12 6 12 12v8c0 4-3 6-7 6H17c-4 0-7-2-7-6z', glass: 'M128 84c14-10 28-14 46-14h40c10 0 22 4 30 12l-6 10H120z', wheels: [86, 288], r: 21 },
};

export const CarPoster = memo(function CarPoster({ kind = 'sedan', color = '#6d7c93', label, className }: { kind?: PosterKind; color?: string; label?: string; className?: string }) {
  const s = SHAPE[kind];
  return (
    <div className={'poster ' + (className ?? '')} role="img" aria-label={label ?? kind}>
      <svg viewBox="0 0 360 170" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={`pb-${kind}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.95" /><stop offset="1" stopColor={color} stopOpacity="0.55" /></linearGradient>
          <radialGradient id="pshadow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#000" stopOpacity="0.55" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
        </defs>
        <ellipse cx="180" cy="146" rx="150" ry="9" fill="url(#pshadow)" />
        <path d={s.body} fill={`url(#pb-${kind})`} stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" />
        <path d={s.glass} fill="#0b0d11" opacity="0.82" transform={kind === 'sedan' || kind === 'formula' ? undefined : 'translate(0 9)'} />
        <path d={s.body} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="6" strokeLinejoin="round" style={{ mixBlendMode: 'overlay' }} />
        {s.wheels.map((x) => <g key={x}><circle cx={x} cy={128} r={s.r} fill="#0a0b0d" stroke="#262a31" strokeWidth="3" /><circle cx={x} cy={128} r={s.r * 0.55} fill="#8e96a5" opacity="0.85" /><circle cx={x} cy={128} r={s.r * 0.2} fill="#1b1e24" /></g>)}
      </svg>
      {label && !className?.includes('poster-hero') && <span className="poster-l">{label}</span>}
    </div>
  );
});

/** Which illustration suits a road-car body style. */
export const posterForBody = (b: BodyType): PosterKind => (b === 'hatch' || b === 'wagon' ? 'hatch' : b === 'suv' ? 'suv' : b === 'pickup' ? 'pickup' : b === 'sedan' ? 'sedan' : 'coupe');
/** Which illustration suits a racing discipline. */
export const posterForDiscipline = (d: Discipline): PosterKind => (d === 'f1' ? 'formula' : d === 'hypercar' || d === 'lmdh' ? 'prototype' : d === 'touring' ? 'sedan' : 'coupe');
