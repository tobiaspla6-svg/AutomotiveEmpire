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

const RIM_NAME = { rim_sport5: 'five-spoke', rim_turbine10: 'turbine', rim_multi15: 'multi-spoke' } as const;

/** One line describing what the 3D view draws, from the plan (never more than the asset supports). */
export function shownSummary(plan: VisualPlan, desc: RenderDescriptor): string {
  if (plan.kind === 'procedural') return 'Procedural preview generated from the specification.';
  const w = plan.wheels;
  const parts = [
    `${FINISH_NAME[plan.paint.finish].toLowerCase()} paint`,
    `${Math.round(w.rimDia / 0.0254)}" ${RIM_NAME[w.rim]} wheels`,
    `${Math.round(w.tireWidth * 1000)} mm tyres`,
    desc.engine.electric ? 'closed EV grille, no exhausts' : `${['single', 'dual', 'quad'].find((k) => plan.visible[`exhaust_${k}`]) ?? 'no'} exhaust`,
    plan.visible.aero_wing ? 'rear wing' : plan.visible.aero_lip_spoiler ? 'lip spoiler' : null,
    plan.visible.aero_splitter ? 'front splitter' : null,
    plan.visible.aero_skirts ? 'side skirts' : null,
    `${plan.trimStyle} exterior trim`,
    `${plan.interior.leather ? 'leather' : 'cloth'} interior with ${plan.interior.accent} inlays`,
  ].filter(Boolean);
  return parts.join(' · ');
}

export function VehicleStage({ desc, spec, year, title, height, autoRotate = true, extra }: {
  desc: RenderDescriptor; spec: VehicleSpec; year?: number; title?: ReactNode; height?: number | string; autoRotate?: boolean; extra?: ReactNode;
}) {
  const plan = useVisualPlan(desc, year);
  const [status, setStatus] = useState<{ s: AssetStatus; info?: string }>({ s: plan.kind === 'asset' ? 'loading' : 'procedural' });
  const onStatus = useCallback((s: AssetStatus, info?: string) => setStatus({ s, info }), []);
  return (
    <div className="stage-wrap">
      <div className="viewer studio" style={{ height: height ?? 420 }}>
        <Guard3D eager poster={<CarPoster kind={posterForBody(desc.body)} color={desc.color} label="3D" className="poster-hero" />}>
          <VehicleViewer plan={plan} spec={spec} onStatus={onStatus} autoRotate={autoRotate} sceneVersion={`${status.s}|${status.info ?? ''}|${JSON.stringify(desc)}`} />
        </Guard3D>
        {title && <div className="overlay">{title}</div>}
        <div className={'vstatus ' + status.s} title={status.info}>
          {status.s === 'loading' ? 'Loading 3D asset…' : status.s === 'ready' ? `Asset: ${plan.kind === 'asset' ? plan.asset.name : ''}` : status.s === 'failed' ? 'Asset failed to load — procedural preview' : 'Procedural preview'}
        </div>
      </div>
      <div className="stage-notes">
        <span className="tiny">{shownSummary(plan, desc)}</span>
        {plan.kind === 'procedural' && <span className="tiny muted"> — {plan.reason}</span>}
        {plan.kind === 'asset' && plan.notes.map((n) => <div key={n} className="tiny warn">{n}</div>)}
        {extra}
      </div>
    </div>
  );
}
