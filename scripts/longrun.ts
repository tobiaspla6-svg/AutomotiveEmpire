// Long headless soak test: plays decades in each mode exercising most player actions.
import { newCeoGame, newFounderGame, newMotorsportGame, advanceMonth, player, capitalOptions } from '../src/sim/world';
import * as A from '../src/sim/actions';
import { defaultVehicle } from '../src/sim/engineering';
import { resolveDecision } from '../src/sim/events';
import { annualProfit, annualRevenue, annualUnits } from '../src/sim/company';
import { defaultRaceCar } from '../src/sim/racing/racecar';
import { playerTeam, teamRegs } from '../src/sim/racing/season';
import type { GameState } from '../src/sim/types';
const M = (x: number) => (x / 1e6).toFixed(0) + 'M';
function step(g: GameState) { if (g.decision) resolveDecision(g, 0, g.rng); advanceMonth(g); }
function line(g: GameState, tag: string) { const p = player(g); console.log(`${tag} ${g.year}: cash ${M(p.cash)} debt ${M(p.debt)} rev ${M(annualRevenue(p))} profit ${M(annualProfit(p))} units ${Math.round(annualUnits(p))} models ${p.models.filter((m) => m.status === 'production').length} plants ${p.factories.length} prestige ${p.prestige.toFixed(0)} board ${p.board?.confidence.toFixed(0) ?? '-'} ms ${p.motorsport ? 'P' + (p.motorsport.history.slice(-1)[0]?.playerTeamPos ?? '?') : '-'} ${g.gameOver?.reason ?? ''}`); }

// 1) CEO, alternative history, actively managed: renew every model at age 7, buy a rival, go racing
{
  const g = newCeoGame({ makerId: 'vw', year: 1968, difficulty: 'easy', historyMode: 'alternative' });
  const t0 = Date.now();
  for (let i = 0; i < 12 * 40 && !g.gameOver; i++) {
    const p = player(g);
    if (g.month === 2) {
      for (const m of p.models.filter((x) => x.status === 'production' && g.year - x.launchYear >= 7 && !p.models.some((y) => y.status === 'development' && y.name.startsWith(x.name.split(' Mk')[0])))) {
        const s = JSON.parse(JSON.stringify(m.spec)); const d = defaultVehicle(g.year, s.body);
        s.engine.valvetrain = d.engine.valvetrain; s.engine.fuelSystem = d.engine.fuelSystem; s.engine.compression = d.engine.compression; s.brakes = d.brakes; s.safety = d.safety; s.gears = Math.max(s.gears, d.gears); s.aeroOpt = 0.6;
        const err = A.startDevelopment(g, `${m.name.split(' Mk')[0]} Mk${m.generation + 1}`, s, m.segment, m.id);
        if (err && i % 60 === 1) console.log('   dev err:', err);
      }
      for (const m of p.models.filter((x) => x.status === 'ready')) {
        const old = p.models.find((x) => x.status === 'production' && m.name.startsWith(x.name.split(' Mk')[0]) && x.id !== m.id);
        let placed = false;
        for (const f of p.factories) { const l = old && f.lines.find((x) => x.modelId === old.id); if (l) { const units = f.capacity * l.share; A.removeLine(g, f.id, old!.id); const e = A.addLine(g, f.id, m.id, units); placed = placed || !e; } }
        if (old && placed) A.retireModel(g, old.id);
      }
      if (g.year === 1975) console.log('   motorsport:', A.establishMotorsport(g, 'touring', 'VW Racing'));
      if (g.year === 1985) { const t = g.companies.find((c) => c.id === 'lamborghini' && c.alive); if (t) console.log('   acquire lamborghini:', A.acquire(g, t.id)); }
      if (g.year === 1990) console.log('   build factory:', A.buildFactory(g, 'Test', 'China', 4000, 0.3), A.investDealers(g, 'CN', 200e6));
    }
    step(g);
    if (g.month === 1 && g.year % 5 === 0) line(g, 'CEO-vw');
  }
  line(g, 'CEO-vw END'); console.log('   fired events:', g.fired.join(','), `(${Date.now() - t0} ms)`);
}
// 2) Founder 1955, hard, passive after first car
{
  const g = newFounderGame({ name: 'Soak Motors', country: 'UK', year: 1955, capital: capitalOptions(1955)[2], specialization: 'sports', factory: 2, engineers: 1, research: 1, workforce: 1, color: '#225522', difficulty: 'hard', historyMode: 'historical' });
  const p = player(g); const s = defaultVehicle(1955, 'roadster'); s.engine.displacement = 1600; s.sport = 0.6;
  console.log('founder dev:', A.startDevelopment(g, 'Sprite', s, 'sports'));
  for (let i = 0; i < 12 * 25 && !g.gameOver; i++) {
    const m = p.models.find((x) => x.status === 'ready'); if (m) console.log('   line:', A.addLine(g, p.factories[0].id, m.id, Math.floor(p.factories[0].capacity * 0.9)), 'price', Math.round(m.price));
    if (g.year === 1962 && g.month === 3) console.log('   ms:', A.establishMotorsport(g, 'gt', 'Soak Racing'));
    step(g); if (g.month === 1 && g.year % 5 === 0) line(g, 'Founder');
  }
  line(g, 'Founder END');
}
// 3) Motorsport across regulation changes (F1 1986 -> 2016) and endurance (1990 -> 2025), with redesigns each January
for (const [disc, y0, yrs] of [['f1', 1986, 30], ['hypercar', 1990, 35], ['gt', 2000, 12], ['touring', 1980, 40]] as const) {
  const g = newMotorsportGame({ makerId: null, teamName: 'Soak GP', discipline: disc, year: y0, budget: 2, facilities: 4, staff: 80, target: 4, color: '#aa2222', color2: '#fff', difficulty: 'easy', historyMode: 'alternative' });
  const t0 = Date.now(); const p = player(g);
  for (let i = 0; i < 12 * yrs && !g.gameOver; i++) {
    if (g.month === 2) { const div = p.motorsport!; const team = playerTeam(div); const regs = teamRegs(team, g.year); const car = defaultRaceCar(regs, g.year, team.color, team.color2); if (car.engine.layout !== team.car.engine.layout || car.engine.displacement !== team.car.engine.displacement) A.redesignRaceCar(g, car); A.setDevBudget(g, regs.budget2020 * 0.02); }
    step(g);
  }
  line(g, `MS-${disc} END`);
  console.log('   ', p.motorsport!.history.map((h) => `${h.year}:P${h.playerTeamPos}`).join(' '), `(${Date.now() - t0} ms)`);
}
