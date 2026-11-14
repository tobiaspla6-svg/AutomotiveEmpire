// Finance, Market & sales and Research (Phase 4C) in the shared design system: KPI tiles, the same trend chart as the
// dashboard, visual comparisons in place of tables where a comparison says more, and a preview before every
// decision. All figures and actions are the simulation's own.
import { useEffect, useMemo, useState } from 'react';
import type { MonthLedger, RegionId, TechArea } from '../sim/types';
import { useGame, useStore } from '../store/game';
import { useT, type MessageKey } from '../i18n';
import { useTerm } from '../i18n/terms';
import { money, monthShort, num, pct } from '../i18n/format';
import { REGIONS, REGION_IDS, SEG, SEGMENTS, segPrice } from '../data/world';
import { TECHS } from '../data/tech';
import { AREA_NAME, TECH_AREAS, annualRevenue, annualUnits, creditLimit, devEngineersNeeded, engineerCost, researchRef, valuation } from '../sim/company';
import { dealerCostPerUnit, investDealers, repayLoan, setEngineers, setMarketing, setRd, takeLoan } from '../sim/actions';
import { computeMarket, fuelPrice, segVolume } from '../sim/market';
import { cpi } from '../sim/util';
import { equity, fixedAssets, inventoryValue } from '../sim/accounts';
import { PageHead, PALETTE, Select, Slider, StatLine } from './common';
import { Icon } from './ds/icons';
import { HBar, KpiTile, Panel, StackBar, Tabs, TrendChart } from './ds/primitives';
import { ImpactPreview } from './Impact';

const k = (s: string) => s as MessageKey;
const sum = (l: MonthLedger[], f: (x: MonthLedger) => number) => l.reduce((a, x) => a + f(x), 0);
const COSTS: (keyof MonthLedger)[] = ['cogs', 'factoryFixed', 'wages', 'dev', 'rd', 'marketing', 'logistics', 'motorsport', 'other', 'oneOff', 'depreciation', 'interest', 'tax'];

// ================================================================================================ finance
export function FinanceView() {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const act = useStore((s) => s.act), ask = useStore((s) => s.ask);
  const [loan, setLoan] = useState(10);
  const [tab, setTab] = useState<'cash' | 'profit' | 'costs'>('cash');
  const led = p.ledger.slice(-60), l12 = p.ledger.slice(-12);
  const labels = led.map((x) => `${monthShort(x.m, lang)} ${String(x.y).slice(2)}`);
  const limit = creditLimit(p, g.year);
  const y = (f: keyof MonthLedger) => sum(l12, (x) => x[f] as number);
  const last = p.ledger[p.ledger.length - 1];
  const m$ = (v: number) => money(v, lang);
  const headroom = limit - p.debt;
  const opCash = y('operatingCash'), invCash = y('investingCash'), finCash = y('financingCash');
  const costs = COSTS.map((key, i) => ({ key, label: t(k(`fin.cost.${key}`)), value: Math.max(0, y(key)), color: PALETTE[i % PALETTE.length] })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  const costMax = Math.max(1, ...costs.map((x) => x.value));
  const assets = [{ label: t('fin.bs.cash'), value: Math.max(0, p.cash), color: 'var(--s3)' }, { label: t('fin.bs.inventory'), value: inventoryValue(p), color: 'var(--s4)' }, { label: t('fin.bs.fixed'), value: fixedAssets(p), color: 'var(--s1)' }];
  const borrow = () => { const amt = loan * 1e6; const go = () => { act((gg) => takeLoan(gg, amt), t('fin.loan.drawn')); }; if (p.debt + amt > limit * 0.85) ask(t('fin.loan.confirm', { amount: m$(amt), debt: m$(p.debt + amt), limit: m$(limit), rate: (p.interestRate * 100).toFixed(1) }), go); else go(); };
  return (
    <div className="corp">
      <PageHead title={t('fin.title')}>{t('fin.sub', { year: g.year, cpi: cpi(g.year).toFixed(2) })}</PageHead>
      <div className="kpi-band">
        <KpiTile icon="cash" label={t('kpi.cash')} value={m$(p.cash)} tone={p.cash < 0 ? 'bad' : 'neutral'} spark={led.slice(-24).map((x) => x.cash)} sparkColor="var(--s3)" sub={t('fin.kpi.cash.sub')} />
        <KpiTile icon="layers" label={t('top.debt')} value={m$(p.debt)} tone={p.troubleMonths > 0 ? 'bad' : 'neutral'} sub={t('fin.kpi.debt.sub', { rate: (p.interestRate * 100).toFixed(1), cost: m$(p.debt * p.interestRate) })} />
        <KpiTile icon="gauge" label={t('fin.kpi.headroom')} value={m$(Math.max(0, headroom))} tone={p.debt - p.cash > limit ? 'bad' : headroom < limit * 0.15 ? 'warn' : 'good'} sub={p.debt - p.cash > limit ? t('fin.kpi.headroom.over') : t('fin.kpi.headroom.sub', { limit: m$(limit) })} title={t('fin.loan.note')} />
        <KpiTile icon="finance" label={t('stat.net12')} value={m$(y('profit'))} tone={y('profit') < 0 ? 'bad' : 'good'} spark={led.slice(-24).map((x) => x.profit)} sparkColor={y('profit') < 0 ? 'var(--bad)' : 'var(--good)'} sub={t('fin.kpi.profit.sub', { v: m$(last?.profit ?? 0) })} />
        <KpiTile icon="route" label={t('fin.kpi.opCash')} value={m$(opCash)} tone={opCash < 0 ? 'warn' : 'good'} sub={t('fin.kpi.opCash.sub')} title={t('fin.cf.operating.hint')} />
        <KpiTile icon="trophy" label={t('kpi.valuation')} value={m$(valuation(p, g.year))} sub={t('fin.kpi.value.sub', { v: m$(equity(p)) })} />
      </div>

      <div className="corp-main">
        <Panel eyebrow={t('fin.trend')} title={t(k(`fin.chart.${tab}`))} action={<Tabs label={t('fin.trend')} value={tab} onChange={setTab} options={[{ id: 'cash', label: t('tab.cash') }, { id: 'profit', label: t('tab.profit') }, { id: 'costs', label: t('fin.tab.costs') }]} />}>
          <TrendChart height={270} labels={labels} fmt={m$} summary={t(k(`fin.chart.${tab}`))}
            series={tab === 'cash' ? [{ name: t('series.cash'), color: PALETTE[0], values: led.map((x) => x.cash) }, { name: t('series.debt'), color: PALETTE[1], values: led.map((x) => x.debt), dashed: true }]
              : tab === 'profit' ? [{ name: t('series.net'), color: PALETTE[2], values: led.map((x) => x.profit) }]
                : [{ name: t('series.revenue'), color: PALETTE[0], values: led.map((x) => x.revenue) }, { name: t('fin.series.costs'), color: PALETTE[1], values: led.map((x) => x.revenue + x.otherIncome + (x.assetGains ?? 0) - x.profit) }]} />
        </Panel>
        <Panel eyebrow={t('fin.loan')} title={t('fin.loan.title')}>
          <HBar label="" value={p.debt} max={Math.max(limit, p.debt, 1)} marker={limit} color={p.debt > limit ? 'var(--bad)' : p.debt > limit * 0.8 ? 'var(--warn)' : 'var(--s1)'} right={`${m$(p.debt)} / ${m$(limit)}`} title={t('fin.loan.barHint')} />
          <p className="tiny muted" style={{ margin: '6px 0 10px' }}>{t('fin.loan.barHint')}</p>
          <div className="row wrap" style={{ gap: 8 }}>
            <label className="row" style={{ gap: 6 }}><input type="number" value={loan} min={1} style={{ width: 110 }} aria-label={t('fin.loan.amount')} onChange={(e) => setLoan(Number(e.target.value))} /><span className="muted small">{t('fin.loan.million')}</span></label>
            <button className="btn" data-action="borrow" onClick={borrow}>{t('fin.loan.borrow')}</button>
            <button className="btn" data-action="repay" onClick={() => act((gg) => repayLoan(gg, loan * 1e6), t('fin.loan.repaid'))}>{t('fin.loan.repay')}</button>
            <button className="btn ghost" onClick={() => act((gg) => repayLoan(gg, p.debt), t('fin.loan.repaid'))}>{t('fin.loan.repayAll')}</button>
          </div>
          <div style={{ marginTop: 8 }}><ImpactPreview deps={[loan]} horizon={12} run={(gg) => takeLoan(gg, loan * 1e6)} /></div>
          <p className="small muted" style={{ marginTop: 8 }}>{t('fin.loan.note')}</p>
        </Panel>
      </div>

      <div className="corp-two">
        <Panel eyebrow={t('fin.costs')} title={t('fin.costs.title')}>
          {costs.length === 0 ? <p className="dim small">{t('dash.noHistory.sub')}</p> : <div className="col" style={{ gap: 7 }}>{costs.map((x) => <HBar key={x.key} label={x.label} value={x.value} max={costMax} color={x.color} right={`${m$(x.value)} · ${y('revenue') > 0 ? pct(x.value / y('revenue'), lang) : '—'}`} />)}</div>}
          <p className="tiny muted" style={{ marginTop: 8 }}>{t('fin.costs.note')}</p>
        </Panel>
        <Panel eyebrow={t('fin.is')} title={t('fin.is.title')} pad>
          <table className="statement"><thead><tr><th>{t('fin.is.item')}</th><th className="r">{t('top.lastMonth')}</th><th className="r">{t('kpi.12m')}</th></tr></thead><tbody>
            <tr><td><b>{t('series.revenue')}</b></td><td className="r">{m$(last?.revenue ?? 0)}</td><td className="r">{m$(y('revenue'))}</td></tr>
            <tr><td className="dim">+ {t('fin.is.other')}</td><td className="r">{m$(last?.otherIncome ?? 0)}</td><td className="r">{m$(y('otherIncome'))}</td></tr>
            <tr><td className="dim">+ {t('fin.is.assets')}</td><td className="r">{m$(last?.assetGains ?? 0)}</td><td className="r">{m$(y('assetGains'))}</td></tr>
            {COSTS.map((key) => <tr key={key}><td className="dim">− {t(k(`fin.cost.${key}`))}</td><td className="r">{m$((last?.[key] as number) ?? 0)}</td><td className="r">{m$(y(key))}</td></tr>)}
            <tr className="total"><td><b>{t('series.net')}</b></td><td className={'r ' + ((last?.profit ?? 0) < 0 ? 'bad' : 'good')}><b>{m$(last?.profit ?? 0)}</b></td><td className={'r ' + (y('profit') < 0 ? 'bad' : 'good')}><b>{m$(y('profit'))}</b></td></tr>
          </tbody></table>
        </Panel>
      </div>

      <div className="corp-two">
        <Panel eyebrow={t('fin.bs')} title={t('fin.bs.title')}>
          <StackBar parts={assets} fmt={m$} />
          <ul className="legend-grid">{assets.map((x) => <li key={x.label}><i className="swatch" style={{ background: x.color }} /><span>{x.label}</span><b className="num">{m$(x.value)}</b></li>)}</ul>
          <div className="col" style={{ gap: 2, marginTop: 8 }}>
            <StatLine label={`− ${t('top.debt')}`} value={m$(p.debt)} />
            <StatLine label={<b>{t('fin.bs.equity')}</b>} value={<b className={equity(p) < 0 ? 'bad' : ''}>{m$(equity(p))}</b>} title={t('fin.bs.equity.hint')} />
          </div>
        </Panel>
        <Panel eyebrow={t('fin.cf')} title={t('fin.cf.title')}>
          <div className="col" style={{ gap: 8 }}>
            {([['operating', opCash], ['investing', invCash], ['financing', finCash]] as const).map(([id, v]) => <HBar key={id} label={t(k(`fin.cf.${id}`))} value={Math.abs(v)} max={Math.max(1, Math.abs(opCash), Math.abs(invCash), Math.abs(finCash))} color={v < 0 ? 'var(--s2)' : 'var(--s3)'} right={<span className={v < 0 ? 'bad' : 'good'}>{v > 0 ? '+' : ''}{m$(v)}</span>} title={t(k(`fin.cf.${id}.hint`))} />)}
          </div>
          <div className="col" style={{ gap: 2, marginTop: 10 }}>
            <StatLine label={t('fin.cf.built')} value={m$(y('production'))} />
            <StatLine label={<b>{t('fin.cf.change')}</b>} value={<b className={opCash + invCash + finCash < 0 ? 'bad' : 'good'}>{m$(opCash + invCash + finCash)}</b>} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ================================================================================================ market
export function MarketView() {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const term = useTerm();
  const act = useStore((s) => s.act);
  const tick = useStore((s) => s.tick);
  const mk = useMemo(() => computeMarket(g), [g, tick]);
  const [seg, setSeg] = useState(p.models.find((m) => m.status === 'production')?.segment ?? 'family');
  const [amount, setAmount] = useState<Record<string, number>>({});
  const rows = useMemo(() => {
    const by = new Map<string, { name: string; company: string; me: boolean; units: number; price: number; q: number; n: number }>();
    let other = 0, total = 0;
    for (const r of REGION_IDS) {
      const cell = mk.cells[`${r}:${seg}`];
      other += cell.other; total += cell.volume;
      for (const e of cell.entries) {
        const x = by.get(e.model.id) ?? { name: e.model.name, company: e.company.name, me: e.company.isPlayer, units: 0, price: e.model.price, q: 0, n: 0 };
        x.units += e.demand; x.q += e.q; x.n++;
        by.set(e.model.id, x);
      }
    }
    return { list: [...by.values()].sort((a, b) => b.units - a.units), other, total };
  }, [mk, seg]);
  const companies = g.companies.filter((c) => c.alive && (c.models.length > 0 || c.isPlayer)).map((c) => ({ c, units: c.ledger.length ? annualUnits(c) : c.baseVolume })).sort((a, b) => b.units - a.units);
  const totalWorld = REGION_IDS.reduce((a, r) => a + SEGMENTS.reduce((s, sd) => s + segVolume(r, sd.id, g.year), 0), 0);
  const def = SEG[seg];
  const m$ = (v: number) => money(v, lang);
  const n = (v: number) => num(v, lang);
  const myUnits = p.ledger.length ? annualUnits(p) : 0;
  const rank = companies.findIndex((x) => x.c.isPlayer) + 1;
  const top = rows.list.slice(0, 12), topMax = Math.max(1, ...top.map((x) => x.units), rows.other);
  const mineInSeg = rows.list.filter((x) => x.me).reduce((a, x) => a + x.units, 0);
  const weights = Object.entries(def.weights).sort((a, b) => b[1] - a[1]);
  const rev = annualRevenue(p);
  const awareness = REGION_IDS.reduce((a, r) => a + p.awareness[r], 0) / REGION_IDS.length;
  const compMax = Math.max(1, ...companies.map((x) => x.units));
  return (
    <div className="corp">
      <PageHead title={t('mkt.title')}>{t('mkt.sub')}</PageHead>
      <div className="kpi-band">
        <KpiTile icon="globe" label={t('kpi.share')} value={pct(totalWorld > 0 ? myUnits / totalWorld : 0, lang, 1)} sub={t('kpi.share.sub', { rank: Math.max(1, rank), total: companies.length })} />
        <KpiTile icon="vehicle" label={t('kpi.units')} value={n(myUnits)} sub={t('kpi.12m')} />
        <KpiTile icon="target" label={t('mkt.kpi.segment')} value={pct(rows.total > 0 ? mineInSeg / rows.total : 0, lang, 1)} sub={term(def.name)} tone={mineInSeg > 0 ? 'good' : 'neutral'} />
        <KpiTile icon="eye" label={t('mkt.kpi.awareness')} value={`${Math.round(awareness)}%`} sub={t('mkt.kpi.awareness.sub', { home: Math.round(p.awareness[p.homeRegion]) })} />
        <KpiTile icon="market" label={t('mkt.kpi.marketing')} value={m$(p.marketingBudget)} sub={rev > 0 ? t('mkt.kpi.marketing.sub', { pct: ((p.marketingBudget * 12 / rev) * 100).toFixed(1) }) : t('mkt.kpi.marketing.none')} />
        <KpiTile icon="bolt" label={t('mkt.kpi.fuel')} value={fuelPrice(g).toFixed(2)} tone={fuelPrice(g) > 1.3 ? 'warn' : 'neutral'} sub={t(fuelPrice(g) > 1.3 ? 'mkt.kpi.fuel.high' : fuelPrice(g) < 0.85 ? 'mkt.kpi.fuel.low' : 'mkt.kpi.fuel.normal')} />
      </div>

      <div className="corp-main">
        <Panel eyebrow={t('mkt.seg')} title={t('mkt.seg.title', { name: term(def.name) })} action={<Select value={seg} options={SEGMENTS.map((s) => ({ value: s.id, label: term(s.name) }))} onChange={setSeg} />}>
          <div className="row wrap small dim" style={{ gap: 16, marginBottom: 10 }}><span>{t('mkt.seg.demand')}: <b className="num">{n(rows.total)}</b></span><span>{t('st.market.reference')}: <b className="num">{m$(segPrice(seg, g.year))}</b></span></div>
          <div className="col" style={{ gap: 6 }} data-segment={seg}>
            {top.map((r, i) => <HBar key={r.company + r.name} label={<span className={r.me ? 'me-row' : ''} title={`${r.name} — ${r.company}`}>{i + 1}. {r.name}</span>} value={r.units} max={topMax} color={r.me ? 'var(--accent)' : 'var(--s1)'} right={<span title={t('mkt.seg.rowHint', { appeal: (r.q / r.n).toFixed(2) })}>{n(r.units)} · {m$(r.price)}</span>} />)}
            <HBar label={<span className="muted">{t('mkt.seg.others')}</span>} value={rows.other} max={topMax} color="var(--line3)" right={`${n(rows.other)} · ${rows.total > 0 ? pct(rows.other / rows.total, lang) : '—'}`} />
          </div>
          <p className="tiny muted" style={{ marginTop: 8 }}>{t('mkt.seg.note')}</p>
        </Panel>
        <Panel eyebrow={t('mkt.buyers')} title={t('mkt.buyers.title', { name: term(def.name).toLowerCase() })}>
          <div className="col" style={{ gap: 6 }}>{weights.map(([key, v]) => <HBar key={key} label={t(k(`score.${key}`))} value={v} max={weights[0][1]} color={v >= 0.15 ? 'var(--accent)' : 'var(--s1)'} right={pct(v, lang)} />)}</div>
          <p className="tiny muted" style={{ marginTop: 8 }}>{t('mkt.buyers.note')}</p>
          <h4 style={{ marginTop: 14 }}>{t('mkt.marketing')}</h4>
          <Slider label={t('mkt.marketing.budget')} value={p.marketingBudget} min={0} max={Math.max(2e6, rev * 0.08 / 12, p.marketingBudget)} step={Math.max(1e4, Math.round(rev * 0.0005 / 12 / 1e4) * 1e4)} onChange={(v) => act((gg) => setMarketing(gg, v))} fmt={(v) => t('mkt.marketing.fmt', { v: m$(v), pct: rev ? ((v * 12 / rev) * 100).toFixed(1) : '0' })} />
          <p className="tiny muted">{t('mkt.marketing.note')}</p>
        </Panel>
      </div>

      <Panel eyebrow={t('mkt.dealers')} title={t('mkt.dealers.title')}>
        <div className="region-grid">
          {REGIONS.map((r) => { const vol = SEGMENTS.reduce((s, sd) => s + segVolume(r.id, sd.id, g.year), 0); const a = amount[r.id] ?? Math.max(1e6, Math.round(p.cash * 0.05 / 1e6) * 1e6); const add = a / dealerCostPerUnit(g, p, r.id as RegionId); return (
            <article key={r.id} className="region-card" data-region={r.id}>
              <header><b>{term(r.name)}</b>{r.id === p.homeRegion && <span className="status-chip ready">{t('mkt.dealers.home')}</span>}</header>
              <HBar label={t('mkt.dealers.reach')} value={p.reach[r.id]} max={vol} color="var(--s1)" right={`${n(p.reach[r.id])} / ${n(vol)}`} title={t('mkt.dealers.reachHint')} />
              <HBar label={t('mkt.kpi.awareness')} value={p.awareness[r.id]} max={100} color="var(--s3)" right={`${Math.round(p.awareness[r.id])}%`} />
              <footer><label className="row" style={{ gap: 5 }}><input type="number" style={{ width: 78 }} value={Math.round(a / 1e6)} min={1} aria-label={t('mkt.dealers.amount', { name: term(r.name) })} onChange={(e) => setAmount({ ...amount, [r.id]: Number(e.target.value) * 1e6 })} /><span className="small muted">{t('mkt.dealers.m')}</span></label>
                <button className="btn sm" data-action="invest-dealers" title={t('mkt.dealers.gain', { n: n(add) })} onClick={() => act((gg) => investDealers(gg, r.id as RegionId, a), t('mkt.dealers.done'))}>{t('mkt.dealers.invest')}</button><span className="tiny muted">{t('mkt.dealers.gain', { n: n(add) })}</span></footer>
            </article>); })}
        </div>
        <ImpactPreview deps={[amount]} run={(gg) => { for (const r of REGIONS) { const v = amount[r.id]; if (v) { const e = investDealers(gg, r.id as RegionId, v); if (e) return e; } } return Object.values(amount).some((v) => v) ? null : t('mkt.dealers.enter'); }} />
        <p className="tiny muted" style={{ marginTop: 6 }}>{t('mkt.dealers.note')}</p>
      </Panel>

      <Panel eyebrow={t('mkt.makers')} title={t('mkt.makers.title')}>
        <div className="maker-list">
          <div className="maker-head"><span /><span>{t('mkt.makers.cars')}</span><span className="r">{t('score.prestige')}</span><span className="r">{t('score.reliability')}</span></div>
          {companies.map(({ c, units }, i) => <div key={c.id} className={'maker-row' + (c.isPlayer ? ' me' : '')}>
            <span className="mk-name"><i className="swatch" style={{ background: c.color }} />{i + 1}. {c.name}</span>
            <HBar label="" value={units} max={compMax} color={c.isPlayer ? 'var(--accent)' : c.color} right={`${n(units)} · ${pct(totalWorld > 0 ? units / totalWorld : 0, lang, 1)}`} />
            <span className="r num">{Math.round(c.prestige)}</span><span className="r num">{Math.round(c.reliabilityRep)}</span>
          </div>)}
        </div>
      </Panel>
    </div>
  );
}

// ================================================================================================ research
export function ResearchView() {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const term = useTerm();
  const act = useStore((s) => s.act), ask = useStore((s) => s.ask);
  const ref = researchRef(g.year);
  const yNow = g.year + (g.month - 1) / 12;
  const [eng, setEng] = useState(p.engineers);
  useEffect(() => setEng(p.engineers), [p.engineers]);
  const d = eng - p.engineers;
  const m$ = (v: number) => money(v, lang);
  const rdTotal = TECH_AREAS.reduce((a, x) => a + p.rdBudget[x], 0);
  const lead = TECH_AREAS.reduce((a, x) => a + (p.tech[x] - yNow), 0) / TECH_AREAS.length;
  const rev = annualRevenue(p);
  const need = p.models.filter((m) => m.status === 'development').reduce((a, m) => a + devEngineersNeeded(g, p, m), 0);
  const wage = engineerCost(p, g.year);
  const apply = () => { const go = () => { act((gg) => setEngineers(gg, eng), t('res.staff.changed')); }; if (d < 0 && -d > p.engineers * 0.1) ask(t('res.staff.confirm', { n: -d, cost: m$(-d * wage * 3) }), go); else go(); };
  const pos = (yrs: number) => `${Math.max(0, Math.min(100, ((yrs + 5) / 8) * 100))}%`; // −5 … +3 years
  return (
    <div className="corp">
      <PageHead title={t('res.title')}>{t('res.sub', { ref: m$(ref) })}</PageHead>
      <div className="kpi-band four">
        <KpiTile icon="research" label={t('res.kpi.lead')} value={`${lead >= 0 ? '+' : '−'}${Math.abs(lead).toFixed(1)}`} tone={lead >= 0 ? 'good' : lead < -2.5 ? 'warn' : 'neutral'} sub={t(lead >= 0 ? 'res.kpi.lead.ahead' : 'res.kpi.lead.behind')} />
        <KpiTile icon="cash" label={t('res.kpi.budget')} value={m$(rdTotal)} sub={rev > 0 ? t('res.kpi.budget.sub', { pct: ((rdTotal * 12 / rev) * 100).toFixed(1) }) : t('res.kpi.budget.none')} />
        <KpiTile icon="users" label={t('res.kpi.engineers')} value={num(p.engineers, lang)} sub={t('fac.perMo', { v: m$(p.engineers * wage) })} />
        <KpiTile icon="wrench" label={t('res.kpi.need')} value={num(Math.round(need), lang)} tone={need > p.engineers * 1.05 ? 'warn' : 'good'} sub={t(need > p.engineers * 1.05 ? 'res.kpi.need.short' : need > 0 ? 'res.kpi.need.ok' : 'res.kpi.need.none')} />
      </div>
      <div className="tech-grid">
        {TECH_AREAS.map((a) => {
          const lvl = p.tech[a], ld = lvl - yNow;
          const next = TECHS.filter((x) => x.area === a && x.year > lvl).sort((x, z) => x.year - z.year).slice(0, 3);
          const have = TECHS.filter((x) => x.area === a && x.year <= lvl).sort((x, z) => z.year - x.year).slice(0, 3);
          return (
            <section key={a} className="panel tech-card" data-area={a}>
              <header><div className="col" style={{ gap: 0 }}><span className="eyebrow">{t('res.area')}</span><h3>{term(AREA_NAME[a])}</h3></div>
                <div className="tech-level"><b className="display">{lvl.toFixed(1)}</b><span className={'delta ' + (ld >= 0 ? 'up' : ld < -2.5 ? 'down' : 'flat')}>{t('res.lead', { v: `${ld >= 0 ? '+' : '−'}${Math.abs(ld).toFixed(1)}` })}</span></div></header>
              <div className="tech-track" role="img" aria-label={t('res.lead', { v: ld.toFixed(1) })}><i className="tt-zero" style={{ left: pos(0) }} /><i className="tt-supplier" style={{ left: pos(-4) }} /><b style={{ left: pos(ld) }} className={ld >= 0 ? 'good' : ld < -2.5 ? 'warn' : ''} /></div>
              <div className="row between tiny muted"><span>{t('res.track.supplier')}</span><span>{t('res.track.calendar')}</span><span>{t('res.track.ahead')}</span></div>
              <Slider label={t('res.budget')} value={p.rdBudget[a]} min={0} max={Math.max(ref * 12, p.rdBudget[a])} step={ref / 20} onChange={(v) => act((gg) => setRd(gg, a as TechArea, v))} fmt={(v) => t('res.budgetFmt', { v: m$(v), x: (v / ref).toFixed(1) })} />
              <div className="tech-list"><span className="eyebrow">{t('res.next')}</span>{next.length ? next.map((x) => <span key={x.id} className="tech-chip todo" title={x.name}>{x.name} <i>{x.year}</i></span>) : <span className="small muted">{t('res.next.none')}</span>}</div>
              <div className="tech-list"><span className="eyebrow">{t('res.have')}</span>{have.length ? have.map((x) => <span key={x.id} className="tech-chip" title={x.name}><Icon name="check" size={11} />{x.name}</span>) : <span className="small muted">—</span>}</div>
            </section>);
        })}
        <section className="panel tech-card staff">
          <header><div className="col" style={{ gap: 0 }}><span className="eyebrow">{t('res.staff')}</span><h3>{t('res.staff.title')}</h3></div></header>
          <HBar label={t('res.staff.load')} value={need} max={Math.max(need, p.engineers, 1)} marker={p.engineers} color={need > p.engineers ? 'var(--warn)' : 'var(--s3)'} right={`${num(Math.round(need), lang)} / ${num(p.engineers, lang)}`} title={t('res.staff.loadHint')} />
          <Slider label={t('res.staff.engineers')} value={eng} min={0} max={Math.max(400, p.engineers * 2)} step={p.engineers > 2000 ? 50 : 5} onChange={setEng} fmt={(v) => t('res.staff.fmt', { n: num(v, lang), v: m$(v * wage) })} />
          <div className="row between wrap"><span className="small dim">{d === 0 ? t('res.staff.noChange') : d > 0 ? t('res.staff.hire', { n: d, cost: m$(d * wage * 2) }) : t('res.staff.layoff', { n: -d, cost: m$(-d * wage * 3) })}</span>
            <button className="btn sm primary" data-action="apply-staff" disabled={d === 0} onClick={apply}>{t('res.staff.apply')}</button></div>
          {d !== 0 && <ImpactPreview deps={[eng]} horizon={12} run={(gg) => setEngineers(gg, eng)} />}
          <p className="small muted">{t('res.staff.note')}</p>
          {p.motorsport && <p className="small good">{t('res.staff.racing')}</p>}
        </section>
      </div>
    </div>
  );
}
