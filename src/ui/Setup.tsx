import { useMemo, useState } from 'react';
import type { Difficulty, Discipline, HistoryMode } from '../sim/types';
import { useStore } from '../store/game';
import { LAST_START_YEAR, MAKERS, MAKER, makerStart, productionDataThrough } from '../data/manufacturers';
import { COUNTRIES, COUNTRY, MARKET_DATA_THROUGH, REGIONS } from '../data/world';
import { TECHS } from '../data/tech';
import { AREA_NAME, TECH_AREAS } from '../sim/company';
import {
  capitalOptions, ENGINEER_LEVELS, FACTORY_SIZES, founderCosts, MS_BUDGETS, newCeoGame, newFounderGame, newMotorsportGame, previewCompany,
  RESEARCH_LEVELS, SPECIALIZATIONS, WORKFORCE_LEVELS, type FounderSetup,
} from '../sim/world';
import { LAYOUT_NAME, defaultVehicle } from '../sim/engineering';
import { DISCIPLINES, disciplineAvailable, getRegs } from '../sim/racing/regs';
import { budgetRef } from '../sim/racing/season';
import { computeRaceCar, defaultRaceCar } from '../sim/racing/racecar';
import { useT, type MessageKey } from '../i18n';
import { useTerm } from '../i18n/terms';
import { money, num } from '../i18n/format';
import { BarList, Kpi, Seg, Select, Slider, Src, StatLine } from './common';
import { Guard3D, RaceCarViewer, RoadCarViewer } from './Lazy3D';
import { CarPoster, posterForBody, posterForDiscipline } from './ds/poster';
import { REGION_IDS } from '../data/world';

const k = (x: string) => x as MessageKey;
/** Shown whenever the chosen start year is past the last year of historical data. */
function EstimateNote({ year }: { year: number }) {
  const { t } = useT();
  if (year <= MARKET_DATA_THROUGH) return null;
  return <div className="warnbox">{t('setup.estimate', { year, through: MARKET_DATA_THROUGH })}</div>;
}
function WorldOptions(p: { diff: Difficulty; setDiff: (d: Difficulty) => void; hist: HistoryMode; setHist: (h: HistoryMode) => void }) {
  const { t } = useT();
  return (
    <>
      <div className="col" style={{ gap: 6 }}><h4>{t('setup.difficulty')}</h4><Seg value={p.diff} options={(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => ({ value: d, label: t(k(`setup.diff.${d}`)) }))} onChange={p.setDiff} /></div>
      <div className="col" style={{ gap: 6 }}><h4>{t('setup.timeline')}</h4><Seg value={p.hist} options={(['historical', 'alternative'] as HistoryMode[]).map((h) => ({ value: h, label: t(k(`setup.hist.${h}`)), title: t(k(`setup.hist.${h}.hint`)) }))} onChange={p.setHist} />
        <span className="small muted">{t(k(`setup.hist.${p.hist}.hint`))}</span></div>
    </>
  );
}

// ------------------------------------------------------------------------------------- CEO
export function CeoSetupScreen() {
  const { t, lang } = useT();
  const term = useTerm();
  const fmtMoney = (v: number, d = 1) => money(v, lang, d), fmtNum = (v: number) => num(v, lang);
  const go = useStore((s) => s.go), start = useStore((s) => s.start);
  const [makerId, setMakerId] = useState('ferrari');
  const [year, setYear] = useState(1985);
  const [diff, setDiff] = useState<Difficulty>('normal');
  const [hist, setHist] = useState<HistoryMode>('historical');
  const def = MAKER[makerId];
  const y = Math.max(year, makerStart(def));
  const { company: c, objectives, era } = useMemo(() => previewCompany(makerId, y), [makerId, y]);
  const flagship = [...c.models].sort((a, b) => b.price - a.price)[0];
  const capacity = c.factories.reduce((a, f) => a + f.capacity, 0);
  const workforce = c.factories.reduce((a, f) => a + f.capacity * 30 * (1 - 0.65 * f.automation) / 160, 0) * 4 + c.engineers;
  const revenue = c.models.reduce((a, m) => a + m.price * 0.88 * (c.baseVolume * m.volumeWeight) / c.models.reduce((s, x) => s + x.volumeWeight, 0), 0);
  const programmes = def.ms.filter(([, a, b]) => y >= a && y <= b);
  const techs = TECHS.filter((x) => c.tech[x.area] >= x.year && x.year >= y - 25).slice(-9);
  return (
    <div className="setup">
      <div className="left">
        <div className="row between"><h2>{t('menu.ceo.title')}</h2><button className="btn sm ghost" data-action="setup-back" onClick={() => go('menu')}>← {t('setup.back')}</button></div>
        <div className="col" style={{ gap: 6 }}><h4>{t('setup.ceo.maker')}</h4>
          <div className="cards">{MAKERS.map((m) => (
            <button key={m.id} className={'card' + (m.id === makerId ? ' on' : '')} onClick={() => { setMakerId(m.id); setYear(Math.max(year, makerStart(m))); }}>
              <span className="row" style={{ gap: 7 }}><i className="swatch" style={{ background: m.color }} /><b>{m.name}</b></span>
              <span className="tiny muted">{t('setup.ceo.from', { country: term(COUNTRY[m.country]?.name ?? m.country), year: makerStart(m) })}</span>
            </button>))}
          </div>
        </div>
        <Slider label={t('setup.startYear')} value={y} min={makerStart(def)} max={LAST_START_YEAR} onChange={setYear} />
        <EstimateNote year={y} />
        <WorldOptions diff={diff} setDiff={setDiff} hist={hist} setHist={setHist} />
        <button className="btn primary lg" data-action="start-game" onClick={() => start(newCeoGame({ makerId, year: y, difficulty: diff, historyMode: hist }))}>{t('setup.ceo.go', { name: def.name, year: y })}</button>
        <p className="small muted">{t('setup.ceo.world', { year: y })}</p>
      </div>
      <div className="right">
        <div className="row between wrap"><div><h1>{def.name} <span className="muted" style={{ fontWeight: 400 }}>{y}</span></h1><p className="dim">{t('setup.ceo.founded', { hq: def.hq, country: term(COUNTRY[def.country].name), year: def.founded })} <Src k="h" /></p></div></div>
        <div className="grid g2">
          <div className="panel col"><h4>{t('setup.ceo.situation')} <Src k="h" /></h4><p>{era}</p>{def.ownershipNote && <p className="small muted">{def.ownershipNote}</p>}
            <h4 style={{ marginTop: 6 }}>{t('setup.ceo.board')} <Src k="e" /></h4>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{objectives.map((o) => <li key={o.id}>{o.text}</li>)}</ul>
          </div>
          <div className="viewer" style={{ height: 250 }}>
            <Guard3D poster={<CarPoster kind={posterForBody(flagship.spec.body)} color={flagship.spec.color} />}><RoadCarViewer spec={flagship.spec} /></Guard3D>
            <div className="overlay"><b>{flagship.name}</b> · {t('setup.ceo.generated')}</div>
          </div>
        </div>
        <div className="panel grid g4">
          <Kpi label={t('setup.kpi.cash')} value={fmtMoney(c.cash)} detail={<Src k="e" />} />
          <Kpi label={t('setup.kpi.debt')} value={fmtMoney(c.debt)} detail={<Src k="e" />} />
          <Kpi label={t('setup.kpi.production')} value={fmtNum(c.baseVolume)} detail={y > productionDataThrough(def) ? <><Src k="e" /> <span className="tiny">{t('setup.ceo.held', { year: productionDataThrough(def) })}</span></> : <Src k="a" />} />
          <Kpi label={t('setup.kpi.revenue')} value={fmtMoney(revenue)} detail={<Src k="e" />} />
          <Kpi label={t('setup.kpi.capacity')} value={fmtNum(capacity)} detail={<Src k="e" />} />
          <Kpi label={t('setup.kpi.workforce')} value={fmtNum(workforce)} detail={<Src k="e" />} />
          <Kpi label={t('setup.kpi.engineers')} value={fmtNum(c.engineers)} detail={<Src k="e" />} />
          <Kpi label={t('setup.kpi.rd')} value={fmtMoney(Object.values(c.rdBudget).reduce((a, b) => a + b, 0) * 12)} detail={<Src k="e" />} />
        </div>
        <div className="grid g2">
          <div className="panel col">
            <h4>{t('setup.ceo.portfolio')} <Src k="h" /> · {t('setup.ceo.figures')} <Src k="e" /></h4>
            <div className="tablewrap" style={{ maxHeight: 300 }}><table><thead><tr><th>{t('veh.col.model')}</th><th>{t('veh.engine')}</th><th className="r">{t('veh.col.power')}</th><th className="r">0–100</th><th className="r">{t('veh.col.price')}</th></tr></thead><tbody>
              {c.models.map((m) => <tr key={m.id}><td>{m.name}</td><td className="dim">{m.spec.engine.layout === 'EV' ? t('veh.electric', { kwh: m.spec.engine.batteryKwh }) : `${term(LAYOUT_NAME[m.spec.engine.layout])} ${(m.spec.engine.displacement / 1000).toFixed(1)} L${m.spec.engine.aspiration !== 'na' ? ' T' : ''}`}</td><td className="r">{Math.round(m.stats.powerKw)} kW</td><td className="r">{m.stats.zeroTo100.toFixed(1)} s</td><td className="r">{fmtMoney(m.price)}</td></tr>)}
            </tbody></table></div>
          </div>
          <div className="col">
            <div className="panel col"><h4>{t('setup.ceo.factories')} <Src k="h" /> · {t('fac.capacity').toLowerCase()} <Src k="e" /></h4>
              {c.factories.map((f) => <StatLine key={f.id} label={<>{f.name}, {term(COUNTRY[f.country].name)} <span className="muted">· {t('fac.since', { year: f.builtYear })}</span></>} value={t('fac.perMonth', { n: fmtNum(f.capacity) })} />)}
            </div>
            <div className="panel col"><h4>{t('setup.ceo.brand')} <Src k="e" /></h4>
              <BarList items={[{ label: t('score.prestige'), value: c.prestige }, { label: t('score.reliability'), value: c.reliabilityRep, color: 'var(--s3)' }, { label: t('setup.ceo.sportiness'), value: c.sportiness, color: 'var(--s2)' }]} />
            </div>
          </div>
        </div>
        <div className="grid g3">
          <div className="panel col"><h4>{t('setup.ceo.presence')} <Src k="e" /></h4>
            <BarList items={REGION_IDS.map((r) => ({ label: term(REGIONS.find((x) => x.id === r)!.short), value: c.reach[r] }))} fmt={fmtNum} />
          </div>
          <div className="panel col"><h4>{t('setup.ceo.tech')} <Src k="e" /></h4>
            {TECH_AREAS.map((a) => <StatLine key={a} label={term(AREA_NAME[a])} value={c.tech[a].toFixed(0)} />)}
            <p className="small muted">{t('setup.ceo.mastered', { list: techs.map((x) => x.name).join(', ') || '—' })}</p>
          </div>
          <div className="panel col"><h4>{t('setup.ceo.ms')} <Src k="h" /></h4>
            {programmes.length ? programmes.map(([grp, a, b], i) => <StatLine key={i} label={t(k(`setup.ceo.ms.${grp}`))} value={`${a}–${b > 2090 ? t('setup.today') : b}`} />) : <p className="muted">{t('setup.ceo.noMs', { year: y })}</p>}
            <p className="small muted">{t('setup.ceo.msNote')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------------- Founder
export function FounderSetupScreen() {
  const { t, lang } = useT();
  const term = useTerm();
  const fmtMoney = (v: number, d = 1) => money(v, lang, d);
  const go = useStore((s) => s.go), start = useStore((s) => s.start);
  const [o, setO] = useState<FounderSetup>({ name: 'Aurelia Motors', country: 'Italy', year: 1965, capital: capitalOptions(1965)[1], specialization: 'sports', factory: 1, engineers: 1, research: 1, workforce: 0, color: '#1f5fbf', difficulty: 'normal', historyMode: 'historical' });
  const caps = capitalOptions(o.year);
  const capIdx = Math.max(0, capitalOptions(o.year).findIndex((c) => Math.abs(c - o.capital) < 1));
  const set = (patch: Partial<FounderSetup>) => setO((prev) => { const n = { ...prev, ...patch }; if (patch.year !== undefined) { const i = Math.max(0, capitalOptions(prev.year).findIndex((c) => Math.abs(c - prev.capital) < 1)); n.capital = capitalOptions(n.year)[i]; if (n.specialization === 'ev' && n.year < 2005) n.specialization = 'sports'; } return n; });
  const costs = founderCosts(o);
  const left = o.capital - costs.total;
  const car = useMemo(() => { const s = defaultVehicle(o.year, o.specialization === 'mass' ? 'hatch' : o.specialization === 'offroad' ? 'suv' : o.specialization === 'luxury' ? 'sedan' : 'coupe'); s.color = o.color; if (o.specialization === 'ev') s.engine.layout = 'EV'; return s; }, [o.year, o.specialization, o.color]);
  const maxAuto = o.year < 1972 ? 0.3 : o.year < 1992 ? 0.6 : 0.8;
  return (
    <div className="setup">
      <div className="left">
        <div className="row between"><h2>{t('menu.founder.title')}</h2><button className="btn sm ghost" data-action="setup-back" onClick={() => go('menu')}>← {t('setup.back')}</button></div>
        <label className="field"><span className="lab"><span>{t('setup.f.name')}</span></span><input type="text" value={o.name} maxLength={28} onChange={(e) => set({ name: e.target.value })} /></label>
        <div className="row"><div className="grow"><Select label={t('setup.f.country')} value={o.country} options={COUNTRIES.map((c) => ({ value: c.id, label: term(c.name) }))} onChange={(v) => set({ country: v })} /></div>
          <label className="field"><span className="lab"><span>{t('setup.f.colour')}</span></span><input type="color" value={o.color} onChange={(e) => set({ color: e.target.value })} /></label></div>
        <Slider label={t('setup.f.year')} value={o.year} min={1950} max={LAST_START_YEAR} onChange={(v) => set({ year: v })} />
        <EstimateNote year={o.year} />
        <div className="col" style={{ gap: 6 }}><h4>{t('setup.f.capital')}</h4><Seg value={capIdx} options={caps.map((c, i) => ({ value: i, label: fmtMoney(c, 0) }))} onChange={(i) => set({ capital: caps[i] })} /></div>
        <div className="col" style={{ gap: 6 }}><h4>{t('setup.f.spec')}</h4>
          <div className="cards">{SPECIALIZATIONS.map((s) => <button key={s.id} className={'card' + (o.specialization === s.id ? ' on' : '')} disabled={s.id === 'ev' && o.year < 2005} onClick={() => set({ specialization: s.id })}><b>{term(s.name)}</b><span className="tiny muted">{term(s.blurb)}</span></button>)}</div>
        </div>
        <Select label={t('setup.f.factory')} value={o.factory} options={FACTORY_SIZES.map((f, i) => ({ value: i, label: term(f.name) }))} onChange={(v) => set({ factory: v })} />
        <Select label={t('setup.f.workforce')} value={o.workforce} options={WORKFORCE_LEVELS.map((f, i) => ({ value: i, label: t('setup.f.workforceFmt', { name: term(f.name), pct: Math.round(Math.min(f.auto, maxAuto) * 100) }), disabled: f.auto > maxAuto + 0.01 }))} onChange={(v) => set({ workforce: v })} hint={t('setup.f.workforceHint')} />
        <Select label={t('setup.f.engineering')} value={o.engineers} options={ENGINEER_LEVELS.map((f, i) => ({ value: i, label: term(f.name) }))} onChange={(v) => set({ engineers: v })} />
        <Select label={t('setup.f.research')} value={o.research} options={RESEARCH_LEVELS.map((f, i) => ({ value: i, label: term(f.name) }))} onChange={(v) => set({ research: v })} />
        <WorldOptions diff={o.difficulty} setDiff={(d) => set({ difficulty: d })} hist={o.historyMode} setHist={(h) => set({ historyMode: h })} />
        <button className="btn primary lg" data-action="start-game" disabled={left < 0 || !o.name.trim()} onClick={() => start(newFounderGame(o))}>{t('setup.f.go', { name: o.name || t('setup.f.theCompany'), year: o.year })}</button>
      </div>
      <div className="right">
        <div><h1>{o.name || t('setup.f.yours')} <span className="muted" style={{ fontWeight: 400 }}>{t('setup.f.est', { year: o.year })}</span></h1><p className="dim">{term(COUNTRY[o.country].name)} · {term(SPECIALIZATIONS.find((s) => s.id === o.specialization)?.name ?? '')}</p></div>
        <div className="grid g2">
          <div className="viewer" style={{ height: 300 }}><Guard3D poster={<CarPoster kind={posterForBody(car.body)} color={car.color} />}><RoadCarViewer spec={car} /></Guard3D><div className="overlay">{t('setup.f.carNote')}</div></div>
          <div className="panel col">
            <h4>{t('setup.f.where')}</h4>
            <BarList total totalLabel={t('st.total')} fmt={(v) => fmtMoney(v)} items={[{ label: t('setup.f.cost.factory'), value: costs.factory }, { label: t('setup.f.cost.eng'), value: costs.eng, color: 'var(--s2)' }, { label: t('setup.f.cost.research'), value: costs.research, color: 'var(--s3)' }, { label: t('setup.f.cost.left'), value: Math.max(0, left), color: 'var(--s4)' }]} />
            {left < 0 && <div className="errbox">{t('setup.f.over', { v: fmtMoney(-left) })}</div>}
            {left >= 0 && left < o.capital * 0.25 && <div className="warnbox">{t('setup.f.tight')}</div>}
          </div>
        </div>
        <div className="panel col">
          <h4>{t('setup.f.next')}</h4>
          <div className="grid g4">
            <div><b>{t('setup.f.s1')}</b><p className="small dim">{t('setup.f.s1.body')}</p></div>
            <div><b>{t('setup.f.s2')}</b><p className="small dim">{t('setup.f.s2.body')}</p></div>
            <div><b>{t('setup.f.s3')}</b><p className="small dim">{t('setup.f.s3.body')}</p></div>
            <div><b>{t('setup.f.s4')}</b><p className="small dim">{t('setup.f.s4.body', { n: MAKERS.filter((m) => makerStart(m) <= o.year).length })}</p></div>
          </div>
        </div>
        <div className="panel col"><h4>{t('setup.f.world', { year: o.year })}</h4>
          <p className="dim small">{t('setup.f.rivals', { list: MAKERS.filter((m) => makerStart(m) <= o.year).map((m) => m.name).join(', ') })}</p>
          <p className="dim small">{t('setup.f.future', { list: TECHS.filter((x) => x.year > o.year + RESEARCH_LEVELS[o.research].lead).slice(0, 12).map((x) => `${x.name} (${x.year})`).join(', ') || t('st.none').toLowerCase() })}</p>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------ Motorsport
export function MotorsportSetupScreen() {
  const { t, lang } = useT();
  const term = useTerm();
  const fmtMoney = (v: number, d = 1) => money(v, lang, d);
  const go = useStore((s) => s.go), start = useStore((s) => s.start);
  const [makerId, setMakerId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('Aurora Grand Prix');
  const [discipline, setDiscipline] = useState<Discipline>('f1');
  const [year, setYear] = useState(1992);
  const [budget, setBudget] = useState(1);
  const [facilities, setFacilities] = useState(3);
  const [staff, setStaff] = useState(65);
  const [target, setTarget] = useState(5);
  const [color, setColor] = useState('#e8b04a');
  const [color2, setColor2] = useState('#15171b');
  const [diff, setDiff] = useState<Difficulty>('normal');
  const [hist, setHist] = useState<HistoryMode>('historical');
  const disc = disciplineAvailable(discipline, year) ? discipline : 'f1';
  const regs = getRegs(disc, year);
  const B = budgetRef(regs, year);
  const bk = MS_BUDGETS[budget].k;
  const perf = useMemo(() => computeRaceCar(defaultRaceCar(regs, year), { aero: 0.3, engine: 0.3, chassis: 0.3, reliability: 0.3 }, regs, year, 0.5), [disc, year]);
  const pickMaker = (id: string | null) => { setMakerId(id); if (id) { const m = MAKER[id]; setTeamName(`${m.name} Works Team`); setColor(m.color); setColor2(m.color2); } };
  const name = teamName.trim() || t('setup.m.yourTeam');
  return (
    <div className="setup">
      <div className="left">
        <div className="row between"><h2>{t('menu.motorsport.title')}</h2><button className="btn sm ghost" data-action="setup-back" onClick={() => go('menu')}>← {t('setup.back')}</button></div>
        <div className="col" style={{ gap: 6 }}><h4>{t('setup.m.discipline')}</h4>
          <div className="cards" style={{ gridTemplateColumns: '1fr 1fr' }}>{DISCIPLINES.map((d) => <button key={d.id} className={'card' + (disc === d.id ? ' on' : '')} disabled={!disciplineAvailable(d.id, year)} onClick={() => setDiscipline(d.id)}><b>{term(d.name)}</b><span className="tiny muted">{disciplineAvailable(d.id, year) ? getRegs(d.id, year).className : t('ms.found.begins', { year: d.from })}</span></button>)}</div>
        </div>
        <Slider label={t('setup.startYear')} value={year} min={1950} max={LAST_START_YEAR} onChange={setYear} />
        <EstimateNote year={year} />
        <div className="col" style={{ gap: 6 }}><h4>{t('setup.m.team')}</h4>
          <Select value={makerId ?? ''} options={[{ value: '', label: t('setup.m.independent') }, ...MAKERS.filter((m) => makerStart(m) <= year).map((m) => ({ value: m.id, label: t('setup.m.works', { name: m.name }) }))]} onChange={(v) => pickMaker(v || null)} />
          <label className="field"><span className="lab"><span>{t('setup.m.teamName')}</span></span><input type="text" value={teamName} maxLength={30} onChange={(e) => setTeamName(e.target.value)} /></label>
          <div className="row"><label className="field"><span className="lab"><span>{t('ms.car.colour1')}</span></span><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label><label className="field"><span className="lab"><span>{t('ms.car.colour2')}</span></span><input type="color" value={color2} onChange={(e) => setColor2(e.target.value)} /></label></div>
          <span className="small muted">{t('setup.m.livery')}</span>
        </div>
        <div className="col" style={{ gap: 6 }}><h4>{t('setup.m.budget')}</h4><Seg value={budget} options={MS_BUDGETS.map((b, i) => ({ value: i, label: t('setup.m.budgetFmt', { name: term(b.name), v: fmtMoney(B * b.k * 1.15, 0) }) }))} onChange={setBudget} /></div>
        <Slider label={t('setup.m.facilities')} value={facilities} min={1} max={5} onChange={setFacilities} fmt={(v) => t(k(`setup.m.fac.${v}`))} />
        <Slider label={t('ms.staff')} value={staff} min={40} max={88} onChange={setStaff} fmt={(v) => t('setup.m.skill', { n: v })} />
        <Slider label={t('setup.m.objective')} value={target} min={1} max={regs.teams} onChange={setTarget} fmt={(v) => t('setup.m.objectiveFmt', { n: v })} />
        <span className="small muted">{t('setup.m.note')}</span>
        <WorldOptions diff={diff} setDiff={setDiff} hist={hist} setHist={setHist} />
        <button className="btn primary lg" data-action="start-game" onClick={() => start(newMotorsportGame({ makerId, teamName: name, discipline: disc, year, budget, facilities, staff, target: Math.min(target, regs.teams), color, color2, difficulty: diff, historyMode: hist }))}>{t('setup.m.go', { year })}</button>
      </div>
      <div className="right">
        <div><h1>{name} <span className="muted" style={{ fontWeight: 400 }}>{year}</span></h1><p className="dim">{regs.seriesName} ({t('setup.m.unofficial')}) · {regs.className}</p></div>
        <div className="grid g2">
          <div className="viewer" style={{ height: 300 }}><Guard3D poster={<CarPoster kind={posterForDiscipline(disc)} color={color} />}><RaceCarViewer discipline={disc} year={year} color={color} color2={color2} wing={0.5} /></Guard3D><div className="overlay">{t('setup.m.baseline')}</div></div>
          <div className="panel col"><h4>{t('setup.m.regs', { year })} <Src k="h" /> <span className="muted">({t('setup.m.simplified')})</span></h4>
            <p>{regs.note}</p>
            <StatLine label={t('setup.m.minWeight')} value={`${Math.round(regs.minWeight)} kg`} />
            <StatLine label={t('setup.m.engineLimit')} value={[regs.maxDispNA ? t('setup.m.na', { cc: regs.maxDispNA }) : null, regs.maxDispForced ? t('setup.m.forced', { cc: regs.maxDispForced }) : null].filter(Boolean).join(' / ')} />
            {regs.powerCapKw > 0 && <StatLine label={t('setup.m.powerLimit')} value={`${Math.round(regs.powerCapKw)} kW`} />}
            {regs.hybridKw > 0 && <StatLine label={t('setup.m.hybrid')} value={`${regs.hybridKw} kW`} />}
            <StatLine label={t('setup.m.refuel')} value={t(regs.refuel ? 'setup.m.allowed' : 'setup.m.banned')} />
            <StatLine label={t('setup.m.points')} value={regs.points.join('–') + (regs.flPoint ? ` ${t('ms.season.fl')}` : '')} />
          </div>
        </div>
        <div className="panel grid g4">
          <Kpi label={t('setup.m.grid')} value={t('setup.m.teams', { n: regs.teams })} detail={t('setup.m.carsEach', { n: regs.carsPerTeam }) + (regs.driversPerCar > 1 ? `, ${t('ms.team.share', { n: regs.driversPerCar })}` : '')} />
          <Kpi label={t('setup.m.frontBudget')} value={fmtMoney(B)} detail={<Src k="e" />} />
          <Kpi label={t('setup.m.basePower')} value={`${Math.round(perf.powerKw)} kW`} detail={t('setup.m.kgCar', { kg: Math.round(perf.mass - 75) })} />
          <Kpi label={t('setup.m.format')} value={regs.raceKm ? t('setup.m.kmRaces', { km: regs.raceKm }) : t('setup.m.timed')} detail={t(regs.raceKm ? 'setup.m.sprint' : 'setup.m.endurance')} />
        </div>
        <div className="panel col"><h4>{t('setup.m.yourBudget')} <Src k="e" /></h4>
          <BarList fmt={(v) => fmtMoney(v)} items={[{ label: t(makerId ? 'setup.m.makerFunding' : 'ms.budget.owner'), value: B * 0.72 * bk }, { label: t('setup.m.sponsors'), value: B * 0.45 * bk, color: 'var(--s3)' }, { label: t('setup.m.cashStart'), value: B * 0.3 * bk, color: 'var(--s4)' }]} />
          <p className="small muted">{t('setup.m.prize')} {makerId ? t('setup.m.alsoMaker', { name: MAKER[makerId].name }) : ''}</p>
        </div>
      </div>
    </div>
  );
}
