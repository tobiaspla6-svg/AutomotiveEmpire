import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame, useStore } from '../store/game';
import { applyRaceResult, buildRaceConfig, pendingRound, playerTeam, raceWeather, teamRegs, wingTable } from '../sim/racing/season';
import { RaceSim, wetPenalty, type CarState, type Mode } from '../sim/racing/race';
import { TRACK } from '../sim/racing/tracks';
import { fmtClock, fmtTime } from '../sim/util';
import { Seg, Select, Slider, StatLine } from './common';
import { RaceScene } from '../three/RaceScene';
import { TrackMap } from '../three/TrackMap';

const TYRE_COLOR: Record<string, string> = { soft: '#e66767', medium: '#e8b04a', hard: '#e6e6e6', inter: '#3fb984', wet: '#3987e5' };
const SPEEDS = [{ value: 0, label: '❚❚' }, { value: 1, label: '1×' }, { value: 4, label: '4×' }, { value: 16, label: '16×' }, { value: 64, label: '64×' }, { value: 400, label: 'Max' }];

export function RaceScreen() {
  const { g, p } = useGame();
  const go = useStore((s) => s.go), act = useStore((s) => s.act), save = useStore((s) => s.save);
  const div = p.motorsport;
  const round = div ? pendingRound(g, p) : null;
  const [phase, setPhase] = useState<'pre' | 'live' | 'done'>('pre');
  const [sim, setSim] = useState<RaceSim | null>(null);
  const [, setHud] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [cam, setCam] = useState('orbit');
  const [selIdx, setSelIdx] = useState(0);
  const speedRef = useRef(0), alpha = useRef(0), selected = useRef(0), camMode = useRef('orbit'), acc = useRef(0), applied = useRef(false);
  speedRef.current = speed; selected.current = selIdx; camMode.current = cam;

  const team = div ? playerTeam(div) : null;
  const regs = team && div ? teamRegs(team, div.championship.year) : null;
  const nCars = regs?.carsPerTeam ?? 2;
  const table = useMemo(() => (div && round ? wingTable(p, div, round.trackId) : []), [div, round?.trackId]);
  const bestWing = table.length ? table.reduce((a, b) => (b.time < a.time ? b : a)).wing : 0.5;
  const [wing, setWing] = useState<number[]>([]);
  const [startComp, setStartComp] = useState<string[]>([]);
  const [auto, setAuto] = useState<boolean[]>([]);
  const w = (i: number) => wing[i] ?? bestWing;

  // fixed-step simulation clock, decoupled from rendering
  useEffect(() => {
    if (phase !== 'live' || !sim) return;
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const real = Math.min(0.1, (now - last) / 1000); last = now;
      const sp = speedRef.current;
      if (sp > 0 && !sim.finished) {
        acc.current += real * sp;
        const t0 = performance.now();
        while (acc.current >= sim.dt && !sim.finished && performance.now() - t0 < 14) { sim.step(); acc.current -= sim.dt; }
        if (acc.current > sim.dt * 4) acc.current = 0; // cannot keep up at "Max": drop the backlog
        alpha.current = Math.min(1, acc.current / sim.dt);
      }
      if (sim.finished) { setPhase('done'); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const iv = setInterval(() => setHud((x) => x + 1), 250);
    return () => { cancelAnimationFrame(raf); clearInterval(iv); };
  }, [phase, sim]);

  // record the result exactly once
  useEffect(() => {
    if (phase === 'done' && sim && div && !applied.current) { applied.current = true; act((gg) => { applyRaceResult(gg, gg.companies.find((c) => c.id === gg.playerId)!, gg.companies.find((c) => c.id === gg.playerId)!.motorsport!, sim); }); void save('autosave'); }
  }, [phase, sim]);

  if (!div || !team || !regs) return <div className="main"><p>No racing programme.</p><button className="btn" onClick={() => go('game')}>Back</button></div>;
  if (!round && phase === 'pre') return <div className="main"><h2>No race is scheduled this month.</h2><button className="btn" onClick={() => go('game')}>Back to headquarters</button></div>;

  const begin = (instant: boolean) => {
    const cfg = buildRaceConfig(g, p, div, { wing: Array.from({ length: nCars }, (_, i) => w(i)), startCompound: Array.from({ length: nCars }, (_, i) => startComp[i] || undefined), auto: Array.from({ length: nCars }, (_, i) => auto[i] ?? true) });
    const s = new RaceSim(cfg);
    setSim(s);
    const mine = s.cars.find((c) => c.e.isPlayer);
    setSelIdx(mine ? mine.idx : 0);
    if (instant) { s.runToEnd(); setPhase('done'); } else { setSpeed(0); setPhase('live'); }
  };

  // ---------------------------------------------------------------- briefing
  if (phase === 'pre' && round) {
    const track = TRACK[round.trackId];
    const forecast = raceWeather(g, div).forecast; // read-only: building the full race config would sign reserve drivers and post news
    const dry = regs.tyres.filter((t) => t.wetType === 0);
    return (
      <div className="main" style={{ height: '100%' }}>
        <div className="pagehead"><div><h4>{div.championship.name} · round {div.championship.nextRound + 1} of {div.championship.rounds.length}</h4><h1>{round.name}</h1><p className="dim">{track.name}, {track.country} · {track.km.toFixed(2)} km · {round.hours ? `${round.hours} hours` : `${round.laps} laps (${(round.laps * track.km).toFixed(0)} km)`} · {regs.className}</p></div>
          <div className="row"><button className="btn" onClick={() => go('game')}>← Headquarters</button><button className="btn" onClick={() => begin(true)}>Simulate instantly</button><button className="btn primary lg" onClick={() => begin(false)}>Qualify and go to the grid →</button></div></div>
        <div className="grid g2">
          <div className="panel col"><h3>Circuit</h3><TrackMap trackId={round.trackId} height={260} zones />
            <div className="row wrap small dim" style={{ gap: 14 }}><span>{track.kind}</span><span>Overtaking: {track.overtake > 1.1 ? 'easy' : track.overtake > 0.8 ? 'average' : 'very difficult'}</span><span>Tyre wear: {track.abrasion > 1.1 ? 'high' : track.abrasion > 0.9 ? 'medium' : 'low'}</span><span>Pit-lane time loss: {track.pitLoss} s</span><span className="good">— overtaking zones</span></div>
            <h3 style={{ marginTop: 6 }}>Weather forecast</h3><p>{forecast}</p>
            <p className="small muted">Slicks stop working at about 20% track wetness, where intermediates take over; full wets are fastest above about 55%.</p>
          </div>
          <div className="col">
            <div className="panel col"><h3>Wing level — simulated qualifying lap</h3>
              <table><thead><tr><th>Wing</th><th className="r">Lap time</th><th className="r">Top speed</th><th /></tr></thead><tbody>{table.map((r) => <tr key={r.wing} className={r.wing === bestWing ? 'me' : ''}><td>{['Monza-spec (minimum)', 'Low', 'Medium', 'High', 'Maximum'][Math.round(r.wing * 4)]}</td><td className="r">{fmtTime(r.time)}</td><td className="r">{Math.round(r.vMax)} km/h</td><td className="small muted">{r.wing === bestWing ? 'fastest over one lap' : ''}</td></tr>)}</tbody></table>
              <p className="tiny muted">More wing is quicker through corners and kinder in the wet, but slower on the straights — which makes overtaking and defending harder.</p>
            </div>
            {Array.from({ length: nCars }, (_, i) => { const ids = team.drivers.slice(i * regs.driversPerCar, (i + 1) * regs.driversPerCar); const ds = ids.map((id) => div.championship.drivers.find((d) => d.id === id)).filter(Boolean); return (
              <div key={i} className="panel col"><div className="row between"><h3>Car {i + 1}</h3><span className="dim small">{ds.map((d) => d!.name).join(' / ') || 'reserve driver'}</span></div>
                <Slider label="Wing" value={w(i)} min={0} max={1} step={0.05} onChange={(v) => setWing((a) => { const n = [...a]; for (let k = 0; k < nCars; k++) n[k] = n[k] ?? bestWing; n[i] = v; return n; })} fmt={(v) => `${Math.round(v * 100)}%`} />
                <div className="row wrap"><Select label="Starting tyres" value={startComp[i] ?? ''} options={[{ value: '', label: 'Let the strategists decide' }, ...regs.tyres.map((t) => ({ value: t.id as string, label: `${t.name}${t.wetType === 0 ? ` (≈${Math.round(t.lifeKm / track.abrasion / track.km)} laps)` : ''}` }))]} onChange={(v) => setStartComp((a) => { const n = [...a]; n[i] = v; return n; })} />
                  <label className="row small" style={{ gap: 6, marginTop: 16 }}><input type="checkbox" checked={auto[i] ?? true} onChange={(e) => setAuto((a) => { const n = [...a]; for (let k = 0; k < nCars; k++) n[k] = n[k] ?? true; n[i] = e.target.checked; return n; })} /> Automatic pit strategy (you can still override)</label></div>
              </div>); })}
            <div className="panel small dim">Dry compounds: {dry.map((t) => `${t.name} ${t.delta < 0 ? 'fastest' : t.delta > 0 ? 'slowest' : 'baseline'}, lasts ≈ ${Math.round(t.lifeKm / track.abrasion)} km`).join(' · ')}. {regs.refuel ? 'Refuelling is allowed.' : 'No refuelling: the car starts with fuel for the whole race.'} {regs.twoCompound ? 'Two different dry compounds must be used.' : ''}</div>
          </div>
        </div>
      </div>
    );
  }
  if (!sim) return null;

  // -------------------------------------------------------------------- live
  const order = sim.order();
  const leader = order[0];
  const lapsTotal = sim.cfg.laps;
  const mine = sim.cars.filter((c) => c.e.isPlayer);
  const sel = sim.cars[selIdx];
  const gapOf = (c: CarState) => {
    if (c.status === 'out') return 'OUT';
    if (c === leader) return lapsTotal ? `Lap ${Math.min(lapsTotal, c.laps + 1)}` : 'Leader';
    const d = leader.dist - c.dist;
    if (leader.status === 'fin' && c.status === 'fin') return c.laps < leader.laps ? `+${leader.laps - c.laps} L` : `+${(c.finishT - leader.finishT).toFixed(1)}`;
    if (d > sim.L) return `+${Math.floor(d / sim.L)} L`;
    return `+${(d / Math.max(25, c.v || leader.v || 50)).toFixed(1)}`;
  };
  const results = phase === 'done' ? sim.results() : null;
  return (
    <div className="race">
      <div className="bar">
        <b>{sim.cfg.name}</b>
        <span className="dim num">{lapsTotal ? `Lap ${Math.min(lapsTotal, sim.leaderLaps() + 1)} / ${lapsTotal}` : `${fmtClock(Math.min(sim.t, sim.cfg.duration))} / ${fmtClock(sim.cfg.duration)}`}</span>
        <div className="progress"><i style={{ width: `${sim.progress() * 100}%` }} /></div>
        <span className="small" title="Track wetness">{sim.rain > 0.05 ? '🌧' : sim.wetness > 0.15 ? '💧' : '☀'} {sim.rain > 0.05 ? `Rain ${Math.round(sim.rain * 100)}%` : sim.wetness > 0.02 ? 'Drying' : 'Dry'} · track {Math.round(sim.wetness * 100)}% wet</span>
        {sim.vsc > 0 && <span className="tag e">Virtual safety car</span>}
        <div className="grow" />
        {phase === 'live' && <>
          <Seg value={cam} options={[{ value: 'orbit', label: 'Overview' }, { value: 'tv', label: 'Trackside' }, { value: 'chase', label: 'Chase' }, { value: 'heli', label: 'Helicopter' }]} onChange={setCam} />
          <Seg value={speed} options={SPEEDS} onChange={setSpeed} />
          <button className="btn sm" onClick={() => { sim.runToEnd(); setPhase('done'); }}>Skip to the finish</button></>}
        {phase === 'done' && <button className="btn primary" onClick={() => go('game')}>Continue →</button>}
      </div>
      <div className="tower" role="list" aria-label="Timing">
        {order.map((c, i) => (
          <div key={c.e.id} role="listitem" className={'trow' + (c.e.isPlayer ? ' me' : '') + (c.idx === selIdx ? ' sel' : '') + (c.status === 'out' ? ' out' : '')} onClick={() => { setSelIdx(c.idx); if (cam === 'orbit') setCam('tv'); }}>
            <span className="muted num">{i + 1}</span><i style={{ background: c.e.color, height: 14, borderRadius: 2 }} />
            <span className="nm" title={`${c.e.drivers[c.driverIdx % c.e.drivers.length].name} — ${c.e.teamName}`}>{c.e.drivers[c.driverIdx % c.e.drivers.length].name.split(' ').slice(-1)[0]} <span className="muted tiny">{c.status === 'pit' ? 'PIT' : c.status === 'out' ? c.outReason : c.status === 'fin' ? '🏁' : ''}</span></span>
            <span className="gap">{gapOf(c)}</span>
            <span className="ty" style={{ background: TYRE_COLOR[c.compound.id] }} title={`${c.compound.name}, ${Math.round(c.wear * 100)}% worn, ${c.stops} stops`}>{c.compound.id[0].toUpperCase()}</span>
          </div>))}
      </div>
      <div className="stage">
        <RaceScene sim={sim} alpha={alpha} selected={selected} camMode={camMode} discipline={div.discipline} year={sim.cfg.year} wet={Math.round(sim.wetness * 4) / 4} />
        <div className="mini"><TrackMap trackId={sim.cfg.trackId} height="100%" dots={sim.cars.filter((c) => c.status === 'run' || c.status === 'pit').map((c) => ({ s: c.dist, color: c.e.isPlayer ? '#e8b04a' : c.e.color, big: c.idx === selIdx || c.e.isPlayer }))} /></div>
        <div className="logbox">{sim.log.slice(-6).reverse().map((l, i) => <div key={sim.log.length - i} className={l.kind === 'player' ? 'accent' : l.kind === 'dnf' ? 'bad' : l.kind === 'flag' || l.kind === 'weather' ? 'warn' : ''}>{l.text}</div>)}</div>
        {phase === 'live' && speed === 0 && sim.t < 1 && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(8,9,11,0.45)' }}><div className="panel col" style={{ alignItems: 'center', maxWidth: 420, textAlign: 'center' }}><h2>The grid is formed</h2><p className="dim">Pole: {sim.cars[0].e.drivers[0].name} — {fmtTime(sim.qualifying[0].time)}. Your cars start {mine.map((c) => `P${c.grid}`).join(' and ')}.</p><button className="btn primary lg" onClick={() => setSpeed(sim.cfg.laps ? 4 : 64)}>Lights out</button></div></div>}
        {results && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(8,9,11,0.7)', padding: 20, overflow: 'auto' }}><div className="panel col" style={{ maxWidth: 760, width: '100%', maxHeight: '100%', overflow: 'auto' }}>
          <div className="row between"><h2>Classification — {sim.cfg.name}</h2><button className="btn primary" onClick={() => go('game')}>Continue →</button></div>
          <table><thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th className="r">Grid</th><th className="r">Laps</th><th className="r">Stops</th><th className="r">Best lap</th><th>Status</th><th className="r">Pts</th></tr></thead><tbody>
            {results.map((r) => { const e = sim.cfg.entries.find((x) => x.teamId === r.teamId && x.carIdx === r.carIdx)!; return <tr key={e.id} className={e.isPlayer ? 'me' : ''}><td>{r.pos}</td><td>{e.drivers.map((d) => d.name).join(' / ')}</td><td className="dim">{e.teamName}</td><td className="r">{r.grid}</td><td className="r">{r.laps}</td><td className="r">{r.stops}</td><td className="r">{r.bestLap ? fmtTime(r.bestLap) : '—'}</td><td className={r.status === 'dnf' ? 'bad' : 'dim'}>{r.status === 'dnf' ? r.reason : 'Finished'}</td><td className="r">{r.points || ''}</td></tr>; })}
          </tbody></table></div></div>}
      </div>
      <div className="side">
        {mine.map((c) => <CarPanel key={c.e.id} sim={sim} c={c} live={phase === 'live'} onFocus={() => setSelIdx(c.idx)} />)}
        {sel && !sel.e.isPlayer && <div className="panel col" style={{ gap: 3 }}><h4>Selected: {sel.e.drivers[sel.driverIdx % sel.e.drivers.length].name}</h4><StatLine label="Team" value={sel.e.teamName} /><StatLine label="Last / best lap" value={`${sel.lastLap ? fmtTime(sel.lastLap) : '—'} / ${isFinite(sel.bestLap) ? fmtTime(sel.bestLap) : '—'}`} /><StatLine label="Tyres" value={`${sel.compound.name}, ${Math.round(sel.wear * 100)}% worn`} /><StatLine label="Stops" value={sel.stops} /></div>}
        <div className="panel col" style={{ gap: 3 }}><h4>Race log</h4><div className="col small" style={{ gap: 3, maxHeight: 260, overflow: 'auto' }}>{sim.log.slice(-40).reverse().map((l, i) => <div key={sim.log.length - i} className={l.kind === 'player' ? 'accent' : l.kind === 'dnf' ? 'bad' : 'dim'}><span className="muted num">{lapsTotal ? `L${l.lap + 1}` : fmtClock(l.t)}</span> {l.text}</div>)}</div></div>
      </div>
    </div>
  );
}

function CarPanel({ sim, c, live, onFocus }: { sim: RaceSim; c: CarState; live: boolean; onFocus: () => void }) {
  const regs = sim.cfg.regs;
  const [comp, setComp] = useState('');
  const d = c.e.drivers[c.driverIdx % c.e.drivers.length];
  const lapsLeft = sim.lapsLeft(c);
  const fuelLaps = c.fuel / (c.fuelPerLap || 1);
  const best = [0, 1, 2].reduce((a, t) => (wetPenalty(t as 0 | 1 | 2, sim.wetness) < wetPenalty(a as 0 | 1 | 2, sim.wetness) ? t : a), 0);
  const suggested = regs.tyres.find((t) => t.wetType === best && (best !== 0 || t.id !== c.compound.id)) ?? regs.tyres.find((t) => t.wetType === best)!;
  const choice = comp || suggested.id;
  const [, force] = useState(0);
  const set = (fn: () => void) => { fn(); force((x) => x + 1); };
  return (
    <div className="panel col" style={{ gap: 6, borderColor: c.status === 'out' ? '#7a3434' : 'var(--accent)' }}>
      <div className="row between"><button className="btn sm ghost" style={{ padding: '2px 6px' }} onClick={onFocus} title="Follow this car"><b>#{c.e.number} {d.name}</b></button><span className="num"><b>{c.status === 'out' ? 'OUT' : `P${sim.position(c)}`}</b></span></div>
      {c.status === 'out' ? <p className="bad small">Retired: {c.outReason}</p> : <>
        <StatLine label="Last / best lap" value={`${c.lastLap ? fmtTime(c.lastLap) : '—'} / ${isFinite(c.bestLap) ? fmtTime(c.bestLap) : '—'}`} />
        <StatLine label={`Tyres: ${c.compound.name}`} value={<span className={c.wear > 0.8 ? 'bad' : c.wear > 0.6 ? 'warn' : ''}>{Math.round(c.wear * 100)}% worn · {Math.round(c.tyreKm / (sim.L / 1000))} laps</span>} />
        <StatLine label="Fuel" value={<span className={regs.refuel && fuelLaps < 2 ? 'warn' : ''}>{c.fuel.toFixed(0)} kg · {fuelLaps.toFixed(1)} laps{c.lowFuel ? ' · saving' : ''}</span>} />
        <StatLine label="Stops / remaining" value={`${c.stops} · ${sim.cfg.laps ? `${Math.max(0, Math.ceil(lapsLeft))} laps` : fmtClock(Math.max(0, sim.cfg.duration - sim.t))}`} />
        {c.plan.length > 0 && <div className="tiny muted">Plan: stop on lap {c.plan.map((l) => l + 1).join(', ')} → {c.planComp.join(' → ')}</div>}
        {live && c.status !== 'fin' && <>
          <div className="row between"><span className="small dim">Pace</span><Seg value={c.mode} options={[{ value: 'conserve', label: 'Conserve', title: 'Slower; saves tyres, fuel and the engine' }, { value: 'normal', label: 'Normal' }, { value: 'push', label: 'Push', title: 'Faster; more wear, fuel and risk' }]} onChange={(m) => set(() => sim.setMode(c.e.id, m as Mode))} /></div>
          <div className="row" style={{ gap: 6 }}><Select value={choice} options={regs.tyres.map((t) => ({ value: t.id as string, label: t.name }))} onChange={setComp} />
            {c.pitReq ? <button className="btn sm danger grow" onClick={() => set(() => sim.cancelPit(c.e.id))}>Cancel stop</button> : <button className="btn sm primary grow" disabled={c.status === 'pit'} onClick={() => set(() => sim.requestPit(c.e.id, choice))}>Box this lap</button>}</div>
          <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={c.auto} onChange={(e) => set(() => sim.setAuto(c.e.id, e.target.checked))} /> Strategists may call stops automatically</label>
          {c.pitReq && <div className="small accent">Pit stop confirmed for the end of this lap ({regs.tyres.find((t) => t.id === c.pitReq!.compound)?.name}).</div>}
        </>}
      </>}
    </div>
  );
}
