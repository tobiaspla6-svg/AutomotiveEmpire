import { useRef, useState, type ReactNode } from 'react';
import { clamp, fmtMoney } from '../sim/util';

export function Slider(p: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; fmt?: (v: number) => string; disabled?: boolean; hint?: string }) {
  return (
    <label className={'field' + (p.disabled ? ' locked' : '')} title={p.hint}>
      <span className="lab"><span>{p.label}</span><span className="val">{p.fmt ? p.fmt(p.value) : p.value}</span></span>
      <input type="range" min={p.min} max={p.max} step={p.step ?? 1} value={p.value} disabled={p.disabled} onChange={(e) => p.onChange(Number(e.target.value))} />
    </label>
  );
}
export function Select<T extends string | number>(p: { label?: string; value: T; options: { value: T; label: string; disabled?: boolean; note?: string }[]; onChange: (v: T) => void; hint?: string }) {
  const isNum = typeof p.value === 'number';
  const sel = (
    <select value={String(p.value)} onChange={(e) => p.onChange((isNum ? Number(e.target.value) : e.target.value) as T)}>
      {p.options.map((o) => <option key={String(o.value)} value={String(o.value)} disabled={o.disabled}>{o.label}{o.note ? ` — ${o.note}` : ''}</option>)}
    </select>
  );
  return p.label ? <label className="field" title={p.hint}><span className="lab"><span>{p.label}</span></span>{sel}</label> : sel;
}
export function Seg<T extends string | number>(p: { value: T; options: { value: T; label: string; disabled?: boolean; title?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group">
      {p.options.map((o) => <button type="button" key={String(o.value)} className={o.value === p.value ? 'on' : ''} aria-pressed={o.value === p.value} disabled={o.disabled} title={o.title} onClick={() => p.onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}
export const Kpi = (p: { label: string; value: ReactNode; detail?: ReactNode; cls?: string }) => (
  <div className="kpi"><span className="l">{p.label}</span><span className={'v ' + (p.cls ?? '')}>{p.value}</span>{p.detail && <span className="d">{p.detail}</span>}</div>
);
export const StatLine = (p: { label: ReactNode; value: ReactNode; title?: string }) => <div className="statline" title={p.title}><span className="dim">{p.label}</span><span>{p.value}</span></div>;
export const Tag = (p: { kind?: 'h' | 'e' | 'a' | 'r'; children: ReactNode; title?: string }) => <span className={'tag ' + (p.kind ?? '')} title={p.title}>{p.children}</span>;
/** Data-status tags: H = historical fact, A = approximate historical, E = estimated game data. */
export const Src = ({ k }: { k: 'h' | 'a' | 'e' }) => <Tag kind={k} title={k === 'h' ? 'Historical fact (public record)' : k === 'a' ? 'Approximate historical figure' : 'Estimated game data — not a historical figure'}>{k === 'h' ? 'historical' : k === 'a' ? 'approx.' : 'estimate'}</Tag>;
export function Meter({ value, max = 100, color }: { value: number; max?: number; color?: string }) {
  return <div className="meter"><i style={{ width: `${clamp((value / max) * 100, 0, 100)}%`, background: color }} /></div>;
}
export function ScoreBar({ label, value, color = 'var(--s1)' }: { label: string; value: number; color?: string }) {
  return <div className="scorebar"><span className="dim">{label}</span><Meter value={value} color={color} /><span className="num" style={{ textAlign: 'right' }}>{Math.round(value)}</span></div>;
}
export const Money = ({ v, sign }: { v: number; sign?: boolean }) => <span className={'num ' + (sign ? (v < 0 ? 'bad' : v > 0 ? 'good' : '') : '')}>{fmtMoney(v)}</span>;
export function PageHead(p: { title: string; children?: ReactNode; right?: ReactNode }) {
  return <div className="pagehead"><div className="col" style={{ gap: 4 }}><h2>{p.title}</h2>{p.children && <p>{p.children}</p>}</div>{p.right}</div>;
}
export function Modal(p: { children: ReactNode; onClose?: () => void; wide?: boolean }) {
  return <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) p.onClose?.(); }}><div className="modal" style={p.wide ? { maxWidth: 900 } : undefined} role="dialog" aria-modal="true">{p.children}</div></div>;
}

// ------------------------------------------------------------------------------------ charts
// One y-axis per chart, 2px lines, recessive grid, legend for ≥2 series, crosshair + tooltip.
export interface Series { name: string; color: string; values: number[] }
const niceStep = (range: number, n: number) => { const raw = range / n; const p = Math.pow(10, Math.floor(Math.log10(raw))); const f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; };

export function LineChart(p: { series: Series[]; labels: string[]; height?: number; width?: number; fmt?: (v: number) => string; zero?: boolean; xTitle?: string }) {
  const W = p.width ?? 640, H = p.height ?? 190, padL = 54, padR = 12, padT = 10, padB = 24;
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const fmt = p.fmt ?? ((v: number) => String(Math.round(v)));
  const n = Math.max(1, ...p.series.map((s) => s.values.length));
  const all = p.series.flatMap((s) => s.values).filter((v) => isFinite(v));
  if (!all.length) return <div className="muted small" style={{ padding: 20 }}>No data yet — advance time to build a history.</div>;
  let lo = Math.min(...all), hi = Math.max(...all);
  if (p.zero !== false) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (hi === lo) { hi += 1; lo -= lo === 0 ? 0 : 1; }
  const step = niceStep(hi - lo, 4);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const X = (i: number) => padL + (n <= 1 ? 0.5 : i / (n - 1)) * (W - padL - padR);
  const Y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const ticks: number[] = []; for (let v = lo; v <= hi + step * 0.01; v += step) ticks.push(v);
  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    setHover(clamp(Math.round(((x - padL) / (W - padL - padR)) * (n - 1)), 0, n - 1));
  };
  const xt = Math.max(1, Math.ceil(n / 6));
  return (
    <div style={{ position: 'relative' }}>
      {p.series.length > 1 && <div className="row wrap small" style={{ gap: 12, marginBottom: 4 }}>{p.series.map((s) => <span key={s.name} className="row" style={{ gap: 5 }}><i className="swatch" style={{ background: s.color }} /><span className="dim">{s.name}</span></span>)}</div>}
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={p.series.map((s) => s.name).join(', ')}>
        {ticks.map((t) => <g key={t}><line x1={padL} x2={W - padR} y1={Y(t)} y2={Y(t)} stroke={Math.abs(t) < step * 1e-6 ? '#4a505c' : '#242830'} strokeWidth={1} /><text x={padL - 6} y={Y(t) + 4} textAnchor="end" fontSize={11} fill="#8b8d93">{fmt(t)}</text></g>)}
        {p.labels.map((l, i) => ((i % xt === 0 && n - 1 - i >= xt * 0.7) || i === n - 1) && i < n ? <text key={i} x={X(i)} y={H - 6} textAnchor={i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle'} fontSize={11} fill="#8b8d93">{l}</text> : null)}
        {p.series.map((s) => <polyline key={s.name} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={s.values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')} />)}
        {hover !== null && <g>
          <line x1={X(hover)} x2={X(hover)} y1={padT} y2={H - padB} stroke="#6f7686" strokeWidth={1} />
          {p.series.map((s) => s.values[hover] !== undefined && <circle key={s.name} cx={X(hover)} cy={Y(s.values[hover])} r={4} fill={s.color} stroke="#14161b" strokeWidth={2} />)}
        </g>}
      </svg>
      {hover !== null && (
        <div style={{ position: 'absolute', top: 4, left: `${clamp((X(hover) / W) * 100, 12, 70)}%`, transform: 'translateX(8px)', background: '#21252c', border: '1px solid #444a57', borderRadius: 8, padding: '6px 9px', fontSize: 12, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 2 }}>
          <div className="muted">{p.labels[hover] ?? ''}{p.xTitle ? ` ${p.xTitle}` : ''}</div>
          {p.series.map((s) => s.values[hover] !== undefined && <div key={s.name} className="row" style={{ gap: 6 }}><i className="swatch" style={{ background: s.color }} /><span className="dim">{s.name}</span><b className="num" style={{ marginLeft: 'auto', paddingLeft: 10 }}>{fmt(s.values[hover])}</b></div>)}
        </div>
      )}
    </div>
  );
}

/** Horizontal bars for a part-to-whole breakdown; values are direct-labelled. */
export function BarList(p: { items: { label: string; value: number; color?: string }[]; fmt?: (v: number) => string; total?: boolean }) {
  const max = Math.max(1e-9, ...p.items.map((i) => Math.abs(i.value)));
  const sum = p.items.reduce((a, i) => a + i.value, 0);
  const fmt = p.fmt ?? ((v: number) => String(Math.round(v)));
  return (
    <div className="col" style={{ gap: 5 }}>
      {p.items.map((it) => (
        <div key={it.label} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 76px', gap: 8, alignItems: 'center', fontSize: 12.5 }} title={`${it.label}: ${fmt(it.value)}${sum ? ` (${Math.round((it.value / sum) * 100)}%)` : ''}`}>
          <span className="dim" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
          <div style={{ height: 10, background: '#252932', borderRadius: 4 }}><div style={{ width: `${(Math.abs(it.value) / max) * 100}%`, height: '100%', background: it.color ?? 'var(--s1)', borderRadius: 4 }} /></div>
          <span className="num" style={{ textAlign: 'right' }}>{fmt(it.value)}</span>
        </div>
      ))}
      {p.total && <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 76px', gap: 8, fontSize: 12.5, borderTop: '1px solid var(--line)', paddingTop: 5 }}><b>Total</b><span /><b className="num" style={{ textAlign: 'right' }}>{fmt(sum)}</b></div>}
    </div>
  );
}
export const PALETTE = ['#6ea8f0', '#dd8c55', '#3fbfa0', '#c9a35c', '#d6728f', '#7fbf5e', '#9d8ff2', '#ea6b5b'];
