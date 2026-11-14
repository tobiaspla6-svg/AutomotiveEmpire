// Trims and facelift of one model.
import { useState } from 'react';
import type { GameState, TrimLevel, VehicleModel } from '../sim/types';
import { useGame, useStore } from '../store/game';
import { addTrim, removeTrim, setAnnualCap, setOrderPolicy, startFacelift, updateTrim } from '../sim/actions';
import { hasOrderBook, priceLevels } from '../sim/orders';
import { familyOf } from '../sim/families';
import { FACELIFT_AFTER, TRIM_ORDER, TRIM_PRESETS, faceliftCost, productionMix, trimContribution, trimsOf } from '../sim/trims';
import { REGION_IDS } from '../data/world';
import { useT, type MessageKey } from '../i18n';
import { useTerm } from '../i18n/terms';
import { money, num } from '../i18n/format';
import { Select, Slider, StatLine } from './common';
import { ImpactPreview } from './Impact';

function NumberCell({ value, onCommit, width = 90, step = 1, label }: { value: number; onCommit: (v: number) => void; width?: number; step?: number; label: string }) {
  const [text, setText] = useState<string | null>(null);
  const commit = () => { if (text === null) return; const v = Number(text); setText(null); if (Number.isFinite(v) && v !== value) onCommit(v); };
  return <input type="number" aria-label={label} style={{ width, textAlign: 'right' }} step={step} value={text ?? String(Math.round(value))} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setText(null); }} />;
}

export function TrimsPanel({ m }: { m: VehicleModel }) {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const term = useTerm();
  const fmtMoney = (v: number) => money(v, lang), fmtNum = (v: number) => num(v, lang);
  const act = useStore((s) => s.act);
  const [level, setLevel] = useState<TrimLevel>('entry');
  const trims = trimsOf(m);
  const fam = familyOf(p, m);
  const mix = productionMix(m);
  const totalDemand = trims.reduce((a, x) => a + x.lastDemand, 0);
  const fl = faceliftCost(m);
  const yearsOn = m.launchYear ? g.year - m.launchYear : 0;
  if (m.status === 'retired' || m.status === 'design') return null;
  return (
    <div className="panel col">
      <div className="row between wrap"><h3>{t('trim.title', { name: m.name })}</h3>
        <div className="row" style={{ gap: 6 }}>
          <Select label="" value={level} onChange={setLevel} options={TRIM_ORDER.map((l) => ({ value: l, label: `${term(TRIM_PRESETS[l].name)} — ${term(TRIM_PRESETS[l].blurb)}` }))} />
          <button className="btn sm" onClick={() => act((gg) => addTrim(gg, m.id, level), t('trim.added'))}>+ {t('trim.add')}</button>
        </div></div>
      {trims.length === 0 ? <p className="small muted">{t('trim.single')}</p> : <>
        <div className="tablewrap"><table>
          <thead><tr><th>{t('trim.c.trim')}</th><th>{t('veh.engine')}</th><th className="r">0–100</th><th className="r">{t('veh.col.cost')}</th><th className="r">{t('veh.col.price')}</th><th className="r">{t('trim.c.mix')}</th><th className="r">{t('trim.c.cap')}</th><th className="r">{t('trim.c.built')}</th><th className="r">{t('rp.c.demand')}</th><th className="r">{t('rp.c.sold')}</th><th className="r">{t('trim.c.contrib')}</th><th /></tr></thead>
          <tbody>{trims.map((tr) => {
            const sold = REGION_IDS.reduce((a, r) => a + tr.lastSales[r], 0);
            const contrib = trimContribution(tr);
            return (
              <tr key={tr.id}>
                <td><b>{tr.name}</b><div className="tiny muted">{t('trim.desc', { interior: t(`st.cabin.${tr.interior}` as MessageKey).toLowerCase(), dia: tr.wheelDia, tyre: t(`st.tyre.${tr.tireCompound}` as MessageKey).toLowerCase(), pct: Math.round(tr.equipment * 100) })}</div></td>
                <td className="small">{fam ? <select aria-label={t('trim.engineOf', { name: tr.name })} value={tr.engineVariantId ?? ''} onChange={(e) => act((gg) => updateTrim(gg, m.id, tr.id, { engineVariantId: e.target.value }))}>
                  {fam.variants.map((v) => <option key={v.id} value={v.id} disabled={v.status !== 'ready'}>{v.name}</option>)}</select> : '—'}<div className="tiny muted">{Math.round(tr.stats.powerKw)} kW</div></td>
                <td className="r">{tr.stats.zeroTo100.toFixed(1)} s</td>
                <td className="r">{fmtMoney(tr.lastUnitCost || tr.stats.partsCost)}</td>
                <td className="r"><NumberCell label={t('veh.priceOf', { name: tr.name })} value={tr.price} step={Math.max(50, Math.round(tr.price / 100))} onCommit={(v) => act((gg) => updateTrim(gg, m.id, tr.id, { price: v }))} /></td>
                <td className="r"><NumberCell label={t('trim.shareOf', { name: tr.name })} width={64} value={(mix.get(tr.id) ?? 0) * 100} onCommit={(v) => act((gg) => updateTrim(gg, m.id, tr.id, { mix: Math.max(0, v) / 100 }))} /></td>
                <td className="r">{tr.cap !== undefined ? <NumberCell label={t('trim.capOf', { name: tr.name })} width={70} value={tr.cap} onCommit={(v) => act((gg) => updateTrim(gg, m.id, tr.id, { cap: v }))} /> : '—'}</td>
                <td className="r">{fmtNum(tr.built)}</td><td className="r">{fmtNum(tr.lastDemand)}</td><td className="r">{fmtNum(sold)}</td>
                <td className="r"><span className={contrib < 0 ? 'bad' : ''}>{fmtMoney(contrib)}</span>{tr.revenue > 0 && <div className="tiny muted">{t('trim.ofNet', { pct: Math.round((contrib / tr.revenue) * 100) })}</div>}</td>
                <td className="r"><button className="btn sm ghost" onClick={() => act((gg) => removeTrim(gg, m.id, tr.id), t('trim.removed'))}>{t('fac.line.remove')}</button></td>
              </tr>);
          })}</tbody></table></div>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn sm" disabled={totalDemand <= 0} onClick={() => act((gg: GameState) => { for (const x of trimsOf(m)) { const e = updateTrim(gg, m.id, x.id, { mix: totalDemand > 0 ? x.lastDemand / totalDemand : x.mix }); if (e) return e; } return null; }, t('trim.matched'))}>{t('trim.match')}</button>
          <span className="tiny muted">{t('trim.mixNote')}</span>
        </div>
      </>}
      {m.status === 'production' && <OrderBook m={m} />}
      {m.status === 'production' && <div className="col" style={{ gap: 3 }}>
        <h4>{t('fl.title')}</h4>
        {m.facelift ? <p className="small">{t('fl.running', { left: m.facelift.monthsLeft, total: m.facelift.months, paid: fmtMoney(m.facelift.paid), cost: fmtMoney(m.facelift.cost) })}</p> : <>
          <StatLine label={t('fl.cost')} value={t('fl.costFmt', { cost: fmtMoney(fl.cost), n: fl.months })} title={t('fl.costHint')} />
          <StatLine label={t('fl.effect')} value={t('fl.effectText')} />
          <StatLine label={t('fl.onSale')} value={t('fl.years', { n: yearsOn }) + ((m.facelifts ?? 0) ? ` · ${t('fl.soFar', { n: m.facelifts ?? 0 })}` : '')} />
          {yearsOn >= FACELIFT_AFTER ? <>
            <ImpactPreview deps={[m.id, yearsOn]} horizon={12} run={(gg) => startFacelift(gg, m.id)} />
            <div className="row"><button className="btn sm" onClick={() => act((gg) => startFacelift(gg, m.id), t('fl.approved'))}>{t('fl.start')}</button></div>
          </> : <p className="tiny muted">{t('fl.after', { n: FACELIFT_AFTER })}</p>}
        </>}
      </div>}
    </div>
  );
}

/** Exclusivity cap, allocation, personalisation and the three price levels of a model and its limited editions. */
function OrderBook({ m }: { m: VehicleModel }) {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const fmtMoney = (v: number) => money(v, lang), fmtNum = (v: number) => num(v, lang);
  const act = useStore((s) => s.act);
  const limited = trimsOf(m).filter((x) => hasOrderBook(m, x));
  const show = hasOrderBook(m) || limited.length > 0 || m.segment === 'supercar' || m.segment === 'luxury' || p.prestige >= 70;
  if (!show) return null;
  const lv = priceLevels(g, p, m);
  const yearly = Math.round(m.lastDemand * 12);
  return (
    <div className="col" style={{ gap: 4 }}>
      <h4>{t('ob.title')} <span className="tiny muted">({t('veh.pricingNote')})</span></h4>
      <p className="tiny muted">{t('ob.intro')}</p>
      <div className="row wrap" style={{ gap: 12 }}>
        <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={m.annualCap !== undefined} onChange={(e) => act((gg) => setAnnualCap(gg, m.id, e.target.checked ? Math.max(1, Math.round(yearly * 0.8)) : null))} /> {t('ob.cap')}</label>
        {m.annualCap !== undefined && <label className="row small" style={{ gap: 6 }}>{t('ob.at')} <NumberCell label={t('ob.capLabel')} value={m.annualCap} onCommit={(v) => act((gg) => setAnnualCap(gg, m.id, v))} /> {t('ob.carsYear')} <span className="muted">({t('ob.want', { n: fmtNum(yearly) })})</span></label>}
        <Select label="" value={m.allocation ?? 'open'} onChange={(v) => act((gg) => setOrderPolicy(gg, m.id, null, { allocation: v }))} options={[{ value: 'open', label: t('ob.open') }, { value: 'loyal', label: t('ob.loyal') }]} />
      </div>
      <Slider label={t('ob.personal')} value={m.personal ?? 0} min={0} max={1} step={0.05} onChange={(v) => act((gg) => setOrderPolicy(gg, m.id, null, { personal: v }))} fmt={(v) => t('ob.personalFmt', { pct: Math.round(v * 100) })} hint={t('ob.personalHint')} />
      <div className="grid g2" style={{ gap: 4 }}>
        <StatLine label={t('ob.list')} value={fmtMoney(lv.list)} /><StatLine label={t('ob.willing')} value={fmtMoney(lv.willingness)} title={t('ob.willingHint')} />
        <StatLine label={t('ob.collector')} value={fmtMoney(lv.collector)} title={t('ob.collectorHint')} /><StatLine label={t('ob.waiting')} value={t('ob.waitingFmt', { n: fmtNum(m.orders ?? 0), m: lv.waitingMonths.toFixed(1) })} />
      </div>
      {limited.map((tr) => { const x = priceLevels(g, p, m, tr); return (
        <div key={tr.id} className="row between wrap small"><b>{tr.name}</b><span>{t('ob.limited', { cap: fmtNum(tr.cap ?? 0), built: fmtNum(tr.built), orders: fmtNum(tr.orders ?? 0), list: fmtMoney(x.list), will: fmtMoney(x.willingness), coll: fmtMoney(x.collector) })}</span>
          <Select label="" value={tr.allocation ?? 'open'} onChange={(v) => act((gg) => setOrderPolicy(gg, m.id, tr.id, { allocation: v }))} options={[{ value: 'open', label: t('ob.open') }, { value: 'loyal', label: t('ob.loyal') }]} /></div>); })}
      {lv.willingness > lv.list * 1.15 && <p className="tiny good">{t('ob.more', { pct: Math.round((lv.willingness / lv.list - 1) * 100) })}</p>}
    </div>
  );
}
