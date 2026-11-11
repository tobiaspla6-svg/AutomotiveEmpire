import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { localSaves } from '../src/store/saves';
import type { GameState } from '../src/sim/types';
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
