// Render descriptor (Phase 3): everything a renderer needs to draw a car, as plain data.
//
// The simulation does not depend on graphics. A future GLB/Blender pipeline (or the current procedural car
// generator) can read this descriptor to pick a body mesh, scale it to the platform's dimensions, place the
// wheels, choose wheel and tyre sizes, set the ride height, add aero parts, show the engine through glass where
// it is visible, and apply trim badges and paint — without reading engineering internals. All lengths are metres.
import type { Company, Trim, TrimLevel, VehicleModel, VehicleSpec } from './types';
import { BODY, dims } from './engineering';
import { platformOf } from './families';

export interface RenderDescriptor {
  version: 1;
  body: VehicleSpec['body'];
  /** overall dimensions and the platform's wheelbase and track */
  length: number; width: number; height: number; wheelbase: number; track: number;
  /** wheel rim diameter (inches), tyre width (mm), tyre radius (m) */
  wheelDia: number; tireWidth: number; tireRadius: number;
  /** ground clearance (m) — the suspension ride height */
  rideHeight: number;
  suspension: { front: VehicleSpec['suspFront']; rear: VehicleSpec['suspRear'] };
  engine: { layout: VehicleSpec['engine']['layout']; position: VehicleSpec['enginePos']; electric: boolean; aspiration: VehicleSpec['engine']['aspiration'] };
  drive: VehicleSpec['drive'];
  aero: { wing: number; splitter: number; flatFloor: boolean };
  /** body construction (for material choices: carbon weave, aluminium, steel paint) */
  structure: VehicleSpec['chassis']; panels: VehicleSpec['panels'];
  interior: VehicleSpec['interior']; seats: number;
  color: string;
  trim: { name: string; level: TrimLevel | 'base' };
  platform: { id: string | null; name: string | null };
}

/** Descriptor of a model (or one of its trims). */
export function renderDescriptor(c: Company | null, m: VehicleModel, trim?: Trim): RenderDescriptor {
  const s = trim?.spec ?? m.spec;
  const d = dims(s);
  const p = c ? platformOf(c, m) : undefined;
  return {
    version: 1, body: s.body,
    length: d.length, width: d.width, height: d.height, wheelbase: d.wheelbase, track: d.track,
    wheelDia: s.wheelDia, tireWidth: s.tireWidth, tireRadius: d.tireR, rideHeight: d.clearance,
    suspension: { front: s.suspFront, rear: s.suspRear },
    engine: { layout: s.engine.layout, position: s.enginePos, electric: s.engine.layout === 'EV', aspiration: s.engine.aspiration },
    drive: s.drive, aero: { wing: s.wing, splitter: s.splitter, flatFloor: s.flatFloor },
    structure: s.chassis, panels: s.panels, interior: s.interior, seats: s.seats, color: s.color,
    trim: trim ? { name: trim.name, level: trim.level } : { name: BODY[s.body].name, level: 'base' },
    platform: { id: p?.id ?? null, name: p?.name ?? null },
  };
}
