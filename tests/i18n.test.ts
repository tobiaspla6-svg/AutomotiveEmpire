// Interface localisation: the Spanish catalogue is complete and consistent with English, every key built
// dynamically by the interface exists, and the locale formatters behave.
import { describe, expect, it } from 'vitest';
import { CATALOGUE, getLang, setLang, t, translate, translatePlural, type Lang, type MessageKey } from '../src/i18n';
import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';
import { delta, money, monthShort, num, pct } from '../src/i18n/format';
import type { InsightKind, InsightView } from '../src/sim/insights';

const KEYS = Object.keys(en) as MessageKey[];
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('message catalogues', () => {
  it('Spanish has exactly the keys of English and no empty text', () => {
    expect(Object.keys(es).sort()).toEqual([...KEYS].sort());
    for (const lang of ['en', 'es'] as Lang[]) for (const k of KEYS) expect(CATALOGUE[lang][k].trim().length, `${lang}:${k}`).toBeGreaterThan(0);
  });

  it('both languages use the same placeholders in every message', () => {
    for (const k of KEYS) expect(placeholders(es[k]), k).toEqual(placeholders(en[k]));
  });

  it('plural keys come in .one / .other pairs in both languages', () => {
    for (const k of KEYS.filter((x) => x.endsWith('.one'))) expect(KEYS, k).toContain(k.replace(/\.one$/, '.other'));
    expect(translatePlural('en', 'dash.monthsLeft', 1)).toBe('1 month left');
    expect(translatePlural('en', 'dash.monthsLeft', 5)).toBe('5 months left');
    expect(translatePlural('es', 'dash.monthsLeft', 1)).toBe('queda 1 mes');
    expect(translatePlural('es', 'dash.monthsLeft', 3)).toBe('quedan 3 meses');
  });

  it('every key the interface builds dynamically exists', () => {
    const need: string[] = [];
    for (const m of ['ceo', 'founder', 'motorsport']) { need.push(`mode.${m}`, `menu.${m}.title`, `menu.${m}.sub`, `menu.${m}.car`, `menu.${m}.cta`, `menu.${m}.f1`, `menu.${m}.f2`, `menu.${m}.f3`); }
    for (const q of ['auto', 'low', 'medium', 'high', 'off']) need.push(`gfx.${q}`, `gfx.${q}.desc`);
    for (const d of ['easy', 'normal', 'hard']) need.push(`diff.${d}`);
    for (const s of ['body', 'paint', 'powertrain', 'assembly', 'inspection']) need.push(`stage.${s}`);
    for (const c of ['revenue', 'profit', 'cash', 'units', 'margin']) need.push(`chart.${c}`, `tab.${c}`);
    const kinds: InsightKind[] = ['overLimit', 'cashRunway', 'noVehicles', 'readyNoLine', 'noPrice', 'belowCost', 'bottleneck', 'idleCapacity', 'soldOut', 'supplyDisruption', 'engineersShort', 'boardDeadline', 'boardConfidence', 'ageingRange', 'costlyDebt'];
    for (const k of kinds) need.push(`insight.${k}.title`, `insight.${k}.why`);
    const views: InsightView[] = ['vehicles', 'factories', 'market', 'finance', 'research', 'company', 'motorsport'];
    for (const v of views) need.push(`go.${v}`);
    for (const k of need) expect(KEYS as string[], k).toContain(k);
  });
});

describe('translation', () => {
  it('fills placeholders, leaves unknown ones visible and falls back to English', () => {
    expect(translate('en', 'menu.mode', { n: 2 })).toBe('Mode 2');
    expect(translate('es', 'menu.mode', { n: 2 })).toBe('Modo 2');
    expect(translate('en', 'menu.mode')).toBe('Mode {n}');
    const saved = CATALOGUE.es['common.close'];
    (CATALOGUE.es as Record<string, string>)['common.close'] = undefined as unknown as string;
    expect(translate('es', 'common.close')).toBe('Close');
    CATALOGUE.es['common.close'] = saved;
  });

  it('the language switch changes what t() returns and is remembered', () => {
    const start = getLang();
    setLang('es');
    expect(t('nav.dashboard')).toBe('Panel');
    expect(getLang()).toBe('es');
    setLang('en');
    expect(t('nav.dashboard')).toBe('Dashboard');
    setLang(start);
  });
});

describe('locale formatting', () => {
  it('formats money with the right scale names in each language', () => {
    expect(money(16.66e9, 'en')).toBe('$16.7B');
    expect(money(16.66e9, 'es')).toBe('16,7 mil M $');
    expect(money(4.2e6, 'en')).toBe('$4.2M');
    expect(money(4.2e6, 'es')).toBe('4,2 M $');
    expect(money(-840e3, 'en')).toBe('−$840k');
    expect(money(NaN, 'en')).toBe('—');
  });
  it('formats counts, percentages, deltas and months', () => {
    expect(num(2556, 'en')).toBe('2,556');
    expect(num(22000, 'en')).toBe('22k');
    expect(num(1.03e6, 'es')).toBe('1,03 M');
    expect(pct(0.1426, 'en', 1)).toBe('14.3%');
    expect(pct(0.1426, 'es', 1)).toBe('14,3%');
    expect(delta(0.042, 'en')).toBe('+4.2%');
    expect(delta(-0.042, 'en')).toBe('−4.2%');
    expect(monthShort(1, 'en')).toBe('Jan');
    expect(monthShort(1, 'es').toLowerCase()).toBe('ene');
  });
});
