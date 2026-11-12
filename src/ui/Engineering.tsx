// Engine families and platforms: what the company has, who uses it, and stand-alone programmes.
import { useState } from 'react';
import type { EngineFamily, EngineLayout, EngineSpec, GameState, Platform, VehicleSpec } from '../sim/types';
import { useGame, useStore } from '../store/game';
import { CYL, LAYOUT_NAME, computeVehicle, defaultEngine, defaultVehicle } from '../sim/engineering';
import { BAY, BAY_NAME, CLASS_NAME, DISP_RANGE, MOTOR_RANGE, SHARE, engineFits, enginesOf, familyEngine, familyUsers, maturity, platformsOf, platformUsers, standaloneCost, variantShare } from '../sim/families';
import { addEngineVariant, cancelArchitecture, startEngineFamily, startPlatform } from '../sim/actions';
import { hasTech } from '../data/tech';
import { fmtMoney, fmtNum } from '../sim/util';
import { Modal, Select, Slider, StatLine } from './common';
import { ImpactPreview } from './Impact';

const LAYOUTS: EngineLayout[] = ['I3', 'I4', 'I5', 'I6', 'V6', 'V8', 'V10', 'V12', 'F4', 'F6', 'EV'];
const status = (x: { status: string; devMonthsLeft: number; ownerModelId?: string }) =>
  x.status === 'ready' ? <span className="good">ready</span> : <span className="warn">in development · {Math.ceil(x.devMonthsLeft)} mo{x.ownerModelId ? ' (with its first car)' : ''}</span>;
const history = (h: { kind: string }[]) => (h.length ? h.map((x) => x.kind).join(', ') : 'none');

export function EngineeringPanel() {
  const { g, p } = useGame();
  const act = useStore((s) => s.act);
  const [modal, setModal] = useState<null | { kind: 'engine' } | { kind: 'platform' } | { kind: 'variant'; fam: EngineFamily }>(null);
  const fams = enginesOf(p), plats = platformsOf(p);
  return (
    <div className="panel col">
      <div className="row between wrap"><h3>Engine families and platforms</h3>
        <div className="row"><button className="btn sm" onClick={() => setModal({ kind: 'engine' })}>+ Engine family</button><button className="btn sm" onClick={() => setModal({ kind: 'platform' })}>+ Platform</button></div></div>
      <p className="small muted">Cars that share an engine family or a platform split its development cost, buy its parts at the combined volume, re-use its tooling in the same plant and gain from its maturity — and they share its faults. A car's own development pays only for what it does not re-use.</p>
      {fams.length === 0 && plats.length === 0 && <p className="dim">None yet. Your first car develops its engine family and platform with it; later cars can share them.</p>}
      {fams.length > 0 && <div className="tablewrap"><table>
        <thead><tr><th>Engine family</th><th>Architecture and envelope</th><th>Variants</th><th className="r">Cars</th><th className="r">Built</th><th className="r">Maturity</th><th>Faults</th><th>Status</th><th /></tr></thead>
        <tbody>{fams.map((f) => (
          <tr key={f.id}><td><b>{f.name}</b></td>
            <td className="small">{f.layout === 'EV' ? `Electric drive unit, ${Math.round(f.baseMotorKw * MOTOR_RANGE[0])}–${Math.round(f.baseMotorKw * MOTOR_RANGE[1])} kW` : `${LAYOUT_NAME[f.layout]}, ${Math.round(f.baseDisplacement * DISP_RANGE[0])}–${Math.round(f.baseDisplacement * DISP_RANGE[1])} cc, ${f.valvetrain.toUpperCase()}, ${f.fuelSystem.toUpperCase()}${f.aluBlock ? ', alloy block' : ''}`}</td>
            <td className="small">{f.variants.map((v) => v.name + (v.status !== 'ready' ? ` (ready in ${v.readyIn || '—'} mo)` : '')).join(' · ')}</td>
            <td className="r">{familyUsers(p, f.id).length}</td><td className="r">{fmtNum(f.cumulativeUnits)}</td>
            <td className="r" title="Reliability points gained in service">+{maturity(f, g.year).toFixed(1)}</td><td className="small">{history(f.history)}</td><td className="small">{status(f)}</td>
            <td className="r" style={{ whiteSpace: 'nowrap' }}>{f.status === 'ready' && <button className="btn sm" onClick={() => setModal({ kind: 'variant', fam: f })}>+ Variant</button>}
              {f.status !== 'ready' && !f.ownerModelId && <button className="btn sm ghost" onClick={() => act((gg) => cancelArchitecture(gg, f.id), 'Programme cancelled.')}>Cancel</button>}</td></tr>))}
        </tbody></table></div>}
      {plats.length > 0 && <div className="tablewrap"><table>
        <thead><tr><th>Platform</th><th>Body group and structure</th><th>Engine</th><th>Size range</th><th className="r">Cars</th><th className="r">Built</th><th className="r">Maturity</th><th>Faults</th><th>Status</th><th /></tr></thead>
        <tbody>{plats.map((x: Platform) => (
          <tr key={x.id}><td><b>{x.name}</b></td><td className="small">{x.cls} · {x.chassis} · safety {x.safety}</td>
            <td className="small">{x.enginePos}, {BAY_NAME[x.bay]} · {x.drives.join('/')}{x.transaxle ? ' · transaxle' : ''}</td>
            <td className="small">{x.sizeMin.toFixed(2)}–{x.sizeMax.toFixed(2)}</td>
            <td className="r">{platformUsers(p, x.id).length}</td><td className="r">{fmtNum(x.cumulativeUnits)}</td>
            <td className="r">+{maturity(x, g.year).toFixed(1)}</td><td className="small">{history(x.history)}</td><td className="small">{status(x)}</td>
            <td className="r">{x.status !== 'ready' && !x.ownerModelId && <button className="btn sm ghost" onClick={() => act((gg) => cancelArchitecture(gg, x.id), 'Programme cancelled.')}>Cancel</button>}</td></tr>))}
        </tbody></table></div>}
      {modal?.kind === 'engine' && <EngineFamilyForm onClose={() => setModal(null)} />}
      {modal?.kind === 'variant' && <VariantForm fam={modal.fam} onClose={() => setModal(null)} />}
      {modal?.kind === 'platform' && <PlatformForm onClose={() => setModal(null)} />}
    </div>
  );
}

function EngineFamilyForm({ onClose }: { onClose: () => void }) {
  const { g, p } = useGame();
  const act = useStore((s) => s.act);
  const [name, setName] = useState('');
  const [e, setE] = useState<EngineSpec>({ ...defaultEngine(g.year) });
  const up = (x: Partial<EngineSpec>) => setE((o) => ({ ...o, ...x }));
  const ev = e.layout === 'EV';
  const ref = { ...defaultVehicle(g.year, 'sedan'), engine: e };
  const est = standaloneCost(g, ref, 'engine', p.tech);
  const run = (gg: GameState) => startEngineFamily(gg, name || 'New engine family', e);
  return (
    <Modal onClose={onClose}>
      <h2>Develop an engine family</h2>
      <p className="small muted">A new block and cylinder head that any of your cars can use. Variants (displacement, turbo, tune, hybrid) are calibrated later at a fraction of the cost.</p>
      <label className="field"><span className="lab"><span>Name</span></span><input type="text" value={name} placeholder="e.g. EA-2000" onChange={(x) => setName(x.target.value)} /></label>
      <Select label="Layout" value={e.layout} onChange={(v) => up({ layout: v, displacement: v === 'EV' ? e.displacement : Math.round(CYL[v] * 500) })} options={LAYOUTS.map((l) => ({ value: l, label: LAYOUT_NAME[l], disabled: l === 'EV' && !hasTech(p.tech, 'ev') }))} />
      {ev ? <Slider label="Base motor power" value={e.motorKw} min={40} max={600} step={5} onChange={(v) => up({ motorKw: v })} fmt={(v) => `${v} kW (variants ${Math.round(v * MOTOR_RANGE[0])}–${Math.round(v * MOTOR_RANGE[1])} kW)`} />
        : <>
          <Slider label="Base displacement" value={e.displacement} min={CYL[e.layout] * 200} max={Math.min(8400, CYL[e.layout] * 800)} step={10} onChange={(v) => up({ displacement: v })} fmt={(v) => `${v} cc (variants ${Math.round(v * DISP_RANGE[0])}–${Math.round(v * DISP_RANGE[1])} cc)`} />
          <Select label="Valvetrain" value={e.valvetrain} onChange={(v) => up({ valvetrain: v })} options={[{ value: 'ohv', label: 'Pushrod OHV' }, { value: 'sohc', label: 'SOHC' }, { value: 'dohc2', label: 'DOHC 2-valve' }, { value: 'dohc4', label: 'DOHC 4-valve', disabled: !hasTech(p.tech, 'dohc4') }]} />
          <Select label="Fuel system" value={e.fuelSystem} onChange={(v) => up({ fuelSystem: v })} options={[{ value: 'carb', label: 'Carburettor' }, { value: 'mfi', label: 'Mechanical injection', disabled: !hasTech(p.tech, 'mfi') }, { value: 'efi', label: 'Electronic injection', disabled: !hasTech(p.tech, 'efi') }, { value: 'di', label: 'Direct injection', disabled: !hasTech(p.tech, 'di') }]} />
          <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={e.aluBlock} onChange={(x) => up({ aluBlock: x.target.checked })} /> Aluminium block</label>
        </>}
      <StatLine label="Estimated programme cost" value={<b>{fmtMoney(est.cost)}</b>} /><StatLine label="Duration" value={`≈ ${est.months} months`} />
      <ImpactPreview deps={[name, e]} horizon={12} run={run} />
      <div className="row end"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => { if (act(run, 'Engine programme started.')) onClose(); }}>Start programme</button></div>
    </Modal>
  );
}

function VariantForm({ fam, onClose }: { fam: EngineFamily; onClose: () => void }) {
  const { g, p } = useGame();
  const act = useStore((s) => s.act);
  const base = fam.variants.find((v) => v.status === 'ready') ?? fam.variants[0];
  const [e, setE] = useState<EngineSpec>(familyEngine(fam, base));
  const up = (x: Partial<EngineSpec>) => setE((o) => ({ ...o, ...x }));
  const ev = fam.layout === 'EV';
  const why = engineFits(fam, e);
  const st = computeVehicle({ ...defaultVehicle(g.year, 'sedan'), engine: e }, { year: g.year, tech: p.tech });
  const k = variantShare(fam, e);
  const power = st.engine.powerKw;
  const run = (gg: GameState) => addEngineVariant(gg, fam.id, e);
  return (
    <Modal onClose={onClose}>
      <h2>New variant of {fam.name}</h2>
      {ev ? <>
        <Slider label="Motor power" value={e.motorKw} min={Math.round(fam.baseMotorKw * MOTOR_RANGE[0])} max={Math.round(fam.baseMotorKw * MOTOR_RANGE[1])} step={5} onChange={(v) => up({ motorKw: v })} fmt={(v) => `${v} kW`} />
        <Slider label="Battery" value={e.batteryKwh} min={10} max={150} onChange={(v) => up({ batteryKwh: v })} fmt={(v) => `${v} kWh`} />
      </> : <>
        <Slider label="Displacement" value={e.displacement} min={Math.round(fam.baseDisplacement * DISP_RANGE[0])} max={Math.round(fam.baseDisplacement * DISP_RANGE[1])} step={10} onChange={(v) => up({ displacement: v })} fmt={(v) => `${v} cc`} />
        <Select label="Aspiration" value={e.aspiration} onChange={(v) => up({ aspiration: v, boost: v === 'na' ? e.boost : Math.max(e.boost, 0.6), compression: v === 'na' ? Math.max(e.compression, 10) : Math.min(e.compression, 9.8) })} options={[{ value: 'na', label: 'Naturally aspirated' }, { value: 'turbo', label: 'Turbo', disabled: !hasTech(p.tech, 'turbo') }, { value: 'twinturbo', label: 'Twin-turbo', disabled: !hasTech(p.tech, 'twinturbo') }, { value: 'supercharged', label: 'Supercharged' }]} />
        {e.aspiration !== 'na' && <Slider label="Boost" value={e.boost} min={0.2} max={2.2} step={0.05} onChange={(v) => up({ boost: v })} fmt={(v) => `${v.toFixed(2)} bar`} />}
        <Slider label="Tune (cam and rev limit)" value={e.cam} min={0} max={1} step={0.05} onChange={(v) => up({ cam: v, redline: Math.round((5600 + 2400 * v) / 100) * 100 })} fmt={(v) => (v < 0.3 ? 'Economy' : v < 0.6 ? 'Standard' : 'Performance')} />
        <Slider label="Hybrid assistance" value={e.hybridKw} min={0} max={200} step={5} disabled={!hasTech(p.tech, 'hybrid')} onChange={(v) => up({ hybridKw: v })} fmt={(v) => (v ? `${v} kW` : 'None')} />
      </>}
      <StatLine label="Output (estimate)" value={`${Math.round(power)} kW · ${Math.round(st.engine.torqueNm)} Nm · reliability ${Math.round(st.engine.reliability)}`} />
      <StatLine label="Calibration cost" value={<b>{fmtMoney(st.devCost * SHARE.engine * k)}</b>} title="Paid now. A new engine family would cost several times more." /><StatLine label="Ready in" value={`≈ ${Math.round(3 + 20 * k)} months`} />
      {why.length > 0 && <div className="errbox">{why.map((x) => <div key={x}>{x}</div>)}</div>}
      <ImpactPreview deps={[e]} horizon={6} run={run} />
      <div className="row end"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={why.length > 0} onClick={() => { if (act(run, 'Variant programme started.')) onClose(); }}>Calibrate variant</button></div>
    </Modal>
  );
}

function PlatformForm({ onClose }: { onClose: () => void }) {
  const { g, p } = useGame();
  const act = useStore((s) => s.act);
  const [name, setName] = useState('');
  const [s, setS] = useState<VehicleSpec>(defaultVehicle(g.year, 'sedan'));
  const [bay, setBay] = useState<'I4' | 'V6' | 'V8'>('I4');
  const up = (x: Partial<VehicleSpec>) => setS((o) => ({ ...o, ...x }));
  const ref: VehicleSpec = { ...s, engine: { ...s.engine, layout: bay, displacement: bay === 'I4' ? 2000 : bay === 'V6' ? 3000 : 4400 } };
  const est = standaloneCost(g, ref, 'platform', p.tech);
  const run = (gg: GameState) => startPlatform(gg, name || 'New platform', ref);
  return (
    <Modal onClose={onClose}>
      <h2>Develop a platform</h2>
      <p className="small muted">Structure, crash structure, suspension pick-up points and engine mounting shared by several cars — for example a hatchback, a saloon and a crossover. Each car still has its own body, cabin, tuning and size within the platform's range.</p>
      <label className="field"><span className="lab"><span>Name</span></span><input type="text" value={name} placeholder="e.g. MX-1" onChange={(x) => setName(x.target.value)} /></label>
      <Select label="Reference body (sets the body group)" value={s.body} onChange={(v) => up({ body: v })} options={(['hatch', 'sedan', 'suv', 'coupe', 'roadster', 'supercar', 'pickup'] as const).map((b) => ({ value: b, label: b }))} />
      <p className="tiny muted">{CLASS_NAME[s.body === 'pickup' || s.chassis === 'ladder' ? 'truck' : s.body === 'supercar' || s.body === 'roadster' ? 'sports' : 'car']}</p>
      <Select label="Structure" value={s.chassis} onChange={(v) => up({ chassis: v })} options={[{ value: 'steel', label: 'Steel monocoque' }, { value: 'ladder', label: 'Ladder frame' }, { value: 'spaceframe', label: 'Spaceframe' }, { value: 'aluminium', label: 'Aluminium', disabled: !hasTech(p.tech, 'aluminium') }, { value: 'carbon', label: 'Carbon', disabled: !hasTech(p.tech, 'carbon') }]} />
      <Select label="Engine position" value={s.enginePos} onChange={(v) => up({ enginePos: v, drive: v !== 'front' && s.drive === 'FWD' ? 'RWD' : s.drive })} options={[{ value: 'front', label: 'Front' }, { value: 'mid', label: 'Mid' }, { value: 'rear', label: 'Rear' }]} />
      <Select label="Engine bay" value={bay} onChange={setBay} options={[{ value: 'I4', label: `Compact — ${BAY_NAME[BAY.I4]}` }, { value: 'V6', label: `Medium — ${BAY_NAME[BAY.V6]}` }, { value: 'V8', label: `Large — ${BAY_NAME[BAY.V8]}` }]} />
      <Select label="Primary drive" value={s.drive} onChange={(v) => up({ drive: v })} options={[{ value: 'FWD', label: 'Front-wheel drive (+AWD)', disabled: s.enginePos !== 'front' }, { value: 'RWD', label: 'Rear-wheel drive (+AWD)' }]} />
      <Slider label="Base size" value={s.size} min={0.85} max={1.15} step={0.01} onChange={(v) => up({ size: v })} fmt={(v) => `${v.toFixed(2)} (cars ${(v * 0.93).toFixed(2)}–${(v * 1.07).toFixed(2)})`} />
      <Select label="Rear suspension" value={s.suspRear} onChange={(v) => up({ suspRear: v })} options={[{ value: 'solid', label: 'Solid axle' }, { value: 'macpherson', label: 'Strut' }, { value: 'wishbone', label: 'Double wishbone' }, { value: 'multilink', label: 'Multi-link', disabled: !hasTech(p.tech, 'multilink') }]} />
      <Select label="Crash structure" value={s.safety} onChange={(v) => up({ safety: v })} options={[0, 1, 2, 3].map((v) => ({ value: v, label: ['None', 'Crumple zones', 'Airbags & ABS', 'Full modern'][v], disabled: v > 0 && !hasTech(p.tech, `safety${v}`) }))} />
      <StatLine label="Estimated programme cost" value={<b>{fmtMoney(est.cost)}</b>} /><StatLine label="Duration" value={`≈ ${est.months} months`} />
      <ImpactPreview deps={[name, s, bay]} horizon={12} run={run} />
      <div className="row end"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => { if (act(run, 'Platform programme started.')) onClose(); }}>Start programme</button></div>
    </Modal>
  );
}
