import { describe, expect, it } from 'vitest';
import { defaultVehicle } from '../src/sim/engineering';
import { powertrainBlueprint } from '../src/three/powertrain';

describe('3D powertrain inspection geometry follows the selected engine', () => {
  for (const [layout, cylinders, banks] of [
    ['I3', 3, 1], ['I4', 4, 1], ['I6', 6, 1],
    ['V6', 6, 2], ['V8', 8, 2], ['V10', 10, 2], ['V12', 12, 2],
    ['F4', 4, 2], ['F6', 6, 2], ['F12', 12, 2],
  ] as const) {
    it(`${layout} has ${cylinders} cylinders arranged in ${banks} bank(s)`, () => {
      const engine = defaultVehicle(2024, 'sedan').engine;
      engine.layout = layout;
      const plan = powertrainBlueprint(engine);
      expect(plan.electric).toBe(false);
      expect(plan.cylinders).toBe(cylinders);
      expect(plan.banks).toHaveLength(banks);
      expect(plan.banks.reduce((sum, bank) => sum + bank.cylinders, 0)).toBe(cylinders);
      expect(plan.length).toBeGreaterThan(0);
    });
  }

  it('electric powertrains show an electric motor and battery, not cylinders', () => {
    const e = defaultVehicle(2024, 'sedan').engine;
    e.layout = 'EV';
    const plan = powertrainBlueprint(e);
    expect(plan.electric).toBe(true);
    expect(plan.cylinders).toBe(0);
    expect(plan.banks).toEqual([]);
  });

  it('forced induction follows the real selected aspiration and not an invented turbo', () => {
    const e = defaultVehicle(2024, 'sedan').engine;
    e.aspiration = 'na';
    expect(powertrainBlueprint(e).forcedInduction).toBe(false);
    e.aspiration = 'turbo';
    expect(powertrainBlueprint(e).forcedInduction).toBe(true);
  });
});
