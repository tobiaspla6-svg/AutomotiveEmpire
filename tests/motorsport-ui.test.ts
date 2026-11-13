// Motorsport headquarters: renders from live games (works team and motorsport-director mode) in both languages.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { setLang } from '../src/i18n';
import { useStore } from '../src/store/game';
import { player } from '../src/sim/world';
import { playerTeam, teamRegs } from '../src/sim/racing/season';
import { MotorsportView } from '../src/ui/Motorsport';
import { ceo, founder, step } from './helpers';

const live = () => { Object.assign(useStore.getInitialState(), useStore.getState()); };
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
const RAW_KEY = /\b(ms|fac|st|impact)\.[a-zA-Z]+(\.[a-zA-Z0-9]+)*\b/;
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const render = (lang: 'en' | 'es') => { setLang(lang); live(); const html = renderToString(createElement(MotorsportView)); setLang('en'); return html; };

beforeAll(() => {
  const mem = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
});

describe('motorsport headquarters', () => {
  it('shows the car, the next event, the line-up, standings, finances, development and the calendar', () => {
    const g = ceo({ makerId: 'toyota', year: 2000 });
    step(g, 2);
    useStore.getState().start(g);
    const p = player(g), div = p.motorsport!;
    expect(div).toBeTruthy();
    const html = render('en');
    const s = text(html);
    for (const w of ['Headquarters', 'Car design', 'Drivers and staff', 'Season', 'Next event', "Teams' championship", 'Best driver', 'Season balance', 'Driver line-up', 'Championship standings', 'Team finances', 'Vehicle development', 'Race calendar', 'Sponsors', 'Honours', div.teamName]) expect(s, w).toContain(w);
    const team = playerTeam(div), regs = teamRegs(team, div.championship.year);
    expect(count(html, /class="driver-card"/g)).toBe(Math.min(team.drivers.length, regs.carsPerTeam * regs.driversPerCar));
    expect(count(html, /<li class="(done|next|todo)"/g)).toBe(div.championship.rounds.length);
    expect(count(html, /type="range"/g)).toBeGreaterThanOrEqual(5); // four focus sliders and the budget
    expect(html).not.toContain('<canvas');
    expect(s).not.toMatch(RAW_KEY);
    expect(s).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('is translated in Spanish', () => {
    const g = ceo({ makerId: 'toyota', year: 2000 });
    step(g, 2);
    useStore.getState().start(g);
    const s = text(render('es'));
    for (const w of ['Sede', 'Diseño del coche', 'Pilotos y personal', 'Próxima cita', 'Campeonato de equipos', 'Alineación de pilotos', 'Finanzas del equipo', 'Desarrollo del vehículo', 'Calendario', 'Patrocinadores', 'Palmarés']) expect(s, w).toContain(w);
    for (const w of ['Headquarters', 'Driver line-up', 'Team finances', 'Race calendar']) expect(s, w).not.toContain(w);
    expect(s).not.toMatch(RAW_KEY);
  });

  it('a company without a team is offered every category with its cost', () => {
    const g = founder({ year: 2005 });
    useStore.getState().start(g);
    expect(player(g).motorsport).toBeFalsy();
    const en = text(render('en')), es = text(render('es'));
    for (const w of ['Establish a motorsport division', 'Grand Prix single-seaters', 'GT racing', 'Found the team']) expect(en, w).toContain(w);
    for (const w of ['Crear una división de competición', 'Monoplazas de Gran Premio', 'Fundar el equipo']) expect(es, w).toContain(w);
    expect(es).not.toMatch(RAW_KEY);
  });
});
