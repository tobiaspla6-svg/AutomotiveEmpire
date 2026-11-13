// The visual plan for a descriptor, memoised on its content. Pure (no Three.js), so interface code can call it.
import { useMemo } from 'react';
import type { RenderDescriptor } from '../../sim/render';
import { planVehicle, type VisualPlan } from './adapter';

export function useVisualPlan(desc: RenderDescriptor, year?: number): VisualPlan {
  const key = JSON.stringify(desc) + '|' + (year ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => planVehicle(desc, year), [key]);
}
