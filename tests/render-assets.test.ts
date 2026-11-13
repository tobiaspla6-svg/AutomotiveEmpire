// Phase 4: render descriptor, asset catalogue, component compatibility, the descriptor → visual adapter,
// graceful fallbacks and integration with real games and saves. No WebGL is needed: the adapter is pure data and
// the GLB files are inspected directly.
import 'fake-indexeddb/auto';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeVehicle, defaultEngine, defaultVehicle } from '../src/sim/engineering';
import { renderDescriptor, specDescriptor, type RenderDescriptor } from '../src/sim/render';
import { planVehicle, mapX, pickAsset, type AssetPlan } from '../src/three/assets/adapter';
import { SEDAN_REF, VEHICLE_ASSETS, RIM_FOR_STYLE, type VehicleAsset } from '../src/three/assets/catalog';
import { estimateUnitCost } from '../src/sim/company';
import * as A from '../src/sim/actions';
import { player } from '../src/sim/world';
import { localSaves } from '../src/store/saves';
import { prepareLoadedGame } from '../src/sim/migrate';
import type { GameState, VehicleSpec } from '../src/sim/types';
import { ceo, founder, nonFinitePaths, step } from './helpers';

const tech = (y: number) => ({ engine: y, chassis: y, aero: y, electronics: y, manufacturing: y });
const sedan = (o: Partial<VehicleSpec> = {}): VehicleSpec => ({ ...defaultVehicle(2024, 'sedan'), ...o });
const asset = (d: RenderDescriptor, year = 2024) => { const p = planVehicle(d, year); expect(p.kind).toBe('asset'); return p as AssetPlan; };

/** The JSON chunk of a GLB file. */
function glbJson(file: string): { nodes: { name: string; translation?: number[]; children?: number[] }[]; materials: { name: string }[]; scenes: { nodes: number[] }[] } {
  const b = readFileSync(file);
  expect(b.readUInt32LE(0)).toBe(0x46546c67); // 'glTF'
  const len = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + len).toString('utf8'));
}
const publicPath = (url: string) => join(__dirname, '..', 'public', url.replace(/^\//, ''));

describe('render descriptor', () => {
  it('describes a bare specification and carries the cosmetic choices', () => {
    const s = sedan({ finish: 'pearl', wheelStyle: 'turbine', wing: 0.3 });
    const d = specDescriptor(s);
    expect(d.body).toBe('sedan');
    expect(d.finish).toBe('pearl');
    expect(d.wheelStyle).toBe('turbine');
    expect(d.aero.wing).toBe(0.3);
    expect(d.engine.cylinders).toBeGreaterThan(0);
    expect(d.wheelbase).toBeLessThan(d.length);
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
    expect(specDescriptor(sedan()).finish).toBeNull();
  });

  it('cosmetic choices change neither engineering nor cost', () => {
    const base = sedan();
    const styled = sedan({ finish: 'matte', wheelStyle: 'fivespoke' });
    const a = computeVehicle(base, { year: 2024, tech: tech(2024) });
    const b = computeVehicle(styled, { year: 2024, tech: tech(2024) });
    expect(b.partsCost).toBe(a.partsCost);
    expect(b.mass).toBe(a.mass);
    expect(b.zeroTo100).toBe(a.zeroTo100);
    expect(b.scores).toEqual(a.scores);
    const g = founder({ year: 2024 }); const p = player(g);
    expect(A.startDevelopment(g, 'Styled', styled, 'family')).toBeNull();
    expect(A.startDevelopment(g, 'Plain', base, 'family')).toBeNull();
    const [m1, m2] = p.models;
    expect(estimateUnitCost(g, p, m1)).toBeCloseTo(estimateUnitCost(g, p, m2), 6);
  });
});

describe('asset catalogue and component compatibility', () => {
  it('every catalogued file exists and its size matches the catalogue (within 5 %)', () => {
    for (const a of VEHICLE_ASSETS) {
      for (const lod of a.lods) {
        const f = publicPath(lod.url);
        expect(existsSync(f), f).toBe(true);
        expect(Math.abs(statSync(f).size / lod.bytes - 1)).toBeLessThan(0.05);
      }
      expect(existsSync(publicPath(a.wheels.url))).toBe(true);
      expect(existsSync(publicPath(a.wheels.tireProfile))).toBe(true);
      expect(a.license.license.length).toBeGreaterThan(10);
      expect(a.license.source).toMatch(/blender/i);
    }
    // the Draco decoder is served locally (no CDN)
    expect(existsSync(join(__dirname, '..', 'public', 'draco', 'draco_decoder.wasm'))).toBe(true);
    expect(existsSync(join(__dirname, '..', 'public', 'draco', 'draco_wasm_wrapper.js'))).toBe(true);
  });

  it('each LOD contains every component, wheel mount and material slot the catalogue declares', () => {
    const a = SEDAN_REF;
    for (const lod of a.lods) {
      const j = glbJson(publicPath(lod.url));
      const roots = new Set(j.scenes[0].nodes.map((i) => j.nodes[i].name));
      const c = a.components;
      for (const n of [c.grille.ice, c.grille.ev, c.exhaust.single, c.exhaust.dual, c.exhaust.quad, c.aero.lip, c.aero.wing, c.aero.splitter, c.aero.skirts, c.interior, 'body']) {
        expect(roots.has(n), `${lod.url}: ${n}`).toBe(true);
      }
      for (const n of Object.values(a.wheelMounts)) expect(roots.has(n), n).toBe(true);
      const mats = new Set(j.materials.map((m) => m.name));
      for (const n of [...a.materials.paint, a.materials.trim, a.materials.upholstery, a.materials.accent]) expect(mats.has(n), n).toBe(true);
      // wheel mounts sit at the catalogued axles and track (glTF: x forward, y up, left = -z)
      const mount = (name: string) => j.nodes.find((n) => n.name === name)!.translation!;
      expect(mount(a.wheelMounts.FL)[0]).toBeCloseTo(a.native.frontAxleX, 3);
      expect(mount(a.wheelMounts.RL)[0]).toBeCloseTo(a.native.rearAxleX, 3);
      expect(mount(a.wheelMounts.FL)[1]).toBeCloseTo(a.native.tireRadius, 3);
      expect(mount(a.wheelMounts.FL)[2]).toBeCloseTo(-a.native.trackF / 2, 3);
      expect(mount(a.wheelMounts.FR)[2]).toBeCloseTo(a.native.trackF / 2, 3);
    }
    const w = glbJson(publicPath(a.wheels.url));
    const names = new Set(w.nodes.map((n) => n.name));
    for (const r of a.wheels.rims) expect(names.has(r), r).toBe(true);
    for (const r of Object.values(RIM_FOR_STYLE)) expect(a.wheels.rims).toContain(r);
    expect(names.has('brake_disc') && names.has('caliper')).toBe(true);
    const wm = new Set(w.materials.map((m) => m.name));
    expect(wm.has(a.materials.rim) && wm.has(a.materials.caliper)).toBe(true);
  });

  it('LODs get lighter and stay inside a web budget', () => {
    const [l0, l1, l2] = SEDAN_REF.lods;
    expect(l1.tris).toBeLessThan(l0.tris * 0.5);
    expect(l2.tris).toBeLessThan(l1.tris * 0.6);
    // budget raised in Phase 4B (real shut-line grooves, lamp internals, interior): hero LOD0 ≤ 350k triangles
    expect(l0.tris).toBeLessThan(350_000);
    expect(l0.bytes + SEDAN_REF.wheels.bytes).toBeLessThan(2_500_000);
  });

  it('the shared tyre profile is valid', () => {
    const t = JSON.parse(readFileSync(publicPath(SEDAN_REF.wheels.tireProfile), 'utf8'));
    expect(t.profile.length).toBeGreaterThan(6);
    for (const [r, l] of t.profile) { expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThanOrEqual(1); expect(l).toBeGreaterThanOrEqual(0); }
    expect(t.grooveDepth).toBeGreaterThan(0);
  });
});

describe('descriptor → visual plan', () => {
  it('stretches the body without distorting the wheel arches', () => {
    for (const size of [0.9, 1.0, 1.1]) {
      const d = specDescriptor(sedan({ size }));
      const p = asset(d);
      const k = p.xKnots;
      // the arch zones keep their native length and sit on the new axles
      expect(k.target[2] - k.target[1]).toBeCloseTo(k.native[2] - k.native[1], 9);
      expect(k.target[4] - k.target[3]).toBeCloseTo(k.native[4] - k.native[3], 9);
      expect((k.target[1] + k.target[2]) / 2).toBeCloseTo(-p.drawn.wheelbase / 2, 9);
      expect((k.target[3] + k.target[4]) / 2).toBeCloseTo(p.drawn.wheelbase / 2, 9);
      expect(mapX(SEDAN_REF.native.frontAxleX, k)).toBeCloseTo(p.drawn.wheelbase / 2, 9);
      // monotonic: no folded geometry
      let prev = -Infinity;
      for (let x = -3; x <= 3; x += 0.01) { const y = mapX(x, k); expect(y).toBeGreaterThan(prev); prev = y; }
      // the wheels sit on the drawn axles and track
      expect(p.wheels.positions.FL[0] - p.wheels.positions.RL[0]).toBeCloseTo(p.drawn.wheelbase, 9);
      expect(p.wheels.positions.FR[2] - p.wheels.positions.FL[2]).toBeCloseTo(p.drawn.track, 9);
      expect(p.drawn.length).toBeCloseTo(Math.min(Math.max(d.length, SEDAN_REF.compatible.length[0]), SEDAN_REF.compatible.length[1]), 6);
      if (d.length >= SEDAN_REF.compatible.length[0] && d.length <= SEDAN_REF.compatible.length[1]) expect(p.notes.some((n) => n.startsWith('Drawn at the nearest size'))).toBe(false);
    }
  });

  it('keeps the tyres inside the arches and on the ground', () => {
    for (const [wheelDia, size, sport] of [[15, 0.9, 0], [19, 1.0, 1], [22, 1.15, 1], [17, 1.0, 0.5]]) {
      const p = asset(specDescriptor(sedan({ wheelDia, size, sport })));
      const w = p.wheels;
      expect(w.positions.FL[1]).toBeCloseTo(w.tireRadius, 9); // tyre touches the ground
      const archTop = (SEDAN_REF.native.tireRadius + SEDAN_REF.native.archRadius) * p.scaleY + p.bodyLift;
      expect(2 * w.tireRadius).toBeLessThanOrEqual(archTop - 0.012 + 1e-9);
      expect(w.rimDia / 2).toBeLessThan(w.tireRadius - 0.03);
    }
  });

  it('reports what it cannot show instead of pretending', () => {
    const p = asset(specDescriptor(sedan({ wheelDia: 24 })));
    expect(p.wheels.rimDia).toBeCloseTo(22 * 0.0254, 9);
    expect(p.notes.join(' ')).toMatch(/24" wheels are drawn as 22"/);
    const huge = { ...specDescriptor(sedan()), length: 6.2 };
    const q = asset(huge);
    expect(q.drawn.length).toBeCloseTo(SEDAN_REF.compatible.length[1], 6);
    expect(q.notes.join(' ')).toMatch(/nearest size/);
  });

  it('maps the engine, aero and trim to the right components and materials', () => {
    const ev = asset(specDescriptor(sedan({ engine: { ...defaultEngine(2024), layout: 'EV', motorKw: 180, batteryKwh: 70 } })));
    expect(ev.visible.grille_ev).toBe(true);
    expect(ev.visible.grille_ice).toBe(false);
    expect(ev.visible.exhaust_single || ev.visible.exhaust_dual || ev.visible.exhaust_quad).toBe(false);
    const v8 = asset(specDescriptor(sedan({ engine: { ...defaultEngine(2024), layout: 'V8' } })));
    expect(v8.visible.exhaust_quad).toBe(true);
    const i4 = asset(specDescriptor(sedan({ engine: { ...defaultEngine(2024), layout: 'I4', aspiration: 'na' } })));
    expect(i4.visible.exhaust_single).toBe(true);
    const aero = asset(specDescriptor(sedan({ wing: 0.8, splitter: 0.7, flatFloor: true })));
    expect(aero.visible.aero_wing && aero.visible.aero_splitter && aero.visible.aero_skirts).toBe(true);
    expect(aero.visible.aero_lip_spoiler).toBe(false);
    const lip = asset(specDescriptor(sedan({ wing: 0.2, splitter: 0, flatFloor: false })));
    expect(lip.visible.aero_lip_spoiler).toBe(true);
    expect(lip.visible.aero_wing || lip.visible.aero_splitter || lip.visible.aero_skirts).toBe(false);
    // trim styling and explicit cosmetic choices
    const sport = asset(specDescriptor(sedan(), { name: 'GT', level: 'sport' }));
    expect(sport.trimStyle).toBe('black');
    expect(sport.wheels.rim).toBe('rim_sport5');
    expect(sport.wheels.caliperColor).not.toBe(asset(specDescriptor(sedan({ sport: 0 }), { name: 'S', level: 'entry' })).wheels.caliperColor);
    const lux = asset(specDescriptor(sedan({ interior: 'luxury' }), { name: 'L', level: 'luxury' }));
    expect(lux.trimStyle).toBe('chrome');
    expect(lux.interior.leather).toBe(true);
    expect(lux.interior.accent).toBe('wood');
    const chosen = asset(specDescriptor(sedan({ wheelStyle: 'multispoke', finish: 'matte' }), { name: 'GT', level: 'sport' }));
    expect(chosen.wheels.rim).toBe('rim_multi15');
    expect(chosen.paint.finish).toBe('matte');
    expect(asset(specDescriptor(sedan({ color: '#123456' }))).paint.color).toBe('#123456');
  });
});

describe('graceful fallbacks', () => {
  it('uses the procedural renderer, with a reason, when no asset fits', () => {
    for (const body of ['hatch', 'suv', 'pickup', 'coupe', 'roadster', 'supercar', 'wagon'] as const) {
      const p = planVehicle(specDescriptor(defaultVehicle(2024, body)), 2024);
      expect(p.kind).toBe('procedural');
      if (p.kind === 'procedural') expect(p.reason).toMatch(new RegExp(body));
    }
    const mid = planVehicle(specDescriptor(sedan({ enginePos: 'mid', drive: 'RWD' })), 2024);
    expect(mid.kind).toBe('procedural');
    const old = planVehicle(specDescriptor(defaultVehicle(1965, 'sedan')), 1965);
    expect(old.kind).toBe('procedural');
    if (old.kind === 'procedural') expect(old.reason).toMatch(/1965/);
    expect(planVehicle(specDescriptor(sedan()), 2024, []).kind).toBe('procedural');
    expect(typeof pickAsset(specDescriptor(sedan()), 2024, [] as VehicleAsset[])).toBe('string');
  });

  it('a failed asset download is retried, not cached', async () => {
    const { loadJSON } = await import('../src/three/assets/loader');
    let calls = 0;
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => { calls++; if (calls === 1) throw new Error('offline'); return new Response('{"ok":1}'); }) as typeof fetch;
    try {
      await expect(loadJSON('/x.json')).rejects.toThrow('offline');
      await Promise.resolve();
      await expect(loadJSON('/x.json')).resolves.toEqual({ ok: 1 });
      await expect(loadJSON('/x.json')).resolves.toEqual({ ok: 1 });
      expect(calls).toBe(2);
    } finally { globalThis.fetch = orig; }
  });
});

describe('existing games', () => {
  it('every car in a 2024 CEO world gets a valid plan (asset or procedural) with finite numbers', () => {
    const g = ceo({ makerId: 'toyota', year: 2024 });
    let assets = 0, procedural = 0;
    for (const c of g.companies) for (const m of c.models) {
      const d = renderDescriptor(c, m);
      const p = planVehicle(d, g.year);
      expect(nonFinitePaths(p.kind === 'asset' ? { ...p, asset: null } : p)).toEqual([]);
      if (p.kind === 'asset') { assets++; expect(m.spec.body).toBe('sedan'); } else procedural++;
    }
    expect(assets).toBeGreaterThan(5);
    expect(procedural).toBeGreaterThan(5);
  });

  it('cosmetic choices survive save → load and the game continues identically', async () => {
    const g = founder({ year: 2022 }); const p = player(g);
    expect(A.startDevelopment(g, 'Aurora', sedan({ finish: 'pearl', wheelStyle: 'turbine', color: '#2a4d7a' }), 'family')).toBeNull();
    step(g, 3);
    await localSaves.save('p4', g);
    const back = prepareLoadedGame((await localSaves.load('p4'))!);
    const m = player(back).models[0];
    expect(m.spec.finish).toBe('pearl');
    expect(m.spec.wheelStyle).toBe('turbine');
    expect(renderDescriptor(player(back), m)).toEqual(renderDescriptor(p, p.models[0]));
    step(g, 2); step(back, 2);
    expect(JSON.stringify({ ...back, savedAt: 0 })).toBe(JSON.stringify({ ...g, savedAt: 0 }));
  });

  it('saves from before Phase 4 (no cosmetic fields) load and render with trim defaults', async () => {
    const g = founder({ year: 2022 }); const p = player(g);
    expect(A.startDevelopment(g, 'Plain', sedan(), 'family')).toBeNull();
    const raw = JSON.parse(JSON.stringify(g)) as GameState;
    for (const c of raw.companies) for (const m of c.models) { delete m.spec.finish; delete m.spec.wheelStyle; }
    const back = prepareLoadedGame(raw);
    const plan = planVehicle(renderDescriptor(player(back), player(back).models[0]), 2022);
    expect(plan.kind).toBe('asset');
    if (plan.kind === 'asset') { expect(plan.paint.finish).toBe('metallic'); expect(plan.wheels.rim).toBe('rim_multi15'); }
    void p;
  });
});
