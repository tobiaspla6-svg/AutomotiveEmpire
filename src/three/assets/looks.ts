// Materials the game applies to an asset (paint finishes, exterior trim, wheels, calipers, interior).
// Each car owns these materials (it clones the GLB's slot material and overrides it) and disposes them on unmount.
import * as THREE from 'three';
import type { PaintFinish } from '../../sim/types';
import type { AccentKind, TrimStyle } from './adapter';

export const FINISH: Record<PaintFinish, { metalness: number; roughness: number; clearcoat: number; clearcoatRoughness: number; iridescence?: number }> = {
  solid: { metalness: 0.0, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.035 },
  metallic: { metalness: 0.62, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 },
  pearl: { metalness: 0.42, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0.55 },
  matte: { metalness: 0.32, roughness: 0.62, clearcoat: 0, clearcoatRoughness: 0.5 },
};
/** Strength of the metallic flake layer per finish (0 = none). */
export const FLAKE: Record<PaintFinish, number> = { solid: 0, metallic: 0.09, pearl: 0.06, matte: 0.04 };

/**
 * Metallic flake: the base coat's normal is jittered per 0.4 mm cell (object space), so fine sparkles catch the
 * light while the clear coat above stays perfectly smooth (it has its own, unperturbed normal).
 */
function addFlake(m: THREE.MeshPhysicalMaterial) {
  const u = { uFlake: { value: 0 }, uFlakeScale: { value: 2600 } };
  m.userData.flake = u;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFlake = u.uFlake;
    sh.uniforms.uFlakeScale = u.uFlakeScale;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFlakePos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlakePos = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vFlakePos;
uniform float uFlake;
uniform float uFlakeScale;
vec3 flakeHash(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yxz + 19.19);
  return fract((p.xxy + p.yxx) * p.zyx);
}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
if (uFlake > 0.0) {
  vec3 cellP = vFlakePos * uFlakeScale;
  // fade out when a flake is smaller than a pixel: sparkle up close, no aliasing noise at a distance
  float fade = clamp(1.6 - length(fwidth(cellP)), 0.0, 1.0);
  vec3 fl = flakeHash(floor(cellP)) * 2.0 - 1.0;
  normal = normalize(normal + uFlake * fade * fl);
}`);
  };
  m.customProgramCacheKey = () => 'ae-flake';
}

export const FINISH_NAME: Record<PaintFinish, string> = { solid: 'Solid gloss', metallic: 'Metallic', pearl: 'Pearlescent', matte: 'Satin matte' };

/** Turn a slot material from the GLB into this car's paint (keeps the panel-gap maps of the body slot). */
export function makePaint(src: THREE.Material, color: string, finish: PaintFinish): THREE.MeshPhysicalMaterial {
  const s = src as THREE.MeshStandardMaterial;
  const m = new THREE.MeshPhysicalMaterial({ name: src.name, map: s.map ?? null, normalMap: s.normalMap ?? null });
  if (s.normalMap) {
    m.normalScale.copy(s.normalScale);
    m.clearcoatNormalMap = s.normalMap;
    m.clearcoatNormalScale.copy(s.normalScale);
  }
  addFlake(m);
  applyPaint(m, color, finish);
  return m;
}

export function applyPaint(m: THREE.MeshPhysicalMaterial, color: string, finish: PaintFinish) {
  const f = FINISH[finish];
  m.color.set(color);
  m.metalness = f.metalness;
  m.roughness = f.roughness;
  m.clearcoat = f.clearcoat;
  m.clearcoatRoughness = f.clearcoatRoughness;
  m.iridescence = f.iridescence ?? 0;
  m.iridescenceIOR = 1.45;
  const mm = m as unknown as Record<string, unknown>;
  if ('iridescenceThicknessMinimum' in mm) { mm.iridescenceThicknessMinimum = 180; mm.iridescenceThicknessMaximum = 520; } else m.iridescenceThicknessRange = [180, 520];
  m.envMapIntensity = 1;
  const fl = m.userData.flake as { uFlake: { value: number } } | undefined;
  if (fl) fl.uFlake.value = FLAKE[finish];
  m.needsUpdate = true;
}

export function applyTrim(m: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial, style: TrimStyle) {
  const v = style === 'chrome' ? { c: '#eceef1', met: 1, r: 0.06 } : style === 'black' ? { c: '#0b0b0c', met: 0.2, r: 0.12 } : { c: '#a9adb2', met: 1, r: 0.3 };
  m.color.set(v.c);
  m.metalness = v.met;
  m.roughness = v.r;
  if ('clearcoat' in m) { m.clearcoat = style === 'black' ? 1 : 0; m.clearcoatRoughness = 0.03; }
}

export function applyRim(m: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial, finish: 'silver' | 'dark') {
  m.color.set(finish === 'silver' ? '#c9ccd1' : '#2c2f34');
  m.metalness = 1;
  m.roughness = finish === 'silver' ? 0.2 : 0.34;
}

export function applyUpholstery(m: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial, color: string, leather: boolean) {
  m.color.set(color);
  m.metalness = 0;
  m.roughness = leather ? 0.42 : 0.92;
  if ('sheen' in m) { m.sheen = leather ? 0 : 0.6; m.sheenRoughness = 0.8; m.sheenColor.set(color); }
}

export function applyAccent(m: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial, kind: AccentKind) {
  const v = kind === 'wood' ? { c: '#5b3a22', met: 0, r: 0.3, cc: 1 } : kind === 'aluminium' ? { c: '#b9bdc2', met: 1, r: 0.28, cc: 0 }
    : kind === 'carbon' ? { c: '#1c1e21', met: 0.3, r: 0.22, cc: 1 } : { c: '#232325', met: 0, r: 0.6, cc: 0 };
  m.color.set(v.c);
  m.metalness = v.met;
  m.roughness = v.r;
  if ('clearcoat' in m) m.clearcoat = v.cc;
}
