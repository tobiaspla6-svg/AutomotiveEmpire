// Phase 6: the 1990 SUV as the first family defined by data. Checks the family record, the files and the QA written
// by scripts/suv90/prepare_suv90.py, the generic renderer, and the visual configuration per family (visual only).
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ceo, player } from './helpers';
import { saveDamage } from '../src/sim/migrate';
import { SUV90 } from '../src/data/artFamilies';
import { DRAWABLE, drawableOptions, layersFor, validateArtFamily, type VehicleArtFamily } from '../src/sim/vehicleArt';
import { BODY_FAMILIES, ORIGINAL_PAINT, configOf, defaultConfig, familyFor, partsFor, saveVehicleConfig, validateConfig } from '../src/sim/vehicleConfig';
import { ModularCar } from '../src/ui/flow/ModularCar';

const DIR = join(__dirname, '..', 'public', 'flow', 'suv90');
const man = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8'));
const suvModel = (g: ReturnType<typeof ceo>) => player(g).models.find((m) => familyFor(m.spec.body, m.designYear)?.id === 'suv90-green')!;

describe('suv90-green family record', () => {
  it('is valid, and every file it names exists', () => {
    expect(validateArtFamily(SUV90)).toEqual([]);
    for (const L of [SUV90.base.body, SUV90.base.shadow, SUV90.paint!.mask, ...Object.values(SUV90.layers)]) expect(existsSync(join(DIR, L.file)), L.file).toBe(true);
  });
  it('comes from the untouched master of the art branch, with one uniform transform', () => {
    expect(SUV90.master.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(SUV90.master.branch).toBe('art/suv90-master-20261115-01a1dd27');
    expect(SUV90.transform).toEqual({ offset: [0, 220], scale: 0.5, sourceSize: [2752, 1536] });
    expect(SUV90.canvas).toEqual({ w: 1376, h: 590 });
    // hubs (566, 1115) and (2094, 1115) in source px, one horizontal line
    expect(SUV90.mounts.hubs).toEqual({ front: [283, 447.5], rear: [1047, 447.5] });
  });
  it('the validator catches broken records', () => {
    const bad: VehicleArtFamily = JSON.parse(JSON.stringify(SUV90));
    bad.layers['headlamp-a'].box = [1300, 560, 200, 100];
    bad.slots.wheels[1].layers.push('nope');
    bad.slots.headlamps[0].layers = ['headlamp-b'];
    bad.layers['headlamp-b'].approval = 'rejected';
    const errs = validateArtFamily(bad).join(' | ');
    expect(errs).toMatch(/headlamp-a: box outside/);
    expect(errs).toMatch(/unknown layer nope/);
    expect(errs).toMatch(/first option must be the master/);
    expect(errs).toMatch(/drawable option uses a rejected layer/);
  });
  it('only drawable art is offered; the rejected bumper faces are not listed', () => {
    for (const slot of Object.keys(SUV90.slots)) for (const o of drawableOptions(SUV90, slot)) expect(DRAWABLE).toContain(o.approval);
    expect(SUV90.slots.bumperFront.map((o) => o.partId)).toEqual(['bumper-suv90-standard']);
    expect(layersFor(SUV90, { wheels: 'wheel-suv90-alloy6', headlamps: 'headlamp-suv90-halogen-b', bumperFront: 'bumper-suv90-standard' })).toEqual(['headlamp-b', 'wheel-alloy-rear', 'wheel-alloy-front']);
    expect(layersFor(SUV90, { wheels: 'nope', headlamps: 'wheel-suv90-steel6' })).toEqual([]);   // unknown or wrong-slot ids draw nothing
  });
});

describe('suv90 layers: QA from the preparation script', () => {
  const qa = man.qa;
  it('the body recomposes the original closely and has a real alpha channel', () => {
    expect(qa.recomposition.meanAbsDiff).toBeLessThan(0.5);
    expect(qa.alpha.transparent).toBeGreaterThan(300000);
    for (const [k, v] of Object.entries(qa.opaqueProbes)) expect(v, k).toBe(1);   // glass, lamp, rims, hood highlight stay opaque
  });
  it('no white halo: the soft edge ring is dark on black (the few bright pixels are the light A-pillar trim)', () => {
    expect(qa.halo.ringMeanLumaOnBlack).toBeLessThan(40);
    expect(qa.halo.ringPixelsBrighterThan140OnBlack).toBeLessThan(60);
  });
  it('the paint mask covers the panels and excludes glass, trim, bumpers, lamps, wheels, shadow and backdrop', () => {
    for (const [k, v] of Object.entries(qa.paintMask.mustBeExcluded)) expect(v, k).toBe(0);
    for (const [k, v] of Object.entries(qa.paintMask.mustBeIncluded)) expect(v, k).toBe(1);
  });
  it('each variant only touches its box; wheels sit on the hubs', () => {
    for (const [k, v] of Object.entries<{ changedPixels: number; changedOutsideBox: number }>(qa.variants)) { expect(v.changedPixels, k).toBeGreaterThan(500); expect(v.changedOutsideBox, k).toBe(0); }
    for (const k of ['wheel-steel-front', 'wheel-steel-rear', 'wheel-alloy-front', 'wheel-alloy-rear']) expect(man.layers[k].pivotToCentroidPx, k).toBeLessThan(0.5);
  });
  it('loading stays light: the whole family is under 200 kB, a variant under 10 kB', () => {
    const files = ['body.webp', 'shadow.webp', 'paint-mask.png', ...new Set(Object.values(SUV90.layers).map((l) => l.file))];
    const total = files.reduce((a, f) => a + statSync(join(DIR, f)).size, 0);
    expect(total).toBeLessThan(200 * 1024);
    for (const l of Object.values(SUV90.layers)) expect(statSync(join(DIR, l.file)).size, l.file).toBeLessThan(10 * 1024);
  });
});

describe('ModularCar', () => {
  const html = (p: Parameters<typeof ModularCar>[0]) => renderToString(createElement(ModularCar, p));
  it('the original: body and shadow only, no repaint and no variant layer', () => {
    const h = html({ family: SUV90, paint: ORIGINAL_PAINT['suv90-green'], parts: defaultConfig(undefined, 'suv90-green').parts });
    expect(h).toContain('data-repaint="0"'); expect(h).toContain('data-parts=""');
    expect(h).toContain('suv90/body.webp'); expect(h).not.toContain('paint-mask'); expect(h).not.toContain('parts/');
  });
  it('a colour repaints through the mask only; variants add exactly their layers', () => {
    const h = html({ family: SUV90, paint: '#c8352e', parts: { wheels: 'wheel-suv90-steel6', headlamps: 'headlamp-suv90-halogen-a' } });
    expect(h).toContain('data-repaint="1"'); expect(h).toContain('suv90/paint-mask.png');
    expect(h).toContain('data-parts="headlamp-a wheel-steel-rear wheel-steel-front"');
    expect(h.match(/<img[^>]*parts\/wheel-steel\.webp/g)).toHaveLength(2);   // one file, mounted on both hubs
    expect(h).not.toMatch(/filter:/);                     // no global CSS filter on the car
  });
});

describe('visual configuration per family', () => {
  it('a 1984–2004 SUV is drawn by suv90-green; other bodies and eras are not', () => {
    expect(familyFor('suv', 1990)?.id).toBe('suv90-green');
    expect(familyFor('suv', 1984)?.id).toBe('suv90-green');
    expect(familyFor('suv', 2004)?.id).toBe('suv90-green');
    expect(familyFor('suv', 2005)).toBeNull();
    expect(familyFor('suv', 1983)).toBeNull();
    expect(familyFor('pickup', 1990)).toBeNull();
    expect(BODY_FAMILIES.find((f) => f.id === 'suv90-green')?.anchorVersion).toBe(man.anchorVersion);
  });
  it('each family offers only its own parts, and validation refuses mixing', () => {
    expect(partsFor('suv90-green', 'wheels').map((p) => p.id)).toEqual(['wheel-suv90-steel5', 'wheel-suv90-steel6', 'wheel-suv90-alloy6']);
    expect(partsFor('gt01-fastback', 'wheels').some((p) => p.id.includes('suv90'))).toBe(false);
    expect(partsFor('suv90-green', 'roof')).toEqual([]);
    const suv = defaultConfig(undefined, 'suv90-green');
    expect(validateConfig(suv)).toBeNull();
    expect(suv.paint).toBe('#526a54');
    expect(validateConfig({ ...suv, parts: { ...suv.parts, wheels: 'wheel-multispoke' } })).toMatch(/does not belong to suv90-green/);
    const gt = defaultConfig();
    expect(validateConfig({ ...gt, parts: { ...gt.parts, wheels: 'wheel-suv90-alloy6' } })).toMatch(/does not belong to gt01-fastback/);
  });
  it('saved per vehicle; a GT-01 configuration cannot be saved for a vehicle drawn as the SUV', () => {
    const g = ceo({ makerId: 'toyota', year: 1995 }), p = player(g), m = suvModel(g);
    expect(m).toBeTruthy();
    const cfg = { ...defaultConfig('#c8352e', 'suv90-green'), parts: { wheels: 'wheel-suv90-alloy6', headlamps: 'headlamp-suv90-halogen-b', bumperFront: 'bumper-suv90-standard' } };
    expect(saveVehicleConfig(g, m.id, cfg)).toBeNull();
    expect(saveVehicleConfig(g, m.id, defaultConfig())).toMatch(/drawn by suv90-green/);
    const copy = JSON.parse(JSON.stringify(g));
    expect(saveDamage(copy)).toBeNull();
    expect(configOf(player(copy), m.id, m)).toEqual(cfg);
    expect(p.designs?.[m.id]).toEqual(cfg);
  });
  it('an older save with a GT-01 record for that SUV still loads, and is shown on the SUV with its paint', () => {
    const g = ceo({ makerId: 'toyota', year: 1995 }), p = player(g), m = suvModel(g);
    p.designs = { [m.id]: { ...defaultConfig('#7b1f24'), finish: 'matte' } };   // as Phase 5C/5D could store it
    const copy = JSON.parse(JSON.stringify(g));
    expect(saveDamage(copy)).toBeNull();
    const shown = configOf(player(copy), m.id, m);
    expect(shown.bodyFamilyId).toBe('suv90-green');
    expect(shown.paint).toBe('#7b1f24'); expect(shown.finish).toBe('matte');
    expect(shown.parts).toEqual(defaultConfig(undefined, 'suv90-green').parts);
    expect(player(copy).designs![m.id].bodyFamilyId).toBe('gt01-fastback');   // not rewritten until saved again
  });
  it('visual parts never change the simulation: no power, mass or price change', () => {
    const g = ceo({ makerId: 'toyota', year: 1995 }), p = player(g), m = suvModel(g);
    const before = JSON.stringify({ cash: p.cash, spec: m.spec, stats: m.stats, price: m.price });
    saveVehicleConfig(g, m.id, { ...defaultConfig('#101923', 'suv90-green'), parts: { wheels: 'wheel-suv90-alloy6', headlamps: 'headlamp-suv90-halogen-a', bumperFront: 'bumper-suv90-standard' } });
    expect(JSON.stringify({ cash: p.cash, spec: m.spec, stats: m.stats, price: m.price })).toBe(before);
  });
});
