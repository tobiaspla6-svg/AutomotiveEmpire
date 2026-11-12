// GLB loading with a shared cache (Phase 4).
//
// Every GLB is fetched once and kept as a template; cars clone the template's node graph (sharing geometry and
// textures) and only own the geometry they deform and the materials they recolour, which they dispose when they
// unmount. Draco is decoded by the WebAssembly decoder shipped in public/draco (no CDN).
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

let loader: GLTFLoader | null = null;
function getLoader() {
  if (loader) return loader;
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  const draco = new DRACOLoader();
  draco.setDecoderPath(`${base}draco/`);
  loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  return loader;
}

const cache = new Map<string, Promise<GLTF>>();
const stats = { requests: 0, hits: 0, failures: 0, bytes: 0 };

/** Load (once) and return the parsed GLB; later calls share the same promise. */
export function loadGLB(url: string): Promise<GLTF> {
  const hit = cache.get(url);
  if (hit) { stats.hits++; return hit; }
  stats.requests++;
  const p = new Promise<GLTF>((resolve, reject) => {
    getLoader().load(url, (g) => resolve(g), (ev) => { if (ev.total) stats.bytes = Math.max(stats.bytes, ev.total); }, (err) => {
      stats.failures++;
      cache.delete(url); // allow a retry later
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
  cache.set(url, p);
  return p;
}

/** Start downloading in the background (e.g. when the Vehicles screen opens). */
export function preload(urls: string[]) { for (const u of urls) loadGLB(u).catch(() => undefined); }

const jsonCache = new Map<string, Promise<unknown>>();
export function loadJSON<T>(url: string): Promise<T> {
  let p = jsonCache.get(url);
  if (!p) {
    p = fetch(url).then((r) => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); });
    p.catch(() => jsonCache.delete(url));
    jsonCache.set(url, p);
  }
  return p as Promise<T>;
}

export const loaderStats = () => ({ ...stats, cached: cache.size });

/** Dispose geometries and materials created for one car (never the shared template's). */
export function disposeOwned(owned: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[]; textures?: THREE.Texture[] }) {
  for (const g of owned.geometries) g.dispose();
  for (const m of owned.materials) m.dispose();
  for (const t of owned.textures ?? []) t.dispose();
}

/** Drop everything (used by tests and when the quality preset changes the LOD set). */
export function clearAssetCache() {
  for (const p of cache.values()) {
    p.then((g) => g.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
          for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
          mat.dispose();
        }
      }
    })).catch(() => undefined);
  }
  cache.clear();
}
