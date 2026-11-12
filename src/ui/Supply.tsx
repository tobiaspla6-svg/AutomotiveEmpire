// Supply chain panel and per-plant production stages.
import { useState } from 'react';
import type { ComponentCategory, Factory, GameState, StageId } from '../sim/types';
import { useGame, useStore } from '../store/game';
import { CATEGORIES, CATEGORY_NAME, IN_HOUSE, SUPPLIER_BY_ID, suppliersFor } from '../data/suppliers';
import { buildInHouse, endContract, expandStage, setInspection, setSafetyStock, signContract, stageCost } from '../sim/actions';
import { bottleneck, capacityRef, inHouseCost, inspectionOf, quote, STAGE_NAME, STAGES, stagesOf, supplierCapacity } from '../sim/supply';
import { REGION_NAME } from '../data/world';
import { fmtMoney, fmtNum } from '../sim/util';
import { Modal, Select, Slider, StatLine } from './common';
import { ImpactPreview } from './Impact';

const pct = (x: number) => `${x >= 1 ? '+' : ''}${((x - 1) * 100).toFixed(1)}%`;

export function SupplyPanel() {
  const { p } = useGame();
  const act = useStore((s) => s.act);
  const [edit, setEdit] = useState<ComponentCategory | null>(null);
  const sup = p.supply;
  const monthly = p.factories.reduce((a, f) => a + (f.lastOutput ?? 0), 0);
  return (
    <div className="panel col">
      <div className="row between wrap"><h3>Supply chain</h3>
        <Slider label="Component safety stock" value={sup?.safetyStock ?? 0} min={0} max={2} step={0.25} onChange={(v) => act((gg) => setSafetyStock(gg, v))} fmt={(v) => (v ? `${v} month${v === 1 ? '' : 's'} (${Math.round(((sup?.buffer ?? 0) / Math.max(v, 1e-9)) * 100)}% on hand)` : 'none')} hint="Rides out supplier disruptions; costs 1.5 % of its value a month to hold." /></div>
      <p className="small muted">Without a contract you buy at average market terms. A contract trades a monthly commitment (take-or-pay below 90 %) and a term for a lower price at the supplier's quality and delivery reliability; a second source halves the exposure to one supplier's problems. Last month: output lost to shortages {Math.round((sup?.lastLoss ?? 0) * 100)}%, spot premiums {fmtMoney(sup?.lastSpot ?? 0)}, take-or-pay {fmtMoney(sup?.lastPenalty ?? 0)}.</p>
      <div className="tablewrap"><table>
        <thead><tr><th>Component</th><th>Source</th><th className="r">Price</th><th className="r">Quality</th><th className="r">Commitment / mo</th><th>Until</th><th>Status</th><th /></tr></thead>
        <tbody>{CATEGORIES.map((cat) => {
          const k = sup?.contracts[cat], ih = sup?.inHouse[cat];
          const a = k ? SUPPLIER_BY_ID[k.supplierId] : undefined, b = k?.secondId ? SUPPLIER_BY_ID[k.secondId] : undefined;
          const dis = [a, b].filter((x) => x && (sup?.disrupted[x.id] ?? 0) > 0);
          return (
            <tr key={cat}><td><b>{CATEGORY_NAME[cat]}</b></td>
              <td className="small">{ih ? `In-house (${fmtNum(ih.capacity)} / mo)${k ? ' + ' : ''}` : ''}{a ? `${a.name}${b ? ` + ${b.name} (${Math.round((k!.secondShare ?? 0.3) * 100)}%)` : ''}` : ih ? '' : <span className="muted">market</span>}</td>
              <td className="r">{ih ? pct(0.85) : k ? pct(k.priceIndex) : '—'}</td>
              <td className="r">{a ? Math.round(a.quality * 100) : ih ? 'own' : '70'}</td>
              <td className="r">{k ? fmtNum(k.commitment) : '—'}</td><td>{k ? k.until : '—'}</td>
              <td className="small">{dis.length ? <span className="bad">disrupted: {dis.map((x) => x!.name).join(', ')}</span> : k && monthly > 0 && monthly < k.commitment * 0.9 ? <span className="warn">below commitment</span> : <span className="muted">ok</span>}</td>
              <td className="r" style={{ whiteSpace: 'nowrap' }}><button className="btn sm" onClick={() => setEdit(cat)}>{k ? 'Change' : 'Contract'}</button>{k && <button className="btn sm ghost" onClick={() => act((gg) => endContract(gg, cat), 'Contract ended.')}>End</button>}</td></tr>);
        })}</tbody></table></div>
      {edit && <ContractForm cat={edit} onClose={() => setEdit(null)} />}
      <span className="tiny muted">Suppliers are fictional; their prices, quality, capacity and reliability are estimated game data.</span>
    </div>
  );
}

function ContractForm({ cat, onClose }: { cat: ComponentCategory; onClose: () => void }) {
  const { g, p } = useGame();
  const act = useStore((s) => s.act);
  const list = suppliersFor(cat, g.year);
  const [id, setId] = useState(list[0]?.id ?? '');
  const [second, setSecond] = useState('');
  const [share, setShare] = useState(0.3);
  const monthly = Math.max(100, Math.round(p.factories.reduce((a, f) => a + (f.lastOutput ?? f.capacity * 0.5), 0)));
  const [commit, setCommit] = useState(monthly);
  const [years, setYears] = useState(3);
  const [ihCap, setIhCap] = useState(monthly);
  const d = SUPPLIER_BY_ID[id];
  const price = d ? quote(p, d, commit * (second ? 1 - share : 1), years, g.year) * (second ? 1 - share : 1) + (second && SUPPLIER_BY_ID[second] ? quote(p, SUPPLIER_BY_ID[second], commit * share, years, g.year) * share : 0) : 1;
  const run = (gg: GameState) => signContract(gg, cat, id, commit, years, second || undefined, share);
  const canIn = cat in IN_HOUSE;
  return (
    <Modal onClose={onClose}>
      <h2>{CATEGORY_NAME[cat]}</h2>
      {list.length === 0 ? <p className="dim">No supplier offers this component yet.</p> : <>
        <div className="tablewrap"><table><thead><tr><th>Supplier</th><th>Region</th><th className="r">List price</th><th className="r">Quality</th><th className="r">Capacity / mo</th><th className="r">On-time</th></tr></thead>
          <tbody>{list.map((x) => <tr key={x.id} className={'click' + (x.id === id ? ' me' : '')} onClick={() => setId(x.id)}><td>{x.name}</td><td>{REGION_NAME[x.region]}</td><td className="r">{pct(x.price)}</td><td className="r">{Math.round(x.quality * 100)}</td><td className="r">{fmtNum(supplierCapacity(x, g.year))}</td><td className="r">{(x.reliability * 100).toFixed(1)}%</td></tr>)}</tbody></table></div>
        <Slider label="Monthly commitment (car sets)" value={commit} min={100} max={Math.max(200, Math.round(capacityRef(g.year) * 2))} step={100} onChange={setCommit} fmt={(v) => `${fmtNum(v)} — you built ${fmtNum(monthly)} last month`} hint="Bigger commitments earn bigger discounts; below 90 % of it you pay a penalty." />
        <Slider label="Term" value={years} min={1} max={5} onChange={setYears} fmt={(v) => `${v} year${v > 1 ? 's' : ''}`} />
        <Select label="Second source" value={second} onChange={setSecond} options={[{ value: '', label: 'None (single source)' }, ...list.filter((x) => x.id !== id).map((x) => ({ value: x.id, label: x.name }))]} />
        {second && <Slider label="Second source's share" value={share} min={0.1} max={0.5} step={0.05} onChange={setShare} fmt={(v) => `${Math.round(v * 100)}%`} />}
        <StatLine label="Contract price" value={<b>{pct(price)} vs market</b>} />
        <ImpactPreview deps={[id, second, share, commit, years]} horizon={12} run={run} />
        <div className="row end"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => { if (act(run, 'Contract signed.')) onClose(); }}>Sign contract</button></div>
      </>}
      {canIn && <div className="col" style={{ gap: 4, marginTop: 12 }}>
        <h4>Make it in-house</h4>
        <Slider label="Capacity (sets a month)" value={ihCap} min={100} max={Math.max(500, monthly * 3)} step={100} onChange={setIhCap} fmt={(v) => fmtNum(v)} />
        <StatLine label="Investment" value={fmtMoney(inHouseCost(cat, ihCap, g.year))} /><StatLine label="Effect" value="no supplier margin (−15 %), running costs ≈ 1.2 % of the investment a month" />
        <ImpactPreview deps={[cat, ihCap]} horizon={18} run={(gg) => buildInHouse(gg, cat, ihCap)} />
        <div className="row end"><button className="btn" onClick={() => { if (act((gg) => buildInHouse(gg, cat, ihCap), 'Component plant ordered.')) onClose(); }}>Build component plant</button></div>
      </div>}
    </Modal>
  );
}

/** Stage capacities, utilisation, bottleneck relief and inspection for one plant. */
export function FactoryStages({ f }: { f: Factory }) {
  const { g } = useGame();
  const act = useStore((s) => s.act);
  const st = stagesOf(f);
  const bn = bottleneck(f);
  const out = f.lastOutput ?? 0;
  const [stage, setStage] = useState<StageId>(bn ?? 'paint');
  const add = Math.max(50, Math.round(f.capacity * 0.25));
  return (
    <details className="small"><summary className="muted">Production stages{bn ? <span className="warn"> · bottleneck: {STAGE_NAME[bn].toLowerCase()}</span> : ''} · last month {fmtNum(out)} cars</summary>
      <div className="col" style={{ gap: 3, marginTop: 6 }}>
        {STAGES.map((k) => (
          <div key={k} className="row between"><span>{STAGE_NAME[k]}</span><span className={k === bn ? 'warn' : 'dim'}>{fmtNum(st[k])} / mo · {Math.round((out / Math.max(1, st[k])) * 100)}% used</span></div>
        ))}
        {f.stageWork ? <p className="tiny">Expanding the {STAGE_NAME[f.stageWork.stage].toLowerCase()} by {fmtNum(f.stageWork.add)}: {f.stageWork.monthsLeft} months left.</p> : <div className="row wrap" style={{ gap: 6 }}>
          <Select label="" value={stage} onChange={setStage} options={STAGES.map((k) => ({ value: k, label: STAGE_NAME[k] }))} />
          <button className="btn sm" onClick={() => act((gg) => expandStage(gg, f.id, stage, add), 'Stage expansion ordered.')}>Expand by {fmtNum(add)} ({fmtMoney(stageCost(f, stage, add, g.year))}, 6 months)</button>
        </div>}
        <Slider label="Quality inspection" value={inspectionOf(f)} min={0} max={1} step={0.05} onChange={(v) => act((gg) => setInspection(gg, f.id, v))} fmt={(v) => (v < 0.3 ? 'Minimal' : v < 0.7 ? 'Standard' : 'Thorough')} hint="Thorough inspection costs labour on every car and lets fewer defects reach customers." />
      </div>
    </details>
  );
}
