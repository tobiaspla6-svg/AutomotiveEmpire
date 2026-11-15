// Market grade for the *vehicle itself*, relative to the segment it was designed for.
// Presentation only: market.ts already uses scores, pricing, marketing and competition
// to calculate actual demand. Never multiply sales by this grade again.
import type { BodyType, Scores, SegmentId, VehicleModel } from './types';
import { SEG } from '../data/world';

export type VehicleGrade = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'S+';

export interface GradeReport {
  grade: VehicleGrade;
  score: number; // 0..100: segment-weighted product quality, NOT a forecast of sales
  segmentScore: number;
  bodyFit: number; // 0..1: fit of this body style to the chosen segment
}

/** Initial presentation thresholds; calibrate with historical model distributions
 * before relying on grade-specific missions or unlocks. */
const THRESHOLDS: ReadonlyArray<{ min: number; grade: VehicleGrade }> = [
  { min: 94, grade: 'S+' }, { min: 86, grade: 'S' },
  { min: 77, grade: 'A' }, { min: 68, grade: 'B' },
  { min: 58, grade: 'C' }, { min: 48, grade: 'D' },
  { min: 38, grade: 'E' }, { min: 0, grade: 'F' },
];
const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function gradeFromScores(scores: Scores, segment: SegmentId, body: BodyType): GradeReport {
  const def = SEG[segment];
  const weights = Object.entries(def.weights) as [keyof Scores, number][];
  const denominator = weights.reduce((sum, [, weight]) => sum + weight, 0);
  const quality = denominator > 0
    ? weights.reduce((sum, [key, weight]) => sum + weight * clamp01(scores[key] / 100), 0) / denominator
    : 0;
  const bodyFit = clamp01(def.bodyFit[body] ?? 0.3);
  // A great SUV is not inferior to a great supercar merely because it is slower.
  // Existing segment score weights determine what 'good' means to its customers.
  const score = Math.round(100 * clamp01(quality * 0.9 + bodyFit * 0.1));
  return { grade: THRESHOLDS.find((t) => score >= t.min)!.grade, score,
    segmentScore: Math.round(quality * 100), bodyFit };
}

export function gradeForModel(model: Pick<VehicleModel, 'stats' | 'segment' | 'spec'>): GradeReport {
  return gradeFromScores(model.stats.scores, model.segment, model.spec.body);
}
