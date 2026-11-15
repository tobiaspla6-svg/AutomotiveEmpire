// Settings: language, graphics preset, and a real frame-rate test with instructions for validating on your own hardware.
import { useState } from 'react';
import { LANGS, setLang, useT, type MessageKey } from '../i18n';
import { clearWebglFailure } from '../three/hardware';
import { judgeFps } from '../three/hardware';
import { setQualityPref, useGraphics, type QualityPref } from '../three/quality';
import type { BenchResult } from '../three/CarViewer';
import { Modal } from './common';
import { Icon } from './ds/icons';
import { CarPoster } from './ds/poster';
import { FpsTestViewer, Guard3D } from './Lazy3D';
import { Seg } from './common';
import { FlowSettings } from './flow/FlowSettings';
export { FlowSettings as SettingsDialog };

const PREFS: { id: QualityPref; name: MessageKey; desc: MessageKey }[] = [
  { id: 'auto', name: 'gfx.auto', desc: 'gfx.auto.desc' },
  { id: 'low', name: 'gfx.low', desc: 'gfx.low.desc' },
  { id: 'medium', name: 'gfx.medium', desc: 'gfx.medium.desc' },
  { id: 'high', name: 'gfx.high', desc: 'gfx.high.desc' },
  { id: 'off', name: 'gfx.off', desc: 'gfx.off.desc' },
];

/** The 3D graphics test (preset list and frame-rate test), opened from the Video tab. */
export function GraphicsTestDialog({ onClose }: { onClose: () => void }) {
  const { t, lang } = useT();
  const gfx = useGraphics();
  const [trigger, setTrigger] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BenchResult | null>(null);
  const run = () => { setResult(null); setRunning(true); setTrigger((n) => n + 1); };
  const quality = gfx.effective === 'off' ? 'low' : gfx.effective;
  const verdict = result ? judgeFps(result.avgFps, result.quality) : null;
  return (
    <Modal onClose={onClose} wide>
      <div className="row between"><h2>{t('settings.title')}</h2><button className="iconbtn" onClick={onClose} aria-label={t('common.close')}><Icon name="close" /></button></div>

      <div className="settings-grid">
        <section className="col" style={{ gap: 8 }}>
          <h4>{t('settings.language')}</h4>
          <Seg value={lang} options={LANGS.map((l) => ({ value: l.id, label: l.name }))} onChange={setLang} />
          <p className="small muted">{t('settings.language.note')}</p>

          <h4 style={{ marginTop: 12 }}>{t('settings.graphics')}</h4>
          <p className="small dim">{t('settings.graphics.blurb')}</p>
          <div className="gfx-options" role="radiogroup" aria-label={t('settings.graphics')}>
            {PREFS.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={gfx.pref === p.id} className={'gfx-opt' + (gfx.pref === p.id ? ' on' : '')} onClick={() => { setQualityPref(p.id); setResult(null); }}>
                <b>{t(p.name)}{p.id === 'auto' && gfx.recommended !== 'off' && <span className="muted"> · {t('gfx.' + gfx.recommended as MessageKey)}</span>}</b>
                <span>{t(p.desc)}</span>
              </button>
            ))}
          </div>
          <div className="small muted col" style={{ gap: 3 }}>
            <span>{t('gfx.detected', { gpu: gfx.hardware.webgl === 'none' ? t('gfx.none') : gfx.hardware.renderer })}</span>
            {gfx.hardware.webgl === 'none' && <span className="warn">{t('gfx.nowebgl')}</span>}
            {gfx.hardware.software && <span className="warn">{t('gfx.software')}</span>}
            {gfx.failed && <span className="warn">{t('gfx.failed')} <button className="btn sm" onClick={clearWebglFailure}>{t('gfx.retry')}</button></span>}
          </div>
        </section>

        <section className="col" style={{ gap: 8 }}>
          <h4>{t('fps.title')}</h4>
          <p className="small dim">{t('fps.blurb')}</p>
          <div className="fps-stage">
            <Guard3D eager poster={<CarPoster kind="sedan" color="#233f6f" label={t('fps.noview')} />}>
              <FpsTestViewer trigger={trigger} onResult={(r) => { setResult(r); setRunning(false); }} />
            </Guard3D>
          </div>
          <div className="row wrap" style={{ gap: 10 }}>
            <button className="btn primary" disabled={!gfx.enabled || running} onClick={run}><Icon name="gauge" size={16} />{running ? t('fps.running') : t('fps.run')}</button>
            <span className="small muted">{gfx.enabled ? t('fps.at', { q: t(`gfx.${quality}` as MessageKey) }) : t('fps.off')}</span>
          </div>
          {result && (
            <div className={'fps-result ' + (verdict === 'step-down' ? 'bad' : verdict === 'step-up' ? 'good' : '')} role="status">
              <b className="display" style={{ fontSize: 26 }}>{Math.round(result.avgFps)} FPS</b>
              <span className="small">{t('fps.result', { ms: result.p95Ms.toFixed(0), calls: result.drawCalls, tris: Math.round(result.triangles / 1000) })}</span>
              <span>{verdict === 'step-up' ? t('fps.verdict.up') : verdict === 'step-down' ? t('fps.verdict.down') : t('fps.verdict.ok')}</span>
              {gfx.hardware.software && <span className="small warn">{t('fps.software')}</span>}
            </div>
          )}
          <details className="howto">
            <summary>{t('fps.howto.title')}</summary>
            <ol>
              <li>{t('fps.howto.1')}</li><li>{t('fps.howto.2')}</li><li>{t('fps.howto.3')}</li><li>{t('fps.howto.4')}</li>
            </ol>
          </details>
        </section>
      </div>
      <div className="row end"><button className="btn primary" onClick={onClose}>{t('common.done')}</button></div>
    </Modal>
  );
}

/** A top-bar / menu button that opens the settings dialog. */
export function SettingsButton({ className = 'iconbtn' }: { className?: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return <><button className={className} data-action="settings" onClick={() => setOpen(true)} aria-label={t('settings.title')} title={t('settings.title')}>{className === 'fm-gear' ? <Gear /> : <Icon name="sliders" />}</button>{open && <FlowSettings onClose={() => setOpen(false)} />}</>;
}
/** A gear (settings), drawn inline: the icon set has no gear. */
export function Gear() {
  return <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="currentColor"><path d="M10.3 2h3.4l.5 2.6c.6.2 1.2.5 1.7.9l2.5-1 1.7 2.9-2 1.7c.1.6.1 1.3 0 1.9l2 1.7-1.7 2.9-2.5-1c-.5.4-1.1.7-1.7.9l-.5 2.6h-3.4l-.5-2.6c-.6-.2-1.2-.5-1.7-.9l-2.5 1-1.7-2.9 2-1.7a6 6 0 0 1 0-1.9l-2-1.7 1.7-2.9 2.5 1c.5-.4 1.1-.7 1.7-.9zM12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z" /></svg>;
}
