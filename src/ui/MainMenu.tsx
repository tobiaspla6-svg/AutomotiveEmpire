// Main menu (Phase 5C, Flow reference 01-inicio/E-garaje-refinado): a founder's garage on the right, the menu on a
// navy panel on the left. Every control is live React: Continue loads the most recent save (disabled with a reason
// when there is none), New game opens the three game modes, Load lists the saves and imports a file, the gear opens
// the settings. The garage picture is the Flow original with its generated menu panel cropped away.
import { useEffect, useRef, useState } from 'react';
import { useT, type MessageKey } from '../i18n';
import { dateTime, monthYear, money } from '../i18n/format';
import { useStore } from '../store/game';
import { importFromFile, loadSlot, localSaves, type SaveMeta } from '../store/saves';
import { Icon, type IconName } from './ds/icons';
import { LanguageSwitch } from './LanguageSwitch';
import { SettingsButton } from './SettingsDialog';
import { flowUrl, BG } from './flow/Scene';

type Mode = 'ceo' | 'founder' | 'motorsport';
const MODES: { id: Mode; screen: 'setup-ceo' | 'setup-founder' | 'setup-motorsport'; icon: IconName }[] = [
  { id: 'ceo', screen: 'setup-ceo', icon: 'company' },
  { id: 'founder', screen: 'setup-founder', icon: 'wrench' },
  { id: 'motorsport', screen: 'setup-motorsport', icon: 'flag' },
];
const mk = (m: Mode, part: string) => `menu.${m}.${part}` as MessageKey;
type Panel = null | 'new' | 'load';

export function MainMenu() {
  const { t, lang } = useT();
  const es = lang === 'es';
  const go = useStore((s) => s.go), start = useStore((s) => s.start), notify = useStore((s) => s.notify), ask = useStore((s) => s.ask);
  const [saves, setSaves] = useState<SaveMeta[] | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const file = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const refresh = () => localSaves.list().then((l) => setSaves([...l].sort((a, b) => b.savedAt - a.savedAt))).catch(() => setSaves([]));
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPanel(null); opener.current?.focus(); } };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [panel]);
  const load = async (slot: string) => { try { start(await loadSlot(slot)); } catch (err) { notify((err as Error).message, true); } };
  const del = (s: SaveMeta) => ask(t('menu.save.confirmDelete', { name: s.company }), async () => { await localSaves.remove(s.slot); void refresh(); });
  const last = saves?.[0];
  const hasAuto = !!saves?.some((s) => s.slot === 'autosave');
  const choose = (m: typeof MODES[number]) => {
    if (hasAuto) ask(es ? 'La partida automática actual se reemplazará cuando la nueva partida se guarde. Las partidas guardadas con nombre se conservan.' : 'The current autosave will be replaced when the new game saves. Named saves are kept.', () => go(m.screen));
    else go(m.screen);
  };
  const openPanel = (p: Panel, e: React.MouseEvent<HTMLButtonElement>) => { opener.current = e.currentTarget; setPanel(panel === p ? null : p); };

  return (
    <div className="menu2 fm-menu">
      <aside className="fm-side">
        <header className="menu2-top fm-top">
          <LanguageSwitch />
        </header>
        <h1 className="fm-title"><span>Automotive</span><span>Empire</span></h1>
        <p className="fm-tag">{t('menu.tagline')}</p>
        <div className="fm-actions">
          <button type="button" className="fm-btn primary" data-action="resume" disabled={!last} aria-describedby="fm-continue-note" onClick={() => last && load(last.slot)}>
            {es ? 'Continuar' : 'Continue'}
          </button>
          <span id="fm-continue-note" className="fm-note">
            {saves === null ? '…' : last ? `${last.company} · ${monthYear(last.month, last.year, lang)} · ${money(last.cash, lang)}` : (es ? 'Todavía no hay partidas guardadas en este navegador.' : 'No saved games in this browser yet.')}
          </span>
          <button type="button" className={'fm-btn ' + (last ? 'secondary' : 'primary')} data-action="new-game" aria-expanded={panel === 'new'} onClick={(e) => openPanel('new', e)}>{es ? 'Nueva partida' : 'New game'}</button>
          <button type="button" className="fm-btn secondary" data-action="load-game" aria-expanded={panel === 'load'} onClick={(e) => openPanel('load', e)}>{es ? 'Cargar partida' : 'Load game'}</button>
        </div>
        <div className="fm-foot">
          <SettingsButton className="fm-gear" />
          <p className="fm-legal">{t('menu.legal')} {t('menu.legal2')}</p>
        </div>
      </aside>

      <main className="fm-scene">
        <img className="fm-scene-img" src={flowUrl(BG.inicio.src)} width={BG.inicio.w} height={BG.inicio.h} alt={es ? 'Garaje del fundador con un todoterreno verde clásico' : "Founder's garage with a classic green off-roader"} />
        {panel === 'new' && <section className="fm-panel" role="dialog" aria-modal="false" aria-labelledby="fm-new-h">
          <div className="fm-panel-head"><h2 id="fm-new-h">{es ? 'Nueva partida' : 'New game'}</h2><button type="button" className="fm-x" aria-label={t('common.close')} onClick={() => setPanel(null)}><Icon name="close" /></button></div>
          <nav className="modes2 fm-modes" aria-label={t('menu.modes')}>
            {MODES.map((x, i) => (
              <div key={x.id} className="mode2">
                <button type="button" className="m2-head" autoFocus={i === 0} onClick={() => choose(x)} aria-describedby={`mode-desc-${x.id}`}>
                  <span className="m2-icon"><Icon name={x.icon} size={22} /></span>
                  <span className="m2-text"><span className="m2-n">{t('menu.mode', { n: i + 1 })}</span><b>{t(mk(x.id, 'title'))}</b><span id={`mode-desc-${x.id}`} className="m2-sub">{t(mk(x.id, 'sub'))}</span></span>
                  <Icon name="arrow" size={20} />
                </button>
              </div>
            ))}
          </nav>
        </section>}
        {panel === 'load' && <section className="fm-panel" role="dialog" aria-modal="false" aria-labelledby="fm-load-h">
          <div className="fm-panel-head"><h2 id="fm-load-h">{es ? 'Cargar partida' : 'Load game'}</h2><button type="button" className="fm-x" aria-label={t('common.close')} onClick={() => setPanel(null)}><Icon name="close" /></button></div>
          <input ref={file} type="file" accept=".json,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { start(await importFromFile(f)); } catch (err) { notify((err as Error).message, true); } e.target.value = ''; }} />
          {!saves?.length ? <p className="fm-empty">{t('menu.noSaves')}</p> : <ul className="fm-saves save-list">{saves.map((s) => (
            <li key={s.slot}>
              <span className="sl-name"><b>{s.company}</b><span>{t(`mode.${s.mode}` as MessageKey)} · {monthYear(s.month, s.year, lang)} · {money(s.cash, lang)}</span><small>{s.slot} · {t('menu.savedAt', { when: dateTime(s.savedAt, lang) })}</small></span>
              <span className="sl-act"><button type="button" className="fm-btn small" onClick={() => load(s.slot)}>{t('menu.load')}</button><button type="button" className="fm-x" onClick={() => del(s)} aria-label={`${t('menu.delete')} ${s.company}`}><Icon name="trash" size={16} /></button></span>
            </li>))}</ul>}
          <button type="button" className="fm-btn secondary small" onClick={() => file.current?.click()}><Icon name="upload" size={16} />{t('menu.import')}</button>
        </section>}
      </main>
    </div>
  );
}
