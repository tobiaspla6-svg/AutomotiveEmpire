import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { localSaves } from '../src/store/saves';
import type { GameState } from '../src/sim/types';
import { prepareLoadedGame } from '../src/sim/migrate';
import { ceo, founder, motorsport, step } from './helpers';

const strip = (g: GameState) => JSON.stringify({ ...g, savedAt: 0 });

describe('save / load round trips', () => {
  for (const [label, make] of [['CEO', () => ceo({ makerId: 'bmw', year: 1990 })], ['Founder', () => founder()], ['Motorsport', () => motorsport({ discipline: 'gt', year: 2015 })]] as const) {
    it(`${label}: IndexedDB save → load returns the same game, and play continues identically`, async () => {
      const g = make();
      step(g, 4);
      await localSaves.save(`test-${label}`, g);
      const loaded = await localSaves.load(`test-${label}`);
      expect(loaded).not.toBeNull();
      expect(strip(loaded!)).toBe(strip(g));
      const list = await localSaves.list();
      expect(list.some((s) => s.slot === `test-${label}` && s.year === g.year && s.month === g.month)).toBe(true);
      // continuing from the save must give exactly the same future as continuing the original
      step(g, 8); step(loaded!, 8);
      expect(strip(loaded!)).toBe(strip(g));
      await localSaves.remove(`test-${label}`);
      expect(await localSaves.load(`test-${label}`)).toBeNull();
    });
  }
  it('a JSON export survives a text round trip', () => {
    const g = ceo({ year: 2005 });
    step(g, 2);
    const back = JSON.parse(JSON.stringify(g)) as GameState;
    expect(strip(back)).toBe(strip(g));
  });
});

describe('damaged saves are refused, not loaded (Phase 4D)', () => {
  const fresh = () => JSON.parse(JSON.stringify(ceo({ year: 2000 }))) as GameState;
  const me = (g: GameState) => g.companies.find((c) => c.id === g.playerId)!;
  const cases: [string, (g: GameState) => void][] = [
    ['the news list is missing', (g) => { (g as unknown as Record<string, unknown>).news = undefined; }],
    ['the world economy is missing', (g) => { (g as unknown as Record<string, unknown>).macro = undefined; }],
    ['no ledger', (g) => { (me(g) as unknown as Record<string, unknown>).ledger = undefined; }],
    ['no technology levels', (g) => { (me(g) as unknown as Record<string, unknown>).tech = undefined; }],
    ['no market reach', (g) => { (me(g) as unknown as Record<string, unknown>).reach = undefined; }],
    ['a vehicle without its specification', (g) => { (me(g).models[0] as unknown as Record<string, unknown>).stats = undefined; }],
    ['no finances (a NaN cash saved as null)', (g) => { (me(g) as unknown as Record<string, unknown>).cash = null; }],
    ['the date', (g) => { g.month = 13; }],
  ];
  for (const [what, damage] of cases) {
    it(`refuses a save where ${what}`, () => {
      const g = fresh(); damage(g);
      expect(() => prepareLoadedGame(JSON.parse(JSON.stringify(g)))).toThrow(/damaged/);
    });
  }
  it('still loads healthy saves, including after play and across a text round trip', () => {
    const g = ceo({ year: 2000 }); step(g, 6);
    const back = prepareLoadedGame(JSON.parse(JSON.stringify(g)));
    expect(back.year).toBe(g.year);
    expect(() => prepareLoadedGame(JSON.parse(JSON.stringify(founder())))).not.toThrow();
    expect(() => prepareLoadedGame(JSON.parse(JSON.stringify(motorsport())))).not.toThrow();
  });
});
