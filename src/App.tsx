import { useStore } from './store/game';
import { MainMenu } from './ui/MainMenu';
import { CeoSetupScreen, FounderSetupScreen, MotorsportSetupScreen } from './ui/Setup';
import { Shell } from './ui/Shell';
import { RaceScreen } from './ui/RaceScreen';

export function App() {
  const screen = useStore((s) => s.screen);
  const toast = useStore((s) => s.toast);
  const confirm = useStore((s) => s.confirm), answer = useStore((s) => s.answer);
  return (
    <>
      {screen === 'menu' && <MainMenu />}
      {screen === 'setup-ceo' && <CeoSetupScreen />}
      {screen === 'setup-founder' && <FounderSetupScreen />}
      {screen === 'setup-motorsport' && <MotorsportSetupScreen />}
      {screen === 'game' && <Shell />}
      {screen === 'race' && <RaceScreen />}
      {confirm && (
        <div className="modal-bg" style={{ zIndex: 70 }}><div className="modal" role="alertdialog" aria-modal="true" style={{ maxWidth: 460 }}>
          <h3>Please confirm</h3><p className="dim">{confirm.text}</p>
          <div className="row end"><button className="btn" onClick={() => answer(false)}>Cancel</button><button className="btn primary" autoFocus onClick={() => answer(true)}>Confirm</button></div>
        </div></div>
      )}
      {toast && <div className={'toast' + (toast.bad ? ' bad' : '')} role="status">{toast.text}</div>}
    </>
  );
}
