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
import { RESTRUCTURE, restructuringSaving } from '../sim/company';
import { startRestructuring } from '../sim/actions';

const ledgerLabels = (l: MonthLedger[]) => l.map((x) => `${MONTHS[x.m - 1]} ${String(x.y).slice(2)}`);
const yearly = (l: MonthLedger[], f: (x: MonthLedger) => number, n = 12) => l.slice(-n).reduce((a, x) => a + f(x), 0);

// -------------------------------------------------------------------------------- Factories
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
