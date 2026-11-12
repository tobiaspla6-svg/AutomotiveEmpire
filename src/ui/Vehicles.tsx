import { useMemo, useState } from 'react';
import type { BodyType, EngineLayout, SegmentId, VehicleModel, VehicleSpec } from '../sim/types';
import { useGame, useStore } from '../store/game';
import { BODY, CYL, LAYOUT_NAME, SCORE_KEYS, computeVehicle, defaultVehicle, suggestFinalDrive } from '../sim/engineering';
import { hasTech, missingTechs, TECH_BY_ID } from '../data/tech';
import { SEG, SEGMENTS, segPrice } from '../data/world';
import { cancelDevelopment, retireModel, setPrice, startDevelopment, validateSpec } from '../sim/actions';
import { devEngineersNeeded, estimateUnitCost, makeModel } from '../sim/company';
import { annualSupply, computeMarket, suggestSegment } from '../sim/market';
import { DEALER_NET, TYPICAL_VOLUME, contributionAt, demandCurve, priceGuide } from '../sim/pricing';
import { fmtMoney, fmtNum } from '../sim/util';
import { BarList, LineChart, PageHead, ScoreBar, Seg, Select, Slider, StatLine, Tag } from './common';
import { CarViewer } from '../three/CarViewer';
import { RoadCar } from '../three/CarModel';
import { REGION_IDS } from '../data/world';

const STATUS: Record<VehicleModel['status'], string> = { design: 'Design', development: 'In development', ready: 'Ready — needs a production line', production: 'In production', retired: 'Retired' };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function VehiclesView() {
  const { g, p } = useGame();
  const act = useStore((s) => s.act), ask = useStore((s) => s.ask);
  const [editing, setEditing] = useState<{ spec: VehicleSpec; basedOn?: string; name: string } | null>(null);
  const [inspect, setInspect] = useState<string | null>(null);
  if (editing) return <Designer init={editing.spec} basedOn={editing.basedOn} initName={editing.name} onClose={() => setEditing(null)} />;
  const models = p.models.filter((m) => m.status !== 'retired');
  const shown = models.find((m) => m.id === inspect) ?? models[0];
  return (
    <>
      <PageHead title="Vehicles" right={<button className="btn primary" onClick={() => setEditing({ spec: { ...defaultVehicle(g.year), color: p.color }, name: '' })}>+ Design a new vehicle</button>}>
        Engineer cars from the cylinder bore up, develop them, and manage the range. Redesigning an existing model as a new generation re-uses its platform and engine where they are unchanged.
      </PageHead>
      {models.length === 0 && <div className="panel"><h3>No vehicles yet</h3><p className="dim">Open the design studio to engineer your first car. You have {p.engineers} engineers; technology level is about {Math.round((p.tech.engine + p.tech.chassis) / 2)}.</p></div>}
      {shown && (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)' }}>
          <div className="viewer" style={{ height: 340 }}>
            <CarViewer><RoadCar spec={shown.spec} /></CarViewer>
            <div className="overlay"><b>{shown.name}</b> · {BODY[shown.spec.body].name} · {SEG[shown.segment].name}</div>
            <div className="hint">drag to rotate · scroll to zoom</div>
          </div>
          <ModelCard m={shown} />
        </div>
      )}
      {models.length > 0 && (
        <div className="panel flush"><div className="tablewrap" style={{ maxHeight: 460 }}><table>
          <thead><tr><th>Model</th><th>Status</th><th>Segment</th><th className="r">Power</th><th className="r">0–100</th><th className="r">Unit cost</th><th className="r">Price</th><th className="r">Sold / mo</th><th className="r">Demand</th><th className="r">Stock</th><th /></tr></thead>
          <tbody>{models.map((m) => {
            const sold = REGION_IDS.reduce((a, r) => a + m.lastSales[r], 0);
            const cost = m.lastUnitCost || estimateUnitCost(g, p, m);
            return (
              <tr key={m.id} className={'click' + (shown?.id === m.id ? ' me' : '')} onClick={() => setInspect(m.id)}>
                <td><b>{m.name}</b>{m.historical && <> <Tag kind="h" title="Real model name, years and engine layout; all other details estimated">hist.</Tag></>}<div className="tiny muted">Gen {m.generation} · designed {m.designYear}{m.launchYear ? ` · on sale since ${m.launchYear}` : ''}</div></td>
                <td>{m.status === 'development' ? <span className="warn">Development · {Math.ceil(m.devMonthsLeft)} mo left</span> : m.status === 'ready' ? <span className="accent">{STATUS.ready}</span> : STATUS[m.status]}</td>
                <td>{SEG[m.segment].name}</td>
                <td className="r">{Math.round(m.stats.powerKw)} kW</td><td className="r">{m.stats.zeroTo100.toFixed(1)} s</td>
                <td className="r">{fmtMoney(cost)}</td>
                <td className="r" onClick={(e) => e.stopPropagation()}>{m.status === 'development' ? '—' : <PriceInput price={m.price} label={`Price of ${m.name}`} onCommit={(v) => act((gg) => setPrice(gg, m.id, v))} />}</td>
                <td className="r">{fmtNum(sold)}</td><td className="r">{fmtNum(m.lastDemand)}</td><td className="r">{fmtNum(m.inventory)}</td>
                <td className="r" onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                  {m.status === 'development' ? <button className="btn sm danger" onClick={() => act((gg) => cancelDevelopment(gg, m.id), 'Programme cancelled.')}>Cancel</button> : <>
                    <button className="btn sm" onClick={() => setEditing({ spec: JSON.parse(JSON.stringify(m.spec)), basedOn: m.id, name: nextName(m.name) })}>New generation</button>{' '}
                    <button className="btn sm ghost" onClick={() => ask(`Retire the ${m.name}? Its production lines will be freed.`, () => { act((gg) => retireModel(gg, m.id)); })}>Retire</button></>}
                </td>
              </tr>);
          })}</tbody>
        </table></div></div>
      )}
    </>
  );
}
/** Edits a price locally and commits it on Enter or when focus leaves; invalid entries revert. */
function PriceInput({ price, label, onCommit }: { price: number; label: string; onCommit: (v: number) => boolean }) {
  const [text, setText] = useState<string | null>(null);
  const commit = () => { if (text === null) return; const v = Number(text); setText(null); if (v !== Math.round(price)) onCommit(v); };
  return <input type="number" min={1} style={{ width: 96, textAlign: 'right' }} aria-label={label} value={text ?? String(Math.round(price))} step={Math.max(50, Math.round(price / 100))}
    onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setText(null); }} />;
}
const nextName = (n: string) => { const m = n.match(/^(.*?)(?: Mk ?(\d+))?$/); return m ? `${m[1]} Mk${Number(m[2] ?? 1) + 1}` : n + ' II'; };

function ModelCard({ m }: { m: VehicleModel }) {
  const { g, p } = useGame();
  const s = m.stats;
  const act = useStore((st) => st.act);
  const cost = m.lastUnitCost || estimateUnitCost(g, p, m);
  const margin = m.price * DEALER_NET - cost;
  const onSale = m.status === 'production' || m.status === 'ready';
  // price guidance at the volume the lines can build (or a typical volume before a line exists)
  const hasLine = p.factories.some((f) => f.lines.some((l) => l.modelId === m.id));
  const vol = hasLine ? annualSupply(p, m) / 12 : TYPICAL_VOLUME[m.segment];
  const mk = useMemo(() => computeMarket(g), [g.year, g.month, g.companies.length]);
  const guide = useMemo(() => priceGuide(g, p, m, vol, { mk }), [mk, m.id, m.price, vol, m.lastUnitCost]);
  const curve = useMemo(() => demandCurve(g, p, m, vol, mk), [mk, m.id, vol]);
  const at = (price: number) => { const d = Math.min(curve(price), vol); return { d, profit: contributionAt(price, guide.unitCost) * d }; };
  const now = at(m.price), rec = at(guide.recommended);
  return (
    <div className="panel col" style={{ gap: 8 }}>
      <div className="row between"><h3>{m.name}</h3><span className="muted small">{STATUS[m.status]}</span></div>
      <div className="grid g2" style={{ gap: 4 }}>
        <StatLine label="Engine" value={m.spec.engine.layout === 'EV' ? `Electric, ${m.spec.engine.batteryKwh} kWh` : `${LAYOUT_NAME[m.spec.engine.layout]} ${(m.spec.engine.displacement / 1000).toFixed(1)} L`} />
        <StatLine label="Power / torque" value={`${Math.round(s.powerKw)} kW / ${Math.round(s.torqueNm)} Nm`} />
        <StatLine label="Mass" value={`${Math.round(s.mass)} kg`} /><StatLine label="Top speed" value={`${Math.round(s.topSpeed)} km/h`} />
        <StatLine label={s.engine.isEV ? 'Consumption' : 'Fuel (combined)'} value={s.engine.isEV ? `${s.fuelCombined.toFixed(1)} kWh/100 km` : `${s.fuelCombined.toFixed(1)} L/100 km`} />
        <StatLine label="Unit cost" value={fmtMoney(cost)} /><StatLine label="Contribution per car (after dealer)" value={<span className={margin < 0 ? 'bad' : 'good'}>{fmtMoney(margin)}{m.price > 0 ? ` · ${Math.round((margin / (m.price * DEALER_NET)) * 100)}%` : ''}</span>} />
      </div>
      {onSale && <div className="col" style={{ gap: 3 }}>
        <h4>Pricing at {fmtNum(vol)} cars / month <span className="muted tiny">(estimates from today's market)</span></h4>
        <div className="grid g2" style={{ gap: 4 }}>
          <StatLine label="Your price" value={<b>{fmtMoney(m.price)}</b>} /><StatLine label="Recommended retail price" value={<b>{fmtMoney(guide.recommended)}</b>} title="The price that earns the most contribution at this volume, given the demand curve and your competitors' current prices." />
          <StatLine label="Worth to buyers" value={fmtMoney(guide.value)} title="What buyers of this segment consider a fair price for this car from your brand, including any scarcity premium. Above it, demand falls away quickly." /><StatLine label="Break-even price" value={<span className={m.price < guide.breakEven ? 'bad' : ''}>{fmtMoney(guide.breakEven)}</span>} title={`Unit cost plus ${fmtMoney(guide.devPerCar)} development and ${fmtMoney(guide.toolingPerCar)} tooling per car over ${fmtNum(guide.lifeUnits)} cars, after the dealer's ${Math.round((1 - DEALER_NET) * 100)}% margin.`} />
          <StatLine label="Est. sales at your price" value={`${fmtNum(now.d)} / mo`} /><StatLine label="Est. sales at recommended" value={`${fmtNum(rec.d)} / mo`} />
          <StatLine label="Est. contribution at your price" value={<span className={now.profit < 0 ? 'bad' : ''}>{fmtMoney(now.profit)} / mo</span>} /><StatLine label="Est. contribution at recommended" value={`${fmtMoney(rec.profit)} / mo`} />
        </div>
        {m.price < guide.breakEven && <div className="warnbox">Below break-even: at {fmtMoney(m.price)} each car fails to cover its share of development and tooling.</div>}
        {m.price > guide.value * 1.35 && <div className="warnbox">Priced {Math.round((m.price / guide.value - 1) * 100)}% above what buyers think the car is worth: expect weak sales.</div>}
        {Math.abs(m.price / guide.recommended - 1) > 0.03 && <div className="row"><button className="btn sm" onClick={() => act((gg) => setPrice(gg, m.id, Math.round(guide.recommended / 10) * 10), 'Price set to the recommended retail price.')}>Use recommended price</button></div>}
      </div>}
      <div className="col" style={{ gap: 4 }}>{SCORE_KEYS.map((k) => <ScoreBar key={k} label={cap(k)} value={s.scores[k]} color={(SEG[m.segment].weights[k] ?? 0) >= 0.15 ? 'var(--accent)' : 'var(--s1)'} />)}</div>
      <p className="tiny muted">Scores are relative to the standards of {g.year}: an ageing design scores lower every year. Highlighted bars matter most to {SEG[m.segment].name.toLowerCase()} buyers.</p>
      {m.status === 'development' && <p className="small warn">In development: {Math.ceil(m.devMonthsLeft)} of {m.devMonthsTotal} months left · {fmtMoney(m.devCostPaid)} of {fmtMoney(m.devCostTotal)} spent · needs ≈{Math.round(devEngineersNeeded(g, p, m))} engineers.</p>}
    </div>
  );
}

// ----------------------------------------------------------------------------- design studio
const TABS = ['Body', 'Chassis', 'Engine', 'Driveline', 'Running gear', 'Aero', 'Cabin'] as const;
const LAYOUTS: EngineLayout[] = ['I2', 'I3', 'I4', 'I5', 'I6', 'V6', 'V8', 'V10', 'V12', 'F4', 'F6', 'F12', 'EV'];

function Designer({ init, basedOn, initName, onClose }: { init: VehicleSpec; basedOn?: string; initName: string; onClose: () => void }) {
  const { g, p } = useGame();
  const act = useStore((s) => s.act);
  const [spec, setSpec] = useState<VehicleSpec>(init);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Body');
  const [name, setName] = useState(initName);
  const [segOverride, setSegOverride] = useState<SegmentId | null>(null);
  const up = (patch: Partial<VehicleSpec>) => setSpec((s) => ({ ...s, ...patch }));
  const upE = (patch: Partial<VehicleSpec['engine']>) => setSpec((s) => ({ ...s, engine: { ...s.engine, ...patch } }));
  const stats = useMemo(() => computeVehicle(spec, { year: g.year, tech: p.tech }), [spec, g.year, p.tech]);
  const temp = useMemo(() => { const m = makeModel({ ...g, nextId: 0 } as typeof g, 'x', spec, 'family', p.tech, g.year); return m; }, [spec, g.year]);
  const unit = estimateUnitCost(g, p, temp, 400);
  const autoSeg = suggestSegment(stats.scores as unknown as Record<string, number>, spec.body, unit, g.year);
  const seg = segOverride ?? autoSeg;
  temp.segment = seg;
  const [planVol, setPlanVol] = useState<number | null>(null);
  const vol = planVol ?? TYPICAL_VOLUME[seg];
  const mk = useMemo(() => computeMarket(g), [g.year, g.month, g.companies.length]);
  const guide = useMemo(() => priceGuide(g, p, temp, vol, { mk, devCost: stats.devCost }), [mk, temp, seg, vol]);
  const volToSlider = (v: number) => Math.round((Math.log(v / 5) / Math.log(4000)) * 100);
  const sliderToVol = (t: number) => { const v = 5 * Math.pow(4000, t / 100); const stepSize = v < 50 ? 1 : v < 500 ? 10 : v < 5000 ? 50 : 500; return Math.round(v / stepSize) * stepSize; };
  const missing = missingTechs(spec, p.tech);
  const invalid = validateSpec(spec);
  const lock = (id: string) => !hasTech(p.tech, id);
  const note = (id: string) => (lock(id) ? `needs ${TECH_BY_ID[id].year} tech` : undefined);
  const ev = spec.engine.layout === 'EV';
  const e = spec.engine;
  const base = basedOn ? p.models.find((m) => m.id === basedOn) : undefined;
  const rpmLabels = stats.engine.curve.map((c) => String(c.rpm));
  const maxGears = lock('gears5') ? 4 : lock('gears6') ? 5 : lock('gears8') ? 6 : lock('gears10') ? 8 : 10;
  const def = SEG[seg];
  const fit = (def.bodyFit[spec.body] ?? 0.3);
  return (
    <>
      <PageHead title={base ? `New generation of the ${base.name}` : 'Design studio'} right={<button className="btn" onClick={onClose}>← Back to the range</button>}>
        Every number on the right is calculated from your specification with physical models: mean-effective-pressure engine model, time-step acceleration with traction limits, road-load fuel consumption and a bill-of-materials cost model.
      </PageHead>
      <div className="designer">
        <div className="panel col">
          <Seg value={tab} options={TABS.map((t) => ({ value: t, label: t }))} onChange={setTab} />
          {tab === 'Body' && <>
            <Select label="Body style" value={spec.body} options={(Object.keys(BODY) as BodyType[]).map((b) => ({ value: b, label: BODY[b].name }))} onChange={(v) => up({ body: v, seats: Math.min(spec.seats, BODY[v].seats + 2) > 0 ? BODY[v].seats : spec.seats })} />
            <Slider label="Size" value={spec.size} min={0.85} max={1.15} step={0.01} onChange={(v) => up({ size: v })} fmt={() => `${stats.length.toFixed(2)} × ${stats.width.toFixed(2)} m`} />
            <Select label="Seats" value={spec.seats} options={[2, 4, 5, 7].map((n) => ({ value: n, label: `${n} seats`, disabled: n > BODY[spec.body].seats + 2 }))} onChange={(v) => up({ seats: v })} />
            <Slider label="Engineering quality & craftsmanship" value={spec.quality} min={0} max={1} step={0.01} onChange={(v) => up({ quality: v })} fmt={(v) => `${Math.round(v * 100)}%`} hint="Tighter tolerances, better materials and more testing: reliability and refinement up, cost up steeply." />
            <label className="field"><span className="lab"><span>Paint</span></span><div className="row wrap" style={{ gap: 6 }}>{['#b3261e', '#f2f2f0', '#15171b', '#8f969e', '#1f5fbf', '#0c4d2c', '#e8b04a', '#d95926', '#5b2a86'].map((c) => <button key={c} aria-label={`Paint ${c}`} onClick={() => up({ color: c })} style={{ width: 24, height: 24, borderRadius: 6, background: c, border: spec.color === c ? '2px solid var(--accent)' : '1px solid var(--line2)', cursor: 'pointer' }} />)}<input type="color" value={spec.color} onChange={(ev2) => up({ color: ev2.target.value })} /></div></label>
          </>}
          {tab === 'Chassis' && <>
            <Select label="Chassis construction" value={spec.chassis} onChange={(v) => up({ chassis: v })} options={[
              { value: 'ladder', label: 'Ladder frame (tough, heavy)' }, { value: 'steel', label: 'Steel monocoque' }, { value: 'spaceframe', label: 'Tubular spaceframe (light, labour-intensive)' },
              { value: 'aluminium', label: 'Aluminium monocoque', disabled: lock('aluminium'), note: note('aluminium') }, { value: 'carbon', label: 'Carbon-fibre monocoque', disabled: lock('carbon'), note: note('carbon') }]} />
            <Select label="Body panels" value={spec.panels} onChange={(v) => up({ panels: v })} options={[
              { value: 'steel', label: 'Steel' }, { value: 'aluminium', label: 'Aluminium' }, { value: 'fibreglass', label: 'Fibreglass', disabled: lock('fibreglass'), note: note('fibreglass') }, { value: 'carbon', label: 'Carbon fibre', disabled: lock('carbonpanel'), note: note('carbonpanel') }]} />
            <Select label="Engine position" value={spec.enginePos} onChange={(v) => up({ enginePos: v, drive: v !== 'front' && spec.drive === 'FWD' ? 'RWD' : spec.drive })} options={[{ value: 'front', label: 'Front' }, { value: 'mid', label: 'Mid (behind the seats)' }, { value: 'rear', label: 'Rear (behind the axle)' }]} />
            <Select label="Safety engineering" value={spec.safety} onChange={(v) => up({ safety: v })} options={[
              { value: 0, label: 'None' }, { value: 1, label: 'Crumple zones & seat belts', disabled: lock('safety1'), note: note('safety1') }, { value: 2, label: 'ABS & airbags', disabled: lock('safety2'), note: note('safety2') }, { value: 3, label: 'Stability control & assistance', disabled: lock('safety3'), note: note('safety3') }]} />
            <div className="col" style={{ gap: 3 }}><h4>Mass breakdown</h4><BarList items={Object.entries(stats.massBreakdown).map(([label, value]) => ({ label, value }))} fmt={(v) => `${Math.round(v)} kg`} total /></div>
          </>}
          {tab === 'Engine' && <>
            <Select label="Architecture" value={e.layout} onChange={(v) => upE({ layout: v })} options={LAYOUTS.map((l) => ({ value: l, label: LAYOUT_NAME[l], disabled: l === 'EV' && lock('ev'), note: l === 'EV' ? note('ev') : undefined }))} />
            {ev ? <>
              <Slider label="Motor power" value={e.motorKw} min={30} max={800} step={5} onChange={(v) => upE({ motorKw: v })} fmt={(v) => `${v} kW`} />
              <Slider label="Battery capacity" value={e.batteryKwh} min={10} max={150} step={1} onChange={(v) => upE({ batteryKwh: v })} fmt={(v) => `${v} kWh`} />
              <p className="small muted">Battery mass and cost per kWh fall quickly with powertrain technology level (currently {p.tech.engine.toFixed(0)}).</p>
            </> : <>
              <Slider label="Displacement" value={e.displacement} min={CYL[e.layout] * 160} max={Math.min(8400, CYL[e.layout] * 900)} step={10} onChange={(v) => upE({ displacement: v })} fmt={(v) => `${v} cc (${Math.round(v / CYL[e.layout])} cc / cyl)`} />
              <Slider label="Bore / stroke ratio" value={e.boreStroke} min={0.7} max={1.6} step={0.01} onChange={(v) => upE({ boreStroke: v })} fmt={(v) => `${v.toFixed(2)} · ${(stats.engine.bore * 1000).toFixed(0)} × ${(stats.engine.stroke * 1000).toFixed(0)} mm`} hint="Oversquare engines (>1) have a short stroke: lower piston speed, so they can rev higher." />
              <Select label="Valvetrain" value={e.valvetrain} onChange={(v) => upE({ valvetrain: v })} options={[{ value: 'ohv', label: 'Pushrod OHV, 2 valves' }, { value: 'sohc', label: 'Single overhead cam, 2 valves' }, { value: 'dohc2', label: 'Twin cam, 2 valves' }, { value: 'dohc4', label: 'Twin cam, 4 valves', disabled: lock('dohc4'), note: note('dohc4') }]} />
              <Select label="Fuel system" value={e.fuelSystem} onChange={(v) => upE({ fuelSystem: v })} options={[{ value: 'carb', label: 'Carburettor' }, { value: 'mfi', label: 'Mechanical injection', disabled: lock('mfi'), note: note('mfi') }, { value: 'efi', label: 'Electronic injection', disabled: lock('efi'), note: note('efi') }, { value: 'di', label: 'Direct injection', disabled: lock('di'), note: note('di') }]} />
              <Select label="Aspiration" value={e.aspiration} onChange={(v) => upE({ aspiration: v })} options={[{ value: 'na', label: 'Naturally aspirated' }, { value: 'supercharged', label: 'Supercharged' }, { value: 'turbo', label: 'Turbocharged', disabled: lock('turbo'), note: note('turbo') }, { value: 'twinturbo', label: 'Twin-turbo', disabled: lock('twinturbo'), note: note('twinturbo') }]} />
              {e.aspiration !== 'na' && <Slider label="Boost pressure" value={e.boost} min={0.2} max={2.2} step={0.05} onChange={(v) => upE({ boost: v })} fmt={(v) => `${v.toFixed(2)} bar`} />}
              <Slider label="Compression ratio" value={e.compression} min={6} max={14} step={0.1} onChange={(v) => upE({ compression: v })} fmt={(v) => `${v.toFixed(1)} : 1 · knock margin ${stats.engine.knockMargin.toFixed(1)}`} hint="Higher compression improves efficiency until the fuel knocks. Boost raises the effective compression." />
              <Slider label="Rev limit" value={e.redline} min={3500} max={10000} step={100} onChange={(v) => upE({ redline: v })} fmt={(v) => `${v} rpm · piston ${stats.engine.pistonSpeed.toFixed(1)} / ${stats.engine.pistonSpeedLimit.toFixed(1)} m/s`} />
              <Slider label="Cam profile" value={e.cam} min={0} max={1} step={0.01} onChange={(v) => upE({ cam: v })} fmt={(v) => (v < 0.3 ? 'Mild (torque)' : v < 0.65 ? 'Sport' : 'Race (top-end)')} />
              <div className="row wrap">
                <label className="row small" style={{ gap: 6, opacity: lock('vvt') ? 0.5 : 1 }}><input type="checkbox" checked={e.vvt} disabled={lock('vvt')} onChange={(x) => upE({ vvt: x.target.checked })} /> Variable valve timing{lock('vvt') ? ` (${TECH_BY_ID.vvt.year})` : ''}</label>
                <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={e.aluBlock} onChange={(x) => upE({ aluBlock: x.target.checked })} /> Aluminium block</label>
              </div>
              <Slider label="Hybrid electric assist" value={e.hybridKw} min={0} max={200} step={5} disabled={lock('hybrid')} onChange={(v) => upE({ hybridKw: v })} fmt={(v) => (lock('hybrid') ? `needs ${TECH_BY_ID.hybrid.year} tech` : v ? `${v} kW` : 'None')} />
            </>}
          </>}
          {tab === 'Driveline' && <>
            <Select label="Driven wheels" value={spec.drive} onChange={(v) => up({ drive: v })} options={[{ value: 'FWD', label: 'Front-wheel drive', disabled: spec.enginePos !== 'front' && !ev }, { value: 'RWD', label: 'Rear-wheel drive' }, { value: 'AWD', label: 'All-wheel drive', disabled: lock('awd') && spec.body !== 'suv' && spec.body !== 'pickup', note: spec.body !== 'suv' && spec.body !== 'pickup' ? note('awd') : undefined }]} />
            {!ev && <>
              <Select label="Gearbox" value={spec.gearbox} onChange={(v) => up({ gearbox: v })} options={[{ value: 'manual', label: 'Manual' }, { value: 'auto', label: 'Automatic (torque converter)' }, { value: 'dct', label: 'Dual-clutch', disabled: lock('dct'), note: note('dct') }]} />
              <Slider label="Number of gears" value={Math.min(spec.gears, maxGears)} min={3} max={maxGears} onChange={(v) => up({ gears: v })} fmt={(v) => `${v}-speed`} />
              <Slider label="Final drive ratio" value={spec.finalDrive} min={2.2} max={5.5} step={0.05} onChange={(v) => up({ finalDrive: v })} fmt={(v) => `${v.toFixed(2)} : 1`} hint="Shorter (higher number) = stronger acceleration, lower top speed and higher cruising revs." />
              <div className="row small" style={{ gap: 8 }}><button className="btn" onClick={() => up({ finalDrive: suggestFinalDrive(spec, { year: g.year, tech: p.tech }) })}>Match gearing to top speed</button><span className="muted">engineer's suggestion: {suggestFinalDrive(spec, { year: g.year, tech: p.tech }).toFixed(2)} : 1</span></div>
              {spec.enginePos === 'front' && spec.drive !== 'FWD' && <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={!!spec.transaxle} onChange={(x) => up({ transaxle: x.target.checked })} /> Rear transaxle (gearbox at the rear axle: ≈ 4 % more weight on the driven wheels, costlier driveline)</label>}
            </>}
            {ev && <p className="small muted">Electric cars use a single-speed reduction gear.</p>}
            <StatLine label="Weight on front axle" value={`${Math.round(stats.weightFront * 100)}%`} />
          </>}
          {tab === 'Running gear' && <>
            <Select label="Front suspension" value={spec.suspFront} onChange={(v) => up({ suspFront: v })} options={[{ value: 'solid', label: 'Solid axle' }, { value: 'macpherson', label: 'MacPherson strut' }, { value: 'wishbone', label: 'Double wishbone' }, { value: 'multilink', label: 'Multi-link', disabled: lock('multilink'), note: note('multilink') }]} />
            <Select label="Rear suspension" value={spec.suspRear} onChange={(v) => up({ suspRear: v })} options={[{ value: 'solid', label: 'Solid axle' }, { value: 'macpherson', label: 'Strut / semi-trailing arm' }, { value: 'wishbone', label: 'Double wishbone' }, { value: 'multilink', label: 'Multi-link', disabled: lock('multilink'), note: note('multilink') }]} />
            <Slider label="Suspension tuning" value={spec.sport} min={0} max={1} step={0.01} onChange={(v) => up({ sport: v })} fmt={(v) => (v < 0.3 ? 'Comfort' : v < 0.65 ? 'Balanced' : 'Track')} />
            <Select label="Brakes" value={spec.brakes} onChange={(v) => up({ brakes: v })} options={[{ value: 'drum', label: 'Drums' }, { value: 'disc', label: 'Solid discs', disabled: lock('disc'), note: note('disc') }, { value: 'vented', label: 'Ventilated discs', disabled: lock('vented'), note: note('vented') }, { value: 'ceramic', label: 'Carbon-ceramic', disabled: lock('ceramic'), note: note('ceramic') }]} />
            <Slider label="Tyre width" value={spec.tireWidth} min={125} max={345} step={5} onChange={(v) => up({ tireWidth: v })} fmt={(v) => `${v} mm`} />
            <Select label="Tyre compound" value={spec.tireCompound} onChange={(v) => up({ tireCompound: v })} options={[{ value: 'economy', label: 'Economy (low rolling resistance)' }, { value: 'touring', label: 'Touring' }, { value: 'sport', label: 'Sport', disabled: lock('sporttire'), note: note('sporttire') }, { value: 'semislick', label: 'Semi-slick', disabled: lock('semislick'), note: note('semislick') }]} />
            <Slider label="Wheel diameter" value={spec.wheelDia} min={12} max={22} onChange={(v) => up({ wheelDia: v })} fmt={(v) => `${v}"`} />
          </>}
          {tab === 'Aero' && <>
            <Slider label="Drag optimisation" value={spec.aeroOpt} min={0} max={1} step={0.01} onChange={(v) => up({ aeroOpt: v })} fmt={() => `Cd ${stats.cd.toFixed(3)}`} hint="Wind-tunnel hours spent smoothing the body. Adds development cost." />
            <Slider label="Rear wing" value={spec.wing} min={0} max={1} step={0.01} disabled={lock('wing')} onChange={(v) => up({ wing: v })} fmt={(v) => (lock('wing') ? `needs ${TECH_BY_ID.wing.year} tech` : v < 0.03 ? 'None' : `${Math.round(v * 100)}%`)} />
            <Slider label="Front splitter" value={spec.splitter} min={0} max={1} step={0.01} disabled={lock('splitter')} onChange={(v) => up({ splitter: v })} fmt={(v) => (lock('splitter') ? `needs ${TECH_BY_ID.splitter.year} tech` : v < 0.03 ? 'None' : `${Math.round(v * 100)}%`)} />
            <label className="row small" style={{ gap: 6, opacity: lock('flatfloor') ? 0.5 : 1 }}><input type="checkbox" checked={spec.flatFloor} disabled={lock('flatfloor')} onChange={(x) => up({ flatFloor: x.target.checked })} /> Flat underbody & diffuser{lock('flatfloor') ? ` (${TECH_BY_ID.flatfloor.year})` : ''}</label>
            <StatLine label="Frontal area" value={`${stats.frontalArea.toFixed(2)} m²`} /><StatLine label="Drag area CdA" value={`${stats.cdA.toFixed(2)} m²`} />
            <StatLine label="Vertical load at 200 km/h" value={<span className={stats.downforce200 >= 0 ? 'good' : 'warn'}>{stats.downforce200 >= 0 ? `${Math.round(stats.downforce200)} kg downforce` : `${Math.round(-stats.downforce200)} kg lift`}</span>} />
          </>}
          {tab === 'Cabin' && <>
            <Select label="Interior" value={spec.interior} onChange={(v) => up({ interior: v })} options={[{ value: 'basic', label: 'Basic' }, { value: 'standard', label: 'Standard' }, { value: 'premium', label: 'Premium' }, { value: 'luxury', label: 'Hand-finished luxury' }]} />
            <div className="col" style={{ gap: 3 }}><h4>Cost of parts per car</h4><BarList items={Object.entries(stats.costBreakdown).map(([label, value]) => ({ label, value }))} fmt={(v) => fmtMoney(v)} total /></div>
            <StatLine label="Assembly labour" value={`${Math.round(stats.labourHours)} hours`} />
          </>}
        </div>

        <div className="col">
          <div className="viewer">
            <CarViewer><RoadCar spec={spec} /></CarViewer>
            <div className="overlay">{BODY[spec.body].name} · {stats.length.toFixed(2)} m long · wheelbase {stats.wheelbase.toFixed(2)} m · {Math.round(stats.mass)} kg</div>
            <div className="hint">drag to rotate · scroll to zoom</div>
          </div>
          <div className="panel">
            <div className="grid g2">
              <div><h4>Torque (Nm)</h4><LineChart height={170} width={330} series={[{ name: 'Torque', color: '#3987e5', values: stats.engine.curve.map((c) => c.nm) }]} labels={rpmLabels} xTitle="rpm" fmt={(v) => `${Math.round(v)}`} /></div>
              <div><h4>Power (kW)</h4><LineChart height={170} width={330} series={[{ name: 'Power', color: '#d95926', values: stats.engine.curve.map((c) => c.kw) }]} labels={rpmLabels} xTitle="rpm" fmt={(v) => `${Math.round(v)}`} /></div>
            </div>
            <p className="tiny muted">{ev ? 'Electric motor: constant torque to base speed, then constant power.' : `Indicated efficiency ${(stats.engine.etaI * 100).toFixed(0)}% · peak BMEP ${stats.engine.bmepPeak.toFixed(1)} bar · ${stats.engine.specificKwL.toFixed(0)} kW/L · engine ${Math.round(stats.engine.mass)} kg · engine reliability ${Math.round(stats.engine.reliability)}/100`}</p>
          </div>
          {(missing.length > 0 || invalid.length > 0) && <div className="errbox">{invalid.map((x) => <div key={x}>{x}</div>)}{missing.length > 0 && <div>Technology not yet mastered: {missing.map((id) => `${TECH_BY_ID[id].name} (${TECH_BY_ID[id].year})`).join(', ')}. Invest in research or choose an alternative.</div>}</div>}
          {stats.warnings.length > 0 && <div className="warnbox">{stats.warnings.map((w) => <div key={w}>• {w}</div>)}</div>}
        </div>

        <div className="col stats">
          <div className="panel col" style={{ gap: 4 }}>
            <h4>Performance</h4>
            <StatLine label="Power" value={`${Math.round(stats.powerKw)} kW (${Math.round(stats.powerKw * 1.36)} PS) @ ${Math.round(stats.engine.powerRpm)}`} />
            <StatLine label="Torque" value={`${Math.round(stats.torqueNm)} Nm @ ${Math.round(stats.engine.torqueRpm)}`} />
            <StatLine label="Kerb mass" value={`${Math.round(stats.mass)} kg · ${Math.round(stats.powerToWeight)} kW/t`} />
            <StatLine label="0–100 km/h" value={`${stats.zeroTo100.toFixed(1)} s`} /><StatLine label="Quarter mile" value={`${stats.quarterMile.toFixed(1)} s`} />
            <StatLine label="80–120 km/h" value={stats.passing80to120 != null ? `${stats.passing80to120.toFixed(1)} s` : '—'} title="Full-throttle overtaking, through the gears." /><StatLine label="0–200 km/h" value={stats.zeroTo200 != null ? `${stats.zeroTo200.toFixed(1)} s` : '—'} />
            <StatLine label="Top speed" value={`${Math.round(stats.topSpeed)} km/h`} /><StatLine label="Braking 100–0" value={`${stats.braking100.toFixed(1)} m`} />
            <StatLine label="Cornering" value={`${stats.lateralG.toFixed(2)} g`} />
            <StatLine label={ev ? 'Consumption' : 'Fuel urban / highway'} value={ev ? `${stats.fuelCombined.toFixed(1)} kWh/100 km` : `${stats.fuelUrban.toFixed(1)} / ${stats.fuelHighway.toFixed(1)} L/100 km`} />
            <StatLine label="Range" value={`${Math.round(stats.rangeKm)} km`} />
          </div>
          <div className="panel col" style={{ gap: 5 }}>
            <h4>Ratings for {g.year}</h4>
            {SCORE_KEYS.map((k) => <ScoreBar key={k} label={cap(k)} value={stats.scores[k]} color={(def.weights[k] ?? 0) >= 0.15 ? 'var(--accent)' : 'var(--s1)'} />)}
          </div>
          <div className="panel col" style={{ gap: 6 }}>
            <h4>Market & programme</h4>
            <Select label={`Target segment (best fit: ${SEG[autoSeg].name})`} value={seg} options={SEGMENTS.map((s) => ({ value: s.id, label: s.name }))} onChange={(v) => setSegOverride(v)} />
            {fit < 0.7 && <div className="warnbox">A {BODY[spec.body].name.toLowerCase()} is a poor fit for {def.name.toLowerCase()} buyers (body-style fit {Math.round(fit * 100)}%).</div>}
            <Slider label="Planned volume" value={volToSlider(vol)} min={0} max={100} onChange={(t) => setPlanVol(sliderToVol(t))} fmt={() => `${fmtNum(vol)} cars / month`} hint="Unit cost, the share of development each car must carry, scarcity and the recommended price all depend on how many you plan to build." />
            <StatLine label="Unit cost at this volume" value={fmtMoney(guide.unitCost)} title="Parts and assembly labour per car." />
            <StatLine label="Development + tooling per car" value={fmtMoney(guide.devPerCar + guide.toolingPerCar)} title={`Spread over ${fmtNum(guide.lifeUnits)} cars: the planned volume for the ${Math.round(guide.lifeUnits / vol / 12)} years a ${def.name.toLowerCase()} model usually stays on sale.`} />
            <StatLine label="Break-even price" value={fmtMoney(guide.breakEven)} title="List price at which a car covers its unit cost and its share of development and tooling after the dealer's margin." />
            <StatLine label="Segment reference price" value={fmtMoney(segPrice(seg, g.year))} />
            <StatLine label="Worth to buyers (est.)" value={fmtMoney(guide.value)} title="What buyers of this segment consider a fair price for this car from your brand at this volume. Better cars, stronger brands and — for prestige makers — rarer cars are worth more." />
            <StatLine label="Recommended retail price (est.)" value={<b>{fmtMoney(guide.recommended)}</b>} title="The price that earns the most contribution at the planned volume with competitors at today's prices. You can set any price once the car is on sale." />
            <StatLine label="Contribution margin (est.)" value={<span className={guide.contribution < 0 ? 'bad' : 'good'}>{fmtMoney(guide.contribution)} / car · {Math.round(guide.contributionPct * 100)}%</span>} title="Net price after the dealer's margin minus unit cost, at the recommended price." />
            <StatLine label="Demand at that price (est.)" value={guide.blind ? 'no dealers yet' : `${fmtNum(guide.rawDemand)} / month`} />
            {!guide.viable && <div className="warnbox">Not viable at this volume: the break-even price is {Math.round((guide.breakEven / guide.recommended - 1) * 100)}% above the best price the market will pay. Raise the volume, cut cost, or accept a loss-making flagship.</div>}
            {guide.viable && !guide.blind && guide.rawDemand < vol * 0.6 && <div className="warnbox">Estimated demand is well below the planned volume — plan a smaller line, or a cheaper or better car.</div>}
            {!guide.blind && guide.rawDemand > vol * 1.5 && <p className="tiny muted">Demand exceeds the planned volume; the recommended price already rations the cars you can build.</p>}
            <StatLine label="Development cost" value={fmtMoney(stats.devCost)} title="The full budget is charged month by month as the work progresses. Reduced when a new generation re-uses the previous platform or engine." />
            <StatLine label="Development time" value={`≈ ${stats.devMonths} months with enough engineers`} />
            <StatLine label="Line tooling" value={`${fmtMoney(stats.toolingPerUnitCapacity)} per unit of monthly capacity`} />
            <label className="field"><span className="lab"><span>Model name</span></span><input type="text" value={name} maxLength={32} placeholder="e.g. GT 2000" onChange={(x) => setName(x.target.value)} /></label>
            <button className="btn primary" disabled={missing.length > 0 || invalid.length > 0 || !name.trim()} onClick={() => { if (act((gg) => startDevelopment(gg, name, spec, seg, basedOn), 'Development programme started.')) onClose(); }}>Start development</button>
            <p className="tiny muted">You have {p.engineers} engineers and {fmtMoney(p.cash)} in cash.</p>
          </div>
        </div>
      </div>
    </>
  );
}
