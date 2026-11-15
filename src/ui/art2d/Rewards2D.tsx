// Chests and collectible cards. Each rarity has its own material, colour, glow and opening effect; cards show the
// blueprint's own illustration (wheel, engine, body kit or chassis) in a rarity frame with a foil sheen from
// legendary up. Animations are CSS (empire2d.css) and stop under prefers-reduced-motion.
import { memo, useId } from 'react';
import type { Blueprint, PartRarity } from '../../sim/progression';
import { RARITY } from '../../sim/progression';
import { Car2D, Wheel } from './Car2D';
import { Engine2D } from './Engine2D';
import { Chassis2D } from './Parts2D';
import { shade } from './svg';

export const RARITY_ORDER: PartRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic', 'relic'];
const MATERIAL: Record<PartRarity, { wood: string; band: string; gem: string }> = {
  common: { wood: '#6b4a2f', band: '#9aa3ad', gem: '#c7d0da' },
  rare: { wood: '#2f4f7a', band: '#8fc4f2', gem: '#66b4f5' },
  epic: { wood: '#3c2a5e', band: '#c8a2ff', gem: '#be83ff' },
  legendary: { wood: '#5a3d12', band: '#f6d58b', gem: '#f0c36c' },
  mythic: { wood: '#5a1a33', band: '#ff9cc4', gem: '#ef7eac' },
  relic: { wood: '#0f4a45', band: '#9ff5e2', gem: '#75ead0' },
};

export const Chest2D = memo(function Chest2D({ rarity = 'common', state = 'closed', className }: { rarity?: PartRarity; state?: 'closed' | 'ready' | 'opening' | 'open'; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const m = MATERIAL[rarity];
  const tier = RARITY_ORDER.indexOf(rarity);
  return (
    <div className={`chest2d chest2d-${rarity} chest2d-${state} ${className ?? ''}`} role="img" aria-label={`${RARITY[rarity].en} chest`}>
      <svg viewBox="0 0 160 140">
        <defs>
          <radialGradient id={`g${id}`}><stop offset="0" stopColor={m.gem} stopOpacity="0.85" /><stop offset="1" stopColor={m.gem} stopOpacity="0" /></radialGradient>
          <linearGradient id={`w${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={shade(m.wood, 0.25)} /><stop offset="1" stopColor={shade(m.wood, -0.35)} /></linearGradient>
        </defs>
        {(state === 'ready' || state === 'opening' || state === 'open') && <circle className="chest2d-glow" cx="80" cy="76" r="66" fill={`url(#g${id})`} />}
        {state === 'opening' || state === 'open' ? <g className="chest2d-rays">{Array.from({ length: 8 + tier * 2 }, (_, i) => { const a = (i / (8 + tier * 2)) * Math.PI * 2; return <path key={i} d={`M80 60L${80 + Math.cos(a) * 80} ${60 + Math.sin(a) * 80}`} stroke={m.gem} strokeWidth={2 + tier * 0.6} strokeOpacity="0.55" />; })}</g> : null}
        <ellipse cx="80" cy="126" rx="56" ry="7" fill="#000" opacity="0.4" />
        {/* box */}
        <rect x="26" y="66" width="108" height="56" rx="8" fill={`url(#w${id})`} stroke={shade(m.wood, -0.6)} strokeWidth="2" />
        {[40, 80, 120].map((x) => <rect key={x} x={x - 5} y="66" width="10" height="56" fill={m.band} opacity="0.9" />)}
        <rect x="26" y="66" width="108" height="8" fill={m.band} opacity="0.9" />
        {/* lid (rotates open) */}
        <g className="chest2d-lid" style={{ transformOrigin: '80px 66px' }}>
          <path d="M26 66V54Q26 26 80 24Q134 26 134 54V66Z" fill={`url(#w${id})`} stroke={shade(m.wood, -0.6)} strokeWidth="2" />
          {[40, 80, 120].map((x) => <path key={x} d={`M${x - 5} 66V${x === 80 ? 24 : 32}h10V66Z`} fill={m.band} opacity="0.9" />)}
        </g>
        {/* lock and gem */}
        <rect x="68" y="62" width="24" height="24" rx="5" fill={m.band} stroke={shade(m.band, -0.5)} />
        <path d="M80 66l7 8l-7 8l-7 -8z" fill={m.gem} stroke="#fff" strokeOpacity="0.6" />
        {tier >= 3 && <g className="chest2d-sparkles" fill="#fff">{[[30, 30], [132, 40], [120, 100], [36, 104]].slice(0, tier - 1).map(([x, y], i) => <path key={i} d={`M${x} ${y - 5}l1.5 3.5l3.5 1.5l-3.5 1.5l-1.5 3.5l-1.5 -3.5l-3.5 -1.5l3.5 -1.5z`} />)}</g>}
      </svg>
    </div>
  );
});

/** The illustration on a card: what the blueprint actually is. */
export function BlueprintArt({ part }: { part: Blueprint }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  if (part.slot === 'wheels') {
    const look = part.id === 'steel-rims' ? 'steel' : part.id === 'five-spoke' ? 'fivespoke' : 'forged';
    return <svg viewBox="0 0 120 90" className="part2d">
      <defs><radialGradient id={`t${uid}`} cx="50%" cy="45%" r="55%"><stop offset="0.72" stopColor="#1b1d22" /><stop offset="1" stopColor="#050506" /></radialGradient><linearGradient id={`m${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f4f6f8" /><stop offset="0.5" stopColor="#9aa4b1" /><stop offset="1" stopColor="#d7dde4" /></linearGradient></defs>
      <Wheel x={60} y={45} R={38} rimShare={0.68} look={look} caliper={look === 'forged' ? '#d2342c' : null} uid={uid} />
    </svg>;
  }
  if (part.slot === 'engine') {
    const engine = part.id === 'inline-four' ? { layout: 'I4' as const, displacement: 1600, valvetrain: 'ohv' as const }
      : part.id === 'aluminium-v6' ? { layout: 'V6' as const, displacement: 3000, valvetrain: 'dohc4' as const }
      : part.id === 'twinturbo' ? { layout: 'I6' as const, displacement: 3000, aspiration: 'twinturbo' as const, valvetrain: 'dohc4' as const }
      : part.id === 'race-v8' ? { layout: 'V8' as const, displacement: 5000, redline: 8500, valvetrain: 'dohc4' as const }
      : part.id === 'hybrid' ? { layout: 'V6' as const, displacement: 3500, hybridKw: 120, aspiration: 'turbo' as const }
      : { layout: 'EV' as const, motorKw: 400, batteryKwh: 100 };
    return <Engine2D engine={engine} compact />;
  }
  if (part.slot === 'chassis') {
    const type = part.id === 'steel-frame' ? 'ladder' : part.id === 'spaceframe' ? 'spaceframe' : part.id === 'carbon-frame' ? 'carbon' : 'steel';
    return <Chassis2D type={type} />;
  }
  const body = part.id === 'sedan' ? 'sedan' : part.id === 'hyperbody' ? 'supercar' : 'coupe';
  return <Car2D body={body} year={part.firstYear < 1980 ? 1968 : 2012} color={RARITY[part.rarity].color} equipped={{ body: part.id }} ground={false} />;
}

const SLOT_EN = { body: 'BODY', wheels: 'WHEELS', engine: 'ENGINE', chassis: 'CHASSIS' } as const;
const SLOT_ES = { body: 'CARROCERÍA', wheels: 'RUEDAS', engine: 'MOTOR', chassis: 'CHASIS' } as const;
export const PartCard = memo(function PartCard({ part, owned = 0, equipped = false, locked = false, lang, children }: { part: Blueprint; owned?: number; equipped?: boolean; locked?: boolean; lang: 'en' | 'es'; children?: React.ReactNode }) {
  const r = RARITY[part.rarity], tier = RARITY_ORDER.indexOf(part.rarity);
  return (
    <article className={`card2d card2d-${part.rarity}${tier >= 3 ? ' card2d-foil' : ''}${owned ? '' : ' card2d-missing'}${locked ? ' card2d-locked' : ''}${equipped ? ' card2d-equipped' : ''}`} style={{ ['--rar' as string]: r.color }} data-part={part.id}>
      <header><span className="card2d-rarity">{lang === 'es' ? r.es : r.en}</span><span className="card2d-stars" aria-label={`${tier + 1} / 6`}>{'★'.repeat(tier + 1)}</span></header>
      <div className="card2d-art"><BlueprintArt part={part} /></div>
      <h4>{lang === 'es' ? part.es : part.en}</h4>
      <footer><span>{(lang === 'es' ? SLOT_ES : SLOT_EN)[part.slot]}</span><span>{part.firstYear}+</span>{owned > 1 && <span>×{owned}</span>}</footer>
      {children}
    </article>
  );
});
