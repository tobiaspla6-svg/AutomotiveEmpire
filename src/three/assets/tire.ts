// Parametric tyre (Phase 4): the cross-section exported by the Blender build (tire_profile.json) revolved for the
// car's actual rim diameter, section width and outer radius, with circumferential grooves in the geometry and a
// procedural tread-block normal map. Geometry is cached per size; the material is shared.
import * as THREE from 'three';

export interface TireProfile { profile: [number, number][]; grooves: [number, number][]; grooveDepth: number }

const geoCache = new Map<string, THREE.BufferGeometry>();

/** Cross-section points (radius, lateral) for a tyre, from the bead on one side over the tread to the other. */
export function tireSection(p: TireProfile, rimR: number, outerR: number, width: number): [number, number][] {
  const side = Math.max(0.03, outerR - rimR);
  const half = width / 2;
  const left = p.profile.filter(([t]) => t < 0.995).map(([t, l]) => [rimR + t * side, l * half] as [number, number]);
  const tread: [number, number][] = [];
  const n = 33;
  for (let i = 0; i < n; i++) {
    const l = 0.68 - (1.36 * i) / (n - 1);
    let depth = 0;
    for (const [c, w] of p.grooves) if (Math.abs(l - c) < w / 2) depth = p.grooveDepth;
    tread.push([outerR - depth, l * half]);
  }
  const right = [...left].reverse().map(([r, y]) => [r, -y] as [number, number]);
  return [...left, ...tread, ...right];
}

/** Tyre geometry around the Z axis (the wheel axis in glTF space), UV: u around, v across the section. */
export function tireGeometry(p: TireProfile, rimR: number, outerR: number, width: number, segments = 96): THREE.BufferGeometry {
  const key = [rimR, outerR, width, segments].map((v) => v.toFixed(4)).join('|');
  const hit = geoCache.get(key);
  if (hit) return hit;
  const sec = tireSection(p, rimR, outerR, width);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const S = sec.length;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    for (let j = 0; j < S; j++) {
      const [r, y] = sec[j];
      pos.push(r * c, r * s, y);
      uv.push(i / segments, j / (S - 1));
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < S - 1; j++) {
      const a = i * S + j, b = (i + 1) * S + j;
      idx.push(a, a + 1, b, b, a + 1, b + 1); // outward-facing
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (geoCache.size > 24) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); }
  geoCache.set(key, g);
  return g;
}

let treadTex: THREE.DataTexture | null = null;
/** Tread blocks and sipes as a tangent-space normal map (generated once, no image download). */
export function treadNormalMap(): THREE.DataTexture {
  if (treadTex) return treadTex;
  const W = 256, H = 64;
  const h = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const onTread = v > 0.36 && v < 0.64;
    // sidewalls: fine concentric ribs near the rim and a smooth band (no lettering)
    const wall = (v > 0.04 && v < 0.2) || (v > 0.8 && v < 0.96);
    for (let x = 0; x < W; x++) {
      if (wall) { h[y * W + x] = (v * 60) % 1 < 0.35 ? -0.35 : 0; continue; }
      if (!onTread) continue;
      const u = x / W;
      const lat = (v - 0.5) / 0.14;               // -1 .. 1 across the tread
      const slant = u * 8 + Math.abs(lat) * 0.35;  // V-shaped sipes, 8 per tile
      const f = slant - Math.floor(slant);
      h[y * W + x] = f < 0.1 ? -1 : 0;
    }
  }
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = h[y * W + ((x + 1) % W)] - h[y * W + ((x - 1 + W) % W)];
      const dy = h[Math.min(H - 1, y + 1) * W + x] - h[Math.max(0, y - 1) * W + x];
      const nx = -dx * 0.8, ny = -dy * 0.8, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const k = (y * W + x) * 4;
      data[k] = ((nx / l) * 0.5 + 0.5) * 255;
      data[k + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      data[k + 2] = ((nz / l) * 0.5 + 0.5) * 255;
      data[k + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(10, 1);
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  treadTex = t;
  return t;
}

let rubber: THREE.MeshPhysicalMaterial | null = null;
export function rubberMaterial() {
  if (!rubber) rubber = new THREE.MeshPhysicalMaterial({ name: 'rubber', color: '#1a1a1c', roughness: 0.82, metalness: 0, normalMap: treadNormalMap(), sheen: 0.15, sheenRoughness: 0.9, sheenColor: new THREE.Color('#333') });
  return rubber;
}
