// The company campus: an isometric illustration that grows with the real state of the game. Head office height
// follows sales, every plant is drawn (sized by capacity, scaffolding while it is being built or enlarged, robots
// when automated), the design centre and laboratory grow with engineers and technology, a showroom with the dealer
// network, a test track appears with a racing division or real volume, and the trophy hall lights up with
// achievements. Buildings are reached through accessible buttons laid over the drawing.
import { memo, useEffect, useState } from 'react';
import { iso, pts, shade } from './svg';

export interface CampusPlant { id: string; name: string; capacity: number; building: boolean; automation: number }
export interface CampusState {
  name: string; color: string; officeTier: 1 | 2 | 3 | 4; studioTier: 1 | 2 | 3; labTier: 1 | 2 | 3;
  plants: CampusPlant[]; showroomTier: 0 | 1 | 2 | 3; track: boolean; racing: boolean; trophies: number; billboard: boolean; stock: number; night?: boolean;
}
export type CampusSpot = 'office' | 'studio' | 'lab' | 'factory' | 'showroom' | 'track' | 'trophies' | 'billboard';

// scale and origin keep the whole 60×60 site and the tallest head office (tier 4) inside the 1000×560 drawing
const S = 7.4, OX = 500, OY = 118;
/** Head-office height by tier (world units); the hub places its button above the roof. */
export const OFFICE_H = [0, 8, 12, 15, 18] as const;
const P = (x: number, y: number, z = 0): [number, number] => { const [a, b] = iso(x, y, z, S); return [a + OX, b + OY]; };
/** Screen position of a world point as a percentage of the drawing (for the button overlay). */
export const spotPos = (x: number, y: number, z = 0) => { const [a, b] = P(x, y, z); return { left: `${(a / 1000) * 100}%`, top: `${(b / 560) * 100}%` }; };

function Box({ x, y, w, d, h, c, win, glass = false, rows = 0 }: { x: number; y: number; w: number; d: number; h: number; c: string; win?: string; glass?: boolean; rows?: number }) {
  const top = [P(x, y, h), P(x + w, y, h), P(x + w, y + d, h), P(x, y + d, h)];
  const left = [P(x, y + d, 0), P(x + w, y + d, 0), P(x + w, y + d, h), P(x, y + d, h)];
  const right = [P(x + w, y, 0), P(x + w, y + d, 0), P(x + w, y + d, h), P(x + w, y, h)];
  const wins: React.ReactNode[] = [];
  if (rows > 0 && win) {
    const rh = h / (rows + 1);
    for (let r = 0; r < rows; r++) {
      const z0 = rh * (r + 0.6), z1 = z0 + rh * 0.55;
      for (let i = 0; i < Math.max(2, Math.floor(w / 2.2)); i++) {
        const a = x + 0.8 + i * 2.2; if (a + 1.2 > x + w - 0.5) break;
        wins.push(<polygon key={`l${r}-${i}`} points={pts([P(a, y + d, z0), P(a + 1.2, y + d, z0), P(a + 1.2, y + d, z1), P(a, y + d, z1)])} fill={win} className={(r * 7 + i * 3) % 5 === 0 ? 'campus-light' : undefined} />);
      }
      for (let i = 0; i < Math.max(2, Math.floor(d / 2.2)); i++) {
        const a = y + 0.8 + i * 2.2; if (a + 1.2 > y + d - 0.5) break;
        wins.push(<polygon key={`r${r}-${i}`} points={pts([P(x + w, a, z0), P(x + w, a + 1.2, z0), P(x + w, a + 1.2, z1), P(x + w, a, z1)])} fill={win} opacity="0.85" />);
      }
    }
  }
  return <g>
    <polygon points={pts(left)} fill={shade(c, -0.18)} />
    <polygon points={pts(right)} fill={shade(c, -0.38)} />
    <polygon points={pts(top)} fill={shade(c, 0.12)} />
    {glass && <polygon points={pts(left)} fill="#7fc4ee" opacity="0.35" />}
    {wins}
  </g>;
}

function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const [a, b] = P(x, y, 0);
  return <g><rect x={a - 1.5} y={b - 10 * s} width={3} height={10 * s} fill="#5a3d24" /><circle cx={a} cy={b - 14 * s} r={8 * s} fill="#2f6b4a" /><circle cx={a - 3} cy={b - 17 * s} r={5 * s} fill="#3f8a5f" /></g>;
}

function Plant({ p, x, y, color }: { p: CampusPlant; x: number; y: number; color: string }) {
  const size = p.capacity >= 3000 ? 3 : p.capacity >= 600 ? 2 : 1;
  const w = [0, 8, 10.5, 12][size], d = [0, 7, 10, 13][size], h = [0, 4.2, 5.5, 7][size];
  const [cx, cy] = P(x + w * 0.85, y + 1.5, h + 6);
  const robots = p.automation >= 0.55;
  return <g className={p.building ? 'campus-building' : undefined}>
    <Box x={x} y={y} w={w} d={d} h={h} c={p.building ? '#7b8593' : '#a9b3bf'} win="#ffd88a" rows={1} />
    {/* sawtooth roof lights */}
    {Array.from({ length: Math.max(2, Math.floor(w / 3)) }, (_, i) => <polygon key={i} points={pts([P(x + 1 + i * 3, y + 1, h), P(x + 2.6 + i * 3, y + 1, h), P(x + 2.6 + i * 3, y + d - 1, h + 1.6), P(x + 1 + i * 3, y + d - 1, h + 1.6)])} fill="#5f88ad" opacity="0.85" />)}
    {/* chimney and smoke */}
    <Box x={x + w * 0.8} y={y + 1} w={1.2} d={1.2} h={h + 5} c="#8c6b55" />
    {!p.building && <g className="campus-smoke">{[0, 1, 2].map((i) => <circle key={i} cx={cx} cy={cy - 6} r={4 + i} fill="#d8dde3" opacity="0.5" style={{ animationDelay: `${i * 1.2}s` }} />)}</g>}
    {/* stripe in the company colour */}
    <polygon points={pts([P(x, y + d, h * 0.82), P(x + w, y + d, h * 0.82), P(x + w, y + d, h * 0.95), P(x, y + d, h * 0.95)])} fill={color} />
    {robots && <g>{[0.3, 0.55, 0.8].map((t, i) => { const [a, b] = P(x + w * t, y + d, 1.6); return <circle key={i} cx={a} cy={b} r={2.4} fill="#4cc3ff" className="campus-light" style={{ animationDelay: `${i * 0.5}s` }} />; })}</g>}
    {p.building && <g stroke="#e8b04a" strokeWidth="1.2" opacity="0.9">
      {Array.from({ length: 5 }, (_, i) => { const [a1, b1] = P(x + i * (w / 4), y + d + 0.4, 0); const [a2, b2] = P(x + i * (w / 4), y + d + 0.4, h + 2); return <line key={i} x1={a1} y1={b1} x2={a2} y2={b2} />; })}
      {(() => { const [a1, b1] = P(x - 1, y + d + 0.4, h * 0.5); const [a2, b2] = P(x + w + 1, y + d + 0.4, h * 0.5); return <line x1={a1} y1={b1} x2={a2} y2={b2} />; })()}
      {(() => { const [a, b] = P(x + w + 2, y + 2, 0); return <g className="campus-crane" style={{ transformOrigin: `${a}px ${b - 70}px` }}><line x1={a} y1={b} x2={a} y2={b - 70} strokeWidth="2.5" /><line x1={a - 30} y1={b - 70} x2={a + 40} y2={b - 70} strokeWidth="2.5" /><line x1={a + 30} y1={b - 70} x2={a + 30} y2={b - 52} /></g>; })()}
    </g>}
  </g>;
}

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const Campus2D = memo(function Campus2D({ s, active, extraPlants = 0 }: { s: CampusState; active?: CampusSpot | null; extraPlants?: number }) {
  const [still, setStill] = useState(true);
  useEffect(() => { setStill(reducedMotion()); }, []);
  const officeH = OFFICE_H[s.officeTier];
  const plants = s.plants.slice(0, 4);
  const plantSlots: [number, number][] = [[2, 25], [15, 25], [2, 41], [15, 41]];
  const road = `M${P(-2, 21).join(' ')}L${P(62, 21).join(' ')}`;
  const road2 = `M${P(31, -2).join(' ')}L${P(31, 62).join(' ')}`;
  const trackPath = (() => { const c = P(46, 50, 0); return `M${c[0] - 70} ${c[1]}a70 30 0 1 0 140 0a70 30 0 1 0 -140 0`; })();
  const hl = (spot: CampusSpot) => (active === spot ? ' campus-hl' : '');
  return (
    <svg className={'campus2d' + (s.night ? ' campus-night' : '')} viewBox="0 0 1000 560" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="campus-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0f1e33" /><stop offset="1" stopColor="#24456a" /></linearGradient>
        <linearGradient id="campus-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b6e4f" /><stop offset="1" stopColor="#285a3f" /></linearGradient>
      </defs>
      <rect width="1000" height="560" fill="url(#campus-sky)" />
      {/* skyline */}
      <g fill="#183250" opacity="0.8">{[[40, 120], [90, 90], [140, 140], [820, 110], [870, 150], [930, 95]].map(([x, h], i) => <rect key={i} x={x} y={200 - h} width="44" height={h} />)}</g>
      <polygon points={pts([P(0, 0), P(60, 0), P(60, 60), P(0, 60)])} fill="url(#campus-ground)" />
      <polygon points={pts([P(0, 18), P(60, 18), P(60, 23.5), P(0, 23.5)])} fill="#3b4048" />
      <polygon points={pts([P(28.5, 0), P(33.5, 0), P(33.5, 60), P(28.5, 60)])} fill="#3b4048" />
      <path d={road} stroke="#e7d9a7" strokeWidth="1.5" strokeDasharray="10 10" opacity="0.6" transform="translate(0 12)" />
      {!still && <g>
        <circle r="4" fill={s.color}><animateMotion dur="9s" repeatCount="indefinite" path={road} /></circle>
        <circle r="4" fill="#e8e3d6"><animateMotion dur="12s" begin="3s" repeatCount="indefinite" path={road} keyPoints="1;0" keyTimes="0;1" calcMode="linear" /></circle>
        <rect width="14" height="7" rx="2" fill="#d9a441"><animateMotion dur="14s" begin="1s" repeatCount="indefinite" path={road2} rotate="auto" /></rect>
      </g>}

      {/* trees (behind the buildings) */}
      {[[1, 1], [18, 1.5], [35, 1], [58, 2], [1, 17], [59, 22], [59, 34], [1, 58], [26, 58], [36, 40], [59, 58]].map(([x, y], i) => <Tree key={i} x={x} y={y} s={0.9 + (i % 3) * 0.15} />)}
      {/* test track */}
      {s.track && <g className={'campus-spot' + hl('track')}>
        <path d={trackPath} fill="none" stroke="#4a4f58" strokeWidth="16" />
        <path d={trackPath} fill="none" stroke="#e8e6df" strokeWidth="1" strokeDasharray="6 8" opacity="0.6" />
        {!still && s.racing && <><circle r="4.5" fill={s.color}><animateMotion dur="4s" repeatCount="indefinite" path={trackPath} /></circle><circle r="4.5" fill="#ef4444"><animateMotion dur="4.4s" begin="0.6s" repeatCount="indefinite" path={trackPath} /></circle></>}
      </g>}

      {/* head office */}
      <g className={'campus-spot' + hl('office')}>
        <Box x={6} y={4} w={10} d={10} h={officeH} c="#6f88a8" win="#ffe2a0" glass rows={Math.max(2, Math.round(officeH / 3))} />
        {s.officeTier >= 3 && <Box x={16.5} y={6} w={3} d={7} h={6} c="#5d7594" win="#ffe2a0" rows={2} />}
        {s.officeTier >= 4 && (() => { const [c, d] = P(14, 5, officeH); return <g><line x1={c} y1={d} x2={c} y2={d - 26} stroke="#c9d4e0" strokeWidth="2" /><circle cx={c} cy={d - 27} r="2.5" fill="#ef4444" className="campus-light" /></g>; })()}
        {(() => { const [a, b] = P(11, 14, officeH - 1.5); /* name sign on the façade; the roof is left for the hub's button */ return <g><rect x={a - 44} y={b - 18} width="88" height="16" rx="3" fill="#0d1520" stroke={s.color} /><text x={a} y={b - 6} textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">{s.name.slice(0, 16).toUpperCase()}</text></g>; })()}
      </g>
      {/* design studio */}
      <g className={'campus-spot' + hl('studio')}>
        <Box x={20} y={4} w={6 + s.studioTier * 2} d={8} h={4 + s.studioTier} c="#c9a46b" win="#fff2c7" rows={1} />
        {(() => { const [a, b] = P(23 + s.studioTier, 8, 5 + s.studioTier); return <ellipse cx={a} cy={b} rx={14 + s.studioTier * 4} ry={7 + s.studioTier * 2} fill="#8fd0f5" opacity="0.75" stroke="#e6f6ff" />; })()}
      </g>
      {/* laboratory */}
      <g className={'campus-spot' + hl('lab')}>
        <Box x={38} y={4} w={6 + s.labTier * 2} d={7} h={3.5 + s.labTier * 1.5} c="#7e9aa6" win="#9ff0d8" rows={s.labTier} />
        {(() => { const [a, b] = P(41, 7, 4 + s.labTier * 1.5); return <g><line x1={a} y1={b} x2={a} y2={b - 22} stroke="#c9d0d8" strokeWidth="2" /><path d={`M${a - 10} ${b - 22}a10 6 0 0 0 20 0z`} fill="#dfe6ee" /><circle cx={a} cy={b - 26} r="2.5" fill="#ef4444" className="campus-light" /></g>; })()}
      </g>
      {/* plants */}
      <g className={'campus-spot' + hl('factory')}>
        {plants.length === 0 && (() => { const [a, b] = P(8, 30); return <g><polygon points={pts([P(2, 25), P(14, 25), P(14, 36), P(2, 36)])} fill="#2c4a39" stroke="#e8b04a" strokeDasharray="6 5" /><text x={a} y={b} fill="#e8b04a" fontSize="11" textAnchor="middle" fontFamily="system-ui, sans-serif">+</text></g>; })()}
        {plants.map((p, i) => <Plant key={p.id} p={p} x={plantSlots[i][0]} y={plantSlots[i][1]} color={s.color} />)}
        {extraPlants > 0 && (() => { const [a, b] = P(27, 55, 2); return <g><rect x={a - 20} y={b - 12} width="40" height="18" rx="9" fill="#0d1520" stroke="#e8b04a" /><text x={a} y={b + 1} textAnchor="middle" fontSize="11" fontWeight="700" fill="#e8b04a" fontFamily="system-ui, sans-serif">+{extraPlants}</text></g>; })()}
      </g>
      {/* showroom */}
      <g className={'campus-spot' + hl('showroom')}>
        {s.showroomTier > 0 ? <Box x={36} y={25} w={6 + s.showroomTier * 2} d={8} h={3 + s.showroomTier} c="#d7dde4" win="#bfe7ff" glass rows={1} />
          : <polygon points={pts([P(36, 25), P(44, 25), P(44, 33), P(36, 33)])} fill="#2c4a39" stroke="#9aa4b1" strokeDasharray="5 5" />}
        {Array.from({ length: Math.min(6, Math.ceil(s.stock / 500)) }, (_, i) => { const [a, b] = P(37 + (i % 3) * 3, 35 + Math.floor(i / 3) * 2.2); return <rect key={i} x={a - 5} y={b - 3} width="10" height="5" rx="2" fill={i % 2 ? s.color : '#e8e3d6'} />; })}
      </g>
      {/* billboard */}
      <g className={'campus-spot' + hl('billboard')}>
        {(() => { const [a, b] = P(56, 16, 0); return <g><rect x={a - 1.5} y={b - 40} width="3" height="40" fill="#59616d" /><rect x={a - 30} y={b - 62} width="60" height="26" rx="3" fill={s.billboard ? s.color : '#2b3038'} stroke="#0d1520" />{s.billboard && <text x={a} y={b - 45} textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">{s.name.slice(0, 12).toUpperCase()}</text>}</g>; })()}
      </g>
      {/* trophy hall */}
      <g className={'campus-spot' + hl('trophies')}>
        <Box x={52} y={40} w={6} d={6} h={4} c="#b9a27a" win="#ffe9a6" rows={1} />
        {(() => { const [a, b] = P(55, 43, 4.5); return <path d={`M${a - 16} ${b}a16 12 0 0 1 32 0z`} fill={s.trophies > 0 ? '#e8b04a' : '#7b8593'} className={s.trophies > 0 ? 'campus-light' : undefined} />; })()}
      </g>
    </svg>
  );
});

/** World anchor of each spot for the button overlay. */
export const SPOT_ANCHOR: Record<CampusSpot, [number, number, number]> = {
  office: [11, 9, 30], studio: [24, 8, 12], lab: [42, 7, 12], factory: [12, 30, 12], showroom: [40, 29, 10], track: [46, 50, 2], trophies: [55, 43, 9], billboard: [56, 16, 9],
};
