// Interface rendering: the redesigned menu and CEO dashboard render from the real game store, in both languages,
// without WebGL (poster fallbacks), and every actionable element carries a label. Server-side render in node.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { setLang } from '../src/i18n';
import { useStore } from '../src/store/game';
import { MainMenu } from '../src/ui/MainMenu';
import { DashboardView } from '../src/ui/Dashboard';
import { Shell } from '../src/ui/Shell';
import { ceo } from './helpers';

/** zustand's server render reads the *initial* state object, so mirror the live state into it before rendering. */
const live = () => { Object.assign(useStore.getInitialState(), useStore.getState()); };
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

beforeAll(() => {
  const mem = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
});

describe('main menu', () => {
  it('shows the three game modes, save access and settings in English and Spanish', () => {
    setLang('en');
    const en = (live(), renderToString(createElement(MainMenu)));
    for (const s of ['Historical Automotive CEO', 'Automotive Company Founder', 'Professional Motorsport Director']) expect(text(en), s).toContain(s);
    expect(en).toContain('aria-label="Settings"');
    setLang('es');
    const es = (live(), renderToString(createElement(MainMenu)));
    for (const s of ['CEO histórico de una marca', 'Fundador de una marca de coches', 'Director de motorsport profesional']) expect(text(es), s).toContain(s);
    expect(es).toContain('aria-label="Ajustes"');
    expect(es).not.toContain('menu.');
    setLang('en');
  });

  it('is usable with no WebGL: a drawn car, no canvas, nothing left as a raw message key', () => {
    setLang('en');
    const html = (live(), renderToString(createElement(MainMenu)));
    expect(html).not.toContain('<canvas');
    expect(html).toMatch(/<svg/);
    expect(html).not.toMatch(/\b(menu|gfx|mode|nav)\.[a-z]+\.[a-z0-9]+\b/);
  });

  it('every button has an accessible name', () => {
    const html = (live(), renderToString(createElement(MainMenu)));
    for (const b of html.match(/<button[^>]*>[\s\S]*?<\/button>/g) ?? []) expect(text(b).trim().length > 0 || /aria-label="[^"]+"/.test(b), b.slice(0, 120)).toBe(true);
  });
});

describe('CEO dashboard', () => {
  it('renders the command centre from a live game in both languages', () => {
    const g = ceo({ makerId: 'toyota', year: 2000 });
    useStore.getState().start(g);
    setLang('en');
    const en = (live(), renderToString(createElement(DashboardView)));
    for (const s of ['Cash', 'Revenue', 'World market share', 'Board objectives', 'Production']) expect(text(en), s).toContain(s);
    expect(en).toMatch(/<svg/);
    expect(text(en)).not.toMatch(/\d{7,}\.\d×|NaN|Infinity|undefined/); // a fresh game has no revenue history yet
    setLang('es');
    const es = (live(), renderToString(createElement(DashboardView)));
    for (const s of ['Caja', 'Ingresos', 'Cuota de mercado mundial']) expect(text(es), s).toContain(s);
    expect(text(es)).not.toMatch(/\b(dash|kpi|insight|chart|tab|series)\.[a-zA-Z]+/);
    setLang('en');
  });

  it('the shell shows every navigation group and does not load 3D by itself', () => {
    const g = ceo({ makerId: 'toyota', year: 2000 });
    useStore.getState().start(g);
    setLang('en');
    const html = (live(), renderToString(createElement(Shell)));
    expect(html).not.toContain('<canvas');
    for (const s of ['Dashboard', 'Finance', 'Market']) expect(text(html), s).toContain(s);
  });
});
