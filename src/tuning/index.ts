// Tuning Empire prototype (Phase 6): a separate, React-free simulation of a tuning business's core loop: fit
// compatible parts, calibrate, dyno, run the strip. Not connected to Automotive Empire's economy or saves.
export * from './types';
export * from './parts';
export * from './engine';
export { simulateDrag, topSpeedKmh, FT60, EIGHTH, QUARTER, DT, type DragResult, type RunOptions } from './drag';
export { VEHICLES, PARTS, STAGES } from './data';
