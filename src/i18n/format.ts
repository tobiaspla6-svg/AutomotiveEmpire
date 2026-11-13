// Locale-aware formatting for the interface (money, numbers, percentages, dates). The simulation's own
// `fmtMoney` in sim/util.ts stays as it is for the old screens; new components use these.
import type { Lang } from './index';

const LOCALE: Record<Lang, string> = { en: 'en-US', es: 'es-ES' };

/** Compact money with a currency symbol: $16.7B / 16,7 mil M $ · $4.2M / 4,2 M $ · $840k / 840 k $. */
export function money(v: number, lang: Lang, digits = 1): string {
  if (!isFinite(v)) return '—';
  const abs = Math.abs(v), sign = v < 0 ? '−' : '';
  const nf = (x: number, d: number) => x.toLocaleString(LOCALE[lang], { minimumFractionDigits: d, maximumFractionDigits: d });
  if (lang === 'es') {
    // Spanish uses long-scale names: 10^9 is "mil millones"
    if (abs >= 1e12) return `${sign}${nf(abs / 1e12, digits)} B $`;
    if (abs >= 1e9) return `${sign}${nf(abs / 1e9, digits)} mil M $`;
    if (abs >= 1e6) return `${sign}${nf(abs / 1e6, digits)} M $`;
    if (abs >= 1e3) return `${sign}${nf(abs / 1e3, 0)} k $`;
    return `${sign}${nf(abs, 0)} $`;
  }
  if (abs >= 1e12) return `${sign}$${nf(abs / 1e12, digits)}T`;
  if (abs >= 1e9) return `${sign}$${nf(abs / 1e9, digits)}B`;
  if (abs >= 1e6) return `${sign}$${nf(abs / 1e6, digits)}M`;
  if (abs >= 1e3) return `${sign}$${nf(abs / 1e3, 0)}k`;
  return `${sign}$${nf(abs, 0)}`;
}
export function num(v: number, lang: Lang): string {
  if (!isFinite(v)) return '—';
  const abs = Math.abs(v), sign = v < 0 ? '−' : '';
  const nf = (x: number, d: number) => x.toLocaleString(LOCALE[lang], { minimumFractionDigits: d, maximumFractionDigits: d });
  if (abs >= 1e9) return `${sign}${nf(abs / 1e9, 2)}${lang === 'es' ? ' mil M' : 'B'}`;
  if (abs >= 1e6) return `${sign}${nf(abs / 1e6, 2)}${lang === 'es' ? ' M' : 'M'}`;
  if (abs >= 1e4) return `${sign}${nf(abs / 1e3, 0)}${lang === 'es' ? ' k' : 'k'}`;
  return `${sign}${nf(abs, 0)}`;
}
export const pct = (v: number, lang: Lang, digits = 0) => `${(v * 100).toLocaleString(LOCALE[lang], { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
/** Signed percentage change, e.g. +4.2 %. */
export const delta = (v: number, lang: Lang, digits = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toLocaleString(LOCALE[lang], { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
/** Short month name ("Jan" / "ene"). */
export const monthShort = (month: number, lang: Lang) => new Date(2001, month - 1, 1).toLocaleDateString(LOCALE[lang], { month: 'short' }).replace('.', '');
export const monthYear = (month: number, year: number, lang: Lang) => `${monthShort(month, lang)} ${year}`;
export const dateTime = (ts: number, lang: Lang) => new Date(ts).toLocaleString(LOCALE[lang], { dateStyle: 'medium', timeStyle: 'short' });
