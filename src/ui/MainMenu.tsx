// Main menu (Phase 4C): a showroom. One interactive 3D car on the right follows the game mode being considered on
// the left; saves, settings and the language switch are always at hand. The 3D view is lazy and optional — with
// graphics off or no WebGL the same layout shows a drawn car, and every button works the same.
import { useEffect, useRef, useState } from 'react';
import { useT, type MessageKey } from '../i18n';
import { dateTime, monthYear, money } from '../i18n/format';
import { useStore } from '../store/game';
import { importFromFile, loadSlot, localSaves, type SaveMeta } from '../store/saves';
import { useGraphics } from '../three/quality';
import { Emblem, Icon, type IconName } from './ds/icons';
import { CarPoster, type PosterKind } from './ds/poster';
import { Guard3D, ShowroomViewer } from './Lazy3D';
import { LanguageSwitch } from './LanguageSwitch';
import { SettingsButton, SettingsDialog } from './SettingsDialog';

type Mode = 'ceo' | 'founder' | 'motorsport';
const MODES: { id: Mode; screen: 'setup-ceo' | 'setup-founder' | 'setup-motorsport'; icon: IconName; poster: PosterKind; color: string }[] = [
  { id: 'ceo', screen: 'setup-ceo', icon: 'company', poster: 'coupe', color: '#a3161b' },
  { id: 'founder', screen: 'setup-founder', icon: 'wrench', poster: 'sedan', color: '#233f6f' },
  { id: 'motorsport', screen: 'setup-motorsport', icon: 'flag', poster: 'formula', color: '#c9a35c' },
];
const mk = (m: Mode, part: string) => `menu.${m}.${part}` as MessageKey;

export function MainMenu() {
  const { t, lang } = useT();
  const go = useStore((s) => s.go), start = useStore((s) => s.start), notify = useStore((s) => s.notify), ask = useStore((s) => s.ask);
  const gfx = useGraphics();
  const [mode, setMode] = useState<Mode>('founder');
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [showAll, setShowAll] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const refresh = () => localSaves.list().then((l) => setSaves([...l].sort((a, b) => b.savedAt - a.savedAt))).catch(() => setSaves([]));
  useEffect(() => { void refresh(); }, []);
  const load = async (slot: string) => { try { start(await loadSlot(slot)); } catch (err) { notify((err as Error).message, true); } };
  const del = (s: SaveMeta) => ask(t('menu.save.confirmDelete', { name: s.company }), async () => { await localSaves.remove(s.slot); void refresh(); });
  const m = MODES.find((x) => x.id === mode)!;
  const last = saves[0];
  const rest = last ? saves.slice(1) : [];
  const gfxLabel = gfx.pref === 'auto' ? `${t('gfx.auto')} · ${gfx.enabled ? t(`gfx.${gfx.effective}` as MessageKey) : t('gfx.off')}` : gfx.enabled ? t(`gfx.${gfx.effective}` as MessageKey) : t('gfx.off');

  return (
    <div className="menu2">
      <div className="menu2-glow" aria-hidden="true" />
      <header className="menu2-top">
        <div className="brand2"><Emblem size={34} /><div><h1>Automotive <span>Empire</span></h1></div></div>
        <div className="row" style={{ gap: 8 }}><LanguageSwitch /><SettingsButton /></div>
      </header>

      <div className="menu2-body">
        <div className="menu2-left">
          <p className="menu2-tag">{t('menu.tagline')} <span className="muted">{t('menu.era')}</span></p>

          <nav className="modes2" aria-label={t('menu.modes')}>
            {MODES.map((x, i) => (
              <div key={x.id} className={'mode2' + (x.id === mode ? ' on' : '')} style={{ animationDelay: `${120 + i * 70}ms` }} onMouseEnter={() => setMode(x.id)}>
                <button type="button" className="m2-head" onFocus={() => setMode(x.id)} onClick={() => go(x.screen)} aria-describedby={`mode-desc-${x.id}`}>
                  <span className="m2-icon"><Icon name={x.icon} size={22} /></span>
                  <span className="m2-text">
                    <span className="m2-n">{t('menu.mode', { n: i + 1 })}</span>
                    <b>{t(mk(x.id, 'title'))}</b>
                    <span id={`mode-desc-${x.id}`} className="m2-sub">{t(mk(x.id, 'sub'))}</span>
                  </span>
                  <span className="m2-go"><span className="m2-cta">{t(mk(x.id, 'cta'))}</span><Icon name="arrow" size={20} /></span>
                </button>
                <div className="m2-more"><ul>{[1, 2, 3].map((n) => <li key={n}><Icon name="check" size={14} />{t(`menu.${x.id}.f${n}` as MessageKey)}</li>)}</ul></div>
              </div>
            ))}
          </nav>

          <section className="resume" aria-labelledby="resume-h" style={{ animationDelay: '360ms' }}>
            <div className="row between wrap" style={{ gap: 8 }}>
              <h4 id="resume-h">{t('menu.continue')}</h4>
              <div className="row" style={{ gap: 6 }}>
                <input ref={file} type="file" accept=".json,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { start(await importFromFile(f)); } catch (err) { notify((err as Error).message, true); } e.target.value = ''; }} />
                <button className="btn sm ghost" onClick={() => file.current?.click()}><Icon name="upload" size={14} />{t('menu.import')}</button>
              </div>
            </div>
            {!last ? <p className="small muted">{t('menu.noSaves')}</p> : (
              <>
                <div className="resume-card">
                  <div className="rc-main">
                    <b>{last.company}</b>
                    <span className="small muted">{t(`mode.${last.mode}` as MessageKey)} · {monthYear(last.month, last.year, lang)} · {money(last.cash, lang)}</span>
                    <span className="tiny muted">{t('menu.savedAt', { when: dateTime(last.savedAt, lang) })}</span>
                  </div>
                  <button className="btn primary" onClick={() => load(last.slot)}><Icon name="play" size={14} />{t('menu.resume')}</button>
                </div>
                {rest.length > 0 && <button className="linkbtn" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>{showAll ? t('menu.hideSaves') : t('menu.allSaves', { n: rest.length })}<Icon name={showAll ? 'up' : 'down'} size={14} /></button>}
                {showAll && <ul className="save-list">{rest.map((s) => (
                  <li key={s.slot}>
                    <span className="sl-name"><b>{s.company}</b><span className="muted"> · {s.slot}</span></span>
                    <span className="small muted">{t(`mode.${s.mode}` as MessageKey)} · {monthYear(s.month, s.year, lang)}</span>
                    <span className="sl-act"><button className="btn sm" onClick={() => load(s.slot)}>{t('menu.load')}</button><button className="iconbtn" style={{ width: 28, height: 28 }} onClick={() => del(s)} aria-label={t('menu.delete')} title={t('menu.delete')}><Icon name="trash" size={15} /></button></span>
                  </li>))}</ul>}
              </>
            )}
          </section>
        </div>

        <div className="menu2-right">
          <div className="showroom">
            <Guard3D className="showroom-view" poster={<CarPoster kind={m.poster} color={m.color} label={t(mk(mode, 'car'))} className="poster-hero" />}>
              <ShowroomViewer scene={mode} />
            </Guard3D>
            <div className="showroom-cap">
              <span className="eyebrow">{t('menu.mode', { n: MODES.findIndex((x) => x.id === mode) + 1 })}</span>
              <b>{t(mk(mode, 'title'))}</b>
              <span className="small dim">{t(mk(mode, 'car'))}</span>
            </div>
            <div className="showroom-gfx"><SettingsChip label={t('menu.graphics', { q: gfxLabel })} /></div>
          </div>
        </div>
      </div>

      <footer className="menu2-foot">{t('menu.legal')} <span className="tag h">{t('tag.historical')}</span> <span className="tag a">{t('tag.approx')}</span> <span className="tag e">{t('tag.estimate')}</span> {t('menu.legal2')}</footer>
    </div>
  );
}

/** A small chip that opens the settings dialog (graphics shortcut on the showroom). */
function SettingsChip({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  return <><button className="chip" onClick={() => setOpen(true)}><Icon name="sliders" size={13} />{label}</button>{open && <SettingsDialog onClose={() => setOpen(false)} />}</>;
}
