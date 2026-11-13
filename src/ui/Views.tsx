import { useEffect, useMemo, useRef, useState } from 'react';
import type { MonthLedger, RegionId, TechArea } from '../sim/types';
import { useGame, useStore } from '../store/game';
import { COUNTRIES, COUNTRY, REGIONS, REGION_IDS, REGION_NAME, SEG, SEGMENTS, segPrice } from '../data/world';
import { TECHS } from '../data/tech';
import {
  AREA_NAME, TECH_AREAS, annualProfit, annualRevenue, annualUnits, creditLimit, devEngineersNeeded, engineerCost, factoryBuildCost, factoryFixedCost,
  lineShareUsed, researchRef, toolingCost, valuation,
} from '../sim/company';
import {
  acquire, acquisitionPrice, addLine, automationCost, buildFactory, dealerCostPerUnit, expandFactory, investDealers, maxAutomation, removeLine, repayLoan,
  sellFactory, setEngineers, setLineTarget, setMarketing, setRd, takeLoan, upgradeAutomation,
} from '../sim/actions';
import { computeMarket, fuelPrice, segVolume } from '../sim/market';
import { cpi, fmtMoney, fmtNum, MONTHS } from '../sim/util';
import { exportToFile, importFromFile, loadSlot, localSaves, type SaveMeta } from '../store/saves';
import { prepareLoadedGame } from '../sim/migrate';
import { equity, fixedAssets, inventoryValue } from '../sim/accounts';
import { BarList, Kpi, LineChart, Meter, Modal, Money, PageHead, PALETTE, Select, Slider, StatLine, Tag } from './common';
import { MAKER } from '../data/manufacturers';
import { companyStrategy } from '../sim/pricing';
import { ImpactPreview } from './Impact';
import { FactoryStages, SupplyPanel } from './Supply';
import { RESTRUCTURE, restructuringSaving } from '../sim/company';
import { startRestructuring } from '../sim/actions';

const ledgerLabels = (l: MonthLedger[]) => l.map((x) => `${MONTHS[x.m - 1]} ${String(x.y).slice(2)}`);
const yearly = (l: MonthLedger[], f: (x: MonthLedger) => number, n = 12) => l.slice(-n).reduce((a, x) => a + f(x), 0);

// -------------------------------------------------------------------------------- Factories
export function FactoriesView() {
  const { g, p } = useGame();
  const act = useStore((s) => s.act), ask = useStore((s) => s.ask);
  const [build, setBuild] = useState(false);
  const [nf, setNf] = useState({ name: '', country: p.country, capacity: 1000, automation: Math.min(0.3, maxAutomation(p)) });
  const [lineFor, setLineFor] = useState<string | null>(null);
  const [lineModel, setLineModel] = useState('');
  const [lineUnits, setLineUnits] = useState(100);
  const buildable = p.models.filter((m) => m.status === 'ready' || m.status === 'production');
  const mAuto = maxAutomation(p);
  const fac = p.factories.find((f) => f.id === lineFor);
  const selModel = buildable.find((m) => m.id === lineModel) ?? buildable[0];
  const free = fac ? Math.floor(fac.capacity * (1 - lineShareUsed(fac))) : 0;
  return (
    <>
      <PageHead title="Factories" right={<button className="btn primary" onClick={() => setBuild(true)}>+ Build a factory</button>}>
        Each plant has a monthly capacity shared between production lines. Tooling a line is a one-off investment; unit cost then falls with volume (supplier scale), cumulative output (learning curve) and automation, and rises with local wages.
      </PageHead>
      {p.factories.length === 0 && <div className="panel"><h3>No factory</h3><p className="dim">Build a plant to start production. A small craft workshop is enough for low-volume sports cars; volume cars need thousands of units a month to cover fixed costs.</p></div>}
      {p.factories.map((f) => {
        const used = lineShareUsed(f);
        return (
          <div key={f.id} className="panel col">
            <div className="row between wrap">
              <div><h3>{f.name}</h3><span className="small muted">{COUNTRY[f.country].name} · {REGION_NAME[f.region]} · since {f.builtYear}{f.disruption > 0 ? <span className="bad"> · output disrupted ({f.disruption} mo)</span> : null}</span></div>
              <div className="row wrap">
                {f.capacity > 0 && <button className="btn sm" disabled={!buildable.length} onClick={() => { setLineFor(f.id); setLineModel(buildable[0]?.id ?? ''); setLineUnits(Math.max(10, Math.min(200, Math.floor(f.capacity * (1 - used))))); }}>+ Production line</button>}
                {f.capacity > 0 && !f.expansion && <button className="btn sm" onClick={() => act((gg) => expandFactory(gg, f.id, Math.round(f.capacity * 0.5)), 'Expansion ordered.')}>Expand +50% ({fmtMoney(factoryBuildCost(f.capacity * 0.5, f.automation, g.year) * 0.85)})</button>}
                {f.capacity > 0 && f.automation < mAuto - 0.01 && <button className="btn sm" onClick={() => act((gg) => upgradeAutomation(gg, f.id, Math.min(mAuto, f.automation + 0.15)), 'Automation upgraded.')}>Automate +15% ({fmtMoney(automationCost(f.capacity, f.automation, Math.min(mAuto, f.automation + 0.15), g.year))})</button>}
                <button className="btn sm danger" onClick={() => ask(`Sell ${f.name}?`, () => { act((gg) => sellFactory(gg, f.id)); })}>Sell</button>
              </div>
            </div>
              {f.capacity > 0 && !f.expansion && <details className="small"><summary className="muted">Impact of expanding or automating (estimates)</summary>
                <div className="grid g2"><div><b className="small">Expand +50%</b><ImpactPreview deps={[f.id, f.capacity, 'x']} horizon={18} run={(gg) => expandFactory(gg, f.id, Math.round(f.capacity * 0.5))} /></div>
                  {f.automation < mAuto - 0.01 && <div><b className="small">Automate +15%</b><ImpactPreview deps={[f.id, f.automation, 'a']} horizon={12} run={(gg) => upgradeAutomation(gg, f.id, Math.min(mAuto, f.automation + 0.15))} /></div>}</div>
              </details>}
            <FactoryStages f={f} />
            <div className="grid g4">
              <Kpi label="Capacity" value={`${fmtNum(f.capacity)} / mo`} detail={f.expansion ? `+${fmtNum(f.expansion.add)} in ${f.expansion.monthsLeft} months` : undefined} />
              <Kpi label="Allocated" value={`${Math.round(used * 100)}%`} detail={<Meter value={used * 100} />} />
              <Kpi label="Automation" value={`${Math.round(f.automation * 100)}%`} detail={`max ${Math.round(mAuto * 100)}% with your technology`} />
              <Kpi label="Fixed cost" value={`${fmtMoney(factoryFixedCost(f, g.year))} / mo`} />
            </div>
            {f.lines.length > 0 && <table><thead><tr><th>Line</th><th className="r">Capacity / mo</th><th className="r">Ramp-up</th><th>Output target</th><th className="r">Unit cost</th><th /></tr></thead><tbody>
              {f.lines.map((l) => { const m = p.models.find((x) => x.id === l.modelId); if (!m) return null; const units = f.capacity * l.share; return (
                <tr key={l.modelId}><td><b>{m.name}</b></td><td className="r">{fmtNum(units)}</td><td className="r">{Math.round(l.ramp * 100)}%</td>
                  <td><Select value={l.target < 0 ? 'auto' : 'max'} options={[{ value: 'auto', label: 'Follow demand' }, { value: 'max', label: 'Full capacity' }]} onChange={(v) => act((gg) => setLineTarget(gg, f.id, m.id, v === 'auto' ? -1 : units))} /></td>
                  <td className="r">{m.lastUnitCost ? fmtMoney(m.lastUnitCost) : '—'}</td><td className="r"><button className="btn sm ghost" onClick={() => act((gg) => removeLine(gg, f.id, m.id))}>Remove</button></td></tr>); })}
            </tbody></table>}
            {f.capacity <= 0 && <p className="warn">Under construction — production can start in {f.expansion?.monthsLeft} months.</p>}
          </div>);
      })}
      {fac && selModel && (
        <Modal onClose={() => setLineFor(null)}>
          <h2>New production line at {fac.name}</h2>
          <Select label="Model" value={selModel.id} options={buildable.map((m) => ({ value: m.id, label: `${m.name}${m.status === 'ready' ? ' (new)' : ''}` }))} onChange={setLineModel} />
          <Slider label="Line capacity" value={Math.min(lineUnits, free)} min={1} max={Math.max(1, free)} onChange={setLineUnits} fmt={(v) => `${fmtNum(v)} cars / month`} />
          <StatLine label="Free capacity in this plant" value={`${fmtNum(free)} / month`} />
          <StatLine label="Tooling investment" value={fmtMoney(toolingCost(selModel, Math.min(lineUnits, free)))} />
          <StatLine label="Last monthly demand for this model" value={selModel.lastDemand ? fmtNum(selModel.lastDemand) : 'not yet on sale'} />
          <p className="small muted">The line ramps up from 30% to full rate over four months. Building in a region avoids its import tariff and cuts shipping costs.</p>
          <div className="row end"><button className="btn" onClick={() => setLineFor(null)}>Cancel</button><button className="btn primary" disabled={free < 1} onClick={() => { if (act((gg) => addLine(gg, fac.id, selModel.id, Math.min(lineUnits, free)), 'Production line tooled.')) setLineFor(null); }}>Tool the line</button></div>
        </Modal>
      )}
      {p.factories.length > 0 && <SupplyPanel />}
      {build && (
        <Modal onClose={() => setBuild(false)}>
          <h2>Build a factory</h2>
          <label className="field"><span className="lab"><span>Name</span></span><input type="text" value={nf.name} placeholder="optional" onChange={(e) => setNf({ ...nf, name: e.target.value })} /></label>
          <Select label="Country" value={nf.country} options={COUNTRIES.map((c) => ({ value: c.id, label: `${c.name} — ${REGION_NAME[c.region]}, wage ≈ $${(c.wage2020 * 1).toFixed(0)}/h in 2020 terms` }))} onChange={(v) => setNf({ ...nf, country: v })} />
          <Slider label="Capacity" value={nf.capacity} min={20} max={60000} step={nf.capacity < 500 ? 10 : nf.capacity < 5000 ? 100 : 1000} onChange={(v) => setNf({ ...nf, capacity: v })} fmt={(v) => `${fmtNum(v)} cars / month (${fmtNum(v * 12)} a year)`} />
          <Slider label="Automation" value={Math.min(nf.automation, mAuto)} min={0} max={mAuto} step={0.05} onChange={(v) => setNf({ ...nf, automation: v })} fmt={(v) => `${Math.round(v * 100)}%`} hint="Automation cuts labour hours per car but raises investment and fixed costs." />
          <StatLine label="Investment" value={<b>{fmtMoney(factoryBuildCost(nf.capacity, Math.min(nf.automation, mAuto), g.year))}</b>} />
          <StatLine label="Construction time" value="15 months" />
          <ImpactPreview deps={[nf.country, nf.capacity, nf.automation]} horizon={18} run={(gg) => buildFactory(gg, nf.name || 'New plant', nf.country, nf.capacity, Math.min(nf.automation, mAuto))} />
          <div className="row end"><button className="btn" onClick={() => setBuild(false)}>Cancel</button><button className="btn primary" onClick={() => { if (act((gg) => buildFactory(gg, nf.name, nf.country, nf.capacity, Math.min(nf.automation, mAuto)), 'Construction started.')) setBuild(false); }}>Build</button></div>
        </Modal>
      )}
    </>
  );
}

// ----------------------------------------------------------------------------------- Market
export function MarketView() {
  const { g, p } = useGame();
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
        const k = e.model.id;
        const x = by.get(k) ?? { name: e.model.name, company: e.company.name, me: e.company.isPlayer, units: 0, price: e.model.price, q: 0, n: 0 };
        x.units += e.demand; x.q += e.q; x.n++;
        by.set(k, x);
      }
    }
    return { list: [...by.values()].sort((a, b) => b.units - a.units), other, total };
  }, [mk, seg]);
  const companies = g.companies.filter((c) => c.alive && (c.models.length > 0 || c.isPlayer)).map((c) => ({ c, units: c.ledger.length ? annualUnits(c) : c.baseVolume })).sort((a, b) => b.units - a.units);
  const totalWorld = REGION_IDS.reduce((a, r) => a + SEGMENTS.reduce((s, sd) => s + segVolume(r, sd.id, g.year), 0), 0);
  const def = SEG[seg];
  return (
    <>
      <PageHead title="Market & sales">
        Demand for each model depends on how its ratings match what the segment's buyers want, its price against the segment reference, brand reputation, age, awareness, tariffs and your dealer reach in each region. Fuel price index: <b>{fuelPrice(g).toFixed(2)}</b> (1.00 = normal).
      </PageHead>
      <div className="grid g2">
        <div className="panel col">
          <div className="row between wrap"><h3>Segment: {def.name}</h3><Select value={seg} options={SEGMENTS.map((s) => ({ value: s.id, label: s.name }))} onChange={setSeg} /></div>
          <div className="row wrap small dim" style={{ gap: 14 }}><span>World demand this month: <b className="num">{fmtNum(rows.total)}</b></span><span>Reference price: <b className="num">{fmtMoney(segPrice(seg, g.year))}</b></span><span>Buyers value: {Object.entries(def.weights).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(', ')}</span></div>
          <div className="tablewrap"><table><thead><tr><th>#</th><th>Model</th><th>Maker</th><th className="r">Price</th><th className="r">Appeal</th><th className="r">Demand / mo</th><th className="r">Share</th></tr></thead><tbody>
            {rows.list.slice(0, 40).map((r, i) => <tr key={r.company + r.name} className={r.me ? 'me' : ''}><td className="muted">{i + 1}</td><td>{r.name}</td><td className="dim">{r.company}</td><td className="r">{fmtMoney(r.price)}</td><td className="r">{(r.q / r.n).toFixed(2)}</td><td className="r">{fmtNum(r.units)}</td><td className="r">{((r.units / rows.total) * 100).toFixed(1)}%</td></tr>)}
            <tr><td /><td className="muted">All other manufacturers</td><td /><td /><td /><td className="r">{fmtNum(rows.other)}</td><td className="r">{((rows.other / rows.total) * 100).toFixed(1)}%</td></tr>
          </tbody></table></div>
          <p className="tiny muted">Appeal 1.00 = an average car at the reference price. "All other manufacturers" stands for brands that are not individually simulated.</p>
        </div>
        <div className="col">
          <div className="panel col">
            <h3>Dealer network and awareness</h3>
            <table><thead><tr><th>Region</th><th className="r">Market / yr</th><th className="r">Your reach / yr</th><th className="r">Awareness</th><th>Invest in dealers</th></tr></thead><tbody>
              {REGIONS.map((r) => { const vol = SEGMENTS.reduce((s, sd) => s + segVolume(r.id, sd.id, g.year), 0); const a = amount[r.id] ?? Math.max(1e6, Math.round(p.cash * 0.05 / 1e6) * 1e6); return (
                <tr key={r.id}><td>{r.name}{r.id === p.homeRegion ? <span className="muted"> · home</span> : ''}</td><td className="r">{fmtNum(vol)}</td><td className="r">{fmtNum(p.reach[r.id])}</td><td className="r">{Math.round(p.awareness[r.id])}%</td>
                  <td><div className="row" style={{ gap: 6 }}><input type="number" style={{ width: 86 }} value={Math.round(a / 1e6)} min={1} aria-label={`Investment in ${r.name}, million`} onChange={(e) => setAmount({ ...amount, [r.id]: Number(e.target.value) * 1e6 })} /><span className="small muted">M</span>
                    <button className="btn sm" title={`≈ +${fmtNum(a / dealerCostPerUnit(g, p, r.id as RegionId))} cars / year of reach`} onClick={() => act((gg) => investDealers(gg, r.id as RegionId, a), 'Dealer network expanded.')}>Invest</button></div></td></tr>); })}
            </tbody></table>
            <Slider label="Marketing budget per month" value={p.marketingBudget} min={0} max={Math.max(2e6, annualRevenue(p) * 0.08 / 12, p.marketingBudget)} step={Math.max(1e4, Math.round(annualRevenue(p) * 0.0005 / 12 / 1e4) * 1e4)} onChange={(v) => act((gg) => setMarketing(gg, v))} fmt={(v) => `${fmtMoney(v)} (${annualRevenue(p) ? ((v * 12 / annualRevenue(p)) * 100).toFixed(1) : '0'}% of revenue)`} />
            <ImpactPreview deps={[amount]} run={(gg) => { for (const r of REGIONS) { const v = amount[r.id]; if (v) { const e = investDealers(gg, r.id as RegionId, v); if (e) return e; } } return Object.values(amount).some((v) => v) ? null : 'Enter an amount for at least one region first.'; }} />
            <p className="tiny muted">Reach is how many cars a year your dealers can move at average appeal. Awareness drifts toward a level set by marketing spend relative to revenue, prestige and racing success.</p>
          </div>
          <div className="panel col"><h3>Manufacturers</h3>
            <div className="tablewrap" style={{ maxHeight: 300 }}><table><thead><tr><th>Maker</th><th className="r">Cars / yr</th><th className="r">World share</th><th className="r">Prestige</th><th className="r">Reliability</th></tr></thead><tbody>
              {companies.map(({ c, units }) => <tr key={c.id} className={c.isPlayer ? 'me' : ''}><td><span className="row" style={{ gap: 6 }}><i className="swatch" style={{ background: c.color }} />{c.name}</span></td><td className="r">{fmtNum(units)}</td><td className="r">{((units / totalWorld) * 100).toFixed(2)}%</td><td className="r">{Math.round(c.prestige)}</td><td className="r">{Math.round(c.reliabilityRep)}</td></tr>)}
            </tbody></table></div>
          </div>
        </div>
      </div>
    </>
  );
}

// --------------------------------------------------------------------------------- Research
export function ResearchView() {
  const { g, p } = useGame();
  const act = useStore((s) => s.act);
  const ref = researchRef(g.year);
  const yNow = g.year + (g.month - 1) / 12;
  const [eng, setEng] = useState(p.engineers);
  useEffect(() => setEng(p.engineers), [p.engineers]);
  const delta = eng - p.engineers;
  return (
    <>
      <PageHead title="Research & engineering">
        Each area has a technology level expressed as a year. A technology becomes usable once the level reaches its year. Spending about {fmtMoney(ref)} a month in one area holds you roughly two years behind the calendar; four times that puts you about a year ahead. Without investment you drift back to supplier level (four years behind).
      </PageHead>
      <div className="grid g2">
        {TECH_AREAS.map((a) => {
          const lvl = p.tech[a], lead = lvl - yNow;
          const next = TECHS.filter((t) => t.area === a && t.year > lvl).sort((x, y) => x.year - y.year).slice(0, 3);
          const have = TECHS.filter((t) => t.area === a && t.year <= lvl).sort((x, y) => y.year - x.year).slice(0, 3);
          return (
            <div key={a} className="panel col">
              <div className="row between"><h3>{AREA_NAME[a]}</h3><span><b className="num">{lvl.toFixed(1)}</b> <span className={'small ' + (lead >= 0 ? 'good' : lead < -2.5 ? 'warn' : 'muted')}>({lead >= 0 ? '+' : ''}{lead.toFixed(1)} yr vs calendar)</span></span></div>
              <Slider label="Monthly budget" value={p.rdBudget[a]} min={0} max={Math.max(ref * 12, p.rdBudget[a])} step={ref / 20} onChange={(v) => act((gg) => setRd(gg, a as TechArea, v))} fmt={(v) => `${fmtMoney(v)} (${(v / ref).toFixed(1)}× keep-pace)`} />
              <div className="small"><span className="muted">Coming next: </span>{next.length ? next.map((t) => `${t.name} (${t.year})`).join(' · ') : 'nothing further in the catalogue'}</div>
              <div className="small"><span className="muted">Latest mastered: </span>{have.length ? have.map((t) => t.name).join(' · ') : '—'}</div>
            </div>);
        })}
        <div className="panel col">
          <h3>Engineering staff</h3>
          <Slider label="Engineers" value={eng} min={0} max={Math.max(400, p.engineers * 2)} step={p.engineers > 2000 ? 50 : 5} onChange={setEng} fmt={(v) => `${fmtNum(v)} (${fmtMoney(v * engineerCost(p, g.year))} / month)`} />
          <div className="row between"><span className="small dim">{delta === 0 ? 'No change' : delta > 0 ? `Hire ${delta}: recruitment costs ${fmtMoney(delta * engineerCost(p, g.year) * 2)}` : `Lay off ${-delta}: severance costs ${fmtMoney(-delta * engineerCost(p, g.year) * 3)}`}</span>
            <button className="btn sm primary" disabled={delta === 0} onClick={() => act((gg) => setEngineers(gg, eng), 'Staffing changed.')}>Apply</button></div>
          {delta !== 0 && <ImpactPreview deps={[eng]} horizon={12} run={(gg) => setEngineers(gg, eng)} />}
          <p className="small muted">Vehicle programmes share this team. Understaffed programmes run slower (down to a quarter speed); a surplus speeds them up by at most 30%.</p>
          {p.motorsport && <p className="small good">Your racing programme transfers technology to powertrain, aerodynamics and chassis research every month.</p>}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------- Finance
const COST_ROWS: [keyof MonthLedger, string][] = [['cogs', 'Cost of cars sold'], ['factoryFixed', 'Factory fixed costs'], ['wages', 'Engineers & administration'], ['dev', 'Vehicle programmes'], ['rd', 'Research'], ['marketing', 'Marketing'], ['logistics', 'Logistics & stock'], ['motorsport', 'Motorsport'], ['other', 'Dealer support'], ['oneOff', 'One-off items & write-offs'], ['depreciation', 'Depreciation (non-cash)'], ['interest', 'Interest'], ['tax', 'Tax']];
export function FinanceView() {
  const { g, p } = useGame();
  const act = useStore((s) => s.act);
  const [loan, setLoan] = useState(10);
  const led = p.ledger.slice(-60);
  const limit = creditLimit(p, g.year);
  const y = (f: keyof MonthLedger) => yearly(p.ledger, (x) => x[f] as number);
  const last = p.ledger[p.ledger.length - 1];
  return (
    <>
      <PageHead title="Finance">Money is in nominal US dollars; prices and costs inflate with the consumer price index (1.00 in 2020; {g.year} ≈ {cpi(g.year).toFixed(2)}).</PageHead>
      <div className="panel grid g4">
        <Kpi label="Cash" value={fmtMoney(p.cash)} /><Kpi label="Debt" value={fmtMoney(p.debt)} detail={`at ${(p.interestRate * 100).toFixed(1)}% a year`} />
        <Kpi label="Credit limit" value={fmtMoney(limit)} detail={p.debt - p.cash > limit ? <span className="bad">net debt above limit</span> : `${fmtMoney(Math.max(0, limit - p.debt))} still available`} />
        <Kpi label="Company valuation" value={fmtMoney(valuation(p, g.year))} detail="what a buyer would pay" />
      </div>
      <div className="grid g2">
        <div className="panel"><h3>Cash and debt</h3><LineChart series={[{ name: 'Cash', color: PALETTE[0], values: led.map((x) => x.cash) }, { name: 'Debt', color: PALETTE[1], values: led.map((x) => x.debt) }]} labels={ledgerLabels(led)} fmt={(v) => fmtMoney(v)} /></div>
        <div className="panel"><h3>Net profit per month</h3><LineChart series={[{ name: 'Net profit', color: PALETTE[2], values: led.map((x) => x.profit) }]} labels={ledgerLabels(led)} fmt={(v) => fmtMoney(v)} /></div>
      </div>
      <div className="grid g2">
        <div className="panel col">
          <h3>Income statement</h3>
          <table><thead><tr><th>Item</th><th className="r">Last month</th><th className="r">Last 12 months</th></tr></thead><tbody>
            <tr><td><b>Revenue</b></td><td className="r">{fmtMoney(last?.revenue ?? 0)}</td><td className="r">{fmtMoney(y('revenue'))}</td></tr>
            <tr><td className="dim">+ Other income (grants, prizes, fleet sales)</td><td className="r">{fmtMoney(last?.otherIncome ?? 0)}</td><td className="r">{fmtMoney(y('otherIncome'))}</td></tr>
            <tr><td className="dim">+ Gains / losses on assets</td><td className="r">{fmtMoney(last?.assetGains ?? 0)}</td><td className="r">{fmtMoney(y('assetGains'))}</td></tr>
            {COST_ROWS.map(([k, label]) => <tr key={k}><td className="dim">− {label}</td><td className="r">{fmtMoney((last?.[k] as number) ?? 0)}</td><td className="r">{fmtMoney(y(k))}</td></tr>)}
            <tr><td><b>Net profit</b></td><td className={'r ' + ((last?.profit ?? 0) < 0 ? 'bad' : 'good')}><b>{fmtMoney(last?.profit ?? 0)}</b></td><td className={'r ' + (y('profit') < 0 ? 'bad' : 'good')}><b>{fmtMoney(y('profit'))}</b></td></tr>
          </tbody></table>
        </div>
        <div className="col">
          <div className="panel col"><h3>Where the money went (12 months)</h3><BarList items={COST_ROWS.map(([k, label], i) => ({ label, value: Math.max(0, y(k)), color: PALETTE[i % PALETTE.length] })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value)} fmt={(v) => fmtMoney(v)} /></div>
          <div className="panel col"><h3>Balance sheet</h3>
            <StatLine label="Cash" value={fmtMoney(p.cash)} />
            <StatLine label="Inventory (cars in stock, at cost)" value={fmtMoney(inventoryValue(p))} />
            <StatLine label="Plants, tooling, dealers, facilities (book value)" value={fmtMoney(fixedAssets(p))} />
            <StatLine label="− Debt" value={fmtMoney(p.debt)} />
            <StatLine label={<b>Equity</b>} value={<b className={equity(p) < 0 ? 'bad' : ''}>{fmtMoney(equity(p))}</b>} />
          </div>
          <div className="panel col"><h3>Cash flow (12 months)</h3>
            <StatLine label="Operating" value={<Money v={y('operatingCash')} sign />} title="Net profit + depreciation − non-cash gains − increase in inventory" />
            <StatLine label="  of which: cars built (into stock)" value={fmtMoney(y('production'))} />
            <StatLine label="Investing" value={<Money v={y('investingCash')} sign />} title="Plants, tooling, dealer networks, facilities and acquisitions, less asset sales" />
            <StatLine label="Financing" value={<Money v={y('financingCash')} sign />} title="Borrowing less repayments, including automatic overdraft" />
            <StatLine label={<b>Change in cash</b>} value={<b><Money v={y('operatingCash') + y('investingCash') + y('financingCash')} sign /></b>} />
          </div>
          <div className="panel col"><h3>Borrowing</h3>
            <div className="row wrap"><input type="number" value={loan} min={1} style={{ width: 110 }} aria-label="Loan amount in millions" onChange={(e) => setLoan(Number(e.target.value))} /><span className="muted">million</span>
              <button className="btn" onClick={() => act((gg) => takeLoan(gg, loan * 1e6), 'Loan drawn.')}>Borrow</button><button className="btn" onClick={() => act((gg) => repayLoan(gg, loan * 1e6), 'Debt repaid.')}>Repay</button>
              <button className="btn ghost" onClick={() => act((gg) => repayLoan(gg, p.debt), 'Debt repaid.')}>Repay all possible</button></div>
            <ImpactPreview deps={[loan]} horizon={12} run={(gg) => takeLoan(gg, loan * 1e6)} />
            <p className="small muted">Lenders extend up to half a year's revenue plus 60% of the value of your plants. If net debt stays more than 25% above the limit, creditors force insolvency. A cash shortfall is covered automatically by overdraft.</p>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------- Company
function StrategyPanel() {
  const { g, p } = useGame();
  const act = useStore((s) => s.act), ask = useStore((s) => s.ask);
  const st = companyStrategy(p);
  const saving = restructuringSaving(g, p), upfront = saving * RESTRUCTURE.upfrontYears;
  return (
    <div className="grid g2">
      <div className="panel col"><h3>Identity: {st.title} <Tag kind="e" title="Estimated game data">est.</Tag></h3>
        <p className="small dim">{st.summary}</p>
        <StatLine label="Strengths" value={st.strengths.join(' · ')} /><StatLine label="Risks" value={st.risks.join(' · ')} />
        <p className="tiny muted">Rival manufacturers follow their own identities: how they price, how readily they follow a price cut, how often they renew a model and what they do after a bad year.</p>
      </div>
      <div className="panel col"><h3>Restructuring</h3>
        {p.restructuring ? <p className="small">Programme under way: {p.restructuring} months left. Overheads {Math.round(RESTRUCTURE.overheadCut * 100)}% and plant fixed costs {Math.round(RESTRUCTURE.fixedCut * 100)}% lower.</p> : <>
          <StatLine label="Up-front cost (severance, consultants)" value={fmtMoney(upfront)} />
          <StatLine label="Estimated saving" value={`${fmtMoney(saving)} / year for ${RESTRUCTURE.months / 12} years`} />
          <StatLine label="Estimated payback" value={saving > 0 ? `${Math.round((upfront / saving) * 12)} months` : '—'} />
          <StatLine label="Risk" value={`reliability reputation −${RESTRUCTURE.reputation} (disruption)`} />
          <p className="tiny muted">Estimates at the company's current size. For a deeper cut, also reduce engineers, research, marketing or plants — each saves money now and costs capability later.</p>
          <div className="row"><button className="btn" disabled={!(saving > 0)} onClick={() => ask(`Start a restructuring programme? It costs about ${fmtMoney(upfront)} now and should save about ${fmtMoney(saving)} a year (estimate).`, () => act((gg) => startRestructuring(gg), 'Restructuring programme started.'))}>Start restructuring</button></div>
        </>}
      </div>
    </div>
  );
}

export function CompanyView() {
  const { g, p } = useGame();
  const act = useStore((s) => s.act), ask = useStore((s) => s.ask);
  const rivals = g.companies.filter((c) => c.alive && !c.isPlayer && c.models.length).sort((a, b) => valuation(a, g.year) - valuation(b, g.year));
  return (
    <>
      <PageHead title="Company & board">Strategy, reputation, the board's expectations and acquisitions.</PageHead>
      <div className="grid g2">
        <div className="panel col"><h3>Brand</h3>
          <BarList items={[{ label: 'Prestige', value: p.prestige }, { label: 'Reliability reputation', value: p.reliabilityRep, color: 'var(--s3)' }, { label: 'Sporting image', value: p.sportiness, color: 'var(--s2)' }, { label: 'Racing halo', value: p.msGlow, color: 'var(--s4)' }]} fmt={(v) => v.toFixed(0)} />
          <p className="small muted">Prestige and reliability drift toward the revenue-weighted ratings of the cars you actually sell. Racing success adds a halo that fades unless renewed.</p>
          <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={p.autoPrice} onChange={(e) => act((gg) => { gg.companies.find((c) => c.id === gg.playerId)!.autoPrice = e.target.checked; })} /> Index list prices to inflation every January</label>
        </div>
        <div className="panel col"><h3>{p.board ? 'The board' : 'Ownership'}</h3>
          {p.board ? <>
            <div className="row between"><span>Confidence in you</span><b className="num">{Math.round(p.board.confidence)}%</b></div><Meter value={p.board.confidence} color={p.board.confidence < 30 ? 'var(--bad)' : 'var(--good)'} />
            <p className="small dim">{p.board.note}</p>
            {p.board.objectives.map((o) => <div key={o.id} className="statline"><span className={o.done ? 'good' : o.failed ? 'bad' : ''}>{o.done ? '✓ ' : o.failed ? '✗ ' : ''}{o.text}</span><span className="muted">by {o.byYear}</span></div>)}
            <p className="tiny muted">Monthly profits raise confidence slowly, losses lower it faster. Objectives are reviewed every January. At 0% you are dismissed.</p>
          </> : <p className="dim">You founded {p.name} and answer to nobody — except your creditors. The company fails if net debt stays above the credit limit.</p>}
          {p.dataId && MAKER[p.dataId]?.eras.map((e) => <div key={e.from} className="small"><Tag kind="h">{e.from}–{e.to > 2090 ? 'today' : e.to}</Tag> <span className="dim">{e.text}</span></div>)}
        </div>
      </div>
      <StrategyPanel />
      <div className="panel col"><h3>Acquisitions</h3>
        <p className="small muted">Buying a competitor (30% premium over valuation) brings its plants, dealer network, engineers, technology and model range into your company. Its cars become yours to build, redesign or retire.</p>
        <div className="tablewrap" style={{ maxHeight: 380 }}><table><thead><tr><th>Company</th><th>Country</th><th className="r">Cars / yr</th><th className="r">Revenue / yr</th><th className="r">Profit / yr</th><th className="r">Prestige</th><th className="r">Price</th><th /></tr></thead><tbody>
          {rivals.map((c) => { const price = acquisitionPrice(c, g.year); return (
            <tr key={c.id}><td><span className="row" style={{ gap: 6 }}><i className="swatch" style={{ background: c.color }} /><b>{c.name}</b></span></td><td className="dim">{c.country}</td><td className="r">{fmtNum(annualUnits(c))}</td><td className="r">{fmtMoney(annualRevenue(c))}</td><td className="r">{fmtMoney(annualProfit(c))}</td><td className="r">{Math.round(c.prestige)}</td><td className="r">{fmtMoney(price)}</td>
              <td className="r"><button className="btn sm" disabled={price > p.cash + Math.max(0, creditLimit(p, g.year) - p.debt)} onClick={() => ask(`Acquire ${c.name} for ${fmtMoney(price)}?`, () => { act((gg) => acquire(gg, c.id), `${c.name} acquired.`); })}>Acquire</button></td></tr>); })}
        </tbody></table></div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------------------------- News
export function NewsView() {
  const { g } = useGame();
  const [kind, setKind] = useState('all');
  const list = g.news.filter((n) => kind === 'all' || n.kind === kind);
  return (
    <>
      <PageHead title="News & world" right={<Select value={kind} options={[{ value: 'all', label: 'Everything' }, { value: 'historical', label: 'Historical events' }, { value: 'world', label: 'World economy' }, { value: 'company', label: 'Company' }, { value: 'market', label: 'Competitors' }, { value: 'motorsport', label: 'Motorsport' }, { value: 'finance', label: 'Finance' }]} onChange={setKind} />}>
        {g.historyMode === 'historical' ? 'Historical events arrive on their real dates; their effects on the industry are simplified estimates.' : 'Alternative history: real events may be missing, shifted or changed in strength — each item notes its real date.'}
      </PageHead>
      {g.macro.modifiers.length > 0 && <div className="panel col" style={{ gap: 4 }}><h4>Active world conditions</h4>
        {g.macro.modifiers.map((m) => <div key={m.id} className="statline"><span>{m.label}</span><span className="muted small">{[m.demandAll && `demand ×${m.demandAll.toFixed(2)}`, m.fuelPrice && `fuel ×${m.fuelPrice.toFixed(2)}`, m.materialCost && `materials ×${m.materialCost.toFixed(2)}`, m.productionAll && `production ×${m.productionAll.toFixed(2)}`, m.interest && `interest ${m.interest > 0 ? '+' : ''}${(m.interest * 100).toFixed(1)} pts`, m.demand && Object.entries(m.demand).map(([k, v]) => `${k} demand ×${(v as number).toFixed(2)}`).join(', '), m.segment && Object.entries(m.segment).map(([k, v]) => `${k} ×${(v as number).toFixed(2)}`).join(', '), m.importPenalty && Object.entries(m.importPenalty).map(([k, v]) => `imports into ${k} ×${(v as number).toFixed(2)}`).join(', '), m.evDemand && `EV demand ×${m.evDemand.toFixed(2)}`, m.motorsportCost && `racing costs ×${m.motorsportCost.toFixed(2)}`].filter(Boolean).join(' · ')} · {m.monthsLeft} mo left</span></div>)}
      </div>}
      <div className="panel">
        {list.length === 0 && <p className="muted">Nothing yet.</p>}
        {list.map((n, i) => (
          <div key={i} className="news-item">
            <div className="row between wrap"><b>{n.title}</b><span className="row" style={{ gap: 6 }}>{n.tag && <Tag kind={n.tag === 'historical' ? 'h' : n.tag === 'generated' ? 'e' : n.tag.startsWith('alternative') ? 'a' : undefined}>{n.tag === 'generated' ? 'generated event' : n.tag}</Tag>}<span className="small muted">{MONTHS[n.m - 1]} {n.y}</span></span></div>
            <div className="dim">{n.body}</div>
          </div>))}
      </div>
    </>
  );
}

// ------------------------------------------------------------------------------------ Saves
export function SavesView() {
  const { g, p } = useGame();
  const start = useStore((s) => s.start), notify = useStore((s) => s.notify), save = useStore((s) => s.save);
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [slot, setSlot] = useState(`${p.name} ${g.year}`);
  const [paste, setPaste] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const refresh = () => localSaves.list().then(setSaves).catch(() => setSaves([]));
  useEffect(() => { void refresh(); }, []);
  return (
    <>
      <PageHead title="Save / load">Games are stored in this browser's IndexedDB — no account or server. The game autosaves every month. Export a save file to back it up or move it to another computer.</PageHead>
      <div className="panel row wrap">
        <input type="text" value={slot} onChange={(e) => setSlot(e.target.value)} aria-label="Save name" style={{ minWidth: 240 }} />
        <button className="btn primary" onClick={async () => { await save(slot.trim() || 'manual'); notify('Game saved.'); void refresh(); }}>Save game</button>
        <button className="btn" onClick={() => exportToFile(g)}>Export to file</button>
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { start(await importFromFile(f)); notify('Save imported.'); } catch (err) { notify((err as Error).message, true); } e.target.value = ''; }} />
        <button className="btn" onClick={() => file.current?.click()}>Import from file…</button>
        <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(JSON.stringify(g)); notify('Save copied to the clipboard.'); } catch { notify('The browser refused clipboard access. Use Export to file instead.', true); } }}>Copy save to clipboard</button>
        <button className="btn" onClick={() => setPaste('')}>Paste a save…</button>
      </div>
      <p className="small muted">Some embedded viewers block file downloads; the clipboard buttons move a save between browsers without a file.</p>
      {paste !== null && <Modal onClose={() => setPaste(null)}><h3>Paste a save</h3><textarea id="paste-save" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste the copied save text here" style={{ minHeight: 160, background: 'var(--bg2)', color: 'var(--ink)', border: '1px solid var(--line2)', borderRadius: 8, padding: 8, font: '12px ui-monospace, monospace' }} />
        <div className="row end"><button className="btn" onClick={() => setPaste(null)}>Cancel</button><button className="btn primary" disabled={!paste.trim()} onClick={() => { try { let raw: unknown; try { raw = JSON.parse(paste); } catch { throw new Error('This text is not an Automotive Empire save.'); } const x = prepareLoadedGame(raw); setPaste(null); start(x); notify('Save loaded.'); } catch (err) { notify((err as Error).message, true); } }}>Load</button></div></Modal>}
      <div className="panel flush"><table><thead><tr><th>Save</th><th>Company</th><th>Date</th><th className="r">Cash</th><th>Saved</th><th /></tr></thead><tbody>
        {saves.map((s) => <tr key={s.slot}><td><b>{s.slot}</b></td><td>{s.company}</td><td>{MONTHS[s.month - 1]} {s.year}</td><td className="r">{fmtMoney(s.cash)}</td><td className="muted">{new Date(s.savedAt).toLocaleString()}</td>
          <td className="r"><button className="btn sm" onClick={async () => { try { start(await loadSlot(s.slot)); notify('Game loaded.'); } catch (err) { notify((err as Error).message, true); } }}>Load</button> <button className="btn sm ghost" onClick={async () => { await localSaves.remove(s.slot); void refresh(); }}>Delete</button></td></tr>)}
        {saves.length === 0 && <tr><td colSpan={6} className="muted">No saves yet.</td></tr>}
      </tbody></table></div>
    </>
  );
}
