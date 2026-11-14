// Display names for cosmetic choices (pure data, no Three.js import, so the interface can use them without loading 3D).
import type { PaintFinish } from '../../sim/types';
export const FINISH_NAME: Record<PaintFinish, string> = { solid: 'Solid gloss', metallic: 'Metallic', pearl: 'Pearlescent', matte: 'Satin matte' };
