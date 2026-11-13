// Render descriptor (Phase 3, extended in Phase 4): everything a renderer needs to draw a car, as plain data.
//
// The simulation does not depend on graphics. The 3D layer (src/three) reads ONLY this descriptor: the asset adapter
// picks a GLB asset that fits the body and engine layout, stretches it to these dimensions, places and sizes the
// wheels, sets the ride height, shows the aero parts, the grille and exhausts for the engine, and applies paint,
// wheel design and trim styling — without reading engineering internals. All lengths are metres.
import type { Company, PaintFinish, Platform, Trim, TrimLevel, VehicleModel, VehicleSpec, WheelStyle } from './types';
import { BODY, CYL, dims } from './engineering';
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
  engine: { layout: VehicleSpec['engine']['layout']; position: VehicleSpec['enginePos']; electric: boolean; aspiration: VehicleSpec['engine']['aspiration']; cylinders: number };
  drive: VehicleSpec['drive'];
  aero: { wing: number; splitter: number; flatFloor: boolean };
  /** body construction (for material choices: carbon weave, aluminium, steel paint) */
  structure: VehicleSpec['chassis']; panels: VehicleSpec['panels'];
  interior: VehicleSpec['interior']; seats: number;
  color: string;
  /** cosmetic choices (Phase 4); null = the renderer picks the trim's default */
  finish: PaintFinish | null;
  wheelStyle: WheelStyle | null;
  /** 0 comfort .. 1 track (stance, brake and caliper styling) */
  sport: number;
  trim: { name: string; level: TrimLevel | 'base' };
  platform: { id: string | null; name: string | null };
}

/** Descriptor of a bare specification (the design studio, before a model exists). */
export function specDescriptor(s: VehicleSpec, trim?: { name: string; level: TrimLevel | 'base' }, platform?: Pick<Platform, 'id' | 'name'> | null): RenderDescriptor {
  const d = dims(s);
  return {
    version: 1, body: s.body,
    length: d.length, width: d.width, height: d.height, wheelbase: d.wheelbase, track: d.track,
    wheelDia: s.wheelDia, tireWidth: s.tireWidth, tireRadius: d.tireR, rideHeight: d.clearance,
    suspension: { front: s.suspFront, rear: s.suspRear },
    engine: { layout: s.engine.layout, position: s.enginePos, electric: s.engine.layout === 'EV', aspiration: s.engine.aspiration, cylinders: CYL[s.engine.layout] },
    drive: s.drive, aero: { wing: s.wing, splitter: s.splitter, flatFloor: s.flatFloor },
    structure: s.chassis, panels: s.panels, interior: s.interior, seats: s.seats, color: s.color,
    finish: s.finish ?? null, wheelStyle: s.wheelStyle ?? null, sport: s.sport,
    trim: trim ?? { name: BODY[s.body].name, level: 'base' },
    platform: { id: platform?.id ?? null, name: platform?.name ?? null },
  };
}

/** Descriptor of a model (or one of its trims). */
export function renderDescriptor(c: Company | null, m: VehicleModel, trim?: Trim): RenderDescriptor {
  const s = trim?.spec ?? m.spec;
  const p = c ? platformOf(c, m) : undefined;
  return specDescriptor(s, trim ? { name: trim.name, level: trim.level } : undefined, p ?? null);
}
