// Factory management (Phase 4C): the industrial network at a glance, a production flow diagram per plant with its
// bottleneck, the supply chain as cards, and the economics of building each car. Every control of the previous
// screen is still here (lines, targets, expansion, automation, stage expansion, inspection, contracts, in-house
// component plants, safety stock); the figures come from the same simulation functions.
import { useState } from 'react';
import type { ComponentCategory, Factory, GameState, StageId } from '../sim/types';
import { useGame, useStore } from '../store/game';
import { useT, type MessageKey } from '../i18n';
import { useTerm } from '../i18n/terms';
import { money, num, pct } from '../i18n/format';
import { COUNTRIES, COUNTRY, REGION_IDS, REGION_NAME } from '../data/world';
import { CATEGORIES, CATEGORY_NAME, IN_HOUSE, SUPPLIER_BY_ID, suppliersFor } from '../data/suppliers';
import { estimateUnitCost, factoryBuildCost, factoryFixedCost, lineShareUsed, toolingCost } from '../sim/company';
import {
  addLine, automationCost, buildFactory, buildInHouse, endContract, expandFactory, expandStage, maxAutomation, removeLine, sellFactory, setInspection,
  setLineTarget, setSafetyStock, signContract, stageCost, upgradeAutomation,
} from '../sim/actions';
import { bottleneck, capacityRef, effectiveCapacity, inHouseCost, inspectionOf, quote, STAGES, stagesOf, supplierCapacity } from '../sim/supply';
import { DEALER_NET } from '../sim/pricing';
import { Modal, PageHead, PALETTE, Select, Slider, StatLine } from './common';
import { Icon, type IconName } from './ds/icons';
import { EmptyState, HBar, KpiTile, Panel, RingGauge } from './ds/primitives';
import { ImpactPreview } from './Impact';

const k = (s: string) => s as MessageKey;
const rel = (x: number) => `${x >= 1 ? '+' : '−'}${Math.abs((x - 1) * 100).toFixed(1)}%`;
const STAGE_ICON: Record<StageId, IconName> = { body: 'box', paint: 'layers', powertrain: 'bolt', assembly: 'wrench', inspection: 'check' };

export function FactoriesView() {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const term = useTerm();
  const [build, setBuild] = useState(false);
  const m$ = (v: number) => money(v, lang);
  const n = (v: number) => num(v, lang);

  // ---- the network in numbers
  const cap = p.factories.reduce((a, f) => a + f.capacity, 0);
  const eff = p.factories.reduce((a, f) => a + effectiveCapacity(f), 0);
  const out = p.factories.reduce((a, f) => a + (f.lastOutput ?? 0), 0);
  const fixed = p.factories.reduce((a, f) => a + factoryFixedCost(f, g.year), 0);
  const selling = p.models.filter((m) => m.status === 'production' || m.status === 'ready');
  const stock = selling.reduce((a, m) => a + m.inventory, 0);
  const sold = selling.reduce((a, m) => a + REGION_IDS.reduce((b, r) => b + m.lastSales[r], 0), 0);
  const util = eff > 0 ? out / eff : 0;
  const limited = p.factories.filter((f) => bottleneck(f)).length;
  const loss = p.supply?.lastLoss ?? 0;

  // ---- where the cars are built against where they are sold
  const regions = REGION_IDS.map((r) => ({
    r, cap: p.factories.filter((f) => f.region === r).reduce((a, f) => a + effectiveCapacity(f), 0),
    sales: selling.reduce((a, m) => a + m.lastSales[r], 0), plants: p.factories.filter((f) => f.region === r),
  })).filter((x) => x.cap > 0 || x.sales > 0);
  const regionMax = Math.max(1, ...regions.map((x) => Math.max(x.cap, x.sales)));

  // ---- work in progress across the network
  const projects: { icon: IconName; text: string; months: number }[] = [];
  for (const f of p.factories) {
    if (f.capacity <= 0 && f.expansion) projects.push({ icon: 'factory', text: t('fac.proj.build', { name: f.name, n: n(f.expansion.add) }), months: f.expansion.monthsLeft });
    else if (f.expansion) projects.push({ icon: 'up', text: t('fac.proj.expand', { name: f.name, n: n(f.expansion.add) }), months: f.expansion.monthsLeft });
    if (f.stageWork) projects.push({ icon: STAGE_ICON[f.stageWork.stage], text: t('fac.proj.stage', { name: f.name, stage: t(k(`stage.${f.stageWork.stage}`)).toLowerCase(), n: n(f.stageWork.add) }), months: f.stageWork.monthsLeft });
  }

  // ---- what each car costs to build against what it brings in
  const econ = selling.filter((m) => m.status === 'production').map((m) => {
    const cost = m.lastUnitCost || estimateUnitCost(g, p, m), net = m.price * DEALER_NET;
    const units = REGION_IDS.reduce((a, r) => a + m.lastSales[r], 0);
    return { m, cost, net, units, margin: net > 0 ? (net - cost) / net : 0 };
  }).sort((a, b) => b.units - a.units).slice(0, 8);
  const econMax = Math.max(1, ...econ.map((x) => Math.max(x.cost, x.net)));
  const stocks = selling.map((m) => ({ m, units: REGION_IDS.reduce((a, r) => a + m.lastSales[r], 0) })).filter((x) => x.m.inventory >= 1).sort((a, b) => b.m.inventory - a.m.inventory).slice(0, 8);
  const stockMax = Math.max(1, ...stocks.map((x) => x.m.inventory));

  return (
    <div className="fac">
      <PageHead title={t('fac.title')} right={<button className="btn primary" data-action="build-factory" onClick={() => setBuild(true)}><Icon name="factory" size={16} />{t('fac.build')}</button>}>{t('fac.sub')}</PageHead>

      {p.factories.length === 0 ? <div className="panel"><EmptyState icon="factory" title={t('fac.none.title')}>{t('fac.none.body')}</EmptyState></div> : <>
        <div className="kpi-band">
          <KpiTile icon="factory" label={t('fac.kpi.capacity')} value={n(eff)} sub={eff < cap - 1 ? t('fac.kpi.capacity.limited', { n: n(cap) }) : t('fac.kpi.capacity.sub', { n: p.factories.length })} title={t('fac.kpi.capacity.hint')} />
          <KpiTile icon="vehicle" label={t('fac.kpi.output')} value={n(out)} sub={t('fac.kpi.output.sub', { n: n(sold) })} />
          <KpiTile icon="gauge" label={t('fac.kpi.util')} value={pct(util, lang)} tone={util > 0.97 ? 'warn' : util < 0.55 && eff > 0 ? 'warn' : 'good'} sub={util > 0.97 ? t('fac.kpi.util.full') : util < 0.55 ? t('fac.kpi.util.idle') : t('fac.kpi.util.ok')} />
          <KpiTile icon="alert" label={t('fac.kpi.bottlenecks')} value={String(limited)} tone={limited ? 'warn' : 'good'} sub={limited ? t('fac.kpi.bottlenecks.some') : t('fac.kpi.bottlenecks.none')} />
          <KpiTile icon="cash" label={t('fac.kpi.fixed')} value={m$(fixed)} sub={out > 0 ? t('fac.kpi.fixed.sub', { v: m$(fixed / out) }) : t('fac.kpi.fixed.idle')} title={t('fac.kpi.fixed.hint')} />
          <KpiTile icon="box" label={t('fac.kpi.stock')} value={n(stock)} tone={sold > 0 && stock > sold * 3 ? 'warn' : 'neutral'} sub={sold > 0 ? t('fac.kpi.stock.sub', { m: (stock / sold).toFixed(1) }) : t('fac.kpi.stock.none')} />
        </div>

        <div className="fac-top">
          <Panel eyebrow={t('fac.loc')} title={t('fac.loc.title')}>
            <div className="col" style={{ gap: 9 }}>
              {regions.map((x) => (
                <div key={x.r} className="loc-row">
                  <HBar label={term(REGION_NAME[x.r])} value={x.cap} max={regionMax} marker={x.sales} color={x.cap >= x.sales ? 'var(--s1)' : 'var(--s2)'} right={`${n(x.cap)} / ${n(x.sales)}`} title={t('fac.loc.rowHint', { cap: n(x.cap), sales: n(x.sales) })} />
                  <span className="tiny muted loc-plants">{x.plants.length ? x.plants.map((f) => f.name).join(' · ') : t('fac.loc.imports')}</span>
                </div>
              ))}
            </div>
            <p className="tiny muted" style={{ marginTop: 10 }}><i className="swatch" style={{ background: 'var(--s1)' }} /> {t('fac.loc.legendCap')} · <i className="swatch tick" /> {t('fac.loc.legendSales')}. {t('fac.loc.note')}</p>
          </Panel>
          <Panel eyebrow={t('fac.proj')} title={t('fac.proj.title')}>
            {projects.length === 0 ? <p className="dim small">{t('fac.proj.none')}</p> : (
              <ul className="proj-list">{projects.map((x, i) => <li key={i}><Icon name={x.icon} size={16} /><span>{x.text}</span><b className="num">{t('fac.monthsLeft', { n: x.months })}</b></li>)}</ul>
            )}
            {loss > 0.005 && <div className="warnbox" style={{ marginTop: 8 }}>{t('fac.supplyLoss', { pct: Math.round(loss * 100) })}</div>}
          </Panel>
        </div>

        {p.factories.map((f, i) => <PlantCard key={f.id} f={f} defaultOpen={p.factories.length <= 2 || i === 0 || !!bottleneck(f) || f.disruption > 0 || f.capacity <= 0 || lineShareUsed(f) < 0.98} />)}

        <div className="fac-top">
          <Panel eyebrow={t('fac.econ')} title={t('fac.econ.title')}>
            {econ.length === 0 ? <p className="dim small">{t('fac.econ.none')}</p> : <>
              <div className="col" style={{ gap: 8 }}>
                {econ.map((x) => <HBar key={x.m.id} label={x.m.name} value={x.cost} max={econMax} marker={x.net} color={x.net >= x.cost ? 'var(--s4)' : 'var(--bad)'} right={<span className={x.margin < 0 ? 'bad' : 'good'}>{m$(x.cost)} · {Math.round(x.margin * 100)}%</span>} title={t('fac.econ.rowHint', { cost: m$(x.cost), net: m$(x.net), units: n(x.units) })} />)}
              </div>
              <p className="tiny muted" style={{ marginTop: 10 }}><i className="swatch" style={{ background: 'var(--s4)' }} /> {t('fac.econ.legendCost')} · <i className="swatch tick" /> {t('fac.econ.legendNet')}. {t('fac.econ.note')}</p>
            </>}
          </Panel>
          <Panel eyebrow={t('fac.inv')} title={t('fac.inv.title')}>
            {stocks.length === 0 ? <p className="dim small">{t('fac.inv.none')}</p> : (
              <div className="col" style={{ gap: 8 }}>
                {stocks.map((x) => { const months = x.units > 0 ? x.m.inventory / x.units : x.m.inventory > 0 ? 99 : 0; return (
                  <HBar key={x.m.id} label={x.m.name} value={x.m.inventory} max={stockMax} color={months > 3 ? 'var(--warn)' : 'var(--s3)'} right={<span className={months > 3 ? 'warn' : ''}>{n(x.m.inventory)} · {months >= 99 ? t('fac.inv.noSales') : t('fac.inv.months', { m: months.toFixed(1) })}</span>} />); })}
              </div>
            )}
            <p className="tiny muted" style={{ marginTop: 10 }}>{t('fac.inv.note')}</p>
          </Panel>
        </div>

        <SupplyPanel />
      </>}

      {build && <BuildFactory onClose={() => setBuild(false)} />}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ one plant
function PlantCard({ f, defaultOpen }: { f: Factory; defaultOpen: boolean }) {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const term = useTerm();
  const act = useStore((s) => s.act), ask = useStore((s) => s.ask);
  const m$ = (v: number) => money(v, lang);
  const n = (v: number) => num(v, lang);
  const [line, setLine] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  const used = lineShareUsed(f);
  const mAuto = maxAutomation(p);
  const buildable = p.models.filter((m) => m.status === 'ready' || m.status === 'production');
  const eff = effectiveCapacity(f), out = f.lastOutput ?? 0;
  const nextAuto = Math.min(mAuto, f.automation + 0.15);
  const expandCost = factoryBuildCost(f.capacity * 0.5, f.automation, g.year) * 0.85;
  const sell = () => ask(t('fac.confirmSell', { name: f.name, lines: f.lines.length }), () => { act((gg) => sellFactory(gg, f.id)); });
  const expand = () => { const go = () => { act((gg) => expandFactory(gg, f.id, Math.round(f.capacity * 0.5)), t('fac.expanded')); }; if (expandCost > p.cash * 0.5) ask(t('fac.confirmExpand', { name: f.name, cost: m$(expandCost), cash: m$(p.cash) }), go); else go(); };
  return (
    <section className="panel plant" data-plant={f.id}>
      <header className="plant-head">
        <div className="plant-id">
          <h3>{f.name}</h3>
          <span className="small muted">{term(COUNTRY[f.country].name)} · {term(REGION_NAME[f.region])} · {t('fac.since', { year: f.builtYear })}</span>
          <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
            {f.capacity <= 0 && <span className="status-chip development">{t('fac.underConstruction', { n: f.expansion?.monthsLeft ?? 0 })}</span>}
            {f.disruption > 0 && <span className="status-chip bad">{t('fac.disrupted', { n: f.disruption })}</span>}
            {f.capacity > 0 && f.expansion && <span className="status-chip ready">{t('fac.expanding', { n: n(f.expansion.add), m: f.expansion.monthsLeft })}</span>}
          </div>
        </div>
        <div className="row wrap plant-actions">
          {f.capacity > 0 && <button className="btn sm primary" data-action="add-line" disabled={!buildable.length || used > 0.999} title={!buildable.length ? t('fac.line.noModels') : undefined} onClick={() => setLine(true)}><Icon name="vehicle" size={14} />{t('fac.line.add')}</button>}
          {f.capacity > 0 && !f.expansion && <button className="btn sm" onClick={expand} title={t('fac.expand.hint')}>{t('fac.expand', { cost: m$(expandCost) })}</button>}
          {f.capacity > 0 && f.automation < mAuto - 0.01 && <button className="btn sm" onClick={() => act((gg) => upgradeAutomation(gg, f.id, nextAuto), t('fac.automated'))} title={t('fac.automate.hint')}>{t('fac.automate', { cost: m$(automationCost(f.capacity, f.automation, nextAuto, g.year)) })}</button>}
          <button className="btn sm danger" onClick={sell}>{t('fac.sell')}</button>
          {f.capacity > 0 && <button className="iconbtn" aria-expanded={open} aria-label={open ? t('fac.collapse') : t('fac.expandCard')} title={open ? t('fac.collapse') : t('fac.expandCard')} onClick={() => setOpen(!open)}><Icon name={open ? 'up' : 'down'} size={16} /></button>}
        </div>
      </header>

      {f.capacity > 0 && !open && (
        <button type="button" className="plant-summary" onClick={() => setOpen(true)} aria-label={t('fac.expandCard')}>
          <span className="ps-util"><b className="display">{pct(eff > 0 ? out / eff : 0, lang)}</b><span className="tiny muted">{t('fac.outOf', { out: n(out), cap: n(eff) })}</span></span>
          <span className="alloc">{f.lines.map((l, i) => <i key={l.modelId} style={{ width: `${l.share * 100}%`, background: PALETTE[i % PALETTE.length] }} />)}</span>
          <span className="small muted ps-models">{f.lines.map((l) => p.models.find((x) => x.id === l.modelId)?.name).filter(Boolean).join(' · ') || t('fac.lines.none')}</span>
        </button>
      )}

      {f.capacity > 0 && open && <>
        <div className="plant-body">
          <div className="plant-gauge">
            <RingGauge value={eff > 0 ? out / eff : 0} size={92} stroke={8} tone={out / Math.max(1, eff) > 0.97 ? 'warn' : 'good'} label={t('fac.util')} sub={t('fac.outOf', { out: n(out), cap: n(eff) })} />
          </div>
          <Flow f={f} />
        </div>

        <div className="plant-stats">
          <Stat label={t('fac.capacity')} value={t('fac.perMonth', { n: n(f.capacity) })} sub={f.expansion ? t('fac.capacity.plus', { n: n(f.expansion.add), m: f.expansion.monthsLeft }) : eff < f.capacity - 1 ? t('fac.capacity.effective', { n: n(eff) }) : undefined} />
          <Stat label={t('fac.allocated')} value={pct(used, lang)} sub={t('fac.allocated.free', { n: n(Math.floor(f.capacity * (1 - used))) })} />
          <Stat label={t('fac.automation')} value={pct(f.automation, lang)} sub={t('fac.automation.max', { pct: Math.round(mAuto * 100) })} />
          <Stat label={t('fac.fixed')} value={t('fac.perMo', { v: m$(factoryFixedCost(f, g.year)) })} sub={out > 0 ? t('fac.kpi.fixed.sub', { v: m$(factoryFixedCost(f, g.year) / out) }) : undefined} />
        </div>

        <div className="plant-lines">
          <div className="row between"><h4>{t('fac.lines')}</h4><span className="tiny muted">{t('fac.lines.note')}</span></div>
          {f.lines.length === 0 ? <p className="dim small">{t('fac.lines.none')}</p> : <>
            <div className="alloc" role="img" aria-label={t('fac.allocated')}>
              {f.lines.map((l, i) => { const m = p.models.find((x) => x.id === l.modelId); return <i key={l.modelId} style={{ width: `${l.share * 100}%`, background: PALETTE[i % PALETTE.length] }} title={`${m?.name ?? ''}: ${Math.round(l.share * 100)}%`} />; })}
            </div>
            <ul className="line-list">
              {f.lines.map((l, i) => { const m = p.models.find((x) => x.id === l.modelId); if (!m) return null; const units = f.capacity * l.share; return (
                <li key={l.modelId}>
                  <i className="swatch" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <div className="ll-name"><b>{m.name}</b><span className="tiny muted">{t('fac.line.cap', { n: n(units) })}{l.ramp < 0.995 ? ` · ${t('fac.line.ramp', { pct: Math.round(l.ramp * 100) })}` : ''}</span></div>
                  <span className="ll-cost"><span className="tiny muted">{t('fac.line.unitCost')}</span><b className="num">{m.lastUnitCost ? m$(m.lastUnitCost) : '—'}</b></span>
                  <Select value={l.target < 0 ? 'auto' : 'max'} options={[{ value: 'auto', label: t('fac.line.follow') }, { value: 'max', label: t('fac.line.full') }]} onChange={(v) => act((gg) => setLineTarget(gg, f.id, m.id, v === 'auto' ? -1 : units))} />
                  <button className="btn sm ghost" onClick={() => ask(t('fac.confirmRemoveLine', { model: m.name, plant: f.name }), () => { act((gg) => removeLine(gg, f.id, m.id)); })}>{t('fac.line.remove')}</button>
                </li>); })}
            </ul>
          </>}
        </div>

        {!f.expansion && <details className="small plant-impact"><summary className="muted">{t('fac.impact')}</summary>
          <div className="grid g2"><div><b className="small">{t('fac.impact.expand')}</b><ImpactPreview deps={[f.id, f.capacity, 'x']} horizon={18} run={(gg) => expandFactory(gg, f.id, Math.round(f.capacity * 0.5))} /></div>
            {f.automation < mAuto - 0.01 && <div><b className="small">{t('fac.impact.automate')}</b><ImpactPreview deps={[f.id, f.automation, 'a']} horizon={12} run={(gg) => upgradeAutomation(gg, f.id, nextAuto)} /></div>}</div>
        </details>}
      </>}
      {f.capacity <= 0 && <p className="warn small">{t('fac.construction', { n: f.expansion?.monthsLeft ?? 0 })}</p>}
      {line && <LineDialog f={f} onClose={() => setLine(false)} />}
    </section>
  );
}

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => <div className="pstat"><span className="eyebrow">{label}</span><b className="display">{value}</b>{sub && <span className="tiny muted">{sub}</span>}</div>;

/** The production flow of one plant: components in, five stages, cars out. The narrowest stage sets the pace. */
function Flow({ f }: { f: Factory }) {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const act = useStore((s) => s.act);
  const st = stagesOf(f);
  const bn = bottleneck(f);
  const out = f.lastOutput ?? 0;
  const [stage, setStage] = useState<StageId>(bn ?? 'paint');
  const add = Math.max(50, Math.round(f.capacity * 0.25));
  const n = (v: number) => num(v, lang);
  const loss = p.supply?.lastLoss ?? 0;
  const max = Math.max(1, ...STAGES.map((s) => st[s]));
  return (
    <div className="flow-wrap">
      <ol className="flow" aria-label={t('fac.flow')}>
        <li className={'flow-end' + (loss > 0.005 ? ' warn' : '')}><Icon name="box" size={18} /><b>{t('fac.flow.parts')}</b><span className="tiny">{loss > 0.005 ? t('fac.flow.partsShort', { pct: Math.round(loss * 100) }) : t('fac.flow.partsOk')}</span></li>
        {STAGES.map((s) => { const u = out / Math.max(1, st[s]); const work = f.stageWork?.stage === s ? f.stageWork : null; return (
          <li key={s} className="flow-step">
            <button type="button" data-stage={s} aria-pressed={stage === s} className={'flow-node' + (s === bn ? ' bottleneck' : '') + (stage === s ? ' on' : '')} onClick={() => setStage(s)} title={t('fac.flow.select')}>
              <span className="fn-top"><Icon name={STAGE_ICON[s]} size={15} />{t(k(`stage.${s}`))}</span>
              <b className="display">{n(st[s])}</b>
              <span className="fn-bar"><i style={{ width: `${Math.min(100, u * 100)}%` }} className={u > 0.97 ? 'full' : ''} /><em style={{ width: `${(st[s] / max) * 100}%` }} /></span>
              <span className="tiny">{s === bn ? t('fac.flow.bottleneck') : t('fac.flow.used', { pct: Math.round(u * 100) })}{work ? ` · +${n(work.add)} (${t('fac.monthsShort', { n: work.monthsLeft })})` : ''}</span>
            </button>
          </li>); })}
        <li className="flow-end out"><Icon name="vehicle" size={18} /><b>{n(out)}</b><span className="tiny">{t('fac.flow.out')}</span></li>
      </ol>
      <div className="flow-controls">
        {f.stageWork ? <span className="small muted">{t('fac.flow.working', { stage: t(k(`stage.${f.stageWork.stage}`)).toLowerCase(), n: n(f.stageWork.add), m: f.stageWork.monthsLeft })}</span>
          : <button className="btn sm" data-action="expand-stage" onClick={() => act((gg) => expandStage(gg, f.id, stage, add), t('fac.flow.ordered'))}>{t('fac.flow.expand', { stage: t(k(`stage.${stage}`)).toLowerCase(), n: n(add), cost: money(stageCost(f, stage, add, g.year), lang) })}</button>}
        <div className="flow-inspect"><Slider label={t('fac.inspection')} value={inspectionOf(f)} min={0} max={1} step={0.05} onChange={(v) => act((gg) => setInspection(gg, f.id, v))} fmt={(v) => t(v < 0.3 ? 'fac.inspection.min' : v < 0.7 ? 'fac.inspection.std' : 'fac.inspection.max')} hint={t('fac.inspection.hint')} /></div>
      </div>
    </div>
  );
}

function LineDialog({ f, onClose }: { f: Factory; onClose: () => void }) {
  const { p } = useGame();
  const { t, lang } = useT();
  const act = useStore((s) => s.act);
  const buildable = p.models.filter((m) => m.status === 'ready' || m.status === 'production');
  const free = Math.floor(f.capacity * (1 - lineShareUsed(f)));
  const [modelId, setModelId] = useState(buildable.find((m) => m.status === 'ready')?.id ?? buildable[0]?.id ?? '');
  const [units, setUnits] = useState(Math.max(10, Math.min(200, free)));
  const m = buildable.find((x) => x.id === modelId) ?? buildable[0];
  if (!m) return null;
  const u = Math.min(units, free);
  return (
    <Modal onClose={onClose}>
      <span className="eyebrow">{f.name}</span><h2>{t('fac.line.new')}</h2>
      <Select label={t('fac.line.model')} value={m.id} options={buildable.map((x) => ({ value: x.id, label: `${x.name}${x.status === 'ready' ? ` (${t('fac.line.newModel')})` : ''}` }))} onChange={setModelId} />
      <Slider label={t('fac.line.capacity')} value={u} min={1} max={Math.max(1, free)} onChange={setUnits} fmt={(v) => t('st.market.volumeFmt', { n: num(v, lang) })} />
      <StatLine label={t('fac.line.free')} value={t('fac.perMonth', { n: num(free, lang) })} />
      <StatLine label={t('fac.line.tooling')} value={<b>{money(toolingCost(m, u), lang)}</b>} />
      <StatLine label={t('fac.line.demand')} value={m.lastDemand ? num(m.lastDemand, lang) : t('fac.line.notOnSale')} />
      <p className="small muted">{t('fac.line.note')}</p>
      <div className="row end"><button className="btn" onClick={onClose}>{t('confirm.cancel')}</button><button className="btn primary" data-action="tool-line" disabled={free < 1} onClick={() => { if (act((gg) => addLine(gg, f.id, m.id, u), t('fac.line.tooled'))) onClose(); }}>{t('fac.line.tool')}</button></div>
    </Modal>
  );
}

function BuildFactory({ onClose }: { onClose: () => void }) {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const term = useTerm();
  const act = useStore((s) => s.act), ask = useStore((s) => s.ask);
  const mAuto = maxAutomation(p);
  const [nf, setNf] = useState({ name: '', country: p.country, capacity: 1000, automation: Math.min(0.3, mAuto) });
  const auto = Math.min(nf.automation, mAuto);
  const cost = factoryBuildCost(nf.capacity, auto, g.year);
  const run = (gg: GameState) => buildFactory(gg, nf.name || t('fac.new.defaultName'), nf.country, nf.capacity, auto);
  const commit = () => { if (act(run, t('fac.new.started'))) onClose(); };
  return (
    <Modal onClose={onClose}>
      <h2>{t('fac.build')}</h2>
      <label className="field"><span className="lab"><span>{t('fac.new.name')}</span></span><input type="text" value={nf.name} placeholder={t('fac.new.optional')} onChange={(e) => setNf({ ...nf, name: e.target.value })} /></label>
      <Select label={t('fac.new.country')} value={nf.country} options={COUNTRIES.map((c) => ({ value: c.id, label: t('fac.new.countryFmt', { name: term(c.name), region: term(REGION_NAME[c.region]), wage: c.wage2020.toFixed(0) }) }))} onChange={(v) => setNf({ ...nf, country: v })} />
      <Slider label={t('fac.capacity')} value={nf.capacity} min={20} max={60000} step={nf.capacity < 500 ? 10 : nf.capacity < 5000 ? 100 : 1000} onChange={(v) => setNf({ ...nf, capacity: v })} fmt={(v) => t('fac.new.capacityFmt', { n: num(v, lang), y: num(v * 12, lang) })} />
      <Slider label={t('fac.automation')} value={auto} min={0} max={mAuto} step={0.05} onChange={(v) => setNf({ ...nf, automation: v })} fmt={(v) => `${Math.round(v * 100)}%`} hint={t('fac.new.autoHint')} />
      <StatLine label={t('fac.new.investment')} value={<b className={cost > p.cash ? 'warn' : ''}>{money(cost, lang)}</b>} />
      <StatLine label={t('fac.new.time')} value={t('st.months', { n: 15 })} />
      <ImpactPreview deps={[nf.country, nf.capacity, auto]} horizon={18} run={run} />
      <div className="row end"><button className="btn" onClick={onClose}>{t('confirm.cancel')}</button>
        <button className="btn primary" data-action="confirm-build" onClick={() => { if (cost > p.cash) ask(t('fac.new.confirm', { cost: money(cost, lang), cash: money(p.cash, lang) }), commit); else commit(); }}>{t('fac.new.go')}</button></div>
    </Modal>
  );
}

// ------------------------------------------------------------------------------------------------ supply chain
function SupplyPanel() {
  const { p } = useGame();
  const { t, lang } = useT();
  const term = useTerm();
  const act = useStore((s) => s.act), ask = useStore((s) => s.ask);
  const [edit, setEdit] = useState<ComponentCategory | null>(null);
  const sup = p.supply;
  const monthly = p.factories.reduce((a, f) => a + (f.lastOutput ?? 0), 0);
  const m$ = (v: number) => money(v, lang);
  return (
    <Panel eyebrow={t('sup')} title={t('sup.title')} className="supply"
      action={<div className="supply-stock"><Slider label={t('sup.safety')} value={sup?.safetyStock ?? 0} min={0} max={2} step={0.25} onChange={(v) => act((gg) => setSafetyStock(gg, v))} fmt={(v) => (v ? t('sup.safety.fmt', { m: v, pct: Math.round(((sup?.buffer ?? 0) / Math.max(v, 1e-9)) * 100) }) : t('st.none'))} hint={t('sup.safety.hint')} /></div>}>
      <p className="small muted">{t('sup.intro')}</p>
      <div className="supply-last">
        <span className={(sup?.lastLoss ?? 0) > 0.005 ? 'warn' : ''}><b className="num">{Math.round((sup?.lastLoss ?? 0) * 100)}%</b> {t('sup.last.loss')}</span>
        <span><b className="num">{m$(sup?.lastSpot ?? 0)}</b> {t('sup.last.spot')}</span>
        <span><b className="num">{m$(sup?.lastPenalty ?? 0)}</b> {t('sup.last.penalty')}</span>
      </div>
      <div className="supply-grid">
        {CATEGORIES.map((cat) => {
          const c = sup?.contracts[cat], ih = sup?.inHouse[cat];
          const a = c ? SUPPLIER_BY_ID[c.supplierId] : undefined, b = c?.secondId ? SUPPLIER_BY_ID[c.secondId] : undefined;
          const dis = [a, b].filter((x) => x && (sup?.disrupted[x.id] ?? 0) > 0);
          const below = !!c && monthly > 0 && monthly < c.commitment * 0.9;
          const quality = a ? a.quality : ih ? 0.8 : 0.7;
          const state = dis.length ? 'bad' : below ? 'warn' : c || ih ? 'ok' : 'market';
          return (
            <article key={cat} className={'supply-card ' + state} data-component={cat}>
              <header><b>{term(CATEGORY_NAME[cat])}</b><span className={'status-chip ' + (state === 'bad' ? 'bad' : state === 'warn' ? 'development' : state === 'ok' ? 'production' : '')}>{dis.length ? t('sup.state.disrupted') : below ? t('sup.state.below') : c ? t('sup.state.contract') : ih ? t('sup.state.inHouse') : t('sup.state.market')}</span></header>
              <span className="sc-source">{ih ? t('sup.inHouse', { n: num(ih.capacity, lang) }) : ''}{ih && a ? ' + ' : ''}{a ? `${a.name}${b ? ` + ${b.name} (${Math.round((c!.secondShare ?? 0.3) * 100)}%)` : ''}` : ih ? '' : t('sup.market')}</span>
              <dl>
                <div><dt>{t('sup.price')}</dt><dd className={c && c.priceIndex < 1 || ih ? 'good' : ''}>{ih && !c ? rel(0.85) : c ? rel(c.priceIndex) : '—'}</dd></div>
                <div><dt>{t('sup.quality')}</dt><dd><span className="mini-bar"><i style={{ width: `${quality * 100}%` }} /></span>{Math.round(quality * 100)}</dd></div>
                <div><dt>{t('sup.commitment')}</dt><dd>{c ? `${num(c.commitment, lang)} · ${c.until}` : '—'}</dd></div>
              </dl>
              {dis.length > 0 && <span className="tiny bad">{t('sup.disruptedBy', { names: dis.map((x) => x!.name).join(', ') })}</span>}
              <footer><button className="btn sm" data-action="contract" onClick={() => setEdit(cat)}>{c ? t('sup.change') : t('sup.contract')}</button>{c && <button className="btn sm ghost" onClick={() => ask(t('sup.confirmEnd', { name: term(CATEGORY_NAME[cat]) }), () => { act((gg) => endContract(gg, cat), t('sup.ended')); })}>{t('sup.end')}</button>}</footer>
            </article>);
        })}
      </div>
      {edit && <ContractForm cat={edit} onClose={() => setEdit(null)} />}
      <span className="tiny muted">{t('sup.fictional')}</span>
    </Panel>
  );
}

function ContractForm({ cat, onClose }: { cat: ComponentCategory; onClose: () => void }) {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const term = useTerm();
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
  const n = (v: number) => num(v, lang);
  return (
    <Modal onClose={onClose} wide>
      <span className="eyebrow">{t('sup')}</span><h2>{term(CATEGORY_NAME[cat])}</h2>
      {list.length === 0 ? <p className="dim">{t('sup.form.none')}</p> : <>
        <div className="tablewrap"><table><thead><tr><th>{t('sup.form.supplier')}</th><th>{t('sup.form.region')}</th><th className="r">{t('sup.form.list')}</th><th className="r">{t('sup.quality')}</th><th className="r">{t('sup.form.capacity')}</th><th className="r">{t('sup.form.onTime')}</th></tr></thead>
          <tbody>{list.map((x) => <tr key={x.id} className={'click' + (x.id === id ? ' me' : '')} onClick={() => setId(x.id)}><td>{x.name}</td><td>{term(REGION_NAME[x.region])}</td><td className="r">{rel(x.price)}</td><td className="r">{Math.round(x.quality * 100)}</td><td className="r">{n(supplierCapacity(x, g.year))}</td><td className="r">{(x.reliability * 100).toFixed(1)}%</td></tr>)}</tbody></table></div>
        <Slider label={t('sup.form.commitment')} value={commit} min={100} max={Math.max(200, Math.round(capacityRef(g.year) * 2))} step={100} onChange={setCommit} fmt={(v) => t('sup.form.commitmentFmt', { n: n(v), built: n(monthly) })} hint={t('sup.form.commitmentHint')} />
        <Slider label={t('sup.form.term')} value={years} min={1} max={5} onChange={setYears} fmt={(v) => t(v === 1 ? 'sup.form.year' : 'sup.form.years', { n: v })} />
        <Select label={t('sup.form.second')} value={second} onChange={setSecond} options={[{ value: '', label: t('sup.form.single') }, ...list.filter((x) => x.id !== id).map((x) => ({ value: x.id, label: x.name }))]} />
        {second && <Slider label={t('sup.form.secondShare')} value={share} min={0.1} max={0.5} step={0.05} onChange={setShare} fmt={(v) => `${Math.round(v * 100)}%`} />}
        <StatLine label={t('sup.form.price')} value={<b>{t('sup.form.vsMarket', { v: rel(price) })}</b>} />
        <ImpactPreview deps={[id, second, share, commit, years]} horizon={12} run={run} />
        <div className="row end"><button className="btn" onClick={onClose}>{t('confirm.cancel')}</button><button className="btn primary" data-action="sign-contract" onClick={() => { if (act(run, t('sup.form.signed'))) onClose(); }}>{t('sup.form.sign')}</button></div>
      </>}
      {canIn && <div className="col" style={{ gap: 4, marginTop: 12 }}>
        <h4>{t('sup.ih.title')}</h4>
        <Slider label={t('sup.ih.capacity')} value={ihCap} min={100} max={Math.max(500, monthly * 3)} step={100} onChange={setIhCap} fmt={(v) => n(v)} />
        <StatLine label={t('fac.new.investment')} value={money(inHouseCost(cat, ihCap, g.year), lang)} /><StatLine label={t('sup.ih.effect')} value={t('sup.ih.effectText')} />
        <ImpactPreview deps={[cat, ihCap]} horizon={18} run={(gg) => buildInHouse(gg, cat, ihCap)} />
        <div className="row end"><button className="btn" onClick={() => { if (act((gg) => buildInHouse(gg, cat, ihCap), t('sup.ih.ordered'))) onClose(); }}>{t('sup.ih.build')}</button></div>
      </div>}
    </Modal>
  );
}
