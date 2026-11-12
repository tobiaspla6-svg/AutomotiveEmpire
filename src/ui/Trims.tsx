// Trims and facelift of one model.
import { useState } from 'react';
import type { GameState, TrimLevel, VehicleModel } from '../sim/types';
import { useGame, useStore } from '../store/game';
import { addTrim, removeTrim, setAnnualCap, setOrderPolicy, startFacelift, updateTrim } from '../sim/actions';
import { hasOrderBook, priceLevels } from '../sim/orders';
import { familyOf } from '../sim/families';
import { FACELIFT_AFTER, TRIM_ORDER, TRIM_PRESETS, faceliftCost, productionMix, trimContribution, trimsOf } from '../sim/trims';
import { REGION_IDS } from '../data/world';
import { fmtMoney, fmtNum } from '../sim/util';
import { Select, Slider, StatLine } from './common';
import { ImpactPreview } from './Impact';

function NumberCell({ value, onCommit, width = 90, step = 1, label }: { value: number; onCommit: (v: number) => void; width?: number; step?: number; label: string }) {
  const [text, setText] = useState<string | null>(null);
  const commit = () => { if (text === null) return; const v = Number(text); setText(null); if (Number.isFinite(v) && v !== value) onCommit(v); };
  return <input type="number" aria-label={label} style={{ width, textAlign: 'right' }} step={step} value={text ?? String(Math.round(value))} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setText(null); }} />;
}

export function TrimsPanel({ m }: { m: VehicleModel }) {
  const { g, p } = useGame();
  const act = useStore((s) => s.act);
  const [level, setLevel] = useState<TrimLevel>('entry');
  const trims = trimsOf(m);
  const fam = familyOf(p, m);
  const mix = productionMix(m);
  const totalDemand = trims.reduce((a, t) => a + t.lastDemand, 0);
  const fl = faceliftCost(m);
  const yearsOn = m.launchYear ? g.year - m.launchYear : 0;
  if (m.status === 'retired' || m.status === 'design') return null;
  return (
    <div className="panel col">
      <div className="row between wrap"><h3>Versions of the {m.name}</h3>
        <div className="row" style={{ gap: 6 }}>
          <Select label="" value={level} onChange={setLevel} options={TRIM_ORDER.map((l) => ({ value: l, label: `${TRIM_PRESETS[l].name} — ${TRIM_PRESETS[l].blurb}` }))} />
          <button className="btn sm" onClick={() => act((gg) => addTrim(gg, m.id, level), 'Trim added at its recommended price.')}>+ Trim</button>
        </div></div>
      {trims.length === 0 ? <p className="small muted">Sold as a single version. Adding a trim keeps today's car as "Standard" and adds the new version next to it: each trim has its own engine variant, cabin, wheels, equipment, price and share of production, and buyers choose between them.</p> : <>
        <div className="tablewrap"><table>
          <thead><tr><th>Trim</th><th>Engine</th><th className="r">0–100</th><th className="r">Unit cost</th><th className="r">Price</th><th className="r">Production %</th><th className="r">Cap</th><th className="r">Built</th><th className="r">Demand / mo</th><th className="r">Sold / mo</th><th className="r">Contribution to date</th><th /></tr></thead>
          <tbody>{trims.map((t) => {
            const sold = REGION_IDS.reduce((a, r) => a + t.lastSales[r], 0);
            const contrib = trimContribution(t);
            return (
              <tr key={t.id}>
                <td><b>{t.name}</b><div className="tiny muted">{t.interior} cabin · {t.wheelDia}" · {t.tireCompound} tyres · equipment {Math.round(t.equipment * 100)}%</div></td>
                <td className="small">{fam ? <select aria-label={`Engine of ${t.name}`} value={t.engineVariantId ?? ''} onChange={(e) => act((gg) => updateTrim(gg, m.id, t.id, { engineVariantId: e.target.value }))}>
                  {fam.variants.map((v) => <option key={v.id} value={v.id} disabled={v.status !== 'ready'}>{v.name}</option>)}</select> : '—'}<div className="tiny muted">{Math.round(t.stats.powerKw)} kW</div></td>
                <td className="r">{t.stats.zeroTo100.toFixed(1)} s</td>
                <td className="r">{fmtMoney(t.lastUnitCost || t.stats.partsCost)}</td>
                <td className="r"><NumberCell label={`Price of ${t.name}`} value={t.price} step={Math.max(50, Math.round(t.price / 100))} onCommit={(v) => act((gg) => updateTrim(gg, m.id, t.id, { price: v }))} /></td>
                <td className="r"><NumberCell label={`Production share of ${t.name}`} width={64} value={(mix.get(t.id) ?? 0) * 100} onCommit={(v) => act((gg) => updateTrim(gg, m.id, t.id, { mix: Math.max(0, v) / 100 }))} /></td>
                <td className="r">{t.cap !== undefined ? <NumberCell label={`Cap of ${t.name}`} width={70} value={t.cap} onCommit={(v) => act((gg) => updateTrim(gg, m.id, t.id, { cap: v }))} /> : '—'}</td>
                <td className="r">{fmtNum(t.built)}</td><td className="r">{fmtNum(t.lastDemand)}</td><td className="r">{fmtNum(sold)}</td>
                <td className="r"><span className={contrib < 0 ? 'bad' : ''}>{fmtMoney(contrib)}</span>{t.revenue > 0 && <div className="tiny muted">{Math.round((contrib / t.revenue) * 100)}% of net sales</div>}</td>
                <td className="r"><button className="btn sm ghost" onClick={() => act((gg) => removeTrim(gg, m.id, t.id), 'Trim removed.')}>Remove</button></td>
              </tr>);
          })}</tbody></table></div>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn sm" disabled={totalDemand <= 0} onClick={() => act((gg: GameState) => { for (const t of trimsOf(m)) { const e = updateTrim(gg, m.id, t.id, { mix: totalDemand > 0 ? t.lastDemand / totalDemand : t.mix }); if (e) return e; } return null; }, 'Production mix set to last month’s demand.')}>Match production mix to demand</button>
          <span className="tiny muted">Production % is the share of this car's output each trim gets; a limited edition stops at its cap. Contribution = net sales − cost of the cars sold.</span>
        </div>
      </>}
      {m.status === 'production' && <OrderBook m={m} />}
      {m.status === 'production' && <div className="col" style={{ gap: 3 }}>
        <h4>Facelift</h4>
        {m.facelift ? <p className="small">Under way: {m.facelift.monthsLeft} of {m.facelift.months} months left · {fmtMoney(m.facelift.paid)} of {fmtMoney(m.facelift.cost)} spent.</p> : <>
          <StatLine label="Cost and time" value={`${fmtMoney(fl.cost)} over ${fl.months} months`} title="About a quarter of the car's own engineering budget." />
          <StatLine label="Effect" value="fresh styling, more equipment, current electronics; buyers see a new car again" />
          <StatLine label="On sale for" value={`${yearsOn} year${yearsOn === 1 ? '' : 's'}${(m.facelifts ?? 0) ? ` · ${m.facelifts} facelift(s) so far` : ''}`} />
          {yearsOn >= FACELIFT_AFTER ? <>
            <ImpactPreview deps={[m.id, yearsOn]} horizon={12} run={(gg) => startFacelift(gg, m.id)} />
            <div className="row"><button className="btn sm" onClick={() => act((gg) => startFacelift(gg, m.id), 'Facelift approved.')}>Start facelift</button></div>
          </> : <p className="tiny muted">A facelift makes sense after {FACELIFT_AFTER} years on sale.</p>}
        </>}
      </div>}
    </div>
  );
}

/** Exclusivity cap, allocation, personalisation and the three price levels of a model and its limited editions. */
function OrderBook({ m }: { m: VehicleModel }) {
  const { g, p } = useGame();
  const act = useStore((s) => s.act);
  const limited = trimsOf(m).filter((t) => hasOrderBook(m, t));
  const show = hasOrderBook(m) || limited.length > 0 || m.segment === 'supercar' || m.segment === 'luxury' || p.prestige >= 70;
  if (!show) return null;
  const lv = priceLevels(g, p, m);
  const yearly = Math.round(m.lastDemand * 12);
  return (
    <div className="col" style={{ gap: 4 }}>
      <h4>Exclusivity and order book <span className="tiny muted">(estimates)</span></h4>
      <p className="tiny muted">Build fewer cars than buyers want and the rest wait: a queue keeps prices firm and the badge desirable, but some buyers give up. Limited editions keep their own order book.</p>
      <div className="row wrap" style={{ gap: 12 }}>
        <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={m.annualCap !== undefined} onChange={(e) => act((gg) => setAnnualCap(gg, m.id, e.target.checked ? Math.max(1, Math.round(yearly * 0.8)) : null))} /> Cap yearly production</label>
        {m.annualCap !== undefined && <label className="row small" style={{ gap: 6 }}>at <NumberCell label="Annual production cap" value={m.annualCap} onCommit={(v) => act((gg) => setAnnualCap(gg, m.id, v))} /> cars a year <span className="muted">(buyers want ≈ {fmtNum(yearly)})</span></label>}
        <Select label="" value={m.allocation ?? 'open'} onChange={(v) => act((gg) => setOrderPolicy(gg, m.id, null, { allocation: v }))} options={[{ value: 'open', label: 'First come, first served' }, { value: 'loyal', label: 'Allocate to loyal customers' }]} />
      </div>
      <Slider label="Personalisation programme (take-up)" value={m.personal ?? 0} min={0} max={1} step={0.05} onChange={(v) => act((gg) => setOrderPolicy(gg, m.id, null, { personal: v }))} fmt={(v) => `${Math.round(v * 100)}% of buyers`} hint="Bespoke paint, trim and details: buyers of a desirable badge pay up to a quarter more; each personalised car costs 8 % of its price to make." />
      <div className="grid g2" style={{ gap: 4 }}>
        <StatLine label="List price" value={fmtMoney(lv.list)} /><StatLine label="Buyers' willingness to pay" value={fmtMoney(lv.willingness)} title="What buyers would pay given how many cars exist (value price with its scarcity premium)." />
        <StatLine label="Collector value" value={fmtMoney(lv.collector)} title="Secondary market: willingness to pay plus a premium for the queue that cannot be served; limited runs appreciate once sold out." /><StatLine label="Waiting list" value={`${fmtNum(m.orders ?? 0)} buyers · ${lv.waitingMonths.toFixed(1)} months`} />
      </div>
      {limited.map((t) => { const x = priceLevels(g, p, m, t); return (
        <div key={t.id} className="row between wrap small"><b>{t.name}</b><span>run {fmtNum(t.cap ?? 0)} · built {fmtNum(t.built)} · waiting {fmtNum(t.orders ?? 0)} · list {fmtMoney(x.list)} · willingness {fmtMoney(x.willingness)} · collector {fmtMoney(x.collector)}</span>
          <Select label="" value={t.allocation ?? 'open'} onChange={(v) => act((gg) => setOrderPolicy(gg, m.id, t.id, { allocation: v }))} options={[{ value: 'open', label: 'First come' }, { value: 'loyal', label: 'Loyal customers' }]} /></div>); })}
      {lv.willingness > lv.list * 1.15 && <p className="tiny good">Buyers would pay {Math.round((lv.willingness / lv.list - 1) * 100)}% more than the list price.</p>}
    </div>
  );
}
