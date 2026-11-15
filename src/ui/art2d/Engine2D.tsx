// Engine illustrations drawn from the simulation's engine specification: the cylinder count and arrangement (inline,
// V, flat), the valvetrain (pushrod or overhead cams), induction (turbos, supercharger), the block material, hybrid
// assistance, and electric drive units. Pure SVG.
import { memo, useId } from 'react';
import type { EngineSpec, EngineLayout } from '../../sim/types';
import { CYL } from '../../sim/engineering';
import { f } from './svg';

type Kind = 'inline' | 'v' | 'flat' | 'ev';
const kindOf = (l: EngineLayout): Kind => (l === 'EV' ? 'ev' : l.startsWith('V') ? 'v' : l.startsWith('F') ? 'flat' : 'inline');

export interface Engine2DProps { engine: Pick<EngineSpec, 'layout'> & Partial<EngineSpec>; label?: string; accent?: string; className?: string; compact?: boolean }

export const Engine2D = memo(function Engine2D({ engine, label, accent = '#e8b04a', className, compact = false }: Engine2DProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const kind = kindOf(engine.layout);
  const n = CYL[engine.layout] || 0;
  const alu = engine.aluBlock ?? true;
  const block = alu ? ['#d9dee5', '#9aa5b3', '#6c7685'] : ['#8a9099', '#5b616b', '#3a3f47'];
  const ohc = engine.valvetrain && engine.valvetrain !== 'ohv';
  const racy = (engine.redline ?? 6500) >= 7800;
  const cover = racy ? '#c8322b' : ohc ? '#22252b' : '#3d5a8c';
  const turbos = engine.aspiration === 'twinturbo' ? 2 : engine.aspiration === 'turbo' ? 1 : 0;
  const blower = engine.aspiration === 'supercharged';
  const hybrid = (engine.hybridKw ?? 0) > 0;
  const text = label ?? (kind === 'ev' ? `EV · ${Math.round(engine.motorKw ?? 150)} kW` : `${engine.layout} · ${((engine.displacement ?? 2000) / 1000).toFixed(1)} L${turbos ? (turbos === 2 ? ' · twin-turbo' : ' · turbo') : blower ? ' · supercharged' : ''}${hybrid ? ' · hybrid' : ''}`);
  return (
    <div className={'engine2d ' + (className ?? '')} role="img" aria-label={text}>
      <svg viewBox="0 0 280 190" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={`k${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={block[0]} /><stop offset="0.55" stopColor={block[1]} /><stop offset="1" stopColor={block[2]} /></linearGradient>
          <linearGradient id={`c${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={cover} stopOpacity="1" /><stop offset="1" stopColor="#000" stopOpacity="0.55" /></linearGradient>
          <linearGradient id={`h${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f0d6a8" /><stop offset="1" stopColor="#a0612d" /></linearGradient>
          <linearGradient id={`m${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f4f6f8" /><stop offset="0.5" stopColor="#8f99a6" /><stop offset="1" stopColor="#d5dbe2" /></linearGradient>
          <radialGradient id={`s${id}`}><stop offset="0" stopColor="#000" stopOpacity="0.5" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
        </defs>
        <ellipse cx="140" cy="168" rx="112" ry="10" fill={`url(#s${id})`} />
        {kind === 'inline' && <Inline n={n} id={id} ohc={!!ohc} turbos={turbos} blower={blower} hybrid={hybrid} />}
        {kind === 'v' && <VBlock n={n} id={id} ohc={!!ohc} turbos={turbos} blower={blower} hybrid={hybrid} />}
        {kind === 'flat' && <Flat n={n} id={id} turbos={turbos} />}
        {kind === 'ev' && <Ev id={id} battery={engine.batteryKwh ?? 60} />}
        {!compact && <g><rect x="62" y="6" width="156" height="20" rx="10" fill="#0d1520" stroke={accent} strokeOpacity="0.55" /><text x="140" y="20" textAnchor="middle" fontSize={text.length > 24 ? 8.5 : 11} fontWeight="700" letterSpacing="1.2" fill={accent} fontFamily="system-ui, sans-serif">{text.toUpperCase()}</text></g>}
      </svg>
    </div>
  );
});

function Pulleys({ x, y }: { x: number; y: number }) {
  return <g><circle cx={x} cy={y} r="13" fill="#1b1f25" stroke="#7d8794" strokeWidth="2" /><circle cx={x} cy={y} r="4" fill="#9aa4b1" /><circle cx={x + 6} cy={y - 34} r="8" fill="#1b1f25" stroke="#7d8794" strokeWidth="2" /><path d={`M${x - 13} ${y}L${x - 2} ${y - 36}M${x + 13} ${y}L${x + 14} ${y - 34}`} stroke="#0c0e11" strokeWidth="3" /></g>;
}
function Turbo({ x, y, id, flip = false }: { x: number; y: number; id: string; flip?: boolean }) {
  return <g transform={flip ? `translate(${x * 2} 0) scale(-1 1)` : undefined}>
    <path d={`M${x} ${y}m-14 0a14 14 0 1 0 28 0a14 14 0 1 0 -28 0`} fill={`url(#h${id})`} stroke="#5c3418" strokeWidth="1.5" />
    <path d={`M${x} ${y}m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0`} fill="#2a2d33" />
    <path d={`M${x + 10} ${y - 9}l14 -8l4 6l-12 9z`} fill={`url(#m${id})`} />
  </g>;
}

function Inline({ n, id, ohc, turbos, blower, hybrid }: { n: number; id: string; ohc: boolean; turbos: number; blower: boolean; hybrid: boolean }) {
  const w = 34 + n * 22, x = 140 - w / 2;
  return <g>
    {/* bellhousing and oil pan */}
    <path d={`M${x + w} 72h18l10 22v40l-10 20h-18z`} fill="#5e6672" />
    <rect x={x + 6} y={128} width={w - 12} height={22} rx={6} fill="#3a3f47" />
    {/* block */}
    <rect x={x} y={78} width={w} height={56} rx={6} fill={`url(#k${id})`} stroke="#2a2f37" />
    {Array.from({ length: n }, (_, i) => <rect key={i} x={x + 12 + i * 22} y={86} width={14} height={40} rx={3} fill="#000" opacity="0.08" />)}
    {/* head and cam cover(s) */}
    <rect x={x - 2} y={60} width={w + 4} height={20} rx={4} fill="#7c8592" />
    {ohc
      ? <><rect x={x + 2} y={44} width={w - 4} height={14} rx={6} fill={`url(#c${id})`} /><rect x={x + 2} y={34} width={w - 4} height={12} rx={6} fill={`url(#c${id})`} opacity="0.85" /></>
      : <rect x={x + 2} y={42} width={w - 4} height={20} rx={8} fill={`url(#c${id})`} />}
    {Array.from({ length: n }, (_, i) => <rect key={i} x={x + 14 + i * 22} y={ohc ? 28 : 36} width={8} height={10} rx={2} fill="#14171b" />)}
    {/* intake runners (left) and exhaust header (right below) */}
    {Array.from({ length: n }, (_, i) => <path key={i} d={`M${x + 18 + i * 22} 98q-6 18 -2 30`} stroke={`url(#m${id})`} strokeWidth="6" fill="none" opacity="0.9" />)}
    <path d={`M${x + 8} 136h${w - 16}`} stroke="#8c5a2e" strokeWidth="5" strokeLinecap="round" />
    <Pulleys x={x - 12} y={120} />
    {turbos >= 1 && <Turbo x={x + w * 0.35} y={156} id={id} />}
    {turbos >= 2 && <Turbo x={x + w * 0.7} y={156} id={id} />}
    {blower && <g><rect x={x + w * 0.25} y={14} width={w * 0.5} height={22} rx={8} fill={`url(#m${id})`} stroke="#59616d" /><path d={`M${x + w * 0.25} 25L${x - 12} 86`} stroke="#0c0e11" strokeWidth="3" /></g>}
    {hybrid && <g><circle cx={x + w + 30} cy={104} r={18} fill="#1f3a52" stroke="#4cc3ff" strokeWidth="2" /><path d={`M${x + w + 30} 122q10 30 -40 36`} stroke="#ff8a2a" strokeWidth="4" fill="none" /></g>}
  </g>;
}

function VBlock({ n, id, ohc, turbos, blower, hybrid }: { n: number; id: string; ohc: boolean; turbos: number; blower: boolean; hybrid: boolean }) {
  const per = n / 2;
  const bank = (side: -1 | 1) => {
    const len = 20 + per * 14;
    return <g transform={`translate(140 112) rotate(${side * 34}) translate(${-14 + side * 0} ${-len})`}>
      <rect x={0} y={0} width={28} height={len} rx={5} fill={`url(#k${id})`} stroke="#2a2f37" />
      <rect x={-4} y={-4} width={36} height={ohc ? 18 : 14} rx={6} fill={`url(#c${id})`} />
      {Array.from({ length: per }, (_, i) => <rect key={i} x={10} y={22 + i * 14} width={8} height={6} rx={2} fill="#14171b" />)}
    </g>;
  };
  return <g>
    <path d="M86 124h108l-8 34h-92z" fill="#3a3f47" />
    <path d="M96 96h88l10 30h-108z" fill={`url(#k${id})`} stroke="#2a2f37" />
    {bank(-1)}{bank(1)}
    {/* intake plenum in the valley */}
    <rect x={118} y={blower ? 46 : 60} width={44} height={blower ? 40 : 30} rx={10} fill={blower ? `url(#m${id})` : '#2b3038'} stroke="#59616d" />
    {!blower && <rect x={124} y={50} width={32} height={12} rx={6} fill={`url(#m${id})`} />}
    <circle cx="140" cy="140" r="14" fill="#1b1f25" stroke="#7d8794" strokeWidth="2" /><circle cx="140" cy="140" r="4" fill="#9aa4b1" />
    {turbos >= 1 && <Turbo x={64} y={120} id={id} flip />}
    {turbos >= 2 && <Turbo x={216} y={120} id={id} />}
    {hybrid && <g><circle cx={140} cy={168} r={14} fill="#1f3a52" stroke="#4cc3ff" strokeWidth="2" /><path d="M154 168q40 4 60 -14" stroke="#ff8a2a" strokeWidth="4" fill="none" /></g>}
  </g>;
}

function Flat({ n, id, turbos }: { n: number; id: string; turbos: number }) {
  const per = n / 2;
  const bank = (side: -1 | 1) => <g>
    <rect x={side < 0 ? 40 : 160} y={92} width={80} height={36} rx={6} fill={`url(#k${id})`} stroke="#2a2f37" />
    <rect x={side < 0 ? 26 : 236} y={88} width={18} height={44} rx={6} fill={`url(#c${id})`} />
    {Array.from({ length: per }, (_, i) => <rect key={i} x={side < 0 ? 50 + i * (60 / per) : 170 + i * (60 / per)} y={96} width={6} height={28} rx={2} fill="#000" opacity="0.12" />)}
  </g>;
  return <g>
    {bank(-1)}{bank(1)}
    <rect x={112} y={80} width={56} height={60} rx={10} fill="#5e6672" />
    <rect x={118} y={56} width={44} height={28} rx={8} fill="#2b3038" stroke="#59616d" />
    <circle cx="140" cy="148" r="14" fill="#1b1f25" stroke="#7d8794" strokeWidth="2" />
    {turbos >= 1 && <Turbo x={70} y={156} id={id} />}
    {turbos >= 2 && <Turbo x={210} y={156} id={id} />}
  </g>;
}

function Ev({ id, battery }: { id: string; battery: number }) {
  const cells = Math.max(4, Math.min(12, Math.round(battery / 10)));
  return <g>
    {/* battery pack */}
    <rect x="30" y="134" width="220" height="24" rx="6" fill="#1c2b3c" stroke="#3f6d95" />
    {Array.from({ length: cells }, (_, i) => <rect key={i} x={36 + i * (208 / cells)} y={139} width={208 / cells - 4} height={14} rx={2} fill="#2f5b85" />)}
    {/* motor with cooling fins */}
    <rect x="66" y="62" width="96" height="62" rx="28" fill={`url(#k${id})`} stroke="#2a2f37" />
    {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M${f(78 + i * 10)} 66v54`} stroke="#000" strokeOpacity="0.12" strokeWidth="3" />)}
    <circle cx="66" cy="93" r="16" fill="#3a3f47" stroke="#8a94a2" strokeWidth="2" />
    {/* reduction gear and inverter */}
    <rect x="160" y="70" width="40" height="48" rx="8" fill="#5e6672" />
    <rect x="166" y="34" width="70" height="34" rx="6" fill="#2a3340" stroke="#59616d" />
    <path d="M176 51h50" stroke="#4cc3ff" strokeWidth="2" strokeDasharray="4 3" />
    <path d="M236 52q22 6 10 82" stroke="#ff8a2a" strokeWidth="5" fill="none" strokeLinecap="round" />
    <path d="M200 52q-60 -6 -76 10" stroke="#ff8a2a" strokeWidth="5" fill="none" strokeLinecap="round" />
  </g>;
}
