// Ready-made 3D views. Everything that imports Three.js is reached through this module, which the interface loads
// lazily (see ui/Lazy3D.tsx), so the menu, dashboard and all management screens are usable before — or without —
// any 3D code being downloaded.
import { useEffect, useMemo } from 'react';
import type { Discipline, VehicleSpec } from '../sim/types';
import { defaultVehicle } from '../sim/engineering';
import { specDescriptor } from '../sim/render';
import { CarViewer, type BenchResult } from './CarViewer';
import { RaceCar, RoadCar } from './CarModel';
import { VehicleView, useVisualPlan, type AssetStatus } from './VehicleView';
import type { VisualPlan } from './assets/adapter';
import { preload } from './assets/loader';
import { SEDAN_REF } from './assets/catalog';

export function RoadCarViewer({ spec, distance, autoRotate, height }: { spec: VehicleSpec; distance?: number; autoRotate?: boolean; height?: number | string }) {
  return <CarViewer distance={distance} autoRotate={autoRotate} height={height}><RoadCar spec={spec} /></CarViewer>;
}

export function RaceCarViewer({ discipline, year, color, color2, wing = 0.5, distance, height }: { discipline: Discipline; year: number; color: string; color2: string; wing?: number; distance?: number; height?: number | string }) {
  return <CarViewer distance={distance} height={height}><RaceCar discipline={discipline} year={year} color={color} color2={color2} wing={wing} /></CarViewer>;
}

export type ShowroomScene = 'ceo' | 'founder' | 'motorsport';

/** The main menu's single canvas: one car per game mode, swapped when the player hovers a different mode. */
export function ShowroomViewer({ scene }: { scene: ShowroomScene }) {
  const classic = useMemo(() => { const s = defaultVehicle(1966, 'coupe'); s.color = '#a3161b'; s.engine.layout = 'V12'; s.tireWidth = 205; s.wheelDia = 15; s.sport = 0.7; return s; }, []);
  const modern = useMemo(() => { const s = defaultVehicle(2024, 'sedan'); s.color = '#233f6f'; s.tireWidth = 245; s.wheelDia = 19; s.finish = 'metallic'; s.wheelStyle = 'turbine'; s.interior = 'premium'; return s; }, []);
  const plan = useVisualPlan(specDescriptor(modern), 2024);
  return (
    <CarViewer distance={9.4} autoRotate target={[0, 0.5, 0]}>
      {scene === 'ceo' && <RoadCar spec={classic} />}
      {scene === 'founder' && <VehicleView plan={plan} spec={modern} />}
      {scene === 'motorsport' && <RaceCar discipline="f1" year={2024} color="#c9a35c" color2="#14161b" wing={0.6} />}
    </CarViewer>
  );
}

/** The settings dialog's frame-rate test: the modern reference car, measured at the preset in force. */
export function FpsTestViewer({ trigger, onResult }: { trigger: number; onResult: (r: BenchResult) => void }) {
  const modern = useMemo(() => { const s = defaultVehicle(2024, 'sedan'); s.color = '#233f6f'; s.tireWidth = 245; s.wheelDia = 19; s.finish = 'metallic'; s.wheelStyle = 'turbine'; return s; }, []);
  const plan = useVisualPlan(specDescriptor(modern), 2024);
  return <CarViewer distance={8.3} autoRotate target={[0, 0.58, 0]} benchTrigger={trigger} onBench={onResult}><VehicleView plan={plan} spec={modern} /></CarViewer>;
}

/** The studio viewer used by the vehicle screens: toolbar, cameras, quality menu and the asset-or-procedural car. */
export function VehicleViewer({ plan, spec, onStatus, autoRotate, sceneVersion }: { plan: VisualPlan; spec: VehicleSpec; onStatus: (s: AssetStatus, info?: string) => void; autoRotate: boolean; sceneVersion: string }) {
  useEffect(() => { preload([SEDAN_REF.wheels.url]); }, []);
  return <CarViewer controls autoRotate={autoRotate} distance={7.6} sceneVersion={sceneVersion}><VehicleView plan={plan} spec={spec} onStatus={onStatus} /></CarViewer>;
}
