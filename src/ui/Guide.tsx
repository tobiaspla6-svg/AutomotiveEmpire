// Onboarding: a one-time welcome that explains how the game is played, and a "getting started" checklist on the
// dashboard that follows the real state of the company. Both can be dismissed and reopened from the top bar.
import { useSyncExternalStore } from 'react';
import { useGame, useStore } from '../store/game';
import { useT, type MessageKey } from '../i18n';
import { nextStep, onboardingSteps } from '../sim/onboarding';
import { Modal } from './common';
import { Icon, type IconName } from './ds/icons';
import { Panel, RingGauge } from './ds/primitives';

const k = (s: string) => s as MessageKey;
const KEY = { welcome: 'ae.guide.welcomeSeen', hidden: 'ae.guide.checklistHidden' };
const read = (key: string) => { try { return globalThis.localStorage?.getItem(key) === '1'; } catch { return false; } };
const listeners = new Set<() => void>();
let version = 0;
function write(key: string, on: boolean) { try { if (on) globalThis.localStorage?.setItem(key, '1'); else globalThis.localStorage?.removeItem(key); } catch { /* not persisted */ } version++; for (const l of listeners) l(); }
const useGuideVersion = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => version, () => version);

/** Reopen the welcome and the checklist (the top bar's help button). */
export function reopenGuide() { write(KEY.hidden, false); write(KEY.welcome, false); }

const TIPS: { icon: IconName; id: string }[] = [{ icon: 'dashboard', id: 'briefing' }, { icon: 'play', id: 'time' }, { icon: 'gauge', id: 'impact' }, { icon: 'alert', id: 'risk' }];

/** Shown once per browser when a game starts. */
export function WelcomeDialog() {
  const { g } = useGame();
  const { t } = useT();
  useGuideVersion();
  if (read(KEY.welcome)) return null;
  const close = () => write(KEY.welcome, true);
  return (
    <Modal onClose={close}>
      <span className="eyebrow">{t('guide.welcome.eyebrow')}</span><h2>{t(k(`guide.welcome.${g.mode}`))}</h2>
      <p className="dim">{t('guide.welcome.body')}</p>
      <ul className="guide-tips">{TIPS.map((x) => <li key={x.id}><Icon name={x.icon} size={18} /><div><b>{t(k(`guide.tip.${x.id}`))}</b><span className="small dim">{t(k(`guide.tip.${x.id}.body`))}</span></div></li>)}</ul>
      <div className="row end"><button className="btn primary" data-action="welcome-close" onClick={close}>{t('guide.welcome.go')}</button></div>
    </Modal>
  );
}

/** The checklist: what a new company still has to do before it earns money, with one click to the right screen. */
export function GettingStarted() {
  const { g, p } = useGame();
  const { t } = useT();
  const setView = useStore((s) => s.setView);
  useGuideVersion();
  const steps = onboardingSteps(g, p);
  const next = nextStep(steps);
  if (!steps.length || !next || read(KEY.hidden)) return null;
  const done = steps.filter((s) => s.done).length;
  return (
    <Panel className="guide" eyebrow={t('guide.eyebrow')} title={t('guide.title', { done, total: steps.length })} action={<button className="linkbtn" data-action="guide-hide" onClick={() => write(KEY.hidden, true)}>{t('guide.hide')}</button>}>
      <div className="guide-body">
        <RingGauge value={done / steps.length} size={78} stroke={7} tone="accent" />
        <ol className="guide-steps">
          {steps.map((s, i) => (
            <li key={s.id} data-step={s.id} className={s.done ? 'done' : s === next ? 'next' : ''}>
              <span className="gs-n">{s.done ? <Icon name="check" size={14} /> : i + 1}</span>
              <div className="gs-t"><b>{t(k(`guide.step.${s.id}`))}</b>{s === next && <span className="small dim">{t(k(`guide.step.${s.id}.why`))}</span>}</div>
              {s === next && <button className="btn sm primary" data-action="guide-go" onClick={() => setView(s.view)}>{t(k(`go.${s.view}`))}<Icon name="arrow" size={13} /></button>}
            </li>))}
        </ol>
      </div>
    </Panel>
  );
}
