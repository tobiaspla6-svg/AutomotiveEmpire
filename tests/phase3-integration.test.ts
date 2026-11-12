// Phase 3 end to end: one company using every new system, saved, loaded and played on.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import * as A from '../src/sim/actions';
import { defaultEngine, defaultVehicle } from '../src/sim/engineering';
import { localSaves } from '../src/store/saves';
import { prepareLoadedGame, SAVE_VERSION } from '../src/sim/migrate';
import { renderDescriptor } from '../src/sim/render';
import { enginesOf, platformsOf } from '../src/sim/families';
import { trimsOf } from '../src/sim/trims';
import { equity } from '../src/sim/accounts';
import type { Company, GameState } from '../src/sim/types';
import { founder, motorsport, nonFinitePaths, player, step } from './helpers';

const strip = (g: GameState) => JSON.stringify({ ...g, savedAt: 0 });
function books(c: Company, from: number) {
  let prev = c.ledger[from - 1];
  for (const L of c.ledger.slice(from)) {
    expect(Math.abs(L.cash - L.cashStart - (L.operatingCash + L.investingCash + L.financingCash))).toBeLessThan(1e-3 + Math.abs(L.cash) * 1e-9);
    if (prev) expect(Math.abs(L.equity - prev.equity - L.profit)).toBeLessThan(1e-3 + Math.abs(L.equity) * 1e-9);
    prev = L;
  }
}

/** A founder company with a product family, trims, contracts, stages, an order book, regional prices and a race team. */
function everything(): GameState {
  const g = founder({ year: 2014 }); const p = player(g);
  for (const r of ['EU', 'NA'] as const) A.investDealers(g, r, 200e6);
  expect(A.startDevelopment(g, 'Hatch', defaultVehicle(2014, 'hatch'), 'budget')).toBeNull();
  const a = p.models[0];
  let i = 0; while (a.status === 'development' && i++ < 80) step(g);
  expect(A.startDevelopment(g, 'Saloon', defaultVehicle(2014, 'sedan'), 'family')).toBeNull(); // shares engine and platform
  const b = p.models[1];
  const f = enginesOf(p)[0];
  expect(A.addEngineVariant(g, f.id, { ...a.spec.engine, aspiration: 'turbo', boost: 1.0, compression: 9.6, cam: 0.55 })).toBeNull();
  i = 0; while (b.status === 'development' && i++ < 80) step(g);
  expect(A.addLine(g, p.factories[0].id, a.id, 1500)).toBeNull();
  expect(A.addLine(g, p.factories[0].id, b.id, 1000)).toBeNull();
  step(g, 2);
  expect(A.addTrim(g, a.id, 'entry')).toBeNull();
  expect(A.addTrim(g, a.id, 'limited')).toBeNull();
  expect(A.signContract(g, 'semiconductors', 'kyushu-chip', 2000, 3, 'formosa-wafer', 0.3)).toBeNull();
  expect(A.buildInHouse(g, 'seats', 1000)).toBeNull();
  expect(A.setSafetyStock(g, 1)).toBeNull();
  expect(A.expandStage(g, p.factories[0].id, 'paint', 500)).toBeNull();
  expect(A.setInspection(g, p.factories[0].id, 0.8)).toBeNull();
  expect(A.setAnnualCap(g, b.id, 6000)).toBeNull();
  expect(A.setRegionalPrice(g, a.id, 'NA', a.price * 1.05)).toBeNull();
  expect(A.establishMotorsport(g, 'touring', 'Hatch Racing')).toBeNull();
  expect(A.setAcademy(g, 1)).toBeNull();
  step(g, 3);
  return g;
}

describe('Phase 3 systems together', () => {
  it('play a year with every system on: the books balance and nothing goes non-finite', () => {
    const g = everything(); const p = player(g);
    const from = p.ledger.length;
    step(g, 12);
    books(p, from);
    expect(nonFinitePaths(g)).toEqual([]);
    expect(platformsOf(p)).toHaveLength(1);
    expect(trimsOf(p.models[0]).length).toBe(3);
    expect(Number.isFinite(equity(p))).toBe(true);
  });
  it(`saves (format ${SAVE_VERSION}) through IndexedDB and plays on identically`, async () => {
    const g = everything();
    await localSaves.save('phase3', g);
    const loaded = await localSaves.load('phase3');
    expect(strip(loaded!)).toBe(strip(g));
    step(g, 6); step(loaded!, 6);
    expect(strip(loaded!)).toBe(strip(g));
    await localSaves.remove('phase3');
    // and through a file export
    const up = prepareLoadedGame(JSON.parse(JSON.stringify(g)));
    expect(up.version).toBe(SAVE_VERSION);
    step(up, 2);
    expect(nonFinitePaths(up)).toEqual([]);
  });
  it('a motorsport save from before the driver market and a v2 CEO save both load into format 3', () => {
    const m = motorsport({ discipline: 'f1', year: 2015 });
    step(m, 2);
    const raw = JSON.parse(JSON.stringify(m)) as GameState; raw.version = 2;
    const up = prepareLoadedGame(raw);
    expect(up.version).toBe(SAVE_VERSION);
    step(up, 13);
    expect(nonFinitePaths(up)).toEqual([]);
  });
});

describe('render descriptor', () => {
  it('describes each car and trim with the data a renderer needs, as plain JSON', () => {
    const g = everything(); const p = player(g);
    const a = p.models[0];
    const d = renderDescriptor(p, a);
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
    expect(d.platform.id).toBe(a.platformId);
    expect(d.wheelbase).toBeGreaterThan(2); expect(d.wheelbase).toBeLessThan(d.length);
    expect(d.track).toBeLessThan(d.width);
    expect(d.engine.layout).toBe(a.spec.engine.layout);
    const lim = trimsOf(a).find((t) => t.level === 'limited')!;
    const dl = renderDescriptor(p, a, lim);
    expect(dl.trim.level).toBe('limited');
    expect(dl.wheelDia).toBeGreaterThan(d.wheelDia);
    expect(renderDescriptor(null, { ...a, spec: { ...a.spec, engine: { ...defaultEngine(2014), layout: 'EV', motorKw: 150, batteryKwh: 60 } } }).engine.electric).toBe(true);
  });
});
