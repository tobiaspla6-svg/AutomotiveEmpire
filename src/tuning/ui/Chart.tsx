// Small SVG line chart for the Tuning Lab: one y-axis per chart (power and torque are separate charts), recessive
// grid, 2 px lines, direct end labels plus a legend, a hover crosshair with a tooltip, and a table view.
import { useLayoutEffect, useMemo, useRef, useState } from 'react';

export interface Series { name: string; color: string; points: { x: number; y: number }[]; dashed?: boolean }

const niceStep = (span: number, target = 5) => {
  const raw = span / target, mag = 10 ** Math.floor(Math.log10(raw)), n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
};

export function LineChart({ title, series, xLabel, yUnit, xUnit, xFmt = (v) => String(v), yFmt = (v) => v.toFixed(0), id }:
  { title: string; series: Series[]; xLabel: string; yUnit: string; xUnit: string; xFmt?: (v: number) => string; yFmt?: (v: number) => string; id: string }) {
  // the viewBox follows the figure's real width, so ticks and labels keep their size on a phone instead of shrinking
  const fig = useRef<HTMLElement>(null);
  const [W, setW] = useState(560);
  useLayoutEffect(() => {
    const el = fig.current; if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.min(900, Math.round(e.contentRect.width)))));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const H = W < 480 ? 230 : 262, P = { l: 46, r: W < 480 ? 70 : 88, t: 30, b: 38 };
  const all = series.flatMap((s) => s.points);
  const xMin = Math.min(...all.map((p) => p.x)), xMax = Math.max(...all.map((p) => p.x));
  const yMax0 = Math.max(...all.map((p) => p.y)) * 1.08;
  const yStep = niceStep(yMax0), yMax = Math.ceil(yMax0 / yStep) * yStep;
  const xStep = niceStep(xMax - xMin, 6);
  const sx = (x: number) => P.l + ((x - xMin) / (xMax - xMin || 1)) * (W - P.l - P.r);
  const sy = (y: number) => H - P.b - (y / (yMax || 1)) * (H - P.t - P.b);
  const [hx, setHx] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const near = useMemo(() => hx === null ? null : series.map((s) => s.points.reduce((a, p) => (Math.abs(p.x - hx) < Math.abs(a.x - hx) ? p : a), s.points[0])), [hx, series]);
  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W;
    const x = xMin + ((px - P.l) / (W - P.l - P.r)) * (xMax - xMin);
    setHx(x < xMin || x > xMax ? null : x);
  };
  const yTicks = Array.from({ length: Math.round(yMax / yStep) + 1 }, (_, i) => i * yStep);
  const xTicks: number[] = []; for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) xTicks.push(x);
  return <figure className="tl-chart" data-chart={id} ref={fig}>
    <figcaption><b>{title}</b>
      <span className="tl-legend">{series.map((s) => <span key={s.name}><i style={{ background: s.color }} className={s.dashed ? 'dashed' : ''} />{s.name}</span>)}</span>
    </figcaption>
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${series.map((s) => s.name).join(', ')}`} onPointerMove={onMove} onPointerLeave={() => setHx(null)}>
      {yTicks.map((y) => <g key={y}><line x1={P.l} x2={W - P.r} y1={sy(y)} y2={sy(y)} className="grid" /><text x={P.l - 8} y={sy(y) + 4} className="tick" textAnchor="end">{yFmt(y)}</text></g>)}
      {xTicks.map((x) => <text key={x} x={sx(x)} y={H - P.b + 18} className="tick" textAnchor="middle">{xFmt(x)}</text>)}
      <text x={(P.l + W - P.r) / 2} y={H - 4} className="axis" textAnchor="middle">{xLabel} ({xUnit})</text>
      <text x={P.l - 8} y={14} className="axis" textAnchor="end">{yUnit}</text>
      {series.map((s) => <path key={s.name} d={s.points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('')} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '6 4' : undefined} strokeLinejoin="round" />)}
      {series.map((s, i) => { const l = s.points[s.points.length - 1]; return <text key={s.name} x={sx(l.x) + 6} y={sy(l.y) + 4 + (i ? 12 : -2) * 0} className="end">{s.name}</text>; })}
      {near && hx !== null && <g>
        <line x1={sx(near[0].x)} x2={sx(near[0].x)} y1={P.t} y2={H - P.b} className="cross" />
        {near.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={4.5} fill={series[i].color} stroke="#141c25" strokeWidth={2} />)}
      </g>}
    </svg>
    {near && hx !== null && <div className="tl-tip" role="status" style={{ left: `${(sx(near[0].x) / W) * 100}%` }}>
      <b>{xFmt(near[0].x)} {xUnit}</b>{near.map((p, i) => <span key={i}><i style={{ background: series[i].color }} />{series[i].name}: {yFmt(p.y)} {yUnit}</span>)}
    </div>}
    <details className="tl-table"><summary>Ver datos en tabla</summary>
      <table><thead><tr><th>{xLabel} ({xUnit})</th>{series.map((s) => <th key={s.name}>{s.name} ({yUnit})</th>)}</tr></thead>
        <tbody>{series[0].points.filter((_, i) => i % Math.max(1, Math.round(series[0].points.length / 14)) === 0).map((p) => <tr key={p.x}><td>{xFmt(p.x)}</td>{series.map((s) => { const q = s.points.reduce((a, b) => (Math.abs(b.x - p.x) < Math.abs(a.x - p.x) ? b : a)); return <td key={s.name}>{yFmt(q.y)}</td>; })}</tr>)}</tbody>
      </table>
    </details>
  </figure>;
}
