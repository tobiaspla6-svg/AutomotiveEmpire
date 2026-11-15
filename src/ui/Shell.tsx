// Game shell (Phase 4C): status ribbon, grouped navigation, time controls. Screens render inside <main>.
import { lazy, Suspense, useEffect, useState } from 'react';
import { useGame, useStore } from '../store/game';
import { useT, type MessageKey } from '../i18n';
import { monthYear, money } from '../i18n/format';
import { pendingRound } from '../sim/racing/season';
import { Modal } from './common';
import { Emblem, Icon, type IconName } from './ds/icons';
import { LanguageSwitch } from './LanguageSwitch';
import { SettingsButton } from './SettingsDialog';
import { WelcomeDialog, reopenGuide } from './Guide';
import { DashboardView } from './Dashboard';
import { CompanyView, NewsView, SavesView } from './Views';
import { FinanceView, MarketView, ResearchView } from './Corporate';
import { FactoriesView } from './Factories';
import { EmpireHub2D, Workshop2D, Collection2D, FactoryFloor2D, Campaigns2D, League2D } from './Empire2D';
import { SkillTree2D } from './SkillTree2D';
import { FlowStudio } from './flow/FlowStudio';
import { FlowGarage } from './flow/FlowGarage';
import { FlowChestsScreen } from './flow/FlowChests';
import { useTx } from './game2d/text';
import { isMuted, setMuted, sfx } from './game2d/sfx';

// the vehicle studio and motorsport screens carry the 3D viewers: load them on first visit
const VehiclesView = lazy(() => import('./Vehicles').then((m) => ({ default: m.VehiclesView })));
const MotorsportView = lazy(() => import('./Motorsport').then((m) => ({ default: m.MotorsportView })));

type NavItem = { id: string; icon: IconName; label: MessageKey; custom?: string; dot?: boolean };
type NavGroup = { id: MessageKey; items: NavItem[] };

/** Screens built on the Flow scenes: the side navigation shrinks to icons so the scene has the room. */
const FLOW_VIEWS = new Set(['hq2d', 'studio2d', 'factory2d', 'garage2d', 'chests2d']);

export function Shell() {
  const { g, p } = useGame();
  const { t, lang } = useT();
  const tx = useTx();
  const [muted, setMute] = useState(isMuted);
  const view = useStore((s) => s.view), setView = useStore((s) => s.setView), advance = useStore((s) => s.advance), go = useStore((s) => s.go), busy = useStore((s) => s.busy), decide = useStore((s) => s.decide), quit = useStore((s) => s.quit), save = useStore((s) => s.save), notify = useStore((s) => s.notify);
  const race = pendingRound(g, p);
  const last = p.ledger[p.ledger.length - 1];
  const ms = g.mode === 'motorsport';
  const ready = p.models.filter((m) => m.status === 'ready').length;
  const groups: NavGroup[] = ms
    ? [{ id: 'nav.group.racing', items: [{ id: 'motorsport', icon: 'flag', label: 'nav.teamHq', dot: !!race }] }, { id: 'nav.group.corporate', items: [{ id: 'finance', icon: 'finance', label: 'nav.finance' }, { id: 'news', icon: 'news', label: 'nav.news' }] }, { id: 'nav.group.system', items: [{ id: 'saves', icon: 'save', label: 'nav.saves' }] }]
    : [
      { id: 'nav.group.command', items: [
        { id: 'hq2d', icon: 'home', label: 'nav.dashboard', custom: tx('nav.hq') },
        { id: 'studio2d', icon: 'wrench', label: 'nav.vehicles', custom: tx('nav.studio') },
        { id: 'workshop2d', icon: 'gauge', label: 'nav.vehicles', custom: tx('nav.workshop') },
        { id: 'factory2d', icon: 'factory', label: 'nav.factories', custom: tx('nav.factory') },
        { id: 'garage2d', icon: 'vehicle', label: 'nav.vehicles', custom: tx('nav.garage') },
        { id: 'chests2d', icon: 'box', label: 'nav.company', custom: tx('nav.chests') },
        { id: 'skills2d', icon: 'bolt', label: 'nav.research', custom: tx('nav.skills') },
        { id: 'collection2d', icon: 'trophy', label: 'nav.company', custom: tx('nav.collection') },
        { id: 'campaign2d', icon: 'market', label: 'nav.market', custom: tx('nav.campaigns') },
        { id: 'league2d', icon: 'trophy', label: 'nav.company', custom: tx('nav.league') },
      ] },
      { id: 'nav.group.engineering', items: [{ id: 'dashboard', icon: 'dashboard', label: 'nav.dashboard', custom: tx('nav.advanced') }, { id: 'vehicles', icon: 'vehicle', label: 'nav.vehicles', dot: ready > 0 }, { id: 'research', icon: 'research', label: 'nav.research' }] },
      { id: 'nav.group.operations', items: [{ id: 'factories', icon: 'factory', label: 'nav.factories', dot: ready > 0 }, { id: 'market', icon: 'market', label: 'nav.market' }] },
      { id: 'nav.group.corporate', items: [{ id: 'finance', icon: 'finance', label: 'nav.finance' }, { id: 'company', icon: 'company', label: 'nav.company' }, { id: 'motorsport', icon: 'flag', label: 'nav.motorsport', dot: !!race }] },
      { id: 'nav.group.system', items: [{ id: 'news', icon: 'news', label: 'nav.news' }, { id: 'saves', icon: 'save', label: 'nav.saves' }] },
    ];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLButtonElement || e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); if (!race) advance(1); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, race]);
  const [reviewing, setReviewing] = useState(false); // after a game over: look through the books with the dialog out of the way
  const conf = p.board?.confidence;
  const confTone = conf === undefined ? '' : conf < 25 ? 'bad' : conf < 45 ? 'warn' : 'good';
  return (
    <div className={'shell' + (FLOW_VIEWS.has(view) ? ' flow-focus' : '')}>
      <header className="topbar">
        <div className="who"><Emblem size={30} /><div className="who-text"><b title={p.name}>{p.name}</b><span className="eyebrow">{t(`mode.${g.mode}` as MessageKey)}</span></div></div>
        <div className="ribbon">
          <Stat id="date" icon="clock" label={t('top.date')} value={monthYear(g.month, g.year, lang)} />
          <Stat id="cash" icon="cash" label={t('top.cash')} value={money(p.cash, lang)} tone={p.cash < 0 ? 'bad' : ''} />
          <Stat id="debt" icon="layers" label={t('top.debt')} value={money(p.debt, lang)} tone={p.troubleMonths > 0 ? 'bad' : ''} />
          {last && <Stat icon="gauge" label={t('top.lastMonth')} value={`${last.profit >= 0 ? '+' : ''}${money(last.profit, lang)}`} tone={last.profit >= 0 ? 'good' : 'bad'} />}
          {conf !== undefined && <Stat icon="target" label={t(ms ? 'top.owner' : 'top.board')} value={`${Math.round(conf)}%`} tone={confTone} bar={conf} />}
        </div>
        <div className="grow" />
        <div className="row topbar-actions" style={{ gap: 4 }}>
          <button className="iconbtn" onClick={async () => { await save(`${p.name} ${g.year}`); notify(t('top.saved')); }} aria-label={t('top.save')} title={t('top.save')}><Icon name="save" /></button>
          <button className="iconbtn" data-action="sound" aria-pressed={!muted} onClick={() => { setMuted(!muted); setMute(!muted); if (muted) sfx.click(); }} aria-label={muted ? tx('sound.off') : tx('sound.on')} title={muted ? tx('sound.off') : tx('sound.on')}><span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>{muted ? '🔇' : '🔊'}</span></button>
          <SettingsButton />
          <button className="iconbtn" data-action="help" onClick={reopenGuide} aria-label={t('guide.help')} title={t('guide.help')}><Icon name="help" /></button>
          <button className="iconbtn" data-action="quit" onClick={() => { void save('autosave'); quit(); }} aria-label={t('top.menu')} title={t('top.menu')}><Icon name="home" /></button>
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
              <button key={it.id} data-view={it.id} title={it.custom ?? t(it.label)} className={view === it.id ? 'on' : ''} aria-current={view === it.id ? 'page' : undefined} onClick={() => setView(it.id)}>
                <Icon name={it.icon} size={18} /><span className="nav-label">{it.custom ?? t(it.label)}</span>{it.dot && <i className="dot" title={t('nav.attention')} />}
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
          {view === 'hq2d' && <EmpireHub2D />}
          {view === 'workshop2d' && <Workshop2D />}
          {view === 'studio2d' && <FlowStudio />}
          {view === 'garage2d' && <FlowGarage />}
          {view === 'chests2d' && <FlowChestsScreen />}
          {view === 'factory2d' && <FactoryFloor2D />}
          {view === 'skills2d' && <SkillTree2D />}
          {view === 'collection2d' && <Collection2D />}
          {view === 'campaign2d' && <Campaigns2D />}
          {view === 'league2d' && <League2D />}
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
      {!g.decision && !g.gameOver && <WelcomeDialog />}
      {g.decision && !g.gameOver && (
        <Modal>
          <span className="eyebrow">{t('decision.required')} · {monthYear(g.month, g.year, lang)}</span><h2>{g.decision.title}</h2><p className="dim">{g.decision.body}</p>
          <div className="col">{g.decision.options.map((o, i) => <button key={i} className="card" onClick={() => decide(i)}><b>{o.label}</b><span className="small dim" style={{ whiteSpace: 'normal' }}>{o.detail}</span></button>)}</div>
        </Modal>
      )}
      {g.gameOver && reviewing && (
        <div className="over-strip" role="status"><span><b>{t('over.title')}</b> · {g.gameOver.reason}</span><button className="btn sm primary" data-action="over-menu" onClick={quit}>{t('top.menu')}</button></div>
      )}
      {g.gameOver && !reviewing && (
        <Modal>
          <span className="eyebrow">{monthYear(g.month, g.year, lang)}</span><h2>{t('over.title')}</h2><p>{g.gameOver.reason}</p>
          <p className="dim">{t('over.led', { name: p.name, from: g.startYear, to: g.year })}</p>
          <div className="row end"><button className="btn" data-action="over-books" onClick={() => { setView('finance'); setReviewing(true); }}>{t('over.books')}</button><button className="btn primary" onClick={quit}>{t('top.menu')}</button></div>
        </Modal>
      )}
    </div>
  );
}

function Stat({ id, icon, label, value, tone = '', bar }: { id?: string; icon: IconName; label: string; value: string; tone?: string; bar?: number }) {
  return (
    <div className="rstat" data-stat={id}><Icon name={icon} size={16} />
      <div className="rstat-t"><span className="l">{label}</span><span className={'v ' + tone}>{value}</span>{bar !== undefined && <i className="rstat-bar"><b style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} className={tone} /></i>}</div>
    </div>
  );
}
