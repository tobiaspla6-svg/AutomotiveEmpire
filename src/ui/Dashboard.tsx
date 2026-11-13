// CEO command centre (Phase 4C). Priorities: what is the company's health, what changed, and what to do next. Every
// number is read from the simulation (ledger, market, factories); the insights list is computed by sim/insights.ts.
import { memo, useMemo, useState } from 'react';
import { useGame, useStore } from '../store/game';
import { useT, type Lang, type MessageKey } from '../i18n';
import { delta as fmtDelta, money, monthShort, num, pct } from '../i18n/format';
import { REGION_IDS, REGION_NAME, SEGMENTS } from '../data/world';
import { COUNTRY } from '../data/world';
import { annualUnits, creditLimit, devEngineersNeeded, lineShareUsed, valuation, annualRevenue } from '../sim/company';
import { segVolume } from '../sim/market';
import { companyInsights, objectiveRatio, type Insight } from '../sim/insights';
import { bottleneck, effectiveCapacity } from '../sim/supply';
import type { Company, MonthLedger } from '../sim/types';
import { Icon, type IconName } from './ds/icons';
import { DeltaBadge, EmptyState, HBar, KpiTile, Panel, RingGauge, Tabs, TrendChart, type Tone } from './ds/primitives';
import { PALETTE } from './common';

const ebit = (l: MonthLedger) => l.profit + l.tax + l.interest - l.assetGains;
const sum = (l: MonthLedger[], f: (x: MonthLedger) => number) => l.reduce((a, x) => a + f(x), 0);
const SEV_ICON: Record<Insight['severity'], IconName> = { critical: 'alert', warning: 'alert', opportunity: 'bolt', info: 'info' };
const MONEY_ARGS = new Set(['limit', 'debt', 'burn', 'net', 'cost', 'cash']);
const COUNT_ARGS = new Set(['demand', 'sold', 'cap', 'nominal', 'need', 'have']);

/** Share of the world car market a company holds (cars sold in the last 12 months over the market's yearly volume). */
export function worldShare(units: number, year: number): number {
  const total = REGION_IDS.reduce((a, r) => a + SEGMENTS.reduce((s, sd) => s + segVolume(r, sd.id, year), 0), 0);
  return total > 0 ? units / total : 0;
}

export function DashboardView() {
  const { g, p } = useGame();
  const tick = useStore((s) => s.tick);
  const { t, tp, lang } = useT();
  const setView = useStore((s) => s.setView);
  const [tab, setTab] = useState<ChartTab>('revenue');

  const d = useMemo(() => derive(g.year, p, g), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const insights = useMemo(() => companyInsights(g, p), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const urgent = insights.filter((i) => i.severity === 'critical' || i.severity === 'warning').length;
  const led36 = p.ledger.slice(-36);
  const labels = led36.map((x) => `${monthShort(x.m, lang)} ${String(x.y).slice(2)}`);
  const sub = p.board?.note ?? t('dash.founded', { year: p.founded, country: COUNTRY[p.country]?.name ?? p.country });

  return (
    <div className="dash">
      <header className="dash-head">
        <div className="col" style={{ gap: 4 }}>
          <span className="eyebrow">{t('dash.eyebrow')}</span>
          <h2>{p.name}</h2>
          <p className="dim dash-sub">{sub}</p>
        </div>
      </header>

      <div className="kpi-band">
        <KpiTile icon="cash" label={t('kpi.cash')} value={money(p.cash, lang)} tone={p.cash < 0 ? 'bad' : 'neutral'} sparkColor="var(--s1)" spark={p.ledger.slice(-24).map((x) => x.cash)}
          delta={d.cashDelta !== null ? <DeltaBadge value={d.cashDelta} text={fmtDelta(d.cashDelta, lang)} /> : undefined}
          sub={t('kpi.cash.sub', { debt: money(p.debt, lang), headroom: money(d.headroom, lang) })} title={t('kpi.cash.hint')} onClick={() => setView('finance')} />
        <KpiTile icon="finance" label={t('kpi.revenue')} value={money(d.revenue, lang)} sparkColor="var(--s1)" spark={p.ledger.slice(-24).map((x) => x.revenue)}
          delta={d.revenueDelta !== null ? <DeltaBadge value={d.revenueDelta} text={fmtDelta(d.revenueDelta, lang)} /> : undefined} sub={t('kpi.12m')} onClick={() => setView('finance')} />
        <KpiTile icon="gauge" label={t('kpi.operating')} value={money(d.ebit, lang)} tone={d.ebit < 0 ? 'bad' : 'good'} spark={p.ledger.slice(-24).map(ebit)}
          delta={d.ebitDelta !== null ? <DeltaBadge value={d.ebitDelta} text={fmtDelta(d.ebitDelta, lang)} /> : undefined}
          sub={t('kpi.operating.sub', { margin: pct(d.margin, lang, 1) })} title={t('kpi.operating.hint')} onClick={() => setView('finance')} />
        <KpiTile icon="vehicle" label={t('kpi.units')} value={num(d.units, lang)} sparkColor="var(--s3)" spark={p.ledger.slice(-24).map((x) => x.units)}
          delta={d.unitsDelta !== null ? <DeltaBadge value={d.unitsDelta} text={fmtDelta(d.unitsDelta, lang)} /> : undefined}
          sub={d.cap > 0 ? t('kpi.units.sub', { util: pct(d.util, lang) }) : t('kpi.12m')} onClick={() => setView('market')} />
        <KpiTile icon="globe" label={t('kpi.share')} value={pct(d.share, lang, d.share < 0.01 ? 2 : 1)} sub={t('kpi.share.sub', { rank: d.rank, total: d.rivals.length })} title={t('kpi.share.hint')} onClick={() => setView('market')} />
        <KpiTile icon="trophy" label={t('kpi.valuation')} value={money(d.value, lang)} sub={d.valueX === null ? t('kpi.valuation.sub.new') : t('kpi.valuation.sub', { x: d.valueX.toFixed(1) })} title={t('kpi.valuation.hint')} onClick={() => setView('company')} />
      </div>

      <div className="dash-main">
        <Panel eyebrow={t('dash.performance')} title={t(`chart.${tab}` as MessageKey)}
          action={<Tabs label={t('dash.performance')} value={tab} onChange={setTab} options={[{ id: 'revenue', label: t('tab.revenue') }, { id: 'profit', label: t('tab.profit') }, { id: 'cash', label: t('tab.cash') }, { id: 'units', label: t('tab.units') }, { id: 'margin', label: t('tab.margin') }]} />}>
          {led36.length < 3 ? <EmptyState icon="clock" title={t('dash.noHistory')}>{t('dash.noHistory.sub')}</EmptyState> : (
            <><TrendChart height={285} labels={labels}
              fmt={tab === 'units' ? (v) => num(v, lang) : tab === 'margin' ? (v) => pct(v / 100, lang) : (v) => money(v, lang)}
              summary={t(`chart.${tab}` as MessageKey)}
              series={tab === 'revenue' ? [
                { name: t('series.revenue'), color: PALETTE[0], values: led36.map((x) => x.revenue) }]
                : tab === 'profit' ? [
                { name: t('series.operating'), color: PALETTE[2], values: led36.map(ebit) },
                { name: t('series.net'), color: PALETTE[1], values: led36.map((x) => x.profit) }]
                : tab === 'cash' ? [
                  { name: t('series.cash'), color: PALETTE[0], values: led36.map((x) => x.cash) },
                  { name: t('series.debt'), color: PALETTE[1], values: led36.map((x) => x.debt), dashed: true }]
                  : tab === 'units' ? [
                    { name: t('series.units'), color: PALETTE[2], values: led36.map((x) => x.units) },
                    ...(d.cap > 0 ? [{ name: t('series.capacity'), color: PALETTE[3], values: led36.map(() => d.effCap), dashed: true }] : [])]
                    : [
                      { name: t('series.opMargin'), color: PALETTE[2], values: led36.map((x) => (x.revenue > 0 ? (ebit(x) / x.revenue) * 100 : 0)) },
                      { name: t('series.netMargin'), color: PALETTE[1], values: led36.map((x) => (x.revenue > 0 ? (x.profit / x.revenue) * 100 : 0)) }]} />
            <ul className="chart-stats">{chartStats(tab, d, p, lang, t).map((x) => <li key={x.label}><span className="eyebrow">{x.label}</span><b className={'display ' + (x.tone ?? '')}>{x.value}</b></li>)}</ul></>
          )}
        </Panel>

        <Panel eyebrow={t('dash.briefing')} title={urgent > 0 ? tp('dash.briefing.n', urgent) : insights.length ? tp('dash.briefing.opps', insights.length) : t('dash.clear')} className="briefing">
          {insights.length === 0 ? <EmptyState icon="check" title={t('dash.clear.title')}>{t('dash.clear.sub')}</EmptyState> : (
            <ul className="insights">{insights.slice(0, 5).map((i) => <InsightRow key={i.id} insight={i} />)}</ul>
          )}
          {insights.length > 5 && <p className="tiny muted" style={{ marginTop: 8 }}>{t('dash.briefing.more', { n: insights.length - 5 })}</p>}
        </Panel>
      </div>

      <div className="dash-trio">
        <Panel eyebrow={t('dash.production')} title={t('dash.production.title')} action={<button className="linkbtn" onClick={() => setView('factories')}>{t('common.open')}<Icon name="chevron" size={14} /></button>}>
          {p.factories.length === 0 ? <EmptyState icon="factory" title={t('dash.noFactory')}>{t('dash.noFactory.sub')}</EmptyState> : (
            <div className="prod">
              <RingGauge value={d.util} tone={d.util > 0.95 ? 'warn' : d.util < 0.5 ? 'bad' : 'good'} label={t('dash.utilisation')} sub={t('dash.perMonth', { n: num(d.cap, lang) })} />
              <div className="col" style={{ gap: 9, flex: 1, minWidth: 0 }}>
                {p.factories.slice(0, 5).map((f) => {
                  const used = f.capacity * lineShareUsed(f), eff = effectiveCapacity(f), bn = bottleneck(f);
                  return <HBar key={f.id} label={<span title={f.name}>{f.name}</span>} value={used} max={f.capacity} marker={eff < f.capacity ? eff : undefined} color={used / Math.max(1, f.capacity) > 0.95 ? 'var(--warn)' : 'var(--s3)'}
                    right={bn ? <span className="warn" title={t(`stage.${bn}` as MessageKey)}>{pct(used / Math.max(1, f.capacity), lang)} · {t('dash.bottleneck')}</span> : pct(used / Math.max(1, f.capacity), lang)} />;
                })}
                {p.factories.length > 5 && <span className="tiny muted">{t('dash.more', { n: p.factories.length - 5 })}</span>}
              </div>
            </div>
          )}
        </Panel>

        <Panel eyebrow={t('dash.market')} title={t('dash.market.title')} action={<button className="linkbtn" onClick={() => setView('market')}>{t('common.open')}<Icon name="chevron" size={14} /></button>}>
          <div className="col" style={{ gap: 7 }}>
            {d.top.map((r) => <HBar key={r.c.id} label={<span className="row" style={{ gap: 6 }}><i className="swatch" style={{ background: r.c.color }} /><span className={r.c.isPlayer ? 'accent' : ''}>{r.c.name}</span></span>} value={r.units} max={d.top[0].units}
              color={r.c.isPlayer ? 'var(--accent)' : 'var(--steel)'} right={pct(worldShare(r.units, g.year), lang, 1)} />)}
          </div>
          <h4 style={{ margin: '14px 0 6px' }}>{t('dash.regions')}</h4>
          <div className="col" style={{ gap: 5 }}>
            {d.regions.map((r) => <HBar key={r.id} label={REGION_NAME[r.id]} value={r.units} max={d.regionMax} color="var(--s1)" right={num(r.units, lang)} />)}
          </div>
        </Panel>

        <Panel eyebrow={t('dash.programmes')} title={t('dash.programmes.title')} action={<button className="linkbtn" onClick={() => setView('vehicles')}>{t('common.open')}<Icon name="chevron" size={14} /></button>}>
          <div className="col" style={{ gap: 10 }}>
            {d.dev.length === 0 ? <p className="small muted">{t('dash.noDev')}</p> : d.dev.map((m) => (
              <div key={m.id} className="col" style={{ gap: 3 }}>
                <div className="row between"><b>{m.name}</b><span className="small muted">{tp('dash.monthsLeft', Math.ceil(m.devMonthsLeft))}</span></div>
                <HBar label="" value={m.devMonthsTotal - m.devMonthsLeft} max={m.devMonthsTotal} color="var(--accent)" right={pct((m.devMonthsTotal - m.devMonthsLeft) / Math.max(1, m.devMonthsTotal), lang)} />
              </div>))}
            {d.dev.length > 0 && <p className="tiny muted">{t('dash.engineers', { need: Math.round(d.engNeed), have: p.engineers })}</p>}
            {p.board && <>
              <h4 style={{ marginTop: 4 }}>{p.board.confidence !== undefined && g.mode === 'motorsport' ? t('dash.owner') : t('dash.objectives')}</h4>
              {p.board.objectives.map((o) => (
                <div key={o.id} className="col" style={{ gap: 3 }}>
                  <div className="row between" style={{ alignItems: 'flex-start' }}><span className={'obj-text ' + (o.done ? 'good' : o.failed ? 'bad' : '')}>{o.done ? '✓ ' : o.failed ? '✗ ' : ''}{o.text}</span><span className="tiny muted" style={{ whiteSpace: 'nowrap' }}>{t('dash.by', { year: o.byYear })}</span></div>
                  <HBar label="" value={objectiveRatio(o)} max={1} color={o.done ? 'var(--good)' : o.failed ? 'var(--bad)' : objectiveRatio(o) < 0.5 && o.byYear <= g.year + 1 ? 'var(--warn)' : 'var(--steel)'} right={pct(objectiveRatio(o), lang)} />
                </div>))}
            </>}
          </div>
        </Panel>
      </div>

      <div className="dash-foot">
        <Panel eyebrow={t('dash.world')} title={t('dash.news')} action={<button className="linkbtn" onClick={() => setView('news')}>{t('dash.allNews')}<Icon name="chevron" size={14} /></button>}>
          <ul className="newslist">{g.news.slice(0, 5).map((n, i) => <li key={i}><div className="row between" style={{ alignItems: 'baseline' }}><b>{n.title}</b><span className="tiny muted" style={{ whiteSpace: 'nowrap' }}>{monthShort(n.m, lang)} {n.y}</span></div><span className="small dim">{n.body}</span></li>)}</ul>
        </Panel>
        <Panel eyebrow={t('dash.conditions')} title={t('dash.conditions.title')}>
          {g.macro.modifiers.length === 0 ? <p className="small muted">{t('dash.noConditions')}</p> : <ul className="conds">{g.macro.modifiers.slice(0, 7).map((m) => <li key={m.id}><span>{m.label}</span><span className="tiny muted">{tp('dash.monthsLeft', m.monthsLeft)}</span></li>)}</ul>}
        </Panel>
      </div>
    </div>
  );
}

const InsightRow = memo(function InsightRow({ insight }: { insight: Insight }) {
  const { t, lang } = useT();
  const setView = useStore((s) => s.setView);
  const vars: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(insight.args)) {
    vars[k] = typeof v === 'number' && MONEY_ARGS.has(k) ? money(v, lang) : typeof v === 'number' && COUNT_ARGS.has(k) ? num(v, lang) : k === 'stage' ? t(`stage.${v}` as MessageKey) : v;
  }
  const tone: Tone = insight.severity === 'critical' ? 'bad' : insight.severity === 'warning' ? 'warn' : insight.severity === 'opportunity' ? 'good' : 'info';
  return (
    <li className={'insight ' + insight.severity}>
      <span className="ins-icon" style={{ color: `var(--${tone === 'bad' ? 'bad' : tone === 'warn' ? 'warn' : tone === 'good' ? 'good' : 'info'})` }}><Icon name={SEV_ICON[insight.severity]} size={17} /></span>
      <div className="ins-text"><b>{t(`insight.${insight.kind}.title` as MessageKey, vars)}</b><span>{t(`insight.${insight.kind}.why` as MessageKey, vars)}</span></div>
      <button className="btn sm" onClick={() => setView(insight.view)}>{t(`go.${insight.view}` as MessageKey)}</button>
    </li>
  );
});

/** Three supporting figures under the chart, for whichever view is selected. */
type ChartTab = 'revenue' | 'profit' | 'cash' | 'units' | 'margin';
function chartStats(tab: ChartTab, d: ReturnType<typeof derive>, p: Company, lang: Lang, t: (k: MessageKey, v?: Record<string, string | number>) => string): { label: string; value: string; tone?: string }[] {
  const net = sum(p.ledger.slice(-12), (x) => x.profit);
  const perCar = d.units > 0 ? d.revenue / d.units : 0;
  const op = d.revenue > 0 ? d.ebit / d.revenue : 0, nm = d.revenue > 0 ? net / d.revenue : 0;
  switch (tab) {
    case 'revenue': return [{ label: t('stat.rev12'), value: money(d.revenue, lang) }, { label: t('stat.revMonth'), value: money(d.revenue / 12, lang) }, { label: t('stat.perCar'), value: money(perCar, lang, 0) }];
    case 'profit': return [{ label: t('stat.net12'), value: money(net, lang), tone: net < 0 ? 'bad' : 'good' }, { label: t('stat.opMargin'), value: pct(op, lang, 1) }, { label: t('stat.perCar'), value: money(perCar, lang, 0) }];
    case 'cash': return [{ label: t('stat.netDebt'), value: money(p.debt - p.cash, lang), tone: p.debt - p.cash > 0 ? 'warn' : 'good' }, { label: t('stat.interest'), value: pct(p.interestRate, lang, 1) }, { label: t('stat.headroom'), value: money(d.headroom, lang) }];
    case 'units': return [{ label: t('stat.perMonth'), value: num(d.units / 12, lang) }, { label: t('stat.util'), value: d.cap > 0 ? pct(d.util, lang) : '—' }, { label: t('stat.capacity'), value: d.cap > 0 ? num(d.effCap, lang) : '—' }];
    default: return [{ label: t('stat.opMargin'), value: pct(op, lang, 1) }, { label: t('stat.netMargin'), value: pct(nm, lang, 1), tone: nm < 0 ? 'bad' : '' }, { label: t('stat.perCar'), value: money(perCar, lang, 0) }];
  }
}

// ----------------------------------------------------------------------------------------------- derived numbers
function derive(year: number, p: Company, g: import('../sim/types').GameState) {
  const l = p.ledger;
  const last12 = l.slice(-12), prev12 = l.slice(-24, -12);
  const yoy = prev12.length === 12 && last12.length === 12;
  const rel = (a: number, b: number) => (Math.abs(b) > 1e-9 ? (a - b) / Math.abs(b) : null);
  const revenue = sum(last12, (x) => x.revenue), ebitV = sum(last12, ebit), units = sum(last12, (x) => x.units);
  const cap = p.factories.reduce((a, f) => a + f.capacity, 0);
  const used = p.factories.reduce((a, f) => a + f.capacity * lineShareUsed(f), 0);
  const effCap = p.factories.reduce((a, f) => a + effectiveCapacity(f), 0);
  const rivals = g.companies.filter((c) => c.alive && (c.models.length > 0 || c.isPlayer)).map((c) => ({ c, units: c.ledger.length ? annualUnits(c) : c.baseVolume })).sort((a, b) => b.units - a.units);
  const rank = Math.max(1, rivals.findIndex((r) => r.c.isPlayer) + 1);
  const top = rivals.slice(0, 5);
  if (!top.some((r) => r.c.isPlayer)) { const me = rivals.find((r) => r.c.isPlayer); if (me) top.push(me); }
  const regionUnits = REGION_IDS.map((id) => ({ id, units: p.models.reduce((a, m) => a + m.lastSales[id], 0) * 12 })).sort((a, b) => b.units - a.units);
  const value = valuation(p, year);
  const dev = p.models.filter((m) => m.status === 'development');
  const cash3 = l.length >= 4 ? l[l.length - 4].cash : null;
  return {
    revenue, ebit: ebitV, units, margin: revenue > 0 ? ebitV / revenue : 0,
    revenueDelta: yoy ? rel(revenue, sum(prev12, (x) => x.revenue)) : null,
    ebitDelta: yoy ? rel(ebitV, sum(prev12, ebit)) : null,
    unitsDelta: yoy ? rel(units, sum(prev12, (x) => x.units)) : null,
    cashDelta: cash3 !== null ? rel(p.cash, cash3) : null,
    headroom: Math.max(0, creditLimit(p, year) - p.debt),
    cap, effCap, util: cap > 0 ? used / cap : 0,
    share: worldShare(units, year), rank, rivals, top,
    regions: regionUnits.filter((r) => r.units > 0).slice(0, 6), regionMax: Math.max(1, ...regionUnits.map((r) => r.units)),
    value, valueX: annualRevenue(p) >= 1e6 ? value / annualRevenue(p) : null, // no multiple until there is a year of revenue to compare with
    dev, engNeed: dev.reduce((a, m) => a + devEngineersNeeded(g, p, m), 0),
  };
}
