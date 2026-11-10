import { useEffect } from 'react';
import { useGame, useStore } from '../store/game';
import { dateLabel } from '../sim/world';
import { pendingRound } from '../sim/racing/season';
import { fmtMoney } from '../sim/util';
import { Modal } from './common';
import { CompanyView, DashboardView, FactoriesView, FinanceView, MarketView, NewsView, ResearchView, SavesView } from './Views';
import { VehiclesView } from './Vehicles';
import { MotorsportView } from './Motorsport';

export function Shell() {
  const { g, p } = useGame();
  const view = useStore((s) => s.view), setView = useStore((s) => s.setView), advance = useStore((s) => s.advance), go = useStore((s) => s.go), busy = useStore((s) => s.busy), decide = useStore((s) => s.decide), quit = useStore((s) => s.quit), save = useStore((s) => s.save), notify = useStore((s) => s.notify);
  const race = pendingRound(g, p);
  const last = p.ledger[p.ledger.length - 1];
  const ms = g.mode === 'motorsport';
  const ready = p.models.filter((m) => m.status === 'ready').length;
  const nav: [string, string, boolean?][] = ms
    ? [['motorsport', 'Team headquarters', !!race], ['finance', 'Finance'], ['news', 'News & world'], ['saves', 'Save / load']]
    : [['dashboard', 'Dashboard'], ['vehicles', 'Vehicles', ready > 0], ['factories', 'Factories', ready > 0], ['market', 'Market & sales'], ['research', 'Research'], ['finance', 'Finance'], ['motorsport', 'Motorsport', !!race], ['company', 'Company & board'], ['news', 'News & world'], ['saves', 'Save / load']];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLButtonElement)) { e.preventDefault(); if (!race) advance(1); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, race]);
  return (
    <div className="shell">
      <header className="topbar">
        <div className="who"><i className="badge" style={{ background: `linear-gradient(135deg, ${p.color} 55%, ${p.color2} 55%)` }} /><b>{p.name}</b></div>
        <div className="stat"><span className="l">Date</span><span className="v">{dateLabel(g)}</span></div>
        <div className="stat"><span className="l">Cash</span><span className="v">{fmtMoney(p.cash)}</span></div>
        <div className="stat"><span className="l">Debt</span><span className={'v' + (p.troubleMonths > 0 ? ' bad' : '')}>{fmtMoney(p.debt)}</span></div>
        {last && <div className="stat"><span className="l">Last month</span><span className={'v ' + (last.profit >= 0 ? 'good' : 'bad')}>{last.profit >= 0 ? '+' : ''}{fmtMoney(last.profit)}</span></div>}
        {p.board && <div className="stat"><span className="l">{ms ? 'Owner confidence' : 'Board confidence'}</span><span className={'v ' + (p.board.confidence < 25 ? 'bad' : p.board.confidence < 45 ? 'warn' : '')}>{Math.round(p.board.confidence)}%</span></div>}
        <div className="grow" />
        <button className="btn sm ghost" onClick={async () => { await save(`${p.name} ${g.year}`); notify('Game saved.'); }}>Save</button>
        <button className="btn sm ghost" onClick={() => { void save('autosave'); quit(); }}>Main menu</button>
        {race ? <button className="btn primary" onClick={() => go('race')}>Race weekend: {race.name} →</button>
          : <><button className="btn" disabled={busy || !!g.gameOver} onClick={() => advance(3)} title="Advance three months (stops for decisions)">+3 months</button>
            <button className="btn primary" disabled={busy || !!g.gameOver} onClick={() => advance(1)} title="Space bar">{busy ? 'Working…' : 'Next month →'}</button></>}
      </header>
      <nav className="nav" aria-label="Sections">
        {nav.map(([id, label, dot]) => <button key={id} className={view === id ? 'on' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>{label}{dot && <i className="dot" />}</button>)}
        <div className="sep" />
        <div className="small muted" style={{ padding: '4px 11px' }}>{g.mode === 'ceo' ? 'Historical CEO' : g.mode === 'founder' ? 'Company Founder' : 'Motorsport Director'} · {g.historyMode === 'historical' ? 'historical timeline' : 'alternative history'} · {g.difficulty}</div>
        {g.macro.modifiers.length > 0 && <div className="small" style={{ padding: '4px 11px' }}><span className="muted">World conditions</span>{g.macro.modifiers.slice(0, 6).map((m) => <div key={m.id} className="dim" title={`${m.monthsLeft} months left`}>• {m.label} <span className="muted">({m.monthsLeft} mo)</span></div>)}</div>}
      </nav>
      <main className="main">
        {view === 'dashboard' && <DashboardView />}
        {view === 'vehicles' && <VehiclesView />}
        {view === 'factories' && <FactoriesView />}
        {view === 'market' && <MarketView />}
        {view === 'research' && <ResearchView />}
        {view === 'finance' && <FinanceView />}
        {view === 'motorsport' && <MotorsportView />}
        {view === 'company' && <CompanyView />}
        {view === 'news' && <NewsView />}
        {view === 'saves' && <SavesView />}
      </main>
      {g.decision && !g.gameOver && (
        <Modal>
          <h4>Decision required · {dateLabel(g)}</h4><h2>{g.decision.title}</h2><p className="dim">{g.decision.body}</p>
          <div className="col">{g.decision.options.map((o, i) => <button key={i} className="card" onClick={() => decide(i)}><b>{o.label}</b><span className="small dim" style={{ whiteSpace: 'normal' }}>{o.detail}</span></button>)}</div>
        </Modal>
      )}
      {g.gameOver && (
        <Modal>
          <h4>{dateLabel(g)}</h4><h2>Your tenure is over</h2><p>{g.gameOver.reason}</p>
          <p className="dim">You led {p.name} from {g.startYear} to {g.year}.</p>
          <div className="row end"><button className="btn" onClick={() => setView('finance')}>Review the books</button><button className="btn primary" onClick={quit}>Main menu</button></div>
        </Modal>
      )}
    </div>
  );
}
