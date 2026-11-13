// Vehicle engineering studio (Phase 4C): three columns around the real 3D car.
//   left   — engineering and component choices (Basic: the decisions that matter; Advanced: every parameter, by system)
//   centre — the interactive 3D vehicle with studio controls, then engine curves, mass and cost analysis
//   right  — performance, ratings, profitability and the development programme
// Every figure comes from the same physical and cost models as before; this file only arranges and labels them.
import { useMemo, useState, type ReactNode } from 'react';
import type { BodyType, EngineLayout, PaintFinish, SegmentId, VehicleSpec, WheelStyle } from '../sim/types';
import { useGame, useStore } from '../store/game';
import { useT, type MessageKey } from '../i18n';
import { useTerm } from '../i18n/terms';
import { money, num, pct } from '../i18n/format';
import { BODY, CYL, LAYOUT_NAME, SCORE_KEYS, computeVehicle, suggestFinalDrive } from '../sim/engineering';
import { hasTech, missingTechs, TECH_BY_ID } from '../data/tech';
import { SEG, SEGMENTS, segPrice } from '../data/world';
import { startDevelopment, validateSpec } from '../sim/actions';
import { creditLimit, estimateUnitCost, makeModel } from '../sim/company';
import { computeMarket, suggestSegment } from '../sim/market';
import { TYPICAL_VOLUME, priceGuide } from '../sim/pricing';
import { BAY_NAME, CLASS_NAME, defaultChoice, enginesOf, familyEngine, familyUsers, findVariant, planDevelopment, platformsOf, platformUsers, type EngineChoice, type PlatformChoice } from '../sim/families';
import { specDescriptor } from '../sim/render';
import { FINISH_NAME } from '../three/assets/names';
import { BarList, LineChart, ScoreBar, Select, Slider, StatLine } from './common';
import { Icon, type IconName } from './ds/icons';
import { Panel, StackBar, Tabs } from './ds/primitives';
import { VehicleStage } from './VehicleStage';

type Section = 'architecture' | 'body' | 'chassis' | 'engine' | 'driveline' | 'running' | 'aero' | 'cabin';
const SECTIONS: { id: Section; icon: IconName }[] = [
  { id: 'architecture', icon: 'layers' }, { id: 'body', icon: 'vehicle' }, { id: 'chassis', icon: 'box' }, { id: 'engine', icon: 'bolt' },
  { id: 'driveline', icon: 'route' }, { id: 'running', icon: 'wheel' }, { id: 'aero', icon: 'gauge' }, { id: 'cabin', icon: 'users' },
];
const LAYOUTS: EngineLayout[] = ['I2', 'I3', 'I4', 'I5', 'I6', 'V6', 'V8', 'V10', 'V12', 'F4', 'F6', 'F12', 'EV'];
const PAINTS = ['#b3261e', '#f2f2f0', '#15171b', '#8f969e', '#1f5fbf', '#0c4d2c', '#e8b04a', '#d95926', '#5b2a86'];
const k = (s: string) => s as MessageKey;

export type StudioSection = Section;
export const STUDIO_SECTIONS = SECTIONS.map((s) => s.id);

export function Studio({ init, basedOn, initName, onClose, initialMode = 'basic', initialSection = 'architecture' }: { init: VehicleSpec; basedOn?: string; initName: string; onClose: () => void; initialMode?: 'basic' | 'advanced'; initialSection?: Section }) {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const term = useTerm();
  const act = useStore((s) => s.act), ask = useStore((s) => s.ask);
  const [rawSpec, setSpec] = useState<VehicleSpec>(init);
  const [section, setSection] = useState<Section>(initialSection);
  const [mode, setMode] = useState<'basic' | 'advanced'>(initialMode);
  const [analysis, setAnalysis] = useState<'curves' | 'mass' | 'cost'>('curves');
  // architecture: 'auto' re-uses what fits (as engineering would), 'new' develops it with the car, or a chosen family / platform
  const [engSel, setEngSel] = useState<string>('auto');
  const [platSel, setPlatSel] = useState<string>('auto');
  const base = basedOn ? p.models.find((m) => m.id === basedOn) : undefined;
  const auto = useMemo(() => defaultChoice(p, rawSpec, base), [rawSpec, p.engines?.length, p.platforms?.length]);
  const engineChoice: EngineChoice = engSel === 'auto' ? auto.engine : engSel === 'new' ? { kind: 'new' } : { kind: 'family', familyId: engSel };
  const platformChoice: PlatformChoice = platSel === 'auto' ? auto.platform : platSel === 'new' ? { kind: 'new' } : { kind: 'platform', platformId: platSel };
  const plan = useMemo(() => planDevelopment(g, p, rawSpec, engineChoice, platformChoice), [rawSpec, engSel, platSel, auto, g.year, p.tech]);
  const spec = plan.spec; // the platform's hardpoints applied
  const chosenFam = engineChoice.kind === 'family' ? enginesOf(p).find((f) => f.id === engineChoice.familyId) : undefined;
  const chosenPlat = platformChoice.kind === 'platform' ? platformsOf(p).find((x) => x.id === platformChoice.platformId) : undefined;
  const [name, setName] = useState(initName);
  const [segOverride, setSegOverride] = useState<SegmentId | null>(null);
  const up = (patch: Partial<VehicleSpec>) => setSpec((s) => ({ ...s, ...patch }));
  const upE = (patch: Partial<VehicleSpec['engine']>) => setSpec((s) => ({ ...s, engine: { ...s.engine, ...patch } }));
  const stats = useMemo(() => computeVehicle(spec, { year: g.year, tech: p.tech }), [spec, g.year, p.tech]);
  const temp = useMemo(() => makeModel({ ...g, nextId: 0 } as typeof g, 'x', spec, 'family', p.tech, g.year), [spec, g.year]);
  const unit = estimateUnitCost(g, p, temp, 400);
  const autoSeg = suggestSegment(stats.scores as unknown as Record<string, number>, spec.body, unit, g.year);
  const seg = segOverride ?? autoSeg;
  temp.segment = seg;
  const [planVol, setPlanVol] = useState<number | null>(null);
  const vol = planVol ?? TYPICAL_VOLUME[seg];
  const mk = useMemo(() => computeMarket(g), [g.year, g.month, g.companies.length]);
  const guide = useMemo(() => priceGuide(g, p, temp, vol, { mk, devCost: plan.total }), [mk, temp, seg, vol, plan.total]);
  const volToSlider = (v: number) => Math.round((Math.log(v / 5) / Math.log(4000)) * 100);
  const sliderToVol = (x: number) => { const v = 5 * Math.pow(4000, x / 100); const stepSize = v < 50 ? 1 : v < 500 ? 10 : v < 5000 ? 50 : 500; return Math.round(v / stepSize) * stepSize; };
  const missing = missingTechs(spec, p.tech);
  const invalid = validateSpec(spec);
  const lock = (id: string) => !hasTech(p.tech, id);
  const note = (id: string) => (lock(id) ? t('st.needsTech', { year: TECH_BY_ID[id].year }) : undefined);
  const ev = spec.engine.layout === 'EV';
  const e = spec.engine;
  const rpmLabels = stats.engine.curve.map((c) => String(c.rpm));
  const maxGears = lock('gears5') ? 4 : lock('gears6') ? 5 : lock('gears8') ? 6 : lock('gears10') ? 8 : 10;
  const def = SEG[seg];
  const fit = def.bodyFit[spec.body] ?? 0.3;
  const m$ = (v: number, d = 1) => money(v, lang, d);
  const cars = (n: number) => t(n === 1 ? 'st.cars.one' : 'st.cars.other', { n });

  // ---- what stops the programme from starting, and the start action itself
  const blockers: string[] = [];
  if (!name.trim()) blockers.push(t('st.block.name'));
  if (invalid.length) blockers.push(t('st.block.invalid', { n: invalid.length }));
  if (missing.length) blockers.push(t('st.block.tech', { n: missing.length }));
  if (!plan.ok) blockers.push(t('st.block.plan'));
  const canStart = blockers.length === 0;
  const affordable = p.cash + Math.max(0, creditLimit(p, g.year) - p.debt);
  const commit = () => { if (act((gg) => startDevelopment(gg, name, rawSpec, seg, basedOn, { engine: engineChoice, platform: platformChoice }), t('st.started'))) onClose(); };
  const start = () => {
    if (!canStart) return;
    // a programme the company cannot fund from cash and credit is the risky case: say so before committing
    if (plan.total > affordable) ask(t('st.confirm.unaffordable', { name: name.trim(), budget: m$(plan.total), funds: m$(affordable), months: plan.months }), commit);
    else if (plan.total > p.cash * 0.6) ask(t('st.confirm.large', { name: name.trim(), budget: m$(plan.total), cash: m$(p.cash), months: plan.months }), commit);
    else commit();
  };

  // ---- shared controls (used by both Basic and Advanced)
  const bodySelect = <Select label={t('st.body.style')} value={spec.body} options={(Object.keys(BODY) as BodyType[]).map((b) => ({ value: b, label: term(BODY[b].name) }))} onChange={(v) => up({ body: v, seats: BODY[v].seats })} />;
  const sizeSlider = <Slider label={t('st.body.size')} value={spec.size} min={chosenPlat ? chosenPlat.sizeMin : 0.85} max={chosenPlat ? chosenPlat.sizeMax : 1.15} step={0.005} onChange={(v) => up({ size: v })} fmt={() => t('st.body.sizeFmt', { l: stats.length.toFixed(2), w: stats.width.toFixed(2), wb: stats.wheelbase.toFixed(2) })} hint={chosenPlat ? t('st.body.sizeHint', { name: chosenPlat.name }) : undefined} />;
  const seatsSelect = <Select label={t('st.body.seats')} value={spec.seats} options={[2, 4, 5, 7].map((n) => ({ value: n, label: t('st.body.nSeats', { n }), disabled: n > BODY[spec.body].seats + 2 }))} onChange={(v) => up({ seats: v })} />;
  const qualitySlider = <Slider label={t('st.body.quality')} value={spec.quality} min={0} max={1} step={0.01} onChange={(v) => up({ quality: v })} fmt={(v) => `${Math.round(v * 100)}%`} hint={t('st.body.qualityHint')} />;
  const interiorSelect = <Select label={t('st.cabin.interior')} value={spec.interior} onChange={(v) => up({ interior: v })} options={(['basic', 'standard', 'premium', 'luxury'] as const).map((v) => ({ value: v, label: t(k(`st.cabin.${v}`)) }))} />;
  const gearboxOptions = [{ value: 'manual' as const, label: t('st.gearbox.manual') }, { value: 'auto' as const, label: t('st.gearbox.auto') }, { value: 'dct' as const, label: t('st.gearbox.dct'), disabled: lock('dct'), note: note('dct') }];
  const tyreOptions = [{ value: 'economy' as const, label: t('st.tyre.economy') }, { value: 'touring' as const, label: t('st.tyre.touring') }, { value: 'sport' as const, label: t('st.tyre.sport'), disabled: lock('sporttire'), note: note('sporttire') }, { value: 'semislick' as const, label: t('st.tyre.semislick'), disabled: lock('semislick'), note: note('semislick') }];
  const famLabel = (f: ReturnType<typeof enginesOf>[number]) => `${f.name} — ${f.layout} ${f.layout === 'EV' ? `${Math.round(f.baseMotorKw)} kW` : `${(f.baseDisplacement / 1000).toFixed(1)} L`} · ${cars(familyUsers(p, f.id).length)}${f.status !== 'ready' ? ` · ${t('st.inDev')}` : ''}`;
  const architecture = (
    <>
      <Select label={t('st.arch.family')} value={engSel} hint={t('st.arch.familyHint')} onChange={(v) => {
        setEngSel(v);
        const f = enginesOf(p).find((x) => x.id === v);
        if (f) { const vv = findVariant(f, rawSpec.engine) ?? f.variants.find((x) => x.status === 'ready') ?? f.variants[0]; setSpec((s0) => ({ ...s0, engine: familyEngine(f, vv) })); }
      }} options={[
        { value: 'auto', label: `${t('st.arch.auto')} — ${auto.engine.kind === 'family' ? t('st.arch.reuse', { name: enginesOf(p).find((f) => f.id === (auto.engine as { familyId: string }).familyId)?.name ?? '' }) : t('st.arch.newEngineAuto')}` },
        { value: 'new', label: t('st.arch.newEngine') },
        ...enginesOf(p).map((f) => ({ value: f.id, label: famLabel(f) })),
      ]} />
      {chosenFam && <>
        <Select label={t('st.arch.variant')} value={findVariant(chosenFam, rawSpec.engine)?.id ?? 'custom'} onChange={(v) => { const vv = chosenFam.variants.find((x) => x.id === v); if (vv) setSpec((s0) => ({ ...s0, engine: familyEngine(chosenFam, vv) })); }}
          options={[...chosenFam.variants.map((v) => ({ value: v.id, label: `${v.name}${v.status !== 'ready' ? ` (${t('st.arch.calibrating')})` : ''}` })), { value: 'custom', label: t('st.arch.customVariant'), disabled: true }]} />
        <p className="tiny muted">{t('st.arch.envelope')} {chosenFam.layout === 'EV' ? t('st.arch.envelopeEv', { lo: Math.round(chosenFam.baseMotorKw * 0.5), hi: Math.round(chosenFam.baseMotorKw * 2) }) : `${Math.round(chosenFam.baseDisplacement * 0.8)}–${Math.round(chosenFam.baseDisplacement * 1.25)} cc, ${chosenFam.valvetrain.toUpperCase()}, ${chosenFam.fuelSystem.toUpperCase()}${chosenFam.aluBlock ? `, ${t('st.arch.aluBlock')}` : ''}`}. {t('st.arch.variantsBy')}</p>
      </>}
      <Select label={t('st.arch.platform')} value={platSel} onChange={setPlatSel} hint={t('st.arch.platformHint')} options={[
        { value: 'auto', label: `${t('st.arch.auto')} — ${auto.platform.kind === 'platform' ? t('st.arch.reuse', { name: platformsOf(p).find((x) => x.id === (auto.platform as { platformId: string }).platformId)?.name ?? '' }) : t('st.arch.newPlatformAuto')}` },
        { value: 'new', label: t('st.arch.newPlatform') },
        ...platformsOf(p).map((x) => ({ value: x.id, label: `${x.name} — ${x.cls}, ${x.chassis}, ${x.enginePos} · ${cars(platformUsers(p, x.id).length)}${x.status !== 'ready' ? ` · ${t('st.inDev')}` : ''}` })),
      ]} />
      {chosenPlat && <p className="tiny muted">{term(CLASS_NAME[chosenPlat.cls])} · {chosenPlat.chassis} · {t('st.arch.bay', { pos: chosenPlat.enginePos, bay: term(BAY_NAME[chosenPlat.bay]) })} · {chosenPlat.drives.join(' / ')} · {t('st.arch.sizeRange', { lo: chosenPlat.sizeMin.toFixed(2), hi: chosenPlat.sizeMax.toFixed(2) })}{chosenPlat.transaxle ? ` · ${t('st.arch.transaxle')}` : ''}</p>}
      {plan.errors.length > 0 && <div className="errbox">{plan.errors.map((x) => <div key={x}>{x}</div>)}</div>}
    </>
  );
  const platformNote = chosenPlat && <p className="tiny warn">{t('st.platformFixed', { name: chosenPlat.name })}</p>;

  return (
    <div className="studio">
      <header className="studio-bar">
        <button className="btn ghost" onClick={onClose} data-action="studio-back"><Icon name="arrow" size={15} style={{ transform: 'scaleX(-1)' }} />{t('st.back')}</button>
        <div className="studio-id">
          <span className="eyebrow">{base ? t('st.newGen', { name: base.name }) : t('st.title')}</span>
          <input className="studio-name" type="text" value={name} maxLength={32} aria-label={t('st.name')} placeholder={t('st.namePh')} onChange={(x) => setName(x.target.value)} />
        </div>
        <div className="studio-mode" data-mode-current={mode}>
          <div className="tabs" role="tablist" aria-label={t('st.mode')}>
            {(['basic', 'advanced'] as const).map((v) => <button key={v} type="button" role="tab" data-mode={v} aria-selected={mode === v} className={'tab' + (mode === v ? ' on' : '')} title={t(k(`st.mode.${v}.hint`))} onClick={() => setMode(v)}>{t(k(`st.mode.${v}`))}</button>)}
          </div>
        </div>
        <div className="grow" />
        <div className="studio-sum">
          <div><span className="eyebrow">{t('st.prog.budget')}</span><b className="display">{m$(plan.total)}</b></div>
          <div><span className="eyebrow">{t('st.prog.time')}</span><b className="display">{t('st.months', { n: plan.months })}</b></div>
        </div>
        <button className="btn primary" disabled={!canStart} onClick={start} data-action="start-development" title={canStart ? t('st.start.hint') : blockers.join(' · ')}>{t('st.start')}<Icon name="arrow" size={15} /></button>
      </header>
      {!canStart && <div className="studio-blockers" role="status"><Icon name="info" size={15} />{blockers.join(' · ')}</div>}

      <div className="studio-grid">
        {/* ------------------------------------------------------------------ left: engineering choices */}
        <aside className="studio-left">
          {mode === 'basic' ? (
            <div className="panel studio-form">
              <p className="tiny muted">{t('st.mode.basic.hint')}</p>
              <Group icon="layers" title={t('st.group.foundations')}>{architecture}</Group>
              <Group icon="vehicle" title={t('st.group.concept')}>
                {bodySelect}{sizeSlider}{seatsSelect}
                <Select label={t('st.drive')} value={spec.drive} onChange={(v) => up({ drive: v })} options={(chosenPlat ? chosenPlat.drives : ['FWD', 'RWD', 'AWD'] as const).map((d) => ({ value: d, label: t(k(`st.drive.${d}`)), disabled: !chosenPlat && d === 'FWD' && spec.enginePos !== 'front' && !ev }))} />
                {!ev && <Select label={t('st.gearbox')} value={spec.gearbox} onChange={(v) => up({ gearbox: v })} options={gearboxOptions} />}
                <Select label={t('st.tyres')} value={spec.tireCompound} onChange={(v) => up({ tireCompound: v })} options={tyreOptions} />
              </Group>
              <Group icon="users" title={t('st.group.character')}>{interiorSelect}{qualitySlider}</Group>
              <button className="linkbtn" onClick={() => setMode('advanced')}>{t('st.toAdvanced')}<Icon name="chevron" size={13} /></button>
            </div>
          ) : (
            <div className="panel studio-form">
              <div className="section-nav" role="tablist" aria-label={t('st.sections')}>
                {SECTIONS.map((s) => <button key={s.id} type="button" role="tab" data-section={s.id} aria-selected={section === s.id} className={section === s.id ? 'on' : ''} onClick={() => setSection(s.id)}><Icon name={s.icon} size={17} /><span>{t(k(`st.sec.${s.id}`))}</span></button>)}
              </div>
              <div className="section-body" key={section}>
                {section === 'architecture' && architecture}
                {section === 'body' && <>{bodySelect}{sizeSlider}{seatsSelect}{qualitySlider}<p className="tiny muted">{t('st.body.cosmeticNote')}</p></>}
                {section === 'chassis' && <>
                  {platformNote}
                  <Select label={t('st.chassis.construction')} value={spec.chassis} onChange={(v) => up({ chassis: v })} options={[
                    { value: 'ladder', label: t('st.chassis.ladder') }, { value: 'steel', label: t('st.chassis.steel') }, { value: 'spaceframe', label: t('st.chassis.spaceframe') },
                    { value: 'aluminium', label: t('st.chassis.aluminium'), disabled: lock('aluminium'), note: note('aluminium') }, { value: 'carbon', label: t('st.chassis.carbon'), disabled: lock('carbon'), note: note('carbon') }]} />
                  <Select label={t('st.panels')} value={spec.panels} onChange={(v) => up({ panels: v })} options={[
                    { value: 'steel', label: t('st.panels.steel') }, { value: 'aluminium', label: t('st.panels.aluminium') }, { value: 'fibreglass', label: t('st.panels.fibreglass'), disabled: lock('fibreglass'), note: note('fibreglass') }, { value: 'carbon', label: t('st.panels.carbon'), disabled: lock('carbonpanel'), note: note('carbonpanel') }]} />
                  <Select label={t('st.enginePos')} value={spec.enginePos} onChange={(v) => up({ enginePos: v, drive: v !== 'front' && spec.drive === 'FWD' ? 'RWD' : spec.drive })} options={[{ value: 'front', label: t('st.enginePos.front') }, { value: 'mid', label: t('st.enginePos.mid') }, { value: 'rear', label: t('st.enginePos.rear') }]} />
                  <Select label={t('st.safety')} value={spec.safety} onChange={(v) => up({ safety: v })} options={[
                    { value: 0, label: t('st.safety.0') }, { value: 1, label: t('st.safety.1'), disabled: lock('safety1'), note: note('safety1') }, { value: 2, label: t('st.safety.2'), disabled: lock('safety2'), note: note('safety2') }, { value: 3, label: t('st.safety.3'), disabled: lock('safety3'), note: note('safety3') }]} />
                </>}
                {section === 'engine' && <>
                  <Select label={t('st.eng.layout')} value={e.layout} onChange={(v) => upE({ layout: v })} options={LAYOUTS.map((l) => ({ value: l, label: term(LAYOUT_NAME[l]), disabled: l === 'EV' && lock('ev'), note: l === 'EV' ? note('ev') : undefined }))} />
                  {ev ? <>
                    <Slider label={t('st.eng.motor')} value={e.motorKw} min={30} max={800} step={5} onChange={(v) => upE({ motorKw: v })} fmt={(v) => `${v} kW`} />
                    <Slider label={t('st.eng.battery')} value={e.batteryKwh} min={10} max={150} step={1} onChange={(v) => upE({ batteryKwh: v })} fmt={(v) => `${v} kWh`} />
                    <p className="small muted">{t('st.eng.batteryNote', { level: p.tech.engine.toFixed(0) })}</p>
                  </> : <>
                    <Slider label={t('st.eng.displacement')} value={e.displacement} min={CYL[e.layout] * 160} max={Math.min(8400, CYL[e.layout] * 900)} step={10} onChange={(v) => upE({ displacement: v })} fmt={(v) => t('st.eng.displacementFmt', { cc: v, per: Math.round(v / CYL[e.layout]) })} />
                    <Slider label={t('st.eng.boreStroke')} value={e.boreStroke} min={0.7} max={1.6} step={0.01} onChange={(v) => upE({ boreStroke: v })} fmt={(v) => `${v.toFixed(2)} · ${(stats.engine.bore * 1000).toFixed(0)} × ${(stats.engine.stroke * 1000).toFixed(0)} mm`} hint={t('st.eng.boreStrokeHint')} />
                    <Select label={t('st.eng.valvetrain')} value={e.valvetrain} onChange={(v) => upE({ valvetrain: v })} options={[{ value: 'ohv', label: t('st.eng.ohv') }, { value: 'sohc', label: t('st.eng.sohc') }, { value: 'dohc2', label: t('st.eng.dohc2') }, { value: 'dohc4', label: t('st.eng.dohc4'), disabled: lock('dohc4'), note: note('dohc4') }]} />
                    <Select label={t('st.eng.fuel')} value={e.fuelSystem} onChange={(v) => upE({ fuelSystem: v })} options={[{ value: 'carb', label: t('st.eng.carb') }, { value: 'mfi', label: t('st.eng.mfi'), disabled: lock('mfi'), note: note('mfi') }, { value: 'efi', label: t('st.eng.efi'), disabled: lock('efi'), note: note('efi') }, { value: 'di', label: t('st.eng.di'), disabled: lock('di'), note: note('di') }]} />
                    <Select label={t('st.eng.aspiration')} value={e.aspiration} onChange={(v) => upE({ aspiration: v })} options={[{ value: 'na', label: t('st.eng.na') }, { value: 'supercharged', label: t('st.eng.supercharged') }, { value: 'turbo', label: t('st.eng.turbo'), disabled: lock('turbo'), note: note('turbo') }, { value: 'twinturbo', label: t('st.eng.twinturbo'), disabled: lock('twinturbo'), note: note('twinturbo') }]} />
                    {e.aspiration !== 'na' && <Slider label={t('st.eng.boost')} value={e.boost} min={0.2} max={2.2} step={0.05} onChange={(v) => upE({ boost: v })} fmt={(v) => `${v.toFixed(2)} bar`} />}
                    <Slider label={t('st.eng.compression')} value={e.compression} min={6} max={14} step={0.1} onChange={(v) => upE({ compression: v })} fmt={(v) => t('st.eng.compressionFmt', { cr: v.toFixed(1), margin: stats.engine.knockMargin.toFixed(1) })} hint={t('st.eng.compressionHint')} />
                    <Slider label={t('st.eng.redline')} value={e.redline} min={3500} max={10000} step={100} onChange={(v) => upE({ redline: v })} fmt={(v) => t('st.eng.redlineFmt', { rpm: v, v: stats.engine.pistonSpeed.toFixed(1), lim: stats.engine.pistonSpeedLimit.toFixed(1) })} />
                    <Slider label={t('st.eng.cam')} value={e.cam} min={0} max={1} step={0.01} onChange={(v) => upE({ cam: v })} fmt={(v) => t(v < 0.3 ? 'st.eng.cam.mild' : v < 0.65 ? 'st.eng.cam.sport' : 'st.eng.cam.race')} />
                    <div className="row wrap">
                      <label className="row small" style={{ gap: 6, opacity: lock('vvt') ? 0.5 : 1 }}><input type="checkbox" checked={e.vvt} disabled={lock('vvt')} onChange={(x) => upE({ vvt: x.target.checked })} /> {t('st.eng.vvt')}{lock('vvt') ? ` (${TECH_BY_ID.vvt.year})` : ''}</label>
                      <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={e.aluBlock} onChange={(x) => upE({ aluBlock: x.target.checked })} /> {t('st.eng.alu')}</label>
                    </div>
                    <Slider label={t('st.eng.hybrid')} value={e.hybridKw} min={0} max={200} step={5} disabled={lock('hybrid')} onChange={(v) => upE({ hybridKw: v })} fmt={(v) => (lock('hybrid') ? t('st.needsTech', { year: TECH_BY_ID.hybrid.year }) : v ? `${v} kW` : t('st.none'))} />
                  </>}
                </>}
                {section === 'driveline' && <>
                  {platformNote}
                  <Select label={t('st.drive')} value={spec.drive} onChange={(v) => up({ drive: v })} options={[{ value: 'FWD', label: t('st.drive.FWD.long'), disabled: spec.enginePos !== 'front' && !ev }, { value: 'RWD', label: t('st.drive.RWD.long') }, { value: 'AWD', label: t('st.drive.AWD.long'), disabled: lock('awd') && spec.body !== 'suv' && spec.body !== 'pickup', note: spec.body !== 'suv' && spec.body !== 'pickup' ? note('awd') : undefined }]} />
                  {!ev && <>
                    <Select label={t('st.gearbox')} value={spec.gearbox} onChange={(v) => up({ gearbox: v })} options={gearboxOptions} />
                    <Slider label={t('st.gears')} value={Math.min(spec.gears, maxGears)} min={3} max={maxGears} onChange={(v) => up({ gears: v })} fmt={(v) => t('st.gearsFmt', { n: v })} />
                    <Slider label={t('st.finalDrive')} value={spec.finalDrive} min={2.2} max={5.5} step={0.05} onChange={(v) => up({ finalDrive: v })} fmt={(v) => `${v.toFixed(2)} : 1`} hint={t('st.finalDriveHint')} />
                    <div className="row small wrap" style={{ gap: 8 }}><button className="btn sm" onClick={() => up({ finalDrive: suggestFinalDrive(spec, { year: g.year, tech: p.tech }) })}>{t('st.matchGearing')}</button><span className="muted">{t('st.gearingSuggestion', { r: suggestFinalDrive(spec, { year: g.year, tech: p.tech }).toFixed(2) })}</span></div>
                    {spec.enginePos === 'front' && spec.drive !== 'FWD' && <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={!!spec.transaxle} onChange={(x) => up({ transaxle: x.target.checked })} /> {t('st.transaxle')}</label>}
                  </>}
                  {ev && <p className="small muted">{t('st.evGear')}</p>}
                  <StatLine label={t('st.weightFront')} value={pct(stats.weightFront, lang)} />
                </>}
                {section === 'running' && <>
                  {platformNote}
                  <Select label={t('st.susp.front')} value={spec.suspFront} onChange={(v) => up({ suspFront: v })} options={[{ value: 'solid', label: t('st.susp.solid') }, { value: 'macpherson', label: t('st.susp.macpherson') }, { value: 'wishbone', label: t('st.susp.wishbone') }, { value: 'multilink', label: t('st.susp.multilink'), disabled: lock('multilink'), note: note('multilink') }]} />
                  <Select label={t('st.susp.rear')} value={spec.suspRear} onChange={(v) => up({ suspRear: v })} options={[{ value: 'solid', label: t('st.susp.solid') }, { value: 'macpherson', label: t('st.susp.strutRear') }, { value: 'wishbone', label: t('st.susp.wishbone') }, { value: 'multilink', label: t('st.susp.multilink'), disabled: lock('multilink'), note: note('multilink') }]} />
                  <Slider label={t('st.susp.tuning')} value={spec.sport} min={0} max={1} step={0.01} onChange={(v) => up({ sport: v })} fmt={(v) => t(v < 0.3 ? 'st.susp.comfort' : v < 0.65 ? 'st.susp.balanced' : 'st.susp.track')} />
                  <Select label={t('st.brakes')} value={spec.brakes} onChange={(v) => up({ brakes: v })} options={[{ value: 'drum', label: t('st.brakes.drum') }, { value: 'disc', label: t('st.brakes.disc'), disabled: lock('disc'), note: note('disc') }, { value: 'vented', label: t('st.brakes.vented'), disabled: lock('vented'), note: note('vented') }, { value: 'ceramic', label: t('st.brakes.ceramic'), disabled: lock('ceramic'), note: note('ceramic') }]} />
                  <Slider label={t('st.tyreWidth')} value={spec.tireWidth} min={125} max={345} step={5} onChange={(v) => up({ tireWidth: v })} fmt={(v) => `${v} mm`} />
                  <Select label={t('st.tyreCompound')} value={spec.tireCompound} onChange={(v) => up({ tireCompound: v })} options={tyreOptions} />
                  <Slider label={t('st.wheelDia')} value={spec.wheelDia} min={12} max={22} onChange={(v) => up({ wheelDia: v })} fmt={(v) => `${v}"`} />
                </>}
                {section === 'aero' && <>
                  <Slider label={t('st.aero.drag')} value={spec.aeroOpt} min={0} max={1} step={0.01} onChange={(v) => up({ aeroOpt: v })} fmt={() => `Cd ${stats.cd.toFixed(3)}`} hint={t('st.aero.dragHint')} />
                  <Slider label={t('st.aero.wing')} value={spec.wing} min={0} max={1} step={0.01} disabled={lock('wing')} onChange={(v) => up({ wing: v })} fmt={(v) => (lock('wing') ? t('st.needsTech', { year: TECH_BY_ID.wing.year }) : v < 0.03 ? t('st.none') : `${Math.round(v * 100)}%`)} />
                  <Slider label={t('st.aero.splitter')} value={spec.splitter} min={0} max={1} step={0.01} disabled={lock('splitter')} onChange={(v) => up({ splitter: v })} fmt={(v) => (lock('splitter') ? t('st.needsTech', { year: TECH_BY_ID.splitter.year }) : v < 0.03 ? t('st.none') : `${Math.round(v * 100)}%`)} />
                  <label className="row small" style={{ gap: 6, opacity: lock('flatfloor') ? 0.5 : 1 }}><input type="checkbox" checked={spec.flatFloor} disabled={lock('flatfloor')} onChange={(x) => up({ flatFloor: x.target.checked })} /> {t('st.aero.floor')}{lock('flatfloor') ? ` (${TECH_BY_ID.flatfloor.year})` : ''}</label>
                  <StatLine label={t('st.aero.frontal')} value={`${stats.frontalArea.toFixed(2)} m²`} /><StatLine label={t('st.aero.cda')} value={`${stats.cdA.toFixed(2)} m²`} />
                  <StatLine label={t('st.aero.load')} value={<span className={stats.downforce200 >= 0 ? 'good' : 'warn'}>{stats.downforce200 >= 0 ? t('st.aero.downforce', { kg: Math.round(stats.downforce200) }) : t('st.aero.lift', { kg: Math.round(-stats.downforce200) })}</span>} />
                </>}
                {section === 'cabin' && <>{interiorSelect}{seatsSelect}<StatLine label={t('st.cabin.labour')} value={t('st.hours', { n: Math.round(stats.labourHours) })} /></>}
              </div>
            </div>
          )}
        </aside>

        {/* ------------------------------------------------------------------ centre: the car */}
        <section className="studio-center">
          <VehicleStage desc={specDescriptor(spec, undefined, chosenPlat ?? null)} spec={spec} year={g.year} height="clamp(330px, 50vh, 600px)" autoRotate={false}
            title={<><b>{name.trim() || t('st.untitled')}</b> · {term(BODY[spec.body].name)} · {t('st.stage.dims', { l: stats.length.toFixed(2), wb: stats.wheelbase.toFixed(2), kg: Math.round(stats.mass) })}</>} />
          <div className="panel studio-look" aria-label={t('st.look')}>
            <span className="eyebrow">{t('st.look')}</span>
            <div className="look-row">
              <div className="swatches" role="group" aria-label={t('st.look.paint')}>
                {PAINTS.map((c) => <button key={c} type="button" aria-label={`${t('st.look.paint')} ${c}`} aria-pressed={spec.color === c} className={'sw' + (spec.color === c ? ' on' : '')} style={{ background: c }} onClick={() => up({ color: c })} />)}
                <input type="color" aria-label={t('st.look.custom')} title={t('st.look.custom')} value={spec.color} onChange={(x) => up({ color: x.target.value })} />
              </div>
              <Select label={t('st.look.finish')} value={spec.finish ?? 'default'} onChange={(v) => up({ finish: v === 'default' ? undefined : v as PaintFinish })}
                options={[{ value: 'default', label: t('st.look.trimDefault') }, ...(Object.keys(FINISH_NAME) as PaintFinish[]).map((f) => ({ value: f, label: term(FINISH_NAME[f]) }))]} />
              <Select label={t('st.look.wheels')} value={spec.wheelStyle ?? 'default'} onChange={(v) => up({ wheelStyle: v === 'default' ? undefined : v as WheelStyle })}
                options={[{ value: 'default', label: t('st.look.trimDefault') }, { value: 'multispoke', label: t('st.look.multispoke') }, { value: 'turbine', label: t('st.look.turbine') }, { value: 'fivespoke', label: t('st.look.fivespoke') }]} />
            </div>
            <p className="tiny muted">{t('st.look.note')}</p>
          </div>

          {(missing.length > 0 || invalid.length > 0) && <div className="errbox">{invalid.map((x) => <div key={x}>{x}</div>)}{missing.length > 0 && <div>{t('st.missingTech', { list: missing.map((id) => `${TECH_BY_ID[id].name} (${TECH_BY_ID[id].year})`).join(', ') })}</div>}</div>}
          {stats.warnings.length > 0 && <div className="warnbox">{stats.warnings.map((w) => <div key={w}>• {w}</div>)}</div>}

          <Panel eyebrow={t('st.analysis')} title={t(k(`st.analysis.${analysis}.title`))}
            action={<Tabs label={t('st.analysis')} value={analysis} onChange={setAnalysis} options={[{ id: 'curves', label: t('st.analysis.curves') }, { id: 'mass', label: t('st.analysis.mass') }, { id: 'cost', label: t('st.analysis.cost') }]} />}>
            {analysis === 'curves' && <>
              <div className="grid g2">
                <div><h4>{t('st.torqueNm')}</h4><LineChart height={190} width={360} series={[{ name: t('st.torque'), color: '#6ea8f0', values: stats.engine.curve.map((c) => c.nm) }]} labels={rpmLabels} xTitle="rpm" fmt={(v) => `${Math.round(v)}`} /></div>
                <div><h4>{t('st.powerKw')}</h4><LineChart height={190} width={360} series={[{ name: t('st.power'), color: '#dd8c55', values: stats.engine.curve.map((c) => c.kw) }]} labels={rpmLabels} xTitle="rpm" fmt={(v) => `${Math.round(v)}`} /></div>
              </div>
              <p className="tiny muted">{ev ? t('st.evCurve') : t('st.engineSummary', { eta: (stats.engine.etaI * 100).toFixed(0), bmep: stats.engine.bmepPeak.toFixed(1), kwl: stats.engine.specificKwL.toFixed(0), kg: Math.round(stats.engine.mass), rel: Math.round(stats.engine.reliability) })}</p>
            </>}
            {analysis === 'mass' && <>
              <BarList items={Object.entries(stats.massBreakdown).map(([label, value]) => ({ label: term(label), value }))} fmt={(v) => `${Math.round(v)} kg`} total totalLabel={t('st.total')} />
              <p className="tiny muted" style={{ marginTop: 8 }}>{t('st.massNote', { front: Math.round(stats.weightFront * 100), ptw: Math.round(stats.powerToWeight) })}</p>
            </>}
            {analysis === 'cost' && <>
              <BarList items={Object.entries(stats.costBreakdown).map(([label, value]) => ({ label: term(label), value, color: 'var(--s4)' }))} fmt={(v) => m$(v)} total totalLabel={t('st.total')} />
              <p className="tiny muted" style={{ marginTop: 8 }}>{t('st.costNote', { hours: Math.round(stats.labourHours) })}</p>
            </>}
          </Panel>
          <p className="tiny muted studio-method">{t('st.method')}</p>
        </section>

        {/* ------------------------------------------------------------------ right: results */}
        <aside className="studio-right">
          <div className="spec-tiles">
            <SpecTile label={t('st.power')} value={Math.round(stats.powerKw)} unit="kW" sub={`${Math.round(stats.powerKw * 1.36)} PS @ ${Math.round(stats.engine.powerRpm)}`} />
            <SpecTile label="0–100 km/h" value={stats.zeroTo100.toFixed(1)} unit="s" sub={`${t('st.quarter')} ${stats.quarterMile.toFixed(1)} s`} />
            <SpecTile label={t('st.topSpeed')} value={Math.round(stats.topSpeed)} unit="km/h" sub={`Cd ${stats.cd.toFixed(2)}`} />
            <SpecTile label={t('st.kerbMass')} value={Math.round(stats.mass)} unit="kg" sub={`${Math.round(stats.powerToWeight)} kW/t`} />
          </div>

          <Panel eyebrow={t('st.perf')} title={t('st.perf.title')}>
            <div className="col" style={{ gap: 2 }}>
              <StatLine label={t('st.torque')} value={`${Math.round(stats.torqueNm)} Nm @ ${Math.round(stats.engine.torqueRpm)}`} />
              <StatLine label={ev ? t('st.consumption') : t('st.fuel')} value={ev ? `${stats.fuelCombined.toFixed(1)} kWh/100 km` : `${stats.fuelUrban.toFixed(1)} / ${stats.fuelHighway.toFixed(1)} L/100 km`} />
              <StatLine label={t('st.range')} value={`${Math.round(stats.rangeKm)} km`} />
              <StatLine label={t('st.braking')} value={`${stats.braking100.toFixed(1)} m`} />
              <StatLine label={t('st.cornering')} value={`${stats.lateralG.toFixed(2)} g`} />
              {mode === 'advanced' && <>
                <StatLine label="80–120 km/h" value={stats.passing80to120 != null ? `${stats.passing80to120.toFixed(1)} s` : '—'} title={t('st.passingHint')} />
                <StatLine label="0–200 km/h" value={stats.zeroTo200 != null ? `${stats.zeroTo200.toFixed(1)} s` : '—'} />
                <StatLine label={t('st.weightFront')} value={pct(stats.weightFront, lang)} />
                <StatLine label={t('st.aero.load')} value={stats.downforce200 >= 0 ? t('st.aero.downforce', { kg: Math.round(stats.downforce200) }) : t('st.aero.lift', { kg: Math.round(-stats.downforce200) })} />
              </>}
            </div>
          </Panel>

          <Panel eyebrow={t('st.ratings')} title={t('st.ratings.title', { year: g.year })}>
            <div className="col" style={{ gap: 5 }}>
              {SCORE_KEYS.map((key) => <ScoreBar key={key} label={t(k(`score.${key}`))} value={stats.scores[key]} color={(def.weights[key] ?? 0) >= 0.15 ? 'var(--accent)' : 'var(--s1)'} />)}
            </div>
            <p className="tiny muted" style={{ marginTop: 8 }}><i className="swatch" style={{ background: 'var(--accent)' }} /> {t('st.ratings.legend', { segment: term(def.name).toLowerCase() })}</p>
          </Panel>

          <Panel eyebrow={t('st.market')} title={t('st.market.title')}>
            <div className="col" style={{ gap: 8 }}>
              <Select label={t('st.market.segment', { best: term(SEG[autoSeg].name) })} value={seg} options={SEGMENTS.map((s) => ({ value: s.id, label: term(s.name) }))} onChange={(v) => setSegOverride(v)} />
              {fit < 0.7 && <div className="warnbox">{t('st.market.poorFit', { body: term(BODY[spec.body].name).toLowerCase(), segment: term(def.name).toLowerCase(), fit: Math.round(fit * 100) })}</div>}
              <Slider label={t('st.market.volume')} value={volToSlider(vol)} min={0} max={100} onChange={(x) => setPlanVol(sliderToVol(x))} fmt={() => t('st.market.volumeFmt', { n: num(vol, lang) })} hint={t('st.market.volumeHint')} />
              <PriceLadder cost={guide.unitCost} breakEven={guide.breakEven} recommended={guide.recommended} worth={guide.value} fmt={(v) => m$(v)} labels={{ cost: t('st.market.unitCost'), breakEven: t('st.market.breakEven'), recommended: t('st.market.recommended'), worth: t('st.market.worth') }}
                hints={{ cost: t('st.market.unitCostHint'), breakEven: t('st.market.breakEvenHint'), recommended: t('st.market.recommendedHint'), worth: t('st.market.worthHint') }} />
              <div className={'margin-box ' + (guide.contribution < 0 ? 'bad' : 'good')}>
                <span className="eyebrow">{t('st.market.contribution')}</span>
                <b className="display">{m$(guide.contribution)}</b>
                <span className="small">{t('st.market.perCar', { pct: Math.round(guide.contributionPct * 100) })}</span>
              </div>
              <StatLine label={t('st.market.devPerCar')} value={m$(guide.devPerCar + guide.toolingPerCar)} title={t('st.market.devPerCarHint', { n: num(guide.lifeUnits, lang), years: Math.round(guide.lifeUnits / vol / 12) })} />
              <StatLine label={t('st.market.reference')} value={m$(segPrice(seg, g.year))} />
              <StatLine label={t('st.market.demand')} value={guide.blind ? t('st.market.noDealers') : t('st.market.perMonth', { n: num(guide.rawDemand, lang) })} />
              {!guide.viable && <div className="warnbox">{t('st.market.notViable', { pct: Math.round((guide.breakEven / guide.recommended - 1) * 100) })}</div>}
              {guide.viable && !guide.blind && guide.rawDemand < vol * 0.6 && <div className="warnbox">{t('st.market.lowDemand')}</div>}
              {!guide.blind && guide.rawDemand > vol * 1.5 && <p className="tiny muted">{t('st.market.highDemand')}</p>}
            </div>
          </Panel>

          <Panel eyebrow={t('st.prog')} title={t('st.prog.title')}>
            <div className="col" style={{ gap: 6 }}>
              <StackBar parts={[{ label: t('st.prog.vehicle'), value: plan.vehicleCost, color: 'var(--s1)' }, { label: t('st.prog.engine'), value: plan.engine.cost, color: 'var(--s2)' }, { label: t('st.prog.platform'), value: plan.platform.cost, color: 'var(--s3)' }]} fmt={(v) => m$(v)} />
              <StatLine label={t('st.prog.vehicle')} value={m$(plan.vehicleCost)} title={t('st.prog.vehicleHint')} />
              <StatLine label={plan.engine.kind === 'new' ? t('st.prog.newEngine') : plan.engine.kind === 'variant' ? t('st.prog.newVariant', { name: plan.engine.family?.name ?? '' }) : t('st.prog.engineReused', { name: plan.engine.family?.name ?? '' })} value={m$(plan.engine.cost)} />
              <StatLine label={plan.platform.kind === 'new' ? t('st.prog.newPlatform') : t('st.prog.platformReused', { name: plan.platform.platform?.name ?? '' })} value={m$(plan.platform.cost)} />
              <StatLine label={<b>{t('st.prog.budget')}</b>} value={<b>{m$(plan.total)}</b>} title={t('st.prog.budgetHint')} />
              {plan.total < plan.fullCost - 1 && <StatLine label={t('st.prog.saved')} value={<span className="good">{m$(plan.fullCost - plan.total)} ({Math.round((1 - plan.total / plan.fullCost) * 100)}%)</span>} />}
              <StatLine label={t('st.prog.time')} value={t('st.prog.timeFmt', { n: plan.months })} />
              {plan.waitsFor.length > 0 && <p className="tiny warn">{t('st.prog.waits', { list: plan.waitsFor.join(', ') })}</p>}
              <StatLine label={t('st.prog.tooling')} value={t('st.prog.toolingFmt', { v: m$(stats.toolingPerUnitCapacity) })} />
              <p className={'tiny ' + (plan.total > affordable ? 'bad' : 'muted')}>{t('st.prog.resources', { engineers: p.engineers, cash: m$(p.cash) })}{plan.total > affordable ? ` ${t('st.prog.unaffordable')}` : ''}</p>
              <button className="btn primary" disabled={!canStart} onClick={start} title={canStart ? t('st.start.hint') : blockers.join(' · ')}>{t('st.start')}<Icon name="arrow" size={15} /></button>
              {!canStart && <p className="tiny warn">{blockers.join(' · ')}</p>}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Group({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return <fieldset className="form-group"><legend><Icon name={icon} size={15} />{title}</legend>{children}</fieldset>;
}

export function SpecTile({ label, value, unit, sub }: { label: string; value: ReactNode; unit: string; sub?: string }) {
  return <div className="spec-tile"><span className="eyebrow">{label}</span><span className="spec-v"><b className="display">{value}</b><i>{unit}</i></span>{sub && <span className="tiny muted">{sub}</span>}</div>;
}

/** Unit cost, break-even, recommended price and worth to buyers on one price axis: the gaps are the story. */
export function PriceLadder({ cost, breakEven, recommended, worth, mark, fmt, labels, hints }: { cost: number; breakEven: number; recommended: number; worth: number; mark?: { v: number; label: string }; fmt: (v: number) => string; labels: Record<'cost' | 'breakEven' | 'recommended' | 'worth', string>; hints: Record<'cost' | 'breakEven' | 'recommended' | 'worth', string> }) {
  const max = Math.max(cost, breakEven, recommended, worth, mark?.v ?? 0, 1) * 1.08;
  const rows: { id: 'cost' | 'breakEven' | 'recommended' | 'worth'; v: number; color: string }[] = [
    { id: 'cost', v: cost, color: 'var(--ink3)' }, { id: 'breakEven', v: breakEven, color: 'var(--warn)' }, { id: 'recommended', v: recommended, color: 'var(--accent2)' }, { id: 'worth', v: worth, color: 'var(--s1)' },
  ];
  const x = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return (
    <div className="ladder">
      <div className="ladder-track" aria-hidden="true">
        <i className={'ladder-band ' + (recommended >= breakEven ? 'good' : 'bad')} style={{ left: x(Math.min(breakEven, recommended)), width: `${Math.abs(recommended - breakEven) / max * 100}%` }} />
        {rows.map((r) => <b key={r.id} style={{ left: x(r.v), background: r.color }} />)}
        {mark && <em style={{ left: x(mark.v) }} title={`${mark.label}: ${fmt(mark.v)}`} />}
      </div>
      <dl className="ladder-rows">
        {rows.map((r) => <div key={r.id} title={hints[r.id]}><dt><i className="swatch" style={{ background: r.color }} />{labels[r.id]}</dt><dd className={r.id === 'recommended' ? 'strong' : ''}>{fmt(r.v)}</dd></div>)}
        {mark && <div><dt><i className="swatch mark" />{mark.label}</dt><dd className="strong">{fmt(mark.v)}</dd></div>}
      </dl>
    </div>
  );
}
