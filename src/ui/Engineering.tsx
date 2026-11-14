// Engine families and platforms: what the company has, who uses it, and stand-alone programmes.
import { useState } from 'react';
import type { EngineFamily, EngineLayout, EngineSpec, GameState, Platform, VehicleSpec } from '../sim/types';
import { useGame, useStore } from '../store/game';
import { BODY, CYL, LAYOUT_NAME, computeVehicle, defaultEngine, defaultVehicle } from '../sim/engineering';
import { BAY, BAY_NAME, CLASS_NAME, DISP_RANGE, MOTOR_RANGE, SHARE, engineFits, enginesOf, familyEngine, familyUsers, maturity, platformsOf, platformUsers, standaloneCost, variantShare } from '../sim/families';
import { addEngineVariant, cancelArchitecture, startEngineFamily, startPlatform } from '../sim/actions';
import { hasTech } from '../data/tech';
import { useT, type MessageKey } from '../i18n';
import { useTerm } from '../i18n/terms';
import { money, num } from '../i18n/format';
import { Modal, Select, Slider, StatLine } from './common';
import { ImpactPreview } from './Impact';

const LAYOUTS: EngineLayout[] = ['I3', 'I4', 'I5', 'I6', 'V6', 'V8', 'V10', 'V12', 'F4', 'F6', 'EV'];
type T = (key: MessageKey, vars?: Record<string, string | number>) => string;
const status = (x: { status: string; devMonthsLeft: number; ownerModelId?: string }, t: T) =>
  x.status === 'ready' ? <span className="good">{t('eng.ready')}</span> : <span className="warn">{t('eng.inDev', { n: Math.ceil(x.devMonthsLeft) })}{x.ownerModelId ? ` (${t('eng.withCar')})` : ''}</span>;
const history = (h: { kind: string }[], t: T) => (h.length ? h.map((x) => t(`eng.fault.${x.kind}` as MessageKey)).join(', ') : t('eng.fault.none'));

export function EngineeringPanel() {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const term = useTerm();
  const fmtMoney = (v: number) => money(v, lang), fmtNum = (v: number) => num(v, lang);
  const act = useStore((s) => s.act);
  const [modal, setModal] = useState<null | { kind: 'engine' } | { kind: 'platform' } | { kind: 'variant'; fam: EngineFamily }>(null);
  const fams = enginesOf(p), plats = platformsOf(p);
  return (
    <div className="panel col">
      <div className="row between wrap"><h3>{t('eng.title')}</h3>
        <div className="row"><button className="btn sm" onClick={() => setModal({ kind: 'engine' })}>+ {t('st.arch.family')}</button><button className="btn sm" onClick={() => setModal({ kind: 'platform' })}>+ {t('st.arch.platform')}</button></div></div>
      <p className="small muted">{t('eng.intro')}</p>
      {fams.length === 0 && plats.length === 0 && <p className="dim">{t('eng.none')}</p>}
      {fams.length > 0 && <div className="tablewrap"><table>
        <thead><tr><th>{t('st.arch.family')}</th><th>{t('eng.c.arch')}</th><th>{t('eng.c.variants')}</th><th className="r">{t('eng.c.cars')}</th><th className="r">{t('trim.c.built')}</th><th className="r">{t('eng.c.maturity')}</th><th>{t('eng.c.faults')}</th><th>{t('veh.col.status')}</th><th /></tr></thead>
        <tbody>{fams.map((f) => (
          <tr key={f.id}><td><b>{f.name}</b></td>
            <td className="small">{f.layout === 'EV' ? t('eng.evUnit', { lo: Math.round(f.baseMotorKw * MOTOR_RANGE[0]), hi: Math.round(f.baseMotorKw * MOTOR_RANGE[1]) }) : `${term(LAYOUT_NAME[f.layout])}, ${Math.round(f.baseDisplacement * DISP_RANGE[0])}–${Math.round(f.baseDisplacement * DISP_RANGE[1])} cc, ${f.valvetrain.toUpperCase()}, ${f.fuelSystem.toUpperCase()}${f.aluBlock ? `, ${t('st.arch.aluBlock')}` : ''}`}</td>
            <td className="small">{f.variants.map((v) => v.name + (v.status !== 'ready' ? ` (${t('eng.readyIn', { n: v.readyIn || '—' })})` : '')).join(' · ')}</td>
            <td className="r">{familyUsers(p, f.id).length}</td><td className="r">{fmtNum(f.cumulativeUnits)}</td>
            <td className="r" title={t('eng.maturityHint')}>+{maturity(f, g.year).toFixed(1)}</td><td className="small">{history(f.history, t)}</td><td className="small">{status(f, t)}</td>
            <td className="r" style={{ whiteSpace: 'nowrap' }}>{f.status === 'ready' && <button className="btn sm" onClick={() => setModal({ kind: 'variant', fam: f })}>+ {t('st.arch.variant')}</button>}
              {f.status !== 'ready' && !f.ownerModelId && <button className="btn sm ghost" onClick={() => act((gg) => cancelArchitecture(gg, f.id), t('veh.cancelled'))}>{t('veh.cancel')}</button>}</td></tr>))}
        </tbody></table></div>}
      {plats.length > 0 && <div className="tablewrap"><table>
        <thead><tr><th>{t('st.arch.platform')}</th><th>{t('eng.c.body')}</th><th>{t('veh.engine')}</th><th>{t('eng.c.size')}</th><th className="r">{t('eng.c.cars')}</th><th className="r">{t('trim.c.built')}</th><th className="r">{t('eng.c.maturity')}</th><th>{t('eng.c.faults')}</th><th>{t('veh.col.status')}</th><th /></tr></thead>
        <tbody>{plats.map((x: Platform) => (
          <tr key={x.id}><td><b>{x.name}</b></td><td className="small">{term(CLASS_NAME[x.cls]).split(' (')[0]} · {x.chassis} · {t('eng.safetyN', { n: x.safety })}</td>
            <td className="small">{t(`st.enginePos.${x.enginePos}` as MessageKey).split(' (')[0]}, {term(BAY_NAME[x.bay])} · {x.drives.join('/')}{x.transaxle ? ` · ${t('st.arch.transaxle')}` : ''}</td>
            <td className="small">{x.sizeMin.toFixed(2)}–{x.sizeMax.toFixed(2)}</td>
            <td className="r">{platformUsers(p, x.id).length}</td><td className="r">{fmtNum(x.cumulativeUnits)}</td>
            <td className="r">+{maturity(x, g.year).toFixed(1)}</td><td className="small">{history(x.history, t)}</td><td className="small">{status(x, t)}</td>
            <td className="r">{x.status !== 'ready' && !x.ownerModelId && <button className="btn sm ghost" onClick={() => act((gg) => cancelArchitecture(gg, x.id), t('veh.cancelled'))}>{t('veh.cancel')}</button>}</td></tr>))}
        </tbody></table></div>}
      {modal?.kind === 'engine' && <EngineFamilyForm onClose={() => setModal(null)} />}
      {modal?.kind === 'variant' && <VariantForm fam={modal.fam} onClose={() => setModal(null)} />}
      {modal?.kind === 'platform' && <PlatformForm onClose={() => setModal(null)} />}
    </div>
  );
}

function EngineFamilyForm({ onClose }: { onClose: () => void }) {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const term = useTerm();
  const fmtMoney = (v: number) => money(v, lang), fmtNum = (v: number) => num(v, lang);
  const act = useStore((s) => s.act);
  const [name, setName] = useState('');
  const [e, setE] = useState<EngineSpec>({ ...defaultEngine(g.year) });
  const up = (x: Partial<EngineSpec>) => setE((o) => ({ ...o, ...x }));
  const ev = e.layout === 'EV';
  const ref = { ...defaultVehicle(g.year, 'sedan'), engine: e };
  const est = standaloneCost(g, ref, 'engine', p.tech);
  const run = (gg: GameState) => startEngineFamily(gg, name || t('st.prog.newEngine'), e);
  return (
    <Modal onClose={onClose}>
      <h2>{t('eng.fam.title')}</h2>
      <p className="small muted">{t('eng.fam.intro')}</p>
      <label className="field"><span className="lab"><span>{t('fac.new.name')}</span></span><input type="text" value={name} placeholder={t('eng.fam.ph')} onChange={(x) => setName(x.target.value)} /></label>
      <Select label={t('st.eng.layout')} value={e.layout} onChange={(v) => up({ layout: v, displacement: v === 'EV' ? e.displacement : Math.round(CYL[v] * 500) })} options={LAYOUTS.map((l) => ({ value: l, label: term(LAYOUT_NAME[l]), disabled: l === 'EV' && !hasTech(p.tech, 'ev') }))} />
      {ev ? <Slider label={t('eng.fam.baseMotor')} value={e.motorKw} min={40} max={600} step={5} onChange={(v) => up({ motorKw: v })} fmt={(v) => t('eng.fam.rangeKw', { v, lo: Math.round(v * MOTOR_RANGE[0]), hi: Math.round(v * MOTOR_RANGE[1]) })} />
        : <>
          <Slider label={t('eng.fam.baseDisp')} value={e.displacement} min={CYL[e.layout] * 200} max={Math.min(8400, CYL[e.layout] * 800)} step={10} onChange={(v) => up({ displacement: v })} fmt={(v) => t('eng.fam.rangeCc', { v, lo: Math.round(v * DISP_RANGE[0]), hi: Math.round(v * DISP_RANGE[1]) })} />
          <Select label={t('st.eng.valvetrain')} value={e.valvetrain} onChange={(v) => up({ valvetrain: v })} options={[{ value: 'ohv', label: t('st.eng.ohv') }, { value: 'sohc', label: t('st.eng.sohc') }, { value: 'dohc2', label: t('st.eng.dohc2') }, { value: 'dohc4', label: t('st.eng.dohc4'), disabled: !hasTech(p.tech, 'dohc4') }]} />
          <Select label={t('st.eng.fuel')} value={e.fuelSystem} onChange={(v) => up({ fuelSystem: v })} options={[{ value: 'carb', label: t('st.eng.carb') }, { value: 'mfi', label: t('st.eng.mfi'), disabled: !hasTech(p.tech, 'mfi') }, { value: 'efi', label: t('st.eng.efi'), disabled: !hasTech(p.tech, 'efi') }, { value: 'di', label: t('st.eng.di'), disabled: !hasTech(p.tech, 'di') }]} />
          <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={e.aluBlock} onChange={(x) => up({ aluBlock: x.target.checked })} /> {t('st.eng.alu')}</label>
        </>}
      <StatLine label={t('eng.cost')} value={<b>{fmtMoney(est.cost)}</b>} /><StatLine label={t('eng.duration')} value={t('eng.aboutMonths', { n: est.months })} />
      <ImpactPreview deps={[name, e]} horizon={12} run={run} />
      <div className="row end"><button className="btn" onClick={onClose}>{t('confirm.cancel')}</button><button className="btn primary" onClick={() => { if (act(run, t('eng.fam.started'))) onClose(); }}>{t('eng.start')}</button></div>
    </Modal>
  );
}

function VariantForm({ fam, onClose }: { fam: EngineFamily; onClose: () => void }) {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const term = useTerm();
  const fmtMoney = (v: number) => money(v, lang), fmtNum = (v: number) => num(v, lang);
  const act = useStore((s) => s.act);
  const base = fam.variants.find((v) => v.status === 'ready') ?? fam.variants[0];
  const [e, setE] = useState<EngineSpec>(familyEngine(fam, base));
  const up = (x: Partial<EngineSpec>) => setE((o) => ({ ...o, ...x }));
  const ev = fam.layout === 'EV';
  const why = engineFits(fam, e);
  const st = computeVehicle({ ...defaultVehicle(g.year, 'sedan'), engine: e }, { year: g.year, tech: p.tech });
  const share = variantShare(fam, e);
  const power = st.engine.powerKw;
  const run = (gg: GameState) => addEngineVariant(gg, fam.id, e);
  return (
    <Modal onClose={onClose}>
      <h2>{t('st.prog.newVariant', { name: fam.name })}</h2>
      {ev ? <>
        <Slider label={t('st.eng.motor')} value={e.motorKw} min={Math.round(fam.baseMotorKw * MOTOR_RANGE[0])} max={Math.round(fam.baseMotorKw * MOTOR_RANGE[1])} step={5} onChange={(v) => up({ motorKw: v })} fmt={(v) => `${v} kW`} />
        <Slider label={t('st.eng.battery')} value={e.batteryKwh} min={10} max={150} onChange={(v) => up({ batteryKwh: v })} fmt={(v) => `${v} kWh`} />
      </> : <>
        <Slider label={t('st.eng.displacement')} value={e.displacement} min={Math.round(fam.baseDisplacement * DISP_RANGE[0])} max={Math.round(fam.baseDisplacement * DISP_RANGE[1])} step={10} onChange={(v) => up({ displacement: v })} fmt={(v) => `${v} cc`} />
        <Select label={t('st.eng.aspiration')} value={e.aspiration} onChange={(v) => up({ aspiration: v, boost: v === 'na' ? e.boost : Math.max(e.boost, 0.6), compression: v === 'na' ? Math.max(e.compression, 10) : Math.min(e.compression, 9.8) })} options={[{ value: 'na', label: t('st.eng.na') }, { value: 'turbo', label: t('st.eng.turbo'), disabled: !hasTech(p.tech, 'turbo') }, { value: 'twinturbo', label: t('st.eng.twinturbo'), disabled: !hasTech(p.tech, 'twinturbo') }, { value: 'supercharged', label: t('st.eng.supercharged') }]} />
        {e.aspiration !== 'na' && <Slider label={t('st.eng.boost')} value={e.boost} min={0.2} max={2.2} step={0.05} onChange={(v) => up({ boost: v })} fmt={(v) => `${v.toFixed(2)} bar`} />}
        <Slider label={t('eng.var.tune')} value={e.cam} min={0} max={1} step={0.05} onChange={(v) => up({ cam: v, redline: Math.round((5600 + 2400 * v) / 100) * 100 })} fmt={(v) => t(v < 0.3 ? 'eng.var.economy' : v < 0.6 ? 'eng.var.standard' : 'eng.var.performance')} />
        <Slider label={t('st.eng.hybrid')} value={e.hybridKw} min={0} max={200} step={5} disabled={!hasTech(p.tech, 'hybrid')} onChange={(v) => up({ hybridKw: v })} fmt={(v) => (v ? `${v} kW` : t('st.none'))} />
      </>}
      <StatLine label={t('eng.var.output')} value={t('eng.var.outputFmt', { kw: Math.round(power), nm: Math.round(st.engine.torqueNm), rel: Math.round(st.engine.reliability) })} />
      <StatLine label={t('eng.var.cost')} value={<b>{fmtMoney(st.devCost * SHARE.engine * share)}</b>} title={t('eng.var.costHint')} /><StatLine label={t('eng.var.readyIn')} value={t('eng.aboutMonths', { n: Math.round(3 + 20 * share) })} />
      {why.length > 0 && <div className="errbox">{why.map((x) => <div key={x}>{x}</div>)}</div>}
      <ImpactPreview deps={[e]} horizon={6} run={run} />
      <div className="row end"><button className="btn" onClick={onClose}>{t('confirm.cancel')}</button><button className="btn primary" disabled={why.length > 0} onClick={() => { if (act(run, t('eng.var.started'))) onClose(); }}>{t('eng.var.go')}</button></div>
    </Modal>
  );
}

function PlatformForm({ onClose }: { onClose: () => void }) {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const term = useTerm();
  const fmtMoney = (v: number) => money(v, lang), fmtNum = (v: number) => num(v, lang);
  const act = useStore((s) => s.act);
  const [name, setName] = useState('');
  const [s, setS] = useState<VehicleSpec>(defaultVehicle(g.year, 'sedan'));
  const [bay, setBay] = useState<'I4' | 'V6' | 'V8'>('I4');
  const up = (x: Partial<VehicleSpec>) => setS((o) => ({ ...o, ...x }));
  const ref: VehicleSpec = { ...s, engine: { ...s.engine, layout: bay, displacement: bay === 'I4' ? 2000 : bay === 'V6' ? 3000 : 4400 } };
  const est = standaloneCost(g, ref, 'platform', p.tech);
  const run = (gg: GameState) => startPlatform(gg, name || t('st.prog.newPlatform'), ref);
  return (
    <Modal onClose={onClose}>
      <h2>{t('eng.plat.title')}</h2>
      <p className="small muted">{t('eng.plat.intro')}</p>
      <label className="field"><span className="lab"><span>{t('fac.new.name')}</span></span><input type="text" value={name} placeholder={t('eng.plat.ph')} onChange={(x) => setName(x.target.value)} /></label>
      <Select label={t('eng.plat.body')} value={s.body} onChange={(v) => up({ body: v })} options={(['hatch', 'sedan', 'suv', 'coupe', 'roadster', 'supercar', 'pickup'] as const).map((b) => ({ value: b, label: term(BODY[b].name) }))} />
      <p className="tiny muted">{term(CLASS_NAME[s.body === 'pickup' || s.chassis === 'ladder' ? 'truck' : s.body === 'supercar' || s.body === 'roadster' ? 'sports' : 'car'])}</p>
      <Select label={t('st.chassis.construction')} value={s.chassis} onChange={(v) => up({ chassis: v })} options={[{ value: 'steel', label: t('st.chassis.steel') }, { value: 'ladder', label: t('st.chassis.ladder') }, { value: 'spaceframe', label: t('st.chassis.spaceframe') }, { value: 'aluminium', label: t('st.chassis.aluminium'), disabled: !hasTech(p.tech, 'aluminium') }, { value: 'carbon', label: t('st.chassis.carbon'), disabled: !hasTech(p.tech, 'carbon') }]} />
      <Select label={t('st.enginePos')} value={s.enginePos} onChange={(v) => up({ enginePos: v, drive: v !== 'front' && s.drive === 'FWD' ? 'RWD' : s.drive })} options={[{ value: 'front', label: t('st.enginePos.front') }, { value: 'mid', label: t('st.enginePos.mid') }, { value: 'rear', label: t('st.enginePos.rear') }]} />
      <Select label={t('eng.plat.bay')} value={bay} onChange={setBay} options={[{ value: 'I4', label: `${t('eng.plat.bay.compact')} — ${term(BAY_NAME[BAY.I4])}` }, { value: 'V6', label: `${t('eng.plat.bay.medium')} — ${term(BAY_NAME[BAY.V6])}` }, { value: 'V8', label: `${t('eng.plat.bay.large')} — ${term(BAY_NAME[BAY.V8])}` }]} />
      <Select label={t('eng.plat.drive')} value={s.drive} onChange={(v) => up({ drive: v })} options={[{ value: 'FWD', label: `${t('st.drive.FWD')} (+AWD)`, disabled: s.enginePos !== 'front' }, { value: 'RWD', label: `${t('st.drive.RWD')} (+AWD)` }]} />
      <Slider label={t('eng.plat.size')} value={s.size} min={0.85} max={1.15} step={0.01} onChange={(v) => up({ size: v })} fmt={(v) => t('eng.plat.sizeFmt', { v: v.toFixed(2), lo: (v * 0.93).toFixed(2), hi: (v * 1.07).toFixed(2) })} />
      <Select label={t('st.susp.rear')} value={s.suspRear} onChange={(v) => up({ suspRear: v })} options={[{ value: 'solid', label: t('st.susp.solid') }, { value: 'macpherson', label: t('st.susp.strutRear') }, { value: 'wishbone', label: t('st.susp.wishbone') }, { value: 'multilink', label: t('st.susp.multilink'), disabled: !hasTech(p.tech, 'multilink') }]} />
      <Select label={t('st.safety')} value={s.safety} onChange={(v) => up({ safety: v })} options={[0, 1, 2, 3].map((v) => ({ value: v, label: t(`st.safety.${v}` as MessageKey), disabled: v > 0 && !hasTech(p.tech, `safety${v}`) }))} />
      <StatLine label={t('eng.cost')} value={<b>{fmtMoney(est.cost)}</b>} /><StatLine label={t('eng.duration')} value={t('eng.aboutMonths', { n: est.months })} />
      <ImpactPreview deps={[name, s, bay]} horizon={12} run={run} />
      <div className="row end"><button className="btn" onClick={onClose}>{t('confirm.cancel')}</button><button className="btn primary" onClick={() => { if (act(run, t('eng.plat.started'))) onClose(); }}>{t('eng.start')}</button></div>
    </Modal>
  );
}
