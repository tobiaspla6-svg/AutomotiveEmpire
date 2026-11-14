// Last line of defence: an exception while rendering any screen would otherwise unmount the whole interface and leave
// a blank page. This shows a plain message with a way back to the menu instead (the saves are untouched).
import { Component, type ReactNode } from 'react';
import { useStore } from '../store/game';
import { useT } from '../i18n';

function CrashScreen({ onMenu }: { onMenu: () => void }) {
  const { t } = useT();
  return (
    <div className="screen-loading" role="alert" style={{ flexDirection: 'column', gap: 14, textAlign: 'center', padding: 24 }}>
      <h2 style={{ margin: 0 }}>{t('crash.title')}</h2>
      <p className="dim" style={{ maxWidth: 520, margin: 0 }}>{t('crash.body')}</p>
      <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
        <button className="btn primary" data-action="crash-menu" onClick={onMenu}>{t('crash.menu')}</button>
        <button className="btn" data-action="crash-reload" onClick={() => location.reload()}>{t('crash.reload')}</button>
      </div>
    </div>
  );
}

export class CrashGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: Error) { console.error('Screen crashed:', err); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <CrashScreen onMenu={() => { useStore.getState().quit(); this.setState({ failed: false }); }} />;
  }
}
