// Build one car from a visual plan and the shared GLB templates (Phase 4).
//
// Geometry: the body's node graph is cloned (sharing the template's buffers) and each body mesh gets its own copy of
// the vertex data stretched to the plan's dimensions (x through the arch-preserving knots, y and z by scale), with
// normals corrected for the non-uniform stretch. Wheels are clones of the rim and brake templates placed at the hub
// centres, scaled to the rim size; the tyre is revolved from the shared profile for the exact tyre size.
// Appearance (paint, trim, wheels, calipers, interior, component visibility) is applied separately so a colour change
// never rebuilds geometry.
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mapX, type AssetPlan } from './adapter';
import { applyAccent, applyPaint, applyRim, applyTrim, applyUpholstery, makePaint } from './looks';
import { rubberMaterial, tireGeometry, type TireProfile } from './tire';

export interface CarInstance {
  root: THREE.Group;
  geometries: THREE.BufferGeometry[];
  materials: Map<string, THREE.Material>;
  components: Map<string, THREE.Object3D>;
  stats: { meshes: number; triangles: number };
}

const NATIVE_RIM_DIA = 19 * 0.0254;
const NATIVE_RIM_WIDTH = 0.216;

function stretchGeometry(src: THREE.BufferGeometry, world: THREE.Matrix4, plan: AssetPlan): THREE.BufferGeometry {
  const g = src.clone();
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const nor = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const inv = world.clone().invert();
  const nm = new THREE.Matrix3().getNormalMatrix(world);
  const nmInv = new THREE.Matrix3().getNormalMatrix(inv);
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  const k = plan.xKnots;
  const slope = (x: number) => {
    const a = k.native, b = k.target;
    for (let i = 1; i < a.length; i++) if (x <= a[i]) return (b[i] - b[i - 1]) / (a[i] - a[i - 1]);
    return 1;
  };
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(world);
    const sx = slope(v.x);
    if (nor) {
      n.fromBufferAttribute(nor, i).applyMatrix3(nm);
      n.set(n.x / sx, n.y / plan.scaleY, n.z / plan.scaleZ).normalize().applyMatrix3(nmInv).normalize();
      nor.setXYZ(i, n.x, n.y, n.z);
    }
    v.set(mapX(v.x, k), v.y * plan.scaleY, v.z * plan.scaleZ).applyMatrix4(inv);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  if (nor) nor.needsUpdate = true;
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

const tuned = new WeakSet<object>();
/** One-time adjustments of the shared template materials (glass, lamp lenses) for the WebGL renderer. */
export function tuneTemplate(gltf: GLTF) {
  if (tuned.has(gltf)) return;
  tuned.add(gltf);
  gltf.scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined;
    if (!m || !(o as THREE.Mesh).isMesh) return;
    if (m.name === 'glass') { m.color.set('#0c1014'); m.opacity = 0.42; m.roughness = 0.02; m.metalness = 0; m.depthWrite = false; m.envMapIntensity = 1.6; }
    else if (m.name === 'lamp_lens') { m.opacity = 0.16; m.roughness = 0.0; m.depthWrite = false; m.envMapIntensity = 1.4; }
    else if (m.name === 'lamp_lens_red') { m.color.set('#9a0910'); m.emissive.set('#5a0306'); m.emissiveIntensity = 1; m.opacity = 0.97; m.roughness = 0.1; m.depthWrite = false; }
    else if (m.name === 'paint_body') {
      for (const t of [m.map, m.normalMap]) if (t) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; t.needsUpdate = true; }
    }
    else if (m.name === 'lamp_lens_inner') { m.depthWrite = false; }
    else if (m.name === 'lamp_led_red') { m.emissiveIntensity = 2.5; }
    else if (m.name === 'mirror_glass') { m.roughness = 0.0; m.metalness = 1; }
    m.needsUpdate = true;
  });
}

const OVERRIDE = ['paint', 'paint_body', 'trim_chrome', 'caliper', 'int_upholstery', 'int_accent', 'rim_alloy'];
const TRANSMISSIVE = ['glass', 'lamp_lens', 'lamp_lens_red'];

/** Physically transmissive glass and lenses (High quality): real Fresnel reflections, the interior seen through. */
export function transmissiveMaterial(name: string): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({ name, metalness: 0, transmission: 1, thickness: 0.004, roughness: 0.015, ior: 1.5, envMapIntensity: 1.25 });
  if (name === 'glass') { m.color.set('#cfdadd'); m.attenuationColor.set('#55666d'); m.attenuationDistance = 0.35; m.thickness = 0.005; }
  else if (name === 'lamp_lens') { m.color.set('#ffffff'); m.ior = 1.49; m.roughness = 0.0; }
  else { m.color.set('#c0101a'); m.transmission = 0.7; m.roughness = 0.06; m.emissive.set('#3a0204'); m.attenuationColor.set('#8a0008'); m.attenuationDistance = 0.02; m.thickness = 0.006; }
  return m;
}

export function buildCar(plan: AssetPlan, car: GLTF, wheels: GLTF, tire: TireProfile, tireSegments = 96, transmission = false, lod = 0): CarInstance {
  const root = new THREE.Group();
  root.name = plan.asset.id;
  const geometries: THREE.BufferGeometry[] = [];
  const materials = new Map<string, THREE.Material>();
  const components = new Map<string, THREE.Object3D>();
  const own = (m: THREE.Material): THREE.Material => {
    const glassy = transmission && TRANSMISSIVE.includes(m.name);
    if (!OVERRIDE.includes(m.name) && !glassy) return m;
    let o = materials.get(m.name);
    if (!o) {
      o = glassy ? transmissiveMaterial(m.name) : m.name === 'paint' || m.name === 'paint_body' ? makePaint(m, plan.paint.color, plan.paint.finish, lod === 0) : m.clone();
      materials.set(m.name, o);
    }
    return o;
  };
  tuneTemplate(car);
  tuneTemplate(wheels);
  // ------------------------------------------------------------------ body
  const body = car.scene.clone(true);
  body.updateMatrixWorld(true);
  let tris = 0, meshes = 0;
  body.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = stretchGeometry(mesh.geometry, mesh.matrixWorld, plan);
    geometries.push(g);
    mesh.geometry = g;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(own) : own(mesh.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshes++;
    tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  });
  for (const child of body.children) components.set(child.name, child);
  body.position.y = plan.bodyLift;
  root.add(body);
  // ------------------------------------------------------------------ wheels
  const w = plan.wheels;
  const rimTpl = wheels.scene.getObjectByName(w.rim);
  const discTpl = wheels.scene.getObjectByName('brake_disc');
  const calTpl = wheels.scene.getObjectByName('caliper');
  const tireGeo = tireGeometry(tire, w.rimDia / 2, w.tireRadius, w.tireWidth, tireSegments);
  const sR = w.rimDia / NATIVE_RIM_DIA, sA = w.rimWidth / NATIVE_RIM_WIDTH;
  for (const corner of ['FL', 'FR', 'RL', 'RR'] as const) {
    const grp = new THREE.Group();
    grp.name = `wheel_${corner}`;
    const [x, y, z] = w.positions[corner];
    grp.position.set(x, y, z);
    if (corner[1] === 'R') grp.scale.z = -1; // mirror: outboard face towards +z on the right
    if (rimTpl) {
      const r = rimTpl.clone(true);
      r.position.set(0, 0, 0);
      r.scale.set(sR, sR, sA);
      r.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = own(m.material as THREE.Material); m.castShadow = true; tris += (m.geometry.index?.count ?? 0) / 3; meshes++; } });
      grp.add(r);
    }
    if (discTpl) { const d = discTpl.clone(true); d.position.set(0, 0, 0); d.scale.set(w.brakeScale, w.brakeScale, 1); grp.add(d); }
    if (calTpl) {
      const c = calTpl.clone(true);
      c.position.set(0, 0, 0);
      c.scale.set(w.brakeScale, w.brakeScale, 1);
      c.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.material = own(m.material as THREE.Material); });
      grp.add(c);
    }
    const t = new THREE.Mesh(tireGeo, rubberMaterial());
    t.castShadow = true;
    t.name = 'tire';
    grp.add(t);
    tris += (tireGeo.index?.count ?? 0) / 3;
    meshes++;
    root.add(grp);
  }
  const inst: CarInstance = { root, geometries, materials, components, stats: { meshes, triangles: Math.round(tris) } };
  styleCar(inst, plan);
  return inst;
}

/** Paint, trim, wheel finish, calipers, interior and which swappable components are shown. */
export function styleCar(inst: CarInstance, plan: AssetPlan) {
  for (const [name, m] of inst.materials) {
    const mm = m as THREE.MeshPhysicalMaterial;
    if (name === 'paint' || name === 'paint_body') applyPaint(mm, plan.paint.color, plan.paint.finish);
    else if (name === 'trim_chrome') applyTrim(mm, plan.trimStyle);
    else if (name === 'rim_alloy') applyRim(mm, plan.wheels.rimFinish);
    else if (name === 'caliper') mm.color.set(plan.wheels.caliperColor);
    else if (name === 'int_upholstery') applyUpholstery(mm, plan.interior.upholstery, plan.interior.leather);
    else if (name === 'int_accent') applyAccent(mm, plan.interior.accent);
    mm.needsUpdate = true;
  }
  for (const [name, obj] of inst.components) if (name in plan.visible) obj.visible = plan.visible[name];
}

export function disposeCar(inst: CarInstance) {
  for (const g of inst.geometries) g.dispose();
  for (const m of inst.materials.values()) m.dispose();
  inst.root.removeFromParent();
}

/** Geometry key: a rebuild is needed only when one of these changes (colours and finishes are restyled in place). */
export function structureKey(plan: AssetPlan, lod: number): string {
  const w = plan.wheels;
  return [plan.asset.id, lod, plan.xKnots.target.map((v) => v.toFixed(3)).join(','), plan.scaleY.toFixed(3), plan.scaleZ.toFixed(3),
    plan.bodyLift.toFixed(3), w.rim, w.rimDia.toFixed(3), w.rimWidth.toFixed(3), w.tireRadius.toFixed(3), w.tireWidth.toFixed(3),
    Object.values(w.positions).flat().map((v) => v.toFixed(3)).join(',')].join('|');
}
