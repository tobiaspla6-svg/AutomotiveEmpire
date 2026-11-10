import { useMemo, useState } from 'react';
import type { Difficulty, Discipline, HistoryMode } from '../sim/types';
import { useStore } from '../store/game';
import { MAKERS, MAKER, makerStart } from '../data/manufacturers';
import { COUNTRIES, COUNTRY, REGIONS } from '../data/world';
import { TECHS } from '../data/tech';
import {
  capitalOptions, ENGINEER_LEVELS, FACTORY_SIZES, founderCosts, MS_BUDGETS, newCeoGame, newFounderGame, newMotorsportGame, previewCompany,
  RESEARCH_LEVELS, SPECIALIZATIONS, WORKFORCE_LEVELS, type FounderSetup,
} from '../sim/world';
import { LAYOUT_NAME, defaultVehicle } from '../sim/engineering';
import { DISCIPLINES, disciplineAvailable, getRegs } from '../sim/racing/regs';
import { budgetRef } from '../sim/racing/season';
import { computeRaceCar, defaultRaceCar } from '../sim/racing/racecar';
import { fmtMoney, fmtNum } from '../sim/util';
import { BarList, Kpi, Seg, Select, Slider, Src, StatLine } from './common';
import { CarViewer } from '../three/CarViewer';
import { RaceCar, RoadCar } from '../three/CarModel';
import { REGION_IDS } from '../data/world';

const DIFFS: { value: Difficulty; label: string }[] = [{ value: 'easy', label: 'Relaxed' }, { value: 'normal', label: 'Realistic' }, { value: 'hard', label: 'Ruthless' }];
const HIST: { value: HistoryMode; label: string; title: string }[] = [
  { value: 'historical', label: 'Historical', title: 'World events happen on their real dates.' },
  { value: 'alternative', label: 'Alternative history', title: 'Events may be skipped, shifted by up to two years or change in magnitude; competitors drift from their real trajectories.' },
];
function WorldOptions(p: { diff: Difficulty; setDiff: (d: Difficulty) => void; hist: HistoryMode; setHist: (h: HistoryMode) => void }) {
  return (
    <>
      <div className="col" style={{ gap: 6 }}><h4>Difficulty</h4><Seg value={p.diff} options={DIFFS} onChange={p.setDiff} /></div>
      <div className="col" style={{ gap: 6 }}><h4>Timeline</h4><Seg value={p.hist} options={HIST} onChange={p.setHist} />
        <span className="small muted">{p.hist === 'historical' ? 'Oil crises, recessions, regulations and disasters arrive on their real dates.' : 'Each historical event may not happen, may arrive up to two years early or late, and varies in strength. Competitors diverge from their real paths.'}</span></div>
    </>
  );
}

// ------------------------------------------------------------------------------------- CEO
export function CeoSetupScreen() {
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
  const techs = TECHS.filter((t) => c.tech[t.area] >= t.year && t.year >= y - 25).slice(-9);
  return (
    <div className="setup">
      <div className="left">
        <div className="row between"><h2>Historical Automotive CEO</h2><button className="btn sm ghost" onClick={() => go('menu')}>← Back</button></div>
        <div className="col" style={{ gap: 6 }}><h4>Manufacturer</h4>
          <div className="cards">{MAKERS.map((m) => (
            <button key={m.id} className={'card' + (m.id === makerId ? ' on' : '')} onClick={() => { setMakerId(m.id); setYear(Math.max(year, makerStart(m))); }}>
              <span className="row" style={{ gap: 7 }}><i className="swatch" style={{ background: m.color }} /><b>{m.name}</b></span>
              <span className="tiny muted">{m.country} · from {makerStart(m)}</span>
            </button>))}
          </div>
        </div>
        <Slider label="Starting year" value={y} min={makerStart(def)} max={2024} onChange={setYear} />
        <WorldOptions diff={diff} setDiff={setDiff} hist={hist} setHist={setHist} />
        <button className="btn primary lg" onClick={() => start(newCeoGame({ makerId, year: y, difficulty: diff, historyMode: hist }))}>Take the chair at {def.name}, {y}</button>
        <p className="small muted">The world is populated with every other catalogued manufacturer active in {y}; they follow their real model launches and plant openings while you are free to diverge.</p>
      </div>
      <div className="right">
        <div className="row between wrap"><div><h1>{def.name} <span className="muted" style={{ fontWeight: 400 }}>{y}</span></h1><p className="dim">{def.hq}, {COUNTRY[def.country].name} · founded {def.founded} <Src k="h" /></p></div></div>
        <div className="grid g2">
          <div className="panel col"><h4>Situation <Src k="h" /></h4><p>{era}</p>{def.ownershipNote && <p className="small muted">{def.ownershipNote}</p>}
            <h4 style={{ marginTop: 6 }}>Board expectations <Src k="e" /></h4>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{objectives.map((o) => <li key={o.id}>{o.text}</li>)}</ul>
          </div>
          <div className="viewer" style={{ height: 250 }}>
            <CarViewer><RoadCar spec={flagship.spec} /></CarViewer>
            <div className="overlay"><b>{flagship.name}</b> · generated from its specification</div>
          </div>
        </div>
        <div className="panel grid g4">
          <Kpi label="Starting cash" value={fmtMoney(c.cash)} detail={<Src k="e" />} />
          <Kpi label="Existing debt" value={fmtMoney(c.debt)} detail={<Src k="e" />} />
          <Kpi label="Annual production" value={fmtNum(c.baseVolume)} detail={<Src k="a" />} />
          <Kpi label="Est. revenue" value={fmtMoney(revenue)} detail={<Src k="e" />} />
          <Kpi label="Capacity / month" value={fmtNum(capacity)} detail={<Src k="e" />} />
          <Kpi label="Workforce" value={fmtNum(workforce)} detail={<Src k="e" />} />
          <Kpi label="Engineers" value={fmtNum(c.engineers)} detail={<Src k="e" />} />
          <Kpi label="R&D / year" value={fmtMoney(Object.values(c.rdBudget).reduce((a, b) => a + b, 0) * 12)} detail={<Src k="e" />} />
        </div>
        <div className="grid g2">
          <div className="panel col">
            <h4>Vehicle portfolio — names, years and engine layout <Src k="h" />, figures <Src k="e" /></h4>
            <div className="tablewrap" style={{ maxHeight: 300 }}><table><thead><tr><th>Model</th><th>Engine</th><th className="r">Power</th><th className="r">0–100</th><th className="r">Price</th></tr></thead><tbody>
              {c.models.map((m) => <tr key={m.id}><td>{m.name}</td><td className="dim">{m.spec.engine.layout === 'EV' ? `Electric ${m.spec.engine.batteryKwh} kWh` : `${LAYOUT_NAME[m.spec.engine.layout]} ${(m.spec.engine.displacement / 1000).toFixed(1)} L${m.spec.engine.aspiration !== 'na' ? ' T' : ''}`}</td><td className="r">{Math.round(m.stats.powerKw)} kW</td><td className="r">{m.stats.zeroTo100.toFixed(1)} s</td><td className="r">{fmtMoney(m.price)}</td></tr>)}
            </tbody></table></div>
          </div>
          <div className="col">
            <div className="panel col"><h4>Factories — locations <Src k="h" />, capacity <Src k="e" /></h4>
              {c.factories.map((f) => <StatLine key={f.id} label={<>{f.name}, {COUNTRY[f.country].name} <span className="muted">· since {f.builtYear}</span></>} value={`${fmtNum(f.capacity)} / mo`} />)}
            </div>
            <div className="panel col"><h4>Brand reputation <Src k="e" /></h4>
              <BarList items={[{ label: 'Prestige', value: c.prestige }, { label: 'Reliability', value: c.reliabilityRep, color: 'var(--s3)' }, { label: 'Sportiness', value: c.sportiness, color: 'var(--s2)' }]} />
            </div>
          </div>
        </div>
        <div className="grid g3">
          <div className="panel col"><h4>Global market presence <Src k="e" /></h4>
            <BarList items={REGION_IDS.map((r) => ({ label: REGIONS.find((x) => x.id === r)!.short, value: c.reach[r] }))} fmt={fmtNum} />
          </div>
          <div className="panel col"><h4>Engine & vehicle technology <Src k="e" /></h4>
            <StatLine label="Powertrain tech level" value={c.tech.engine.toFixed(0)} /><StatLine label="Chassis & materials" value={c.tech.chassis.toFixed(0)} /><StatLine label="Aerodynamics" value={c.tech.aero.toFixed(0)} /><StatLine label="Electronics & safety" value={c.tech.electronics.toFixed(0)} /><StatLine label="Manufacturing" value={c.tech.manufacturing.toFixed(0)} />
            <p className="small muted">Recently mastered: {techs.map((t) => t.name).join(', ') || '—'}.</p>
          </div>
          <div className="panel col"><h4>Motorsport programmes <Src k="h" /></h4>
            {programmes.length ? programmes.map(([grp, a, b], i) => <StatLine key={i} label={{ f1: 'Grand Prix racing', proto: 'Endurance prototypes', gt: 'GT racing', touring: 'Touring cars' }[grp]} value={`${a}–${b > 2090 ? 'today' : b}`} />) : <p className="muted">No works racing programme in {y}. You can found one.</p>}
            <p className="small muted">Simplified programme eras; an active programme starts under your control.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------------- Founder
export function FounderSetupScreen() {
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
        <div className="row between"><h2>Automotive Company Founder</h2><button className="btn sm ghost" onClick={() => go('menu')}>← Back</button></div>
        <label className="field"><span className="lab"><span>Company name</span></span><input type="text" value={o.name} maxLength={28} onChange={(e) => set({ name: e.target.value })} /></label>
        <div className="row"><div className="grow"><Select label="Home country" value={o.country} options={COUNTRIES.map((c) => ({ value: c.id, label: c.name }))} onChange={(v) => set({ country: v })} /></div>
          <label className="field"><span className="lab"><span>Brand colour</span></span><input type="color" value={o.color} onChange={(e) => set({ color: e.target.value })} /></label></div>
        <Slider label="Founding year" value={o.year} min={1950} max={2024} onChange={(v) => set({ year: v })} />
        <div className="col" style={{ gap: 6 }}><h4>Starting capital</h4><Seg value={capIdx} options={caps.map((c, i) => ({ value: i, label: fmtMoney(c, 0) }))} onChange={(i) => set({ capital: caps[i] })} /></div>
        <div className="col" style={{ gap: 6 }}><h4>Business specialisation</h4>
          <div className="cards">{SPECIALIZATIONS.map((s) => <button key={s.id} className={'card' + (o.specialization === s.id ? ' on' : '')} disabled={s.id === 'ev' && o.year < 2005} onClick={() => set({ specialization: s.id })}><b>{s.name}</b><span className="tiny muted">{s.blurb}</span></button>)}</div>
        </div>
        <Select label="Initial factory" value={o.factory} options={FACTORY_SIZES.map((f, i) => ({ value: i, label: f.name }))} onChange={(v) => set({ factory: v })} />
        <Select label="Initial workforce & production method" value={o.workforce} options={WORKFORCE_LEVELS.map((f, i) => ({ value: i, label: `${f.name} — ${Math.round(Math.min(f.auto, maxAuto) * 100)}% automation`, disabled: f.auto > maxAuto + 0.01 }))} onChange={(v) => set({ workforce: v })} hint="Hand-building needs many labour hours per car but little investment; automation is the opposite." />
        <Select label="Initial engineering capability" value={o.engineers} options={ENGINEER_LEVELS.map((f, i) => ({ value: i, label: f.name }))} onChange={(v) => set({ engineers: v })} />
        <Select label="Initial research facilities" value={o.research} options={RESEARCH_LEVELS.map((f, i) => ({ value: i, label: f.name }))} onChange={(v) => set({ research: v })} />
        <WorldOptions diff={o.difficulty} setDiff={(d) => set({ difficulty: d })} hist={o.historyMode} setHist={(h) => set({ historyMode: h })} />
        <button className="btn primary lg" disabled={left < 0 || !o.name.trim()} onClick={() => start(newFounderGame(o))}>Found {o.name || 'the company'} in {o.year}</button>
      </div>
      <div className="right">
        <div><h1>{o.name || 'Your company'} <span className="muted" style={{ fontWeight: 400 }}>est. {o.year}</span></h1><p className="dim">{COUNTRY[o.country].name} · {SPECIALIZATIONS.find((s) => s.id === o.specialization)?.name}</p></div>
        <div className="grid g2">
          <div className="viewer" style={{ height: 300 }}><CarViewer><RoadCar spec={car} /></CarViewer><div className="overlay">A period-typical starting point — you will engineer the real thing in the design studio.</div></div>
          <div className="panel col">
            <h4>Where the capital goes</h4>
            <BarList total fmt={(v) => fmtMoney(v)} items={[{ label: 'Factory', value: costs.factory }, { label: 'Engineering team (hiring)', value: costs.eng, color: 'var(--s2)' }, { label: 'Research facilities', value: costs.research, color: 'var(--s3)' }, { label: 'Cash left to operate', value: Math.max(0, left), color: 'var(--s4)' }]} />
            {left < 0 && <div className="errbox">These choices cost {fmtMoney(-left)} more than your capital. Reduce the factory, team or laboratory — or raise more capital.</div>}
            {left >= 0 && left < o.capital * 0.25 && <div className="warnbox">Little cash is left for developing your first car and surviving until it sells.</div>}
          </div>
        </div>
        <div className="panel col">
          <h4>What happens next</h4>
          <div className="grid g4">
            <div><b>1 · Design</b><p className="small dim">Choose body, chassis, engine architecture, bore/stroke, valvetrain, gearing, suspension, tyres, aero and interior. Every figure is calculated live.</p></div>
            <div><b>2 · Develop</b><p className="small dim">A programme costs money and takes months; more engineers finish sooner. Technology you have not mastered is locked.</p></div>
            <div><b>3 · Build</b><p className="small dim">Tool a production line, choose volume, watch unit cost fall with scale, learning and automation.</p></div>
            <div><b>4 · Sell</b><p className="small dim">Set the price, open dealers region by region, advertise — against {MAKERS.filter((m) => makerStart(m) <= o.year).length} historical competitors.</p></div>
          </div>
        </div>
        <div className="panel col"><h4>The world in {o.year}</h4>
          <p className="dim small">Competitors active: {MAKERS.filter((m) => makerStart(m) <= o.year).map((m) => m.name).join(', ')}.</p>
          <p className="dim small">Technologies not yet available to the industry: {TECHS.filter((t) => t.year > o.year + RESEARCH_LEVELS[o.research].lead).slice(0, 12).map((t) => `${t.name} (${t.year})`).join(', ') || 'none'}.</p>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------ Motorsport
export function MotorsportSetupScreen() {
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
  const k = MS_BUDGETS[budget].k;
  const perf = useMemo(() => computeRaceCar(defaultRaceCar(regs, year), { aero: 0.3, engine: 0.3, chassis: 0.3, reliability: 0.3 }, regs, year, 0.5), [disc, year]);
  const pickMaker = (id: string | null) => { setMakerId(id); if (id) { const m = MAKER[id]; setTeamName(`${m.name} Works Team`); setColor(m.color); setColor2(m.color2); } };
  const name = teamName.trim() || 'Your team';
  return (
    <div className="setup">
      <div className="left">
        <div className="row between"><h2>Professional Motorsport Director</h2><button className="btn sm ghost" onClick={() => go('menu')}>← Back</button></div>
        <div className="col" style={{ gap: 6 }}><h4>Racing discipline</h4>
          <div className="cards" style={{ gridTemplateColumns: '1fr 1fr' }}>{DISCIPLINES.map((d) => <button key={d.id} className={'card' + (disc === d.id ? ' on' : '')} disabled={!disciplineAvailable(d.id, year)} onClick={() => setDiscipline(d.id)}><b>{d.name}</b><span className="tiny muted">{disciplineAvailable(d.id, year) ? getRegs(d.id, year).className : `from ${d.from}`}</span></button>)}</div>
        </div>
        <Slider label="Starting year" value={year} min={1950} max={2024} onChange={setYear} />
        <div className="col" style={{ gap: 6 }}><h4>Team</h4>
          <Select value={makerId ?? ''} options={[{ value: '', label: 'Independent (fictional) team' }, ...MAKERS.filter((m) => makerStart(m) <= year).map((m) => ({ value: m.id, label: `${m.name} — works team` }))]} onChange={(v) => pickMaker(v || null)} />
          <label className="field"><span className="lab"><span>Team name</span></span><input type="text" value={teamName} maxLength={30} onChange={(e) => setTeamName(e.target.value)} /></label>
          <div className="row"><label className="field"><span className="lab"><span>Main colour</span></span><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label><label className="field"><span className="lab"><span>Second colour</span></span><input type="color" value={color2} onChange={(e) => setColor2(e.target.value)} /></label></div>
          <span className="small muted">Liveries are original two-colour schemes; no official liveries or logos are used.</span>
        </div>
        <div className="col" style={{ gap: 6 }}><h4>Initial budget</h4><Seg value={budget} options={MS_BUDGETS.map((b, i) => ({ value: i, label: `${b.name} · ${fmtMoney(B * b.k * 1.15, 0)}/yr` }))} onChange={setBudget} /></div>
        <Slider label="Facilities (wind tunnel, simulator, workshop, engine shop)" value={facilities} min={1} max={5} onChange={setFacilities} fmt={(v) => ['', 'Rented sheds', 'Modest', 'Competitive', 'Excellent', 'State of the art'][v]} />
        <Slider label="Technical personnel" value={staff} min={40} max={88} onChange={setStaff} fmt={(v) => `${v} / 100 skill`} />
        <Slider label="Objective: teams' championship position" value={target} min={1} max={regs.teams} onChange={setTarget} fmt={(v) => `Top ${v} within two seasons`} />
        <span className="small muted">Better facilities and staff cost more to run, leaving less of the budget for development and drivers. Ambitious objectives please the owners only if you meet them.</span>
        <WorldOptions diff={diff} setDiff={setDiff} hist={hist} setHist={setHist} />
        <button className="btn primary lg" onClick={() => start(newMotorsportGame({ makerId, teamName: name, discipline: disc, year, budget, facilities, staff, target: Math.min(target, regs.teams), color, color2, difficulty: diff, historyMode: hist }))}>Enter the {year} season</button>
      </div>
      <div className="right">
        <div><h1>{name} <span className="muted" style={{ fontWeight: 400 }}>{year}</span></h1><p className="dim">{regs.seriesName} (unofficial) · {regs.className}</p></div>
        <div className="grid g2">
          <div className="viewer" style={{ height: 300 }}><CarViewer><RaceCar discipline={disc} year={year} color={color} color2={color2} wing={0.5} /></CarViewer><div className="overlay">Period-typical baseline car for these regulations</div></div>
          <div className="panel col"><h4>Regulations in {year} <Src k="h" /> <span className="muted">(simplified)</span></h4>
            <p>{regs.note}</p>
            <StatLine label="Minimum weight" value={`${Math.round(regs.minWeight)} kg`} />
            <StatLine label="Engine limit" value={[regs.maxDispNA ? `${regs.maxDispNA} cc NA` : null, regs.maxDispForced ? `${regs.maxDispForced} cc forced induction` : null].filter(Boolean).join(' / ')} />
            {regs.powerCapKw > 0 && <StatLine label="Power limit (BoP / fuel flow)" value={`${Math.round(regs.powerCapKw)} kW`} />}
            {regs.hybridKw > 0 && <StatLine label="Hybrid system" value={`${regs.hybridKw} kW`} />}
            <StatLine label="Refuelling" value={regs.refuel ? 'Allowed' : 'Banned'} />
            <StatLine label="Points" value={regs.points.join('–') + (regs.flPoint ? ' +1 fastest lap' : '')} />
          </div>
        </div>
        <div className="panel grid g4">
          <Kpi label="Grid" value={`${regs.teams} teams`} detail={`${regs.carsPerTeam} cars each${regs.driversPerCar > 1 ? `, ${regs.driversPerCar} drivers per car` : ''}`} />
          <Kpi label="Front-running budget" value={fmtMoney(B)} detail={<Src k="e" />} />
          <Kpi label="Baseline power" value={`${Math.round(perf.powerKw)} kW`} detail={`${Math.round(perf.mass - 75)} kg car`} />
          <Kpi label="Format" value={regs.raceKm ? `${regs.raceKm} km races` : 'Timed races'} detail={regs.raceKm ? 'sprint' : '2 to 24 hours'} />
        </div>
        <div className="panel col"><h4>Your budget <Src k="e" /></h4>
          <BarList fmt={(v) => fmtMoney(v)} items={[{ label: makerId ? 'Manufacturer funding' : 'Owner funding', value: B * 0.72 * k }, { label: 'Sponsors (fictional)', value: B * 0.45 * k, color: 'var(--s3)' }, { label: 'Cash at the start', value: B * 0.3 * k, color: 'var(--s4)' }]} />
          <p className="small muted">Prize money is paid at the end of each season according to the teams' championship. {makerId ? `${MAKER[makerId].name} also exists in the world as a road-car manufacturer run by the AI.` : ''}</p>
        </div>
      </div>
    </div>
  );
}
