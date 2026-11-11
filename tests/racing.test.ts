import { describe, expect, it } from 'vitest';
import { buildRaceConfig } from '../src/sim/racing/season';
import { RaceSim } from '../src/sim/racing/race';
import { lapSim } from '../src/sim/racing/lapsim';
import { TRACKS, trackGeom } from '../src/sim/racing/tracks';
import type { GameState } from '../src/sim/types';
import { motorsport, player } from './helpers';

const runRace = (g: GameState, chunk?: number) => {
  const p = player(g);
  const sim = new RaceSim(buildRaceConfig(g, p, p.motorsport!));
  if (chunk) while (!sim.finished) sim.runFor(chunk); else sim.runToEnd();
  return sim;
};

describe('race simulation determinism', () => {
  for (const [d, y] of [['f1', 2010], ['touring', 1995], ['hypercar', 2023]] as const) {
    it(`${d} ${y}: same state and seed → identical race`, () => {
      const g1 = motorsport({ discipline: d, year: y });
      const g2 = JSON.parse(JSON.stringify(g1)) as GameState;
      const a = runRace(g1), b = runRace(g2);
      expect(JSON.stringify(b.results())).toBe(JSON.stringify(a.results()));
      expect(b.log.map((l) => l.text)).toEqual(a.log.map((l) => l.text));
    });
  }
  it('the result does not depend on how the clock is advanced (watched vs instant)', () => {
    const g1 = motorsport({ discipline: 'touring', year: 2005 });
    const g2 = JSON.parse(JSON.stringify(g1)) as GameState;
    expect(JSON.stringify(runRace(g1, 7.3).results())).toBe(JSON.stringify(runRace(g2).results()));
  });
  it('produces a complete, consistent classification', () => {
    const sim = runRace(motorsport({ discipline: 'f1', year: 2016 }));
    const res = sim.results();
    expect(res.map((r) => r.pos)).toEqual(res.map((_, i) => i + 1));
    expect(new Set(res.map((r) => `${r.teamId}:${r.carIdx}`)).size).toBe(res.length);
    const fin = res.filter((r) => r.status === 'finished');
    expect(fin.length).toBeGreaterThan(0);
    for (let i = 1; i < fin.length; i++) expect(fin[i].laps).toBeLessThanOrEqual(fin[i - 1].laps); // classified by laps completed
    expect(res.findIndex((r) => r.status === 'dnf')).toSatisfy((i: number) => i === -1 || res.slice(i).every((r) => r.status === 'dnf'));
    expect(res[0].laps).toBe(sim.cfg.laps);
  });
});

describe('lap-time physics', () => {
  it('every circuit gives a finite lap time; more power is never slower', () => {
    for (const t of TRACKS) {
      const geo = trackGeom(t.id);
      const base = { mass: 800, powerW: 400e3, cdA: 1.1, clA: 3, mu: 1.7, awd: false };
      const a = lapSim(geo, base), b = lapSim(geo, { ...base, powerW: 600e3 });
      expect(Number.isFinite(a.time)).toBe(true);
      expect(b.time).toBeLessThanOrEqual(a.time + 1e-6);
      // average speed between 80 and 300 km/h
      expect(geo.length / a.time * 3.6).toBeGreaterThan(80);
      expect(geo.length / a.time * 3.6).toBeLessThan(300);
    }
  });
});
