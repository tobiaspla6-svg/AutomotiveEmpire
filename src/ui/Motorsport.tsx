import { useMemo, useState } from 'react';
import type { Company, DevLevels, Discipline, EngineLayout, GameState, MotorsportDivision, RaceCarSpec } from '../sim/types';
import { useGame, useStore } from '../store/game';
import { CYL, LAYOUT_NAME } from '../sim/engineering';
import { DISCIPLINES, DISC_NAME, disciplineAvailable, getRegs } from '../sim/racing/regs';
import { budgetRef, divisionTech, overall, pendingRound, playerTeam, RESERVE_ALLOWED, seasonBudget, standings, teamRegs } from '../sim/racing/season';
import { ACADEMY_COST, GROUP, GROUP_NAME, effectiveOverall, potentialOf, potentialOverall, specialtyOf } from '../sim/racing/drivers';
import { computeRaceCar, tuneRedline } from '../sim/racing/racecar';
import { lapSim } from '../sim/racing/lapsim';
import { TRACK, trackGeom } from '../sim/racing/tracks';
import {
  closeMotorsport, driverTerms, establishMotorsport, facilityCost, promoteJunior, setAcademy, recruitStaff, redesignCost, redesignKinds, redesignRaceCar, releaseDriver, setDevBudget, setDevFocus, signDriver, staffCost, swapDriverOrder, upgradeFacility,
} from '../sim/actions';
import { fmtMoney, fmtTime, MONTHS } from '../sim/util';
import { BarList, Kpi, LineChart, Meter, Modal, PageHead, Seg, Select, Slider, Src, StatLine } from './common';
import { ImpactPreview } from './Impact';
import { CarViewer } from '../three/CarViewer';
import { RaceCar } from '../three/CarModel';
import { TrackMap } from '../three/TrackMap';

const DEV_KEYS: (keyof DevLevels)[] = ['aero', 'engine', 'chassis', 'reliability'];
const DEV_NAME: Record<keyof DevLevels, string> = { aero: 'Aerodynamics', engine: 'Power unit', chassis: 'Chassis & weight', reliability: 'Reliability' };

export function MotorsportView() {
  const { g, p } = useGame();
  const act = useStore((s) => s.act), ask = useStore((s) => s.ask);
  const [tab, setTab] = useState('overview');
  const [disc, setDisc] = useState<Discipline>('gt');
  const [name, setName] = useState(`${p.name} Racing`);
  const div = p.motorsport;
  if (!div) {
    const d = disciplineAvailable(disc, g.year) ? disc : 'f1';
    const B = budgetRef(getRegs(d, g.year), g.year);
    return (
      <>
        <PageHead title="Motorsport">{p.name} has no racing programme. Founding one costs half a season's front-running budget up front and then runs at a loss covered by the parent company — in exchange for prestige, a sporting image, brand awareness and a monthly technology transfer into road-car research.</PageHead>
        <div className="panel col">
          <h3>Establish a motorsport division</h3>
          <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>{DISCIPLINES.map((x) => <button key={x.id} className={'card' + (d === x.id ? ' on' : '')} disabled={!disciplineAvailable(x.id, g.year)} onClick={() => setDisc(x.id)}><b>{x.name}</b><span className="small muted" style={{ whiteSpace: 'normal' }}>{disciplineAvailable(x.id, g.year) ? x.blurb : `Begins in ${x.from}`}</span><span className="small">{disciplineAvailable(x.id, g.year) ? `≈ ${fmtMoney(budgetRef(getRegs(x.id, g.year), g.year))} / season` : ''}</span></button>)}</div>
          <p className="dim"><Src k="h" /> {getRegs(d, g.year).note}</p>
          <div className="row wrap"><input type="text" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} aria-label="Team name" style={{ minWidth: 260 }} />
            <button className="btn primary" onClick={() => act((gg) => establishMotorsport(gg, d, name), 'Motorsport division founded.')}>Found the team ({fmtMoney(B * 0.5)})</button></div>
        </div>
      </>
    );
  }
  const race = pendingRound(g, p);
  return (
    <>
      <PageHead title={div.teamName} right={<Seg value={tab} options={[{ value: 'overview', label: 'Overview' }, { value: 'car', label: 'Car design' }, { value: 'team', label: 'Drivers & staff' }, { value: 'season', label: 'Season' }]} onChange={setTab} />}>
        {div.championship.name} (unofficial) · {teamRegs(playerTeam(div), div.championship.year).className} · {div.championship.year} season{race ? <> · <b className="accent">Race weekend pending: {race.name}</b></> : null}
      </PageHead>
      {tab === 'overview' && <Overview p={p} div={div} />}
      {tab === 'car' && <CarDesign p={p} div={div} />}
      {tab === 'team' && <Team p={p} div={div} />}
      {tab === 'season' && <Season div={div} />}
      {g.mode !== 'motorsport' && tab === 'overview' && <div className="row end"><button className="btn sm danger" onClick={() => ask('Close the racing programme?', () => { act((gg) => closeMotorsport(gg)); })}>Withdraw from racing</button></div>}
    </>
  );
}

function Overview({ p, div }: { p: Company; div: MotorsportDivision }) {
  const { g } = useGame();
  const act = useStore((s) => s.act), go = useStore((s) => s.go);
  const ch = div.championship, team = playerTeam(div), regs = teamRegs(team, ch.year);
  const B = budgetRef(regs, g.year);
  const st = standings(ch);
  const pos = st.teams.findIndex((t) => t.id === team.id) + 1;
  const next = ch.rounds[ch.nextRound];
  const race = pendingRound(g, p);
  const sponsors = div.sponsors.reduce((a, s) => a + s.annual, 0);
  return (
    <>
      <div className="panel grid g4">
        <Kpi label="Teams' championship" value={`P${pos} of ${st.teams.length}`} detail={`${ch.teamPoints[team.id] ?? 0} points`} />
        <Kpi label="Next race" value={next ? next.name : 'Season complete'} detail={next ? `${MONTHS[next.month - 1]} · ${TRACK[next.trackId].name}` : 'New season starts in January'} />
        <Kpi label="Season income" value={fmtMoney(div.seasonIncome)} detail={`sponsors ${fmtMoney(sponsors)} / yr${div.ownerGrant ? ` · owner ${fmtMoney(div.ownerGrant)} / yr` : ''}`} />
        <Kpi label="Season cost" value={fmtMoney(div.seasonCost)} detail={g.mode === 'motorsport' ? 'paid from team cash' : 'charged to the parent company'} />
      </div>
      <SeasonBudgetPanel p={p} div={div} />
      {race && <div className="panel row between wrap"><div><h3>{race.name}</h3><span className="dim">{TRACK[race.trackId].name}, {TRACK[race.trackId].country} · {race.hours ? `${race.hours} hours` : `${race.laps} laps`}</span></div><button className="btn primary lg" onClick={() => go('race')}>Go to the race weekend →</button></div>}
      <div className="grid g2">
        <div className="panel col">
          <h3>Car development</h3>
          {DEV_KEYS.map((k) => <div key={k} className="col" style={{ gap: 3 }}><div className="row between small"><span>{DEV_NAME[k]}{regs.devScope[k] < 0.5 ? <span className="muted"> · restricted by the rules ({Math.round(regs.devScope[k] * 100)}% effect)</span> : null}</span><span className="num">{Math.round(team.dev[k] * 100)}%</span></div><Meter value={team.dev[k] * 100} color="var(--accent)" />
            <input type="range" min={0} max={3} step={0.25} value={div.devFocus[k]} aria-label={`${DEV_NAME[k]} focus`} onChange={(e) => act((gg) => setDevFocus(gg, { ...div.devFocus, [k]: Number(e.target.value) }))} /></div>)}
          <Slider label="Development budget per month" value={div.devBudget} min={0} max={Math.max((B * 0.6) / 12, div.devBudget)} step={B / 1200} onChange={(v) => act((gg) => setDevBudget(gg, v))} fmt={(v) => `${fmtMoney(v)} (${fmtMoney(v * 12)} / yr)`} />
          <p className="tiny muted">The sliders under each bar set where the effort goes. Returns diminish as an area approaches 100%; levels are partly carried into the next season and largely reset when the regulations change.</p>
        </div>
        <div className="col">
          <div className="panel col"><h3>Objective</h3>
            {div.objective ? <StatLine label={div.objective.text} value={div.objective.done ? <span className="good">achieved</span> : `by end of ${div.objective.byYear}`} /> : <p className="muted">None.</p>}
            {p.board && <><div className="row between small"><span>{g.mode === 'motorsport' ? 'Owner confidence' : 'Board confidence'}</span><b>{Math.round(p.board.confidence)}%</b></div><Meter value={p.board.confidence} /></>}
          </div>
          <div className="panel col"><h3>Sponsors <span className="muted small">(fictional companies)</span></h3>
            {div.sponsors.length ? <BarList items={div.sponsors.map((s) => ({ label: s.name, value: s.annual }))} fmt={(v) => fmtMoney(v)} total /> : <p className="muted">No sponsors yet. Results attract them.</p>}
          </div>
          {div.history.length > 0 && <div className="panel col"><h3>Honours</h3>
            <table><thead><tr><th>Year</th><th>Your team</th><th>Champion team</th><th>Champion driver</th></tr></thead><tbody>{[...div.history].reverse().map((h) => <tr key={h.year}><td>{h.year}</td><td>P{h.playerTeamPos} · {h.playerPoints} pts</td><td>{h.teamChampion}</td><td>{h.driverChampion}</td></tr>)}</tbody></table>
          </div>}
        </div>
      </div>
    </>
  );
}

function SeasonBudgetPanel({ p, div }: { p: Company; div: MotorsportDivision }) {
  const { g } = useGame();
  const b = seasonBudget(g, p, div);
  const net = p.cash - p.debt;
  return (
    <div className="panel col" style={{ gap: 4 }}>
      <h3>Season budget <span className="muted small">(forecast at today's plan and position — an estimate, not a promise)</span></h3>
      <div className="grid g2" style={{ gap: 12 }}>
        <BarList items={[{ label: 'People', value: b.personnel }, { label: 'Facilities upkeep', value: b.facilities }, { label: 'Car build & parts', value: b.carBuild }, { label: 'Travel & logistics', value: b.travel }, { label: 'Drivers', value: b.drivers }, { label: 'Development', value: b.development }]} fmt={(v) => fmtMoney(v)} total />
        <div className="col" style={{ gap: 4 }}>
          <StatLine label="Sponsors" value={fmtMoney(b.sponsors)} /><StatLine label={g.mode === 'motorsport' ? 'Owner funding' : 'Parent company'} value={g.mode === 'motorsport' ? fmtMoney(b.owner) : 'covers the balance'} />
          <StatLine label={`Prize money at P${b.prizePos}`} value={fmtMoney(b.prize)} />
          <StatLine label="Expected balance this season" value={<span className={b.balance < 0 ? 'bad' : 'good'}>{fmtMoney(b.balance)}</span>} />
          <StatLine label="Development you could afford at break-even" value={`${fmtMoney(Math.max(0, b.development + b.balance) / 12)} / month`} title="Development budget at which the season's expected balance is zero." />
          {g.mode === 'motorsport' && b.owner > 0 && net > RESERVE_ALLOWED * b.cost && <p className="tiny warn">Reserves above {fmtMoney(RESERVE_ALLOWED * b.cost)} lead the owners to cut next season's funding by 60% of the excess.</p>}
          {g.mode === 'motorsport' && net < 0 && <p className="tiny warn">The team is {fmtMoney(-net)} in debt. Owners cover part of a deficit only while their confidence holds.</p>}
        </div>
      </div>
    </div>
  );
}

const RACE_LAYOUTS: EngineLayout[] = ['I4', 'I6', 'V6', 'V8', 'V10', 'V12', 'F6', 'F12'];
function CarDesign({ p, div }: { p: Company; div: MotorsportDivision }) {
  const { g } = useGame();
  const act = useStore((s) => s.act);
  const ch = div.championship, team = playerTeam(div), regs = teamRegs(team, ch.year);
  const [spec, setSpec] = useState<RaceCarSpec>(() => JSON.parse(JSON.stringify(team.car)));
  const { techYear, quality } = divisionTech(p, div, ch.year);
  const e = spec.engine;
  const upE = (patch: Partial<RaceCarSpec['engine']>) => setSpec((s) => ({ ...s, engine: { ...s.engine, ...patch } }));
  const up = (patch: Partial<RaceCarSpec>) => setSpec((s) => ({ ...s, ...patch }));
  const perf = useMemo(() => computeRaceCar(spec, team.dev, regs, techYear, 0.5, quality), [spec, team.dev, regs, techYear, quality]);
  const cur = useMemo(() => computeRaceCar(team.car, team.dev, regs, techYear, 0.5, quality), [team.car, team.dev, regs, techYear, quality]);
  const tracks = ['parco', 'riviera', ch.discipline === 'hypercar' ? 'ouest' : 'silverdale'];
  const laps = useMemo(() => tracks.map((id) => { const geo = trackGeom(id); const f = (x: typeof perf) => lapSim(geo, { mass: x.mass + 30, powerW: x.powerKw * 900, cdA: x.cdA, clA: x.clA, mu: x.mu, awd: x.awd }); return { id, a: f(perf), b: f(cur) }; }), [perf, cur]);
  const forced = e.aspiration !== 'na';
  const limit = forced ? regs.maxDispForced : regs.maxDispNA;
  const changed = JSON.stringify(spec) !== JSON.stringify(team.car);
  const curve = perf.engine.curve;
  return (
    <div className="designer">
      <div className="panel col">
        <h4>Power unit <Src k="h" /> <span className="muted">limits</span></h4>
        <p className="small dim">{regs.note}</p>
        <Select label="Architecture" value={e.layout} options={RACE_LAYOUTS.map((l) => ({ value: l, label: LAYOUT_NAME[l], disabled: (regs.cylinders ? !regs.cylinders.includes(CYL[l]) : false) || (regs.layouts ? !regs.layouts.includes(l) : false) }))} onChange={(v) => upE({ layout: v })} />
        <Select label="Aspiration" value={e.aspiration} options={[{ value: 'na', label: 'Naturally aspirated', disabled: regs.maxDispNA <= 0 }, { value: 'turbo', label: 'Turbocharged', disabled: regs.maxDispForced <= 0 }, { value: 'twinturbo', label: 'Twin-turbo', disabled: regs.maxDispForced <= 0 }, { value: 'supercharged', label: 'Supercharged', disabled: regs.maxDispForced <= 0 }]} onChange={(v) => upE({ aspiration: v })} />
        <Slider label={`Displacement (limit ${limit || '—'} cc)`} value={e.displacement} min={600} max={Math.max(limit || 3000, 1000)} step={1} onChange={(v) => upE({ displacement: v })} fmt={(v) => `${v} cc`} />
        {forced && <Slider label={`Boost (limit ${regs.maxBoost.toFixed(1)} bar)`} value={e.boost} min={0.2} max={Math.max(regs.maxBoost, 0.3)} step={0.05} onChange={(v) => upE({ boost: v })} fmt={(v) => `${v.toFixed(2)} bar`} />}
        <Slider label="Compression ratio" value={e.compression} min={6} max={15} step={0.1} onChange={(v) => upE({ compression: v })} fmt={(v) => `${v.toFixed(1)} : 1 · knock margin ${perf.engine.knockMargin.toFixed(1)}`} />
        <Slider label="Bore / stroke ratio" value={e.boreStroke} min={0.8} max={2.6} step={0.01} onChange={(v) => upE({ boreStroke: v })} fmt={(v) => `${v.toFixed(2)} · ${(perf.engine.bore * 1000).toFixed(0)} × ${(perf.engine.stroke * 1000).toFixed(0)} mm`} />
        <Slider label="Rev limit" value={e.redline} min={5000} max={20000} step={250} onChange={(v) => upE({ redline: v })} fmt={(v) => `${v} rpm · piston ${perf.engine.pistonSpeed.toFixed(1)}/${perf.engine.pistonSpeedLimit.toFixed(1)} m/s · valves to ${Math.round(perf.engine.valveLimitRpm / 100) * 100}`} />
        <button className="btn sm" onClick={() => upE({ redline: tuneRedline(e, regs, techYear, quality) })}>Find the best safe rev limit</button>
        <Select label="Valvetrain" value={e.valvetrain} options={[{ value: 'ohv', label: 'Pushrod' }, { value: 'sohc', label: 'Single cam' }, { value: 'dohc2', label: 'Twin cam, 2 valves' }, { value: 'dohc4', label: 'Twin cam, 4 valves' }]} onChange={(v) => upE({ valvetrain: v })} />
        <h4 style={{ marginTop: 6 }}>Chassis philosophy</h4>
        <Slider label="Aero concept" value={spec.aeroBias} min={0} max={1} step={0.01} onChange={(v) => up({ aeroBias: v })} fmt={(v) => (v < 0.35 ? 'Low drag' : v < 0.65 ? 'Balanced' : 'High downforce')} hint="Fixed for the season; wing angle is then trimmed race by race." />
        <Slider label="Weight-saving effort" value={spec.weightEffort} min={0} max={1} step={0.01} onChange={(v) => up({ weightEffort: v })} fmt={(v) => `${Math.round(v * 100)}% · car ${Math.round(perf.mass - 75)} kg (min ${Math.round(regs.minWeight)})`} hint="Exotic materials get the car down to the minimum weight; costly and slightly fragile." />
        <Slider label="Cooling margin" value={spec.cooling} min={0} max={1} step={0.01} onChange={(v) => up({ cooling: v })} fmt={(v) => (v < 0.35 ? 'Tight bodywork (fast, fragile)' : v < 0.65 ? 'Normal' : 'Generous (reliable, draggy)')} />
        <Slider label="Suspension stiffness" value={spec.stiffness} min={0} max={1} step={0.01} onChange={(v) => up({ stiffness: v })} fmt={(v) => (v < 0.35 ? 'Soft: mechanical grip, kind to tyres' : v < 0.65 ? 'Medium' : 'Stiff: stable aero platform, hard on tyres')} />
        <div className="row"><label className="field"><span className="lab"><span>Main colour</span></span><input type="color" value={spec.color} onChange={(x) => up({ color: x.target.value })} /></label><label className="field"><span className="lab"><span>Second colour</span></span><input type="color" value={spec.color2} onChange={(x) => up({ color2: x.target.value })} /></label></div>
      </div>
      <div className="col">
        <div className="viewer"><CarViewer><RaceCar discipline={div.discipline} year={ch.year} color={spec.color} color2={spec.color2} wing={spec.aeroBias} /></CarViewer><div className="overlay">{regs.className} · body style follows the era's regulations · original livery</div><div className="hint">drag to rotate · scroll to zoom</div></div>
        <div className="panel"><div className="grid g2">
          <div><h4>Torque (Nm)</h4><LineChart height={170} width={330} series={[{ name: 'Torque', color: '#3987e5', values: curve.map((c) => c.nm) }]} labels={curve.map((c) => String(c.rpm))} xTitle="rpm" /></div>
          <div><h4>Power (kW)</h4><LineChart height={170} width={330} series={[{ name: 'Power', color: '#d95926', values: curve.map((c) => c.kw) }]} labels={curve.map((c) => String(c.rpm))} xTitle="rpm" /></div>
        </div></div>
        {perf.legal.length > 0 && <div className="errbox">{perf.legal.map((x) => <div key={x}>✗ {x}</div>)}</div>}
        {perf.engine.warnings.length > 0 && <div className="warnbox">{perf.engine.warnings.map((x) => <div key={x}>• {x}</div>)}</div>}
      </div>
      <div className="col stats">
        <div className="panel col" style={{ gap: 4 }}>
          <h4>Predicted performance</h4>
          <StatLine label="Race power" value={<>{Math.round(perf.powerKw)} kW{perf.capped ? <span className="muted"> (capped by rules)</span> : null} <Delta a={perf.powerKw} b={cur.powerKw} unit="kW" /></>} />
          <StatLine label="Mass with driver" value={<>{Math.round(perf.mass)} kg <Delta a={perf.mass} b={cur.mass} unit="kg" inv /></>} />
          <StatLine label="Downforce area ClA" value={`${perf.clA.toFixed(2)} m²`} /><StatLine label="Drag area CdA" value={`${perf.cdA.toFixed(2)} m²`} />
          <StatLine label="Tyre grip µ" value={perf.mu.toFixed(2)} /><StatLine label="Tyre wear" value={`${Math.round(perf.tyreWear * 100)}% of normal`} />
          <StatLine label="Finish probability (mechanical)" value={<>{Math.round(perf.reliability * 100)}% <Delta a={perf.reliability * 100} b={cur.reliability * 100} unit="pts" /></>} />
          <StatLine label="Fuel per kWh at the wheels" value={`${(perf.fuelKgPerKwh * 1000).toFixed(0)} g`} />
        </div>
        <div className="panel col" style={{ gap: 4 }}>
          <h4>Simulated lap times (medium wing, low fuel)</h4>
          {laps.map((l) => <StatLine key={l.id} label={TRACK[l.id].name} value={<>{fmtTime(l.a.time)} <Delta a={l.a.time} b={l.b.time} unit="s" inv digits={2} /> <span className="muted">· {Math.round(l.a.vMax * 3.6)} km/h</span></>} />)}
          <p className="tiny muted">Differences are against your current car. Lap times come from the same point-mass lap simulation that drives the races.</p>
        </div>
        <div className="panel col">
          <h4>Commit the design</h4>
          {(() => {
            const kinds = redesignKinds(team.car, spec), cost = redesignCost(g, p, team.car, spec), b = seasonBudget(g, p, div);
            return <>
              <StatLine label="Cost of this change (est.)" value={<b>{fmtMoney(cost)}</b>} title="A smaller team builds fewer chassis and spares, so the same change costs it less." />
              <StatLine label="Share of this season's running budget" value={`${Math.round((cost / Math.max(1, b.cost)) * 100)}%`} />
              <p className="small dim">{kinds.engineNew ? 'New engine architecture: power-unit development is halved and reliability work partly restarts. ' : kinds.engineTune ? 'Engine tuning only: cheap, no development lost. ' : ''}{kinds.chassisNew ? 'New chassis philosophy: aerodynamic and chassis development fall by a fifth. ' : ''}{!kinds.engineNew && !kinds.chassisNew && !kinds.engineTune ? 'Tuning changes are cheap.' : ''}{cost > p.cash ? ' This exceeds the team’s cash: it will be borrowed.' : ''}</p>
            </>;
          })()}
          <div className="row"><button className="btn" disabled={!changed} onClick={() => setSpec(JSON.parse(JSON.stringify(team.car)))}>Revert</button>
            <button className="btn primary" disabled={!changed || perf.legal.length > 0} onClick={() => act((gg) => redesignRaceCar(gg, spec), 'Car design committed.')}>Build this car</button></div>
        </div>
      </div>
    </div>
  );
}
function Delta({ a, b, unit, inv, digits = 0 }: { a: number; b: number; unit: string; inv?: boolean; digits?: number }) {
  const d = a - b; if (Math.abs(d) < Math.pow(10, -digits) * 0.5) return null;
  const good = inv ? d < 0 : d > 0;
  return <span className={'small ' + (good ? 'good' : 'bad')}>({d > 0 ? '+' : ''}{d.toFixed(digits)} {unit})</span>;
}

function Team({ p, div }: { p: Company; div: MotorsportDivision }) {
  const { g } = useGame();
  const act = useStore((s) => s.act), ask = useStore((s) => s.ask);
  const ch = div.championship, team = playerTeam(div), regs = teamRegs(team, ch.year);
  const seats = regs.carsPerTeam * regs.driversPerCar;
  const mine = team.drivers.map((id) => ch.drivers.find((d) => d.id === id)!).filter(Boolean);
  const free = ch.drivers.filter((d) => !d.teamId).sort((a, b) => overall(b) - overall(a)).slice(0, 30);
  const FAC: [keyof MotorsportDivision['facilities'], string, string][] = [['windTunnel', 'Wind tunnel & CFD', 'Speeds up aerodynamic development'], ['simulator', 'Simulator', 'Chassis development'], ['workshop', 'Workshop', 'Chassis development and reliability'], ['engineShop', 'Engine shop & dynos', 'Power-unit development and build quality']];
  const STAFF: [keyof MotorsportDivision['staff'], string, string][] = [['technical', 'Technical director\'s office', 'Development rate and technology level'], ['aero', 'Aerodynamicists', 'Aero development rate'], ['raceOps', 'Pit crew & race operations', 'Faster, cleaner pit stops'], ['strategy', 'Strategists', 'Sharper automatic pit and tyre calls']];
  return (
    <>
      <div className="panel col">
        <div className="row between"><h3>Drivers</h3><span className="small muted">{mine.length} of {seats} seats filled · {regs.driversPerCar > 1 ? `${regs.driversPerCar} drivers share each car` : 'one driver per car'}</span></div>
        <table><thead><tr><th>Car</th><th>Driver</th><th className="r">Age</th><th className="r">Pace</th><th className="r">Consist.</th><th className="r">Racecraft</th><th className="r">Wet</th><th className="r">Tyres</th><th className="r">Salary</th><th>Contract</th><th>Category</th><th /></tr></thead><tbody>
          {mine.map((d, i) => <tr key={d.id}><td>#{Math.floor(i / regs.driversPerCar) + 1}</td><td><b>{d.name}</b> <span className="muted tiny">{d.nat}{d.wins ? ` · ${d.wins} wins` : ''}</span></td><td className="r">{d.age}</td><td className="r">{d.pace}</td><td className="r">{d.consistency}</td><td className="r">{d.racecraft}</td><td className="r">{d.wet}</td><td className="r">{d.tyre}</td><td className="r">{fmtMoney(d.salary)}</td><td className={d.contractEnd <= ch.year ? 'warn' : ''}>to end of {d.contractEnd}{d.backing ? <div className="tiny good">brings {fmtMoney(d.backing)} / yr</div> : null}</td>
            <td className="small">{specialtyOf(d, ch.discipline) === GROUP[ch.discipline] ? 'specialist' : <span className="warn">from {GROUP_NAME[specialtyOf(d, ch.discipline)]}{d.adapt ? ` · adapting (−${3 * d.adapt} pace)` : ''}</span>}{potentialOf(d) > d.pace + 1 ? <div className="tiny muted">potential rating ≈ {Math.round(potentialOverall(d))}</div> : null}</td>
            <td className="r" style={{ whiteSpace: 'nowrap' }}>{i > 0 && <button className="btn sm ghost" title="Move up" onClick={() => act((gg) => swapDriverOrder(gg, i, i - 1))}>↑</button>} <button className="btn sm" title="Renegotiates at today's asking salary" onClick={() => act((gg) => signDriver(gg, d.id, d.contractEnd - ch.year + 2), 'Contract extended by one year.')}>+1 year</button> <button className="btn sm danger" onClick={() => ask(`Release ${d.name}? Compensation: ${fmtMoney(d.salary * 0.3 * Math.max(1, d.contractEnd - ch.year + 1))}`, () => { act((gg) => releaseDriver(gg, d.id)); })}>Release</button></td></tr>)}
          {mine.length === 0 && <tr><td colSpan={12} className="muted">No drivers. Sign free agents below; empty seats are filled with a reserve before each race.</td></tr>}
        </tbody></table>
      </div>
      <DriverMarket p={p} div={div} />
      <div className="grid g2">
        <div className="col">
          <div className="panel col"><h3>Facilities</h3>
            {FAC.map(([k, label, hint]) => <div key={k} className="row between"><div><b>{label}</b> <span className="muted small">· level {div.facilities[k]}/5</span><div className="tiny muted">{hint}</div></div><button className="btn sm" disabled={div.facilities[k] >= 5} onClick={() => act((gg) => upgradeFacility(gg, k), 'Facility upgraded.')}>{div.facilities[k] >= 5 ? 'Maximum' : `Upgrade (${fmtMoney(facilityCost(g, p, div.facilities[k]))})`}</button></div>)}
          </div>
          <div className="panel col"><h3>Technical personnel</h3>
            {STAFF.map(([k, label, hint]) => <div key={k} className="row between"><div><b>{label}</b> <span className="muted small">· skill {div.staff[k]}/100</span><div className="tiny muted">{hint}</div></div><button className="btn sm" disabled={div.staff[k] >= 97} onClick={() => act((gg) => recruitStaff(gg, k), 'Key people recruited.')}>Recruit +5 ({fmtMoney(staffCost(g, p, div.staff[k]))})</button></div>)}
            <p className="tiny muted">Better people and facilities also cost more to run every month.</p>
          </div>
        </div>
      </div>
    </>
  );
}

/** Free agents and rivals' drivers with their terms, negotiation, and the junior academy. */
function DriverMarket({ p, div }: { p: Company; div: MotorsportDivision }) {
  const { g } = useGame();
  const act = useStore((s) => s.act);
  const ch = div.championship, team = playerTeam(div), regs = teamRegs(team, ch.year);
  const B = budgetRef(regs, g.year);
  const seats = regs.carsPerTeam * regs.driversPerCar;
  const [view, setView] = useState<'free' | 'contracted'>('free');
  const [deal, setDeal] = useState<string | null>(null);
  const list = ch.drivers.filter((d) => (view === 'free' ? !d.teamId : d.teamId && d.teamId !== team.id)).sort((a, b) => overall(b) - overall(a)).slice(0, 40);
  const teamName = (id: string | null) => ch.teams.find((t) => t.id === id)?.name ?? '—';
  const a = div.academy;
  return (
    <div className="grid g2">
      <div className="panel col">
        <div className="row between wrap"><h3>Driver market <span className="muted small">(fictional drivers)</span></h3>
          <Seg value={view} options={[{ value: 'free', label: 'Free agents' }, { value: 'contracted', label: 'Other teams (buy-out)' }]} onChange={setView} /></div>
        <p className="tiny muted">Asks depend on the driver, on how attractive your team is and on how many stronger teams want them. Drivers from other categories need up to two seasons to adapt and are cheaper meanwhile; they come onto the market in summer, and the AI teams sign the best free agents in January.</p>
        <div className="tablewrap" style={{ maxHeight: 380 }}><table><thead><tr><th>Driver</th>{view === 'contracted' && <th>Team</th>}<th className="r">Age</th><th className="r">Rating</th><th className="r">Potential</th><th>Category</th><th className="r">Ask / yr</th><th className="r">{view === 'contracted' ? 'Transfer fee' : 'Brings'}</th><th className="r">Interest</th><th /></tr></thead><tbody>
          {list.map((d) => { const t = driverTerms(g, d.id)!; return (
            <tr key={d.id}><td>{d.name} <span className="muted tiny">{d.nat}</span></td>{view === 'contracted' && <td className="small">{teamName(d.teamId)}</td>}<td className="r">{d.age}</td>
              <td className="r">{Math.round(overall(d))}{d.adapt ? <span className="tiny warn"> ({Math.round(effectiveOverall(d, ch.discipline))} now)</span> : null}</td><td className="r">{Math.round(potentialOverall(d))}</td>
              <td className="small">{specialtyOf(d, ch.discipline) === GROUP[ch.discipline] ? '—' : GROUP_NAME[specialtyOf(d, ch.discipline)]}</td>
              <td className="r">{fmtMoney(t.ask)}</td><td className="r">{view === 'contracted' ? fmtMoney(t.fee) : t.backing ? <span className="good">{fmtMoney(t.backing)}</span> : '—'}</td>
              <td className="r">{t.rivals ? <span className="warn">{t.rivals} team{t.rivals > 1 ? 's' : ''}</span> : '—'}</td>
              <td className="r"><button className="btn sm" onClick={() => setDeal(d.id)}>Negotiate</button></td></tr>); })}
        </tbody></table></div>
        {deal && <NegotiationModal driverId={deal} seats={seats} onClose={() => setDeal(null)} />}
      </div>
      <div className="panel col"><h3>Junior academy</h3>
        <Select label="Level" value={a?.level ?? 0} onChange={(v) => act((gg) => setAcademy(gg, v))} options={[0, 1, 2, 3].map((l) => ({ value: l, label: l ? `Level ${l}: ${l} junior${l > 1 ? 's' : ''} a year · ${fmtMoney(B * ACADEMY_COST[l])} / yr${l > (a?.level ?? 0) ? ` · set-up ${fmtMoney(B * 0.03 * (l - (a?.level ?? 0)))}` : ''}` : 'None' }))} />
        <p className="tiny muted">Juniors join at 15–17 and develop toward their potential, faster at a higher level. From 17 they can be promoted on a three-year rookie contract at a fraction of a free agent's salary; at 22 they leave for a seat elsewhere.</p>
        {a && a.juniors.length > 0 ? <table><thead><tr><th>Junior</th><th className="r">Age</th><th className="r">Pace</th><th className="r">Potential pace</th><th /></tr></thead><tbody>
          {a.juniors.map((j) => <tr key={j.id}><td>{j.name}</td><td className="r">{j.age}</td><td className="r">{j.pace}</td><td className="r">{Math.round(potentialOf(j))}</td>
            <td className="r"><button className="btn sm" disabled={j.age < 17 || team.drivers.length >= seats} title={j.age < 17 ? 'Too young to race' : team.drivers.length >= seats ? 'Release a driver first' : ''} onClick={() => act((gg) => promoteJunior(gg, j.id), `${j.name} promoted.`)}>Promote</button></td></tr>)}
        </tbody></table> : <p className="small muted">{a?.level ? 'The first juniors arrive in January.' : 'No academy.'}</p>}
      </div>
    </div>
  );
  void p;
}

function NegotiationModal({ driverId, seats, onClose }: { driverId: string; seats: number; onClose: () => void }) {
  const { g, p } = useGame();
  const act = useStore((s) => s.act);
  const div = p.motorsport!; const ch = div.championship, team = playerTeam(div);
  const d = ch.drivers.find((x) => x.id === driverId)!;
  const t = driverTerms(g, driverId)!;
  const [offer, setOffer] = useState(Math.round(t.ask));
  const [years, setYears] = useState(2);
  const full = team.drivers.length >= seats;
  const [replace, setReplace] = useState(full ? team.drivers[team.drivers.length - 1] : '');
  const run = (gg: GameState) => signDriver(gg, d.id, years, full ? replace : undefined, offer);
  return (
    <Modal onClose={onClose}>
      <h2>Negotiate with {d.name}</h2>
      <StatLine label="Rating (now / adapted)" value={`${Math.round(effectiveOverall(d, ch.discipline))} / ${Math.round(overall(d))} · potential ${Math.round(potentialOverall(d))} · age ${d.age}`} />
      <StatLine label="Asking salary" value={<b>{fmtMoney(t.ask)} a year</b>} title={`Your team's attractiveness ${Math.round(t.attractiveness * 100)}%; ${t.rivals} stronger team(s) interested.`} />
      {t.fee > 0 && <StatLine label="Transfer fee to the current team" value={fmtMoney(t.fee)} />}
      {t.backing > 0 && <StatLine label="Sponsorship the driver brings" value={<span className="good">{fmtMoney(t.backing)} a year</span>} />}
      <Slider label="Your offer" value={offer} min={Math.round(t.ask * 0.6)} max={Math.round(t.ask * 1.6)} step={Math.max(1000, Math.round(t.ask / 100))} onChange={setOffer} fmt={(v) => `${fmtMoney(v)} a year${v < t.ask - 1 ? ' — below the ask: refused' : ''}`} />
      <Slider label="Contract" value={years} min={1} max={4} onChange={setYears} fmt={(v) => `${v} year${v > 1 ? 's' : ''} (salary fixed for the term)`} />
      {full && <Select label="Replacing" value={replace} onChange={setReplace} options={team.drivers.map((id) => { const x = ch.drivers.find((y) => y.id === id)!; return { value: id, label: `${x.name} (release compensation ${fmtMoney(x.salary * 0.3 * Math.max(1, x.contractEnd - ch.year + 1))})` }; })} />}
      <ImpactPreview deps={[d.id, offer, years, replace]} horizon={12} run={run} />
      <div className="row end"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={offer < t.ask - 1} onClick={() => { if (act(run, `${d.name} signed.`)) onClose(); }}>Sign</button></div>
    </Modal>
  );
}

function Season({ div }: { div: MotorsportDivision }) {
  const ch = div.championship;
  const st = standings(ch);
  const [sel, setSel] = useState(Math.min(ch.nextRound, ch.rounds.length - 1));
  const round = ch.rounds[sel];
  const res = ch.results.find((r) => r.round === sel);
  const regs = getRegs(ch.discipline, ch.year);
  const track = TRACK[round.trackId];
  return (
    <>
      <div className="grid g2">
        <div className="panel col"><h3>{ch.year} calendar</h3>
          <table><thead><tr><th>#</th><th>Event</th><th>Circuit</th><th>Month</th><th>Distance</th><th>Winner</th></tr></thead><tbody>
            {ch.rounds.map((r, i) => { const rr = ch.results.find((x) => x.round === i); const w = rr?.results[0]; return (
              <tr key={i} className={'click' + (i === sel ? ' me' : '')} onClick={() => setSel(i)}><td>{i + 1}</td><td>{r.name}</td><td className="dim">{TRACK[r.trackId].name}</td><td>{MONTHS[r.month - 1]}</td><td>{r.hours ? `${r.hours} h` : `${r.laps} laps`}</td><td className="dim">{w ? ch.teams.find((t) => t.id === w.teamId)?.name ?? '—' : r.done ? 'not contested' : i === ch.nextRound ? 'next' : ''}</td></tr>); })}
          </tbody></table>
          <p className="tiny muted">Circuits are original fictional layouts. Points: {regs.points.join('–')}{regs.flPoint ? ' +1 for fastest lap' : ''} <Src k="h" />.</p>
        </div>
        <div className="panel col"><div className="row between"><h3>{track.name}</h3><span className="muted small">{track.country} · {track.km.toFixed(2)} km · {track.kind}</span></div>
          <TrackMap trackId={round.trackId} height={220} zones />
          <div className="row wrap small dim" style={{ gap: 14 }}><span>Overtaking: {track.overtake > 1.1 ? 'easy' : track.overtake > 0.8 ? 'average' : 'very difficult'}</span><span>Tyre wear: {track.abrasion > 1.1 ? 'high' : track.abrasion > 0.9 ? 'medium' : 'low'}</span><span>Rain risk: {Math.round(track.rain * 100)}%</span><span className="good">— overtaking zones</span></div>
        </div>
      </div>
      {res && <div className="panel col"><h3>{res.name} — classification <span className="muted small">· {res.weather}</span></h3>
        <div className="tablewrap"><table><thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th className="r">Grid</th><th className="r">Laps</th><th className="r">Stops</th><th className="r">Best lap</th><th>Status</th><th className="r">Pts</th></tr></thead><tbody>
          {res.results.map((r) => { const d = ch.drivers.find((x) => x.id === r.driverId); const t = ch.teams.find((x) => x.id === r.teamId); return <tr key={r.teamId + r.carIdx} className={r.teamId === div.teamId ? 'me' : ''}><td>{r.pos}</td><td>{d?.name ?? '—'}</td><td className="dim">{t?.name ?? '(withdrawn)'}</td><td className="r">{r.grid}</td><td className="r">{r.laps}</td><td className="r">{r.stops}</td><td className="r">{r.bestLap ? fmtTime(r.bestLap) : '—'}</td><td className={r.status === 'dnf' ? 'bad' : 'dim'}>{r.status === 'dnf' ? `DNF — ${r.reason}` : 'Finished'}</td><td className="r">{r.points || ''}</td></tr>; })}
        </tbody></table></div></div>}
      <div className="grid g2">
        <div className="panel col"><h3>Teams' championship</h3><table><thead><tr><th>Pos</th><th>Team</th><th className="r">Points</th></tr></thead><tbody>{st.teams.map((t, i) => <tr key={t.id} className={t.id === div.teamId ? 'me' : ''}><td>{i + 1}</td><td><span className="row" style={{ gap: 6 }}><i className="swatch" style={{ background: t.color }} />{t.name}{t.ruleset !== ch.discipline ? <span className="muted tiny"> {DISC_NAME[t.ruleset].split(' ')[0]}</span> : null}</span></td><td className="r">{ch.teamPoints[t.id] ?? 0}</td></tr>)}</tbody></table></div>
        <div className="panel col"><h3>Drivers' championship</h3><div className="tablewrap" style={{ maxHeight: 420 }}><table><thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th className="r">Points</th></tr></thead><tbody>{st.drivers.slice(0, 30).map((d, i) => <tr key={d.id} className={d.teamId === div.teamId ? 'me' : ''}><td>{i + 1}</td><td>{d.name}</td><td className="dim">{ch.teams.find((t) => t.id === d.teamId)?.name}</td><td className="r">{ch.driverPoints[d.id] ?? 0}</td></tr>)}</tbody></table></div></div>
      </div>
    </>
  );
}
