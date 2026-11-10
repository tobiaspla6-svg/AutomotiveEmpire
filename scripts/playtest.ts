import { newCeoGame, newFounderGame, newMotorsportGame, advanceMonth, player, capitalOptions } from '../src/sim/world';
import { startDevelopment, addLine, investDealers, setMarketing } from '../src/sim/actions';
import { defaultVehicle } from '../src/sim/engineering';
import { buildRaceConfig, standings, applyRaceResult } from '../src/sim/racing/season';
import { RaceSim, fmt } from '../src/sim/racing/race';
import { annualRevenue, annualProfit, annualUnits } from '../src/sim/company';
import type { GameState } from '../src/sim/types';

const M = (x: number) => (x / 1e6).toFixed(1) + 'M';
function summary(g: GameState, label: string) {
  const p = player(g);
  console.log(`${label} ${g.month}/${g.year}: cash ${M(p.cash)} debt ${M(p.debt)} rev/yr ${M(annualRevenue(p))} profit/yr ${M(annualProfit(p))} units/yr ${Math.round(annualUnits(p))} prestige ${p.prestige.toFixed(0)} board ${p.board?.confidence.toFixed(0)} ${g.gameOver ? 'GAME OVER: ' + g.gameOver.reason : ''}`);
}
function run(g: GameState, months: number) { for (let i = 0; i < months && !g.gameOver; i++) { if (g.decision) { g.decision = null; } advanceMonth(g); } }

const which = process.argv[2] ?? 'all';
if (which === 'all' || which === 'ceo') {
  for (const [id, y] of [['ferrari', 1985], ['toyota', 2000], ['bmw', 1959], ['ford', 1965], ['lamborghini', 1978], ['tesla', 2018]] as const) {
    const t0 = Date.now();
    const g = newCeoGame({ makerId: id, year: y, difficulty: 'normal', historyMode: 'historical' });
    const p = player(g);
    console.log(`\n== CEO ${id} ${y}: ${p.models.length} models, ${p.factories.length} plants, cash ${M(p.cash)} debt ${M(p.debt)} eng ${p.engineers} ms ${p.motorsport?.discipline ?? '-'} (init ${Date.now() - t0}ms)`);
    console.log('   models:', p.models.map((m) => `${m.name} $${Math.round(m.price / 1000)}k/${Math.round(m.lastUnitCost / 1000)}k ${m.stats.powerKw.toFixed(0)}kW ${m.stats.zeroTo100.toFixed(1)}s`).slice(0, 6).join(' | '));
    const t1 = Date.now();
    run(g, 12); summary(g, '  +1y');
    console.log('   sales:', p.models.filter((m) => m.status === 'production').map((m) => `${m.name} ${m.salesHistory.slice(-12).reduce((a, b) => a + b, 0)}`).slice(0, 8).join(' | '));
    run(g, 48); summary(g, '  +5y');
    console.log(`   (${Date.now() - t1}ms for 60 months)  others:`, g.companies.filter((c) => !c.isPlayer && c.alive).slice(0, 6).map((c) => `${c.name} ${Math.round(annualUnits(c) / 1000)}k/${Math.round(c.baseVolume / 1000)}k`).join(' | '));
    const L = p.ledger[p.ledger.length - 1];
    console.log('   last month ledger:', Object.entries(L).filter(([k]) => !['y', 'm'].includes(k)).map(([k, v]) => `${k} ${M(v as number)}`).join(' '));
  }
}
if (which === 'all' || which === 'founder') {
  const year = 2020;
  const g = newFounderGame({ name: 'Aurelia Motors', country: 'Italy', year, capital: capitalOptions(year)[2], specialization: 'sports', factory: 2, engineers: 1, research: 1, workforce: 1, color: '#2255aa', difficulty: 'normal', historyMode: 'alternative' });
  const p = player(g);
  console.log(`\n== FOUNDER: cash ${M(p.cash)} plants ${p.factories.length} tech ${JSON.stringify(p.tech)}`);
  const s = defaultVehicle(year, 'coupe'); s.engine.displacement = 2000; s.engine.aspiration = 'turbo'; s.engine.boost = 0.9; s.engine.compression = 9.8; s.drive = 'RWD'; s.tireCompound = 'sport'; s.sport = 0.6; s.engine.fuelSystem = 'efi';
  console.log('   startDev:', startDevelopment(g, 'Aurelia GT', s, 'sports'));
  const m = p.models[0];
  console.log(`   dev cost ${M(m.devCostTotal)} months ${m.devMonthsTotal}; stats 0-100 ${m.stats.zeroTo100.toFixed(1)} parts ${Math.round(m.stats.partsCost)}`);
  let guard = 0; while (m.status === 'development' && guard++ < 80) run(g, 1);
  summary(g, `  dev done after ${guard} months`);
  console.log('   addLine:', addLine(g, p.factories[0].id, m.id, 500), 'price', m.price);
  m.price = 42000; setMarketing(g, 400000); console.log('   dealers:', investDealers(g, 'EU', 20e6), investDealers(g, 'NA', 25e6));
  run(g, 12); summary(g, '  +1y selling');
  console.log(`   model: demand ${m.lastDemand.toFixed(0)}/mo inv ${m.inventory.toFixed(0)} unit cost ${Math.round(m.lastUnitCost)} sold12 ${m.salesHistory.slice(-12).reduce((a, b) => a + b, 0)}`);
  run(g, 36); summary(g, '  +4y selling');
  console.log('   news:', g.news.slice(0, 5).map((n) => n.title).join(' | '));
}
if (which === 'all' || which === 'ms') {
  for (const [disc, y] of [['f1', 2010], ['hypercar', 2023], ['touring', 1995], ['gt', 2020], ['f1', 1967]] as const) {
    const g = newMotorsportGame({ makerId: disc === 'f1' && y === 2010 ? 'ferrari' : null, teamName: 'Test Racing', discipline: disc, year: y, budget: 1, facilities: 3, staff: 70, target: 5, color: '#aa2222', color2: '#ffffff', difficulty: 'normal', historyMode: 'historical' });
    const p = player(g), div = p.motorsport!;
    console.log(`\n== MOTORSPORT ${disc} ${y}: teams ${div.championship.teams.map((t) => t.name).join(', ')}`);
    console.log(`   rounds ${div.championship.rounds.map((r) => r.name + (r.hours ? ` ${r.hours}h` : ` ${r.laps}L`)).join(' | ')}`);
    run(g, 2);
    const cfg = buildRaceConfig(g, p, div);
    const t0 = Date.now();
    const sim = new RaceSim(cfg);
    sim.runToEnd();
    const res = sim.results();
    console.log(`   race ${cfg.name} (${Date.now() - t0}ms, t=${(sim.t / 60).toFixed(1)}min, weather ${cfg.weather.label}) pole ${fmt(sim.qualifying[0].time)} fastest ${fmt(sim.fastest.time)}`);
    console.log('   ' + res.slice(0, 8).map((r) => `P${r.pos} ${sim.cfg.entries.find((e) => e.teamId === r.teamId && e.carIdx === r.carIdx)!.drivers[0].name.split(' ')[1]}(g${r.grid},${r.laps}L,${r.stops}st${r.status === 'dnf' ? ',DNF ' + r.reason : ''})`).join(' '));
    console.log(`   dnf ${res.filter((r) => r.status === 'dnf').length}/${res.length}; passes logged ${sim.log.filter((l) => l.kind === 'pass').length}; log sample: ${sim.log.slice(-4).map((l) => l.text).join(' / ')}`);
    applyRaceResult(g, p, div, sim);
    run(g, 22);
    summary(g, '  +2y');
    console.log('   history:', div.history.map((h) => `${h.year}: P${h.playerTeamPos} champ ${h.teamChampion}`).join(' | '), '| standings now:', standings(div.championship).teams.slice(0, 3).map((t) => t.name).join(', '));
  }
}
