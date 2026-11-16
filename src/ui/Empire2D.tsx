// Phase 5 — the game-first 2D screens over the existing simulation: headquarters campus, engineering workshop by
// stages, assembly plant by sectors, achievements / chests / collection / shop, marketing and rankings. Every action
// goes through the simulation's own actions (startDevelopment, expandStage, upgradeAutomation, setMarketing, …);
// every figure shown is read from the game state.
import { useMemo, useState } from 'react';
import type { BodyType, BrakeType, ChassisType, EngineLayout, Gearbox, PaintFinish, SuspType, TireCompound, VehicleSpec, WheelStyle, Company, GameState, RegionId } from '../sim/types';
import { useGame, useStore } from '../store/game';
import { useT, type MessageKey } from '../i18n';
import { money, num } from '../i18n/format';
import { starterVehicle, defaultVehicle, computeVehicle, CYL } from '../sim/engineering';
import { annualUnits, makeModel, estimateUnitCost, factoryBuildCost } from '../sim/company';
import { startDevelopment, setEngineers, setMarketing, investDealers, validateSpec, expandStage, stageCost, setInspection, upgradeAutomation, automationCost, maxAutomation, expandFactory, buildMonths, dealerInvestPreview } from '../sim/actions';
import { planDevelopment, defaultChoice } from '../sim/families';
import { missingTechs, TECH_BY_ID } from '../data/tech';
import { suggestSegment, segVolume } from '../sim/market';
import { stagesOf, bottleneck, inspectionOf } from '../sim/supply';
import { REGION_IDS, REGIONS, SEGMENTS } from '../data/world';
import { standings } from '../sim/racing/season';
import { player } from '../sim/world';
import { ICONIC_ENGINES, type IconicEngine } from '../data/iconicEngines';
import { BLUEPRINTS, REDEEM_LEVEL, availableMilestones, equipPart, fixedPrice, lifetimeSales, redeemPart, type PartSlot } from '../sim/progression';
import { ACHIEVEMENTS, achievementViews, claimAchievement, companyLevel, LEVELS, nextLevelXp, type AchievementView } from '../sim/achievements';
import { Car2D, type WheelLook } from './art2d/Car2D';
import { HeroShowroom2D } from './art2d/HeroShowroom2D';
import { Engine2D } from './art2d/Engine2D';
import { Chassis2D, Gearbox2D, Suspension2D, Brake2D, Tyre2D } from './art2d/Parts2D';
import type { CampusState } from './art2d/Campus2D';
import { SECTORS, type Sector, type SectorLoad } from './art2d/FactoryLine2D';
import { FlowFactoryScene, FlowQueue } from './flow/FlowFactory';
import { PartCard } from './art2d/Rewards2D';
import { GettingStarted } from './Guide';
import { FlowBar, FlowCampus } from './flow/FlowHQ';
import { ChestRoom } from './flow/FlowChests';
import { configOf, saveVehicleConfig } from '../sim/vehicleConfig';
import { useTx, type TxKey } from './game2d/text';
import { sfx } from './game2d/sfx';

// ------------------------------------------------------------------------------------------------ shared pieces
type Tr = ReturnType<typeof useTx>;
function Heading({ kicker, title, sub, back = true }: { kicker: string; title: string; sub?: string; back?: boolean }) {
  const tx = useTx(), setView = useStore((s) => s.setView);
  return <header className="g2-heading">
    {back && <button type="button" className="g2-back" onClick={() => setView('hq2d')}>← {tx('back.hq')}</button>}
    <span className="g2-kicker">{kicker}</span><h2>{title}</h2>{sub && <p>{sub}</p>}
  </header>;
}
const wheelLookOf = (s?: WheelStyle): WheelLook | undefined => (s === 'turbine' ? 'turbine' : s === 'fivespoke' ? 'fivespoke' : s === 'multispoke' ? 'multispoke' : undefined);
export function CarArt({ spec, year, equipped, moving }: { spec: VehicleSpec; year: number; equipped?: Company['arcade'] extends infer A ? A extends { equipped: infer E } ? E : never : never; moving?: boolean }) {
  return <Car2D body={spec.body} year={year} color={spec.color} wheels={wheelLookOf(spec.wheelStyle)} electric={spec.engine.layout === 'EV'} sporty={spec.sport >= 0.55 || spec.tireCompound === 'sport' || spec.tireCompound === 'semislick'} equipped={equipped} moving={moving} />;
}
const fmtKw = (kw: number) => `${Math.round(kw)} kW`;

// ------------------------------------------------------------------------------------------------ headquarters
export function campusState(g: GameState, p: Company): CampusState {
  const units = annualUnits(p), lead = Object.values(p.tech).reduce((a, v) => a + v, 0) / 5 - g.year;
  const reach = REGION_IDS.reduce((a, r) => a + p.reach[r], 0);
  return {
    name: p.name, color: p.color,
    officeTier: units >= 1e6 ? 4 : units >= 1e5 ? 3 : units >= 1e4 ? 2 : 1,
    studioTier: p.engineers >= 500 ? 3 : p.engineers >= 100 ? 2 : 1,
    labTier: lead >= 0 ? 3 : lead >= -2 ? 2 : 1,
    plants: p.factories.map((f) => ({ id: f.id, name: f.name, capacity: f.capacity + (f.expansion?.add ?? 0), building: f.capacity <= 0 || !!f.expansion || !!f.stageWork, automation: f.automation })),
    showroomTier: reach >= 200000 ? 3 : reach >= 20000 ? 2 : reach > 0 ? 1 : 0,
    track: !!p.motorsport || lifetimeSales(p) >= 10000, racing: !!p.motorsport,
    trophies: Object.keys(p.arcade?.achievements ?? {}).length, billboard: p.marketingBudget > 0,
    stock: p.models.reduce((a, m) => a + m.inventory, 0),
  };
}

function LevelBadge({ p }: { p: Company }) {
  const tx = useTx();
  const xp = p.arcade?.xp ?? 0, lvl = companyLevel(p), next = nextLevelXp(xp), prev = LEVELS[lvl - 1] ?? 0;
  const pct = next ? Math.round(((xp - prev) / (next - prev)) * 100) : 100;
  return <div className="g2-level" data-level={lvl}>
    <div className="g2-level-ring" style={{ ['--pct' as string]: `${pct}%` }}><b>{lvl}</b></div>
    <div><span>{tx('hub.level')}</span><small>{next ? tx('hub.xp', { xp, next }) : tx('hub.maxLevel', { xp })}</small></div>
  </div>;
}

function useClaim() {
  const tx = useTx(), { lang } = useT();
  const act = useStore((s) => s.act), save = useStore((s) => s.save), notify = useStore((s) => s.notify);
  return (v: AchievementView) => {
    const before = useStore.getState().game ? companyLevel(player(useStore.getState().game!)) : 1;
    const out: { r?: ReturnType<typeof claimAchievement> } = {};
    if (act((gg) => { const r = claimAchievement(gg, v.a.id); out.r = r; return typeof r === 'string' ? r : null; })) {
      sfx.claim(); void save('autosave');
      const r = out.r;
      if (r && typeof r !== 'string') {
        const bp = r.blueprint ? BLUEPRINTS.find((b) => b.id === r.blueprint) : null;
        notify(tx('goal.done', { name: lang === 'es' ? v.a.es : v.a.en }) + (bp ? ' · ' + tx('goal.blueprint', { name: lang === 'es' ? bp.es : bp.en }) : '') + (r.level > before ? ' · ' + tx('goal.levelUp', { n: r.level }) : ''));
      }
    }
  };
}
function GoalRow({ v, onClaim }: { v: AchievementView; onClaim: (v: AchievementView) => void }) {
  const tx = useTx(), { lang } = useT();
  const pct = Math.min(100, Math.round((v.value / v.target) * 100));
  const bp = v.a.blueprint ? BLUEPRINTS.find((b) => b.id === v.a.blueprint) : null;
  return <li className={'g2-goal' + (v.claimed ? ' claimed' : v.done ? ' done' : '')} data-goal={v.a.id}>
    <div className="g2-goal-medal" aria-hidden="true">{v.claimed ? '★' : v.done ? '!' : `${pct}%`}</div>
    <div className="g2-goal-text"><b>{lang === 'es' ? v.a.es : v.a.en}</b><span>{lang === 'es' ? v.a.descEs : v.a.descEn}</span>
      <i className="g2-bar"><em style={{ width: `${pct}%` }} /></i>
      <small>{tx('goal.reward', { xp: v.a.xp, c: v.a.credits })}{bp ? ' · ' + tx('goal.blueprint', { name: lang === 'es' ? bp.es : bp.en }) : ''}</small></div>
    {v.claimed ? <span className="g2-chip">{tx('goal.claimed')}</span>
      : <button type="button" className="g2-btn gold" data-action="claim-goal" disabled={!v.done} onClick={() => onClaim(v)}>{tx('goal.claim')}</button>}
  </li>;
}

export function EmpireHub2D() {
  const { g, p } = useGame(), tx = useTx(), { lang } = useT();
  const setView = useStore((s) => s.setView);
  const claim = useClaim();
  const sold = lifetimeSales(p), credits = p.arcade?.credits ?? 0;
  const ranked = g.companies.filter((c) => c.alive).sort((a, b) => annualUnits(b) - annualUnits(a));
  const hasData = ranked.some((c) => c.ledger.length > 0);
  const myRank = ranked.findIndex((c) => c.id === p.id) + 1;
  const goals = achievementViews(g, p).filter((v) => !v.claimed).sort((a, b) => Number(b.done) - Number(a.done) || b.value / b.target - a.value / a.target).slice(0, 4);
  const range = p.models.filter((m) => m.status !== 'retired').slice(0, 6);
  return <section className="g2 g2-hub">
    <FlowCampus g={g} p={p} />
    <div className="g2-hub-stats"><LevelBadge p={p} /><div className="g2-stat"><span>{tx('hub.sold')}</span><b>{num(sold, lang)}</b></div><div className="g2-stat"><span>{tx('hub.credits')}</span><b>{num(credits, lang)}</b></div><div className="g2-stat"><span>{tx('hub.rank')}</span><b>{hasData ? `#${myRank}` : '—'}</b></div></div>
    <div className="g2-hub-grid">
      <div className="g2-panel g2-range">
        <div className="g2-panel-head"><h3>{tx('hub.range')}</h3><button type="button" className="g2-btn gold" onClick={() => setView('workshop2d')}>{tx('hub.openWorkshop')}</button></div>
        {range.length === 0 ? <p className="g2-soft">{tx('hub.range.empty')}</p> : <div className="g2-range-cards">{range.map((m) => {
          const perMonth = m.salesHistory.length ? m.salesHistory[m.salesHistory.length - 1] : 0;
          return <button type="button" key={m.id} className="g2-model" onClick={() => setView('vehicles')}>
            <CarArt spec={m.spec} year={m.designYear} equipped={p.arcade?.equipped} moving={m.status === 'production' && perMonth > 0} />
            <b>{m.name}</b>
            <small>{m.status === 'development' ? tx('hub.range.status.development', { n: Math.ceil(m.devMonthsLeft) }) : m.status === 'ready' ? tx('hub.range.status.ready') : tx('hub.range.status.production', { n: num(perMonth, lang), p: money(m.price, lang) })}</small>
          </button>;
        })}</div>}
      </div>
      <div className="g2-side">
        <GettingStarted />
        <div className="g2-panel">
          <div className="g2-panel-head"><h3>{tx('hub.goals')}</h3><button type="button" className="g2-link" onClick={() => setView('collection2d')}>→</button></div>
          <p className="g2-soft">{tx('hub.goals.sub')}</p>
          <ul className="g2-goals">{goals.map((v) => <GoalRow key={v.a.id} v={v} onClaim={claim} />)}</ul>
        </div>
        <div className="g2-panel">
          <div className="g2-panel-head"><h3>{tx('hub.rivals')}</h3><button type="button" className="g2-link" onClick={() => setView('league2d')}>→</button></div>
          {!hasData ? <p className="g2-soft">{tx('lg.wait')}</p> : <ol className="g2-mini-league">{ranked.slice(0, 5).map((c, i) => <li key={c.id} className={c.id === p.id ? 'me' : ''}><span>{i + 1}</span><i style={{ background: c.color }} /><b>{c.name}</b><em>{num(annualUnits(c), lang)}</em></li>)}
            {myRank > 5 && <li className="me"><span>{myRank}</span><i style={{ background: p.color }} /><b>{p.name}</b><em>{num(annualUnits(p), lang)}</em></li>}</ol>}
        </div>
      </div>
    </div>
  </section>;
}

// ------------------------------------------------------------------------------------------------ workshop
type Step = 'engine' | 'chassis' | 'drivetrain' | 'running' | 'body' | 'wheels' | 'finish' | 'approve';
const STEPS: Step[] = ['engine', 'chassis', 'drivetrain', 'running', 'body', 'wheels', 'finish', 'approve'];
const STEP_KEY: Record<Step, TxKey> = { engine: 'st.engine', chassis: 'st.chassis', drivetrain: 'st.drivetrain', running: 'st.running', body: 'st.body', wheels: 'st.wheels', finish: 'st.finish', approve: 'st.approve' };
const LAYOUT_CC: Partial<Record<EngineLayout, number>> = { I3: 1000, I4: 1800, I6: 3000, V6: 3000, V8: 5000, V10: 5000, V12: 6000, F4: 2000, F6: 3000, EV: 0 };
const PAINTS = ['#c8352e', '#e2a92b', '#2f6db3', '#1f3a5f', '#3d8a5a', '#e9e7df', '#9aa4b1', '#22262e', '#7b3fb0', '#d86a2a'];

interface Option { key: string; title: string; art: React.ReactNode; apply: (s: VehicleSpec) => VehicleSpec; level?: number; from?: number }
function withEngine(s: VehicleSpec, layout: EngineLayout): VehicleSpec {
  const ev = layout === 'EV';
  const cc = LAYOUT_CC[layout] ?? 2000;
  return { ...s, drive: ev && s.drive === 'FWD' ? 'RWD' : s.drive, engine: { ...s.engine, layout, displacement: ev ? s.engine.displacement : cc, motorKw: ev ? Math.max(150, s.engine.motorKw) : s.engine.motorKw, batteryKwh: ev ? Math.max(60, s.engine.batteryKwh) : s.engine.batteryKwh } };
}
function applyIconic(s: VehicleSpec, e: IconicEngine): VehicleSpec {
  const ev = e.preset.layout === 'EV';
  return { ...s, drive: ev || e.preset.layout.startsWith('V') || e.preset.layout === 'I6' ? (s.drive === 'FWD' ? 'RWD' : s.drive) : s.drive, enginePos: e.preset.layout.startsWith('F') && e.id === 'porsche-901' ? 'rear' : s.enginePos, engine: { ...s.engine, ...e.preset, displacement: ev ? s.engine.displacement : e.preset.displacement ?? s.engine.displacement } };
}

function useSpecEval(g: GameState, p: Company) {
  return useMemo(() => {
    const cache = new Map<string, { power: number; accel: number; top: number; economy: number; reliability: number; performance: number; prestige: number; unit: number; hours: number; missing: string[]; invalid: string[] }>();
    return (s: VehicleSpec) => {
      const k = JSON.stringify(s);
      let v = cache.get(k);
      if (!v) {
        const st = computeVehicle(s, { year: g.year, tech: p.tech });
        const temp = makeModel({ ...g, nextId: 0 } as GameState, 'x', s, 'family', p.tech, g.year);
        v = { power: st.powerKw, accel: st.zeroTo100, top: st.topSpeed, economy: st.scores.economy, reliability: st.scores.reliability, performance: st.scores.performance, prestige: st.scores.prestige, unit: estimateUnitCost(g, p, temp, 400), hours: st.labourHours, missing: missingTechs(s, p.tech), invalid: validateSpec(s) };
        cache.set(k, v);
      }
      return v;
    };
  }, [g.year, p.tech]);
}

function Delta({ v, unit = '', good = 'up', digits = 0, money: isMoney = false }: { v: number; unit?: string; good?: 'up' | 'down'; digits?: number; money?: boolean }) {
  const { lang } = useT();
  if (Math.abs(v) < (digits ? 0.05 : 0.5)) return <span className="g2-delta zero">=</span>;
  const better = good === 'up' ? v > 0 : v < 0;
  return <span className={'g2-delta ' + (better ? 'good' : 'bad')}>{v > 0 ? '+' : '−'}{isMoney ? money(Math.abs(v), lang) : Math.abs(v).toFixed(digits)}{unit}</span>;
}

function OptionCard({ o, spec, selected, onPick, evalSpec, lockedReason }: { o: Option; spec: VehicleSpec; selected: boolean; onPick: () => void; evalSpec: ReturnType<typeof useSpecEval>; lockedReason: string | null }) {
  const tx = useTx();
  const next = o.apply(spec), a = evalSpec(spec), b = evalSpec(next);
  const tech = b.missing.length ? tx('ws.locked.tech', { tech: b.missing.map((id) => TECH_BY_ID[id]?.name ?? id).join(', ') }) : null;
  const lock = lockedReason ?? tech ?? (b.invalid.length ? b.invalid[0] : null);
  return <button type="button" className={'g2-option' + (selected ? ' on' : '') + (lock ? ' locked' : '')} aria-pressed={selected} disabled={!!lock && !selected} onClick={() => { sfx.click(); onPick(); }} data-option={o.key}>
    <div className="g2-option-art">{o.art}</div>
    <b>{o.title}</b>
    {lock ? <span className="g2-lock">🔒 {lock}</span> : selected ? <span className="g2-chip on">{tx('ws.selected')}</span>
      : <span className="g2-deltas">
        <Delta v={b.power - a.power} unit=" kW" />
        <Delta v={b.accel - a.accel} unit=" s" good="down" digits={1} />
        <Delta v={b.reliability - a.reliability} unit=" ⚙" />
        <Delta v={b.unit - a.unit} good="down" money />
      </span>}
  </button>;
}

export function Workshop2D() {
  const { g, p } = useGame(), tx = useTx(), { lang, t } = useT();
  const tm = (k: string) => t(k as MessageKey);
  // the design studio's draft paint (if any) carries over to the engineering design
  const [spec, setSpec] = useState<VehicleSpec>(() => ({ ...(g.mode === 'founder' ? starterVehicle(g.year, p.specialization) : defaultVehicle(g.year)), color: p.designs?.draft?.paint ?? p.color }));
  const [name, setName] = useState('');
  const [step, setStep] = useState<Step>('engine');
  const [decade, setDecade] = useState<number | null>(null);
  const act = useStore((s) => s.act), save = useStore((s) => s.save), setView = useStore((s) => s.setView);
  const evalSpec = useSpecEval(g, p);
  const level = companyLevel(p);
  const cur = evalSpec(spec);
  const plan = useMemo(() => { const ch = defaultChoice(p, spec); return planDevelopment(g, p, spec, ch.engine, ch.platform); }, [spec, g.year, p.tech]);
  const seg = useMemo(() => suggestSegment(computeVehicle(spec, { year: g.year, tech: p.tech }).scores as unknown as Record<string, number>, spec.body, cur.unit, g.year), [spec, cur.unit]);
  const segName = SEGMENTS.find((x) => x.id === seg)?.name ?? seg;
  const idx = STEPS.indexOf(step);
  const set = (s: VehicleSpec) => setSpec(s);
  const opts = (list: Option[]) => <div className="g2-options">{list.map((o) => {
    const reason = o.from && o.from > g.year ? tx('ws.locked.era', { y: o.from }) : o.level && o.level > level ? tx('ws.locked.level', { n: o.level }) : null;
    return <OptionCard key={o.key} o={o} spec={spec} selected={JSON.stringify(o.apply(spec)) === JSON.stringify(spec)} onPick={() => set(o.apply(spec))} evalSpec={evalSpec} lockedReason={reason} />;
  })}</div>;
  const approve = () => {
    const before = new Set(p.models.map((m) => m.id));
    if (act((gg) => {
      const err = startDevelopment(gg, name, spec, seg);
      if (err) return err;
      // the visual configuration of the draft follows the new model (paint = the approved colour)
      const c = player(gg), nu = c.models.find((m) => !before.has(m.id));
      if (nu) { const draft = configOf(c, 'draft'); saveVehicleConfig(gg, nu.id, { ...draft, paint: /^#[0-9a-f]{6}$/i.test(spec.color) ? spec.color : draft.paint }); }
      return null;
    }, tx('ws.approved', { name }))) { sfx.claim(); void save('autosave'); setView('hq2d'); }
  };
  const decades = [...new Set(ICONIC_ENGINES.map((e) => e.decade))];
  const shownDecade = decade ?? decades.filter((d) => d <= g.year).slice(-1)[0] ?? decades[0];
  const cyl = CYL[spec.engine.layout] || 1;
  return <section className="g2 g2-workshop">
    <Heading kicker={tx('ws.kicker')} title={tx('ws.title')} sub={tx('ws.sub')} />
    <nav className="g2-steps" aria-label={tx('ws.kicker')}>
      {STEPS.map((s, i) => <button type="button" key={s} className={(step === s ? 'on' : '') + (i < idx ? ' done' : '')} aria-current={step === s ? 'step' : undefined} onClick={() => setStep(s)}><small>{String(i + 1).padStart(2, '0')}</small>{tx(STEP_KEY[s])}</button>)}
    </nav>
    <div className="g2-workshop-grid">
      <div className="g2-bench">
        {step === 'engine' && <>
          <h3>{tx('ws.layout')}</h3>
          {opts((['I3', 'I4', 'I6', 'V6', 'V8', 'V10', 'V12', 'F4', 'F6', 'EV'] as EngineLayout[]).map((l) => ({ key: l, title: l === 'EV' ? 'EV' : `${l} · ${((LAYOUT_CC[l] ?? 0) / 1000).toFixed(1)} L`, art: <Engine2D engine={{ layout: l, displacement: LAYOUT_CC[l], valvetrain: spec.engine.valvetrain }} compact />, apply: (s) => withEngine(s, l), from: l === 'EV' ? 1990 : undefined })))}
          {spec.engine.layout !== 'EV' && <div className="g2-tune"><h4>{tx('ws.tune')}</h4>
            <label>{tx('ws.displacement')} <b>{(spec.engine.displacement / 1000).toFixed(2)} L</b><input type="range" min={Math.ceil(cyl * 160 / 50) * 50} max={Math.floor(cyl * 950 / 50) * 50} step={50} value={spec.engine.displacement} onChange={(e) => set({ ...spec, engine: { ...spec.engine, displacement: Number(e.target.value) } })} /></label>
            <label>{tx('ws.induction')}<select value={spec.engine.aspiration} onChange={(e) => set({ ...spec, engine: { ...spec.engine, aspiration: e.target.value as VehicleSpec['engine']['aspiration'], boost: e.target.value === 'na' ? spec.engine.boost : Math.max(0.6, spec.engine.boost) } })}>
              {(['na', 'turbo', 'twinturbo', 'supercharged'] as const).map((a) => <option key={a} value={a}>{tx(`ind.${a}` as TxKey)}</option>)}</select></label>
          </div>}
          <h3>{tx('ws.iconic')}</h3>
          <p className="g2-soft">{tx('ws.iconic.note')}</p>
          <div className="g2-tabs" role="tablist">{decades.map((d) => <button type="button" role="tab" key={d} aria-selected={shownDecade === d} className={shownDecade === d ? 'on' : ''} onClick={() => setDecade(d)}>{tx('ws.decade', { d })}</button>)}</div>
          <div className="g2-iconic">{ICONIC_ENGINES.filter((e) => e.decade === shownDecade).map((e) => {
            const eraLock = e.year > g.year, lvlLock = e.level > level;
            const next = applyIconic(spec, e), ev = evalSpec(next);
            const techLock = ev.missing.length ? tx('ws.locked.tech', { tech: ev.missing.map((id) => TECH_BY_ID[id]?.name ?? id).join(', ') }) : null;
            const lock = eraLock ? tx('ws.locked.era', { y: e.year }) : lvlLock ? tx('ws.locked.level', { n: e.level }) : techLock;
            return <article key={e.id} className={'g2-iconic-card' + (lock ? ' locked' : '')} data-engine={e.id}>
              <Engine2D engine={{ ...e.preset }} compact />
              <div><span className="g2-kicker">{e.year} · {e.maker}</span><h4>{e.name}</h4><small>{e.car}</small>
                <dl><dt>{e.fact.layout}</dt><dd>{e.fact.displacementCc ? `${num(e.fact.displacementCc, lang)} cc · ` : ''}{e.fact.induction}</dd><dt>{tx('ws.rated')}</dt><dd>{e.fact.rated}</dd></dl>
                {e.fact.note && <p className="g2-soft">{e.fact.note}</p>}
                <p className="g2-sources">{tx('ws.sources')}: {e.sources.map((u, i) => <a key={u} href={u} target="_blank" rel="noreferrer noopener">[{i + 1}]</a>)}</p>
                {lock ? <span className="g2-lock">🔒 {lock}</span> : <button type="button" className="g2-btn" onClick={() => { sfx.click(); set(next); }}>{tx('ws.inspire')} · {fmtKw(ev.power)}</button>}
              </div>
            </article>;
          })}</div>
        </>}
        {step === 'chassis' && <>
          <h3>{tx('st.chassis')}</h3>
          {opts((['ladder', 'steel', 'spaceframe', 'aluminium', 'carbon'] as ChassisType[]).map((c) => ({ key: c, title: tm(`st.chassis.${c}`), art: <Chassis2D type={c} />, apply: (s) => ({ ...s, chassis: c }) })))}
          <h3>{tx('ws.drive')}</h3>
          {opts((['FWD', 'RWD', 'AWD'] as const).map((d) => ({ key: d, title: tm(`st.drive.${d}`), art: <div className="g2-drive" data-drive={d}><span /><span /></div>, apply: (s) => ({ ...s, drive: d }) })))}
        </>}
        {step === 'drivetrain' && <>
          <h3>{tx('st.drivetrain')}</h3>
          {opts((['manual', 'auto', 'dct'] as Gearbox[]).map((b) => ({ key: b, title: tm(`st.gearbox.${b}`), art: <Gearbox2D type={b} gears={spec.gears} />, apply: (s) => ({ ...s, gearbox: b }), from: b === 'dct' ? 2003 : b === 'auto' ? 1950 : undefined })))}
          <div className="g2-tune"><label>{tx('ws.gears')} <b>{spec.gears}</b><input type="range" min={3} max={10} value={spec.gears} onChange={(e) => set({ ...spec, gears: Number(e.target.value) })} /></label></div>
        </>}
        {step === 'running' && <>
          <h3>{tx('ws.front')}</h3>
          {opts((['solid', 'macpherson', 'wishbone', 'multilink'] as SuspType[]).map((t) => ({ key: 'f' + t, title: tm(`st.susp.${t}`), art: <Suspension2D type={t} />, apply: (s) => ({ ...s, suspFront: t }) })))}
          <h3>{tx('ws.rear')}</h3>
          {opts((['solid', 'macpherson', 'wishbone', 'multilink'] as SuspType[]).map((t) => ({ key: 'r' + t, title: tm(`st.susp.${t}`), art: <Suspension2D type={t} />, apply: (s) => ({ ...s, suspRear: t }) })))}
          <h3>{tx('ws.brakes')}</h3>
          {opts((['drum', 'disc', 'vented', 'ceramic'] as BrakeType[]).map((t) => ({ key: t, title: tm(`st.brakes.${t}`), art: <Brake2D type={t} />, apply: (s) => ({ ...s, brakes: t }) })))}
        </>}
        {step === 'body' && <>
          <h3>{tx('st.body')}</h3>
          {opts((['hatch', 'sedan', 'wagon', 'coupe', 'roadster', 'supercar', 'suv', 'pickup'] as BodyType[]).map((b) => ({ key: b, title: tx(`body.${b}` as TxKey), art: <Car2D body={b} year={g.year} color={spec.color} ground={false} />, apply: (s) => ({ ...s, body: b, seats: b === 'coupe' || b === 'roadster' || b === 'supercar' ? 2 : b === 'pickup' ? 3 : 5 }) })))}
          <div className="g2-tune"><label>{tx('ws.size')} <b>{Math.round(spec.size * 100)}%</b><input type="range" min={0.85} max={1.15} step={0.01} value={spec.size} onChange={(e) => set({ ...spec, size: Number(e.target.value) })} /></label></div>
        </>}
        {step === 'wheels' && <>
          <h3>{tx('ws.tyres')}</h3>
          {opts((['economy', 'touring', 'sport', 'semislick'] as TireCompound[]).map((t) => ({ key: t, title: tm(`st.tyre.${t}`), art: <Tyre2D compound={t} width={spec.tireWidth} />, apply: (s) => ({ ...s, tireCompound: t }) })))}
          <div className="g2-tune">
            <label>{tx('ws.rim')} <b>{spec.wheelDia}"</b><input type="range" min={13} max={22} value={spec.wheelDia} onChange={(e) => set({ ...spec, wheelDia: Number(e.target.value) })} /></label>
            <label>{tx('ws.wheelStyle')}<select value={spec.wheelStyle ?? ''} onChange={(e) => set({ ...spec, wheelStyle: (e.target.value || undefined) as WheelStyle | undefined })}><option value="">{tx('wh.default')}</option>{(['multispoke', 'fivespoke', 'turbine'] as const).map((w) => <option key={w} value={w}>{tx(`wh.${w}` as TxKey)}</option>)}</select></label>
          </div>
        </>}
        {step === 'finish' && <>
          <h3>{tx('ws.paint')}</h3>
          <div className="g2-swatches" role="group" aria-label={tx('ws.paint')}>{PAINTS.map((c) => <button type="button" key={c} style={{ background: c }} aria-label={c} aria-pressed={spec.color === c} className={spec.color === c ? 'on' : ''} onClick={() => set({ ...spec, color: c })} />)}</div>
          <div className="g2-tune">
            <label>{tx('ws.finishType')}<select value={spec.finish ?? ''} onChange={(e) => set({ ...spec, finish: (e.target.value || undefined) as PaintFinish | undefined })}><option value="">—</option>{(['solid', 'metallic', 'pearl', 'matte'] as const).map((f) => <option key={f} value={f}>{tx(`fin.${f}` as TxKey)}</option>)}</select></label>
            <label>{tx('ws.interior')}<select value={spec.interior} onChange={(e) => set({ ...spec, interior: e.target.value as VehicleSpec['interior'] })}>{(['basic', 'standard', 'premium', 'luxury'] as const).map((f) => <option key={f} value={f}>{tx(`int.${f}` as TxKey)}</option>)}</select></label>
            <label>{tx('ws.quality')} <b>{Math.round(spec.quality * 100)}%</b><input type="range" min={0.1} max={1} step={0.05} value={spec.quality} onChange={(e) => set({ ...spec, quality: Number(e.target.value) })} /></label>
          </div>
        </>}
        {step === 'approve' && <div className="g2-approve">
          <label className="g2-name">{tx('ws.name')}<input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={tx('ws.namePh')} data-field="model-name" /></label>
          {cur.missing.length > 0 && <p className="g2-warn">{tx('ws.missing', { list: cur.missing.map((id) => TECH_BY_ID[id]?.name ?? id).join(', ') })}</p>}
          {cur.invalid.length > 0 && <p className="g2-warn">{tx('ws.invalid', { why: cur.invalid[0] })}</p>}
          {!plan.ok && <p className="g2-warn">{plan.errors[0]}</p>}
          {p.engineers < 5 && <p className="g2-warn">{tx('ws.needEng')} <button type="button" className="g2-btn" onClick={() => act((gg) => setEngineers(gg, 5))}>{tx('ws.hire')}</button></p>}
          <button type="button" className="g2-btn gold big" data-action="2d-start-development" disabled={!name.trim() || p.engineers < 5} onClick={approve}>{tx('ws.approve')} · {money(plan.total, lang)}</button>
          <p className="g2-soft">{tx('ws.devDone')}</p>
        </div>}
      </div>
      <aside className="g2-preview">
        <span className="g2-kicker">{tx('ws.preview')}</span>
        {step === 'engine' ? <Engine2D engine={spec.engine} /> : step === 'chassis' ? <Chassis2D type={spec.chassis} /> : g.year >= 1985 ? <HeroShowroom2D compact color={spec.color} body={spec.body} label={name || tx('ws.unnamed')} /> : <CarArt spec={spec} year={g.year} equipped={p.arcade?.equipped} />}
        <h3>{name || tx('ws.unnamed')}</h3>
        <dl className="g2-specs">
          <dt>{tx('ws.power')}</dt><dd>{fmtKw(cur.power)}</dd>
          <dt>{tx('ws.accel')}</dt><dd>{cur.accel.toFixed(1)} s</dd>
          <dt>{tx('ws.top')}</dt><dd>{Math.round(cur.top)} km/h</dd>
          <dt>{tx('ws.performance')}</dt><dd><i className="g2-bar"><em style={{ width: `${cur.performance}%` }} /></i></dd>
          <dt>{tx('ws.economy')}</dt><dd><i className="g2-bar"><em style={{ width: `${cur.economy}%` }} /></i></dd>
          <dt>{tx('ws.reliability')}</dt><dd><i className="g2-bar"><em style={{ width: `${cur.reliability}%` }} /></i></dd>
          <dt>{tx('ws.prestige')}</dt><dd><i className="g2-bar"><em style={{ width: `${cur.prestige}%` }} /></i></dd>
          <dt>{tx('ws.unitCost')}</dt><dd>{money(cur.unit, lang)}</dd>
          <dt>{tx('ws.budget')}</dt><dd>{money(plan.total, lang)} · {tx('ws.months', { n: plan.months })}</dd>
          <dt>{tx('ws.segment')}</dt><dd>{segName}</dd>
        </dl>
        <div className="g2-preview-nav"><button type="button" className="g2-btn" disabled={idx === 0} onClick={() => setStep(STEPS[idx - 1])}>{tx('ws.prev')}</button><button type="button" className="g2-btn gold" disabled={idx === STEPS.length - 1} onClick={() => setStep(STEPS[idx + 1])}>{tx('ws.next')} →</button></div>
      </aside>
    </div>
  </section>;
}

// ------------------------------------------------------------------------------------------------ factory
export function FactoryFloor2D() {
  const { g, p } = useGame(), tx = useTx(), { lang } = useT();
  const [fid, setFid] = useState(p.factories[0]?.id ?? '');
  const [sector, setSector] = useState<Sector>('body');
  const act = useStore((s) => s.act), ask = useStore((s) => s.ask), save = useStore((s) => s.save), setView = useStore((s) => s.setView);
  const f = p.factories.find((x) => x.id === fid) ?? p.factories[0];
  if (!f) return <section className="g2"><Heading kicker={tx('fa.kicker')} title={tx('fa.title')} sub={tx('fa.sub')} />
    <div className="g2-panel g2-empty"><p>{tx('fa.none', { n: buildMonths(g, 'plant') })}</p><button type="button" className="g2-btn gold" onClick={() => setView('factories')}>{tx('fa.build')}</button></div></section>;
  const st = stagesOf(f), bn = bottleneck(f), out = f.lastOutput ?? 0, L = p.ledger[p.ledger.length - 1];
  const sold = L?.units ?? 0, stock = p.models.reduce((a, m) => a + m.inventory, 0);
  const useOf = (cap: number) => (cap > 0 ? Math.min(1.2, out / cap) : 0);
  const load: Record<Sector, SectorLoad> = {
    materials: { use: f.capacity > 0 ? Math.min(1, out / f.capacity) * (1 - (p.supply?.lastLoss ?? 0)) : 0, working: out > 0 },
    body: { use: useOf(st.body), bottleneck: bn === 'body', working: out > 0 }, paint: { use: useOf(st.paint), bottleneck: bn === 'paint', working: out > 0 },
    powertrain: { use: useOf(st.powertrain), bottleneck: bn === 'powertrain', working: out > 0 }, assembly: { use: useOf(st.assembly), bottleneck: bn === 'assembly', working: out > 0 },
    inspection: { use: useOf(st.inspection), bottleneck: bn === 'inspection', working: out > 0 }, dispatch: { use: out > 0 ? Math.min(1, sold / out) : 0, working: out > 0 },
  };
  const labels = Object.fromEntries(SECTORS.map((s) => [s, tx(`sec.${s}` as TxKey)])) as Record<Sector, string>;
  const stageId = sector === 'body' || sector === 'paint' || sector === 'powertrain' || sector === 'assembly' || sector === 'inspection' ? sector : null;
  const add = Math.max(10, Math.round(f.capacity * 0.25));
  const doStage = () => { if (!stageId) return; const cost = stageCost(f, stageId, add, g.year); ask(tx('fa.expandStage', { n: num(add, lang), cost: money(cost, lang), m: buildMonths(g, 'stage') }), () => { if (act((gg) => expandStage(gg, f.id, stageId, add), tx('fa.done'))) void save('autosave'); }); };
  const nextAuto = Math.min(maxAutomation(p), Math.round((f.automation + 0.15) * 100) / 100);
  const autoCost = automationCost(f.capacity, f.automation, nextAuto, g.year);
  const expCost = factoryBuildCost(Math.round(f.capacity * 0.5), f.automation, g.year) * 0.85;
  const lines = f.lines.map((l) => ({ m: p.models.find((x) => x.id === l.modelId), units: f.capacity * l.share }));
  return <section className="g2 g2-factory">
    <FlowBar title={lang === 'es' ? 'Fábrica' : 'Factory'}><span>{tx('fa.capacity')} {tx('fa.perMonth', { n: num(f.capacity, lang) })}</span><span>{tx('fa.output')} {num(out, lang)}</span><span>{tx('fa.automation')} {Math.round(f.automation * 100)}%</span></FlowBar>
    {p.factories.length > 1 && <div className="g2-tabs" role="tablist">{p.factories.map((x) => <button type="button" role="tab" key={x.id} aria-selected={x.id === f.id} className={x.id === f.id ? 'on' : ''} onClick={() => setFid(x.id)}>{x.name}</button>)}</div>}
    <div className="g2-plant-head">
      <div><b>{f.name}</b><small>{f.country} · {tx('fa.capacity')} {tx('fa.perMonth', { n: num(f.capacity, lang) })} · {tx('fa.automation')} {Math.round(f.automation * 100)}%</small></div>
      {f.expansion && <span className="g2-chip warn">{tx('fa.expansion', { n: num(f.expansion.add, lang), m: f.expansion.monthsLeft })}</span>}
    </div>
    <FlowFactoryScene load={load} active={sector} onPick={(s) => { sfx.click(); setSector(s); }} producing={out > 0} />
    <FlowQueue g={g} p={p} f={f} />
    <div className="g2-sector-tabs" role="tablist" aria-label={tx('fa.kicker')}>{SECTORS.map((s) => <button type="button" role="tab" key={s} aria-selected={sector === s} className={(sector === s ? 'on' : '') + (load[s].bottleneck ? ' bn' : '')} data-sector={s} onClick={() => setSector(s)}>{labels[s]}</button>)}</div>
    <div className="g2-sector-grid">
      <div className="g2-panel g2-sector" data-sector-detail={sector}>
        <span className="g2-kicker">{labels[sector]}</span>
        {stageId && <>
          <div className="g2-numbers"><div><span>{tx('fa.capacity')}</span><b>{tx('fa.perMonth', { n: num(st[stageId], lang) })}</b></div><div><span>{tx('fa.output')}</span><b>{num(out, lang)}</b></div><div><span>%</span><b>{Math.round(load[sector].use * 100)}%</b></div></div>
          {load[sector].bottleneck && <p className="g2-warn">{tx('fa.bottleneck')}</p>}
          {f.stageWork ? <p className="g2-chip warn">{tx('fa.stageWork', { n: num(f.stageWork.add, lang), m: f.stageWork.monthsLeft })}</p>
            : <button type="button" className="g2-btn gold" data-action="2d-expand-stage" onClick={doStage}>{tx('fa.expandStage', { n: num(add, lang), cost: money(stageCost(f, stageId, add, g.year), lang), m: buildMonths(g, 'stage') })}</button>}
          {stageId === 'inspection' && <label className="g2-tune">{tx('fa.inspection')} <b>{Math.round(inspectionOf(f) * 100)}%</b><input type="range" min={0} max={1} step={0.05} value={inspectionOf(f)} onChange={(e) => act((gg) => setInspection(gg, f.id, Number(e.target.value)))} /><small className="g2-soft">{tx('fa.inspection.hint')}</small></label>}
        </>}
        {sector === 'materials' && <>
          <p>{tx('fa.contracts.n', { n: Object.keys(p.supply?.contracts ?? {}).length, loss: Math.round((p.supply?.lastLoss ?? 0) * 100) })}</p>
          <button type="button" className="g2-btn" onClick={() => setView('factories')}>{tx('fa.suppliers')} ↗</button>
        </>}
        {sector === 'dispatch' && <div className="g2-numbers"><div><span>{tx('fa.stock')}</span><b>{num(stock, lang)}</b></div><div><span>{tx('fa.sold')}</span><b>{num(sold, lang)}</b></div><div><span>{tx('fa.output')}</span><b>{num(out, lang)}</b></div></div>}
      </div>
      <div className="g2-panel">
        <span className="g2-kicker">{tx('fa.lines')}</span>
        <ul className="g2-lines">{lines.map((l, i) => <li key={i}><b>{l.m?.name ?? '—'}</b><span>{tx('fa.perMonth', { n: num(l.units, lang) })}</span></li>)}</ul>
        <div className="g2-actions">
          {f.automation < maxAutomation(p) - 0.01 && f.capacity > 0 && <button type="button" className="g2-btn" onClick={() => ask(tx('fa.automate', { to: Math.round(nextAuto * 100), cost: money(autoCost, lang) }), () => { if (act((gg) => upgradeAutomation(gg, f.id, nextAuto), tx('fa.done'))) void save('autosave'); })}>{tx('fa.automate', { to: Math.round(nextAuto * 100), cost: money(autoCost, lang) })}</button>}
          {!f.expansion && f.capacity > 0 && <button type="button" className="g2-btn" onClick={() => ask(tx('fa.expand', { cost: money(expCost, lang), m: buildMonths(g, 'expansion') }), () => { if (act((gg) => expandFactory(gg, f.id, Math.round(f.capacity * 0.5)), tx('fa.done'))) void save('autosave'); })}>{tx('fa.expand', { cost: money(expCost, lang), m: buildMonths(g, 'expansion') })}</button>}
          <button type="button" className="g2-btn" onClick={() => setView('factories')}>{tx('fa.manage')} ↗</button>
        </div>
      </div>
    </div>
  </section>;
}

// ------------------------------------------------------------------------------------------------ achievements, chests, collection, shop
export type CoTab = 'goals' | 'chests' | 'cards' | 'shop';
export function Collection2D({ initialTab = 'goals' }: { initialTab?: CoTab } = {}) {
  const { g, p } = useGame(), tx = useTx(), { lang } = useT();
  const act = useStore((s) => s.act), save = useStore((s) => s.save);
  const [tab, setTab] = useState<CoTab>(initialTab);
  const [slot, setSlot] = useState<PartSlot | 'all'>('all');
  const claim = useClaim();
  const sales = lifetimeSales(p), inv = p.arcade?.inventory ?? {}, credits = p.arcade?.credits ?? 0, level = companyLevel(p);
  const views = achievementViews(g, p);
  const equip = (id: string) => { if (act((gg) => equipPart(gg, id))) { sfx.click(); void save('autosave'); } };
  const unequip = (s: PartSlot) => { if (act((gg) => { const a = player(gg).arcade; if (a) delete a.equipped[s]; return null; })) void save('autosave'); };
  const owned = BLUEPRINTS.filter((b) => inv[b.id]).length;
  return <section className="g2 g2-collection">
    <Heading kicker={tx('co.kicker')} title={tx('co.title')} sub={tx('co.sub')} />
    <div className="g2-hub-stats inline"><LevelBadge p={p} /><div className="g2-stat"><span>{tx('hub.sold')}</span><b>{num(sales, lang)}</b></div><div className="g2-stat"><span>{tx('hub.credits')}</span><b>{num(credits, lang)}</b></div><div className="g2-stat"><span>{tx('tab.cards')}</span><b>{owned}/{BLUEPRINTS.length}</b></div></div>
    <div className="g2-tabs big" role="tablist">{(['goals', 'chests', 'cards', 'shop'] as CoTab[]).map((t) => <button type="button" role="tab" key={t} aria-selected={tab === t} className={tab === t ? 'on' : ''} data-tab={t} onClick={() => setTab(t)}>{tx(`tab.${t}` as TxKey)}{t === 'goals' && views.some((v) => v.done && !v.claimed) ? ' •' : ''}{t === 'chests' && availableMilestones(p).length ? ' •' : ''}</button>)}</div>
    {tab === 'goals' && <ul className="g2-goals grid">{views.map((v) => <GoalRow key={v.a.id} v={v} onClaim={claim} />)}</ul>}
    {tab === 'chests' && <ChestRoom />}
    {tab === 'cards' && <>
      <div className="g2-showcase"><div><span className="g2-kicker">{tx('co.showcase')}</span><p className="g2-soft">{tx('co.showcase.sub')}</p>
        <div className="g2-equipped">{(['body', 'wheels', 'engine', 'chassis'] as PartSlot[]).map((s) => { const id = p.arcade?.equipped[s]; const b = id ? BLUEPRINTS.find((x) => x.id === id) : null; return <span key={s} className="g2-chip">{tx(`slot.${s}` as TxKey)}: {b ? (lang === 'es' ? b.es : b.en) : '—'}{b && <button type="button" aria-label={tx('co.unequip')} onClick={() => unequip(s)}>×</button>}</span>; })}</div></div>
        <Car2D body={p.models[0]?.spec.body ?? 'coupe'} year={g.year} color={p.models[0]?.spec.color ?? p.color} equipped={p.arcade?.equipped} moving /></div>
      <div className="g2-tabs" role="tablist">{(['all', 'body', 'wheels', 'engine', 'chassis'] as const).map((s) => <button type="button" role="tab" key={s} aria-selected={slot === s} className={slot === s ? 'on' : ''} onClick={() => setSlot(s)}>{s === 'all' ? tx('co.filter.all') : tx(`slot.${s}` as TxKey)}</button>)}</div>
      <p className="g2-soft">{tx('co.owned', { n: owned, t: BLUEPRINTS.length })}</p>
      <div className="g2-cards">{BLUEPRINTS.filter((b) => slot === 'all' || b.slot === slot).map((b) => {
        const own = inv[b.id] ?? 0, eq = p.arcade?.equipped[b.slot] === b.id, era = b.firstYear > g.year;
        return <PartCard key={b.id} part={b} owned={own} equipped={eq} locked={era} lang={lang}>
          {own ? <button type="button" className="g2-btn" disabled={eq || era} onClick={() => equip(b.id)}>{eq ? tx('co.equipped') : tx('co.equip')}</button> : <span className="g2-soft">{era ? tx('co.locked', { y: b.firstYear }) : tx('co.missing')}</span>}
        </PartCard>;
      })}</div>
    </>}
    {tab === 'shop' && <>
      <div className="g2-panel"><h3>{tx('shop.title')}</h3><p className="g2-soft">{tx('shop.sub')}</p></div>
      <div className="g2-cards">{BLUEPRINTS.filter((b) => b.firstYear <= g.year).map((b) => {
        const own = !!inv[b.id], price = fixedPrice(b.rarity), need = REDEEM_LEVEL[b.rarity];
        return <PartCard key={b.id} part={b} owned={own ? 1 : 0} lang={lang}>
          {own ? <span className="g2-chip on">{tx('shop.owned')}</span>
            : b.rarity === 'relic' ? <span className="g2-soft">{tx('shop.relic')}</span>
            : level < need ? <span className="g2-lock">🔒 {tx('shop.needLevel', { n: need })}</span>
            : <button type="button" className="g2-btn gold" disabled={credits < price} onClick={() => { if (act((gg) => redeemPart(gg, b.id))) { sfx.claim(); void save('autosave'); } }}>{tx('shop.redeem', { n: num(price, lang) })}</button>}
        </PartCard>;
      })}</div>
      <div className="g2-panel g2-future"><h3>{tx('shop.packs')}</h3><p>{tx('shop.packs.note')}</p><button type="button" className="g2-btn" disabled>{tx('shop.unavailable')}</button></div>
    </>}
  </section>;
}

// ------------------------------------------------------------------------------------------------ marketing
export function Campaigns2D() {
  const { g, p } = useGame(), tx = useTx(), { lang } = useT();
  const [budget, setBudget] = useState(Math.max(0, p.marketingBudget));
  const [amount, setAmount] = useState<Partial<Record<RegionId, number>>>({});
  const act = useStore((s) => s.act), save = useStore((s) => s.save);
  const rev = p.ledger.slice(-12).reduce((a, l) => a + l.revenue, 0);
  const max = Math.max(1e6, Math.ceil(Math.max(p.marketingBudget * 2, rev * 0.1 / 12, p.cash * 0.02) / 1e5) * 1e5);
  const car = p.models.find((m) => m.status === 'production') ?? p.models[0];
  return <section className="g2 g2-campaigns">
    <Heading kicker={tx('mk.kicker')} title={tx('mk.title')} sub={tx('mk.sub')} />
    <div className="g2-campaign-grid">
      <div className="g2-panel g2-billboard-card">
        <div className="g2-billboard" style={{ ['--brand' as string]: p.color }}><div><b>{p.name.toUpperCase()}</b><span>{tx('mk.slogan')}</span></div>{car ? <CarArt spec={car.spec} year={car.designYear} equipped={p.arcade?.equipped} moving /> : <Car2D body="coupe" year={g.year} color={p.color} />}</div>
        <label className="g2-tune">{tx('mk.budget')} <b>{money(budget, lang)}</b><input type="range" min={0} max={max} step={Math.max(1e4, Math.round(max / 100 / 1e4) * 1e4)} value={budget} onChange={(e) => setBudget(Number(e.target.value))} aria-label={tx('mk.budget')} /></label>
        <button type="button" className="g2-btn gold" data-action="2d-marketing" onClick={() => { if (act((gg) => { setMarketing(gg, budget); return null; }, tx('mk.done'))) void save('autosave'); }}>{tx('mk.confirm')}</button>
      </div>
      <div className="g2-panel">
        <h3>{tx('mk.awareness')}</h3>
        <ul className="g2-regions">{REGIONS.map((r) => <li key={r.id}><span>{r.short}</span><i className="g2-bar"><em style={{ width: `${Math.round(p.awareness[r.id])}%` }} /></i><b>{Math.round(p.awareness[r.id])}%</b></li>)}</ul>
      </div>
    </div>
    <div className="g2-panel">
      <h3>{tx('mk.dealers')}</h3>
      <div className="g2-dealers">{REGIONS.map((r) => {
        const a = amount[r.id] ?? Math.max(1e6, Math.round(p.cash * 0.02 / 1e6) * 1e6);
        const pvD = dealerInvestPreview(g, p, r.id, a), entry = pvD.setup, adds = pvD.add;
        const vol = SEGMENTS.reduce((s, sd) => s + segVolume(r.id, sd.id, g.year), 0);
        return <article key={r.id} className="g2-dealer" data-region={r.id}>
          <header><b>{r.name}</b>{r.id === p.homeRegion && <span className="g2-chip on">★</span>}</header>
          <i className="g2-bar"><em style={{ width: `${Math.min(100, (p.reach[r.id] / vol) * 100 * 20)}%` }} /></i>
          <small>{tx('mk.reach', { n: num(p.reach[r.id], lang) })}</small>
          <input type="number" min={1} value={Math.round(a / 1e6)} aria-label={`${r.name} M$`} onChange={(e) => setAmount({ ...amount, [r.id]: Number(e.target.value) * 1e6 })} />
          <small className="g2-soft">{entry > 0 ? tx('mk.entry', { v: money(entry, lang) }) : tx('mk.adds', { n: num(adds, lang) })}</small>
          <button type="button" className="g2-btn" onClick={() => { if (act((gg) => investDealers(gg, r.id, a), tx('mk.dealersDone'))) void save('autosave'); }}>{tx('mk.invest', { v: money(a, lang) })}</button>
        </article>;
      })}</div>
    </div>
  </section>;
}

// ------------------------------------------------------------------------------------------------ rankings
type Metric = 'units' | 'revenue' | 'profit' | 'prestige' | 'innovation' | 'share';
const METRICS: Metric[] = ['units', 'revenue', 'profit', 'prestige', 'innovation', 'share'];
function metricValue(c: Company, m: Metric, g: GameState, ago = 0): number | null {
  const l = c.ledger.slice(c.ledger.length - 12 - ago, ago ? c.ledger.length - ago : undefined);
  if (ago && l.length < 12) return null;
  // a game younger than a year is annualised, the same basis as annualUnits() on the headquarters screen
  const scale = ago ? 1 : 12 / Math.max(1, Math.min(12, l.length));
  const sum = (k: 'units' | 'revenue' | 'profit') => l.reduce((a, x) => a + x[k], 0) * scale;
  if (m === 'units') return sum('units'); if (m === 'revenue') return sum('revenue'); if (m === 'profit') return sum('profit');
  if (ago) return null;
  if (m === 'prestige') return c.prestige;
  if (m === 'innovation') return Object.values(c.tech).reduce((a, v) => a + v, 0) / 5 - g.year;
  const world = REGION_IDS.reduce((a, r) => a + SEGMENTS.reduce((s, sd) => s + segVolume(r, sd.id, g.year), 0), 0);
  return world > 0 ? (sum('units') / world) * 100 : 0;
}
export function League2D() {
  const { g, p } = useGame(), tx = useTx(), { lang } = useT();
  const [scope, setScope] = useState<'industry' | 'racing'>('industry');
  const [metric, setMetric] = useState<Metric>('units');
  const alive = g.companies.filter((c) => c.alive);
  const fmt = (m: Metric, v: number) => (m === 'revenue' || m === 'profit' ? money(v, lang) : m === 'prestige' ? Math.round(v).toString() : m === 'innovation' ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}` : m === 'share' ? `${v.toFixed(2)}%` : num(v, lang));
  const rows = alive.map((c) => ({ c, v: metricValue(c, metric, g) ?? 0, prev: metricValue(c, metric, g, 12) })).sort((a, b) => b.v - a.v);
  const prevRank = new Map(rows.filter((r) => r.prev !== null).sort((a, b) => (b.prev ?? 0) - (a.prev ?? 0)).map((r, i) => [r.c.id, i + 1]));
  const mine = rows.findIndex((r) => r.c.id === p.id) + 1;
  const awards: { k: Metric; c: Company }[] = (['units', 'profit', 'innovation'] as Metric[]).map((k) => ({ k, c: alive.slice().sort((a, b) => (metricValue(b, k, g) ?? 0) - (metricValue(a, k, g) ?? 0))[0] }));
  const div = p.motorsport;
  const st = div ? standings(div.championship) : null;
  return <section className="g2 g2-league">
    <Heading kicker={tx('lg.kicker')} title={tx('lg.title')} sub={tx('lg.sub')} />
    <div className="g2-tabs big" role="tablist"><button type="button" role="tab" aria-selected={scope === 'industry'} className={scope === 'industry' ? 'on' : ''} onClick={() => setScope('industry')}>{tx('lg.industry')}</button><button type="button" role="tab" aria-selected={scope === 'racing'} className={scope === 'racing' ? 'on' : ''} onClick={() => setScope('racing')}>{tx('lg.racing')}</button></div>
    {scope === 'industry' && !alive.some((c) => c.ledger.length > 0) && <div className="g2-panel g2-empty"><p>{tx('lg.wait')}</p></div>}
    {scope === 'industry' && alive.some((c) => c.ledger.length > 0) && <>
      <div className="g2-tabs" role="tablist">{METRICS.map((m) => <button type="button" role="tab" key={m} aria-selected={metric === m} className={metric === m ? 'on' : ''} data-metric={m} onClick={() => setMetric(m)}>{tx(`m.${m}` as TxKey)}</button>)}</div>
      <div className="g2-podium">{rows.slice(0, 3).map((r, i) => <div key={r.c.id} className={`g2-step g2-step-${i + 1}${r.c.id === p.id ? ' me' : ''}`}><span className="g2-medal">{i + 1}</span><i style={{ background: r.c.color }} /><b>{r.c.name}</b><small>{fmt(metric, r.v)}</small></div>)}</div>
      <div className="g2-panel g2-table-wrap"><div className="g2-your-rank">{tx('lg.yourRank')}: <b>#{mine}</b> · {fmt(metric, rows[mine - 1]?.v ?? 0)}</div>
        <table className="g2-table"><tbody>{rows.slice(0, 20).map((r, i) => {
          const pr = prevRank.get(r.c.id), mv = pr ? pr - (i + 1) : null;
          return <tr key={r.c.id} className={r.c.id === p.id ? 'me' : ''}><td>{i + 1}</td><td className="mv">{mv === null ? <span className="g2-move">·</span> : mv > 0 ? <span className="g2-move up">▲{mv}</span> : mv < 0 ? <span className="g2-move down">▼{-mv}</span> : <span className="g2-move">=</span>}</td><td><i className="g2-swatch" style={{ background: r.c.color }} />{r.c.name}{r.c.id === p.id && <span className="g2-chip on">{tx('lg.you')}</span>}</td><td className="r">{fmt(metric, r.v)}</td></tr>;
        })}</tbody></table>
        {mine > 20 && <p className="g2-soft">#{mine} · {p.name} · {fmt(metric, rows[mine - 1].v)}</p>}
        <small className="g2-soft">▲▼ {tx('lg.change')} · {tx('lg.basis')}</small>
      </div>
      <div className="g2-panel"><h3>{tx('lg.awards')} {g.year}</h3><div className="g2-awards">{awards.filter((a) => a.c).map((a) => <div key={a.k} className={a.c.id === p.id ? 'me' : ''}><span>🏆 {tx(`m.${a.k}` as TxKey)}</span><b>{a.c.name}</b><small>{fmt(a.k, metricValue(a.c, a.k, g) ?? 0)}</small></div>)}</div></div>
    </>}
    {scope === 'racing' && (!div || !st ? <div className="g2-panel g2-empty"><p>{tx('lg.noRacing')}</p></div> : <div className="g2-panel">
      <h3>{tx('lg.season', { name: div.championship.name, y: div.championship.year })}</h3>
      <table className="g2-table"><tbody>{st.teams.map((t, i) => <tr key={t.id} className={t.id === div.teamId ? 'me' : ''}><td>{i + 1}</td><td><i className="g2-swatch" style={{ background: t.color }} />{t.name}</td><td className="r">{div.championship.teamPoints[t.id] ?? 0} {tx('lg.pts')}</td></tr>)}</tbody></table>
    </div>)}
    <p className="g2-soft">{tx('lg.online')}</p>
  </section>;
}

void ACHIEVEMENTS;
