import { describe, expect, it } from 'vitest';
import { gradeFromScores, gradeForModel } from '../src/sim/marketGrade';
import type { Scores, VehicleModel } from '../src/sim/types';

const same = (value: number): Scores => ({
  performance: value, comfort: value, economy: value, reliability: value,
  safety: value, practicality: value, prestige: value, drivability: value,
});
describe('segment-relative vehicle grade F to S+', () => {
  it('is bounded at both ends with honest extreme grades', () => {
    expect(gradeFromScores(same(0), 'family', 'sedan')).toMatchObject({ grade: 'F', score: 10 });
    expect(gradeFromScores(same(100), 'family', 'sedan')).toMatchObject({ grade: 'S+', score: 100 });
    expect(gradeFromScores(same(100), 'sports', 'coupe').grade).toBe('S+');
  });
  it('values what the intended segment wants, not just horsepower', () => {
    const practical = { ...same(50), performance: 10, economy: 95, reliability: 95, practicality: 95 };
    const city = gradeFromScores(practical, 'budget', 'hatch');
    const sports = gradeFromScores(practical, 'sports', 'hatch');
    expect(city.score).toBeGreaterThan(sports.score);
  });
  it('rewards a compatible body style without rewriting engineering stats', () => {
    const before = same(75);
    expect(gradeFromScores(before, 'pickup', 'pickup').score)
      .toBeGreaterThan(gradeFromScores(before, 'pickup', 'supercar').score);
    expect(before).toEqual(same(75));
  });
  it('returns real values for a full vehicle model without changing saves', () => {
    const model = { segment: 'family', spec: { body: 'sedan' }, stats: { scores: same(75) } }
      as VehicleModel;
    const old = JSON.stringify(model);
    expect(gradeForModel(model)).toMatchObject({ grade: 'A', score: 78, segmentScore: 75 });
    expect(JSON.stringify(model)).toBe(old);
  });
  it('does not reward missing or nonfinite score values', () => {
    const broken = { ...same(50), performance: Number.NaN, comfort: Number.POSITIVE_INFINITY };
    const grade = gradeFromScores(broken, 'premium', 'sedan');
    expect(grade.score).toBeGreaterThanOrEqual(0);
    expect(grade.score).toBeLessThanOrEqual(100);
  });
});
