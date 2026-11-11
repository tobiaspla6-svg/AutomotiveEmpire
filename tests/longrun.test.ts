// Multi-decade soak tests: an automated player keeps the company running while the invariants are
// checked every January. These catch slow drift (NaN, runaway values, unbounded growth of state).
import { describe, expect, it } from 'vitest';
import * as A from '../src/sim/actions';
import { defaultVehicle } from '../src/sim/engineering';
import { defaultRaceCar } from '../src/sim/racing/racecar';
import { playerTeam, teamRegs } from '../src/sim/racing/season';
import { equity } from '../src/sim/accounts';
import type { GameState } from '../src/sim/types';
import { ceo, founder, motorsport, nonFinitePaths, player, step } from './helpers';

function checkInvariants(g: GameState) {
  expect(nonFinitePaths(g), `${g.month}/${g.year}`).toEqual([]);
  for (const c of g.companies) {
    expect(c.cash).toBeGreaterThanOrEqual(0);
    expect(c.debt).toBeGreaterThanOrEqual(-1e-6);
    expect(c.ledger.length).toBeLessThanOrEqual(180);
    for (const m of c.models) { expect(m.inventory).toBeGreaterThanOrEqual(0); expect(m.inventoryValue).toBeGreaterThanOrEqual(-1e-6); expect(m.salesHistory.length).toBeLessThanOrEqual(120); }
    expect(c.prestige).toBeGreaterThanOrEqual(0); expect(c.prestige).toBeLessThanOrEqual(100);
  }
  expect(g.news.length).toBeLessThanOrEqual(250);
  expect(JSON.stringify(g).length).toBeLessThan(12e6); // a save must stay comfortably storable
}

/** Replace any model older than `age` years with a new generation and move its production lines. */
function renewRange(g: GameState, age: number) {
  const p = player(g);
  for (const m of p.models.filter((x) => x.status === 'production' && g.year - x.launchYear >= age)) {
    if (p.models.some((y) => y.status === 'development' && y.name.startsWith(m.name.split(' Mk')[0]))) continue;
    const spec = { ...defaultVehicle(g.year, m.spec.body), color: m.spec.color };
    A.startDevelopment(g, `${m.name.split(' Mk')[0]} Mk${m.generation + 1}`, spec, m.segment, m.id);
  }
  for (const n of p.models.filter((x) => x.status === 'ready')) {
    const old = p.models.find((x) => x.status === 'production' && n.name.startsWith(x.name.split(' Mk')[0]) && x.id !== n.id);
    let placed = false;
    for (const f of p.factories) {
      const l = old && f.lines.find((x) => x.modelId === old.id);
      if (!l) continue;
      const units = f.capacity * l.share;
      A.removeLine(g, f.id, old!.id);
      placed = !A.addLine(g, f.id, n.id, units) || placed;
    }
    if (old && placed) A.retireModel(g, old.id);
  }
}

describe('long-term stability', () => {
  it('Historical CEO: 35 years of Volkswagen with model renewals, alternative history', () => {
    const g = ceo({ makerId: 'vw', year: 1970, difficulty: 'easy', historyMode: 'alternative' });
    for (let y = 0; y < 35 && !g.gameOver; y++) {
      if (y % 2 === 0) renewRange(g, 7);
      step(g, 12);
      checkInvariants(g);
    }
    expect(g.year).toBeGreaterThanOrEqual(2000);
    expect(equity(player(g))).toBeGreaterThan(0);
  });

  it('Company Founder: 25 years from a single design, with a racing programme', () => {
    const g = founder({ year: 1975, difficulty: 'normal' });
    const p = player(g);
    A.startDevelopment(g, 'First', defaultVehicle(1975, 'hatch'), 'budget');
    for (let y = 0; y < 25 && !g.gameOver; y++) {
      for (let i = 0; i < 12; i++) {
        const ready = p.models.find((m) => m.status === 'ready');
        if (ready && p.factories[0].capacity > 0) A.addLine(g, p.factories[0].id, ready.id, Math.floor(p.factories[0].capacity * (1 - p.factories[0].lines.reduce((a, l) => a + l.share, 0))));
        step(g);
      }
      if (y === 4) A.establishMotorsport(g, 'touring', 'Founder Racing');
      if (y % 3 === 2) renewRange(g, 6);
      checkInvariants(g);
    }
    expect(g.gameOver === null || typeof g.gameOver.reason === 'string').toBe(true);
  });

  for (const [d, y0, years] of [['f1', 1985, 22], ['hypercar', 1995, 20], ['touring', 1980, 25], ['gt', 2005, 20]] as const) {
    it(`Motorsport Director: ${years} seasons of ${d} from ${y0} across regulation changes`, () => {
      const g = motorsport({ discipline: d, year: y0, budget: 1, difficulty: 'easy' });
      const p = player(g);
      for (let y = 0; y < years && !g.gameOver; y++) {
        const div = p.motorsport!;
        const team = playerTeam(div);
        const regs = teamRegs(team, g.year);
        const legal = defaultRaceCar(regs, g.year, team.color, team.color2);
        if (legal.engine.layout !== team.car.engine.layout || legal.engine.displacement !== team.car.engine.displacement) A.redesignRaceCar(g, legal);
        step(g, 12);
        checkInvariants(g);
        expect(div.championship.year).toBe(g.year);
      }
      expect(p.motorsport!.history.length).toBeGreaterThan(Math.min(years, 3));
    });
  }
});
