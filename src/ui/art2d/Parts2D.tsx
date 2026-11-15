// Small technical illustrations of the parts the workshop offers: chassis structures, gearboxes, suspensions, brakes
// and tyres. Each is a 120×90 SVG in the same flat-vector style as the cars and engines.
import { memo, useId } from 'react';
import type { BrakeType, ChassisType, Gearbox, SuspType, TireCompound } from '../../sim/types';

const Frame = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <svg className="part2d" viewBox="0 0 120 90" role="img" aria-label={label}>{children}</svg>
);

export const Chassis2D = memo(function Chassis2D({ type }: { type: ChassisType }) {
  const c = { ladder: '#7b8593', steel: '#a8b2bf', spaceframe: '#e0b45c', aluminium: '#d4dbe3', carbon: '#2a2d33' }[type];
  return <Frame label={type}>
    {type === 'ladder' && <g stroke={c} strokeWidth="5" strokeLinecap="round"><path d="M14 30H106M14 60H106" />{[22, 44, 66, 88].map((x) => <path key={x} d={`M${x} 30V60`} strokeWidth="4" />)}</g>}
    {(type === 'steel' || type === 'aluminium') && <g><path d="M12 62Q12 40 30 34L48 22H78L98 36Q110 40 110 62Z" fill={c} stroke="#3a414b" strokeWidth="2" /><path d="M50 26H76L90 38H40Z" fill="#1b2430" opacity="0.6" /><path d="M58 26V60M84 36V60" stroke="#3a414b" strokeWidth="2" />{type === 'aluminium' && <path d="M16 56H106" stroke="#fff" strokeOpacity="0.6" strokeWidth="2" />}</g>}
    {type === 'spaceframe' && <g stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round"><path d="M12 62H108L96 30H30Z" /><path d="M30 30L48 62L62 30L76 62L96 30M12 62L30 30" /><path d="M40 30L50 16H82L96 30" /><path d="M50 16L62 30M82 16L76 30" /></g>}
    {type === 'carbon' && <g><path d="M16 60Q16 36 40 30L56 20H82L100 34Q108 40 106 60Z" fill={c} stroke="#5a606b" strokeWidth="2" />{Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${20 + i * 10} 58L${30 + i * 10} 32`} stroke="#4a4f58" strokeWidth="2" opacity="0.6" />)}<path d="M56 22H82L96 34H48Z" fill="#11161d" opacity="0.7" /></g>}
  </Frame>;
});

export const Gearbox2D = memo(function Gearbox2D({ type, gears = 5 }: { type: Gearbox; gears?: number }) {
  return <Frame label={`${type} ${gears}`}>
    <path d="M18 34H78L102 46V70H18Z" fill="#8b95a3" stroke="#3a414b" strokeWidth="2" />
    {type === 'auto' && <circle cx="30" cy="52" r="18" fill="#6c7685" stroke="#3a414b" strokeWidth="2" />}
    {type === 'dct' && <g><circle cx="30" cy="46" r="11" fill="#6c7685" stroke="#3a414b" /><circle cx="30" cy="62" r="11" fill="#5b6574" stroke="#3a414b" /></g>}
    {type === 'manual' && <g><path d="M60 34V14" stroke="#2b3038" strokeWidth="4" /><circle cx="60" cy="12" r="7" fill="#1b1f25" /><path d="M86 18h18M86 26h18M92 14v16M100 14v16" stroke="#c9d0d8" strokeWidth="1.5" /></g>}
    <text x="58" y="62" textAnchor="middle" fontSize="13" fontWeight="800" fill="#1b2430" fontFamily="system-ui, sans-serif">{gears}</text>
  </Frame>;
});

export const Suspension2D = memo(function Suspension2D({ type }: { type: SuspType }) {
  return <Frame label={type}>
    <circle cx="86" cy="58" r="22" fill="#15181d" stroke="#3a3f47" strokeWidth="3" /><circle cx="86" cy="58" r="10" fill="#9aa4b1" />
    {type === 'solid' && <g><path d="M8 58H86" stroke="#7b8593" strokeWidth="7" /><path d="M20 40Q44 30 68 40" stroke="#c9d0d8" strokeWidth="3" fill="none" /><path d="M20 44Q44 34 68 44" stroke="#c9d0d8" strokeWidth="3" fill="none" /></g>}
    {type === 'macpherson' && <g><path d="M70 50L48 70" stroke="#7b8593" strokeWidth="5" /><path d="M76 40L64 8" stroke="#c9d0d8" strokeWidth="6" />{[14, 20, 26, 32].map((y) => <path key={y} d={`M60 ${y}h16`} stroke="#e0b45c" strokeWidth="2.5" />)}</g>}
    {type === 'wishbone' && <g stroke="#7b8593" strokeWidth="5" strokeLinecap="round"><path d="M70 42L36 30L40 46Z" fill="#7b8593" /><path d="M70 72L32 74L36 60Z" fill="#7b8593" /><path d="M56 36L50 68" stroke="#e0b45c" strokeWidth="4" /></g>}
    {type === 'multilink' && <g stroke="#7b8593" strokeWidth="3.5" strokeLinecap="round"><path d="M70 44L30 30M70 50L28 46M70 66L30 64M70 72L34 80" /><path d="M54 38L50 70" stroke="#e0b45c" strokeWidth="4" /></g>}
  </Frame>;
});

export const Brake2D = memo(function Brake2D({ type }: { type: BrakeType }) {
  return <Frame label={type}>
    {type === 'drum'
      ? <g><circle cx="60" cy="45" r="32" fill="#4c535e" stroke="#2a2f37" strokeWidth="3" /><circle cx="60" cy="45" r="22" fill="#6c7685" />{[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={60 + Math.cos(i * 1.26) * 12} cy={45 + Math.sin(i * 1.26) * 12} r="3" fill="#2a2f37" />)}</g>
      : <g><circle cx="60" cy="45" r="34" fill={type === 'ceramic' ? '#3b3f46' : '#aab3bf'} stroke="#59616d" strokeWidth="2" /><circle cx="60" cy="45" r="14" fill="#6c7685" />
        {type !== 'disc' && Array.from({ length: 18 }, (_, i) => { const a = (i / 18) * Math.PI * 2; return <circle key={i} cx={60 + Math.cos(a) * 25} cy={45 + Math.sin(a) * 25} r="1.8" fill="#2a2f37" />; })}
        <path d="M84 20Q102 45 84 70" stroke={type === 'ceramic' ? '#e8b04a' : type === 'vented' ? '#c8322b' : '#59616d'} strokeWidth="13" fill="none" strokeLinecap="round" /></g>}
  </Frame>;
});

export const Tyre2D = memo(function Tyre2D({ compound, width = 205 }: { compound: TireCompound; width?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const tread = { economy: 9, touring: 7, sport: 4, semislick: 0 }[compound];
  return <Frame label={`${compound} ${width}`}>
    <defs><linearGradient id={`t${id}`} x1="0" x2="1"><stop offset="0" stopColor="#0d0e10" /><stop offset="0.5" stopColor="#2a2d33" /><stop offset="1" stopColor="#0d0e10" /></linearGradient></defs>
    <rect x={60 - width / 8} y="8" width={width / 4} height="74" rx="12" fill={`url(#t${id})`} />
    {Array.from({ length: tread }, (_, i) => <path key={i} d={`M${60 - width / 8 + 4} ${14 + i * (62 / Math.max(1, tread))}h${width / 4 - 8}`} stroke="#4a4f58" strokeWidth="2" />)}
    {compound === 'semislick' && <path d={`M60 12V78`} stroke="#e8b04a" strokeWidth="2" />}
  </Frame>;
});
