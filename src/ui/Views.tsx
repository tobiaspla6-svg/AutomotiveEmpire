// Company & board, News & world and Save / load, in the shared design system and both languages.
import { useEffect, useRef, useState } from 'react';
import { useGame, useStore } from '../store/game';
import { useT, type MessageKey } from '../i18n';
import { useTerm } from '../i18n/terms';
import { dateTime, money, monthYear, num } from '../i18n/format';
import { COUNTRY } from '../data/world';
import { RESTRUCTURE, annualProfit, annualRevenue, annualUnits, creditLimit, restructuringSaving, valuation } from '../sim/company';
import { acquire, acquisitionPrice, startRestructuring } from '../sim/actions';
import { exportToFile, importFromFile, loadSlot, localSaves, type SaveMeta } from '../store/saves';
import { prepareLoadedGame } from '../sim/migrate';
import { Meter, Modal, PageHead, Select, StatLine, Tag } from './common';
import { MAKER } from '../data/manufacturers';
import { companyStrategy } from '../sim/pricing';
import { Icon } from './ds/icons';
import { EmptyState, HBar, Panel } from './ds/primitives';

const k = (s: string) => s as MessageKey;

// ---------------------------------------------------------------------------------- Company
function StrategyPanel() {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const act = useStore((s) => s.act), ask = useStore((s) => s.ask);
  const st = companyStrategy(p);
  const saving = restructuringSaving(g, p), upfront = saving * RESTRUCTURE.upfrontYears;
  const m$ = (v: number) => money(v, lang);
  return (
    <div className="corp-two">
      <Panel eyebrow={t('co.identity')} title={<>{st.title} <Tag kind="e" title={t('co.estimated')}>{t('tag.estimate')}</Tag></>}>
        <p className="small dim">{st.summary}</p>
        <StatLine label={t('co.strengths')} value={st.strengths.join(' · ')} /><StatLine label={t('co.risks')} value={st.risks.join(' · ')} />
        <p className="tiny muted" style={{ marginTop: 6 }}>{t('co.identity.note')}</p>
      </Panel>
      <Panel eyebrow={t('co.restructure')} title={t('co.restructure.title')}>
        {p.restructuring ? <p className="small">{t('co.restructure.running', { n: p.restructuring, overhead: Math.round(RESTRUCTURE.overheadCut * 100), fixed: Math.round(RESTRUCTURE.fixedCut * 100) })}</p> : <>
          <StatLine label={t('co.restructure.upfront')} value={m$(upfront)} />
          <StatLine label={t('co.restructure.saving')} value={t('co.restructure.savingFmt', { v: m$(saving), years: RESTRUCTURE.months / 12 })} />
          <StatLine label={t('co.restructure.payback')} value={saving > 0 ? t('st.months', { n: Math.round((upfront / saving) * 12) }) : '—'} />
          <StatLine label={t('co.restructure.risk')} value={t('co.restructure.riskFmt', { n: RESTRUCTURE.reputation })} />
          <p className="tiny muted">{t('co.restructure.note')}</p>
          <div className="row" style={{ marginTop: 6 }}><button className="btn" data-action="restructure" disabled={!(saving > 0)} onClick={() => ask(t('co.restructure.confirm', { upfront: m$(upfront), saving: m$(saving), n: RESTRUCTURE.reputation }), () => act((gg) => startRestructuring(gg), t('co.restructure.started')))}>{t('co.restructure.go')}</button></div>
        </>}
      </Panel>
    </div>
  );
}

export function CompanyView() {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const term = useTerm();
  const act = useStore((s) => s.act), ask = useStore((s) => s.ask);
  const rivals = g.companies.filter((c) => c.alive && !c.isPlayer && c.models.length).sort((a, b) => valuation(a, g.year) - valuation(b, g.year));
  const m$ = (v: number) => money(v, lang);
  const funds = p.cash + Math.max(0, creditLimit(p, g.year) - p.debt);
  const brand = [{ label: t('score.prestige'), value: p.prestige, color: 'var(--accent)' }, { label: t('co.brand.reliability'), value: p.reliabilityRep, color: 'var(--s3)' }, { label: t('co.brand.sporting'), value: p.sportiness, color: 'var(--s2)' }, { label: t('co.brand.halo'), value: p.msGlow, color: 'var(--s1)' }];
  return (
    <div className="corp">
      <PageHead title={t('nav.company')}>{t('co.sub')}</PageHead>
      <div className="corp-two">
        <Panel eyebrow={t('co.brand')} title={t('co.brand.title')}>
          <div className="col" style={{ gap: 7 }}>{brand.map((x) => <HBar key={x.label} label={x.label} value={x.value} max={100} color={x.color} right={x.value.toFixed(0)} />)}</div>
          <p className="small muted" style={{ margin: '8px 0' }}>{t('co.brand.note')}</p>
          <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={p.autoPrice} onChange={(e) => act((gg) => { gg.companies.find((c) => c.id === gg.playerId)!.autoPrice = e.target.checked; })} /> {t('co.autoPrice')}</label>
        </Panel>
        <Panel eyebrow={t(p.board ? 'co.board' : 'co.ownership')} title={t(p.board ? 'co.board.title' : 'co.ownership.title')}>
          {p.board ? <>
            <div className="row between"><span>{t('co.board.confidence')}</span><b className="num">{Math.round(p.board.confidence)}%</b></div><Meter value={p.board.confidence} color={p.board.confidence < 30 ? 'var(--bad)' : 'var(--good)'} />
            <p className="small dim" style={{ margin: '6px 0' }}>{p.board.note}</p>
            {p.board.objectives.map((o) => <div key={o.id} className="statline"><span className={o.done ? 'good' : o.failed ? 'bad' : ''}>{o.done ? '✓ ' : o.failed ? '✗ ' : ''}{o.text}</span><span className="muted">{t('dash.by', { year: o.byYear })}</span></div>)}
            <p className="tiny muted" style={{ marginTop: 6 }}>{t('co.board.note')}</p>
          </> : <p className="dim">{t('co.ownership.body', { name: p.name })}</p>}
          {p.dataId && MAKER[p.dataId]?.eras.map((e) => <div key={e.from} className="small" style={{ marginTop: 4 }}><Tag kind="h">{e.from}–{e.to > 2090 ? t('setup.today') : e.to}</Tag> <span className="dim">{e.text}</span></div>)}
        </Panel>
      </div>
      <StrategyPanel />
      <Panel eyebrow={t('co.acq')} title={t('co.acq.title')}>
        <p className="small muted">{t('co.acq.note', { funds: m$(funds) })}</p>
        <div className="tablewrap" style={{ maxHeight: 380 }}><table><thead><tr><th>{t('co.acq.company')}</th><th>{t('fac.new.country')}</th><th className="r">{t('co.acq.cars')}</th><th className="r">{t('co.acq.revenue')}</th><th className="r">{t('co.acq.profit')}</th><th className="r">{t('score.prestige')}</th><th className="r">{t('veh.col.price')}</th><th /></tr></thead><tbody>
          {rivals.map((c) => { const price = acquisitionPrice(c, g.year); return (
            <tr key={c.id}><td><span className="row" style={{ gap: 6 }}><i className="swatch" style={{ background: c.color }} /><b>{c.name}</b></span></td><td className="dim">{term(COUNTRY[c.country]?.name ?? c.country)}</td><td className="r">{num(annualUnits(c), lang)}</td><td className="r">{m$(annualRevenue(c))}</td><td className="r">{m$(annualProfit(c))}</td><td className="r">{Math.round(c.prestige)}</td><td className="r">{m$(price)}</td>
              <td className="r"><button className="btn sm" data-action="acquire" disabled={price > funds} title={price > funds ? t('co.acq.cannot') : undefined} onClick={() => ask(t('co.acq.confirm', { name: c.name, price: m$(price), cash: m$(p.cash), debt: m$(Math.max(0, price - p.cash)) }), () => { act((gg) => acquire(gg, c.id), t('co.acq.done', { name: c.name })); })}>{t('co.acq.go')}</button></td></tr>); })}
        </tbody></table></div>
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------------------------- News
const NEWS_KINDS = ['all', 'historical', 'world', 'company', 'market', 'motorsport', 'finance'] as const;
export function NewsView() {
  const { g } = useGame();
  const { t, lang } = useT();
  const [kind, setKind] = useState<string>('all');
  const list = g.news.filter((n) => kind === 'all' || n.kind === kind);
  const fx = (m: (typeof g.macro.modifiers)[number]) => [
    m.demandAll && t('news.fx.demand', { x: m.demandAll.toFixed(2) }), m.fuelPrice && t('news.fx.fuel', { x: m.fuelPrice.toFixed(2) }), m.materialCost && t('news.fx.materials', { x: m.materialCost.toFixed(2) }),
    m.productionAll && t('news.fx.production', { x: m.productionAll.toFixed(2) }), m.interest && t('news.fx.interest', { x: `${m.interest > 0 ? '+' : ''}${(m.interest * 100).toFixed(1)}` }),
    m.demand && Object.entries(m.demand).map(([r, v]) => `${r} ×${(v as number).toFixed(2)}`).join(', '), m.segment && Object.entries(m.segment).map(([s, v]) => `${s} ×${(v as number).toFixed(2)}`).join(', '),
    m.importPenalty && Object.entries(m.importPenalty).map(([r, v]) => t('news.fx.imports', { r, x: (v as number).toFixed(2) })).join(', '), m.evDemand && t('news.fx.ev', { x: m.evDemand.toFixed(2) }), m.motorsportCost && t('news.fx.racing', { x: m.motorsportCost.toFixed(2) }),
  ].filter(Boolean).join(' · ');
  return (
    <div className="corp">
      <PageHead title={t('nav.news')} right={<Select value={kind} options={NEWS_KINDS.map((x) => ({ value: x as string, label: t(k(`news.kind.${x}`)) }))} onChange={setKind} />}>{t(g.historyMode === 'historical' ? 'news.sub.historical' : 'news.sub.alternative')}</PageHead>
      {g.macro.modifiers.length > 0 && <Panel eyebrow={t('dash.conditions')} title={t('news.conditions')}>
        {g.macro.modifiers.map((m) => <div key={m.id} className="statline"><span>{m.label}</span><span className="muted small">{fx(m)} · {t('fac.monthsLeft', { n: m.monthsLeft })}</span></div>)}
      </Panel>}
      <div className="panel">
        {list.length === 0 && <EmptyState icon="news" title={t('news.none')} />}
        {list.map((n, i) => (
          <div key={i} className="news-item">
            <div className="row between wrap"><b>{n.title}</b><span className="row" style={{ gap: 6 }}>{n.tag && <Tag kind={n.tag === 'historical' ? 'h' : n.tag === 'generated' ? 'e' : n.tag.startsWith('alternative') ? 'a' : undefined}>{n.tag === 'generated' ? t('news.generated') : n.tag === 'historical' ? t('tag.historical') : n.tag}</Tag>}<span className="small muted">{monthYear(n.m, n.y, lang)}</span></span></div>
            <div className="dim">{n.body}</div>
          </div>))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------ Saves
export function SavesView() {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const start = useStore((s) => s.start), notify = useStore((s) => s.notify), save = useStore((s) => s.save), ask = useStore((s) => s.ask);
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [slot, setSlot] = useState(`${p.name} ${g.year}`);
  const [paste, setPaste] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const refresh = () => localSaves.list().then((l) => setSaves([...l].sort((a, b) => b.savedAt - a.savedAt))).catch(() => setSaves([]));
  useEffect(() => { void refresh(); }, []);
  const doSave = async () => { const name = slot.trim() || 'manual'; const write = async () => { await save(name); notify(t('top.saved')); void refresh(); }; if (saves.some((s) => s.slot === name && name !== 'autosave')) ask(t('save.confirmOverwrite', { name }), () => { void write(); }); else await write(); };
  const load = (s: SaveMeta) => ask(t('save.confirmLoad', { name: s.slot }), async () => { try { start(await loadSlot(s.slot)); notify(t('save.loaded')); } catch (err) { notify((err as Error).message, true); } });
  return (
    <div className="corp">
      <PageHead title={t('nav.saves')}>{t('save.sub')}</PageHead>
      <Panel eyebrow={t('save.this')} title={t('save.this.title')}>
        <div className="row wrap" style={{ gap: 8 }}>
          <input type="text" value={slot} onChange={(e) => setSlot(e.target.value)} aria-label={t('save.name')} style={{ minWidth: 240 }} />
          <button className="btn primary" data-action="save-game" onClick={() => { void doSave(); }}><Icon name="save" size={15} />{t('top.save')}</button>
          <button className="btn" onClick={() => exportToFile(g)}><Icon name="upload" size={15} style={{ transform: 'rotate(180deg)' }} />{t('save.export')}</button>
          <input ref={file} type="file" accept=".json,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { start(await importFromFile(f)); notify(t('save.imported')); } catch (err) { notify((err as Error).message, true); } e.target.value = ''; }} />
          <button className="btn" onClick={() => file.current?.click()}><Icon name="upload" size={15} />{t('menu.import')}</button>
          <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(JSON.stringify(g)); notify(t('save.copied')); } catch { notify(t('save.clipboardRefused'), true); } }}>{t('save.copy')}</button>
          <button className="btn" onClick={() => setPaste('')}>{t('save.paste')}</button>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>{t('save.clipboardNote')}</p>
      </Panel>
      {paste !== null && <Modal onClose={() => setPaste(null)}><h3>{t('save.paste.title')}</h3><textarea id="paste-save" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={t('save.paste.ph')} aria-label={t('save.paste.title')} style={{ minHeight: 160, background: 'var(--bg2)', color: 'var(--ink)', border: '1px solid var(--line2)', borderRadius: 8, padding: 8, font: '12px ui-monospace, monospace' }} />
        <div className="row end"><button className="btn" onClick={() => setPaste(null)}>{t('confirm.cancel')}</button><button className="btn primary" disabled={!paste.trim()} onClick={() => { try { let raw: unknown; try { raw = JSON.parse(paste); } catch { throw new Error(t('save.notASave')); } const x = prepareLoadedGame(raw); setPaste(null); start(x); notify(t('save.loaded')); } catch (err) { notify((err as Error).message, true); } }}>{t('menu.load')}</button></div></Modal>}
      <Panel eyebrow={t('save.list')} title={t('save.list.title')} pad={false} className="range-table">
        <div className="tablewrap"><table><thead><tr><th>{t('save.col.save')}</th><th>{t('co.acq.company')}</th><th>{t('top.date')}</th><th className="r">{t('top.cash')}</th><th>{t('save.col.saved')}</th><th /></tr></thead><tbody>
          {saves.map((s) => <tr key={s.slot} data-save={s.slot}><td><b>{s.slot}</b></td><td>{s.company}</td><td>{monthYear(s.month, s.year, lang)}</td><td className="r">{money(s.cash, lang)}</td><td className="muted">{dateTime(s.savedAt, lang)}</td>
            <td className="r" style={{ whiteSpace: 'nowrap' }}><button className="btn sm" data-action="load-save" onClick={() => load(s)}>{t('menu.load')}</button> <button className="btn sm ghost" data-action="delete-save" onClick={() => ask(t('menu.save.confirmDelete', { name: s.slot }), async () => { await localSaves.remove(s.slot); void refresh(); })}>{t('save.delete')}</button></td></tr>)}
          {saves.length === 0 && <tr><td colSpan={6} className="muted">{t('save.none')}</td></tr>}
        </tbody></table></div>
      </Panel>
    </div>
  );
}
