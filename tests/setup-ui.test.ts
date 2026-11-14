// New-game setup screens render in both languages with every option translated.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { setLang } from '../src/i18n';
import { SPANISH_TERMS } from '../src/i18n/terms';
import { ENGINEER_LEVELS, FACTORY_SIZES, MS_BUDGETS, RESEARCH_LEVELS, SPECIALIZATIONS, WORKFORCE_LEVELS } from '../src/sim/world';
import { MAKERS } from '../src/data/manufacturers';
import { CeoSetupScreen, FounderSetupScreen, MotorsportSetupScreen } from '../src/ui/Setup';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
const RAW_KEY = /\b(setup|menu|ms|st|veh|fac)\.[a-zA-Z]+(\.[a-zA-Z0-9]+)*\b/;
const render = (c: () => unknown, lang: 'en' | 'es') => { setLang(lang); const html = renderToString(createElement(c as never)); setLang('en'); return html; };

beforeAll(() => {
  const mem = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
});

describe('new-game setup', () => {
  it('Historical CEO: every manufacturer, the briefing and the start button', () => {
    const en = render(CeoSetupScreen, 'en'), es = render(CeoSetupScreen, 'es');
    for (const m of MAKERS) expect(text(en), m.name).toContain(m.name);
    for (const w of ['Manufacturer', 'Starting year', 'Difficulty', 'Timeline', 'Board expectations', 'Starting cash', 'Brand reputation', 'Take the chair at']) expect(text(en), w).toContain(w);
    for (const w of ['Fabricante', 'Año de inicio', 'Dificultad', 'Línea temporal', 'Expectativas del consejo', 'Caja inicial', 'Reputación de marca', 'Tomar el mando de']) expect(text(es), w).toContain(w);
    for (const w of ['Starting year', 'Difficulty', 'Board expectations', 'Starting cash']) expect(text(es), w).not.toContain(w);
    expect(en).toContain('data-action="start-game"');
    expect(text(es)).not.toMatch(RAW_KEY);
  });
  it('Company Founder: capital, specialisation and the four steps', () => {
    const en = text(render(FounderSetupScreen, 'en')), es = text(render(FounderSetupScreen, 'es'));
    for (const w of ['Company name', 'Starting capital', 'Business specialisation', 'Initial factory', 'Where the capital goes', 'What happens next', '1 · Design', '4 · Sell', 'Sports cars']) expect(en, w).toContain(w);
    for (const w of ['Nombre de la empresa', 'Capital inicial', 'Especialización', 'Fábrica inicial', 'A dónde va el capital', 'Qué pasa después', '1 · Diseñar', '4 · Vender', 'Deportivos', 'Italia']) expect(es, w).toContain(w);
    for (const w of ['Company name', 'Starting capital', 'Sports cars', 'Workshop (60 cars / month)']) expect(es, w).not.toContain(w);
    expect(es).not.toMatch(RAW_KEY);
    for (const list of [SPECIALIZATIONS, FACTORY_SIZES, WORKFORCE_LEVELS, ENGINEER_LEVELS, RESEARCH_LEVELS, MS_BUDGETS]) for (const x of list) expect(SPANISH_TERMS[x.name], x.name).toBeTruthy();
    for (const x of SPECIALIZATIONS) expect(SPANISH_TERMS[x.blurb], x.blurb).toBeTruthy();
  });
  it('Motorsport Director: discipline, budget, regulations', () => {
    const en = text(render(MotorsportSetupScreen, 'en')), es = text(render(MotorsportSetupScreen, 'es'));
    for (const w of ['Racing discipline', 'Initial budget', 'Technical personnel', 'Minimum weight', 'Front-running budget', 'Enter the 1992 season']) expect(en, w).toContain(w);
    for (const w of ['Disciplina', 'Presupuesto inicial', 'Personal técnico', 'Peso mínimo', 'Presupuesto de un puntero', 'Entrar en la temporada 1992', 'Monoplazas de Gran Premio']) expect(es, w).toContain(w);
    for (const w of ['Racing discipline', 'Initial budget', 'Minimum weight']) expect(es, w).not.toContain(w);
    expect(es).not.toMatch(RAW_KEY);
  });
});
