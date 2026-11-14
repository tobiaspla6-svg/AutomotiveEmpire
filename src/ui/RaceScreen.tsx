import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame, useStore } from '../store/game';
import { applyRaceResult, buildRaceConfig, pendingRound, playerTeam, raceWeather, teamRegs, wingTable } from '../sim/racing/season';
import { RaceSim, wetPenalty, type CarState, type Mode } from '../sim/racing/race';
import { TRACK } from '../sim/racing/tracks';
import { fmtClock, fmtTime } from '../sim/util';
import { Meter, Seg, Select, Slider, StatLine } from './common';
import { useT, type MessageKey } from '../i18n';
import { Guard3D } from './Lazy3D';
import { Icon } from './ds/icons';
import { RaceScene } from '../three/RaceScene';
import { TrackMap } from '../three/TrackMap';

const TYRE_COLOR: Record<string, string> = { soft: '#e66767', medium: '#e8b04a', hard: '#e6e6e6', inter: '#3fb984', wet: '#3987e5' };
const SPEEDS = [{ value: 0, label: '❚❚' }, { value: 1, label: '1×' }, { value: 4, label: '4×' }, { value: 16, label: '16×' }, { value: 64, label: '64×' }, { value: 400, label: 'Max' }];
const WING = ['race.wing.min', 'race.wing.low', 'race.wing.medium', 'race.wing.high', 'race.wing.max'] as const;
const k = (x: string) => x as MessageKey;

export function RaceScreen() {
  const { g, p } = useGame();
  const { t } = useT();
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

  if (!div || !team || !regs) return <div className="main"><p>{t('race.none')}</p><button className="btn" onClick={() => go('game')}>{t('race.back')}</button></div>;
  if (!round && phase === 'pre') return <div className="main"><h2>{t('race.noRound')}</h2><button className="btn" onClick={() => go('game')}>{t('race.back')}</button></div>;

  const begin = (instant: boolean) => {
    const cfg = buildRaceConfig(g, p, div, { wing: Array.from({ length: nCars }, (_, i) => w(i)), startCompound: Array.from({ length: nCars }, (_, i) => startComp[i] || undefined), auto: Array.from({ length: nCars }, (_, i) => auto[i] ?? true) });
    const s = new RaceSim(cfg);
    setSim(s);
    const mine = s.cars.find((c) => c.e.isPlayer);
    setSelIdx(mine ? mine.idx : 0);
    if (instant) { s.runToEnd(); setPhase('done'); } else { setSpeed(0); setPhase('live'); }
  };
  const level = (v: number, a: number, b: number) => t(v > a ? 'ms.track.easy' : v > b ? 'ms.track.average' : 'ms.track.hard');

  // ---------------------------------------------------------------- briefing
  if (phase === 'pre' && round) {
    const track = TRACK[round.trackId];
    const forecast = raceWeather(g, div).forecast; // read-only: building the full race config would sign reserve drivers and post news
    const dry = regs.tyres.filter((x) => x.wetType === 0);
    return (
      <div className="main race-brief" style={{ height: '100%' }}>
        <div className="pagehead"><div><span className="eyebrow">{div.championship.name} · {t('race.round', { n: div.championship.nextRound + 1, total: div.championship.rounds.length })}</span><h1>{round.name}</h1><p className="dim">{track.name}, {track.country} · {track.km.toFixed(2)} km · {round.hours ? t('ms.hours', { n: round.hours }) : t('race.lapsKm', { n: round.laps, km: (round.laps * track.km).toFixed(0) })} · {regs.className}</p></div>
          <div className="row wrap"><button className="btn ghost" onClick={() => go('game')}><Icon name="arrow" size={15} style={{ transform: 'scaleX(-1)' }} />{t('race.hq')}</button><button className="btn" data-action="simulate-race" onClick={() => begin(true)}><Icon name="fast" size={15} />{t('race.instant')}</button><button className="btn primary lg" data-action="start-race" onClick={() => begin(false)}>{t('race.toGrid')}<Icon name="arrow" size={16} /></button></div></div>
        <div className="grid g2">
          <div className="panel col"><span className="eyebrow">{t('ms.season.circuit')}</span><TrackMap trackId={round.trackId} height={260} zones />
            <div className="row wrap small dim" style={{ gap: 14 }}><span>{t('ms.track.overtaking')}: {level(track.overtake, 1.1, 0.8)}</span><span>{t('ms.track.wear')}: {t(track.abrasion > 1.1 ? 'ms.track.high' : track.abrasion > 0.9 ? 'ms.track.medium' : 'ms.track.low')}</span><span>{t('race.pitLoss', { s: track.pitLoss })}</span><span className="good">— {t('ms.track.zones')}</span></div>
            <span className="eyebrow" style={{ marginTop: 8 }}>{t('race.forecast')}</span><p>{forecast}</p>
            <p className="small muted">{t('race.tyreRule')}</p>
          </div>
          <div className="col">
            <div className="panel col"><span className="eyebrow">{t('race.wingTitle')}</span>
              <table><thead><tr><th>{t('race.wing')}</th><th className="r">{t('race.lapTime')}</th><th className="r">{t('st.topSpeed')}</th><th /></tr></thead><tbody>{table.map((r) => <tr key={r.wing} className={r.wing === bestWing ? 'me' : ''}><td>{t(WING[Math.round(r.wing * 4)])}</td><td className="r">{fmtTime(r.time)}</td><td className="r">{Math.round(r.vMax)} km/h</td><td className="small muted">{r.wing === bestWing ? t('race.fastest') : ''}</td></tr>)}</tbody></table>
              <p className="tiny muted">{t('race.wingNote')}</p>
            </div>
            {Array.from({ length: nCars }, (_, i) => { const ids = team.drivers.slice(i * regs.driversPerCar, (i + 1) * regs.driversPerCar); const ds = ids.map((id) => div.championship.drivers.find((d) => d.id === id)).filter(Boolean); return (
              <div key={i} className="panel col"><div className="row between"><h3>{t('race.car', { n: i + 1 })}</h3><span className="dim small">{ds.map((d) => d!.name).join(' / ') || t('race.reserve')}</span></div>
                <Slider label={t('race.wing')} value={w(i)} min={0} max={1} step={0.05} onChange={(v) => setWing((a) => { const n = [...a]; for (let j = 0; j < nCars; j++) n[j] = n[j] ?? bestWing; n[i] = v; return n; })} fmt={(v) => `${Math.round(v * 100)}%`} />
                <div className="row wrap"><Select label={t('race.startTyres')} value={startComp[i] ?? ''} options={[{ value: '', label: t('race.strategistsDecide') }, ...regs.tyres.map((x) => ({ value: x.id as string, label: `${t(k(`race.tyre.${x.id}`))}${x.wetType === 0 ? ` (${t('race.aboutLaps', { n: Math.round(x.lifeKm / track.abrasion / track.km) })})` : ''}` }))]} onChange={(v) => setStartComp((a) => { const n = [...a]; n[i] = v; return n; })} />
                  <label className="row small" style={{ gap: 6, marginTop: 16 }}><input type="checkbox" checked={auto[i] ?? true} onChange={(e) => setAuto((a) => { const n = [...a]; for (let j = 0; j < nCars; j++) n[j] = n[j] ?? true; n[i] = e.target.checked; return n; })} /> {t('race.autoStrategy')}</label></div>
              </div>); })}
            <div className="panel small dim">{t('race.dry')}: {dry.map((x) => t('race.dryFmt', { name: t(k(`race.tyre.${x.id}`)), pace: t(x.delta < 0 ? 'race.pace.fastest' : x.delta > 0 ? 'race.pace.slowest' : 'race.pace.baseline'), km: Math.round(x.lifeKm / track.abrasion) })).join(' · ')}. {t(regs.refuel ? 'race.refuel' : 'race.noRefuel')} {regs.twoCompound ? t('race.twoCompound') : ''}</div>
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
    if (c.status === 'out') return t('race.out');
    if (c === leader) return t('race.leader');
    const d = leader.dist - c.dist;
    if (leader.status === 'fin' && c.status === 'fin') return c.laps < leader.laps ? `+${leader.laps - c.laps} L` : `+${(c.finishT - leader.finishT).toFixed(1)}`;
    if (d > sim.L) return `+${Math.floor(d / sim.L)} L`;
    return `+${(d / Math.max(25, c.v || leader.v || 50)).toFixed(1)}`;
  };
  const results = phase === 'done' ? sim.results() : null;
  const dots = sim.cars.filter((c) => c.status === 'run' || c.status === 'pit').map((c) => ({ s: c.dist, color: c.e.isPlayer ? '#e8b04a' : c.e.color, big: c.idx === selIdx || c.e.isPlayer }));
  const weather = sim.rain > 0.05 ? 'rain' : sim.wetness > 0.02 ? 'drying' : 'dry';
  const surname = (c: CarState) => c.e.drivers[c.driverIdx % c.e.drivers.length].name.split(' ').slice(-1)[0];
  return (
    <div className="race">
      <div className="bar">
        <div className="race-id"><span className="eyebrow">{div.championship.name}</span><b>{sim.cfg.name}</b></div>
        <div className="race-lap" aria-live="off">{lapsTotal ? <><span className="eyebrow">{t('race.lap')}</span><b className="display">{Math.min(lapsTotal, sim.leaderLaps() + 1)}<i> / {lapsTotal}</i></b></> : <><span className="eyebrow">{t('race.time')}</span><b className="display">{fmtClock(Math.min(sim.t, sim.cfg.duration))}<i> / {fmtClock(sim.cfg.duration)}</i></b></>}</div>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(sim.progress() * 100)}><i style={{ width: `${sim.progress() * 100}%` }} /></div>
        <span className={'race-weather ' + weather} title={t('race.wetness')}>{t(k(`race.weather.${weather}`))}{sim.rain > 0.05 ? ` ${Math.round(sim.rain * 100)}%` : ''} · {t('race.trackWet', { pct: Math.round(sim.wetness * 100) })}</span>
        {sim.vsc > 0 && <span className="tag e race-vsc">{t('race.vsc')}</span>}
        <div className="grow" />
        {phase === 'live' && <>
          <Seg value={cam} options={[{ value: 'orbit', label: t('race.cam.orbit') }, { value: 'tv', label: t('race.cam.tv') }, { value: 'chase', label: t('race.cam.chase') }, { value: 'heli', label: t('race.cam.heli') }]} onChange={setCam} />
          <Seg value={speed} options={SPEEDS} onChange={setSpeed} />
          <button className="btn sm" onClick={() => { sim.runToEnd(); setPhase('done'); }}>{t('race.skip')}</button></>}
        {phase === 'done' && <button className="btn primary" data-action="race-continue" onClick={() => go('game')}>{t('menu.continue')}<Icon name="arrow" size={15} /></button>}
      </div>
      <div className="tower" role="list" aria-label={t('race.timing')}>
        <div className="thead"><span>{t('ms.season.pos')}</span><span /><span>{t('ms.team.driver')}</span><span className="gap">{t('race.gap')}</span><span>{t('race.tyreShort')}</span></div>
        {order.map((c, i) => (
          <div key={c.e.id} role="listitem" className={'trow' + (c.e.isPlayer ? ' me' : '') + (c.idx === selIdx ? ' sel' : '') + (c.status === 'out' ? ' out' : '') + (i < 3 ? ' podium' : '')} onClick={() => { setSelIdx(c.idx); if (cam === 'orbit') setCam('tv'); }}>
            <span className="pos num">{i + 1}</span><i className="tc" style={{ background: c.e.color }} />
            <span className="nm" title={`${c.e.drivers[c.driverIdx % c.e.drivers.length].name} — ${c.e.teamName}`}><b>{surname(c)}</b> <span className="tm">{c.e.teamName}</span>{c.status === 'pit' ? <em className="badge pit">{t('race.pit')}</em> : c.status === 'out' ? <em className="badge dnf">{c.outReason}</em> : c.status === 'fin' ? <em className="badge fin">{t('race.fin')}</em> : null}</span>
            <span className="gap">{gapOf(c)}</span>
            <span className="ty" style={{ background: TYRE_COLOR[c.compound.id] }} title={t('race.tyreHint', { name: t(k(`race.tyre.${c.compound.id}`)), pct: Math.round(c.wear * 100), stops: c.stops })}>{c.compound.id[0].toUpperCase()}</span>
          </div>))}
      </div>
      <div className="stage">
        <Guard3D eager className="race-3d" poster={<div className="race-2d"><TrackMap trackId={sim.cfg.trackId} height="100%" zones dots={dots} /><span className="tiny muted">{t('race.2d')}</span></div>}>
          <RaceScene sim={sim} alpha={alpha} selected={selected} camMode={camMode} discipline={div.discipline} year={sim.cfg.year} wet={Math.round(sim.wetness * 4) / 4} />
        </Guard3D>
        <div className="mini"><TrackMap trackId={sim.cfg.trackId} height="100%" dots={dots} /></div>
        <div className="logbox">{sim.log.slice(-6).reverse().map((l, i) => <div key={sim.log.length - i} className={l.kind === 'player' ? 'accent' : l.kind === 'dnf' ? 'bad' : l.kind === 'flag' || l.kind === 'weather' ? 'warn' : ''}>{l.text}</div>)}</div>
        {phase === 'live' && speed === 0 && sim.t < 1 && <div className="race-overlay"><div className="panel col" style={{ alignItems: 'center', maxWidth: 440, textAlign: 'center' }}><span className="eyebrow">{t('race.grid.eyebrow')}</span><h2>{t('race.grid.title')}</h2><p className="dim">{t('race.grid.body', { pole: sim.cars[0].e.drivers[0].name, time: fmtTime(sim.qualifying[0].time), pos: mine.map((c) => `P${c.grid}`).join(' · ') })}</p><button className="btn primary lg" data-action="lights-out" onClick={() => setSpeed(sim.cfg.laps ? 4 : 64)}>{t('race.lightsOut')}</button></div></div>}
        {results && <div className="race-overlay dark"><div className="panel col" style={{ maxWidth: 780, width: '100%', maxHeight: '100%', overflow: 'auto' }}>
          <div className="row between"><div><span className="eyebrow">{t('ms.season.classification')}</span><h2>{sim.cfg.name}</h2></div><button className="btn primary" data-action="race-continue" onClick={() => go('game')}>{t('menu.continue')}<Icon name="arrow" size={15} /></button></div>
          <table><thead><tr><th>{t('ms.season.pos')}</th><th>{t('ms.team.driver')}</th><th>{t('ms.market.team')}</th><th className="r">{t('ms.season.grid')}</th><th className="r">{t('ms.season.lapsCol')}</th><th className="r">{t('ms.season.stops')}</th><th className="r">{t('ms.season.best')}</th><th>{t('ms.season.status')}</th><th className="r">{t('ms.season.pts')}</th></tr></thead><tbody>
            {results.map((r) => { const e = sim.cfg.entries.find((x) => x.teamId === r.teamId && x.carIdx === r.carIdx)!; return <tr key={e.id} className={e.isPlayer ? 'me' : ''}><td>{r.pos}</td><td>{e.drivers.map((d) => d.name).join(' / ')}</td><td className="dim">{e.teamName}</td><td className="r">{r.grid}</td><td className="r">{r.laps}</td><td className="r">{r.stops}</td><td className="r">{r.bestLap ? fmtTime(r.bestLap) : '—'}</td><td className={r.status === 'dnf' ? 'bad' : 'dim'}>{r.status === 'dnf' ? r.reason : t('ms.season.finished')}</td><td className="r">{r.points || ''}</td></tr>; })}
          </tbody></table></div></div>}
      </div>
      <div className="side">
        {mine.map((c) => <CarPanel key={c.e.id} sim={sim} c={c} live={phase === 'live'} onFocus={() => setSelIdx(c.idx)} />)}
        {sel && !sel.e.isPlayer && <div className="panel col" style={{ gap: 3 }}><span className="eyebrow">{t('race.selected')}</span><b>{sel.e.drivers[sel.driverIdx % sel.e.drivers.length].name}</b><StatLine label={t('ms.market.team')} value={sel.e.teamName} /><StatLine label={t('race.lastBest')} value={`${sel.lastLap ? fmtTime(sel.lastLap) : '—'} / ${isFinite(sel.bestLap) ? fmtTime(sel.bestLap) : '—'}`} /><StatLine label={t('st.tyres')} value={t('race.worn', { name: t(k(`race.tyre.${sel.compound.id}`)), pct: Math.round(sel.wear * 100) })} /><StatLine label={t('ms.season.stops')} value={sel.stops} /></div>}
        <div className="panel col" style={{ gap: 3 }}><span className="eyebrow">{t('race.log')}</span><div className="col small" style={{ gap: 3, maxHeight: 260, overflow: 'auto' }}>{sim.log.slice(-40).reverse().map((l, i) => <div key={sim.log.length - i} className={l.kind === 'player' ? 'accent' : l.kind === 'dnf' ? 'bad' : 'dim'}><span className="muted num">{lapsTotal ? `L${l.lap + 1}` : fmtClock(l.t)}</span> {l.text}</div>)}</div></div>
      </div>
    </div>
  );
}

function CarPanel({ sim, c, live, onFocus }: { sim: RaceSim; c: CarState; live: boolean; onFocus: () => void }) {
  const { t } = useT();
  const regs = sim.cfg.regs;
  const [comp, setComp] = useState('');
  const d = c.e.drivers[c.driverIdx % c.e.drivers.length];
  const lapsLeft = sim.lapsLeft(c);
  const fuelLaps = c.fuel / (c.fuelPerLap || 1);
  const best = [0, 1, 2].reduce((a, x) => (wetPenalty(x as 0 | 1 | 2, sim.wetness) < wetPenalty(a as 0 | 1 | 2, sim.wetness) ? x : a), 0);
  const suggested = regs.tyres.find((x) => x.wetType === best && (best !== 0 || x.id !== c.compound.id)) ?? regs.tyres.find((x) => x.wetType === best)!;
  const choice = comp || suggested.id;
  const [, force] = useState(0);
  const set = (fn: () => void) => { fn(); force((x) => x + 1); };
  const tyreName = (id: string) => t(k(`race.tyre.${id}`));
  return (
    <div className={'panel col car-panel' + (c.status === 'out' ? ' out' : '')} style={{ gap: 7 }}>
      <div className="row between"><button className="btn sm ghost" style={{ padding: '2px 6px' }} onClick={onFocus} title={t('race.follow')}><b>#{c.e.number} {d.name}</b></button><b className="display cp-pos">{c.status === 'out' ? t('race.out') : `P${sim.position(c)}`}</b></div>
      {c.status === 'out' ? <p className="bad small">{t('race.retired', { reason: c.outReason ?? '' })}</p> : <>
        <StatLine label={t('race.lastBest')} value={`${c.lastLap ? fmtTime(c.lastLap) : '—'} / ${isFinite(c.bestLap) ? fmtTime(c.bestLap) : '—'}`} />
        <div className="cp-gauge"><div className="row between small"><span><i className="swatch" style={{ background: TYRE_COLOR[c.compound.id] }} /> {tyreName(c.compound.id)}</span><span className={c.wear > 0.8 ? 'bad' : c.wear > 0.6 ? 'warn' : ''}>{t('race.wornLaps', { pct: Math.round(c.wear * 100), n: Math.round(c.tyreKm / (sim.L / 1000)) })}</span></div><Meter value={(1 - c.wear) * 100} color={c.wear > 0.8 ? 'var(--bad)' : c.wear > 0.6 ? 'var(--warn)' : 'var(--good)'} /></div>
        <div className="cp-gauge"><div className="row between small"><span>{t('race.fuel')}</span><span className={regs.refuel && fuelLaps < 2 ? 'warn' : ''}>{t('race.fuelFmt', { kg: c.fuel.toFixed(0), laps: fuelLaps.toFixed(1) })}{c.lowFuel ? ` · ${t('race.saving')}` : ''}</span></div><Meter value={Math.min(100, (fuelLaps / Math.max(1, sim.cfg.laps ? Math.min(sim.cfg.laps, 40) : 40)) * 100)} color="var(--s1)" /></div>
        <StatLine label={t('race.stopsLeft')} value={`${c.stops} · ${sim.cfg.laps ? t('ms.laps', { n: Math.max(0, Math.ceil(lapsLeft)) }) : fmtClock(Math.max(0, sim.cfg.duration - sim.t))}`} />
        {c.plan.length > 0 && <div className="tiny muted">{t('race.plan', { laps: c.plan.map((l) => l + 1).join(', '), tyres: c.planComp.map((id) => tyreName(id)).join(' → ') })}</div>}
        {live && c.status !== 'fin' && <>
          <div className="row between"><span className="small dim">{t('race.pace')}</span><Seg value={c.mode} options={[{ value: 'conserve', label: t('race.mode.conserve'), title: t('race.mode.conserve.hint') }, { value: 'normal', label: t('race.mode.normal') }, { value: 'push', label: t('race.mode.push'), title: t('race.mode.push.hint') }]} onChange={(m) => set(() => sim.setMode(c.e.id, m as Mode))} /></div>
          <div className="row" style={{ gap: 6 }}><Select value={choice} options={regs.tyres.map((x) => ({ value: x.id as string, label: tyreName(x.id) }))} onChange={setComp} />
            {c.pitReq ? <button className="btn sm danger grow" onClick={() => set(() => sim.cancelPit(c.e.id))}>{t('race.cancelStop')}</button> : <button className="btn sm primary grow" data-action="box" disabled={c.status === 'pit'} onClick={() => set(() => sim.requestPit(c.e.id, choice))}>{t('race.box')}</button>}</div>
          <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={c.auto} onChange={(e) => set(() => sim.setAuto(c.e.id, e.target.checked))} /> {t('race.autoStops')}</label>
          {c.pitReq && <div className="small accent">{t('race.pitConfirmed', { name: tyreName(c.pitReq.compound) })}</div>}
        </>}
      </>}
    </div>
  );
}
