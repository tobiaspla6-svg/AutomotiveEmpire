import { describe, expect, it } from 'vitest';
import { getRegs } from '../src/sim/racing/regs';
import { buildRaceConfig, standings } from '../src/sim/racing/season';
import { computeRaceCar, defaultRaceCar } from '../src/sim/racing/racecar';
import { lapSim } from '../src/sim/racing/lapsim';
import { trackGeom } from '../src/sim/racing/tracks';
import { RaceSim } from '../src/sim/racing/race';
import type { Discipline, GameState } from '../src/sim/types';
import { motorsport, player, step } from './helpers';

/** Real Grand Prix points systems (finishing positions only). */
const F1_POINTS: [number, number, number[]][] = [
  [1950, 1959, [8, 6, 4, 3, 2]],
  [1960, 1960, [8, 6, 4, 3, 2, 1]],
  [1961, 1990, [9, 6, 4, 3, 2, 1]],
  [1991, 2002, [10, 6, 4, 3, 2, 1]],
  [2003, 2009, [10, 8, 6, 5, 4, 3, 2, 1]],
  [2010, 2026, [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]],
];

describe('Grand Prix points systems', () => {
  it('match the historical tables for every season', () => {
    for (const [a, b, pts] of F1_POINTS) for (let y = a; y <= b; y++) expect(getRegs('f1', y).points, String(y)).toEqual(pts);
  });
  it('award the fastest-lap point only in 1950–59 and 2019–24', () => {
    for (let y = 1950; y <= 2026; y++) expect(getRegs('f1', y).flPoint, String(y)).toBe(y <= 1959 || (y >= 2019 && y <= 2024));
  });
  it('2026 rules: 11 teams, 768 kg, 350 kW electric power, and a sane lap time', () => {
    const r = getRegs('f1', 2026);
    expect(r.teams).toBe(11);
    expect(r.minWeight).toBe(768);
    expect(r.hybridKw).toBe(350);
    expect(getRegs('f1', 2025).minWeight).toBe(800);
    const perf = computeRaceCar(defaultRaceCar(r, 2026), { aero: 0.5, engine: 0.5, chassis: 0.5, reliability: 0.5 }, r, 2026, 0.5);
    expect(perf.legal).toEqual([]);
    const lap = lapSim(trackGeom('parco'), { mass: perf.mass + 40, powerW: perf.powerKw * 900, cdA: perf.cdA, clA: perf.clA, mu: perf.mu, awd: false }).time;
    const lap25 = (() => { const r25 = getRegs('f1', 2025); const p = computeRaceCar(defaultRaceCar(r25, 2025), { aero: 0.5, engine: 0.5, chassis: 0.5, reliability: 0.5 }, r25, 2025, 0.5); return lapSim(trackGeom('parco'), { mass: p.mass + 40, powerW: p.powerKw * 900, cdA: p.cdA, clA: p.clA, mu: p.mu, awd: false }).time; })();
    expect(Math.abs(lap - lap25) / lap25).toBeLessThan(0.06); // a different car, but the same performance class
  });
});

function race(g: GameState) {
  const p = player(g);
  const sim = new RaceSim(buildRaceConfig(g, p, p.motorsport!));
  sim.runToEnd();
  return sim;
}

describe('race classification points', () => {
  for (const y of [1955, 1975, 1998, 2005, 2015, 2021, 2025, 2026]) {
    it(`F1 ${y}: points follow the table, the scale and the fastest-lap rule`, () => {
      const sim = race(motorsport({ discipline: 'f1', year: y }));
      const regs = getRegs('f1', y);
      const res = sim.results();
      const fastestId = sim.cars[sim.fastest.idx].e.id;
      let flAwarded = 0;
      res.forEach((r, i) => {
        const base = r.status === 'finished' && i < regs.points.length ? regs.points[i] * sim.cfg.pointsScale : 0;
        const id = `${r.teamId}:${r.carIdx}`;
        const fl = regs.flPoint && id === fastestId && r.status === 'finished' && i < 10 ? 1 : 0;
        flAwarded += fl;
        expect(r.points, `P${r.pos}`).toBe(base + fl);
      });
      if (!regs.flPoint) expect(flAwarded).toBe(0);
    });
  }
  it('the 24-hour race of the endurance calendar is worth double points', () => {
    const g = motorsport({ discipline: 'hypercar', year: 2016 });
    const ch = player(g).motorsport!.championship;
    const r24 = ch.rounds.findIndex((r) => r.hours === 24);
    expect(r24).toBeGreaterThanOrEqual(0);
    expect(ch.rounds[r24].pointsScale).toBe(2);
  });
});

describe('season standings', () => {
  for (const [d, y] of [['f1', 2008], ['touring', 1999], ['gt', 2019]] as [Discipline, number][]) {
    it(`${d} ${y}: championship points are the exact sum of the race results`, () => {
      const g = motorsport({ discipline: d, year: y });
      const div = player(g).motorsport!;
      step(g, 11); // through the last round of the calendar (November)
      const ch = div.championship;
      expect(ch.year).toBe(y);
      expect(ch.results.length).toBe(ch.rounds.length);
      const team: Record<string, number> = {}, driver: Record<string, number> = {};
      for (const rr of ch.results) for (const r of rr.results) {
        team[r.teamId] = (team[r.teamId] ?? 0) + r.points;
        // single-driver series: the classified driver scores the car's points
        const t = ch.teams.find((x) => x.id === r.teamId)!;
        if (getRegs(t.ruleset, y).driversPerCar === 1) driver[r.driverId] = (driver[r.driverId] ?? 0) + r.points;
      }
      for (const t of ch.teams) expect(ch.teamPoints[t.id] ?? 0, t.name).toBeCloseTo(team[t.id] ?? 0, 9);
      for (const [id, pts] of Object.entries(driver)) expect(ch.driverPoints[id], id).toBeCloseTo(pts, 9);
      const st = standings(ch);
      for (let i = 1; i < st.teams.length; i++) expect(ch.teamPoints[st.teams[i - 1].id] ?? 0).toBeGreaterThanOrEqual(ch.teamPoints[st.teams[i].id] ?? 0);
      // January closes the season into the history
      step(g, 2);
      const h = div.history.find((x) => x.year === y)!;
      expect(h).toBeTruthy();
      expect(h.teamChampion).toBe(st.teams[0].name);
      expect(h.playerTeamPos).toBe(st.teams.findIndex((t) => t.isPlayer) + 1);
    });
  }
});
