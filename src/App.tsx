import { lazy, Suspense } from 'react';
import { useStore } from './store/game';
import { useT } from './i18n';
import { MainMenu } from './ui/MainMenu';
import { Shell } from './ui/Shell';

// setup screens and the live race load on demand: the menu and the management screens need none of their code
const CeoSetupScreen = lazy(() => import('./ui/Setup').then((m) => ({ default: m.CeoSetupScreen })));
const FounderSetupScreen = lazy(() => import('./ui/Setup').then((m) => ({ default: m.FounderSetupScreen })));
const MotorsportSetupScreen = lazy(() => import('./ui/Setup').then((m) => ({ default: m.MotorsportSetupScreen })));
const RaceScreen = lazy(() => import('./ui/RaceScreen').then((m) => ({ default: m.RaceScreen })));

export function App() {
  const screen = useStore((s) => s.screen);
  const toast = useStore((s) => s.toast);
  const confirm = useStore((s) => s.confirm), answer = useStore((s) => s.answer);
  const { t } = useT();
  return (
    <>
      {screen === 'menu' && <MainMenu />}
      <Suspense fallback={<div className="screen-loading" role="status">{t('common.loading')}</div>}>
        {screen === 'setup-ceo' && <CeoSetupScreen />}
        {screen === 'setup-founder' && <FounderSetupScreen />}
        {screen === 'setup-motorsport' && <MotorsportSetupScreen />}
        {screen === 'race' && <RaceScreen />}
      </Suspense>
      {screen === 'game' && <Shell />}
      {confirm && (
        <div className="modal-bg" style={{ zIndex: 70 }}><div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-h" style={{ maxWidth: 460 }}>
          <h3 id="confirm-h">{t('confirm.title')}</h3><p className="dim">{confirm.text}</p>
          <div className="row end"><button className="btn" data-action="confirm-cancel" onClick={() => answer(false)}>{t('confirm.cancel')}</button><button className="btn primary" data-action="confirm-ok" autoFocus onClick={() => answer(true)}>{t('confirm.ok')}</button></div>
        </div></div>
      )}
      {toast && <div className={'toast' + (toast.bad ? ' bad' : '')} role="status">{toast.text}</div>}
    </>
  );
}
