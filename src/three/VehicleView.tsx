// The car in a 3D view, from its render descriptor (Phase 4).
//
// If a GLB asset fits the descriptor it is loaded (cached), stretched and styled; until it is ready, or if it fails,
// the procedural model from the specification is shown instead, so a view is never empty.
import { useEffect, useRef, useState } from 'react';
import type { VehicleSpec } from '../sim/types';
import type { RenderDescriptor } from '../sim/render';
import type { AssetPlan, VisualPlan } from './assets/adapter';
import { buildCar, disposeCar, structureKey, styleCar, type CarInstance } from './assets/instance';
import { loadGLB, loadJSON } from './assets/loader';
import type { TireProfile } from './assets/tire';
import { RoadCar } from './CarModel';
import { ViewerBoundary } from './CarViewer';
import { useQuality } from './quality';

export { useVisualPlan } from './assets/usePlan';

export type AssetStatus = 'loading' | 'ready' | 'failed' | 'procedural';

function AssetCar({ plan, fallback, onStatus, lodOverride }: { plan: AssetPlan; fallback: React.ReactNode; onStatus?: (s: AssetStatus, info?: string) => void; lodOverride?: number }) {
  const [, Q] = useQuality();
  const lod = Math.min(lodOverride ?? Q.lod, plan.asset.lods.length - 1);
  const skey = structureKey(plan, lod) + '|' + Q.tireSegments + '|' + Q.transmission;
  const [inst, setInst] = useState<CarInstance | null>(null);
  const [failed, setFailed] = useState(false);
  const planRef = useRef(plan);
  planRef.current = plan;
  const current = useRef<CarInstance | null>(null);
  useEffect(() => {
    let alive = true;
    onStatus?.('loading');
    const t0 = performance.now();
    Promise.all([loadGLB(plan.asset.lods[lod].url), loadGLB(plan.asset.wheels.url), loadJSON<TireProfile>(plan.asset.wheels.tireProfile)])
      .then(([car, wheels, tire]) => {
        if (!alive) return;
        const t1 = performance.now();
        const built = buildCar(planRef.current, car, wheels, tire, Q.tireSegments, Q.transmission, lod);
        const t2 = performance.now();
        (globalThis as { __aeAssetTiming?: unknown }).__aeAssetTiming = { loadMs: Math.round(t1 - t0), buildMs: Math.round(t2 - t1), lod, triangles: built.stats.triangles, meshes: built.stats.meshes };
        const old = current.current;
        current.current = built;
        setInst(built);
        if (old) disposeCar(old);
        onStatus?.('ready', `${built.stats.triangles.toLocaleString()} triangles · LOD${lod}`);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setFailed(true);
        onStatus?.('failed', e instanceof Error ? e.message : String(e));
      });
    return () => { alive = false; };
  }, [skey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (current.current) disposeCar(current.current); current.current = null; }, []);
  const styleKey = JSON.stringify([plan.paint, plan.trimStyle, plan.interior, plan.wheels.rimFinish, plan.wheels.caliperColor, plan.visible]);
  useEffect(() => { if (inst) styleCar(inst, planRef.current); }, [inst, styleKey]);
  if (failed || !inst) return <>{fallback}</>;
  return <primitive object={inst.root} />;
}

/** A car from its descriptor: the GLB asset when one fits, otherwise (and while loading) the procedural model. */
export function VehicleView({ plan, spec, onStatus, lodOverride }: { plan: VisualPlan; spec: VehicleSpec; onStatus?: (s: AssetStatus, info?: string) => void; lodOverride?: number }) {
  const proc = <RoadCar spec={spec} />;
  useEffect(() => { if (plan.kind === 'procedural') onStatus?.('procedural', plan.reason); }, [plan, onStatus]);
  if (plan.kind === 'procedural') return proc;
  return (
    <ViewerBoundary fallback={proc} onError={(e) => onStatus?.('failed', e.message)}>
      <AssetCar plan={plan} fallback={proc} onStatus={onStatus} lodOverride={lodOverride} />
    </ViewerBoundary>
  );
}
