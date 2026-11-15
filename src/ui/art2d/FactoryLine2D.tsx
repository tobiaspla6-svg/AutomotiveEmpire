// A cut-away of one assembly plant, left to right through its seven sectors: raw materials → body shop → paint →
// powertrain → final assembly → inspection → dispatch. What is drawn follows the real plant: robots replace workers as
// automation rises, the busiest stage glows, the bottleneck flashes, bodies move along the line while it is producing.
import { memo } from 'react';
import { shade } from './svg';

export type Sector = 'materials' | 'body' | 'paint' | 'powertrain' | 'assembly' | 'inspection' | 'dispatch';
export const SECTORS: Sector[] = ['materials', 'body', 'paint', 'powertrain', 'assembly', 'inspection', 'dispatch'];
export interface SectorLoad { use: number; bottleneck?: boolean; working?: boolean }

const W = 1120, H = 300, SW = W / 7;

function Worker({ x, y, c = '#e8b04a' }: { x: number; y: number; c?: string }) {
  return <g className="fl-worker"><circle cx={x} cy={y - 26} r="5" fill="#f1c9a5" /><rect x={x - 5} y={y - 21} width="10" height="14" rx="3" fill={c} /><rect x={x - 5} y={y - 8} width="4" height="10" fill="#26303c" /><rect x={x + 1} y={y - 8} width="4" height="10" fill="#26303c" /><path d={`M${x - 6} ${y - 30}h12`} stroke="#f4d03f" strokeWidth="4" strokeLinecap="round" /></g>;
}
function Robot({ x, y, i = 0 }: { x: number; y: number; i?: number }) {
  return <g className="fl-robot" style={{ animationDelay: `${i * 0.4}s`, transformOrigin: `${x}px ${y - 10}px` }}>
    <rect x={x - 9} y={y - 8} width="18" height="8" rx="2" fill="#f08a24" />
    <path d={`M${x} ${y - 8}L${x - 6} ${y - 36}L${x + 16} ${y - 46}`} stroke="#f08a24" strokeWidth="6" strokeLinecap="round" fill="none" />
    <circle cx={x - 6} cy={y - 36} r="4" fill="#2b3038" /><circle cx={x + 16} cy={y - 46} r="3" fill="#e8f6ff" className="fl-spark" />
  </g>;
}
function Shell({ x, y, color, painted = false, wheels = false }: { x: number; y: number; color: string; painted?: boolean; wheels?: boolean }) {
  const c = painted ? color : '#b8c0ca';
  return <g><path d={`M${x - 30} ${y}l4 -12l14 -4l8 -9h22l10 9l8 3v13z`} fill={c} stroke={shade(c, -0.4)} strokeWidth="1" />
    {wheels && <><circle cx={x - 16} cy={y + 1} r="5" fill="#15181d" /><circle cx={x + 18} cy={y + 1} r="5" fill="#15181d" /></>}</g>;
}

export const FactoryLine2D = memo(function FactoryLine2D({ load, automation, color, active, onPick, labels }: { load: Record<Sector, SectorLoad>; automation: number; color: string; active: Sector; onPick: (s: Sector) => void; labels: Record<Sector, string> }) {
  const robots = automation >= 0.75 ? 3 : automation >= 0.45 ? 2 : automation >= 0.2 ? 1 : 0;
  const workers = Math.max(1, 3 - robots);
  const floor = 236;
  const producing = SECTORS.some((s) => load[s].working);
  return (
    <div className="fl2d">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Plant">
        <defs>
          <linearGradient id="fl-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#24364d" /><stop offset="1" stopColor="#152234" /></linearGradient>
          <linearGradient id="fl-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a4352" /><stop offset="1" stopColor="#262d38" /></linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#fl-wall)" />
        {/* roof trusses and skylights */}
        {Array.from({ length: 14 }, (_, i) => <path key={i} d={`M${i * 80} 18l40 -14l40 14`} stroke="#3c5576" strokeWidth="3" fill="none" />)}
        {Array.from({ length: 7 }, (_, i) => <rect key={i} x={i * SW + 40} y={26} width={SW - 80} height={10} rx="2" fill="#7fb6e0" opacity="0.25" />)}
        <rect y={floor} width={W} height={H - floor} fill="url(#fl-floor)" />
        {/* conveyor */}
        <rect x={SW * 0.9} y={floor - 14} width={SW * 5.2} height={10} rx="4" fill="#59616d" />
        {Array.from({ length: 26 }, (_, i) => <circle key={i} cx={SW * 0.95 + i * 40} cy={floor - 9} r="3" fill="#2b3038" />)}

        {SECTORS.map((s, i) => {
          const x = i * SW, cx = x + SW / 2, L = load[s];
          const tone = L.bottleneck ? '#ef4444' : L.use > 0.9 ? '#f59e0b' : L.use > 0.05 ? '#22c55e' : '#64748b';
          return <g key={s} className={'fl-sector' + (active === s ? ' on' : '') + (L.bottleneck ? ' fl-bottleneck' : '')} onClick={() => onPick(s)}>
            <rect x={x + 4} y={46} width={SW - 8} height={floor - 50} rx="10" fill={active === s ? '#ffffff' : '#000'} opacity={active === s ? 0.07 : 0.0} />
            <rect x={x + 10} y={52} width={SW - 20} height="6" rx="3" fill={tone} opacity="0.9" />
            {/* sector equipment */}
            {s === 'materials' && <g>{[0, 1, 2].map((k) => <g key={k}><ellipse cx={x + 40 + k * 34} cy={floor - 18} rx="14" ry="18" fill="#8d99a8" stroke="#525c69" /><ellipse cx={x + 40 + k * 34} cy={floor - 18} rx="5" ry="7" fill="#3a414b" /></g>)}<rect x={x + 30} y={floor - 70} width="40" height="30" fill="#a0784f" stroke="#6b4f33" /><rect x={x + 78} y={floor - 60} width="40" height="20" fill="#a0784f" stroke="#6b4f33" /><g className="fl-forklift"><rect x={x + 112} y={floor - 30} width="26" height="22" rx="3" fill="#f2b632" /><path d={`M${x + 138} ${floor - 40}v32h12`} stroke="#2b3038" strokeWidth="3" fill="none" /></g></g>}
            {s === 'body' && <g><rect x={x + 22} y={floor - 120} width="40" height="80" fill="#4b5563" /><rect x={x + 18} y={floor - 128} width="48" height="14" fill="#6b7280" /><Shell x={cx + 20} y={floor - 16} color={color} />{Array.from({ length: robots }, (_, k) => <Robot key={k} x={cx - 10 + k * 34} y={floor - 14} i={k} />)}{Array.from({ length: robots ? 0 : workers }, (_, k) => <Worker key={k} x={cx + k * 24} y={floor - 14} />)}</g>}
            {s === 'paint' && <g><rect x={x + 16} y={70} width={SW - 32} height={floor - 92} rx="6" fill="#cfe8f6" opacity="0.12" stroke="#7fb6e0" /><Shell x={cx} y={floor - 16} color={color} painted />{producing && <g className="fl-mist">{[0, 1, 2, 3].map((k) => <circle key={k} cx={cx - 20 + k * 14} cy={floor - 52 - (k % 2) * 8} r="7" fill={color} opacity="0.3" />)}</g>}{Array.from({ length: Math.min(2, robots) }, (_, k) => <Robot key={k} x={x + 30 + k * 90} y={floor - 14} i={k} />)}</g>}
            {s === 'powertrain' && <g><rect x={cx - 34} y={86} width="68" height="6" fill="#59616d" /><path d={`M${cx} 92v40`} stroke="#9aa4b1" strokeWidth="2" /><rect x={cx - 18} y={132} width="36" height="26" rx="4" fill="#9aa4b1" stroke="#525c69" /><rect x={cx - 14} y={124} width="28" height="10" rx="4" fill="#c8322b" /><Shell x={cx} y={floor - 16} color={color} painted />{Array.from({ length: workers }, (_, k) => <Worker key={k} x={x + 26 + k * 20} y={floor - 14} c="#4cc3ff" />)}</g>}
            {s === 'assembly' && <g><Shell x={cx - 4} y={floor - 16} color={color} painted wheels /><rect x={x + 18} y={floor - 60} width="22" height="40" fill="#3a4352" />{[0, 1, 2].map((k) => <circle key={k} cx={x + 29} cy={floor - 52 + k * 13} r="5" fill="#15181d" />)}{Array.from({ length: workers + 1 }, (_, k) => <Worker key={k} x={x + 60 + k * 26} y={floor - 14} c="#22c55e" />)}{robots > 1 && <Robot x={x + SW - 30} y={floor - 14} i={2} />}</g>}
            {s === 'inspection' && <g><path d={`M${x + 20} ${floor - 10}V${floor - 110}H${x + SW - 20}V${floor - 10}`} stroke="#e8f6ff" strokeWidth="6" fill="none" opacity="0.85" /><g className="fl-scan"><rect x={x + 24} y={floor - 104} width="6" height="94" fill="#7df9ff" opacity="0.6" /></g><Shell x={cx} y={floor - 16} color={color} painted wheels /><Worker x={x + SW - 30} y={floor - 14} c="#a78bfa" /></g>}
            {s === 'dispatch' && <g><rect x={x + 14} y={floor - 64} width="120" height="44" rx="4" fill="#d1d5db" stroke="#6b7280" /><rect x={x + 134} y={floor - 56} width="22" height="36" rx="4" fill={color} /><circle cx={x + 34} cy={floor - 14} r="9" fill="#15181d" /><circle cx={x + 112} cy={floor - 14} r="9" fill="#15181d" /><circle cx={x + 146} cy={floor - 14} r="9" fill="#15181d" /><Shell x={x + 60} y={floor - 70} color={color} painted wheels /><Shell x={x + 104} y={floor - 70} color={color} painted wheels /></g>}
            {/* label */}
            <rect x={x + 12} y={floor + 14} width={SW - 24} height="40" rx="8" fill="#0d1520" stroke={active === s ? '#e8b04a' : '#2b3a4f'} />
            <text x={cx} y={floor + 31} textAnchor="middle" fontSize="12" fontWeight="700" fill="#e8eef6" fontFamily="system-ui, sans-serif">{labels[s]}</text>
            <text x={cx} y={floor + 47} textAnchor="middle" fontSize="11" fill={tone} fontFamily="system-ui, sans-serif">{Math.round(L.use * 100)}%</text>
          </g>;
        })}
        {/* bodies moving down the line */}
        {producing && <g className="fl-flow">{[0, 1, 2].map((k) => <g key={k} style={{ animationDelay: `${k * 2.6}s` }}><Shell x={SW * 1.1} y={236 - 16} color={color} painted wheels /></g>)}</g>}
      </svg>
    </div>
  );
});
