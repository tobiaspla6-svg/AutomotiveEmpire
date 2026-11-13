// Factory management: the network, the flow diagram and the supply chain render from a live game in both languages
// and keep every control of the old screen.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { setLang } from '../src/i18n';
import { SPANISH_TERMS } from '../src/i18n/terms';
import { CATEGORIES, CATEGORY_NAME } from '../src/data/suppliers';
import { useStore } from '../src/store/game';
import { player } from '../src/sim/world';
import { bottleneck, STAGES } from '../src/sim/supply';
import { FactoriesView } from '../src/ui/Factories';
import { ceo, founder, step } from './helpers';

const live = () => { Object.assign(useStore.getInitialState(), useStore.getState()); };
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
const RAW_KEY = /\b(fac|sup|impact|stage)\.[a-zA-Z]+(\.[a-zA-Z0-9]+)*\b/;
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const render = (lang: 'en' | 'es') => { setLang(lang); live(); const html = renderToString(createElement(FactoriesView)); setLang('en'); return html; };

beforeAll(() => {
  const mem = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
});

describe('factory management', () => {
  it('shows the network, a flow diagram per open plant, lines and the supply chain', () => {
    const g = ceo({ makerId: 'toyota', year: 2000 });
    step(g, 3);
    useStore.getState().start(g);
    const p = player(g);
    const html = render('en');
    const s = text(html);
    for (const w of ['Capacity / month', 'Built last month', 'Utilisation', 'Bottlenecks', 'Fixed costs / month', 'Cars in stock', 'Where you build against where you sell', 'Work under way', 'Production lines', 'Supply chain', 'Finished cars waiting for buyers', 'Cost to build against what each car brings in', 'Build a factory']) expect(s, w).toContain(w);
    expect(count(html, /data-plant="/g)).toBe(p.factories.length);
    const flows = count(html, /class="flow"/g);
    expect(flows).toBeGreaterThanOrEqual(1);
    expect(count(html, /data-stage="/g)).toBe(flows * STAGES.length);
    expect(count(html, /data-component="/g)).toBe(CATEGORIES.length);
    expect(count(html, /data-action="contract"/g)).toBe(CATEGORIES.length);
    for (const f of p.factories) expect(s).toContain(f.name);
    expect(s).not.toMatch(RAW_KEY);
    expect(s).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('marks the bottleneck stage of a plant whose paint shop is too small', () => {
    const g = ceo({ makerId: 'toyota', year: 2000 });
    const p = player(g);
    const f = p.factories[0];
    f.stages = { body: f.capacity, paint: Math.round(f.capacity * 0.6), powertrain: f.capacity, assembly: f.capacity, inspection: f.capacity };
    expect(bottleneck(f)).toBe('paint');
    useStore.getState().start(g);
    const html = render('en');
    expect(html).toMatch(/data-stage="paint"[^>]*class="flow-node bottleneck/);
    expect(text(html)).toContain('Bottleneck');
    expect(text(html)).toContain('plants held back by one stage');
  });

  it('is translated in Spanish, including stage, region and component names', () => {
    const g = ceo({ makerId: 'toyota', year: 2000 });
    step(g, 2);
    useStore.getState().start(g);
    const s = text(render('es'));
    for (const w of ['Fábricas', 'Capacidad / mes', 'Cuellos de botella', 'Cadena de suministro', 'Líneas de producción', 'Montaje final', 'Japón y Corea', 'Acero y aluminio', 'Construir una fábrica']) expect(s, w).toContain(w);
    for (const w of ['Supply chain', 'Production lines', 'Final assembly', 'Japan & Korea', 'Steel and aluminium']) expect(s, w).not.toContain(w);
    expect(s).not.toMatch(RAW_KEY);
    for (const c of CATEGORIES) expect(SPANISH_TERMS[CATEGORY_NAME[c]], c).toBeTruthy();
  });

  it('a company with no plant is told how to start', () => {
    const g = founder({ year: 2005 });
    player(g).factories = [];
    useStore.getState().start(g);
    const s = text(render('en'));
    expect(s).toContain('No factory yet');
    expect(s).toContain('Build a factory');
  });
});
