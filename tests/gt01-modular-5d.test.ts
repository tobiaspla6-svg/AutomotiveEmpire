// Phase 5D: the first modular GT. Every variant layer of GT-01 is checked against its manifest (files, boxes, the
// composition QA written by scripts/flow/make_gt01_parts.py), rendered through GT01Car, and saved per vehicle with the
// structural rules enforced by the simulation, not only by disabled buttons.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { setLang } from '../src/i18n';
import { useStore } from '../src/store/game';
import { ceo, player } from './helpers';
import { saveDamage } from '../src/sim/migrate';
import { BODY_FAMILIES, DEFAULT_PARTS, PARTS, PART_LAYER, allParts, configOf, defaultConfig, familyFor, fitProblems, partById, saveVehicleConfig } from '../src/sim/vehicleConfig';
import { GT01Car } from '../src/ui/flow/Scene';
import { FlowStudio } from '../src/ui/flow/FlowStudio';
import { FlowGarage } from '../src/ui/flow/FlowGarage';
import { useStudio } from '../src/ui/flow/studioStore';

const GT = join(__dirname, '..', 'public', 'flow', 'gt01');
const manifest = JSON.parse(readFileSync(join(GT, 'parts.json'), 'utf8'));
const qa5c = JSON.parse(readFileSync(join(GT, 'qa.json'), 'utf8'));
beforeAll(() => {
  const mem = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); } };
});
type Box = [number, number, number, number];
const inside = ([x, y, w, h]: Box, [W, H]: [number, number]) => x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= W && y + h <= H;
const contains = (outer: Box, [x, y, w, h]: Box) => x >= outer[0] && y >= outer[1] && x + w <= outer[0] + outer[2] && y + h <= outer[1] + outer[3];

describe('GT-01 variant layers (manifest and composition QA)', () => {
  it('are drawn on the approved original: same source hash, canvas and anchors as the base layers', () => {
    expect(manifest.source).toBe(qa5c.sourceSha256);
    expect(manifest.canvas).toEqual([1376, 768]);
    expect(manifest.anchorVersion).toBe(BODY_FAMILIES.find((f) => f.id === 'gt01-fastback')!.anchorVersion);
  });
  it('every layer file exists, stays light, and its box lies inside the canvas; allowed regions lie inside the box', () => {
    let bytes = 0;
    for (const [k, L] of Object.entries<{ file: string; box: Box; allowed?: Box | Box[]; paintMask?: string }>(manifest.layers)) {
      expect(existsSync(join(GT, L.file)), k).toBe(true);
      bytes += statSync(join(GT, L.file)).size + (L.paintMask ? statSync(join(GT, L.paintMask)).size : 0);
      expect(inside(L.box, manifest.canvas), k).toBe(true);
      const allowed = L.allowed ? (Array.isArray(L.allowed[0]) ? L.allowed as Box[] : [L.allowed as Box]) : [];
      for (const a of allowed) expect(contains(L.box, a), k).toBe(true);
    }
    expect(bytes).toBeLessThan(200 * 1024);                   // all variants together; measured ≈ 75 KB
  });
  it('the composition QA changed pixels only inside each part region, and kept both tyres identical', () => {
    for (const k of ['wheel-multispoke', 'headlamp-matrix', 'handle-flush', 'bumper-front-sport', 'roof-panoramic']) {
      expect(manifest.qa[k].changedPixels, k).toBeGreaterThan(500);   // the variant is visibly different…
      expect(manifest.qa[k].changedOutsideAllowed, k).toBe(0);         // …and nothing else moved
    }
    for (const w of ['front', 'rear']) expect(manifest.qa[`wheel-multispoke-${w}-tyre`]).toEqual({ maxDiffInTyre: 0, alphaDiffInTyre: 0, sameSize: true });
    expect(manifest.qa['roof-panoramic-aboveRoofLine']).toBe(0);      // the glass never changes the silhouette
  });
  it('wheel variants sit on the measured axle centres with the original rim radius', () => {
    const anchors = JSON.parse(readFileSync(join(GT, 'anchors.json'), 'utf8'));
    for (const w of ['front', 'rear'] as const) {
      const L = manifest.layers[`wheel-multispoke-${w}`];
      expect(L.box[0] + L.center[0]).toBeCloseTo(anchors.wheels[w].cx, 0);
      expect(L.box[1] + L.center[1]).toBeCloseTo(anchors.wheels[w].cy, 0);
    }
  });
  it('only parts with a verified layer are marked "layer"; every variant points at a real manifest entry', () => {
    for (const [id, layer] of Object.entries(PART_LAYER)) {
      expect(partById(id)?.asset, id).toBe('layer');
      expect(Object.keys(manifest.layers).some((k) => k === layer || k.startsWith(layer + '-')), id).toBe(true);
    }
    // the remaining layer parts are the defaults (the base drawing) or ride heights
    for (const p of allParts().filter((x) => x.asset === 'layer' && !PART_LAYER[x.id])) expect(p.slot === 'rideHeight' || DEFAULT_PARTS[p.slot] === p.id, p.id).toBe(true);
  });
});

describe('GT01Car renders the chosen parts', () => {
  const html = (parts?: Record<string, string>, finish?: 'metallic' | 'pearl') => renderToString(createElement(GT01Car, { parts, finish }));
  it('the base car has no overlays and the original wheels', () => {
    const h = html(DEFAULT_PARTS);
    expect(h).toContain('data-parts=""');
    expect(h).toContain('gt01/wheel-front.webp'); expect(h).not.toContain('multispoke');
  });
  it('each variant adds exactly its own layer; wheels swap both axles', () => {
    for (const id of ['headlamp-matrix', 'handle-flush', 'bumper-front-sport', 'roof-panoramic']) {
      const slot = partById(id)!.slot, h = html({ ...DEFAULT_PARTS, [slot]: id });
      expect(h, id).toContain(`data-parts="${id}"`); expect(h, id).toContain(`parts/${id}.webp`);
    }
    const w = html({ ...DEFAULT_PARTS, wheels: 'wheel-multispoke' });
    expect(w).toContain('parts/wheel-multispoke-front.webp'); expect(w).toContain('parts/wheel-multispoke-rear.webp');
    expect(w.match(/data-part="wheel-multispoke"/g)).toHaveLength(2);
  });
  it('all variants together, with a finish', () => {
    const all = { ...DEFAULT_PARTS, wheels: 'wheel-multispoke', headlamps: 'headlamp-matrix', handles: 'handle-flush', bumperFront: 'bumper-front-sport', roof: 'roof-panoramic' };
    const h = html(all, 'pearl');
    expect(h).toContain('data-parts="roof-panoramic handle-flush bumper-front-sport headlamp-matrix"');
    expect(h).toContain('data-finish="pearl"');
    expect(h).toContain('handle-flush-paint.png');           // the flush handles are body colour: they carry their own mask
  });
});

describe('modular configuration saved per vehicle', () => {
  it('two vehicles keep their own parts and finish through a JSON round trip, and the save stays loadable', () => {
    const g = ceo({ makerId: 'toyota', year: 2020 }), p = player(g);
    const [a, b] = p.models;
    const ca = { ...defaultConfig('#c8352e'), finish: 'pearl' as const, parts: { ...DEFAULT_PARTS, wheels: 'wheel-multispoke', headlamps: 'headlamp-matrix' } };
    const cb = { ...defaultConfig('#315b45'), finish: 'matte' as const, parts: { ...DEFAULT_PARTS, bumperFront: 'bumper-front-sport', roof: 'roof-panoramic', handles: 'handle-flush' } };
    expect(saveVehicleConfig(g, a.id, ca)).toBeNull();
    if (b) expect(saveVehicleConfig(g, b.id, cb)).toBeNull();
    const copy = JSON.parse(JSON.stringify(g));
    expect(saveDamage(copy)).toBeNull();
    expect(configOf(player(copy), a.id, a)).toEqual(ca);
    if (b) expect(configOf(player(copy), b.id, b)).toEqual(cb);
  });
  it('open roofs are refused by the simulation while their body family has no asset', () => {
    const g = ceo({ makerId: 'toyota', year: 2020 }), m = player(g).models[0];
    for (const roof of ['roof-soft-top', 'roof-retractable-hardtop']) {
      const err = saveVehicleConfig(g, m.id, { ...defaultConfig(), parts: { ...DEFAULT_PARTS, roof } });
      expect(err, roof).toMatch(/Incompatible part \(roof\).*estructura/);
    }
    expect(BODY_FAMILIES.find((f) => f.id === 'gt01-open')?.asset).toBe('missing');
    expect(player(g).designs?.[m.id]).toBeUndefined();         // nothing was stored
  });
  it('the solar roof needs an electrified model; a stored part that stops fitting falls back to the slot default', () => {
    const g = ceo({ makerId: 'toyota', year: 2020 }), p = player(g), m = p.models[0];
    const solar = { ...defaultConfig(), parts: { ...DEFAULT_PARTS, roofAccessory: 'roof-solar' } };
    m.spec.engine.layout = 'I4'; m.spec.engine.hybridKw = 0;
    expect(saveVehicleConfig(g, m.id, solar)).toMatch(/eléctrico/);
    m.spec.engine.hybridKw = 40;
    expect(saveVehicleConfig(g, m.id, solar)).toBeNull();
    expect(fitProblems(solar, m)).toEqual({});
    m.spec.engine.hybridKw = 0;                                  // later the hybrid system is dropped
    expect(configOf(p, m.id, m).parts.roofAccessory).toBeUndefined();
    expect(configOf(p, m.id, m).parts.roof).toBe('roof-fixed');
  });
});

describe('studio and garage show the saved parts', () => {
  it('the studio and the garage both show a vehicle with its saved variants and finish', () => {
    setLang('es');
    const g = ceo({ makerId: 'toyota', year: 2020 });
    const m = player(g).models.find((x) => x.status === 'production' && familyFor(x.spec.body, x.designYear))!;   // a modern saloon: drawn as GT-01
    expect(m).toBeTruthy();
    saveVehicleConfig(g, m.id, { ...defaultConfig('#c8352e'), finish: 'matte', parts: { ...DEFAULT_PARTS, wheels: 'wheel-multispoke', bumperFront: 'bumper-front-sport' } });
    useStore.getState().start(g); useStudio.getState().open(m.id);
    // server rendering reads each store's initial state: copy the live state in (as tests/flow-5c does)
    Object.assign(useStore.getInitialState(), useStore.getState()); Object.assign(useStudio.getInitialState(), useStudio.getState());
    const h = renderToString(createElement(FlowStudio));
    expect(h).toMatch(/class="gt01 fs-car"[^>]*data-finish="matte" data-parts="bumper-front-sport"/);   // the stage car
    expect(h).toContain('data-part="wheel-multispoke"');
    expect(h).toContain('Variante verificada');
    const gar = renderToString(createElement(FlowGarage));
    expect(gar).toMatch(new RegExp(`data-model="${m.id}"[^]*?data-finish="matte" data-parts="bumper-front-sport"`));   // its garage thumbnail
    useStudio.getState().open('draft'); Object.assign(useStudio.getInitialState(), useStudio.getState()); setLang('en');
  });
});

describe('roof options in the tray', () => {
  it('soft top and retractable hard top belong to the open-top family; the canvas sunroof and solar panel are not drawn', () => {
    expect(PARTS.roof.filter((p) => p.family === 'gt01-open').map((p) => p.id)).toEqual(['roof-soft-top', 'roof-retractable-hardtop']);
    expect(PARTS.roof.filter((p) => p.asset === 'layer').map((p) => p.id)).toEqual(['roof-fixed', 'roof-panoramic']);
  });
});
