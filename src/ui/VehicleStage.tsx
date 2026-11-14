// A vehicle in the studio viewer with an honest summary of what the 3D model shows (Phase 4).
import { useCallback, useState, type ReactNode } from 'react';
import type { VehicleSpec } from '../sim/types';
import type { RenderDescriptor } from '../sim/render';
import type { AssetStatus } from '../three/VehicleView';
import { useVisualPlan } from '../three/assets/usePlan';
import { FINISH_NAME } from '../three/assets/names';
import type { VisualPlan } from '../three/assets/adapter';
import { CarPoster, posterForBody } from './ds/poster';
import { Guard3D, VehicleViewer } from './Lazy3D';
import { useT, type MessageKey, type Vars } from '../i18n';
import { useTerm } from '../i18n/terms';
import { useGraphics } from '../three/quality';

/** One line describing what the 3D view draws, from the plan (never more than the asset supports). */
export function shownSummary(plan: VisualPlan, desc: RenderDescriptor, t: (key: MessageKey, vars?: Vars) => string, term: (s: string) => string): string {
  if (plan.kind === 'procedural') return t('stage.proceduralNote');
  const w = plan.wheels;
  const exhaust = ['single', 'dual', 'quad'].find((x) => plan.visible[`exhaust_${x}`]);
  const parts = [
    t('stage.sum.paint', { finish: term(FINISH_NAME[plan.paint.finish]).toLowerCase() }),
    t('stage.sum.wheels', { inch: Math.round(w.rimDia / 0.0254), style: t(`stage.rim.${w.rim}` as MessageKey) }),
    t('stage.sum.tyres', { mm: Math.round(w.tireWidth * 1000) }),
    desc.engine.electric ? t('stage.sum.ev') : exhaust ? t(`stage.exhaust.${exhaust}` as MessageKey) : t('stage.exhaust.none'),
    plan.visible.aero_wing ? t('stage.sum.wing') : plan.visible.aero_lip_spoiler ? t('stage.sum.lip') : null,
    plan.visible.aero_splitter ? t('stage.sum.splitter') : null,
    plan.visible.aero_skirts ? t('stage.sum.skirts') : null,
    t(plan.interior.leather ? 'stage.sum.leather' : 'stage.sum.cloth'),
  ].filter(Boolean);
  return parts.join(' · ');
}

export function VehicleStage({ desc, spec, year, title, height, autoRotate = true, extra }: {
  desc: RenderDescriptor; spec: VehicleSpec; year?: number; title?: ReactNode; height?: number | string; autoRotate?: boolean; extra?: ReactNode;
}) {
  const { t } = useT();
  const term = useTerm();
  const gfx = useGraphics();
  const plan = useVisualPlan(desc, year);
  const [status, setStatus] = useState<{ s: AssetStatus; info?: string }>({ s: plan.kind === 'asset' ? 'loading' : 'procedural' });
  const onStatus = useCallback((s: AssetStatus, info?: string) => setStatus({ s, info }), []);
  return (
    <div className="stage-wrap">
      <div className="viewer studio" style={{ height: height ?? 420 }}>
        <Guard3D eager poster={<CarPoster kind={posterForBody(desc.body)} color={desc.color} label={t('stage.poster')} className="poster-hero" />}>
          <VehicleViewer plan={plan} spec={spec} onStatus={onStatus} autoRotate={autoRotate} sceneVersion={`${status.s}|${status.info ?? ''}|${JSON.stringify(desc)}`} />
        </Guard3D>
        {title && <div className="overlay">{title}</div>}
        <div className={'vstatus ' + (gfx.enabled ? status.s : 'off')} title={status.info}>
          {!gfx.enabled ? t('stage.poster') : status.s === 'loading' ? t('stage.loading') : status.s === 'ready' ? t('stage.asset', { name: plan.kind === 'asset' ? plan.asset.name : '' }) : status.s === 'failed' ? t('stage.failed') : t('stage.procedural')}
        </div>
      </div>
      <div className="stage-notes">
        <span className="tiny">{shownSummary(plan, desc, t, term)}</span>
        {plan.kind === 'procedural' && <span className="tiny muted"> — {plan.reason}</span>}
        {plan.kind === 'asset' && plan.notes.map((n) => <div key={n} className="tiny warn">{n}</div>)}
        {extra}
      </div>
    </div>
  );
}
