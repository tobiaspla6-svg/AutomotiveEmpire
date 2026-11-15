// Vehicle art families defined by data (Phase 6). A family is one approved master drawing plus the layers that can be
// mounted on it, all in one canvas with one transform. The editor reads this data; adding a vehicle means adding a
// family record and its files, not new editor code.
//
// Visual and mechanical configuration are separate on purpose:
//   - VISUAL (this file, sim/vehicleConfig.ts VehicleConfig): which image is shown. It never changes the simulation:
//     a wheel layer adds no power, a lamp insert no weight.
//   - MECHANICAL (sim/types.ts VehicleSpec for Automotive Empire, src/tuning for the Tuning Empire prototype): what
//     the simulation computes with.
// A visual part may *refer* to a mechanical component (e.g. a 16-inch steel wheel), but the link is explicit data,
// never an implicit effect of choosing an image.

/** Review state of one piece of art. Only 'approved' and 'prototype' are ever drawn by the game. */
export type ArtApproval = 'approved' | 'prototype' | 'pending' | 'rejected';
export const DRAWABLE: readonly ArtApproval[] = ['approved', 'prototype'];

export type Box = [x: number, y: number, w: number, h: number];

/** One raster layer in the family canvas. */
export interface ArtLayer {
  file: string;
  box: Box;
  approval: ArtApproval;
  /** Mask that limits a repaint to this layer's body-colour pixels (same box). */
  paintMask?: string;
}

/** A visual option for a slot: the layers that replace the master drawing in that slot (none = the master itself). */
export interface ArtVariant {
  partId: string;
  layers: string[];
  approval: ArtApproval;
  /** cut-out of the canvas shown as the option thumbnail */
  thumb: Box;
  note?: string;
}

export interface VehicleArtFamily {
  id: string;
  name: { es: string; en: string };
  /** era the drawing represents */
  year: number;
  /** body types and design years it may represent in the game */
  bodies: string[];
  years: [from: number, to: number];
  master: { file: string; sha256: string; branch?: string };
  /** directory under public/flow holding every file below */
  dir: string;
  canvas: { w: number; h: number };
  /** canvas = (source − offset) × scale: one uniform transform for every layer */
  transform: { offset: [number, number]; scale: number; sourceSize: [number, number] };
  mounts: { hubs: Record<'front' | 'rear', [number, number]>; tyreRadius: number };
  base: { body: ArtLayer; shadow: ArtLayer };
  paint: { mask: ArtLayer; original: string; sourceLuma: number } | null;
  layers: Record<string, ArtLayer>;
  /** slot → its options; the first entry is the master drawing's own part */
  slots: Record<string, ArtVariant[]>;
  /** order in which variant layers are stacked (lower first) */
  stack: string[];
}

const inside = ([x, y, w, h]: Box, W: number, H: number) => w > 0 && h > 0 && x >= 0 && y >= 0 && x + w <= W && y + h <= H;

/** Structural checks on a family record. Returns every problem found (empty = valid). */
export function validateArtFamily(f: VehicleArtFamily): string[] {
  const errs: string[] = [];
  const { w, h } = f.canvas;
  if (!f.id || !/^[a-z0-9-]+$/.test(f.id)) errs.push('id must be kebab-case');
  if (!(w > 0 && h > 0)) errs.push('canvas must have a size');
  if (!(f.transform.scale > 0)) errs.push('transform scale must be positive');
  if (f.years[0] > f.years[1]) errs.push('years are reversed');
  for (const [k, L] of Object.entries({ ...f.layers, body: f.base.body, shadow: f.base.shadow, ...(f.paint ? { paintMask: f.paint.mask } : {}) })) {
    if (!inside(L.box, w, h)) errs.push(`layer ${k}: box outside the canvas`);
  }
  for (const [slot, opts] of Object.entries(f.slots)) {
    if (!opts.length) { errs.push(`slot ${slot}: no options`); continue; }
    if (opts[0].layers.length) errs.push(`slot ${slot}: the first option must be the master drawing (no layers)`);
    const ids = new Set<string>();
    for (const o of opts) {
      if (ids.has(o.partId)) errs.push(`slot ${slot}: duplicate ${o.partId}`);
      ids.add(o.partId);
      for (const l of o.layers) {
        const L = f.layers[l];
        if (!L) errs.push(`${o.partId}: unknown layer ${l}`);
        else if (DRAWABLE.includes(o.approval) && !DRAWABLE.includes(L.approval)) errs.push(`${o.partId}: drawable option uses a ${L.approval} layer ${l}`);
        if (L && !f.stack.includes(l)) errs.push(`${o.partId}: layer ${l} has no stacking order`);
      }
      if (!inside(o.thumb, w, h)) errs.push(`${o.partId}: thumbnail outside the canvas`);
    }
  }
  for (const [k, [x, y]] of Object.entries(f.mounts.hubs)) if (x < 0 || y < 0 || x > w || y > h) errs.push(`hub ${k} outside the canvas`);
  if (f.paint && !/^#[0-9a-f]{6}$/i.test(f.paint.original)) errs.push('original paint must be #rrggbb');
  return errs;
}

/** Options of a slot that the game may draw (approved or prototype). Pending and rejected art is never offered. */
export const drawableOptions = (f: VehicleArtFamily, slot: string) => (f.slots[slot] ?? []).filter((o) => DRAWABLE.includes(o.approval));

/** Layers to stack for a chosen configuration, in stacking order. Unknown or non-drawable choices draw nothing. */
export function layersFor(f: VehicleArtFamily, parts: Record<string, string> | undefined): string[] {
  const chosen = new Set<string>();
  for (const [slot, id] of Object.entries(parts ?? {})) {
    const o = drawableOptions(f, slot).find((x) => x.partId === id);
    for (const l of o?.layers ?? []) chosen.add(l);
  }
  return f.stack.filter((l) => chosen.has(l));
}
