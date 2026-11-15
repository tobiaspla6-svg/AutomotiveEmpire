// Art families as data (see sim/vehicleArt.ts for the contract). Only families whose files exist and passed QA are
// listed. The GT-01 keeps its own Phase 5D renderer for now; it is not migrated to this format yet.
import type { ArtLayer, VehicleArtFamily } from '../sim/vehicleArt';
import suv from '../../public/flow/suv90/manifest.json';

type M = typeof suv;
const L = (m: M, k: keyof M['layers']): ArtLayer => ({ file: m.layers[k].file, box: m.layers[k].box as ArtLayer['box'], approval: 'prototype' });

/**
 * SUV 1990, green, four doors (art branch art/suv90-master-20261115-01a1dd27, production-assets/suv-1990-v1).
 * Body: the original JPEG's own pixels with a real alpha channel (scripts/suv90/prepare_suv90.py). Wheels and lamp
 * inserts: images generated with the ChatGPT image tool, mounted with the art branch's measured contracts.
 * Bumper-face trials A/B were reviewed and rejected (seams, double outline): not listed.
 */
export const SUV90: VehicleArtFamily = {
  id: 'suv90-green',
  name: { es: 'SUV 1990 cuatro puertas', en: '1990 four-door SUV' },
  year: 1990,
  bodies: ['suv'],
  years: [1984, 2004],
  master: { file: suv.source, sha256: suv.sourceSha256, branch: suv.artBranch },
  dir: 'suv90',
  canvas: { w: suv.canvas[0], h: suv.canvas[1] },
  transform: { offset: suv.sourceTransform.offset as [number, number], scale: suv.sourceTransform.scale, sourceSize: suv.sourceTransform.sourceSize as [number, number] },
  mounts: { hubs: { front: suv.hubsCanvas.front as [number, number], rear: suv.hubsCanvas.rear as [number, number] }, tyreRadius: suv.tyreRadiusCanvas },
  base: {
    body: { file: 'body.webp', box: [0, 0, suv.canvas[0], suv.canvas[1]], approval: 'prototype' },
    shadow: { file: 'shadow.webp', box: [0, 0, suv.canvas[0], suv.canvas[1]], approval: 'prototype' },
  },
  // measured on the body layer under the mask: median #526a54, luma 0.389
  paint: { mask: { file: 'paint-mask.png', box: [0, 0, suv.canvas[0], suv.canvas[1]], approval: 'prototype' }, original: '#526a54', sourceLuma: 0.389 },
  layers: {
    'wheel-steel-front': L(suv, 'wheel-steel-front'), 'wheel-steel-rear': L(suv, 'wheel-steel-rear'),
    'wheel-alloy-front': L(suv, 'wheel-alloy-front'), 'wheel-alloy-rear': L(suv, 'wheel-alloy-rear'),
    'headlamp-a': L(suv, 'headlamp-a'), 'headlamp-b': L(suv, 'headlamp-b'),
  },
  slots: {
    wheels: [
      { partId: 'wheel-suv90-steel5', layers: [], approval: 'approved', thumb: [170, 334, 226, 226], note: 'original drawing' },
      { partId: 'wheel-suv90-steel6', layers: ['wheel-steel-front', 'wheel-steel-rear'], approval: 'prototype', thumb: [170, 334, 226, 226] },
      { partId: 'wheel-suv90-alloy6', layers: ['wheel-alloy-front', 'wheel-alloy-rear'], approval: 'prototype', thumb: [170, 334, 226, 226] },
    ],
    headlamps: [
      { partId: 'headlamp-suv90-original', layers: [], approval: 'approved', thumb: [78, 250, 96, 70], note: 'original drawing' },
      { partId: 'headlamp-suv90-halogen-a', layers: ['headlamp-a'], approval: 'prototype', thumb: [78, 250, 96, 70] },
      { partId: 'headlamp-suv90-halogen-b', layers: ['headlamp-b'], approval: 'prototype', thumb: [78, 250, 96, 70] },
    ],
    bumperFront: [
      { partId: 'bumper-suv90-standard', layers: [], approval: 'approved', thumb: [60, 330, 130, 110], note: 'original drawing; trial faces A/B rejected' },
    ],
  },
  stack: ['headlamp-a', 'headlamp-b', 'wheel-steel-rear', 'wheel-steel-front', 'wheel-alloy-rear', 'wheel-alloy-front'],
};

export const ART_FAMILIES: Record<string, VehicleArtFamily> = { [SUV90.id]: SUV90 };
