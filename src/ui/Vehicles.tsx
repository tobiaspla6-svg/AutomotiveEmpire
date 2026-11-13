// The vehicle range (Phase 4C): the selected model on the 3D stage with its engineering and pricing summary, then
// the whole range as a comparison table. Designing or redesigning a car opens the engineering studio (Studio.tsx).
import { useMemo, useState } from 'react';
import type { VehicleModel, VehicleSpec } from '../sim/types';
import { useGame, useStore } from '../store/game';
import { useT, type MessageKey } from '../i18n';
import { useTerm } from '../i18n/terms';
import { money, num } from '../i18n/format';
import { BODY, LAYOUT_NAME, SCORE_KEYS, defaultVehicle } from '../sim/engineering';
import { SEG, REGION_IDS } from '../data/world';
import { cancelDevelopment, retireModel, setPrice } from '../sim/actions';
import { devEngineersNeeded, estimateUnitCost } from '../sim/company';
import { annualSupply, computeMarket } from '../sim/market';
import { DEALER_NET, TYPICAL_VOLUME, contributionAt, demandCurve, priceGuide } from '../sim/pricing';
import { familyOf, familyUsers, platformOf, platformUsers } from '../sim/families';
import { trimsOf } from '../sim/trims';
import { renderDescriptor } from '../sim/render';
import { EngineeringPanel } from './Engineering';
import { TrimsPanel } from './Trims';
import { RegionalPricing } from './Regional';
import { PageHead, ScoreBar, StatLine, Tag } from './common';
import { Icon } from './ds/icons';
import { EmptyState, Panel } from './ds/primitives';
import { PriceLadder, SpecTile, Studio } from './Studio';
import { VehicleStage } from './VehicleStage';

const k = (s: string) => s as MessageKey;

export function VehiclesView() {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const term = useTerm();
  const act = useStore((s) => s.act), ask = useStore((s) => s.ask);
  const [editing, setEditing] = useState<{ spec: VehicleSpec; basedOn?: string; name: string } | null>(null);
  const [inspect, setInspect] = useState<string | null>(null);
  if (editing) return <Studio init={editing.spec} basedOn={editing.basedOn} initName={editing.name} onClose={() => setEditing(null)} />;
  const models = p.models.filter((m) => m.status !== 'retired');
  const shown = models.find((m) => m.id === inspect) ?? models[0];
  const open = () => setEditing({ spec: { ...defaultVehicle(g.year), color: p.color }, name: '' });
  return (
    <>
      <PageHead title={t('veh.title')} right={<button className="btn primary" data-action="new-vehicle" onClick={open}><Icon name="wrench" size={16} />{t('veh.new')}</button>}>{t('veh.sub')}</PageHead>
      {models.length === 0 && <div className="panel"><EmptyState icon="vehicle" title={t('veh.none.title')}>{t('veh.none.body', { engineers: p.engineers, tech: Math.round((p.tech.engine + p.tech.chassis) / 2) })}</EmptyState></div>}
      {shown && (
        <div className="range-hero">
          <ModelStage m={shown} />
          <ModelCard m={shown} />
        </div>
      )}
      {models.length > 0 && (
        <Panel eyebrow={t('veh.range')} title={t('veh.range.sub')} pad={false} className="range-table">
          <div className="tablewrap" style={{ maxHeight: 460 }}><table>
            <thead><tr><th>{t('veh.col.model')}</th><th>{t('veh.col.status')}</th><th>{t('veh.col.segment')}</th><th className="r">{t('veh.col.power')}</th><th className="r">0–100</th><th className="r">{t('veh.col.cost')}</th><th className="r">{t('veh.col.price')}</th><th className="r">{t('veh.col.sold')}</th><th className="r">{t('veh.col.demand')}</th><th className="r">{t('veh.col.stock')}</th><th /></tr></thead>
            <tbody>{models.map((m) => {
              const sold = REGION_IDS.reduce((a, r) => a + m.lastSales[r], 0);
              const cost = m.lastUnitCost || estimateUnitCost(g, p, m);
              return (
                <tr key={m.id} data-model={m.id} className={'click' + (shown?.id === m.id ? ' me' : '')} onClick={() => setInspect(m.id)}>
                  <td><b>{m.name}</b>{m.historical && <> <Tag kind="h" title={t('veh.histHint')}>{t('veh.hist')}</Tag></>}<div className="tiny muted">{t('veh.gen', { n: m.generation, year: m.designYear })}{m.launchYear ? ` · ${t('veh.onSale', { year: m.launchYear })}` : ''}</div></td>
                  <td>{m.status === 'development' ? <span className="warn">{t('veh.devLeft', { n: Math.ceil(m.devMonthsLeft) })}</span> : m.status === 'ready' ? <span className="accent">{t('veh.status.ready')}</span> : t(k(`veh.status.${m.status}`))}</td>
                  <td>{term(SEG[m.segment].name)}</td>
                  <td className="r">{Math.round(m.stats.powerKw)} kW</td><td className="r">{m.stats.zeroTo100.toFixed(1)} s</td>
                  <td className="r">{money(cost, lang)}</td>
                  <td className="r" onClick={(e) => e.stopPropagation()}>{m.status === 'development' ? '—' : <PriceInput price={m.price} label={t('veh.priceOf', { name: m.name })} onCommit={(v) => act((gg) => setPrice(gg, m.id, v))} />}</td>
                  <td className="r">{num(sold, lang)}</td><td className="r">{num(m.lastDemand, lang)}</td><td className="r">{num(m.inventory, lang)}</td>
                  <td className="r" onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                    {m.status === 'development' ? <button className="btn sm danger" onClick={() => ask(t('veh.confirmCancel', { name: m.name, spent: money(m.devCostPaid, lang) }), () => { act((gg) => cancelDevelopment(gg, m.id), t('veh.cancelled')); })}>{t('veh.cancel')}</button> : <>
                      <button className="btn sm" onClick={() => setEditing({ spec: JSON.parse(JSON.stringify(m.spec)), basedOn: m.id, name: nextName(m.name) })}>{t('veh.newGen')}</button>{' '}
                      <button className="btn sm ghost" onClick={() => ask(t('veh.confirmRetire', { name: m.name }), () => { act((gg) => retireModel(gg, m.id)); })}>{t('veh.retire')}</button></>}
                  </td>
                </tr>);
            })}</tbody>
          </table></div>
        </Panel>
      )}
      {shown && <TrimsPanel m={shown} />}
      {shown && <RegionalPricing m={shown} />}
      <EngineeringPanel />
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

/** The selected model in the studio viewer, with a choice of version when it has trims. */
function ModelStage({ m }: { m: VehicleModel }) {
  const { g, p } = useGame();
  const { t } = useT();
  const term = useTerm();
  const [trimId, setTrimId] = useState<string>('');
  const trims = trimsOf(m);
  const trim = trims.find((x) => x.id === trimId);
  const spec = trim?.spec ?? m.spec;
  return (
    <VehicleStage desc={renderDescriptor(p, m, trim)} spec={spec} year={g.year} height="clamp(320px, 44vh, 500px)"
      title={<><b>{m.name}</b>{trim ? ` ${trim.name}` : ''} · {term(BODY[spec.body].name)} · {term(SEG[m.segment].name)}</>}
      extra={trims.length > 0 && <div className="row" style={{ gap: 6, marginTop: 4 }}><span className="tiny muted">{t('veh.showVersion')}</span>
        <select aria-label={t('veh.versionAria')} value={trimId} onChange={(e) => setTrimId(e.target.value)}>
          <option value="">{t('veh.baseSpec')}</option>
          {trims.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select></div>} />
  );
}

function ModelCard({ m }: { m: VehicleModel }) {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const term = useTerm();
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
  const m$ = (v: number) => money(v, lang);
  const f = familyOf(p, m), pl = platformOf(p, m), v = f?.variants.find((x) => x.id === m.engineVariantId);
  const cars = (n: number) => t(n === 1 ? 'st.cars.one' : 'st.cars.other', { n });
  return (
    <div className="panel col range-card" style={{ gap: 12 }}>
      <div className="row between"><div className="col" style={{ gap: 0 }}><span className="eyebrow">{term(SEG[m.segment].name)}</span><h3>{m.name}</h3></div><span className={'status-chip ' + m.status}>{t(k(`veh.status.${m.status}`))}</span></div>
      <div className="spec-tiles four">
        <SpecTile label={t('st.power')} value={Math.round(s.powerKw)} unit="kW" />
        <SpecTile label="0–100" value={s.zeroTo100.toFixed(1)} unit="s" />
        <SpecTile label={t('st.topSpeed')} value={Math.round(s.topSpeed)} unit="km/h" />
        <SpecTile label={t('st.kerbMass')} value={Math.round(s.mass)} unit="kg" />
      </div>
      <div className="col" style={{ gap: 2 }}>
        <StatLine label={t('veh.engine')} value={m.spec.engine.layout === 'EV' ? t('veh.electric', { kwh: m.spec.engine.batteryKwh }) : `${term(LAYOUT_NAME[m.spec.engine.layout])} ${(m.spec.engine.displacement / 1000).toFixed(1)} L · ${Math.round(s.torqueNm)} Nm`} />
        <StatLine label={t('st.arch.family')} value={f ? `${f.name}${v ? ` · ${v.name}` : ''} (${cars(familyUsers(p, f.id).length)})` : '—'} title={t('st.arch.familyHint')} />
        <StatLine label={t('veh.platform')} value={pl ? `${pl.name} (${cars(platformUsers(p, pl.id).length)})` : '—'} />
        <StatLine label={s.engine.isEV ? t('st.consumption') : t('veh.fuelCombined')} value={s.engine.isEV ? `${s.fuelCombined.toFixed(1)} kWh/100 km` : `${s.fuelCombined.toFixed(1)} L/100 km`} />
        <StatLine label={t('veh.contribution')} value={m.price > 0 ? <span className={margin < 0 ? 'bad' : 'good'}>{m$(margin)} · {Math.round((margin / (m.price * DEALER_NET)) * 100)}%</span> : '—'} />
      </div>
      {onSale && <div className="col" style={{ gap: 6 }}>
        <h4>{t('veh.pricingAt', { n: num(vol, lang) })} <span className="muted tiny">({t('veh.pricingNote')})</span></h4>
        <PriceLadder cost={guide.unitCost} breakEven={guide.breakEven} recommended={guide.recommended} worth={guide.value} mark={m.price > 0 ? { v: m.price, label: t('veh.yourPrice') } : undefined} fmt={m$}
          labels={{ cost: t('st.market.unitCost'), breakEven: t('st.market.breakEven'), recommended: t('st.market.recommended'), worth: t('st.market.worth') }}
          hints={{ cost: t('st.market.unitCostHint'), breakEven: t('st.market.breakEvenHint'), recommended: t('st.market.recommendedHint'), worth: t('st.market.worthHint') }} />
        <div className="grid g2" style={{ gap: '2px 16px' }}>
          <StatLine label={t('veh.salesAtYours')} value={t('veh.perMo', { v: num(now.d, lang) })} /><StatLine label={t('veh.salesAtRec')} value={t('veh.perMo', { v: num(rec.d, lang) })} />
          <StatLine label={t('veh.contribAtYours')} value={<span className={now.profit < 0 ? 'bad' : ''}>{t('veh.perMo', { v: m$(now.profit) })}</span>} /><StatLine label={t('veh.contribAtRec')} value={t('veh.perMo', { v: m$(rec.profit) })} />
        </div>
        {m.price <= 0 && <p className="tiny muted">{t('veh.notPriced')}</p>}
        {m.price > 0 && m.price < guide.breakEven && <div className="warnbox">{t('veh.belowBreakEven', { price: m$(m.price) })}</div>}
        {m.price > guide.value * 1.35 && <div className="warnbox">{t('veh.overWorth', { pct: Math.round((m.price / guide.value - 1) * 100) })}</div>}
        {m.price > 0 && Math.abs(m.price / guide.recommended - 1) > 0.03 && <div className="row"><button className="btn sm" onClick={() => act((gg) => setPrice(gg, m.id, Math.round(guide.recommended / 10) * 10), t('veh.priceSet'))}>{t('veh.useRecommended')}</button></div>}
      </div>}
      <div className="col" style={{ gap: 4 }}>{SCORE_KEYS.map((key) => <ScoreBar key={key} label={t(k(`score.${key}`))} value={s.scores[key]} color={(SEG[m.segment].weights[key] ?? 0) >= 0.15 ? 'var(--accent)' : 'var(--s1)'} />)}</div>
      <p className="tiny muted">{t('veh.scoresNote', { year: g.year, segment: term(SEG[m.segment].name).toLowerCase() })}</p>
      {m.status === 'development' && <p className="small warn">{t('veh.devProgress', { left: Math.ceil(m.devMonthsLeft), total: m.devMonthsTotal, paid: m$(m.devCostPaid), budget: m$(m.devCostTotal), eng: Math.round(devEngineersNeeded(g, p, m)) })}</p>}
    </div>
  );
}
