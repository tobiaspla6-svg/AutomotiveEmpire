// Side-view vector car, drawn from proportions in metres: body style and era change the silhouette (roof, hood,
// overhangs, wheel size, roundness), the lamps, bumpers and wheels. Cosmetic blueprints the player has earned and
// equipped change the car visibly (wheels, aero kits, wings, scoops, accents). Pure SVG — no WebGL, no images.
import { memo, useId } from 'react';
import type { BodyType } from '../../sim/types';
import type { ArcadeProgress } from '../../sim/progression';
import { roundPath, shade, f, luma } from './svg';

export type WheelLook = 'steel' | 'hubcap' | 'fivespoke' | 'multispoke' | 'turbine' | 'forged' | 'aero';
export type Era = 'fifties' | 'sixties' | 'seventies' | 'eighties' | 'nineties' | 'noughties' | 'modern';
export const eraOf = (year: number): Era => (year < 1960 ? 'fifties' : year < 1970 ? 'sixties' : year < 1980 ? 'seventies' : year < 1992 ? 'eighties' : year < 2004 ? 'nineties' : year < 2015 ? 'noughties' : 'modern');

/** Proportions in metres and as fractions of the length (0 = rear, 1 = front). */
interface Prof { L: number; roof: number; hood: number; deck: number; sill: number; wb: number; wt: number; re: number; rw: number; nose: number; tail: number; R: number; axF: number; axR: number; belt: number; doors: 2 | 4; open?: boolean; bed?: boolean }
const BODY: Record<BodyType, Prof> = {
  sedan: { L: 4.7, roof: 1.43, hood: 0.98, deck: 1.02, sill: 0.3, wb: 0.65, wt: 0.53, re: 0.29, rw: 0.19, nose: 0.62, tail: 0.74, R: 0.33, axF: 0.81, axR: 0.18, belt: 0.98, doors: 4 },
  hatch: { L: 4.1, roof: 1.46, hood: 0.94, deck: 1.0, sill: 0.3, wb: 0.67, wt: 0.54, re: 0.11, rw: 0.04, nose: 0.6, tail: 0.8, R: 0.31, axF: 0.8, axR: 0.16, belt: 0.98, doors: 4 },
  wagon: { L: 4.8, roof: 1.48, hood: 0.98, deck: 1.02, sill: 0.3, wb: 0.65, wt: 0.53, re: 0.05, rw: 0.02, nose: 0.62, tail: 0.82, R: 0.33, axF: 0.82, axR: 0.16, belt: 0.98, doors: 4 },
  coupe: { L: 4.5, roof: 1.3, hood: 0.92, deck: 0.98, sill: 0.27, wb: 0.62, wt: 0.47, re: 0.31, rw: 0.13, nose: 0.56, tail: 0.72, R: 0.34, axF: 0.8, axR: 0.18, belt: 0.93, doors: 2 },
  roadster: { L: 4.1, roof: 1.17, hood: 0.88, deck: 0.92, sill: 0.26, wb: 0.6, wt: 0.53, re: 0.4, rw: 0.36, nose: 0.55, tail: 0.72, R: 0.33, axF: 0.8, axR: 0.17, belt: 0.9, doors: 2, open: true },
  supercar: { L: 4.55, roof: 1.15, hood: 0.8, deck: 0.98, sill: 0.22, wb: 0.71, wt: 0.58, re: 0.41, rw: 0.17, nose: 0.44, tail: 0.76, R: 0.35, axF: 0.84, axR: 0.17, belt: 0.86, doors: 2 },
  suv: { L: 4.75, roof: 1.76, hood: 1.18, deck: 1.16, sill: 0.44, wb: 0.66, wt: 0.53, re: 0.07, rw: 0.03, nose: 0.86, tail: 0.96, R: 0.39, axF: 0.82, axR: 0.17, belt: 1.22, doors: 4 },
  pickup: { L: 5.3, roof: 1.84, hood: 1.24, deck: 1.14, sill: 0.47, wb: 0.64, wt: 0.53, re: 0.41, rw: 0.4, nose: 0.92, tail: 1.06, R: 0.4, axF: 0.83, axR: 0.18, belt: 1.26, doors: 2, bed: true },
};
/** Era: roundness of corners (px), extra roof height and lower beltline (more glass), wheel size, rim share. */
const ERA: Record<Era, { round: number; roof: number; belt: number; R: number; rim: number; chrome: boolean; lamp: 'round' | 'rect' | 'oval' | 'slim'; fins?: boolean }> = {
  fifties: { round: 16, roof: 0.08, belt: -0.06, R: -0.01, rim: 0.5, chrome: true, lamp: 'round', fins: true },
  sixties: { round: 10, roof: 0.04, belt: -0.04, R: -0.02, rim: 0.52, chrome: true, lamp: 'round' },
  seventies: { round: 6, roof: 0.02, belt: -0.03, R: -0.02, rim: 0.55, chrome: true, lamp: 'rect' },
  eighties: { round: 3, roof: 0.02, belt: -0.02, R: -0.01, rim: 0.57, chrome: false, lamp: 'rect' },
  nineties: { round: 13, roof: 0, belt: 0, R: 0, rim: 0.6, chrome: false, lamp: 'oval' },
  noughties: { round: 11, roof: 0, belt: 0.04, R: 0.015, rim: 0.66, chrome: false, lamp: 'oval' },
  modern: { round: 9, roof: -0.01, belt: 0.06, R: 0.025, rim: 0.71, chrome: false, lamp: 'slim' },
};
const ERA_WHEEL: Record<Era, WheelLook> = { fifties: 'hubcap', sixties: 'hubcap', seventies: 'steel', eighties: 'turbine', nineties: 'fivespoke', noughties: 'multispoke', modern: 'aero' };
/** Wheels named by the cosmetic blueprints. */
const BLUEPRINT_WHEEL: Record<string, WheelLook> = { 'steel-rims': 'steel', 'five-spoke': 'fivespoke', forged: 'forged' };

export interface Car2DProps {
  body?: BodyType; year?: number; color?: string; equipped?: ArcadeProgress['equipped'];
  /** wheel design override (the simulation's cosmetic wheel style or a blueprint) */
  wheels?: WheelLook; electric?: boolean; sporty?: boolean;
  /** spin the wheels and add a speed streak */
  moving?: boolean; facing?: 'left' | 'right'; className?: string; label?: string; ground?: boolean;
}

const W = 420, G = 150, K = 70; // viewBox width, ground line, pixels per metre

export const Car2D = memo(function Car2D({ body = 'sedan', year = 2015, color = '#3f6fb4', equipped, wheels, electric = false, sporty = false, moving = false, facing = 'right', className, label, ground = true }: Car2DProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const era = eraOf(year), E = ERA[era];
  const base = BODY[body] ?? BODY.sedan;
  const kit = equipped?.body, chassisKit = equipped?.chassis, engineKit = equipped?.engine;
  const low = chassisKit === 'independent' || chassisKit === 'carbon-frame' || kit === 'hyperbody' ? 0.04 : 0;
  const P: Prof = { ...base, roof: base.roof + (base.open ? 0 : E.roof) - low, belt: base.belt + E.belt - low, sill: base.sill - low, R: base.R + E.R + 0.03, hood: base.hood - low * 0.5, deck: base.deck - low * 0.5 };
  if (kit === 'fastback' && !P.open && !P.bed && body !== 'suv') { P.re = Math.min(P.re, 0.22); P.rw = 0.05; }
  const L = P.L * K, x0 = W / 2 - L / 2;
  const X = (t: number) => x0 + t * L, Y = (h: number) => G - h * K;
  const r = E.round;
  const fins = E.fins && (body === 'sedan' || body === 'coupe' || body === 'wagon');
  const tailTop = P.tail + (fins ? 0.12 : 0);

  // ---- body outline, clockwise from the rear bottom
  const outline: [number, number, number][] = [
    [X(0.012), Y(P.sill + 0.04), r * 0.6],
    [X(0), Y(P.tail - 0.18), r * 0.5],
    [X(0.004), Y(tailTop), r * 0.5],
  ];
  if (P.open) {
    outline.push([X(0.06), Y(P.deck), r], [X(P.wb - 0.02), Y(P.belt + 0.02), r * 0.6]);
  } else if (P.bed) {
    outline.push([X(0.005), Y(P.deck), 3], [X(P.rw), Y(P.deck), 2], [X(P.rw), Y(P.roof - 0.05), 4], [X(P.re + 0.02), Y(P.roof), r * 0.6], [X(P.wt), Y(P.roof), r], [X(P.wb), Y(P.hood + 0.06), r * 0.5]);
  } else {
    const deckY = body === 'hatch' || body === 'wagon' || body === 'suv' ? P.belt + 0.02 : P.deck;
    outline.push([X(0.025), Y(deckY), r], [X(P.rw), Y(deckY + 0.03), r * 0.8], [X(P.re), Y(P.roof), r * 1.6], [X(P.wt), Y(P.roof), r * 1.3], [X(P.wb), Y(P.hood + 0.06), r * 0.5]);
  }
  outline.push(
    [X(0.975), Y(P.nose + 0.14), r * 1.1],
    [X(1), Y(P.nose - 0.1), r * 0.8],
    [X(0.99), Y(P.sill + 0.03), r * 0.6],
  );
  const bodyPath = roundPath(outline);

  // ---- glasshouse
  const gl = 0.035; // pillar inset
  const glass: [number, number, number][] = P.open ? [] : P.bed
    ? [[X(P.rw + 0.02), Y(P.belt), 2], [X(P.rw + 0.02), Y(P.roof - 0.1), 3], [X(P.wt - 0.005), Y(P.roof - 0.08), r * 0.6], [X(P.wb - 0.015), Y(P.belt + 0.02), 2]]
    : [[X(P.rw + (P.rw < 0.08 ? 0.05 : 0.02)), Y(P.belt + 0.02), 2], [X(P.re + gl * 0.6), Y(P.roof - 0.07), r * 1.1], [X(P.wt - gl * 0.2), Y(P.roof - 0.07), r * 0.9], [X(P.wb - gl * 0.4), Y(P.belt + 0.03), 2]];
  const glassPath = glass.length ? roundPath(glass) : '';
  // B pillar between the doors, C pillar for a 4-door's rear quarter
  const bx = (P.wt + P.re) / 2 + (P.doors === 2 ? -0.05 : 0.01);
  const pillarW = era === 'modern' || era === 'noughties' ? 0.022 : 0.018;

  // ---- wheels and arches
  const R = P.R * K, cy = G - R, fx = X(P.axF), rx = X(P.axR);
  const look: WheelLook = (equipped?.wheels && BLUEPRINT_WHEEL[equipped.wheels]) || wheels || (sporty && era !== 'fifties' ? 'fivespoke' : ERA_WHEEL[era]);
  const bodyTop = shade(color, 0.28), bodyMid = color, bodyLow = shade(color, -0.42);
  const dark = luma(color) < 0.25;
  const trim = E.chrome ? '#d9dde3' : '#16191f';
  const doorY0 = Y(P.belt + 0.02), doorY1 = Y(P.sill + 0.07);
  const handleY = Y(P.belt - 0.1);
  const frontDoorFront = X(P.wb - 0.03), frontDoorRear = X(bx + pillarW / 2);
  const rearDoorRear = X(P.doors === 4 ? Math.max(P.re + 0.02, P.rw + 0.09) : bx);
  const lampY = Y(P.nose + (E.lamp === 'slim' ? 0.17 : 0.06));
  const accent = engineKit === 'hybrid' ? '#4cc3ff' : engineKit === 'prototype' ? '#ff5fd2' : null;

  return (
    <div className={'car2d ' + (moving ? 'car2d-moving ' : '') + (className ?? '')} role="img" aria-label={label ?? `${body} ${year}`}>
      <svg viewBox={`0 0 ${W} 170`} preserveAspectRatio="xMidYMid meet" style={facing === 'left' ? { transform: 'scaleX(-1)' } : undefined}>
        <defs>
          <linearGradient id={`b${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={bodyTop} /><stop offset="0.42" stopColor={bodyMid} /><stop offset="1" stopColor={bodyLow} />
          </linearGradient>
          <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#9fd0f0" stopOpacity="0.9" /><stop offset="0.45" stopColor="#1d3550" /><stop offset="1" stopColor="#0b1422" />
          </linearGradient>
          <radialGradient id={`s${uid}`} cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#000" stopOpacity="0.55" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
          <radialGradient id={`t${uid}`} cx="50%" cy="45%" r="55%"><stop offset="0.72" stopColor="#1b1d22" /><stop offset="1" stopColor="#050506" /></radialGradient>
          <linearGradient id={`m${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f4f6f8" /><stop offset="0.5" stopColor="#9aa4b1" /><stop offset="1" stopColor="#d7dde4" /></linearGradient>
          <clipPath id={`c${uid}`}><path d={bodyPath} /></clipPath>
        </defs>
        {ground && <ellipse cx={W / 2} cy={G + 3} rx={L * 0.56} ry={8} fill={`url(#s${uid})`} />}
        {moving && <g className="car2d-streaks" stroke="#ffffff" strokeOpacity="0.25" strokeLinecap="round">{[0, 1, 2].map((i) => <line key={i} x1={X(-0.02) - 10 - i * 14} x2={X(-0.02) - 50 - i * 26} y1={Y(P.belt - 0.15 - i * 0.18)} y2={Y(P.belt - 0.15 - i * 0.18)} strokeWidth={3 - i} />)}</g>}

        {/* wing uprights behind the body */}
        {(kit === 'endurance' || kit === 'hyperbody') && !P.bed && <g fill="#14171c">
          <rect x={X(0.05)} y={Y(P.deck + 0.32)} width={4} height={0.34 * K} rx={1.5} />
          <rect x={X(0.11)} y={Y(P.deck + 0.32)} width={4} height={0.34 * K} rx={1.5} />
        </g>}

        {/* body */}
        <path d={bodyPath} fill={`url(#b${uid})`} />
        <g clipPath={`url(#c${uid})`}>
          {/* wheel wells */}
          {[fx, rx].map((x) => <circle key={x} cx={x} cy={cy} r={R * 1.16} fill="#07080a" />)}
          {/* lower body shadow and rocker */}
          <rect x={x0} y={Y(P.sill + 0.16)} width={L} height={0.2 * K} fill={shade(color, -0.6)} opacity="0.45" />
          {/* shoulder highlight */}
          <path d={roundPath([[X(0.02), Y(P.belt - 0.05), 0], [X(0.5), Y(P.belt - 0.03), 40], [X(0.98), Y(P.nose + 0.12), 0]], false)} fill="none" stroke="#ffffff" strokeOpacity={dark ? 0.22 : 0.38} strokeWidth="2.4" />
          {/* side crease */}
          <path d={`M${f(X(0.03))} ${f(Y(P.belt - 0.2))}L${f(X(0.97))} ${f(Y(P.nose - 0.02))}`} stroke={shade(color, -0.55)} strokeOpacity="0.55" strokeWidth="1.2" />
          {/* livery */}
          {kit === 'endurance' && <><rect x={x0} y={Y(P.belt - 0.12)} width={L} height={0.09 * K} fill="#f2f2ea" opacity="0.92" /><circle cx={X((P.wb + bx) / 2)} cy={Y(P.belt - 0.28)} r={0.17 * K} fill="#f2f2ea" stroke="#111" strokeWidth="1.5" /><text x={X((P.wb + bx) / 2)} y={Y(P.belt - 0.28) + 6} textAnchor="middle" fontSize="16" fontWeight="800" fill="#111" fontFamily="system-ui, sans-serif">7</text></>}
          {accent && <path d={`M${f(X(0.04))} ${f(Y(P.sill + 0.12))}L${f(X(0.96))} ${f(Y(P.sill + 0.12))}`} stroke={accent} strokeWidth="2.5" opacity="0.9" />}
        </g>
        {/* wheel-arch lips */}
        {[fx, rx].map((x) => <path key={'a' + x} d={`M${f(x - R * 1.16)} ${f(Math.min(cy + R * 0.25, Y(P.sill)))}A${f(R * 1.16)} ${f(R * 1.16)} 0 0 1 ${f(x + R * 1.16)} ${f(Math.min(cy + R * 0.25, Y(P.sill)))}`} fill="none" stroke={shade(color, -0.55)} strokeWidth="2" />)}
        {/* body outline light rim */}
        <path d={bodyPath} fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1" />

        {/* glass */}
        {glassPath && <>
          <path d={glassPath} fill={`url(#g${uid})`} stroke={chassisKit === 'carbon-frame' ? '#1a1c20' : '#0b0f15'} strokeWidth={chassisKit === 'carbon-frame' ? 3.5 : 1.6} />
          <path d={`M${f(X(P.wt - 0.06))} ${f(Y(P.roof - 0.1))}L${f(X(P.wt - 0.13))} ${f(Y(P.belt + 0.06))}`} stroke="#ffffff" strokeOpacity="0.3" strokeWidth="6" />
          {/* pillars */}
          <path d={`M${f(X(bx))} ${f(Y(P.roof - 0.04))}L${f(X(bx + pillarW))} ${f(Y(P.roof - 0.04))}L${f(X(bx + pillarW + 0.01))} ${f(Y(P.belt + 0.02))}L${f(X(bx + 0.008))} ${f(Y(P.belt + 0.02))}Z`} fill={era === 'modern' || era === 'noughties' ? '#0d1016' : shade(color, -0.2)} />
          {chassisKit === 'spaceframe' && <path d={`M${f(X(P.re + 0.06))} ${f(Y(P.roof - 0.1))}L${f(X(bx))} ${f(Y(P.belt + 0.05))}M${f(X(bx))} ${f(Y(P.roof - 0.1))}L${f(X(P.wt - 0.05))} ${f(Y(P.belt + 0.05))}`} stroke="#e8c070" strokeWidth="2" opacity="0.8" />}
        </>}
        {chassisKit === 'carbon-frame' && !P.open && <path d={roundPath([[X(P.re + 0.02), Y(P.roof + 0.005), 6], [X(P.wt), Y(P.roof + 0.005), 6]], false)} stroke="#1c1e22" strokeWidth="5" strokeLinecap="round" />}
        {P.open && <g>
          <path d={`M${f(X(P.wb - 0.015))} ${f(Y(P.belt + 0.02))}L${f(X(P.wt))} ${f(Y(P.roof))}`} stroke="#0b0f15" strokeWidth="5" strokeLinecap="round" />
          <path d={`M${f(X(P.wb - 0.025))} ${f(Y(P.belt + 0.03))}L${f(X(P.wt + 0.01))} ${f(Y(P.roof - 0.01))}`} stroke="#9fd0f0" strokeOpacity="0.5" strokeWidth="2" />
          <rect x={X(0.42)} y={Y(P.belt + 0.24)} width={0.16 * K} height={0.26 * K} rx={5} fill="#16181d" />
          <circle cx={X(0.56)} cy={Y(P.belt + 0.12)} r={0.1 * K} fill="none" stroke="#16181d" strokeWidth="3" />
        </g>}
        {P.bed && <path d={`M${f(X(0.01))} ${f(Y(P.deck))}L${f(X(P.rw))} ${f(Y(P.deck))}`} stroke={shade(color, -0.5)} strokeWidth="3" />}

        {/* doors, handles, mirror */}
        <g stroke={shade(color, -0.62)} strokeWidth="1.1" fill="none" opacity="0.85">
          <path d={`M${f(frontDoorFront)} ${f(doorY0)}Q${f(frontDoorFront - 4)} ${f((doorY0 + doorY1) / 2)} ${f(frontDoorFront + 2)} ${f(doorY1)}`} />
          <path d={`M${f(frontDoorRear)} ${f(doorY0)}L${f(frontDoorRear - 2)} ${f(doorY1)}`} />
          {P.doors === 4 && <path d={`M${f(rearDoorRear)} ${f(doorY0)}Q${f(rearDoorRear + 6)} ${f((doorY0 + doorY1) / 2)} ${f(rearDoorRear + 2)} ${f(doorY1 - 6)}`} />}
          <path d={`M${f(frontDoorFront + 2)} ${f(doorY1)}L${f(P.doors === 4 ? rearDoorRear + 2 : frontDoorRear - 2)} ${f(doorY1)}`} />
        </g>
        <rect x={frontDoorRear - 18} y={handleY} width={11} height={2.6} rx={1.3} fill={E.chrome ? '#e9edf2' : shade(color, -0.5)} />
        {P.doors === 4 && <rect x={rearDoorRear - 16} y={handleY} width={11} height={2.6} rx={1.3} fill={E.chrome ? '#e9edf2' : shade(color, -0.5)} />}
        {!P.open && <path d={`M${f(X(P.wb - 0.025))} ${f(Y(P.belt + 0.05))}l7 -5l6 1l-1 6l-10 2z`} fill={chassisKit === 'carbon-frame' ? '#1c1e22' : shade(color, -0.15)} stroke="#0b0f15" strokeWidth="0.8" />}

        {/* front: lamp, grille, bumper */}
        {E.lamp === 'round' && <><circle cx={X(0.975)} cy={lampY} r={6.5} fill="#fff8de" stroke={trim} strokeWidth="2" /><circle cx={X(0.975)} cy={lampY} r={3} fill="#ffffff" /></>}
        {E.lamp === 'rect' && <rect x={X(0.962)} y={lampY - 5} width={13} height={10} rx={1.5} fill="#fff8de" stroke={trim} strokeWidth="1.5" />}
        {E.lamp === 'oval' && <path d={`M${f(X(0.955))} ${f(lampY - 3)}Q${f(X(0.99))} ${f(lampY - 7)} ${f(X(0.998))} ${f(lampY + 2)}Q${f(X(0.97))} ${f(lampY + 6)} ${f(X(0.955))} ${f(lampY - 3)}Z`} fill="#fff8de" stroke="#0b0f15" strokeWidth="0.8" />}
        {E.lamp === 'slim' && <path d={`M${f(X(0.93))} ${f(lampY + 1)}L${f(X(0.995))} ${f(lampY + 4)}`} stroke="#f2fbff" strokeWidth="3" strokeLinecap="round" />}
        {E.lamp === 'slim' && <path d={`M${f(X(0.93))} ${f(lampY + 1)}L${f(X(0.995))} ${f(lampY + 4)}`} stroke="#9ee6ff" strokeOpacity="0.45" strokeWidth="7" strokeLinecap="round" />}
        {!electric && <rect x={X(0.985)} y={Y(P.nose - 0.02)} width={L * 0.017} height={0.12 * K} rx={1.5} fill={E.chrome ? '#c9ced6' : '#0c0e12'} opacity="0.9" />}
        {E.chrome && <><rect x={X(0.93)} y={Y(P.sill + 0.17)} width={L * 0.08} height={6} rx={3} fill={`url(#m${uid})`} /><rect x={X(-0.012)} y={Y(P.sill + 0.17)} width={L * 0.08} height={6} rx={3} fill={`url(#m${uid})`} /></>}

        {/* rear: tail lamp, exhaust, wing / spoiler */}
        {E.lamp === 'slim' ? <path d={`M${f(X(0.004))} ${f(Y(P.tail - 0.06))}L${f(X(0.06))} ${f(Y(P.tail - 0.02))}`} stroke="#ff3b4a" strokeWidth="3.2" strokeLinecap="round" />
          : <rect x={X(0.0) - 1} y={Y(tailTop - (fins ? 0.08 : 0.04))} width={L * 0.03} height={(fins ? 0.16 : 0.1) * K} rx={2} fill="#e8303f" />}
        {!electric && <ellipse cx={X(0.04)} cy={Y(P.sill + 0.02)} rx={5} ry={2.6} fill="#2a2d33" stroke="#7d848f" strokeWidth="1" />}
        {(sporty || engineKit === 'race-v8' || engineKit === 'twinturbo') && !electric && <ellipse cx={X(0.08)} cy={Y(P.sill + 0.02)} rx={5} ry={2.6} fill="#2a2d33" stroke="#7d848f" strokeWidth="1" />}
        {kit === 'aero-gt' && <path d={`M${f(X(0.0))} ${f(Y(P.deck + 0.03))}l${f(L * 0.08)} 0l-3 -6l${f(-L * 0.07)} 0z`} fill="#121418" />}
        {(kit === 'endurance' || kit === 'hyperbody') && !P.bed && <path d={`M${f(X(-0.02))} ${f(Y(P.deck + 0.34))}l${f(L * 0.17)} -3l2 7l${f(-L * 0.17)} 3z`} fill="#121418" stroke="#2c3038" />}
        {kit === 'hyperbody' && <path d={`M${f(X(0.0))} ${f(Y(P.sill + 0.05))}l18 0l-4 9l-14 0z`} fill="#121418" />}
        {kit === 'aero-gt' && <path d={`M${f(X(0.2))} ${f(Y(P.sill + 0.02))}L${f(X(0.78))} ${f(Y(P.sill + 0.02))}`} stroke="#121418" strokeWidth="4" strokeLinecap="round" />}
        {engineKit === 'race-v8' && <path d={`M${f(X(0.83))} ${f(Y(P.hood + 0.05))}l22 0l-5 -10l-12 0z`} fill="#141619" />}
        {engineKit === 'twinturbo' && <g fill="#0d1014">{[0, 1, 2].map((i) => <rect key={i} x={X(0.72) + i * 6} y={Y(P.belt - 0.17)} width={3} height={9} rx={1} />)}</g>}

        {/* wheels */}
        {[rx, fx].map((x) => <Wheel key={x} x={x} y={cy} R={R} rimShare={E.rim} look={look} era={era} caliper={sporty || look === 'forged' ? '#d2342c' : null} spin={moving} uid={uid} />)}
      </svg>
    </div>
  );
});

/** One wheel: tyre, rim of the chosen design, brake disc behind it. Exported for the parts cards. */
export function Wheel({ x, y, R, rimShare = 0.62, look, era = 'modern', caliper = null, spin = false, uid }: { x: number; y: number; R: number; rimShare?: number; look: WheelLook; era?: Era; caliper?: string | null; spin?: boolean; uid: string }) {
  const rr = R * rimShare;
  const spokes = look === 'fivespoke' ? 5 : look === 'multispoke' ? 10 : look === 'forged' ? 7 : look === 'turbine' ? 12 : look === 'aero' ? 5 : 0;
  return (
    <g>
      <circle cx={x} cy={y} r={R} fill={`url(#t${uid})`} />
      <circle cx={x} cy={y} r={R - 2.2} fill="none" stroke="#2b2e35" strokeWidth="1.2" />
      {(era === 'fifties') && <circle cx={x} cy={y} r={R * 0.74} fill="none" stroke="#efefe8" strokeWidth={R * 0.12} />}
      <circle cx={x} cy={y} r={rr * 0.82} fill="#3a3f47" />
      {caliper && <path d={`M${f(x + rr * 0.35)} ${f(y - rr * 0.62)}a${f(rr * 0.72)} ${f(rr * 0.72)} 0 0 1 ${f(rr * 0.35)} ${f(rr * 0.5)}`} stroke={caliper} strokeWidth={rr * 0.22} fill="none" strokeLinecap="round" />}
      <g className={spin ? 'car2d-spin' : undefined} style={{ transformOrigin: `${x}px ${y}px` }}>
        {look === 'steel' && <><circle cx={x} cy={y} r={rr} fill="#2d3239" stroke="#596170" strokeWidth="1.5" />{Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return <circle key={i} cx={x + Math.cos(a) * rr * 0.6} cy={y + Math.sin(a) * rr * 0.6} r={rr * 0.11} fill="#14171b" />; })}<circle cx={x} cy={y} r={rr * 0.32} fill={`url(#m${uid})`} /></>}
        {look === 'hubcap' && <><circle cx={x} cy={y} r={rr} fill={`url(#m${uid})`} stroke="#ffffff" strokeOpacity="0.6" /><circle cx={x} cy={y} r={rr * 0.55} fill="#c5ccd5" stroke="#8e98a5" /><circle cx={x - rr * 0.18} cy={y - rr * 0.18} r={rr * 0.16} fill="#ffffff" opacity="0.7" /></>}
        {spokes > 0 && <>
          <circle cx={x} cy={y} r={rr} fill={look === 'aero' ? '#262b33' : 'none'} stroke={look === 'aero' ? '#aeb7c3' : '#c9d0d8'} strokeWidth={rr * 0.11} />
          {Array.from({ length: spokes }, (_, i) => {
            const a = (i / spokes) * Math.PI * 2 - Math.PI / 2;
            const w = look === 'fivespoke' ? rr * 0.3 : look === 'aero' ? rr * 0.2 : look === 'forged' ? rr * 0.12 : rr * 0.12;
            const ex = x + Math.cos(a) * rr * 0.95, ey = y + Math.sin(a) * rr * 0.95;
            if (look === 'turbine') { const b = a + 0.5; return <path key={i} d={`M${f(x)} ${f(y)}Q${f(x + Math.cos(b) * rr * 0.6)} ${f(y + Math.sin(b) * rr * 0.6)} ${f(ex)} ${f(ey)}`} stroke="#b9c1cc" strokeWidth={rr * 0.1} fill="none" />; }
            if (look === 'forged') { const s = 0.18; return <g key={i} stroke="#d6dce4" strokeWidth={w} strokeLinecap="round"><line x1={x} y1={y} x2={x + Math.cos(a - s) * rr * 0.94} y2={y + Math.sin(a - s) * rr * 0.94} /><line x1={x} y1={y} x2={x + Math.cos(a + s) * rr * 0.94} y2={y + Math.sin(a + s) * rr * 0.94} /></g>; }
            return <line key={i} x1={x} y1={y} x2={ex} y2={ey} stroke={look === 'aero' ? '#c3cad3' : '#c9d0d8'} strokeWidth={w} strokeLinecap="round" />;
          })}
          {look === 'aero' && <circle cx={x} cy={y} r={rr * 0.92} fill="none" stroke="#7f8996" strokeWidth={rr * 0.06} />}
          <circle cx={x} cy={y} r={rr * 0.2} fill="#2a2f37" stroke="#9aa4b1" strokeWidth="1" />
        </>}
      </g>
    </g>
  );
}
