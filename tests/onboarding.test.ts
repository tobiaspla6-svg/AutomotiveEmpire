// Onboarding: the getting-started steps follow the real state of the game, in all three modes.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import * as A from '../src/sim/actions';
import { defaultVehicle } from '../src/sim/engineering';
import { nextStep, onboardingSteps } from '../src/sim/onboarding';
import { player } from '../src/sim/world';
import { setLang } from '../src/i18n';
import { en } from '../src/i18n/en';
import { useStore } from '../src/store/game';
import { GettingStarted, WelcomeDialog } from '../src/ui/Guide';
import { ceo, founder, motorsport, step } from './helpers';

const live = () => { Object.assign(useStore.getInitialState(), useStore.getState()); };
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const ids = (g: Parameters<typeof onboardingSteps>[0]) => onboardingSteps(g, player(g)).filter((s) => s.done).map((s) => s.id);

beforeAll(() => {
  const mem = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
});

describe('getting-started steps', () => {
  it('a new founder walks through design, development, factory, line, sales and profit in order', () => {
    const g = founder({ year: 2005 });
    const p = player(g);
    expect(nextStep(onboardingSteps(g, p))!.id).toBe('design');
    expect(A.startDevelopment(g, 'First', defaultVehicle(2005, 'hatch'), 'budget')).toBeNull();
    expect(ids(g)).toContain('design');
    expect(ids(g)).not.toContain('develop');
    const m = p.models[0];
    let i = 0; while (m.status === 'development' && i++ < 80) step(g);
    expect(ids(g)).toContain('develop');
    if (!p.factories.length) expect(nextStep(onboardingSteps(g, p))!.id).toBe('factory');
    else { expect(ids(g)).toContain('factory'); expect(A.addLine(g, p.factories[0].id, m.id, 400)).toBeNull(); expect(ids(g)).toContain('line'); step(g, 4); expect(ids(g)).toContain('sell'); }
    const before = JSON.stringify({ ...g, savedAt: 0 });
    onboardingSteps(g, p);
    expect(JSON.stringify({ ...g, savedAt: 0 })).toBe(before); // read-only
  });

  it('an established manufacturer has nothing left to learn after a profitable month', () => {
    const g = ceo({ makerId: 'toyota', year: 2000 });
    step(g, 2);
    expect(nextStep(onboardingSteps(g, player(g)))).toBeNull();
  });

  it('a motorsport director gets racing steps', () => {
    const g = motorsport({ year: 1995 });
    const steps = onboardingSteps(g, player(g));
    expect(steps.map((s) => s.id)).toEqual(['drivers', 'devBudget', 'race', 'points']);
    for (const s of steps) expect(s.view).toBe('motorsport');
  });

  it('every step and view has text in the catalogue', () => {
    for (const id of ['design', 'develop', 'factory', 'line', 'sell', 'profit', 'drivers', 'devBudget', 'race', 'points']) { expect(en, id).toHaveProperty(`guide.step.${id}`); expect(en, id).toHaveProperty(`guide.step.${id}.why`); }
    for (const v of ['vehicles', 'factories', 'market', 'finance', 'motorsport']) expect(en).toHaveProperty(`go.${v}`);
  });
});

describe('onboarding interface', () => {
  it('shows the checklist with the next step and a button, in both languages', () => {
    const g = founder({ year: 2005 });
    useStore.getState().start(g);
    setLang('en'); live();
    const html = renderToString(createElement(GettingStarted));
    expect(text(html)).toContain('Getting started');
    expect(text(html)).toContain('Design a car');
    expect(html).toContain('data-action="guide-go"');
    setLang('es'); live();
    const es = text(renderToString(createElement(GettingStarted)));
    expect(es).toContain('Primeros pasos');
    expect(es).toContain('Diseña un coche');
    setLang('en');
  });
  it('disappears once the company is running, and the welcome explains the four basics', () => {
    const g = ceo({ makerId: 'toyota', year: 2000 });
    step(g, 2);
    useStore.getState().start(g);
    live();
    expect(renderToString(createElement(GettingStarted))).toBe('');
    const w = text(renderToString(createElement(WelcomeDialog)));
    for (const s of ['Start from the briefing', 'Advance when you are ready', 'Estimate before you commit', 'Risky decisions ask first']) expect(w, s).toContain(s);
  });
});
