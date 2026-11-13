// English / Español switch. The choice is remembered in this browser.
import { LANGS, setLang, useLang, useT } from '../i18n';

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const lang = useLang();
  const { t } = useT();
  return (
    <div className="seg langsw" role="group" aria-label={t('settings.language')}>
      {LANGS.map((l) => <button key={l.id} type="button" className={l.id === lang ? 'on' : ''} aria-pressed={l.id === lang} lang={l.id} onClick={() => setLang(l.id)} title={l.name}>{compact ? l.id.toUpperCase() : l.name}</button>)}
    </div>
  );
}
