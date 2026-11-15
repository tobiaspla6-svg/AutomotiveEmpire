// Small geometry and colour helpers shared by the 2D illustrations (no DOM, no React).

/** Rounded polygon: each vertex [x, y, r] is replaced by a quadratic curve of radius r (limited to half of each edge). */
export function roundPath(pts: readonly (readonly [number, number, number])[], closed = true): string {
  const n = pts.length;
  if (n < 2) return '';
  const out: string[] = [];
  const at = (i: number) => pts[(i + n) % n];
  for (let i = 0; i < n; i++) {
    const [x, y, r0] = at(i);
    if (!closed && (i === 0 || i === n - 1)) { out.push(`${i === 0 ? 'M' : 'L'}${f(x)} ${f(y)}`); continue; }
    const [px, py] = at(i - 1), [nx, ny] = at(i + 1);
    const l1 = Math.hypot(x - px, y - py) || 1, l2 = Math.hypot(nx - x, ny - y) || 1;
    const r = Math.min(r0, l1 / 2, l2 / 2);
    const ax = x - ((x - px) / l1) * r, ay = y - ((y - py) / l1) * r;
    const bx = x + ((nx - x) / l2) * r, by = y + ((ny - y) / l2) * r;
    out.push(`${i === 0 ? 'M' : 'L'}${f(ax)} ${f(ay)}Q${f(x)} ${f(y)} ${f(bx)} ${f(by)}`);
  }
  if (closed) out.push('Z');
  return out.join('');
}
export const f = (v: number) => (Math.round(v * 10) / 10).toString();

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
/** Parse #rgb / #rrggbb (anything else falls back to a neutral grey). */
export function rgb(hex: string): [number, number, number] {
  let h = (hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = Number.parseInt(h, 16);
  if (h.length !== 6 || !Number.isFinite(n)) return [110, 124, 147];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Lighten (amount > 0) or darken (amount < 0) a colour, amount in −1..1. */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = rgb(hex);
  const t = amount < 0 ? 0 : 255, p = Math.abs(amount);
  return `#${[r, g, b].map((c) => clamp255(c + (t - c) * p).toString(16).padStart(2, '0')).join('')}`;
}
/** Perceived brightness 0..1. */
export const luma = (hex: string) => { const [r, g, b] = rgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

/** Isometric projection used by the campus and factory scenes (2:1 dimetric). */
export function iso(x: number, y: number, z = 0, s = 1): [number, number] {
  return [(x - y) * 0.866 * s, (x + y) * 0.5 * s - z * s];
}
export const pts = (list: [number, number][]) => list.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
