// Pure visual blueprint for the 3D powertrain inspection view.
// This is a presentation layer: it never affects engine performance, weight or cost.
import type { EngineSpec } from '../sim/types';

export interface PowertrainBank {
  z: number;
  roll: number;
  cylinders: number;
}
export interface PowertrainBlueprint {
  electric: boolean;
  layout: EngineSpec['layout'];
  cylinders: number;
  banks: PowertrainBank[];
  length: number;
  forcedInduction: boolean;
}

export function powertrainBlueprint(e: EngineSpec): PowertrainBlueprint {
  if (e.layout === 'EV') {
    return { electric: true, layout: e.layout, cylinders: 0, banks: [], length: 0.9, forcedInduction: false };
  }
  const cylinders = Number.parseInt(e.layout.slice(1), 10);
  const configuration = e.layout[0];
  const twoBanks = configuration === 'V' || configuration === 'F';
  const perBank = twoBanks ? cylinders / 2 : cylinders;
  const length = 0.54 + 0.17 * perBank;
  const banks: PowertrainBank[] = !twoBanks
    ? [{ z: 0, roll: 0, cylinders: perBank }]
    : configuration === 'V'
      ? [{ z: -0.22, roll: -0.38, cylinders: perBank }, { z: 0.22, roll: 0.38, cylinders: perBank }]
      : [{ z: -0.32, roll: -1.03, cylinders: perBank }, { z: 0.32, roll: 1.03, cylinders: perBank }];
  return {
    electric: false,
    layout: e.layout,
    cylinders,
    banks,
    length,
    forcedInduction: e.aspiration !== 'na',
  };
}
