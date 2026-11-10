// Shared numeric helpers for all simulation modules.
export const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };
export const round = (x: number, d = 0) => { const k = 10 ** d; return Math.round(x * k) / k; };

/** Piecewise-linear keyframe interpolation: kf([[1950, 1], [2000, 2]], 1975) === 1.5 */
export type KF = [number, number][];
export function kf(frames: KF, x: number): number {
  if (x <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    if (x <= frames[i][0]) {
      const [x0, y0] = frames[i - 1];
      const [x1, y1] = frames[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return frames[frames.length - 1][1];
}

/** US consumer-price index relative to 2020 = 1.0 (rounded, public BLS CPI-U annual averages). */
const CPI: KF = [
  [1945, 0.07], [1950, 0.093], [1955, 0.104], [1960, 0.114], [1965, 0.122], [1970, 0.150], [1975, 0.208],
  [1980, 0.318], [1985, 0.416], [1990, 0.505], [1995, 0.589], [2000, 0.665], [2005, 0.755], [2010, 0.843],
  [2015, 0.916], [2020, 1.0], [2022, 1.131], [2025, 1.24], [2040, 1.75],
];
export const cpi = (year: number) => kf(CPI, year);

export function fmtMoney(v: number, digits = 1): string {
  const a = Math.abs(v);
  const s = v < 0 ? '−' : '';
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(digits + 1)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(digits)}M`;
  if (a >= 1e4) return `${s}$${(a / 1e3).toFixed(0)}k`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}k`;
  return `${s}$${a.toFixed(0)}`;
}
export function fmtNum(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${(v / 1e3).toFixed(0)}k`;
  return Math.round(v).toLocaleString('en-US');
}
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtTime = (s: number) => {
  if (!isFinite(s)) return '—';
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return m > 0 ? `${m}:${r.toFixed(3).padStart(6, '0')}` : r.toFixed(3);
};
export const fmtClock = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};
