// Game shell (Phase 4C): status ribbon, grouped navigation, time controls. Screens render inside <main>.
import { lazy, Suspense, useEffect } from 'react';
import { useGame, useStore } from '../store/game';
import { useT, type MessageKey } from '../i18n';
import { monthYear, money } from '../i18n/format';
import { pendingRound } from '../sim/racing/season';
import { Modal } from './common';
import { Emblem, Icon, type IconName } from './ds/icons';
import { LanguageSwitch } from './LanguageSwitch';
import { SettingsButton } from './SettingsDialog';
import { DashboardView } from './Dashboard';
import { CompanyView, FinanceView, MarketView, NewsView, ResearchView, SavesView } from './Views';
import { FactoriesView } from './Factories';

// the vehicle studio and motorsport screens carry the 3D viewers: load them on first visit
const VehiclesView = lazy(() => import('./Vehicles').then((m) => ({ default: m.VehiclesView })));
const MotorsportView = lazy(() => import('./Motorsport').then((m) => ({ default: m.MotorsportView })));

type NavItem = { id: string; icon: IconName; label: MessageKey; dot?: boolean };
type NavGroup = { id: MessageKey; items: NavItem[] };

export function Shell() {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const view = useStore((s) => s.view), setView = useStore((s) => s.setView), advance = useStore((s) => s.advance), go = useStore((s) => s.go), busy = useStore((s) => s.busy), decide = useStore((s) => s.decide), quit = useStore((s) => s.quit), save = useStore((s) => s.save), notify = useStore((s) => s.notify);
  const race = pendingRound(g, p);
  const last = p.ledger[p.ledger.length - 1];
  const ms = g.mode === 'motorsport';
  const ready = p.models.filter((m) => m.status === 'ready').length;
  const groups: NavGroup[] = ms
    ? [{ id: 'nav.group.racing', items: [{ id: 'motorsport', icon: 'flag', label: 'nav.teamHq', dot: !!race }] }, { id: 'nav.group.corporate', items: [{ id: 'finance', icon: 'finance', label: 'nav.finance' }, { id: 'news', icon: 'news', label: 'nav.news' }] }, { id: 'nav.group.system', items: [{ id: 'saves', icon: 'save', label: 'nav.saves' }] }]
    : [
      { id: 'nav.group.command', items: [{ id: 'dashboard', icon: 'dashboard', label: 'nav.dashboard' }] },
      { id: 'nav.group.engineering', items: [{ id: 'vehicles', icon: 'vehicle', label: 'nav.vehicles', dot: ready > 0 }, { id: 'research', icon: 'research', label: 'nav.research' }] },
      { id: 'nav.group.operations', items: [{ id: 'factories', icon: 'factory', label: 'nav.factories', dot: ready > 0 }, { id: 'market', icon: 'market', label: 'nav.market' }] },
      { id: 'nav.group.corporate', items: [{ id: 'finance', icon: 'finance', label: 'nav.finance' }, { id: 'company', icon: 'company', label: 'nav.company' }, { id: 'motorsport', icon: 'flag', label: 'nav.motorsport', dot: !!race }] },
      { id: 'nav.group.system', items: [{ id: 'news', icon: 'news', label: 'nav.news' }, { id: 'saves', icon: 'save', label: 'nav.saves' }] },
    ];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLButtonElement || e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); if (!race) advance(1); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, race]);
  const conf = p.board?.confidence;
  const confTone = conf === undefined ? '' : conf < 25 ? 'bad' : conf < 45 ? 'warn' : 'good';
  return (
    <div className="shell">
      <header className="topbar">
        <div className="who"><Emblem size={30} /><div className="who-text"><b title={p.name}>{p.name}</b><span className="eyebrow">{t(`mode.${g.mode}` as MessageKey)}</span></div></div>
        <div className="ribbon">
          <Stat icon="clock" label={t('top.date')} value={monthYear(g.month, g.year, lang)} />
          <Stat icon="cash" label={t('top.cash')} value={money(p.cash, lang)} tone={p.cash < 0 ? 'bad' : ''} />
          <Stat icon="layers" label={t('top.debt')} value={money(p.debt, lang)} tone={p.troubleMonths > 0 ? 'bad' : ''} />
          {last && <Stat icon="gauge" label={t('top.lastMonth')} value={`${last.profit >= 0 ? '+' : ''}${money(last.profit, lang)}`} tone={last.profit >= 0 ? 'good' : 'bad'} />}
          {conf !== undefined && <Stat icon="target" label={t(ms ? 'top.owner' : 'top.board')} value={`${Math.round(conf)}%`} tone={confTone} bar={conf} />}
        </div>
        <div className="grow" />
        <div className="row topbar-actions" style={{ gap: 4 }}>
          <button className="iconbtn" onClick={async () => { await save(`${p.name} ${g.year}`); notify(t('top.saved')); }} aria-label={t('top.save')} title={t('top.save')}><Icon name="save" /></button>
          <SettingsButton />
          <button className="iconbtn" onClick={() => { void save('autosave'); quit(); }} aria-label={t('top.menu')} title={t('top.menu')}><Icon name="home" /></button>
        </div>
        {race ? <button className="btn primary" data-action="race-weekend" onClick={() => go('race')}><Icon name="flag" size={16} />{t('top.raceWeekend', { name: race.name })}</button>
          : <div className="row" style={{ gap: 8 }}>
            <button className="btn" disabled={busy || !!g.gameOver} onClick={() => advance(3)} title={t('top.plus3.hint')}><Icon name="fast" size={15} />{t('top.plus3')}</button>
            <button className="btn primary" data-action="next-month" disabled={busy || !!g.gameOver} onClick={() => advance(1)} title={t('top.next.hint')}>{busy ? t('top.working') : t('top.next')}<Icon name="play" size={14} /></button>
          </div>}
      </header>

      <nav className="nav" aria-label={t('nav.label')}>
        {groups.map((grp) => (
          <div key={grp.id} className="nav-group">
            <span className="nav-eyebrow">{t(grp.id)}</span>
            {grp.items.map((it) => (
              <button key={it.id} data-view={it.id} className={view === it.id ? 'on' : ''} aria-current={view === it.id ? 'page' : undefined} onClick={() => setView(it.id)}>
                <Icon name={it.icon} size={18} /><span className="nav-label">{t(it.label)}</span>{it.dot && <i className="dot" title={t('nav.attention')} />}
              </button>
            ))}
          </div>
        ))}
        <div className="grow" />
        <div className="nav-foot">
          <LanguageSwitch compact />
          <span className="tiny muted">{t(g.historyMode === 'historical' ? 'nav.timeline.historical' : 'nav.timeline.alt')} · {t(`diff.${g.difficulty}` as MessageKey)}</span>
        </div>
      </nav>

      <main className="main" id="main">
        <Suspense fallback={<div className="screen-loading" role="status">{t('common.loading')}</div>}>
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
        </Suspense>
      </main>
      {g.decision && !g.gameOver && (
        <Modal>
          <span className="eyebrow">{t('decision.required')} · {monthYear(g.month, g.year, lang)}</span><h2>{g.decision.title}</h2><p className="dim">{g.decision.body}</p>
          <div className="col">{g.decision.options.map((o, i) => <button key={i} className="card" onClick={() => decide(i)}><b>{o.label}</b><span className="small dim" style={{ whiteSpace: 'normal' }}>{o.detail}</span></button>)}</div>
        </Modal>
      )}
      {g.gameOver && (
        <Modal>
          <span className="eyebrow">{monthYear(g.month, g.year, lang)}</span><h2>{t('over.title')}</h2><p>{g.gameOver.reason}</p>
          <p className="dim">{t('over.led', { name: p.name, from: g.startYear, to: g.year })}</p>
          <div className="row end"><button className="btn" onClick={() => setView('finance')}>{t('over.books')}</button><button className="btn primary" onClick={quit}>{t('top.menu')}</button></div>
        </Modal>
      )}
    </div>
  );
}

function Stat({ icon, label, value, tone = '', bar }: { icon: IconName; label: string; value: string; tone?: string; bar?: number }) {
  return (
    <div className="rstat"><Icon name={icon} size={16} />
      <div className="rstat-t"><span className="l">{label}</span><span className={'v ' + tone}>{value}</span>{bar !== undefined && <i className="rstat-bar"><b style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} className={tone} /></i>}</div>
    </div>
  );
}
