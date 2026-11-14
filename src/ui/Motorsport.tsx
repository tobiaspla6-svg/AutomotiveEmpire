// Motorsport headquarters (Phase 4C). The first tab is the team at a glance: the racing car, the next event, the
// driver line-up, both championships, the season's money, development and the calendar. The other tabs keep every
// control of the previous screen (car design, drivers and staff, season results) in the same design system.
import { useMemo, useState } from 'react';
import type { Company, DevLevels, Discipline, EngineLayout, GameState, MotorsportDivision, RaceCarSpec } from '../sim/types';
import { useGame, useStore } from '../store/game';
import { useT, type MessageKey } from '../i18n';
import { useTerm } from '../i18n/terms';
import { money, monthShort } from '../i18n/format';
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
import { fmtTime } from '../sim/util';
import { LineChart, Meter, Modal, PageHead, Select, Slider, Src, StatLine } from './common';
import { ImpactPreview } from './Impact';
import { GettingStarted } from './Guide';
import { Guard3D, RaceCarViewer } from './Lazy3D';
import { CarPoster, posterForDiscipline } from './ds/poster';
import { Icon } from './ds/icons';
import { EmptyState, HBar, KpiTile, Panel, StackBar, Tabs } from './ds/primitives';
import { TrackMap } from '../three/TrackMap';

const DEV_KEYS: (keyof DevLevels)[] = ['aero', 'engine', 'chassis', 'reliability'];
const k = (s: string) => s as MessageKey;
type Tab = 'hq' | 'car' | 'team' | 'season';

export function MotorsportView() {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const term = useTerm();
  const act = useStore((s) => s.act), ask = useStore((s) => s.ask);
  const [tab, setTab] = useState<Tab>('hq');
  const [disc, setDisc] = useState<Discipline>('gt');
  const [name, setName] = useState(`${p.name} Racing`);
  const div = p.motorsport;
  if (!div) {
    const d = disciplineAvailable(disc, g.year) ? disc : 'f1';
    const B = budgetRef(getRegs(d, g.year), g.year);
    const found = () => { const go = () => { act((gg) => establishMotorsport(gg, d, name), t('ms.found.done')); }; ask(t('ms.found.confirm', { cost: money(B * 0.5, lang), season: money(B, lang) }), go); };
    return (
      <div className="ms">
        <PageHead title={t('ms.title')}>{t('ms.found.intro', { name: p.name })}</PageHead>
        <Panel eyebrow={t('ms.found.eyebrow')} title={t('ms.found.title')}>
          <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>{DISCIPLINES.map((x) => <button key={x.id} className={'card' + (d === x.id ? ' on' : '')} disabled={!disciplineAvailable(x.id, g.year)} onClick={() => setDisc(x.id)}><b>{term(x.name)}</b><span className="small muted" style={{ whiteSpace: 'normal' }}>{disciplineAvailable(x.id, g.year) ? x.blurb : t('ms.found.begins', { year: x.from })}</span><span className="small">{disciplineAvailable(x.id, g.year) ? t('ms.found.perSeason', { v: money(budgetRef(getRegs(x.id, g.year), g.year), lang) }) : ''}</span></button>)}</div>
          <p className="dim" style={{ margin: '10px 0' }}><Src k="h" /> {getRegs(d, g.year).note}</p>
          <div className="row wrap"><input type="text" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} aria-label={t('ms.found.teamName')} style={{ minWidth: 260 }} />
            <button className="btn primary" data-action="found-team" onClick={found}>{t('ms.found.go', { cost: money(B * 0.5, lang) })}</button></div>
        </Panel>
      </div>
    );
  }
  const race = pendingRound(g, p);
  const regs = teamRegs(playerTeam(div), div.championship.year);
  return (
    <div className="ms">
      <header className="ms-head">
        <div className="col" style={{ gap: 2, minWidth: 0 }}>
          <span className="eyebrow">{div.championship.name} · {regs.className} · {t('ms.season', { year: div.championship.year })}</span>
          <h2>{div.teamName}</h2>
          {race && <span className="small accent">{t('ms.racePending', { name: race.name })}</span>}
        </div>
        <Tabs label={t('ms.title')} value={tab} onChange={setTab} options={[{ id: 'hq', label: t('ms.tab.hq') }, { id: 'car', label: t('ms.tab.car') }, { id: 'team', label: t('ms.tab.team') }, { id: 'season', label: t('ms.tab.season') }]} />
      </header>
      {tab === 'hq' && g.mode === 'motorsport' && <GettingStarted />}
      {tab === 'hq' && <Headquarters p={p} div={div} goTab={setTab} />}
      {tab === 'car' && <CarDesign p={p} div={div} />}
      {tab === 'team' && <Team p={p} div={div} />}
      {tab === 'season' && <Season div={div} />}
      {g.mode !== 'motorsport' && tab === 'hq' && <div className="row end"><button className="btn sm danger" onClick={() => ask(t('ms.withdraw.confirm', { name: div.teamName }), () => { act((gg) => closeMotorsport(gg)); })}>{t('ms.withdraw')}</button></div>}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ headquarters
function Headquarters({ p, div, goTab }: { p: Company; div: MotorsportDivision; goTab: (t: Tab) => void }) {
  const { g } = useGame();
  const { t, lang } = useT();
  const act = useStore((s) => s.act), go = useStore((s) => s.go);
  const ch = div.championship, team = playerTeam(div), regs = teamRegs(team, ch.year);
  const B = budgetRef(regs, g.year);
  const st = standings(ch);
  const pos = st.teams.findIndex((x) => x.id === team.id) + 1;
  const next = ch.rounds[ch.nextRound];
  const race = pendingRound(g, p);
  const b = seasonBudget(g, p, div);
  const m$ = (v: number) => money(v, lang);
  const mine = team.drivers.map((id) => ch.drivers.find((d) => d.id === id)!).filter(Boolean);
  const seats = regs.carsPerTeam * regs.driversPerCar;
  const myBest = st.drivers.findIndex((d) => d.teamId === team.id);
  const leaderPts = ch.teamPoints[st.teams[0]?.id] ?? 0, myPts = ch.teamPoints[team.id] ?? 0;
  const devAvg = DEV_KEYS.reduce((a, key) => a + team.dev[key], 0) / DEV_KEYS.length;
  const [board, setBoard] = useState<'teams' | 'drivers'>('teams');
  const topTeams = st.teams.slice(0, 8), maxT = Math.max(1, ...topTeams.map((x) => ch.teamPoints[x.id] ?? 0));
  const topDrivers = st.drivers.slice(0, 8), maxD = Math.max(1, ...topDrivers.map((x) => ch.driverPoints[x.id] ?? 0));
  const net = p.cash - p.debt;
  const costParts = [
    { label: t('ms.cost.people'), value: b.personnel, color: 'var(--s1)' }, { label: t('ms.cost.facilities'), value: b.facilities, color: 'var(--s7)' }, { label: t('ms.cost.car'), value: b.carBuild, color: 'var(--s2)' },
    { label: t('ms.cost.travel'), value: b.travel, color: 'var(--s3)' }, { label: t('ms.cost.drivers'), value: b.drivers, color: 'var(--s5)' }, { label: t('ms.cost.dev'), value: b.development, color: 'var(--s4)' },
  ];
  return (
    <>
      <div className="ms-hero">
        <div className="viewer ms-car">
          <Guard3D poster={<CarPoster kind={posterForDiscipline(div.discipline)} color={team.car.color} className="poster-hero" />}><RaceCarViewer discipline={div.discipline} year={ch.year} color={team.car.color} color2={team.car.color2} wing={team.car.aeroBias} /></Guard3D>
          <div className="overlay"><b>{div.teamName}</b> · {regs.className}</div>
          <button className="chip ms-car-edit" onClick={() => goTab('car')}><Icon name="wrench" size={14} />{t('ms.tab.car')}</button>
        </div>
        <Panel eyebrow={race ? t('ms.next.now') : t('ms.next')} title={next ? next.name : t('ms.next.done')} className={'ms-next' + (race ? ' live' : '')}>
          {next ? <>
            <span className="small muted">{TRACK[next.trackId].name}, {TRACK[next.trackId].country} · {monthShort(next.month, lang)} · {next.hours ? t('ms.hours', { n: next.hours }) : t('ms.laps', { n: next.laps ?? 0 })}</span>
            <div className="ms-track"><TrackMap trackId={next.trackId} height={150} zones /></div>
            <div className="row wrap small dim" style={{ gap: 12 }}><TrackFacts trackId={next.trackId} /></div>
            {race ? <button className="btn primary lg" data-action="go-race" onClick={() => go('race')}><Icon name="flag" size={17} />{t('ms.next.go')}</button> : <p className="tiny muted">{t('ms.next.wait', { round: ch.nextRound + 1, total: ch.rounds.length })}</p>}
          </> : <p className="dim small">{t('ms.next.newSeason')}</p>}
        </Panel>
      </div>

      <div className="kpi-band">
        <KpiTile icon="trophy" label={t('ms.kpi.teams')} value={t('ms.pos', { n: pos })} tone={pos <= 3 ? 'good' : 'neutral'} sub={t('ms.kpi.teams.sub', { pts: myPts, total: st.teams.length, gap: Math.max(0, leaderPts - myPts) })} onClick={() => goTab('season')} />
        <KpiTile icon="users" label={t('ms.kpi.drivers')} value={myBest >= 0 ? t('ms.pos', { n: myBest + 1 }) : '—'} sub={myBest >= 0 ? `${st.drivers[myBest].name} · ${ch.driverPoints[st.drivers[myBest].id] ?? 0}` : t('ms.kpi.drivers.none')} onClick={() => goTab('season')} />
        <KpiTile icon="cash" label={t('ms.kpi.balance')} value={m$(b.balance)} tone={b.balance < 0 ? 'bad' : 'good'} sub={t('ms.kpi.balance.sub')} title={t('ms.budget.note')} />
        <KpiTile icon="finance" label={t('ms.kpi.cost')} value={m$(div.seasonCost)} sub={t(g.mode === 'motorsport' ? 'ms.kpi.cost.team' : 'ms.kpi.cost.parent', { income: m$(div.seasonIncome) })} />
        <KpiTile icon="wrench" label={t('ms.kpi.dev')} value={`${Math.round(devAvg * 100)}%`} sub={t('ms.kpi.dev.sub', { v: m$(div.devBudget) })} />
        <KpiTile icon="flag" label={t('ms.kpi.rounds')} value={`${Math.min(ch.nextRound, ch.rounds.length)} / ${ch.rounds.length}`} sub={next ? t('ms.kpi.rounds.next', { month: monthShort(next.month, lang) }) : t('ms.next.done')} onClick={() => goTab('season')} />
      </div>

      <div className="ms-grid2">
        <Panel eyebrow={t('ms.lineup')} title={t('ms.lineup.title', { n: mine.length, seats })} action={<button className="linkbtn" onClick={() => goTab('team')}>{t('ms.lineup.manage')}<Icon name="chevron" size={13} /></button>}>
          {mine.length === 0 ? <EmptyState icon="users" title={t('ms.lineup.none')}>{t('ms.lineup.noneBody')}</EmptyState> : (
            <div className="driver-cards">
              {mine.map((d, i) => (
                <article key={d.id} className="driver-card">
                  <header><span className="dc-num">#{Math.floor(i / regs.driversPerCar) + 1}</span><div className="dc-id"><b>{d.name}</b><span className="tiny muted">{d.nat} · {t('ms.age', { n: d.age })}{d.wins ? ` · ${t('ms.wins', { n: d.wins })}` : ''}</span></div><span className="dc-ovr display" title={t('ms.rating')}>{Math.round(effectiveOverall(d, ch.discipline))}</span></header>
                  <div className="dc-bars">
                    {([['pace', d.pace], ['consistency', d.consistency], ['racecraft', d.racecraft], ['wet', d.wet], ['tyre', d.tyre]] as const).map(([key, v]) => <div key={key}><span>{t(k(`ms.skill.${key}`))}</span><Meter value={v} color="var(--s1)" /><b className="num">{v}</b></div>)}
                  </div>
                  <footer className={'tiny ' + (d.contractEnd <= ch.year ? 'warn' : 'muted')}>{t('ms.contract', { year: d.contractEnd })} · {m$(d.salary)}{d.adapt ? ` · ${t('ms.adapting')}` : ''}</footer>
                </article>
              ))}
            </div>
          )}
        </Panel>
        <Panel eyebrow={t('ms.standings')} title={t(board === 'teams' ? 'ms.standings.teams' : 'ms.standings.drivers')} action={<Tabs label={t('ms.standings')} value={board} onChange={setBoard} options={[{ id: 'teams', label: t('ms.standings.tab.teams') }, { id: 'drivers', label: t('ms.standings.tab.drivers') }]} />}>
          <div className="col" style={{ gap: 7 }}>
            {board === 'teams' ? topTeams.map((x, i) => <HBar key={x.id} label={<span className={x.id === team.id ? 'me-row' : ''}>{i + 1}. {x.name}</span>} value={ch.teamPoints[x.id] ?? 0} max={maxT} color={x.id === team.id ? 'var(--accent)' : x.color} right={ch.teamPoints[x.id] ?? 0} />)
              : topDrivers.map((x, i) => <HBar key={x.id} label={<span className={x.teamId === team.id ? 'me-row' : ''}>{i + 1}. {x.name}</span>} value={ch.driverPoints[x.id] ?? 0} max={maxD} color={x.teamId === team.id ? 'var(--accent)' : 'var(--s1)'} right={ch.driverPoints[x.id] ?? 0} />)}
            {board === 'teams' && pos > 8 && <HBar label={<span className="me-row">{pos}. {team.name}</span>} value={myPts} max={maxT} color="var(--accent)" right={myPts} />}
          </div>
        </Panel>
      </div>

      <div className="ms-grid2">
        <Panel eyebrow={t('ms.budget')} title={t('ms.budget.title')}>
          <StackBar parts={costParts} fmt={m$} />
          <ul className="legend-grid">{costParts.map((x) => <li key={x.label}><i className="swatch" style={{ background: x.color }} /><span>{x.label}</span><b className="num">{m$(x.value)}</b></li>)}</ul>
          <div className="col" style={{ gap: 2, marginTop: 8 }}>
            <StatLine label={<b>{t('ms.budget.total')}</b>} value={<b>{m$(b.cost)}</b>} />
            <StatLine label={t('ms.budget.sponsors')} value={m$(b.sponsors)} />
            <StatLine label={t(g.mode === 'motorsport' ? 'ms.budget.owner' : 'ms.budget.parent')} value={g.mode === 'motorsport' ? m$(b.owner) : t('ms.budget.covers')} />
            <StatLine label={t('ms.budget.prize', { pos: b.prizePos })} value={m$(b.prize)} />
            <StatLine label={t('ms.budget.balance')} value={<span className={b.balance < 0 ? 'bad' : 'good'}>{m$(b.balance)}</span>} />
            <StatLine label={t('ms.budget.breakEven')} value={t('fac.perMo', { v: m$(Math.max(0, b.development + b.balance) / 12) })} title={t('ms.budget.breakEvenHint')} />
          </div>
          <p className="tiny muted" style={{ marginTop: 6 }}>{t('ms.budget.note')}</p>
          {g.mode === 'motorsport' && b.owner > 0 && net > RESERVE_ALLOWED * b.cost && <p className="tiny warn">{t('ms.budget.reserve', { v: m$(RESERVE_ALLOWED * b.cost) })}</p>}
          {g.mode === 'motorsport' && net < 0 && <p className="tiny warn">{t('ms.budget.debt', { v: m$(-net) })}</p>}
        </Panel>
        <Panel eyebrow={t('ms.dev')} title={t('ms.dev.title')}>
          <div className="col" style={{ gap: 9 }}>
            {DEV_KEYS.map((key) => <div key={key} className="dev-row">
              <div className="row between small"><span>{t(k(`ms.dev.${key}`))}{regs.devScope[key] < 0.5 ? <span className="muted"> · {t('ms.dev.restricted', { pct: Math.round(regs.devScope[key] * 100) })}</span> : null}</span><b className="num">{Math.round(team.dev[key] * 100)}%</b></div>
              <Meter value={team.dev[key] * 100} color="var(--accent)" />
              <input type="range" min={0} max={3} step={0.25} value={div.devFocus[key]} aria-label={t('ms.dev.focus', { area: t(k(`ms.dev.${key}`)) })} title={t('ms.dev.focus', { area: t(k(`ms.dev.${key}`)) })} onChange={(e) => act((gg) => setDevFocus(gg, { ...div.devFocus, [key]: Number(e.target.value) }))} />
            </div>)}
            <Slider label={t('ms.dev.budget')} value={div.devBudget} min={0} max={Math.max((B * 0.6) / 12, div.devBudget)} step={B / 1200} onChange={(v) => act((gg) => setDevBudget(gg, v))} fmt={(v) => t('ms.dev.budgetFmt', { m: m$(v), y: m$(v * 12) })} />
            <p className="tiny muted">{t('ms.dev.note')}</p>
          </div>
        </Panel>
      </div>

      <Panel eyebrow={t('ms.cal')} title={t('ms.cal.title', { year: ch.year })} action={<button className="linkbtn" onClick={() => goTab('season')}>{t('ms.cal.results')}<Icon name="chevron" size={13} /></button>}>
        <ol className="cal-strip">
          {ch.rounds.map((r, i) => { const res = ch.results.find((x) => x.round === i); const our = res?.results.filter((x) => x.teamId === team.id).sort((a, c) => a.pos - c.pos)[0]; const state = i === ch.nextRound ? 'next' : r.done ? 'done' : 'todo'; return (
            <li key={i} className={state}>
              <span className="cs-month">{monthShort(r.month, lang)}</span>
              <b>{r.name}</b>
              <span className="tiny muted">{TRACK[r.trackId].name}</span>
              <span className="cs-res">{our ? (our.status === 'dnf' ? t('ms.cal.dnf') : t('ms.pos', { n: our.pos })) : state === 'next' ? t('ms.cal.next') : r.done ? '—' : ''}</span>
            </li>); })}
        </ol>
      </Panel>

      <div className="ms-grid2">
        <Panel eyebrow={t('ms.obj')} title={t('ms.obj.title')}>
          {div.objective ? <StatLine label={div.objective.text} value={div.objective.done ? <span className="good">{t('ms.obj.done')}</span> : t('ms.obj.by', { year: div.objective.byYear })} /> : <p className="muted small">{t('ms.obj.none')}</p>}
          {p.board && <div style={{ marginTop: 8 }}><div className="row between small"><span>{t(g.mode === 'motorsport' ? 'top.owner' : 'top.board')}</span><b>{Math.round(p.board.confidence)}%</b></div><Meter value={p.board.confidence} color={p.board.confidence < 25 ? 'var(--bad)' : p.board.confidence < 45 ? 'var(--warn)' : 'var(--good)'} /></div>}
          <h4 style={{ marginTop: 14 }}>{t('ms.sponsors')} <span className="muted tiny">({t('ms.fictional')})</span></h4>
          {div.sponsors.length ? <div className="col" style={{ gap: 6, marginTop: 6 }}>{div.sponsors.map((s) => <HBar key={s.name} label={s.name} value={s.annual} max={Math.max(...div.sponsors.map((x) => x.annual))} color="var(--s3)" right={m$(s.annual)} />)}</div> : <p className="muted small">{t('ms.sponsors.none')}</p>}
        </Panel>
        <Panel eyebrow={t('ms.honours')} title={t('ms.honours.title')}>
          {div.history.length === 0 ? <p className="muted small">{t('ms.honours.none')}</p> : (
            <table><thead><tr><th>{t('ms.honours.year')}</th><th>{t('ms.honours.team')}</th><th>{t('ms.honours.champTeam')}</th><th>{t('ms.honours.champDriver')}</th></tr></thead>
              <tbody>{[...div.history].reverse().map((h) => <tr key={h.year}><td>{h.year}</td><td>{t('ms.pos', { n: h.playerTeamPos })} · {h.playerPoints}</td><td>{h.teamChampion}</td><td>{h.driverChampion}</td></tr>)}</tbody></table>
          )}
        </Panel>
      </div>
    </>
  );
}

function TrackFacts({ trackId }: { trackId: string }) {
  const { t } = useT();
  const track = TRACK[trackId];
  return <>
    <span>{t('ms.track.overtaking')}: {t(track.overtake > 1.1 ? 'ms.track.easy' : track.overtake > 0.8 ? 'ms.track.average' : 'ms.track.hard')}</span>
    <span>{t('ms.track.wear')}: {t(track.abrasion > 1.1 ? 'ms.track.high' : track.abrasion > 0.9 ? 'ms.track.medium' : 'ms.track.low')}</span>
    <span>{t('ms.track.rain', { pct: Math.round(track.rain * 100) })}</span>
  </>;
}

// ------------------------------------------------------------------------------------------------ car design
const RACE_LAYOUTS: EngineLayout[] = ['I4', 'I6', 'V6', 'V8', 'V10', 'V12', 'F6', 'F12'];
function CarDesign({ p, div }: { p: Company; div: MotorsportDivision }) {
  const { g } = useGame();
  const { t, lang } = useT();
  const term = useTerm();
  const act = useStore((s) => s.act), ask = useStore((s) => s.ask);
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
  const kinds = redesignKinds(team.car, spec), cost = redesignCost(g, p, team.car, spec), b = seasonBudget(g, p, div);
  const m$ = (v: number) => money(v, lang);
  const commit = () => { const go = () => { act((gg) => redesignRaceCar(gg, spec), t('ms.car.committed')); }; if (kinds.engineNew || kinds.chassisNew || cost > p.cash) ask(t('ms.car.confirm', { cost: m$(cost) }) + (kinds.engineNew ? ` ${t('ms.car.kind.engineNew')}` : '') + (kinds.chassisNew ? ` ${t('ms.car.kind.chassisNew')}` : '') + (cost > p.cash ? ` ${t('ms.car.borrow')}` : ''), go); else go(); };
  return (
    <div className="studio-grid ms-design">
      <aside className="studio-left"><div className="panel studio-form">
        <fieldset className="form-group first"><legend><Icon name="bolt" size={15} />{t('ms.car.powerUnit')}</legend>
          <p className="tiny muted"><Src k="h" /> {regs.note}</p>
          <Select label={t('st.eng.layout')} value={e.layout} options={RACE_LAYOUTS.map((l) => ({ value: l, label: term(LAYOUT_NAME[l]), disabled: (regs.cylinders ? !regs.cylinders.includes(CYL[l]) : false) || (regs.layouts ? !regs.layouts.includes(l) : false) }))} onChange={(v) => upE({ layout: v })} />
          <Select label={t('st.eng.aspiration')} value={e.aspiration} options={[{ value: 'na', label: t('st.eng.na'), disabled: regs.maxDispNA <= 0 }, { value: 'turbo', label: t('st.eng.turbo'), disabled: regs.maxDispForced <= 0 }, { value: 'twinturbo', label: t('st.eng.twinturbo'), disabled: regs.maxDispForced <= 0 }, { value: 'supercharged', label: t('st.eng.supercharged'), disabled: regs.maxDispForced <= 0 }]} onChange={(v) => upE({ aspiration: v })} />
          <Slider label={t('ms.car.displacement', { limit: limit || '—' })} value={e.displacement} min={600} max={Math.max(limit || 3000, 1000)} step={1} onChange={(v) => upE({ displacement: v })} fmt={(v) => `${v} cc`} />
          {forced && <Slider label={t('ms.car.boost', { limit: regs.maxBoost.toFixed(1) })} value={e.boost} min={0.2} max={Math.max(regs.maxBoost, 0.3)} step={0.05} onChange={(v) => upE({ boost: v })} fmt={(v) => `${v.toFixed(2)} bar`} />}
          <Slider label={t('st.eng.compression')} value={e.compression} min={6} max={15} step={0.1} onChange={(v) => upE({ compression: v })} fmt={(v) => t('st.eng.compressionFmt', { cr: v.toFixed(1), margin: perf.engine.knockMargin.toFixed(1) })} />
          <Slider label={t('st.eng.boreStroke')} value={e.boreStroke} min={0.8} max={2.6} step={0.01} onChange={(v) => upE({ boreStroke: v })} fmt={(v) => `${v.toFixed(2)} · ${(perf.engine.bore * 1000).toFixed(0)} × ${(perf.engine.stroke * 1000).toFixed(0)} mm`} />
          <Slider label={t('st.eng.redline')} value={e.redline} min={5000} max={20000} step={250} onChange={(v) => upE({ redline: v })} fmt={(v) => t('ms.car.redlineFmt', { rpm: v, v: perf.engine.pistonSpeed.toFixed(1), lim: perf.engine.pistonSpeedLimit.toFixed(1), valves: Math.round(perf.engine.valveLimitRpm / 100) * 100 })} />
          <button className="btn sm" onClick={() => upE({ redline: tuneRedline(e, regs, techYear, quality) })}>{t('ms.car.bestRedline')}</button>
          <Select label={t('st.eng.valvetrain')} value={e.valvetrain} options={[{ value: 'ohv', label: t('st.eng.ohv') }, { value: 'sohc', label: t('st.eng.sohc') }, { value: 'dohc2', label: t('st.eng.dohc2') }, { value: 'dohc4', label: t('st.eng.dohc4') }]} onChange={(v) => upE({ valvetrain: v })} />
        </fieldset>
        <fieldset className="form-group"><legend><Icon name="box" size={15} />{t('ms.car.chassis')}</legend>
          <Slider label={t('ms.car.aero')} value={spec.aeroBias} min={0} max={1} step={0.01} onChange={(v) => up({ aeroBias: v })} fmt={(v) => t(v < 0.35 ? 'ms.car.aero.low' : v < 0.65 ? 'ms.car.aero.mid' : 'ms.car.aero.high')} hint={t('ms.car.aeroHint')} />
          <Slider label={t('ms.car.weight')} value={spec.weightEffort} min={0} max={1} step={0.01} onChange={(v) => up({ weightEffort: v })} fmt={(v) => t('ms.car.weightFmt', { pct: Math.round(v * 100), kg: Math.round(perf.mass - 75), min: Math.round(regs.minWeight) })} hint={t('ms.car.weightHint')} />
          <Slider label={t('ms.car.cooling')} value={spec.cooling} min={0} max={1} step={0.01} onChange={(v) => up({ cooling: v })} fmt={(v) => t(v < 0.35 ? 'ms.car.cooling.tight' : v < 0.65 ? 'ms.car.cooling.normal' : 'ms.car.cooling.generous')} />
          <Slider label={t('ms.car.stiffness')} value={spec.stiffness} min={0} max={1} step={0.01} onChange={(v) => up({ stiffness: v })} fmt={(v) => t(v < 0.35 ? 'ms.car.stiff.soft' : v < 0.65 ? 'ms.car.stiff.medium' : 'ms.car.stiff.stiff')} />
          <div className="row"><label className="field"><span className="lab"><span>{t('ms.car.colour1')}</span></span><input type="color" value={spec.color} onChange={(x) => up({ color: x.target.value })} /></label><label className="field"><span className="lab"><span>{t('ms.car.colour2')}</span></span><input type="color" value={spec.color2} onChange={(x) => up({ color2: x.target.value })} /></label></div>
        </fieldset>
      </div></aside>
      <section className="studio-center">
        <div className="viewer" style={{ height: 'clamp(320px, 46vh, 520px)' }}><Guard3D poster={<CarPoster kind={posterForDiscipline(div.discipline)} color={spec.color} className="poster-hero" />}><RaceCarViewer discipline={div.discipline} year={ch.year} color={spec.color} color2={spec.color2} wing={spec.aeroBias} /></Guard3D><div className="overlay">{regs.className} · {t('ms.car.bodyNote')}</div><div className="hint">{t('ms.car.dragHint')}</div></div>
        {perf.legal.length > 0 && <div className="errbox">{perf.legal.map((x) => <div key={x}>✗ {x}</div>)}</div>}
        {perf.engine.warnings.length > 0 && <div className="warnbox">{perf.engine.warnings.map((x) => <div key={x}>• {x}</div>)}</div>}
        <Panel eyebrow={t('st.analysis')} title={t('st.analysis.curves.title')}><div className="grid g2">
          <div><h4>{t('st.torqueNm')}</h4><LineChart height={180} width={350} series={[{ name: t('st.torque'), color: '#6ea8f0', values: curve.map((c) => c.nm) }]} labels={curve.map((c) => String(c.rpm))} xTitle="rpm" /></div>
          <div><h4>{t('st.powerKw')}</h4><LineChart height={180} width={350} series={[{ name: t('st.power'), color: '#dd8c55', values: curve.map((c) => c.kw) }]} labels={curve.map((c) => String(c.rpm))} xTitle="rpm" /></div>
        </div></Panel>
      </section>
      <aside className="studio-right">
        <Panel eyebrow={t('st.perf')} title={t('ms.car.predicted')}>
          <div className="col" style={{ gap: 2 }}>
            <StatLine label={t('ms.car.power')} value={<>{Math.round(perf.powerKw)} kW{perf.capped ? <span className="muted"> ({t('ms.car.capped')})</span> : null} <Delta a={perf.powerKw} b={cur.powerKw} unit="kW" /></>} />
            <StatLine label={t('ms.car.mass')} value={<>{Math.round(perf.mass)} kg <Delta a={perf.mass} b={cur.mass} unit="kg" inv /></>} />
            <StatLine label={t('ms.car.cla')} value={`${perf.clA.toFixed(2)} m²`} /><StatLine label={t('st.aero.cda')} value={`${perf.cdA.toFixed(2)} m²`} />
            <StatLine label={t('ms.car.grip')} value={perf.mu.toFixed(2)} /><StatLine label={t('ms.car.wear')} value={t('ms.car.wearFmt', { pct: Math.round(perf.tyreWear * 100) })} />
            <StatLine label={t('ms.car.finish')} value={<>{Math.round(perf.reliability * 100)}% <Delta a={perf.reliability * 100} b={cur.reliability * 100} unit="pts" /></>} />
            <StatLine label={t('ms.car.fuel')} value={`${(perf.fuelKgPerKwh * 1000).toFixed(0)} g`} />
          </div>
        </Panel>
        <Panel eyebrow={t('ms.car.laps')} title={t('ms.car.laps.title')}>
          <div className="col" style={{ gap: 2 }}>{laps.map((l) => <StatLine key={l.id} label={TRACK[l.id].name} value={<>{fmtTime(l.a.time)} <Delta a={l.a.time} b={l.b.time} unit="s" inv digits={2} /> <span className="muted">· {Math.round(l.a.vMax * 3.6)} km/h</span></>} />)}</div>
          <p className="tiny muted" style={{ marginTop: 6 }}>{t('ms.car.laps.note')}</p>
        </Panel>
        <Panel eyebrow={t('ms.car.commit')} title={t('ms.car.commit.title')}>
          <div className="col" style={{ gap: 6 }}>
            <StatLine label={t('ms.car.cost')} value={<b>{m$(cost)}</b>} title={t('ms.car.costHint')} />
            <StatLine label={t('ms.car.share')} value={`${Math.round((cost / Math.max(1, b.cost)) * 100)}%`} />
            <p className="small dim">{kinds.engineNew ? `${t('ms.car.kind.engineNew')} ` : kinds.engineTune ? `${t('ms.car.kind.engineTune')} ` : ''}{kinds.chassisNew ? `${t('ms.car.kind.chassisNew')} ` : ''}{!kinds.engineNew && !kinds.chassisNew && !kinds.engineTune ? t('ms.car.kind.tune') : ''}{cost > p.cash ? ` ${t('ms.car.borrow')}` : ''}</p>
            <div className="row"><button className="btn" disabled={!changed} onClick={() => setSpec(JSON.parse(JSON.stringify(team.car)))}>{t('ms.car.revert')}</button>
              <button className="btn primary" data-action="build-race-car" disabled={!changed || perf.legal.length > 0} onClick={commit}>{t('ms.car.build')}</button></div>
          </div>
        </Panel>
      </aside>
    </div>
  );
}
function Delta({ a, b, unit, inv, digits = 0 }: { a: number; b: number; unit: string; inv?: boolean; digits?: number }) {
  const d = a - b; if (Math.abs(d) < Math.pow(10, -digits) * 0.5) return null;
  const good = inv ? d < 0 : d > 0;
  return <span className={'small ' + (good ? 'good' : 'bad')}>({d > 0 ? '+' : ''}{d.toFixed(digits)} {unit})</span>;
}

// ------------------------------------------------------------------------------------------------ drivers and staff
function Team({ p, div }: { p: Company; div: MotorsportDivision }) {
  const { g } = useGame();
  const { t, lang } = useT();
  const term = useTerm();
  const act = useStore((s) => s.act), ask = useStore((s) => s.ask);
  const ch = div.championship, team = playerTeam(div), regs = teamRegs(team, ch.year);
  const seats = regs.carsPerTeam * regs.driversPerCar;
  const mine = team.drivers.map((id) => ch.drivers.find((d) => d.id === id)!).filter(Boolean);
  const m$ = (v: number) => money(v, lang);
  const FAC: (keyof MotorsportDivision['facilities'])[] = ['windTunnel', 'simulator', 'workshop', 'engineShop'];
  const STAFF: (keyof MotorsportDivision['staff'])[] = ['technical', 'aero', 'raceOps', 'strategy'];
  return (
    <>
      <Panel eyebrow={t('ms.lineup')} title={t('ms.team.drivers')} action={<span className="small muted">{t('ms.team.seats', { n: mine.length, seats })} · {regs.driversPerCar > 1 ? t('ms.team.share', { n: regs.driversPerCar }) : t('ms.team.single')}</span>}>
        <div className="tablewrap"><table><thead><tr><th>{t('ms.team.car')}</th><th>{t('ms.team.driver')}</th><th className="r">{t('ms.team.age')}</th><th className="r">{t('ms.skill.pace')}</th><th className="r">{t('ms.skill.consistency')}</th><th className="r">{t('ms.skill.racecraft')}</th><th className="r">{t('ms.skill.wet')}</th><th className="r">{t('ms.skill.tyre')}</th><th className="r">{t('ms.team.salary')}</th><th>{t('ms.team.contract')}</th><th>{t('ms.team.category')}</th><th /></tr></thead><tbody>
          {mine.map((d, i) => <tr key={d.id}><td>#{Math.floor(i / regs.driversPerCar) + 1}</td><td><b>{d.name}</b> <span className="muted tiny">{d.nat}{d.wins ? ` · ${t('ms.wins', { n: d.wins })}` : ''}</span></td><td className="r">{d.age}</td><td className="r">{d.pace}</td><td className="r">{d.consistency}</td><td className="r">{d.racecraft}</td><td className="r">{d.wet}</td><td className="r">{d.tyre}</td><td className="r">{m$(d.salary)}</td><td className={d.contractEnd <= ch.year ? 'warn' : ''}>{t('ms.contract', { year: d.contractEnd })}{d.backing ? <div className="tiny good">{t('ms.team.brings', { v: m$(d.backing) })}</div> : null}</td>
            <td className="small">{specialtyOf(d, ch.discipline) === GROUP[ch.discipline] ? t('ms.team.specialist') : <span className="warn">{t('ms.team.from', { group: term(GROUP_NAME[specialtyOf(d, ch.discipline)]) })}{d.adapt ? ` · ${t('ms.team.adapting', { n: 3 * d.adapt })}` : ''}</span>}{potentialOf(d) > d.pace + 1 ? <div className="tiny muted">{t('ms.team.potential', { n: Math.round(potentialOverall(d)) })}</div> : null}</td>
            <td className="r" style={{ whiteSpace: 'nowrap' }}>{i > 0 && <button className="btn sm ghost" title={t('ms.team.moveUp')} aria-label={t('ms.team.moveUp')} onClick={() => act((gg) => swapDriverOrder(gg, i, i - 1))}>↑</button>} <button className="btn sm" title={t('ms.team.extendHint')} onClick={() => act((gg) => signDriver(gg, d.id, d.contractEnd - ch.year + 2), t('ms.team.extended'))}>{t('ms.team.extend')}</button> <button className="btn sm danger" onClick={() => ask(t('ms.team.confirmRelease', { name: d.name, v: m$(d.salary * 0.3 * Math.max(1, d.contractEnd - ch.year + 1)) }), () => { act((gg) => releaseDriver(gg, d.id)); })}>{t('ms.team.release')}</button></td></tr>)}
          {mine.length === 0 && <tr><td colSpan={12} className="muted">{t('ms.lineup.noneBody')}</td></tr>}
        </tbody></table></div>
      </Panel>
      <DriverMarket div={div} />
      <div className="ms-grid2">
        <Panel eyebrow={t('ms.fac')} title={t('ms.fac.title')}>
          <ul className="level-list">{FAC.map((key) => <li key={key}><div><b>{t(k(`ms.fac.${key}`))}</b><span className="tiny muted">{t(k(`ms.fac.${key}.hint`))}</span><span className="pips" aria-label={t('ms.fac.level', { n: div.facilities[key] })}>{[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= div.facilities[key] ? 'on' : ''} />)}</span></div>
            <button className="btn sm" disabled={div.facilities[key] >= 5} onClick={() => act((gg) => upgradeFacility(gg, key), t('ms.fac.upgraded'))}>{div.facilities[key] >= 5 ? t('ms.fac.max') : t('ms.fac.upgrade', { cost: m$(facilityCost(g, p, div.facilities[key])) })}</button></li>)}</ul>
        </Panel>
        <Panel eyebrow={t('ms.staff')} title={t('ms.staff.title')}>
          <ul className="level-list">{STAFF.map((key) => <li key={key}><div><b>{t(k(`ms.staff.${key}`))}</b><span className="tiny muted">{t(k(`ms.staff.${key}.hint`))}</span><span className="row" style={{ gap: 8 }}><Meter value={div.staff[key]} color="var(--s1)" /><b className="num small">{div.staff[key]}</b></span></div>
            <button className="btn sm" disabled={div.staff[key] >= 97} onClick={() => act((gg) => recruitStaff(gg, key), t('ms.staff.recruited'))}>{t('ms.staff.recruit', { cost: m$(staffCost(g, p, div.staff[key])) })}</button></li>)}</ul>
          <p className="tiny muted">{t('ms.staff.note')}</p>
        </Panel>
      </div>
    </>
  );
}

/** Free agents and rivals' drivers with their terms, negotiation, and the junior academy. */
function DriverMarket({ div }: { div: MotorsportDivision }) {
  const { g } = useGame();
  const { t, lang } = useT();
  const term = useTerm();
  const act = useStore((s) => s.act);
  const ch = div.championship, team = playerTeam(div), regs = teamRegs(team, ch.year);
  const B = budgetRef(regs, g.year);
  const seats = regs.carsPerTeam * regs.driversPerCar;
  const [view, setView] = useState<'free' | 'contracted'>('free');
  const [deal, setDeal] = useState<string | null>(null);
  const list = ch.drivers.filter((d) => (view === 'free' ? !d.teamId : d.teamId && d.teamId !== team.id)).sort((a, b) => overall(b) - overall(a)).slice(0, 40);
  const teamName = (id: string | null) => ch.teams.find((x) => x.id === id)?.name ?? '—';
  const a = div.academy;
  const m$ = (v: number) => money(v, lang);
  return (
    <div className="ms-grid2 wide-left">
      <Panel eyebrow={t('ms.market')} title={<>{t('ms.market.title')} <span className="muted small">({t('ms.market.fictional')})</span></>} action={<Tabs label={t('ms.market.title')} value={view} onChange={setView} options={[{ id: 'free', label: t('ms.market.free') }, { id: 'contracted', label: t('ms.market.contracted') }]} />}>
        <p className="tiny muted">{t('ms.market.note')}</p>
        <div className="tablewrap" style={{ maxHeight: 380 }}><table><thead><tr><th>{t('ms.team.driver')}</th>{view === 'contracted' && <th>{t('ms.market.team')}</th>}<th className="r">{t('ms.team.age')}</th><th className="r">{t('ms.rating')}</th><th className="r">{t('ms.market.potential')}</th><th>{t('ms.team.category')}</th><th className="r">{t('ms.market.ask')}</th><th className="r">{view === 'contracted' ? t('ms.market.fee') : t('ms.market.brings')}</th><th className="r">{t('ms.market.interest')}</th><th /></tr></thead><tbody>
          {list.map((d) => { const terms = driverTerms(g, d.id)!; return (
            <tr key={d.id}><td>{d.name} <span className="muted tiny">{d.nat}</span></td>{view === 'contracted' && <td className="small">{teamName(d.teamId)}</td>}<td className="r">{d.age}</td>
              <td className="r">{Math.round(overall(d))}{d.adapt ? <span className="tiny warn"> ({t('ms.market.now', { n: Math.round(effectiveOverall(d, ch.discipline)) })})</span> : null}</td><td className="r">{Math.round(potentialOverall(d))}</td>
              <td className="small">{specialtyOf(d, ch.discipline) === GROUP[ch.discipline] ? '—' : term(GROUP_NAME[specialtyOf(d, ch.discipline)])}</td>
              <td className="r">{m$(terms.ask)}</td><td className="r">{view === 'contracted' ? m$(terms.fee) : terms.backing ? <span className="good">{m$(terms.backing)}</span> : '—'}</td>
              <td className="r">{terms.rivals ? <span className="warn">{t('ms.market.rivals', { n: terms.rivals })}</span> : '—'}</td>
              <td className="r"><button className="btn sm" data-action="negotiate" onClick={() => setDeal(d.id)}>{t('ms.market.negotiate')}</button></td></tr>); })}
        </tbody></table></div>
        {deal && <NegotiationModal driverId={deal} seats={seats} onClose={() => setDeal(null)} />}
      </Panel>
      <Panel eyebrow={t('ms.academy')} title={t('ms.academy.title')}>
        <Select label={t('ms.academy.level')} value={a?.level ?? 0} onChange={(v) => act((gg) => setAcademy(gg, v))} options={[0, 1, 2, 3].map((l) => ({ value: l, label: l ? t('ms.academy.levelFmt', { l, cost: m$(B * ACADEMY_COST[l]) }) + (l > (a?.level ?? 0) ? ` · ${t('ms.academy.setup', { cost: m$(B * 0.03 * (l - (a?.level ?? 0))) })}` : '') : t('st.none') }))} />
        <p className="tiny muted">{t('ms.academy.note')}</p>
        {a && a.juniors.length > 0 ? <table><thead><tr><th>{t('ms.academy.junior')}</th><th className="r">{t('ms.team.age')}</th><th className="r">{t('ms.skill.pace')}</th><th className="r">{t('ms.academy.potential')}</th><th /></tr></thead><tbody>
          {a.juniors.map((j) => <tr key={j.id}><td>{j.name}</td><td className="r">{j.age}</td><td className="r">{j.pace}</td><td className="r">{Math.round(potentialOf(j))}</td>
            <td className="r"><button className="btn sm" disabled={j.age < 17 || team.drivers.length >= seats} title={j.age < 17 ? t('ms.academy.young') : team.drivers.length >= seats ? t('ms.academy.full') : ''} onClick={() => act((gg) => promoteJunior(gg, j.id), t('ms.academy.promoted', { name: j.name }))}>{t('ms.academy.promote')}</button></td></tr>)}
        </tbody></table> : <p className="small muted">{a?.level ? t('ms.academy.first') : t('ms.academy.none')}</p>}
      </Panel>
    </div>
  );
}

function NegotiationModal({ driverId, seats, onClose }: { driverId: string; seats: number; onClose: () => void }) {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const act = useStore((s) => s.act);
  const div = p.motorsport!; const ch = div.championship, team = playerTeam(div);
  const d = ch.drivers.find((x) => x.id === driverId)!;
  const terms = driverTerms(g, driverId)!;
  const [offer, setOffer] = useState(Math.round(terms.ask));
  const [years, setYears] = useState(2);
  const full = team.drivers.length >= seats;
  const [replace, setReplace] = useState(full ? team.drivers[team.drivers.length - 1] : '');
  const run = (gg: GameState) => signDriver(gg, d.id, years, full ? replace : undefined, offer);
  const m$ = (v: number) => money(v, lang);
  return (
    <Modal onClose={onClose}>
      <span className="eyebrow">{t('ms.market.title')}</span><h2>{t('ms.deal.title', { name: d.name })}</h2>
      <StatLine label={t('ms.deal.rating')} value={t('ms.deal.ratingFmt', { now: Math.round(effectiveOverall(d, ch.discipline)), full: Math.round(overall(d)), pot: Math.round(potentialOverall(d)), age: d.age })} />
      <StatLine label={t('ms.deal.ask')} value={<b>{t('ms.deal.perYear', { v: m$(terms.ask) })}</b>} title={t('ms.deal.askHint', { pct: Math.round(terms.attractiveness * 100), n: terms.rivals })} />
      {terms.fee > 0 && <StatLine label={t('ms.deal.fee')} value={m$(terms.fee)} />}
      {terms.backing > 0 && <StatLine label={t('ms.deal.backing')} value={<span className="good">{t('ms.deal.perYear', { v: m$(terms.backing) })}</span>} />}
      <Slider label={t('ms.deal.offer')} value={offer} min={Math.round(terms.ask * 0.6)} max={Math.round(terms.ask * 1.6)} step={Math.max(1000, Math.round(terms.ask / 100))} onChange={setOffer} fmt={(v) => t('ms.deal.perYear', { v: m$(v) }) + (v < terms.ask - 1 ? ` — ${t('ms.deal.refused')}` : '')} />
      <Slider label={t('ms.deal.term')} value={years} min={1} max={4} onChange={setYears} fmt={(v) => t(v === 1 ? 'ms.deal.year' : 'ms.deal.years', { n: v })} />
      {full && <Select label={t('ms.deal.replacing')} value={replace} onChange={setReplace} options={team.drivers.map((id) => { const x = ch.drivers.find((y) => y.id === id)!; return { value: id, label: t('ms.deal.replaceFmt', { name: x.name, v: m$(x.salary * 0.3 * Math.max(1, x.contractEnd - ch.year + 1)) }) }; })} />}
      <ImpactPreview deps={[d.id, offer, years, replace]} horizon={12} run={run} />
      <div className="row end"><button className="btn" onClick={onClose}>{t('confirm.cancel')}</button><button className="btn primary" data-action="sign-driver" disabled={offer < terms.ask - 1} onClick={() => { if (act(run, t('ms.deal.signed', { name: d.name }))) onClose(); }}>{t('ms.deal.sign')}</button></div>
    </Modal>
  );
}

// ------------------------------------------------------------------------------------------------ season
function Season({ div }: { div: MotorsportDivision }) {
  const { t, lang } = useT();
  const term = useTerm();
  const ch = div.championship;
  const st = standings(ch);
  const [sel, setSel] = useState(Math.min(ch.nextRound, ch.rounds.length - 1));
  const round = ch.rounds[sel];
  const res = ch.results.find((r) => r.round === sel);
  const regs = getRegs(ch.discipline, ch.year);
  const track = TRACK[round.trackId];
  const maxT = Math.max(1, ...st.teams.map((x) => ch.teamPoints[x.id] ?? 0));
  return (
    <>
      <div className="ms-grid2 wide-left">
        <Panel eyebrow={t('ms.cal')} title={t('ms.cal.title', { year: ch.year })}>
          <div className="tablewrap"><table><thead><tr><th>#</th><th>{t('ms.season.event')}</th><th>{t('ms.season.circuit')}</th><th>{t('ms.season.month')}</th><th>{t('ms.season.distance')}</th><th>{t('ms.season.winner')}</th></tr></thead><tbody>
            {ch.rounds.map((r, i) => { const rr = ch.results.find((x) => x.round === i); const w = rr?.results[0]; return (
              <tr key={i} className={'click' + (i === sel ? ' me' : '')} onClick={() => setSel(i)}><td>{i + 1}</td><td>{r.name}</td><td className="dim">{TRACK[r.trackId].name}</td><td>{monthShort(r.month, lang)}</td><td>{r.hours ? `${r.hours} h` : t('ms.laps', { n: r.laps ?? 0 })}</td><td className="dim">{w ? ch.teams.find((x) => x.id === w.teamId)?.name ?? '—' : r.done ? t('ms.season.notContested') : i === ch.nextRound ? t('ms.cal.next') : ''}</td></tr>); })}
          </tbody></table></div>
          <p className="tiny muted">{t('ms.season.note', { points: regs.points.join('–') })}{regs.flPoint ? ` ${t('ms.season.fl')}` : ''} <Src k="h" /></p>
        </Panel>
        <Panel eyebrow={t('ms.season.circuit')} title={track.name} action={<span className="muted small">{track.country} · {track.km.toFixed(2)} km</span>}>
          <TrackMap trackId={round.trackId} height={220} zones />
          <div className="row wrap small dim" style={{ gap: 14 }}><TrackFacts trackId={round.trackId} /><span className="good">— {t('ms.track.zones')}</span></div>
        </Panel>
      </div>
      {res && <Panel eyebrow={t('ms.season.classification')} title={res.name} action={<span className="muted small">{res.weather}</span>}>
        <div className="tablewrap"><table><thead><tr><th>{t('ms.season.pos')}</th><th>{t('ms.team.driver')}</th><th>{t('ms.market.team')}</th><th className="r">{t('ms.season.grid')}</th><th className="r">{t('ms.season.lapsCol')}</th><th className="r">{t('ms.season.stops')}</th><th className="r">{t('ms.season.best')}</th><th>{t('ms.season.status')}</th><th className="r">{t('ms.season.pts')}</th></tr></thead><tbody>
          {res.results.map((r) => { const d = ch.drivers.find((x) => x.id === r.driverId); const tm = ch.teams.find((x) => x.id === r.teamId); return <tr key={r.teamId + r.carIdx} className={r.teamId === div.teamId ? 'me' : ''}><td>{r.pos}</td><td>{d?.name ?? '—'}</td><td className="dim">{tm?.name ?? t('ms.season.withdrawn')}</td><td className="r">{r.grid}</td><td className="r">{r.laps}</td><td className="r">{r.stops}</td><td className="r">{r.bestLap ? fmtTime(r.bestLap) : '—'}</td><td className={r.status === 'dnf' ? 'bad' : 'dim'}>{r.status === 'dnf' ? `${t('ms.cal.dnf')} — ${r.reason}` : t('ms.season.finished')}</td><td className="r">{r.points || ''}</td></tr>; })}
        </tbody></table></div></Panel>}
      <div className="ms-grid2">
        <Panel eyebrow={t('ms.standings')} title={t('ms.standings.teams')}>
          <div className="col" style={{ gap: 7 }}>{st.teams.map((x, i) => <HBar key={x.id} label={<span className={x.id === div.teamId ? 'me-row' : ''}>{i + 1}. {x.name}{x.ruleset !== ch.discipline ? ` (${term(DISC_NAME[x.ruleset]).split(' ')[0]})` : ''}</span>} value={ch.teamPoints[x.id] ?? 0} max={maxT} color={x.id === div.teamId ? 'var(--accent)' : x.color} right={ch.teamPoints[x.id] ?? 0} />)}</div>
        </Panel>
        <Panel eyebrow={t('ms.standings')} title={t('ms.standings.drivers')}>
          <div className="tablewrap" style={{ maxHeight: 420 }}><table><thead><tr><th>{t('ms.season.pos')}</th><th>{t('ms.team.driver')}</th><th>{t('ms.market.team')}</th><th className="r">{t('ms.season.pts')}</th></tr></thead><tbody>{st.drivers.slice(0, 30).map((d, i) => <tr key={d.id} className={d.teamId === div.teamId ? 'me' : ''}><td>{i + 1}</td><td>{d.name}</td><td className="dim">{ch.teams.find((x) => x.id === d.teamId)?.name}</td><td className="r">{ch.driverPoints[d.id] ?? 0}</td></tr>)}</tbody></table></div>
        </Panel>
      </div>
    </>
  );
}
