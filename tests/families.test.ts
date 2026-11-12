// Shared engineering (Phase 3): engine families, variants and platforms.
import { describe, expect, it } from 'vitest';
import * as A from '../src/sim/actions';
import { defaultEngine, defaultVehicle } from '../src/sim/engineering';
import { unitCost, toolingCost } from '../src/sim/company';
import { applyPlatform, engineFits, enginesOf, familyUsers, maturity, planDevelopment, platformFits, platformsOf, platformUsers, sharedVolume, SHARE, DISP_RANGE } from '../src/sim/families';
import { defectDecision, engineFamilies, platformGroups, resolveDecision } from '../src/sim/events';
import { prepareLoadedGame, SAVE_VERSION } from '../src/sim/migrate';
import { makeRng } from '../src/sim/rng';
import type { Company, GameState, SegmentId, VehicleModel, VehicleSpec } from '../src/sim/types';
import { ceo, founder, nonFinitePaths, player, step } from './helpers';

const devOf = (p: Company, from: number) => p.ledger.slice(from).reduce((a, l) => a + l.dev, 0);
function develop(g: GameState, name: string, spec: VehicleSpec, seg: SegmentId = 'budget', choice?: A.DevChoice): VehicleModel {
  const p = player(g);
  expect(A.startDevelopment(g, name, spec, seg, undefined, choice)).toBeNull();
  return p.models[p.models.length - 1];
}
const until = (g: GameState, done: () => boolean, max = 120) => { let i = 0; while (!done() && i++ < max && !g.gameOver) step(g); };

describe('a first car develops its engine family and platform with it', () => {
  it('creates both, charges the full budget exactly once and signs all three off together', () => {
    const g = founder({ year: 2005 }); const p = player(g);
    const L0 = p.ledger.length;
    const m = develop(g, 'Alpha', defaultVehicle(2005, 'hatch'));
    expect(enginesOf(p)).toHaveLength(1); expect(platformsOf(p)).toHaveLength(1);
    const f = enginesOf(p)[0], pl = platformsOf(p)[0];
    expect(f.status).toBe('development'); expect(f.ownerModelId).toBe(m.id);
    // the budget is the classic full cost, split into its three parts
    expect(f.devCostTotal + pl.devCostTotal).toBeCloseTo(m.devCostTotal * (SHARE.engine + SHARE.platform) / 1, -2);
    until(g, () => m.status === 'ready');
    expect(m.status).toBe('ready');
    expect(f.status).toBe('ready'); expect(pl.status).toBe('ready'); expect(f.variants[0].status).toBe('ready');
    expect(devOf(p, L0) / m.devCostTotal).toBeCloseTo(1, 9);
    expect(m.engineFamilyId).toBe(f.id); expect(m.platformId).toBe(pl.id);
  });
});

describe('sharing an engine family and a platform', () => {
  const firstCar = () => { const g = founder({ year: 2005 }); const a = develop(g, 'Alpha', defaultVehicle(2005, 'hatch')); until(g, () => a.status === 'ready'); return { g, p: player(g), a }; };

  it('a second car on the same engine and platform pays only its own share and is developed faster', () => {
    const { g, p, a } = firstCar();
    const L0 = p.ledger.length;
    const b = develop(g, 'Beta', { ...defaultVehicle(2005, 'sedan') }, 'family'); // a saloon on the hatch's platform
    expect(b.engineFamilyId).toBe(a.engineFamilyId); expect(b.platformId).toBe(a.platformId);
    expect(b.engineVariantId).toBe(a.engineVariantId);
    const plan = planDevelopment(g, p, defaultVehicle(2005, 'sedan'), { kind: 'new' }, { kind: 'new' });
    expect(b.devCostTotal).toBeCloseTo(plan.total * SHARE.vehicle, -3); // engine and platform are not paid again
    expect(b.devMonthsTotal).toBeLessThan(plan.months);
    until(g, () => b.status === 'ready');
    expect(devOf(p, L0) / b.devCostTotal).toBeCloseTo(1, 9);
    expect(familyUsers(p, a.engineFamilyId!)).toHaveLength(2);
    expect(platformUsers(p, a.platformId!)).toHaveLength(2);
  });
  it('a turbocharged, larger or hybrid version is a new variant: calibration only, far cheaper than a new engine', () => {
    const { g, p, a } = firstCar();
    const s = defaultVehicle(2005, 'hatch'); s.engine = { ...s.engine, aspiration: 'turbo', boost: 0.9, compression: 9.5, displacement: Math.round(s.engine.displacement * 1.15) };
    const shared = planDevelopment(g, p, s, { kind: 'family', familyId: a.engineFamilyId! }, { kind: 'platform', platformId: a.platformId! });
    const fresh = planDevelopment(g, p, s, { kind: 'new' }, { kind: 'platform', platformId: a.platformId! });
    expect(shared.ok).toBe(true);
    expect(shared.engine.kind).toBe('variant');
    expect(shared.engine.cost).toBeGreaterThan(0);
    expect(shared.engine.cost).toBeLessThan(fresh.engine.cost * 0.35);
    const b = develop(g, 'Beta GT', s, 'sports');
    expect(b.engineFamilyId).toBe(a.engineFamilyId);
    expect(enginesOf(p)[0].variants).toHaveLength(2);
    until(g, () => b.status === 'ready');
    expect(enginesOf(p)[0].variants.every((v) => v.status === 'ready')).toBe(true);
  });
  it('shared parts are bought at the combined volume: the second car makes the first one cheaper to build', () => {
    const { g, p, a } = firstCar();
    expect(A.addLine(g, p.factories[0].id, a.id, 150)).toBeNull();
    const alone = unitCost(g, a, p.factories[0], 150, sharedVolume(p, a, 150));
    const b = develop(g, 'Beta', defaultVehicle(2005, 'sedan'), 'family'); until(g, () => b.status === 'ready');
    expect(A.addLine(g, p.factories[0].id, b.id, 1500)).toBeNull();
    const together = unitCost(g, a, p.factories[0], 150, sharedVolume(p, a, 150));
    expect(sharedVolume(p, a, 150).engine).toBeCloseTo(1650, 6);
    expect(together).toBeLessThan(alone * 0.93);
    // a car that shares nothing gains nothing
    const solo = { ...a, id: 'x', engineFamilyId: 'none', platformId: 'none' } as VehicleModel;
    const unshared = unitCost(g, a, p.factories[0], 150); // same moment, own volume only
    expect(unitCost(g, solo, p.factories[0], 150, sharedVolume(p, solo, 150))).toBeCloseTo(unshared, 6);
    expect(together).toBeLessThan(unshared * 0.93);
  });
  it('tooling a second car of the same family and platform in the same plant costs less', () => {
    const { g, p, a } = firstCar();
    const b = develop(g, 'Beta', defaultVehicle(2005, 'sedan'), 'family'); until(g, () => b.status === 'ready');
    const f = p.factories[0];
    const fresh = toolingCost(b, 500, { c: p, f });
    expect(A.addLine(g, f.id, a.id, 500)).toBeNull();
    const shared = toolingCost(b, 500, { c: p, f });
    expect(shared).toBeLessThan(fresh * 0.6);
    expect(shared).toBeGreaterThan(fresh * 0.4);
  });
});

describe('compatibility', () => {
  const { g, p, a } = (() => { const g = founder({ year: 2008 }); const a = develop(g, 'Alpha', defaultVehicle(2008, 'hatch')); until(g, () => a.status === 'ready'); return { g, p: player(g), a }; })();
  const fam = () => enginesOf(p)[0], plat = () => platformsOf(p)[0];
  it('engine family envelope: block, head, fuel system and displacement range', () => {
    const e = defaultVehicle(2008, 'hatch').engine;
    expect(engineFits(fam(), e)).toEqual([]);
    expect(engineFits(fam(), { ...e, displacement: e.displacement * DISP_RANGE[1] * 1.05 })[0]).toMatch(/Displacement/);
    expect(engineFits(fam(), { ...e, valvetrain: 'sohc' })[0]).toMatch(/cylinder head/);
    expect(engineFits(fam(), { ...e, layout: 'V6', displacement: 3000 })[0]).toMatch(/new family/);
    expect(engineFits(fam(), { ...e, aspiration: 'turbo', boost: 1, hybridKw: 20 })).toEqual([]); // variants
  });
  it('platform: body group, engine bay, drivetrain, size range and hardpoints', () => {
    const s = defaultVehicle(2008, 'hatch');
    for (const body of ['hatch', 'sedan', 'wagon', 'suv'] as const) expect(platformFits(plat(), { ...s, body }), body).toEqual([]);
    expect(platformFits(plat(), { ...s, body: 'pickup' }).join()).toMatch(/does not fit/);
    expect(platformFits(plat(), { ...s, engine: { ...defaultEngine(2008), layout: 'V8', displacement: 4400 } }).join()).toMatch(/engine bay/);
    expect(platformFits(plat(), { ...s, enginePos: 'mid', drive: 'RWD' }).join()).toMatch(/engine at the front/);
    expect(platformFits(plat(), { ...s, size: s.size * 1.2 }).join()).toMatch(/Size/);
    expect(platformFits(plat(), { ...s, chassis: 'aluminium' }).join()).toMatch(/chassis/);
    const fixed = applyPlatform({ ...s, size: s.size * 1.2, chassis: 'aluminium', suspRear: 'multilink' }, plat());
    expect(platformFits(plat(), fixed)).toEqual([]);
  });
  it('forcing an incompatible architecture is refused with the reason', () => {
    const s = { ...defaultVehicle(2008, 'pickup') };
    expect(A.startDevelopment(g, 'Truck', s, 'pickup', undefined, { platform: { kind: 'platform', platformId: a.platformId! } })).toMatch(/does not fit|pickup/);
    const v6 = { ...defaultVehicle(2008, 'sedan'), engine: { ...defaultEngine(2008), layout: 'V6' as const, displacement: 3000 } };
    expect(A.startDevelopment(g, 'Six', v6, 'family', undefined, { engine: { kind: 'family', familyId: a.engineFamilyId! } })).toMatch(/new family/);
    // without a forced choice the incompatible parts are simply developed new
    const before = enginesOf(p).length;
    expect(A.startDevelopment(g, 'Six', v6, 'family')).toBeNull();
    expect(enginesOf(p).length).toBe(before + 1);
    expect(p.models[p.models.length - 1].platformId).not.toBe(a.platformId); // a V6 does not fit the four-cylinder bay: a new platform
  });
});

describe('stand-alone architecture programmes', () => {
  it('a vehicle that uses an engine family still in development waits for it; both reconcile', () => {
    const g = founder({ year: 2010 }); const p = player(g);
    const L0 = p.ledger.length;
    expect(A.startEngineFamily(g, 'EA-1', { ...defaultEngine(2010), displacement: 2000 })).toBeNull();
    const f = enginesOf(p)[0];
    expect(f.status).toBe('development'); expect(f.ownerModelId).toBeUndefined();
    const s = defaultVehicle(2010, 'hatch'); s.engine = { ...defaultEngine(2010), displacement: 2000 };
    const m = develop(g, 'Car', s, 'budget', { engine: { kind: 'family', familyId: f.id } });
    expect(m.engineFamilyId).toBe(f.id);
    until(g, () => m.status === 'ready', 200);
    expect(f.status).toBe('ready');
    expect(m.status).toBe('ready');
    expect(devOf(p, L0) / (f.devCostTotal + m.devCostTotal)).toBeCloseTo(1, 6);
    // a stand-alone variant is paid up front and ready after its calibration months
    expect(A.addEngineVariant(g, f.id, { ...s.engine, aspiration: 'turbo', boost: 1.0, compression: 9.6 })).toBeNull();
    const v = f.variants[f.variants.length - 1];
    expect(v.status).toBe('development');
    step(g, v.readyIn + 1);
    expect(v.status).toBe('ready');
    expect(A.addEngineVariant(g, f.id, { ...s.engine, aspiration: 'turbo', boost: 1.0, compression: 9.6 })).toMatch(/already exists/);
  });
  it('a stand-alone platform can be cancelled only while nothing depends on it', () => {
    const g = founder({ year: 2010 }); const p = player(g);
    expect(A.startPlatform(g, 'MQ', defaultVehicle(2010, 'hatch'))).toBeNull();
    const pl = platformsOf(p)[0];
    step(g, 2);
    const s = defaultVehicle(2010, 'sedan');
    develop(g, 'User', s, 'family', { platform: { kind: 'platform', platformId: pl.id } });
    expect(A.cancelArchitecture(g, pl.id)).toMatch(/depend/);
    A.cancelDevelopment(g, p.models[p.models.length - 1].id);
    expect(A.cancelArchitecture(g, pl.id)).toBeNull();
    expect(platformsOf(p)).toHaveLength(0);
  });
  it('cancelling a car hands its engine and platform to another car that was going to use them', () => {
    const g = founder({ year: 2010 }); const p = player(g);
    const L0 = p.ledger.length;
    const a = develop(g, 'A', defaultVehicle(2010, 'hatch'));
    const b = develop(g, 'B', defaultVehicle(2010, 'sedan'), 'family'); // re-uses A's engine and platform while A is still in development
    expect(b.engineFamilyId).toBe(a.engineFamilyId);
    step(g, 3);
    A.cancelDevelopment(g, a.id);
    const f = enginesOf(p)[0];
    expect(f.ownerModelId).toBe(b.id);
    until(g, () => b.status === 'ready', 200);
    expect(b.status).toBe('ready'); expect(f.status).toBe('ready');
    const paid = devOf(p, L0);
    expect(paid / (a.devCostPaid + b.devCostTotal)).toBeCloseTo(1, 6);
  });
});

describe('common faults and maturity', () => {
  it('a family or platform defect reaches every car that shares it; a recall makes the architecture more reliable', () => {
    const g = founder({ year: 2010 }); const p = player(g);
    A.investDealers(g, 'EU', 300e6);
    const a = develop(g, 'A', defaultVehicle(2010, 'hatch')); until(g, () => a.status === 'ready');
    const b = develop(g, 'B', defaultVehicle(2010, 'suv'), 'suv'); until(g, () => b.status === 'ready');
    for (const m of [a, b]) expect(A.addLine(g, p.factories[0].id, m.id, 700)).toBeNull();
    step(g, 8);
    const eng = engineFamilies(g, p).get(`fam:${a.engineFamilyId}`)!, plat = platformGroups(g, p).get(`plat:${a.platformId}`)!;
    expect(eng.models.map((m) => m.name).sort()).toEqual(['A', 'B']);
    expect(plat.models.map((m) => m.name).sort()).toEqual(['A', 'B']);
    expect(plat.hazard).toBeLessThan(eng.hazard * 2); // structural faults are rarer
    const relBefore = a.stats.engine.reliability;
    g.decision = defectDecision(g, p, eng);
    expect(g.decision.title).toMatch(/engine/);
    resolveDecision(g, 0, makeRng(1));
    expect(enginesOf(p)[0].history.map((h) => h.kind)).toEqual(['recall']);
    expect(a.recallRisk).toBeGreaterThan(0); expect(b.recallRisk).toBeGreaterThan(0);
    g.decision = defectDecision(g, p, plat);
    expect(g.decision.title).toMatch(/platform/);
    resolveDecision(g, 0, makeRng(1));
    expect(platformsOf(p)[0].history).toHaveLength(1);
    step(g, 13); // January refresh applies the maturity
    expect(maturity(enginesOf(p)[0], g.year)).toBeGreaterThan(2);
    expect(a.stats.engine.reliability).toBeGreaterThan(relBefore);
  });
});

describe('saves and starting positions', () => {
  it(`a version-2 save is upgraded to version ${SAVE_VERSION}: existing cars are grouped into families and platforms`, () => {
    const g = founder({ year: 2008 }); const p = player(g);
    A.investDealers(g, 'EU', 200e6);
    const a = develop(g, 'A', defaultVehicle(2008, 'hatch')); until(g, () => a.status === 'ready');
    const b = develop(g, 'B', defaultVehicle(2008, 'sedan'), 'family'); until(g, () => b.status === 'ready');
    A.addLine(g, p.factories[0].id, a.id, 600); A.addLine(g, p.factories[0].id, b.id, 600);
    step(g, 3);
    // reproduce a version-2 save: no families, no platforms, no references
    const v2 = JSON.parse(JSON.stringify(g)) as GameState;
    v2.version = 2;
    for (const c of v2.companies) { delete c.engines; delete c.platforms; for (const m of c.models) { delete m.engineFamilyId; delete m.engineVariantId; delete m.platformId; } }
    const up = prepareLoadedGame(JSON.parse(JSON.stringify(v2)));
    expect(up.version).toBe(SAVE_VERSION);
    const q = player(up);
    expect(enginesOf(q)).toHaveLength(1); expect(platformsOf(q)).toHaveLength(1);
    expect(q.models.every((m) => m.engineFamilyId && m.platformId && m.engineVariantId)).toBe(true);
    expect(enginesOf(q)[0].status).toBe('ready');
    // AI makers stay as they were (they share implicitly)
    expect(up.companies.filter((c) => !c.isPlayer).every((c) => c.engines === undefined)).toBe(true);
    const cash = q.cash;
    step(up, 6);
    expect(nonFinitePaths(up)).toEqual([]);
    expect(Number.isFinite(q.cash - cash)).toBe(true);
    for (const L of q.ledger.slice(-6)) expect(Math.abs(L.cash - L.cashStart - (L.operatingCash + L.investingCash + L.financingCash))).toBeLessThan(1e-3 * Math.max(1, Math.abs(L.cash)));
  });
  it('a CEO starts with the company\'s real engineering grouped: Ferrari 2025 shares V8 and V12 families across its range', () => {
    const p = player(ceo({ makerId: 'ferrari', year: 2025 }));
    const cars = p.models.filter((m) => m.status === 'production');
    expect(cars.every((m) => m.engineFamilyId && m.platformId)).toBe(true);
    expect(enginesOf(p).length).toBeLessThan(cars.length);
    expect(enginesOf(p).some((f) => familyUsers(p, f.id).length >= 2)).toBe(true);
    expect(enginesOf(p).every((f) => f.status === 'ready')).toBe(true);
  });
});
