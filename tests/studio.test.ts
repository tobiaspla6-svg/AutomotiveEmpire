// Vehicle engineering studio: renders from a live game in both languages, in Basic and in every Advanced section,
// keeps every engineering control, and the simulation vocabulary it shows has Spanish names.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { setLang } from '../src/i18n';
import { SPANISH_TERMS, term } from '../src/i18n/terms';
import { BODY, LAYOUT_NAME, computeVehicle, defaultVehicle } from '../src/sim/engineering';
import { BAY_NAME, CLASS_NAME } from '../src/sim/families';
import { REGIONS, SEGMENTS } from '../src/data/world';
import { FINISH_NAME } from '../src/three/assets/names';
import { useStore } from '../src/store/game';
import { player } from '../src/sim/world';
import { STUDIO_SECTIONS, Studio } from '../src/ui/Studio';
import { VehiclesView } from '../src/ui/Vehicles';
import { ceo, founder } from './helpers';

const live = () => { Object.assign(useStore.getInitialState(), useStore.getState()); };
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
const RAW_KEY = /\b(st|veh|stage|viewer|score)\.[a-zA-Z]+(\.[a-zA-Z0-9]+)*\b/;
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

beforeAll(() => {
  const mem = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
});

function studio(lang: 'en' | 'es', props: Record<string, unknown> = {}, year = 2024) {
  const g = founder({ year });
  useStore.getState().start(g);
  setLang(lang);
  live();
  const html = renderToString(createElement(Studio, { init: defaultVehicle(year, 'sedan'), initName: 'Test GT', onClose: () => undefined, ...props }));
  setLang('en');
  return html;
}

describe('engineering studio', () => {
  it('Basic mode shows the three columns, the key decisions and the real numbers', () => {
    const html = studio('en');
    const s = text(html);
    for (const part of ['studio-left', 'studio-center', 'studio-right']) expect(html).toContain(part);
    for (const label of ['Engine family', 'Platform', 'Body style', 'Driven wheels', 'Gearbox', 'Tyres', 'Interior', 'Planned volume', 'Break-even price', 'Programme budget', 'Start development']) expect(s, label).toContain(label);
    const stats = computeVehicle(defaultVehicle(2024, 'sedan'), { year: 2024, tech: player(useStore.getState().game!).tech });
    expect(s).toContain(`${Math.round(stats.powerKw)}`);
    expect(s).toContain(`${stats.zeroTo100.toFixed(1)}`);
    expect(s).toContain(`${Math.round(stats.topSpeed)}`);
    expect(s).not.toMatch(RAW_KEY);
    expect(s).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('is fully translated in Spanish, including simulation vocabulary', () => {
    const s = text(studio('es'));
    for (const label of ['Familia de motores', 'Plataforma', 'Tipo de carrocería', 'Ruedas motrices', 'Caja de cambios', 'Precio de equilibrio', 'Presupuesto del programa', 'Iniciar desarrollo', 'Berlina', 'Prestaciones', 'Fiabilidad']) expect(s, label).toContain(label);
    for (const english of ['Engine family', 'Body style', 'Start development', 'Break-even', 'Sedan', 'Performance', 'Reliability']) expect(s, english).not.toContain(english);
    expect(s).not.toMatch(RAW_KEY);
  });

  it('every Advanced section renders its controls in both languages', () => {
    const need: Record<string, number> = { architecture: 2, body: 4, chassis: 4, engine: 9, driveline: 4, running: 7, aero: 4, cabin: 2 };
    for (const lang of ['en', 'es'] as const) for (const section of STUDIO_SECTIONS) {
      const html = studio(lang, { initialMode: 'advanced', initialSection: section });
      const form = html.slice(html.indexOf('section-body'), html.indexOf('studio-center'));
      const controls = count(form, /<select/g) + count(form, /type="range"/g) + count(form, /type="checkbox"/g);
      expect(controls, `${lang}:${section}`).toBeGreaterThanOrEqual(need[section]);
      expect(text(html), `${lang}:${section}`).not.toMatch(RAW_KEY);
      expect(count(html, /data-section="/g)).toBe(8);
    }
  });

  it('an electric car swaps the engine controls and a 1960 studio locks later technology', () => {
    const ev = defaultVehicle(2024, 'sedan'); ev.engine.layout = 'EV';
    const html = text(studio('en', { init: ev, initialMode: 'advanced', initialSection: 'engine' }));
    expect(html).toContain('Battery capacity');
    expect(html).not.toContain('Compression ratio');
    const old = text(studio('en', { init: defaultVehicle(1960, 'sedan'), initialMode: 'advanced', initialSection: 'engine' }, 1960));
    expect(old).toMatch(/needs \d{4} technology/);
  });

  it('the start button is disabled until the car has a name, and says why', () => {
    const html = studio('en', { initName: '' });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-action="start-development"/);
    expect(text(html)).toContain('Give the car a name');
    expect(studio('en')).not.toMatch(/<button[^>]*disabled=""[^>]*data-action="start-development"/);
  });
});

describe('vehicle range', () => {
  it('lists the range with prices and actions in both languages', () => {
    const g = ceo({ makerId: 'toyota', year: 2000 });
    useStore.getState().start(g);
    for (const [lang, words] of [['en', ['Design a new vehicle', 'New generation', 'Retire', 'Unit cost', 'In production']], ['es', ['Diseñar un vehículo nuevo', 'Nueva generación', 'Retirar', 'Coste unitario', 'En producción']]] as const) {
      setLang(lang); live();
      const html = renderToString(createElement(VehiclesView));
      for (const w of words) expect(text(html), w).toContain(w);
      expect(count(html, /data-model="/g)).toBe(player(g).models.filter((m) => m.status !== 'retired').length);
      expect(text(html)).not.toMatch(RAW_KEY);
    }
    setLang('en');
  });
});

describe('simulation vocabulary', () => {
  it('every body style, segment, layout, region, finish, platform class and breakdown label has a Spanish name', () => {
    const stats = computeVehicle(defaultVehicle(2024, 'sedan'), { year: 2024, tech: { engine: 80, chassis: 80, electronics: 80, materials: 80, aero: 80, manufacturing: 80 } as never });
    const words = [
      ...Object.values(BODY).map((b) => b.name), ...SEGMENTS.map((s) => s.name), ...REGIONS.flatMap((r) => [r.name, r.short]), ...Object.values(FINISH_NAME), ...Object.values(CLASS_NAME), ...Object.values(BAY_NAME),
      ...Object.keys(stats.massBreakdown), ...Object.keys(stats.costBreakdown), ...Object.values(LAYOUT_NAME).filter((n) => !/^V\d+$/.test(n)),
    ];
    const same = new Set(['SUV', 'Roadster', 'China', 'Interior']); // identical in both languages
    for (const w of words) { if (same.has(w)) continue; expect(SPANISH_TERMS[w], w).toBeTruthy(); expect(term(w, 'es')).not.toBe(w); }
    expect(term('Sedan', 'en')).toBe('Sedan');
    expect(term('Something else', 'es')).toBe('Something else');
  });
});
