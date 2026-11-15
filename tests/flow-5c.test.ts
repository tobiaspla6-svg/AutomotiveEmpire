// Phase 5C: the Flow screens, the GT-01 layers and the modular vehicle configuration.
import { createElement, type ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { setLang } from '../src/i18n';
import { useStore } from '../src/store/game';
import { ceo, founder, player } from './helpers';
import { saveDamage } from '../src/sim/migrate';
import {
  BODY_FAMILIES, DEFAULT_PARTS, PARTS, allParts, configOf, defaultConfig, familyFor, incompatibility, partById, saveVehicleConfig, validateConfig,
} from '../src/sim/vehicleConfig';
import { BG, GT01Car } from '../src/ui/flow/Scene';
import { FlowStudio } from '../src/ui/flow/FlowStudio';
import { FlowGarage } from '../src/ui/flow/FlowGarage';
import { ChestRoom } from '../src/ui/flow/FlowChests';
import { useStudio } from '../src/ui/flow/studioStore';

const PUB = join(__dirname, '..', 'public', 'flow');
const live = () => Object.assign(useStore.getInitialState(), useStore.getState());
const render = (c: ComponentType) => { live(); return renderToString(createElement(c)); };
beforeAll(() => {
  const mem = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); } };
});

/** A model whose configuration is the GT-01 record: drawn by the GT-01 family, or by no family (vector art). Since
 *  Phase 6 a 1984–2004 SUV is drawn by the suv90-green family and takes only its parts. */
const gtModels = (g: ReturnType<typeof ceo>) => player(g).models.filter((x) => { const f = familyFor(x.spec.body, x.designYear); return !f || f.id === 'gt01-fastback'; });

/** Width, height and alpha flag of a WebP (VP8X extended header) or the size of a PNG. */
function webpInfo(file: string) {
  const b = readFileSync(file);
  expect(b.toString('ascii', 0, 4)).toBe('RIFF'); expect(b.toString('ascii', 8, 12)).toBe('WEBP');
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3), alpha: (b[20] & 0x10) !== 0 };
  if (kind === 'VP8L') { const bits = b.readUInt32LE(21); return { w: 1 + (bits & 0x3fff), h: 1 + ((bits >> 14) & 0x3fff), alpha: ((bits >> 28) & 1) === 1 }; }
  return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff, alpha: false };
}
const pngSize = (file: string) => { const b = readFileSync(file); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colourType: b[25] }; };

describe('GT-01 layers derived from the Flow original', () => {
  const anchors = JSON.parse(readFileSync(join(PUB, 'gt01', 'anchors.json'), 'utf8'));
  const qa = JSON.parse(readFileSync(join(PUB, 'gt01', 'qa.json'), 'utf8'));
  it('come from the original GT (hash recorded) and recompose it closely', () => {
    expect(qa.sourceSha256).toBe('d5ff9b7b219e5e0c3f710134de68ed24339f57bc867ca59c249cdfaa9d54c20d');
    expect(qa.recomposition.meanAbsDiff).toBeLessThan(1);
    expect(qa.transparentPixels).toBeGreaterThan(500000);   // a real alpha channel, not an opaque JPEG
  });
  it('keep the original canvas, with real transparency on the body and wheels', () => {
    const body = webpInfo(join(PUB, 'gt01', 'body.webp'));
    expect(body).toEqual({ w: 1376, h: 768, alpha: true });
    expect(webpInfo(join(PUB, 'gt01', 'shadow.webp')).alpha).toBe(true);
    const mask = pngSize(join(PUB, 'gt01', 'paint-mask.png'));
    expect([mask.w, mask.h]).toEqual([1376, 768]);
    expect(mask.colourType).toBe(6);                         // RGBA
    for (const k of ['front', 'rear']) expect(webpInfo(join(PUB, 'gt01', `wheel-${k}.webp`)).alpha).toBe(true);
  });
  it('mount each wheel layer exactly on its measured centre (tolerance 0.5 px)', () => {
    expect(anchors.bodyFamilyId).toBe('gt01-fastback');
    expect(anchors.anchorVersion).toBe(BODY_FAMILIES[0].anchorVersion);
    expect(anchors.wheels.front).toMatchObject({ cx: 321.5, cy: 478.5 });
    expect(anchors.wheels.rear).toMatchObject({ cx: 1052.5, cy: 477.5 });
    for (const k of ['front', 'rear']) {
      const L = anchors.wheelLayers[k], w = anchors.wheels[k];
      expect(Math.abs(L.box[0] + L.center[0] - w.cx)).toBeLessThan(0.5);
      expect(Math.abs(L.box[1] + L.center[1] - w.cy)).toBeLessThan(0.5);
      const info = webpInfo(join(PUB, 'gt01', `wheel-${k}.webp`));
      expect([info.w, info.h]).toEqual([L.box[2], L.box[3]]);
      expect(L.box[2]).toBeGreaterThanOrEqual(2 * w.r);
    }
  });
  it('the drawing places the wheels at the anchors and ride height moves only the body', () => {
    const a = renderToString(createElement(GT01Car, { paint: '#c8352e', ride: 'ride-stock' }));
    const b = renderToString(createElement(GT01Car, { paint: '#c8352e', ride: 'ride-low' }));
    const wheel = (html: string) => html.match(/<img class="gt01-wheel" data-wheel="front"[^>]*>/)![0];
    expect(wheel(a)).toBe(wheel(b));                                   // wheels do not move
    expect(a).toContain('translateY(0%)'); expect(b).not.toContain('translateY(0%)');
    const L = anchors.wheelLayers.front.box;
    expect(wheel(a)).toContain(`left:${(L[0] / 1376) * 100}%`);
    expect(a).toContain('data-paint="#c8352e"');
    expect(renderToString(createElement(GT01Car, { paint: 'url(x)' }))).toContain('data-paint="#2a4f86"');
  });
});

describe('Flow backgrounds', () => {
  const prov = JSON.parse(readFileSync(join(PUB, 'bg', 'provenance.json'), 'utf8'));
  it('exist at the sizes the screens expect, with the source hash and operations recorded', () => {
    for (const [id, b] of Object.entries(BG)) {
      const job = prov.jobs[id];
      expect(job, id).toBeTruthy();
      expect(job.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(job.outputSize).toEqual([b.w, b.h]);
      expect(existsSync(join(PUB, b.src))).toBe(true);
      const info = webpInfo(join(PUB, b.src));
      expect([info.w, info.h], id).toEqual([b.w, b.h]);
    }
    expect(prov.method).toContain('no generative model');
  });
  it('stay light', () => {
    const total = Object.values(prov.jobs).reduce((a: number, j) => a + (j as { bytes: number }).bytes, 0);
    expect(total).toBeLessThan(900 * 1024);
  });
});

describe('modular vehicle configuration', () => {
  it('the default configuration is valid and every default part exists in its slot', () => {
    const c = defaultConfig();
    expect(validateConfig(c)).toBeNull();
    for (const [slot, id] of Object.entries(DEFAULT_PARTS)) expect(partById(id)?.slot, id).toBe(slot);
    expect(new Set(allParts().map((p) => p.id)).size).toBe(allParts().length);
  });
  it('art states are honest: layers only where a verified variant exists (Phase 5D); base parts come from the original', () => {
    const layers = allParts().filter((p) => p.asset === 'layer' && !p.fits).map((p) => p.slot);   // GT-01 parts (SUV parts: tests/suv90-modular-6.test.ts)
    expect([...new Set(layers)].sort()).toEqual(['bumperFront', 'handles', 'headlamps', 'rideHeight', 'roof', 'wheels']);
    for (const p of allParts()) if (p.asset === 'base') expect(p.thumb, p.id).toBeTruthy();
    expect(PARTS.wheels.filter((p) => p.asset !== 'missing' && !p.fits).map((p) => p.id)).toEqual(['wheel-gt01-twin5', 'wheel-multispoke']);   // GT-01 parts
    expect(PARTS.wheels.find((p) => p.id === 'wheel-fivespoke')?.asset).toBe('missing');
    for (const id of ['roof-canvas-sunroof', 'roof-soft-top', 'roof-retractable-hardtop', 'roof-solar']) expect(PARTS.roof.find((p) => p.id === id)?.asset, id).toBe('missing');
  });
  it('structural roofs need another body family; solar needs electrification and a closed roof', () => {
    const c = defaultConfig();
    const soft = PARTS.roof.find((p) => p.id === 'roof-soft-top')!, solar = PARTS.roof.find((p) => p.id === 'roof-solar')!, pano = PARTS.roof.find((p) => p.id === 'roof-panoramic')!;
    expect(incompatibility(c, soft, { electric: true })).toMatch(/estructura/);
    expect(incompatibility(c, solar, { electric: false })).toMatch(/eléctrico/);
    expect(incompatibility(c, solar, { electric: true })).toBeNull();
    expect(incompatibility({ ...c, parts: { ...c.parts, roof: 'roof-canvas-sunroof' } }, solar, { electric: true })).toMatch(/techo fijo/);
    expect(incompatibility(c, pano, { electric: false })).toBeNull();
  });
  it('rejects unknown parts, parts in the wrong slot, bad colours and stale anchors', () => {
    const c = defaultConfig();
    expect(validateConfig({ ...c, parts: { ...c.parts, wheels: 'nope' } })).toMatch(/nope/);
    expect(validateConfig({ ...c, parts: { ...c.parts, wheels: 'roof-fixed' } })).toMatch(/not a wheels/);
    expect(validateConfig({ ...c, paint: 'red' })).toBe('bad paint');
    expect(validateConfig({ ...c, anchorVersion: 'old' })).toMatch(/anchor/);
    expect(validateConfig({ ...c, interior: { ...c.interior, seats: 'throne' } })).toBe('bad interior');
  });
  it('the GT-01 family represents modern saloons and coupés only', () => {
    expect(familyFor('sedan', 2018)?.id).toBe('gt01-fastback');
    expect(familyFor('coupe', 2010)?.id).toBe('gt01-fastback');
    expect(familyFor('sedan', 1995)).toBeNull();
    expect(familyFor('suv', 2020)).toBeNull();
    expect(familyFor('roadster', 2020)).toBeNull();          // its open-top family has no asset yet
  });
  it('is saved per vehicle as data, survives JSON round trips and is checked when a save loads', () => {
    const g = ceo({ makerId: 'toyota', year: 2020 }), p = player(g), m = gtModels(g)[0];
    const c = { ...defaultConfig('#315b45'), parts: { ...DEFAULT_PARTS, rideHeight: 'ride-low', wheels: 'wheel-multispoke' } };
    expect(saveVehicleConfig(g, m.id, c)).toBeNull();
    expect(saveVehicleConfig(g, 'nope', c)).toBe('Unknown vehicle.');
    expect(saveVehicleConfig(g, 'draft', { ...c, paint: 'x' })).toMatch(/Invalid/);
    const copy = JSON.parse(JSON.stringify(g));
    expect(configOf(player(copy), m.id, m)).toEqual(c);
    expect(saveDamage(copy)).toBeNull();
    player(copy).designs![m.id].parts.wheels = 'nope';
    expect(saveDamage(copy)).toMatch(/design/);
    const old = founder(); delete player(old).designs;          // saves from before Phase 5C load as before
    expect(saveDamage(old)).toBeNull();
    expect(configOf(player(old), 'draft').paint).toBe('#2a4f86');
  });
  it('saving a configuration never touches money, the specification or the simulation', () => {
    const g = ceo({ makerId: 'toyota', year: 2020 }), p = player(g), m = gtModels(g)[0];
    const before = JSON.stringify({ cash: p.cash, spec: m.spec, stats: m.stats });
    saveVehicleConfig(g, m.id, defaultConfig('#c8352e'));
    expect(JSON.stringify({ cash: p.cash, spec: m.spec, stats: m.stats })).toBe(before);
  });
});

describe('Flow screens render', () => {
  it('design studio: categories, compatible parts, pending art said plainly', () => {
    setLang('es'); useStore.getState().start(ceo({ makerId: 'toyota', year: 2020 })); useStudio.getState().open('draft');
    const h = render(FlowStudio);
    for (const s of ['Taller de diseño', 'Carrocería y kits', 'Paragolpes y parrillas', 'Faros', 'Manijas', 'Espejos', 'Ruedas y neumáticos', 'Suspensión y altura', 'Pintura y materiales', 'Techo', 'Interior', 'Motor y transmisión', 'Aerodinámica', 'Deshacer', 'Rehacer', 'Restablecer', 'Guardar']) expect(h, s).toContain(s);
    expect(h).toContain('data-part="wheel-gt01-twin5"');
    expect(h).toContain('Falta asset');
    expect(h).toContain('class="gt01');
    setLang('en');
  });
  it('garage lists only real vehicles and offers Customise; chests show odds and no purchase', () => {
    setLang('es'); useStore.getState().start(ceo({ makerId: 'toyota', year: 2020 }));
    const gar = render(FlowGarage);
    expect(gar).toContain('Personalizar'); expect(gar).toContain('data-action="customize"');
    const p = player(useStore.getState().game!);
    const listed = (gar.match(/class="fs-thumb"[^>]*data-model="([^"]+)"/g) ?? []).length;
    expect(listed).toBe(p.models.filter((m) => m.status === 'production' || m.status === 'ready' || m.cumulativeUnits > 0).length);
    const chests = render(ChestRoom);
    expect(chests).toContain('data-action="open-chest"');
    expect(chests).toContain('Probabilidades');
    expect(chests).not.toMatch(/comprar|\$\s*\d|USD|ARS/i);
    setLang('en');
  });
  it('an empty garage explains how to get a vehicle', () => {
    setLang('es'); useStore.getState().start(founder());
    const gar = render(FlowGarage);
    expect(gar).toContain('Colección vacía');
    setLang('en');
  });
});
