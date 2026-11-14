// Finance, Market & sales and Research: render from a live game in both languages with their controls intact.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { setLang } from '../src/i18n';
import { SPANISH_TERMS } from '../src/i18n/terms';
import { AREA_NAME, TECH_AREAS } from '../src/sim/company';
import { REGIONS } from '../src/data/world';
import { useStore } from '../src/store/game';
import { player } from '../src/sim/world';
import { FinanceView, MarketView, ResearchView } from '../src/ui/Corporate';
import { ceo, founder, step } from './helpers';

const live = () => { Object.assign(useStore.getInitialState(), useStore.getState()); };
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
const RAW_KEY = /\b(fin|mkt|res|kpi|stat|series|tab|impact|score)\.[a-zA-Z]+(\.[a-zA-Z0-9]+)*\b/;
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const render = (view: () => unknown, lang: 'en' | 'es') => { setLang(lang); live(); const html = renderToString(createElement(view as never)); setLang('en'); return html; };

beforeAll(() => {
  const mem = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  const g = ceo({ makerId: 'toyota', year: 2000 });
  step(g, 5);
  useStore.getState().start(g);
});

describe('finance', () => {
  it('shows liquidity, trends, borrowing, the statements and cash flow', () => {
    const html = render(FinanceView, 'en'), s = text(html);
    for (const w of ['Cash', 'Debt', 'Credit headroom', 'Net profit, 12 months', 'Operating cash flow', 'Company value', 'Debt against your credit limit', 'Borrow', 'Repay', 'Where the money went (12 months)', 'Income statement', 'Cost of cars sold', 'Balance sheet', 'Equity', 'Cash flow', 'Operating', 'Investing', 'Financing']) expect(s, w).toContain(w);
    expect(html).toContain('data-action="borrow"');
    expect(html).toMatch(/<svg/);
    expect(s).not.toMatch(RAW_KEY);
    expect(s).not.toMatch(/NaN|undefined|Infinity/);
  });
  it('is translated in Spanish', () => {
    const s = text(render(FinanceView, 'es'));
    for (const w of ['Finanzas', 'Margen de crédito', 'Cuenta de resultados', 'Balance', 'Flujo de caja', 'Pedir préstamo', 'Coste de los coches vendidos']) expect(s, w).toContain(w);
    for (const w of ['Income statement', 'Balance sheet', 'Borrow', 'Credit headroom']) expect(s, w).not.toContain(w);
    expect(s).not.toMatch(RAW_KEY);
  });
});

describe('market and sales', () => {
  it('shows the segment ranking, buyer priorities, every region and the competitors', () => {
    const html = render(MarketView, 'en'), s = text(html);
    const g = useStore.getState().game!;
    for (const w of ['World market share', 'Share of this segment', 'Awareness', 'Fuel price index', 'All other manufacturers', 'Reach and awareness by region', 'Marketing budget per month', 'Manufacturers by cars sold a year', player(g).name]) expect(s, w).toContain(w);
    expect(count(html, /data-region="/g)).toBe(REGIONS.length);
    expect(count(html, /data-action="invest-dealers"/g)).toBe(REGIONS.length);
    expect(count(html, /class="maker-row/g)).toBe(g.companies.filter((c) => c.alive && (c.models.length > 0 || c.isPlayer)).length);
    expect(s).not.toMatch(RAW_KEY);
    expect(s).not.toMatch(/NaN|undefined|Infinity/);
  });
  it('is translated in Spanish', () => {
    const s = text(render(MarketView, 'es'));
    for (const w of ['Mercado y ventas', 'Red de concesionarios', 'Competidores', 'Norteamérica', 'Resto de fabricantes', 'Notoriedad']) expect(s, w).toContain(w);
    for (const w of ['Dealer network', 'North America', 'Awareness']) expect(s, w).not.toContain(w);
    expect(s).not.toMatch(RAW_KEY);
  });
});

describe('research and engineering', () => {
  it('shows every technology area with its budget control, and the engineering staff', () => {
    const html = render(ResearchView, 'en'), s = text(html);
    for (const w of ['Average lead (years)', 'Research / month', 'Engineers', 'Needed by programmes', 'Monthly budget', 'Coming next', 'Latest mastered', 'The team behind every programme', 'Apply']) expect(s, w).toContain(w);
    expect(count(html, /data-area="/g)).toBe(TECH_AREAS.length);
    expect(count(html, /type="range"/g)).toBe(TECH_AREAS.length + 1);
    expect(s).not.toMatch(RAW_KEY);
    expect(s).not.toMatch(/NaN|undefined|Infinity/);
  });
  it('is translated in Spanish, including the technology areas', () => {
    const s = text(render(ResearchView, 'es'));
    for (const w of ['Investigación e ingeniería', 'Presupuesto mensual', 'Plantilla de ingeniería', 'Aerodinámica', 'Fabricación']) expect(s, w).toContain(w);
    expect(s).not.toMatch(RAW_KEY);
    for (const a of TECH_AREAS) if (AREA_NAME[a] !== 'Powertrain') expect(SPANISH_TERMS[AREA_NAME[a]], a).toBeTruthy();
  });
  it('a new company with no history renders without numeric artefacts', () => {
    const g = founder({ year: 1975 });
    useStore.getState().start(g);
    for (const v of [FinanceView, MarketView, ResearchView]) for (const lang of ['en', 'es'] as const) expect(text(render(v, lang))).not.toMatch(/NaN|undefined|Infinity/);
  });
});
