// Design-system building blocks used by the redesigned screens. Each one is a small pure component: data in, markup
// out, no simulation logic.
import { memo, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { clamp } from '../../sim/util';
import { Icon, type IconName } from './icons';

export type Tone = 'neutral' | 'good' | 'bad' | 'warn' | 'info' | 'accent';
export const TONE_COLOR: Record<Tone, string> = { neutral: 'var(--ink2)', good: 'var(--good)', bad: 'var(--bad)', warn: 'var(--warn)', info: 'var(--info)', accent: 'var(--accent2)' };

/** A titled surface. `eyebrow` is the small technical label above the title; `action` sits on the right. */
export function Panel({ title, eyebrow, action, children, className = '', pad = true }: { title?: ReactNode; eyebrow?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`panel ds-panel ${pad ? '' : 'flush'} ${className}`}>
      {(title || eyebrow || action) && (
        <header className="ds-panel-head">
          <div className="ds-panel-titles">{eyebrow && <span className="eyebrow">{eyebrow}</span>}{title && <h3>{title}</h3>}</div>
          {action && <div className="ds-panel-action">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Up/down arrow with a signed percentage. `goodWhenUp` flips the colour for measures where down is good (debt, cost). */
export const DeltaBadge = memo(function DeltaBadge({ text, value, goodWhenUp = true }: { text: string; value: number; goodWhenUp?: boolean }) {
  const flat = Math.abs(value) < 0.0005;
  const good = flat ? null : value > 0 === goodWhenUp;
  return (
    <span className={'delta ' + (flat ? 'flat' : good ? 'up' : 'down')}>
      {!flat && <Icon name={value > 0 ? 'up' : 'down'} size={12} strokeWidth={2.4} />}{text}
    </span>
  );
});

/** Minimal trend line with an optional soft fill. No axes: it shows shape, the value next to it gives the number. */
export const Sparkline = memo(function Sparkline({ values, color = 'var(--s1)', height = 34, width = 120, fill = true, className }: { values: number[]; color?: string; height?: number; width?: number; fill?: boolean; className?: string }) {
  const id = useId();
  const v = values.filter((x) => isFinite(x));
  if (v.length < 2) return <svg width={width} height={height} className={className} aria-hidden="true" />;
  // a flat-ish series must look flat: the vertical span is at least 14 % of the level, centred on the data
  const dMin = Math.min(...v), dMax = Math.max(...v), mid = (dMin + dMax) / 2;
  const span = Math.max(dMax - dMin, Math.abs(mid) * 0.14, 1e-9), lo = mid - span / 2;
  const X = (i: number) => (i / (v.length - 1)) * (width - 2) + 1;
  const Y = (x: number) => height - 3 - ((x - lo) / span) * (height - 6);
  const pts = v.map((x, i) => `${X(i).toFixed(1)},${Y(x).toFixed(1)}`);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true" preserveAspectRatio="none">
      {fill && <><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.28" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        <polygon points={`1,${height} ${pts.join(' ')} ${width - 1},${height}`} fill={`url(#${id})`} /></>}
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={X(v.length - 1)} cy={Y(v[v.length - 1])} r={2.2} fill={color} />
    </svg>
  );
});

/** Headline metric: icon, label, big value, comparison and a trend. The unit of the "command centre" band. */
export const KpiTile = memo(function KpiTile({ label, value, icon, tone = 'neutral', delta, sub, spark, sparkColor, onClick, title }: {
  label: ReactNode; value: ReactNode; icon?: IconName; tone?: Tone; delta?: ReactNode; sub?: ReactNode; spark?: number[]; sparkColor?: string; onClick?: () => void; title?: string;
}) {
  const body = (
    <>
      <div className="kt-top"><span className="kt-label">{icon && <Icon name={icon} size={15} />}{label}</span>{delta}</div>
      <div className="kt-main"><span className="kt-value display" style={tone !== 'neutral' ? { color: TONE_COLOR[tone] } : undefined}>{value}</span>{spark && <Sparkline values={spark} color={sparkColor ?? (tone === 'neutral' ? 'var(--s1)' : TONE_COLOR[tone])} />}</div>
      {sub && <div className="kt-sub">{sub}</div>}
    </>
  );
  return onClick
    ? <button type="button" className="kpi-tile click" onClick={onClick} title={title}>{body}</button>
    : <div className="kpi-tile" title={title}>{body}</div>;
});

/** Circular gauge for a single 0–1 ratio (utilisation, completion). */
export const RingGauge = memo(function RingGauge({ value, size = 74, stroke = 7, tone = 'info', label, sub }: { value: number; size?: number; stroke?: number; tone?: Tone; label?: ReactNode; sub?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = clamp(value, 0, 1);
  return (
    <div className="ring" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(v * 100)}%`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TONE_COLOR[tone === 'neutral' ? 'info' : tone]} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray 0.6s var(--ease)' }} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="ring-n">{Math.round(v * 100)}%</text>
      </svg>
      {label && <div className="ring-l">{label}</div>}{sub && <div className="ring-s">{sub}</div>}
    </div>
  );
});

/** One labelled horizontal bar; `marker` draws a tick (a target, a capacity limit). */
export const HBar = memo(function HBar({ label, value, max = 1, color = 'var(--s1)', right, marker, title }: { label: ReactNode; value: number; max?: number; color?: string; right?: ReactNode; marker?: number; title?: string }) {
  return (
    <div className={'hbar' + (label === '' ? ' nolabel' : '')} title={title}>
      <span className="hb-l">{label}</span>
      <div className="hb-track"><i style={{ width: `${clamp((value / (max || 1)) * 100, 0, 100)}%`, background: color }} />{marker !== undefined && <b style={{ left: `${clamp((marker / (max || 1)) * 100, 0, 100)}%` }} />}</div>
      <span className="hb-r num">{right}</span>
    </div>
  );
});

/** Tab strip for switching a chart or panel's view. */
export function Tabs<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {options.map((o) => <button key={o.id} type="button" role="tab" data-tab={o.id} aria-selected={o.id === value} className={'tab' + (o.id === value ? ' on' : '')} onClick={() => onChange(o.id)}>{o.label}</button>)}
    </div>
  );
}

export function EmptyState({ icon = 'info', title, children }: { icon?: IconName; title: ReactNode; children?: ReactNode }) {
  return <div className="empty"><Icon name={icon} size={22} /><b>{title}</b>{children && <span className="dim">{children}</span>}</div>;
}

// ------------------------------------------------------------------------------------------------ trend chart
export interface TrendSeries { name: string; color: string; values: number[]; dashed?: boolean }

/**
 * Multi-series trend chart: soft area under the first series, recessive grid, direct end-labels, a crosshair with a
 * tooltip, and an explicit zero line. Accessible: the chart has a text summary for screen readers.
 */
export function TrendChart({ series, labels, fmt, height = 230, summary }: { series: TrendSeries[]; labels: string[]; fmt: (v: number) => string; height?: number; summary?: string }) {
  const W = 760, H = height, padL = 58, padR = 14, padT = 12, padB = 26;
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const id = useId();
  const n = Math.max(0, ...series.map((s) => s.values.length));
  const geo = useMemo(() => {
    const all = series.flatMap((s) => s.values).filter(isFinite);
    if (!all.length) return null;
    let lo = Math.min(0, ...all), hi = Math.max(0, ...all);
    if (hi === lo) hi = lo + 1;
    const raw = (hi - lo) / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    const step = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * mag;
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    const ticks: number[] = []; for (let v = lo; v <= hi + step * 0.01; v += step) ticks.push(v);
    return { lo, hi, ticks, step };
  }, [series]);
  if (!geo || n < 2) return <EmptyState icon="clock" title="…" />;
  const X = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const Y = (v: number) => padT + (1 - (v - geo.lo) / (geo.hi - geo.lo)) * (H - padT - padB);
  const onMove = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); setHover(clamp(Math.round((((e.clientX - r.left) / r.width) * W - padL) / (W - padL - padR) * (n - 1)), 0, n - 1)); };
  const xt = Math.max(1, Math.ceil(n / 6));
  const first = series[0];
  return (
    <div className="trend">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary ?? series.map((s) => s.name).join(', ')} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={first.color} stopOpacity="0.22" /><stop offset="1" stopColor={first.color} stopOpacity="0" /></linearGradient></defs>
        {geo.ticks.map((t) => <g key={t}><line x1={padL} x2={W - padR} y1={Y(t)} y2={Y(t)} stroke={Math.abs(t) < geo.step * 1e-6 ? '#4a505c' : '#20242b'} strokeWidth={1} /><text x={padL - 8} y={Y(t) + 4} textAnchor="end" className="axis">{fmt(t)}</text></g>)}
        {labels.map((l, i) => (i % xt === 0 || i === n - 1) && (n - 1 - i >= xt * 0.7 || i === n - 1) ? <text key={i} x={X(i)} y={H - 7} textAnchor={i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle'} className="axis">{l}</text> : null)}
        <polygon points={`${X(0)},${Y(Math.max(0, geo.lo))} ${first.values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')} ${X(first.values.length - 1)},${Y(Math.max(0, geo.lo))}`} fill={`url(#${id})`} />
        {series.map((s) => <polyline key={s.name} points={s.values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2.1} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '5 4' : undefined} />)}
        {hover !== null ? <g>
          <line x1={X(hover)} x2={X(hover)} y1={padT} y2={H - padB} stroke="#6f7686" strokeWidth={1} />
          {series.map((s) => s.values[hover] !== undefined && <circle key={s.name} cx={X(hover)} cy={Y(s.values[hover])} r={4.2} fill={s.color} stroke="#14161b" strokeWidth={2} />)}
        </g> : series.map((s) => s.values.length > 0 && <circle key={s.name} cx={X(s.values.length - 1)} cy={Y(s.values[s.values.length - 1])} r={3.4} fill={s.color} stroke="#14161b" strokeWidth={2} />)}
      </svg>
      <div className="trend-legend">{series.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}</div>
      {hover !== null && (
        <div className="trend-tip" style={{ left: `${clamp((X(hover) / W) * 100, 14, 78)}%` }}>
          <div className="muted">{labels[hover]}</div>
          {series.map((s) => s.values[hover] !== undefined && <div key={s.name}><i style={{ background: s.color }} />{s.name} <b className="num">{fmt(s.values[hover])}</b></div>)}
        </div>
      )}
    </div>
  );
}

/** One bar split into the parts of a budget. */
export function StackBar({ parts, fmt }: { parts: { label: string; value: number; color: string }[]; fmt: (v: number) => string }) {
  const sum = parts.reduce((a, x) => a + Math.max(0, x.value), 0) || 1;
  return (
    <div className="stackbar" role="img" aria-label={parts.map((x) => `${x.label}: ${fmt(x.value)}`).join(', ')}>
      {parts.filter((x) => x.value > 0).map((x) => <i key={x.label} title={`${x.label}: ${fmt(x.value)}`} style={{ width: `${(x.value / sum) * 100}%`, background: x.color }} />)}
    </div>
  );
}
