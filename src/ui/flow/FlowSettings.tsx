// Settings (Flow reference 07-configuracion/A): a navy panel over the blurred garage. Only options the game really
// applies are offered. Changes are a draft until Apply; Back with unapplied changes asks Save / Discard / Cancel;
// Restore resets preferences only (never the saved game). There is no music in the game, so there is no music slider;
// subtitles do not exist either (no voice), so they are not offered.
import { useEffect, useRef, useState } from 'react';
import { LANGS, setLang, useT, type Lang, type MessageKey } from '../../i18n';
import { setQualityPref, useGraphics, type QualityPref } from '../../three/quality';
import { isMuted, setMuted } from '../game2d/sfx';
import { Icon } from '../ds/icons';
import { GraphicsTestDialog } from '../SettingsDialog';
import { BG, flowUrl } from './Scene';
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs } from './prefs';

type Tab = 'audio' | 'video' | 'game' | 'access';
interface Draft extends Prefs { sound: boolean; lang: Lang; quality: QualityPref }
const QUALITY: QualityPref[] = ['auto', 'low', 'medium', 'high', 'off'];

export function FlowSettings({ onClose }: { onClose: () => void }) {
  const { t, lang } = useT();
  const gfx = useGraphics();
  const l = (es: string, en: string) => (lang === 'es' ? es : en);
  const initial = (): Draft => ({ ...loadPrefs(), sound: !isMuted(), lang, quality: gfx.pref });
  const [base, setBase] = useState<Draft>(initial);
  const [d, setD] = useState<Draft>(base);
  const [tab, setTab] = useState<Tab>('audio');
  const [confirm, setConfirm] = useState<null | 'leave' | 'restore'>(null);
  const [test, setTest] = useState(false);
  const [fs, setFs] = useState(typeof document !== 'undefined' && !!document.fullscreenElement);
  const panel = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(d) !== JSON.stringify(base);
  const upd = <K extends keyof Draft>(k: K, v: Draft[K]) => setD({ ...d, [k]: v });
  const apply = () => {
    savePrefs({ master: d.master, effects: d.effects, uiScale: d.uiScale, reduceMotion: d.reduceMotion, highContrast: d.highContrast });
    setMuted(!d.sound);
    if (d.lang !== lang) setLang(d.lang);
    if (d.quality !== gfx.pref) setQualityPref(d.quality);
    setBase(d);
  };
  const back = () => (dirty ? setConfirm('leave') : onClose());
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); if (confirm) setConfirm(null); else back(); } };
    window.addEventListener('keydown', onKey);
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('fullscreenchange', onFs); prev?.focus?.(); };
  }, [confirm, dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  const canFs = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;
  const toggleFs = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); };
  const tabs: { id: Tab; es: string; en: string }[] = [{ id: 'audio', es: 'Audio', en: 'Audio' }, { id: 'video', es: 'Video', en: 'Video' }, { id: 'game', es: 'Juego', en: 'Game' }, { id: 'access', es: 'Accesibilidad', en: 'Accessibility' }];
  const range = (k: 'master' | 'effects' | 'uiScale', label: string, min: number, max: number, note?: string, disabled = false) =>
    <label className="fs-field"><span>{label}</span><span className="fs-range"><input type="range" min={min} max={max} step={k === 'uiScale' ? 5 : 1} value={d[k]} disabled={disabled} onChange={(e) => upd(k, Number(e.target.value))} aria-valuetext={`${d[k]}%`} /><output>{d[k]}%</output></span>{note && <small>{note}</small>}</label>;
  const [autosim, setAutosim] = useState(() => { try { return localStorage.getItem('ae.race.autosim') === '1'; } catch { return false; } });
  const toggle = (k: 'sound' | 'reduceMotion' | 'highContrast', label: string, note?: string) =>
    <button type="button" role="switch" aria-checked={d[k]} className="fs-toggle" data-pref={k} onClick={() => upd(k, !d[k])}><span>{label}{note && <small style={{ display: 'block', color: 'var(--fl-soft)', fontSize: 14 }}>{note}</small>}</span><b>{d[k] ? l('Sí', 'On') : l('No', 'Off')}</b></button>;

  return <div className="fs-settings-bg" style={{ backgroundImage: `linear-gradient(rgba(8,12,18,.35), rgba(8,12,18,.35)), url(${flowUrl(BG.configuracion.src)})` }} role="dialog" aria-modal="true" aria-labelledby="fs-set-h">
    <div className="fs-settings" ref={panel}>
      <header><small>Automotive Empire</small><h2 id="fs-set-h">{l('Configuración', 'Settings')}</h2>
        <button type="button" className="fm-x fs-x-top" aria-label={t('common.close')} onClick={back}><Icon name="close" /></button></header>
      <div className="fs-set-body">
        <div className="fs-set-tabs" role="tablist" aria-orientation="vertical" aria-label={l('Categorías', 'Categories')}
          onKeyDown={(e) => { const i = tabs.findIndex((x) => x.id === tab); if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); setTab(tabs[(i + 1) % tabs.length].id); } if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); setTab(tabs[(i + tabs.length - 1) % tabs.length].id); } }}>
          {tabs.map((x) => <button type="button" key={x.id} role="tab" id={`fs-tab-${x.id}`} aria-controls="fs-set-pane" aria-selected={tab === x.id} tabIndex={tab === x.id ? 0 : -1} className="fs-set-tab" data-tab={x.id} onClick={() => setTab(x.id)}>{l(x.es, x.en)}</button>)}
        </div>
        <div className="fs-set-pane" id="fs-set-pane" role="tabpanel" aria-labelledby={`fs-tab-${tab}`}>
          {tab === 'audio' && <>
            {toggle('sound', l('Efectos de sonido', 'Sound effects'), l('Desactivados por defecto. El juego no tiene música ni voces.', 'Off by default. The game has no music or voices.'))}
            {range('master', l('Volumen maestro', 'Master volume'), 0, 100, undefined, !d.sound)}
            {range('effects', l('Volumen de efectos', 'Effects volume'), 0, 100, undefined, !d.sound)}
          </>}
          {tab === 'video' && <>
            <div className="fs-field"><span>{l('Gráficos 3D opcionales', 'Optional 3D graphics')}</span>
              <div className="gfx-options fs-chiprow" role="radiogroup" aria-label={t('settings.graphics')}>
                {QUALITY.map((q) => <button key={q} type="button" role="radio" aria-checked={d.quality === q} aria-pressed={d.quality === q} className="gfx-opt fs-chip" onClick={() => upd('quality', q)}>{t(`gfx.${q}` as MessageKey)}</button>)}
              </div>
              <small>{l('Solo afectan a los visores 3D opcionales; las pantallas 2D no usan WebGL.', 'They only affect the optional 3D viewers; the 2D screens do not use WebGL.')} <button type="button" className="fs-chip" onClick={() => setTest(true)}>{l('Prueba de rendimiento 3D', '3D performance test')}</button></small>
            </div>
            {canFs && <button type="button" role="switch" aria-checked={fs} className="fs-toggle" onClick={toggleFs}><span>{l('Pantalla completa', 'Full screen')}<small style={{ display: 'block', color: 'var(--fl-soft)', fontSize: 14 }}>{l('Se aplica al instante; Esc la cierra.', 'Applies at once; Esc leaves it.')}</small></span><b>{fs ? l('Sí', 'On') : l('No', 'Off')}</b></button>}
            {range('uiScale', l('Escala de la interfaz', 'Interface scale'), 80, 130, l('El navegador decide la resolución; aquí se escala la interfaz.', 'The browser decides the resolution; this scales the interface.'))}
          </>}
          {tab === 'game' && <label className="fs-field" style={{ cursor: 'pointer' }}><span>{l('Simular carreras al avanzar varios meses', 'Simulate races when advancing several months')}<small style={{ display: 'block', opacity: 0.75 }}>{l('Desactivado: el avance de +3 meses se detiene en cada fin de semana de carrera.', 'Off: the +3 months advance stops at every race weekend.')}</small></span>
            <input type="checkbox" data-field="autosim-races" checked={autosim} onChange={(e) => { try { localStorage.setItem('ae.race.autosim', e.target.checked ? '1' : '0'); } catch { /* storage blocked */ } setAutosim(e.target.checked); }} /></label>}
          {tab === 'game' && <div className="fs-field"><span>{l('Idioma', 'Language')}</span>
            <div className="fs-chiprow" role="radiogroup" aria-label={l('Idioma', 'Language')}>{LANGS.map((x) => <button key={x.id} type="button" role="radio" aria-checked={d.lang === x.id} aria-pressed={d.lang === x.id} className="fs-chip" lang={x.id} onClick={() => upd('lang', x.id)}>{x.name}</button>)}</div>
            <small>{l('La partida se guarda sola al final de cada mes.', 'The game saves itself at the end of every month.')}</small></div>}
          {tab === 'access' && <>
            {toggle('reduceMotion', l('Reducir movimiento', 'Reduce motion'), l('Detiene animaciones decorativas (también se respeta la preferencia del sistema).', 'Stops decorative animation (the system preference is also respected).'))}
            {toggle('highContrast', l('Alto contraste', 'High contrast'), l('Textos secundarios y bordes más claros.', 'Lighter secondary text and borders.'))}
            {range('uiScale', l('Tamaño del texto y controles', 'Text and control size'), 80, 130)}
          </>}
          {confirm === 'leave' && <div className="fs-panel" role="alertdialog" aria-label={l('Cambios sin aplicar', 'Unapplied changes')}>
            <p style={{ marginTop: 0 }}>{l('Hay cambios sin aplicar.', 'There are unapplied changes.')}</p>
            <div className="fs-toolbar"><button type="button" className="fm-btn small primary" autoFocus onClick={() => { apply(); onClose(); }}>{l('Guardar', 'Save')}</button><button type="button" className="fm-btn small secondary" onClick={onClose}>{l('Descartar', 'Discard')}</button><button type="button" className="fm-btn small secondary" onClick={() => setConfirm(null)}>{l('Cancelar', 'Cancel')}</button></div>
          </div>}
          {confirm === 'restore' && <div className="fs-panel" role="alertdialog" aria-label={l('Restaurar', 'Restore')}>
            <p style={{ marginTop: 0 }}>{l('¿Restaurar las preferencias por defecto? La partida no se toca.', 'Restore the default preferences? Your game is not touched.')}</p>
            <div className="fs-toolbar"><button type="button" className="fm-btn small primary" autoFocus onClick={() => { setD({ ...d, ...DEFAULT_PREFS, sound: false, quality: 'auto' }); setConfirm(null); }}>{l('Restaurar', 'Restore')}</button><button type="button" className="fm-btn small secondary" onClick={() => setConfirm(null)}>{l('Cancelar', 'Cancel')}</button></div>
          </div>}
        </div>
      </div>
      <div className="fs-set-actions">
        <button type="button" className="fm-btn small secondary" style={{ marginRight: 'auto' }} onClick={() => setConfirm('restore')}>{l('Restaurar', 'Restore')}</button>
        <button type="button" className="fm-btn primary" data-action="settings-apply" disabled={!dirty} onClick={apply}>{l('Aplicar', 'Apply')}</button>
        <button type="button" className="fm-btn secondary" data-action="settings-back" onClick={back}>{l('Volver', 'Back')}</button>
      </div>
    </div>
    {test && <GraphicsTestDialog onClose={() => setTest(false)} />}
  </div>;
}
