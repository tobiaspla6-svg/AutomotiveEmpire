// Pricing (Phase 2): list prices of the historical makers, their pricing strategies, the market's
// response to price, and the price guidance shown in the design studio.
import { describe, expect, it } from 'vitest';
import * as A from '../src/sim/actions';
import { MAKER } from '../src/data/manufacturers';
import { positionIn, strategyOf } from '../src/data/strategy';
import { SEGMENT_IDS } from '../src/data/world';
import { defaultEngine, defaultVehicle } from '../src/sim/engineering';
import { makeModel } from '../src/sim/company';
import { annualSupply, computeMarket, MAX_SCARCITY, priceResponse, scarcityPremium, valuePrice } from '../src/sim/market';
import { DEALER_NET, aiTargetPrice, demandCurve, priceGuide } from '../src/sim/pricing';
import type { Company, GameState, SegmentId, VehicleModel, VehicleSpec } from '../src/sim/types';
import { PRICE_BENCHMARKS } from './benchmarks';
import { ceo, founder, nonFinitePaths, player, step } from './helpers';

const games = new Map<string, GameState>();
const game = (maker: string, year: number) => { const k = `${maker}:${year}`; let g = games.get(k); if (!g) { g = ceo({ makerId: maker, year }); games.set(k, g); } return g; };
const company = (g: GameState, id: string) => g.companies.find((c) => c.dataId === id)!;
const car = (maker: string, row: string, year: number) => {
  const def = MAKER[maker]; const r = def.models.find((x) => x.name === row)!;
  const g = game(maker, Math.min(Math.max(year, r.from), Math.min(r.to, 2026)));
  const c = player(g); const m = c.models.find((x) => x.name === row)!;
  return { g, c, m };
};
const margin = (m: VehicleModel) => (m.price * DEALER_NET - m.lastUnitCost) / (m.price * DEALER_NET);
const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];

describe('list prices of historical cars', () => {
  const rows = PRICE_BENCHMARKS.map((b) => ({ b, ...car(b.maker, b.row, b.year) }));
  it.each(rows.filter((r) => !r.b.halo).map((r) => [`${MAKER[r.b.maker].name} ${r.b.row} (${r.b.year})`, r] as const))('%s is priced within reach of its real list price', (_n, r) => {
    const ratio = r.m.price / r.b.usd;
    expect(ratio, `$${Math.round(r.m.price)} vs real $${r.b.usd}`).toBeGreaterThan(0.62);
    expect(ratio, `$${Math.round(r.m.price)} vs real $${r.b.usd}`).toBeLessThan(1.5);
  });
  it('the typical error is small and unbiased', () => {
    const logs = rows.filter((r) => !r.b.halo).map((r) => Math.log(r.m.price / r.b.usd));
    expect(median(logs.map(Math.abs))).toBeLessThan(0.2); // median within about ±20 %
    expect(Math.abs(logs.reduce((a, b) => a + b, 0) / logs.length)).toBeLessThan(0.1);
  });
  it('limited-series flagships are priced far above the series cars (was: by segment rule only)', () => {
    const p = (maker: string, row: string, year: number) => car(maker, row, year).m.price;
    const f80 = p('ferrari', 'F80', 2026), gtb = p('ferrari', '296 GTB', 2026);
    expect(f80).toBeGreaterThan(1.2e6); // was $555k; real $3.9M
    expect(f80).toBeGreaterThan(gtb * 3.5);
    expect(p('ferrari', 'F40', 1990)).toBeGreaterThan(p('ferrari', '348', 1990) * 1.6);
    expect(p('mclaren', 'F1', 1995)).toBeGreaterThan(600e3); // was $190k; real about $900k
    expect(p('porsche', 'Carrera GT', 2005)).toBeGreaterThan(p('porsche', '911 (997)', 2005) * 3);
  });
  it('ranks cars as the real market does', () => {
    const p = (maker: string, row: string, year: number) => car(maker, row, year).m.price;
    expect(p('toyota', 'Corolla (E210)', 2022)).toBeLessThan(p('toyota', 'Camry (XV70)', 2022));
    expect(p('toyota', 'Camry (XV70)', 2022)).toBeLessThan(p('bmw', '3 Series (G20)', 2022) * 1.05);
    expect(p('bmw', '3 Series (G20)', 2022)).toBeLessThan(p('porsche', '911 (992)', 2022));
    expect(p('porsche', '911 (992)', 2022)).toBeLessThan(p('mercedes', 'S-Class (W223)', 2022) * 1.2);
    expect(p('mercedes', 'S-Class (W223)', 2022)).toBeLessThan(p('lamborghini', 'Urus', 2022));
    expect(p('lamborghini', 'Urus', 2022)).toBeLessThan(p('ferrari', '296 GTB', 2025));
    expect(p('ferrari', '296 GTB', 2025)).toBeLessThan(p('ferrari', '12Cilindri', 2025));
  });
});

describe('manufacturers price differently', () => {
  const g = game('toyota', 2022);
  const range = (id: string) => company(g, id).models.filter((m) => m.status === 'production');
  it('margins follow the business model: Ferrari > Lamborghini > Porsche > Toyota > Ford cars', () => {
    const m = (id: string, f: (x: VehicleModel) => boolean = () => true) => median(range(id).filter(f).map(margin));
    const ferrari = m('ferrari'), lambo = m('lamborghini'), porsche = m('porsche'), toyota = m('toyota'), fordCars = m('ford', (x) => x.segment !== 'pickup' && x.segment !== 'suv');
    expect(ferrari).toBeGreaterThan(0.4);
    expect(ferrari).toBeGreaterThan(lambo);
    expect(lambo).toBeGreaterThan(porsche);
    expect(porsche).toBeGreaterThan(toyota + 0.08);
    expect(toyota).toBeGreaterThan(fordCars);
    expect(fordCars).toBeLessThan(0.15);
    // Ford earns its money on trucks
    expect(m('ford', (x) => x.segment === 'pickup')).toBeGreaterThan(fordCars + 0.08);
  });
  it('the same car is worth and priced differently under each badge', () => {
    const spec: VehicleSpec = { ...defaultVehicle(2022, 'coupe'), drive: 'RWD', sport: 0.7, interior: 'premium', quality: 0.7, tireCompound: 'sport', engine: { ...defaultEngine(2022), layout: 'V8', displacement: 4000, redline: 7500, cam: 0.6 } };
    const price = (id: string, seg: SegmentId) => {
      const c = company(g, id);
      const m = makeModel(g, 'Same', spec, seg, c.tech, 2022); m.status = 'production';
      return { ask: aiTargetPrice(g, c, m, 20000), worth: valuePrice(m, c, 2022, 20000) };
    };
    const f = price('ferrari', 'sports'), l = price('lamborghini', 'sports'), p = price('porsche', 'sports'), t = price('toyota', 'sports'), fo = price('ford', 'sports');
    expect(f.worth).toBeGreaterThan(p.worth * 0.93); // the two sports-car names are worth about the same
    expect(f.worth).toBeGreaterThan(t.worth * 1.25);
    expect(p.worth).toBeGreaterThan(t.worth * 1.25); // the badge alone is worth a quarter more
    expect(t.worth).toBeGreaterThan(fo.worth); // reliability reputation
    expect(l.worth).toBeGreaterThan(t.worth);
    // price position: Ferrari and Porsche ask more than the car's worth, Toyota a little less, Ford clearly less
    expect(f.ask / f.worth).toBeGreaterThan(1.03); expect(p.ask / p.worth).toBeGreaterThan(1.03);
    expect(t.ask / t.worth).toBeLessThan(f.ask / f.worth - 0.05); // (a cost floor can lift a volume maker's ask on a costly car)
    expect(positionIn(strategyOf(MAKER.toyota), 'sports')).toBeLessThan(1);
    expect(positionIn(strategyOf(MAKER.ford), 'sports')).toBeLessThan(positionIn(strategyOf(MAKER.toyota), 'sports'));
    expect(positionIn(strategyOf(MAKER.ford), 'pickup')).toBeGreaterThan(1);
    const all = [f.ask, l.ask, p.ask, t.ask, fo.ask];
    expect(Math.max(...all) / Math.min(...all)).toBeGreaterThan(1.6);
  });
  it('every manufacturer has a strategy profile, and the five named ones are distinct', () => {
    for (const def of Object.values(MAKER)) { const s = strategyOf(def); expect(s.title.length, def.name).toBeGreaterThan(5); expect(s.minMargin).toBeGreaterThan(0); }
    const five = ['ferrari', 'lamborghini', 'porsche', 'toyota', 'ford'].map((id) => strategyOf(MAKER[id]));
    expect(new Set(five.map((s) => s.title)).size).toBe(5);
    expect(new Set(five.map((s) => `${s.pricePosition}/${s.minMargin}/${s.priceFollow}`)).size).toBe(5);
  });
});

describe('demand responds to price', () => {
  it('falls with price in every segment, and collapses when a car is priced far above its worth', () => {
    for (const seg of SEGMENT_IDS) {
      let prev = Infinity;
      for (let r = 0.4; r <= 4; r += 0.1) { const d = priceResponse(seg, r); expect(d).toBeLessThanOrEqual(prev); prev = d; }
      expect(priceResponse(seg, 1)).toBeCloseTo(1, 9);
      expect(priceResponse(seg, 2), seg).toBeLessThan(0.3);
      expect(priceResponse(seg, 3), seg).toBeLessThan(0.05);
    }
  });
  it('budget buyers are far more price-sensitive than supercar buyers', () => {
    expect(priceResponse('budget', 1.15)).toBeLessThan(priceResponse('supercar', 1.15) * 0.8);
    expect(priceResponse('budget', 0.85)).toBeGreaterThan(priceResponse('supercar', 0.85) * 1.3);
  });
  it('no segment rewards endless price rises: revenue peaks near the car\'s worth (was unbounded for supercars)', () => {
    for (const seg of SEGMENT_IDS) {
      const revenue = (r: number) => r * priceResponse(seg, r);
      let best = 0, at = 0;
      for (let r = 0.4; r <= 6; r += 0.02) if (revenue(r) > best) { best = revenue(r); at = r; }
      expect(at, seg).toBeLessThan(1.25);
      expect(revenue(4), seg).toBeLessThan(revenue(1) * 0.2);
    }
  });
  it('in the market: a higher price sells fewer cars, and competitors gain what is lost', () => {
    const { g, c, m } = car('toyota', 'Camry (XV70)', 2022);
    const base = m.price;
    const sales = (price: number) => { m.price = price; const mk = computeMarket(g); const d = mk.demand.get(m.id)!; m.price = base; return { own: Object.values(d).reduce((a, b) => a + b, 0), mk }; };
    const a = sales(base), up = sales(base * 1.2), down = sales(base * 0.9), silly = sales(base * 3);
    expect(up.own).toBeLessThan(a.own * 0.75);
    expect(down.own).toBeGreaterThan(a.own * 1.1);
    expect(silly.own).toBeLessThan(a.own * 0.03);
    const rivals = (x: typeof a) => { let s = 0; for (const cell of Object.values(x.mk.cells)) for (const e of cell.entries) if (e.model.segment === 'family' && e.company.id !== c.id) s += e.demand; return s; };
    expect(rivals(up)).toBeGreaterThan(rivals(a));
  });
  it('the demand curve used for forecasts agrees with the market itself', () => {
    const { g, c, m } = car('toyota', 'Camry (XV70)', 2022);
    const mk = computeMarket(g);
    const real = Object.values(mk.demand.get(m.id)!).reduce((a, b) => a + b, 0);
    const curve = demandCurve(g, c, m, annualSupply(c, m) / 12, mk);
    expect(curve(m.price)).toBeGreaterThan(real * 0.97); expect(curve(m.price)).toBeLessThan(real * 1.03);
  });
});

describe('scarcity', () => {
  it('rarity adds value only to prestige goods from prestigious makers', () => {
    expect(scarcityPremium('supercar', 2025, 97, 100)).toBeGreaterThan(3);
    expect(scarcityPremium('supercar', 2025, 97, 5000)).toBe(1);
    expect(scarcityPremium('supercar', 2025, 45, 100)).toBe(1); // nobody queues for a rare car from an unknown badge
    expect(scarcityPremium('budget', 2025, 97, 100)).toBe(1);
    expect(scarcityPremium('supercar', 2025, 97, 50)).toBeGreaterThan(scarcityPremium('supercar', 2025, 97, 400));
    expect(scarcityPremium('supercar', 2025, 97, 1)).toBeLessThanOrEqual(MAX_SCARCITY); // bounded (cap raised from 8 to 12 in Phase 3)
    expect(MAX_SCARCITY).toBeLessThanOrEqual(12);
  });
});

describe('price guidance in the design studio', () => {
  const fresh = (seg: SegmentId, f: (s: VehicleSpec) => void, year = 2015) => {
    const g = founder({ year }); const c = player(g);
    A.investDealers(g, 'EU', 150e6);
    const spec = defaultVehicle(year, seg === 'supercar' ? 'supercar' : 'hatch'); f(spec);
    const m = makeModel(g, 'Probe', spec, seg, c.tech, year);
    return { g, c, m };
  };
  it('break-even is the full cost per car over the dealer margin, and falls as the planned volume rises', () => {
    const { g, c, m } = fresh('budget', () => {});
    const lo = priceGuide(g, c, m, 300), hi = priceGuide(g, c, m, 6000);
    for (const x of [lo, hi]) {
      expect(x.fullCost).toBeCloseTo(x.unitCost + x.devPerCar + x.toolingPerCar, 6);
      expect(x.breakEven).toBeCloseTo(x.fullCost / DEALER_NET, 6);
      expect(x.contribution).toBeCloseTo(x.recommended * DEALER_NET - x.unitCost, 6);
      expect(x.contributionPct).toBeCloseTo(x.contribution / (x.recommended * DEALER_NET), 9);
      expect(x.lifeUnits).toBe(x.volume * 12 * 6);
      expect(nonFinitePaths(x)).toEqual([]);
    }
    expect(hi.unitCost).toBeLessThan(lo.unitCost);
    expect(hi.devPerCar).toBeLessThan(lo.devPerCar / 15);
    expect(hi.breakEven).toBeLessThan(lo.breakEven * 0.8);
  });
  it('the recommended price is the best of the alternatives around it and never below the minimum margin', () => {
    const { g, c, m } = fresh('budget', () => {});
    const gd = priceGuide(g, c, m, 2000);
    const curve = demandCurve(g, c, m, 2000);
    const profit = (p: number) => (p * DEALER_NET - gd.unitCost) * Math.min(curve(p), 2000);
    for (const k of [0.7, 0.85, 1.2, 1.5, 2]) expect(profit(gd.recommended)).toBeGreaterThanOrEqual(profit(gd.recommended * k) - 1);
    expect(gd.recommended * DEALER_NET).toBeGreaterThan(gd.unitCost);
    expect(gd.demand).toBeLessThanOrEqual(2000);
  });
  it('a cheap, dependable car is viable in volume; an over-engineered supercar from an unknown maker is not', () => {
    const cheap = fresh('budget', (s) => { s.quality = 0.45; });
    const a = priceGuide(cheap.g, cheap.c, cheap.m, 4000);
    expect(a.viable).toBe(true);
    expect(a.contributionPct).toBeGreaterThan(0.05); expect(a.contributionPct).toBeLessThan(0.45);
    const exotic = fresh('supercar', (s) => {
      s.chassis = 'carbon'; s.panels = 'carbon'; s.quality = 1; s.interior = 'luxury'; s.brakes = 'ceramic'; s.enginePos = 'mid'; s.drive = 'RWD';
      s.engine = { ...defaultEngine(2015), layout: 'V12', displacement: 6500, redline: 8500, cam: 0.8 };
    });
    const b = priceGuide(exotic.g, exotic.c, exotic.m, 10);
    expect(b.breakEven).toBeGreaterThan(b.value * 1.5); // costs far more than an unknown badge can charge
    expect(b.viable).toBe(false);
    // the same car under the most prestigious badge of the day is worth several times more
    const ferrari = company(game('toyota', 2015), 'ferrari');
    expect(valuePrice(exotic.m, ferrari, 2015, 120)).toBeGreaterThan(b.value * 3);
  });
  it('a new production line opens at the recommended price, and the player can then set any valid price', () => {
    const g = founder(); const c = player(g);
    A.startDevelopment(g, 'Probe', defaultVehicle(g.year, 'hatch'), 'budget');
    const m = c.models[c.models.length - 1];
    while (m.status === 'development') step(g);
    expect(m.price).toBe(0);
    expect(A.addLine(g, c.factories[0].id, m.id, 1500)).toBeNull();
    const gd = priceGuide(g, c, m, 1500);
    expect(Math.abs(m.price / gd.recommended - 1)).toBeLessThan(0.02);
    expect(A.setPrice(g, m.id, gd.recommended * 4)).toBeNull(); // free to price badly
    step(g, 3);
    const overpriced = m.lastDemand;
    expect(A.setPrice(g, m.id, gd.recommended)).toBeNull();
    step(g, 2);
    expect(m.lastDemand).toBeGreaterThan(20);
    expect(m.lastDemand).toBeGreaterThan(overpriced * 20);
  });
});
