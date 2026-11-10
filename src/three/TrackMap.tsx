import { useMemo } from 'react';
import { trackGeom, trackPos } from '../sim/racing/tracks';

/** 2D circuit map drawn from the same centre line the simulation uses. */
export function TrackMap({ trackId, dots, height = 160, zones = false }: { trackId: string; dots?: { s: number; color: string; big?: boolean; label?: string }[]; height?: number | string; zones?: boolean }) {
  const g = trackGeom(trackId);
  const { path, vb, zonePaths } = useMemo(() => {
    const b = g.bounds, pad = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 0.06;
    let d = '';
    for (let i = 0; i < g.n; i += 2) d += `${i ? 'L' : 'M'}${g.x[i].toFixed(1)} ${g.z[i].toFixed(1)}`;
    const zp = g.zones.map(([a, bb]) => { let s = ''; for (let i = a, k = 0; i !== bb; i = (i + 1) % g.n, k++) s += `${k ? 'L' : 'M'}${g.x[i].toFixed(1)} ${g.z[i].toFixed(1)}`; return s; });
    return { path: d + 'Z', vb: `${b.minX - pad} ${b.minZ - pad} ${b.maxX - b.minX + 2 * pad} ${b.maxZ - b.minZ + 2 * pad}`, zonePaths: zp };
  }, [g]);
  const size = Math.max(g.bounds.maxX - g.bounds.minX, g.bounds.maxZ - g.bounds.minZ);
  const sw = size * 0.022;
  const tmp = { x: 0, y: 0, z: 0, hx: 1, hz: 0 };
  return (
    <svg viewBox={vb} style={{ width: '100%', height, display: 'block' }} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Circuit map">
      <path d={path} fill="none" stroke="#3a3e46" strokeWidth={sw * 1.5} strokeLinejoin="round" />
      <path d={path} fill="none" stroke="#c9cbd1" strokeWidth={sw * 0.55} strokeLinejoin="round" />
      {zones && zonePaths.map((z, i) => <path key={i} d={z} fill="none" stroke="#3fb984" strokeWidth={sw * 0.55} strokeLinecap="round" />)}
      <line x1={g.x[0] - g.hz[0] * sw * 1.6} y1={g.z[0] + g.hx[0] * sw * 1.6} x2={g.x[0] + g.hz[0] * sw * 1.6} y2={g.z[0] - g.hx[0] * sw * 1.6} stroke="#f0efec" strokeWidth={sw * 0.5} />
      {dots?.map((d, i) => { const p = trackPos(g, d.s, 0, tmp); return <circle key={i} cx={p.x} cy={p.z} r={sw * (d.big ? 1.5 : 1.0)} fill={d.color} stroke={d.big ? '#fff' : '#0b0c0e'} strokeWidth={sw * (d.big ? 0.35 : 0.2)} />; })}
    </svg>
  );
}
