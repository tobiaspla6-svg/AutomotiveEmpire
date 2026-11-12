// Phase 4: building a car from a plan with Three.js (no WebGL needed): stretching, wheel placement, component
// visibility, per-car materials that never touch the shared template, restyling without rebuilding, disposal, and
// the parametric tyre.
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { defaultVehicle } from '../src/sim/engineering';
import { specDescriptor } from '../src/sim/render';
import { planVehicle, mapX, type AssetPlan } from '../src/three/assets/adapter';
import { buildCar, disposeCar, structureKey, styleCar } from '../src/three/assets/instance';
import { tireGeometry, tireSection, type TireProfile } from '../src/three/assets/tire';
import type { VehicleSpec } from '../src/sim/types';

const PROFILE: TireProfile = {
  profile: [[0, 0.86], [0.3, 1.03], [0.66, 1.03], [0.9, 0.93], [0.99, 0.78], [1, 0.68], [1, 0.5], [1, 0]],
  grooves: [[-0.62, 0.065], [-0.22, 0.06], [0.22, 0.06], [0.62, 0.065]], grooveDepth: 0.007,
};

const mat = (name: string) => { const m = new THREE.MeshStandardMaterial({ color: '#808080' }); m.name = name; return m; };
const mesh = (name: string, material: THREE.Material, geo: THREE.BufferGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2)) => { const m = new THREE.Mesh(geo, material); m.name = name; return m; };
const group = (name: string, ...children: THREE.Object3D[]) => { const g = new THREE.Group(); g.name = name; children.forEach((c) => g.add(c)); return g; };

/** A GLB-shaped template with the node and material contract of the sedan asset. */
function fakeCar(): GLTF {
  const paint = mat('paint_body');
  // a body mesh whose vertices sit at known x: the native front axle, the rear end and the front end
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([1.45, 0.5, -0.9, -2.49, 0.5, 0.9, 2.335, 1.0, 0, 0, 1.4, 0], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, -1, 0, 0, 1, 1, 0, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const scene = group('Scene',
    group('body', mesh('shell', paint, g), mesh('trim', mat('trim_chrome'))),
    group('grille_ice', mesh('bars', mat('trim_chrome'))), group('grille_ev', mesh('panel', mat('trim_black'))),
    group('exhaust_single', mesh('e1', mat('exhaust'))), group('exhaust_dual', mesh('e2', mat('exhaust'))), group('exhaust_quad', mesh('e4', mat('exhaust'))),
    group('aero_lip_spoiler', mesh('lip', mat('paint'))), group('aero_wing', mesh('wing', mat('trim_black'))),
    group('aero_splitter', mesh('split', mat('trim_black'))), group('aero_skirts', mesh('skirt', mat('trim_black'))),
    group('interior', mesh('seat', mat('int_upholstery')), mesh('inlay', mat('int_accent'))),
  );
  return { scene } as unknown as GLTF;
}
function fakeWheels(): GLTF {
  const rim = (n: string) => group(n, mesh(n + '_face', mat('rim_alloy')));
  return { scene: group('Scene', rim('rim_sport5'), rim('rim_turbine10'), rim('rim_multi15'), group('brake_disc', mesh('disc', mat('brake_disc'))), group('caliper', mesh('cal', mat('caliper')))) } as unknown as GLTF;
}
const sedan = (o: Partial<VehicleSpec> = {}): VehicleSpec => ({ ...defaultVehicle(2024, 'sedan'), ...o });
const plan = (s: VehicleSpec, level: 'entry' | 'sport' | 'luxury' | 'base' = 'base') => {
  const p = planVehicle(specDescriptor(s, { name: 'x', level }), 2024);
  expect(p.kind).toBe('asset');
  return p as AssetPlan;
};

describe('car instance', () => {
  it('stretches the body exactly as the plan says and lifts it to the ride height', () => {
    const car = fakeCar(), wheels = fakeWheels();
    const p = plan(sedan({ size: 1.1, sport: 1 }));
    const inst = buildCar(p, car, wheels, PROFILE);
    const shell = inst.root.getObjectByName('shell') as THREE.Mesh;
    const pos = shell.geometry.getAttribute('position');
    expect(pos.getX(0)).toBeCloseTo(p.drawn.wheelbase / 2, 5);           // front axle → new front axle
    expect(pos.getX(1)).toBeCloseTo(mapX(-2.49, p.xKnots), 5);           // rear end
    expect(pos.getY(2)).toBeCloseTo(1.0 * p.scaleY, 5);
    expect(pos.getZ(1)).toBeCloseTo(0.9 * p.scaleZ, 5);
    expect(shell.parent!.parent!.position.y).toBeCloseTo(p.bodyLift, 9);
    // normals stay unit length
    const n = shell.geometry.getAttribute('normal');
    for (let i = 0; i < n.count; i++) expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 5);
    // the template is untouched
    const tpl = (car.scene.getObjectByName('shell') as THREE.Mesh).geometry.getAttribute('position');
    expect(tpl.getX(0)).toBeCloseTo(1.45, 6);
  });

  it('places four wheels at the hubs, mirrors the right side and sizes rims and tyres', () => {
    const p = plan(sedan({ wheelDia: 19, tireWidth: 245 }));
    const inst = buildCar(p, fakeCar(), fakeWheels(), PROFILE);
    for (const c of ['FL', 'FR', 'RL', 'RR'] as const) {
      const w = inst.root.getObjectByName(`wheel_${c}`)!;
      expect(w.position.toArray()).toEqual(p.wheels.positions[c]);
      expect(w.scale.z).toBe(c[1] === 'R' ? -1 : 1);
      const rim = w.getObjectByName(p.wheels.rim)!;
      expect(rim.scale.x).toBeCloseTo(p.wheels.rimDia / (19 * 0.0254), 9);
      const tire = w.getObjectByName('tire') as THREE.Mesh;
      tire.geometry.computeBoundingBox();
      const bb = tire.geometry.boundingBox!;
      expect(bb.max.x).toBeCloseTo(p.wheels.tireRadius, 3);
    }
  });

  it('shows only the components the plan asks for', () => {
    const p = plan(sedan({ wing: 0.8, splitter: 0, flatFloor: false }));
    const inst = buildCar(p, fakeCar(), fakeWheels(), PROFILE);
    const vis = (n: string) => inst.root.getObjectByName(n)!.visible;
    expect(vis('aero_wing')).toBe(true);
    expect(vis('aero_lip_spoiler')).toBe(false);
    expect(vis('aero_splitter')).toBe(false);
    expect(vis('grille_ice')).toBe(true);
    expect(vis('grille_ev')).toBe(false);
    expect([vis('exhaust_single'), vis('exhaust_dual'), vis('exhaust_quad')].filter(Boolean).length).toBe(1);
  });

  it('owns its customisable materials, restyles them in place and leaves the template alone', () => {
    const car = fakeCar();
    const p = plan(sedan({ color: '#3366aa', finish: 'metallic' }), 'sport');
    const inst = buildCar(p, car, fakeWheels(), PROFILE);
    const paint = inst.materials.get('paint_body') as THREE.MeshPhysicalMaterial;
    expect(paint).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect('#' + paint.color.getHexString()).toBe('#3366aa');
    expect(paint.clearcoat).toBe(1);
    const tplPaint = (car.scene.getObjectByName('shell') as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(tplPaint).not.toBe(paint);
    expect(tplPaint.color.getHexString()).toBe('808080');
    // restyle: new colour and finish, same geometry
    const before = (inst.root.getObjectByName('shell') as THREE.Mesh).geometry;
    const q = { ...p, paint: { color: '#aa2211', finish: 'matte' as const } };
    expect(structureKey(q, 0)).toBe(structureKey(p, 0));
    styleCar(inst, q);
    expect('#' + paint.color.getHexString()).toBe('#aa2211');
    expect(paint.clearcoat).toBe(0);
    expect((inst.root.getObjectByName('shell') as THREE.Mesh).geometry).toBe(before);
    // trim, calipers and interior follow the plan
    expect((inst.materials.get('trim_chrome') as THREE.MeshStandardMaterial).color.getHexString()).toBe('0b0b0c');
    expect('#' + (inst.materials.get('caliper') as THREE.MeshStandardMaterial).color.getHexString()).toBe(p.wheels.caliperColor);
    // a different wheel size or rim design needs a rebuild
    expect(structureKey(plan(sedan({ color: '#3366aa', wheelDia: 20 }), 'sport'), 0)).not.toBe(structureKey(p, 0));
    expect(structureKey({ ...p, wheels: { ...p.wheels, rim: 'rim_multi15' } }, 0)).not.toBe(structureKey(p, 0));
  });

  it('disposes everything it owns and nothing it shares', () => {
    const car = fakeCar();
    const inst = buildCar(plan(sedan()), car, fakeWheels(), PROFILE);
    const owned = inst.geometries.map((g) => vi.spyOn(g, 'dispose'));
    const mats = [...inst.materials.values()].map((m) => vi.spyOn(m, 'dispose'));
    const tplGeo = vi.spyOn((car.scene.getObjectByName('shell') as THREE.Mesh).geometry, 'dispose');
    const parent = new THREE.Group();
    parent.add(inst.root);
    disposeCar(inst);
    for (const s of [...owned, ...mats]) expect(s).toHaveBeenCalled();
    expect(tplGeo).not.toHaveBeenCalled();
    expect(inst.root.parent).toBeNull();
  });
});

describe('parametric tyre', () => {
  it('spans exactly the rim seat to the tread at the given width', () => {
    for (const [rim, outer, width] of [[0.2286, 0.339, 0.245], [0.19, 0.30, 0.195], [0.267, 0.345, 0.305]]) {
      const sec = tireSection(PROFILE, rim, outer, width);
      const rs = sec.map((p) => p[0]), ys = sec.map((p) => p[1]);
      expect(Math.min(...rs)).toBeCloseTo(rim, 9);
      expect(Math.max(...rs)).toBeCloseTo(outer, 9);
      expect(Math.max(...ys)).toBeLessThanOrEqual(width / 2 * 1.031 + 1e-9);
      expect(Math.max(...ys)).toBeGreaterThan(width / 2);
      const g = tireGeometry(PROFILE, rim, outer, width, 48);
      g.computeBoundingBox();
      expect(g.boundingBox!.max.x).toBeCloseTo(outer, 6);
      expect(tireGeometry(PROFILE, rim, outer, width, 48)).toBe(g); // cached per size
    }
  });
});
