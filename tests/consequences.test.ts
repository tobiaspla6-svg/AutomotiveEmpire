// Consequences and competitors (Phase 2): decisions lead to outcomes through the simulation, not dice.
import { describe, expect, it } from 'vitest';
import * as A from '../src/sim/actions';
import { MAKER } from '../src/data/manufacturers';
import { strategyOf } from '../src/data/strategy';
import { defaultEngine, defaultVehicle } from '../src/sim/engineering';
import { makerTech, respondToMarket, runAiYear } from '../src/sim/ai';
import { makeModel, RESTRUCTURE, restructuringSaving, unitCost } from '../src/sim/company';
import { engineDefectDecision, engineFamilies, engineFamily, resolveDecision } from '../src/sim/events';
import { computeMarket, valuePrice, annualSupply } from '../src/sim/market';
import { priceGuide, DEALER_NET } from '../src/sim/pricing';
import { makeRng } from '../src/sim/rng';
import type { GameState, SegmentId, VehicleModel, VehicleSpec } from '../src/sim/types';
import { ceo, founder, nonFinitePaths, player, step } from './helpers';
import { capitalOptions } from '../src/sim/world';

/** Develop a design and put it on sale at the recommended price for `units` a month. */
function launch(g: GameState, name: string, spec: VehicleSpec, seg: SegmentId, units: number): VehicleModel {
  const p = player(g);
  expect(A.startDevelopment(g, name, spec, seg)).toBeNull();
  const m = p.models[p.models.length - 1];
  let guard = 0;
  while (m.status === 'development' && guard++ < 120 && !g.gameOver) step(g);
  expect(A.addLine(g, p.factories[0].id, m.id, units)).toBeNull();
  return m;
}
const contribution = (g: GameState, m: VehicleModel, months: number) =>
  player(g).ledger.slice(-months).length && m.salesHistory.slice(-months).reduce((a, n) => a + n, 0) * (m.price * DEALER_NET - m.lastUnitCost);

describe('engineering, cost, price and demand lead to commercial results', () => {
  it('a cheap, dependable small car sells in volume and pays back', () => {
    const g = founder({ year: 2000 });
    A.investDealers(g, 'EU', 250e6);
    const s = defaultVehicle(2000, 'hatch'); s.quality = 0.5; s.engine.displacement = 1400;
    const m = launch(g, 'People', s, 'budget', 1500);
    step(g, 24);
    const sold = m.salesHistory.slice(-12).reduce((a, b) => a + b, 0);
    expect(sold).toBeGreaterThan(1500 * 12 * 0.6); // sells most of what the line builds
    expect(m.price * DEALER_NET).toBeGreaterThan(m.lastUnitCost);
    expect(contribution(g, m, 24)).toBeGreaterThan(m.devCostTotal * 0.25); // a quarter of the programme back in two years
  });
  it('an over-engineered supercar from an unknown maker does not pay back', () => {
    const g = founder({ year: 2000 });
    A.investDealers(g, 'EU', 150e6);
    const s = defaultVehicle(2000, 'supercar');
    Object.assign(s, { chassis: 'carbon', panels: 'carbon', quality: 1, interior: 'luxury', brakes: 'ceramic', enginePos: 'mid', drive: 'RWD', tireCompound: 'semislick', tireWidth: 305 });
    s.engine = { ...defaultEngine(2000), layout: 'V12', displacement: 6000, redline: 8000, cam: 0.8 };
    const p = player(g);
    const guide = priceGuide(g, p, makeModel(g, 'x', s, 'supercar', p.tech, 2000), 20, { devCost: undefined });
    expect(guide.viable).toBe(false); // the studio says so before a cent is spent
    expect(guide.breakEven).toBeGreaterThan(guide.recommended);
  });
  it('rapid expansion on borrowed money runs into a cash-flow crisis; the same company without it does not', () => {
    const run = (expand: boolean) => {
      const g = founder({ year: 2005, capital: capitalOptions(2005)[2] });
      const p = player(g);
      A.investDealers(g, 'EU', 60e6);
      launch(g, 'Base', defaultVehicle(2005, 'hatch'), 'budget', 1200);
      let plants = 0;
      // keep building large plants for demand that does not exist yet, until the lenders refuse
      if (expand) for (const c of ['Mexico', 'Spain', 'Poland', 'Brazil', 'China', 'India', 'Turkey', 'Thailand']) if (A.buildFactory(g, `Plant ${c}`, c, 1200, 0.5) === null) plants++;
      step(g, 30);
      return { g, p, plants };
    };
    const calm = run(false), bold = run(true);
    expect(bold.plants).toBeGreaterThan(0);
    expect(bold.p.debt).toBeGreaterThan(calm.p.debt + 50e6);
    expect(bold.p.cash - bold.p.debt).toBeLessThan(calm.p.cash - calm.p.debt - 50e6);
    // the crisis shows: months over the credit limit, or a warning that lenders refuse further credit
    expect(bold.p.troubleMonths > 0 || bold.g.news.some((n) => /credit limit|insolvent/i.test(n.title)) || !!bold.g.gameOver).toBe(true);
    expect(calm.p.troubleMonths).toBe(0);
    expect(nonFinitePaths(bold.g)).toEqual([]);
  });
});

describe('a defect in a shared engine affects every model that uses it', () => {
  const setup = () => {
    const g = founder({ year: 2010 });
    A.investDealers(g, 'EU', 300e6);
    const p = player(g);
    const shared = defaultVehicle(2010, 'hatch'); shared.engine = { ...defaultEngine(2010), aspiration: 'turbo', boost: 1.6, compression: 10.5, redline: 7000 }; // a stressed engine
    const a = launch(g, 'Hatch', shared, 'budget', 900);
    const b = launch(g, 'Saloon', { ...JSON.parse(JSON.stringify(shared)), body: 'sedan' }, 'family', 700);
    const other = launch(g, 'Wagon', { ...defaultVehicle(2010, 'wagon'), engine: { ...defaultEngine(2010), displacement: 2400 } }, 'family', 500);
    step(g, 10);
    return { g, p, a, b, other };
  };
  it('models with the same layout, aspiration and similar displacement share a family; a weak engine raises its hazard', () => {
    const { g, p, a, b, other } = setup();
    expect(engineFamily(a)).toBe(engineFamily(b));
    expect(engineFamily(other)).not.toBe(engineFamily(a));
    const fams = engineFamilies(g, p);
    const shared = fams.get(engineFamily(a))!, solo = fams.get(engineFamily(other))!;
    expect(shared.models.map((m) => m.name).sort()).toEqual(['Hatch', 'Saloon']);
    expect(shared.reliability).toBeLessThan(solo.reliability);
    expect(shared.hazard / Math.max(1, shared.units)).toBeGreaterThan(solo.hazard / Math.max(1, solo.units));
  });
  it('a cover-up that is exposed hits every model with that engine and nobody else; trust then recovers', () => {
    for (let seed = 1; seed < 40; seed++) {
      const { g, p, a, b, other } = setup();
      const d = engineDefectDecision(g, p, engineFamily(a));
      expect(d.title).toContain('Hatch'); expect(d.title).toContain('Saloon'); expect(d.title).not.toContain('Wagon');
      g.decision = d;
      const rep = p.reliabilityRep, demandBefore = computeMarket(g).demand;
      const rng = makeRng(seed);
      resolveDecision(g, 1, rng); // fix quietly
      if (a.recallRisk < 1) continue; // not found out this time; try another seed
      expect(b.recallRisk).toBe(1);
      expect(other.recallRisk ?? 0).toBe(0);
      expect(p.reliabilityRep).toBeLessThan(rep - 5);
      const after = computeMarket(g).demand;
      const tot = (mm: VehicleModel, dm: typeof after) => Object.values(dm.get(mm.id) ?? {}).reduce((x, y) => x + y, 0);
      // the brand's reputation suffers everywhere, but buyers shun the models with that engine far more
      const fall = (mm: VehicleModel) => tot(mm, after) / tot(mm, demandBefore);
      expect(fall(a)).toBeLessThan(0.8);
      expect(fall(a)).toBeLessThan(fall(other) * 0.85);
      step(g, 18);
      expect(a.recallRisk).toBeLessThan(0.15);
      return;
    }
    throw new Error('no seed exposed the cover-up');
  });
  it('an open recall costs money but much less trust than an exposed cover-up', () => {
    const { g, p, a } = setup();
    g.decision = engineDefectDecision(g, p, engineFamily(a));
    const cost = Number(g.decision.data!.cost), rep = p.reliabilityRep, cash = p.cash - p.debt;
    resolveDecision(g, 0, makeRng(1));
    expect(a.recallRisk).toBeCloseTo(0.25, 9);
    expect(rep - p.reliabilityRep).toBeLessThan(5);
    expect(cash - (p.cash - p.debt)).toBeCloseTo(cost, -2);
  });
});

describe('a struggling company can recover by cutting costs', () => {
  it('restructuring costs half a year of savings now and pays back within the programme', () => {
    const g = ceo({ makerId: 'jaguar', year: 2008 });
    const p = player(g);
    step(g, 2);
    const saving = restructuringSaving(g, p);
    expect(saving).toBeGreaterThan(0);
    const before = p.cash - p.debt;
    expect(A.startRestructuring(g)).toBeNull();
    expect(A.startRestructuring(g)).toMatch(/already/);
    expect(before - (p.cash - p.debt)).toBeCloseTo(saving * RESTRUCTURE.upfrontYears, -3);
    // over the programme the lower overheads are worth several times the up-front cost
    expect((saving * RESTRUCTURE.months) / 12).toBeGreaterThan(saving * RESTRUCTURE.upfrontYears * 4);
    step(g, 3);
    expect(p.restructuring).toBe(RESTRUCTURE.months - 3);
  });
  it('a company bloated with overheads recovers most of its losses by cutting engineers, research and marketing', () => {
    const g = founder({ year: 2003 });
    const p = player(g);
    A.investDealers(g, 'EU', 300e6);
    launch(g, 'Base', defaultVehicle(2003, 'hatch'), 'budget', 1500);
    step(g, 6);
    const profit3 = () => p.ledger.slice(-3).reduce((a, l) => a + l.profit, 0);
    const lean = profit3();
    A.setEngineers(g, p.engineers + 900); A.setMarketing(g, 8e6);
    for (const k of ['engine', 'chassis', 'aero', 'electronics', 'manufacturing'] as const) A.setRd(g, k, 2e6);
    step(g, 6);
    const bloated = profit3();
    expect(bloated).toBeLessThan(lean - 30e6);
    A.setEngineers(g, 220); A.setMarketing(g, 0);
    for (const k of ['engine', 'chassis', 'aero', 'electronics', 'manufacturing'] as const) A.setRd(g, k, 0);
    step(g, 6);
    const cut = profit3();
    expect(cut - bloated).toBeGreaterThan(0.8 * (lean - bloated)); // the cuts recover at least 80 % of what the overheads cost
  });
});

describe('competitors follow their identities', () => {
  it('engineering focus: the same design costs Toyota less to build than Ford, and its engines lead Honda\'s rivals', () => {
    const g = ceo({ makerId: 'ford', year: 2015 });
    const spec = defaultVehicle(2015, 'sedan');
    const at = (id: string) => { const m = makeModel(g, 'x', spec, 'family', makerTech(MAKER[id], 2015), 2015); return unitCost(g, m, { country: 'USA', automation: 0.6 }, 5000); };
    expect(at('toyota')).toBeLessThan(at('ford') * 0.98);
    expect(makerTech(MAKER.honda, 2015).engine).toBeGreaterThan(makerTech(MAKER.toyota, 2015).engine);
    expect(makerTech(MAKER.mercedes, 2015).electronics).toBeGreaterThan(makerTech(MAKER.ford, 2015).electronics);
  });
  it('rivals follow a price war in proportion to their strategy; Ferrari never discounts', () => {
    const g = ceo({ makerId: 'ford', year: 2015 });
    const ai = (id: string) => g.companies.find((c) => c.dataId === id)!;
    step(g, 6);
    const watched = ['toyota', 'hyundai', 'vw', 'ferrari'].map((id) => ({ id, prices: new Map(ai(id).models.map((m) => [m.id, m.price])) }));
    // the player slashes every budget and family car to 60 % of its worth
    const p = player(g);
    for (const m of p.models) if (m.status === 'production' && (m.segment === 'budget' || m.segment === 'family')) m.price = valuePrice(m, p, g.year, annualSupply(p, m)) * 0.6;
    step(g, 6);
    const cut = (id: string) => { const w = watched.find((x) => x.id === id)!; const c = ai(id); let n = 0, k = 0; for (const m of c.models) { const b = w.prices.get(m.id); if (!b || !(m.segment === 'budget' || m.segment === 'family')) continue; n++; if (m.price < b * 0.995) k++; } return n ? k / n : 0; };
    // makers priced above the undercutter follow it down; Hyundai already sells below its rivals and holds
    expect(cut('toyota') + cut('vw')).toBeGreaterThan(0.25);
    const f = watched.find((x) => x.id === 'ferrari')!;
    for (const m of ai('ferrari').models) { const b = f.prices.get(m.id); if (b) expect(m.price).toBeGreaterThanOrEqual(b * 0.995); } // never discounted (the January model-year price includes inflation)
    expect(strategyOf(MAKER.ferrari).priceFollow).toBe(0);
    void respondToMarket;
  });
  it('after a loss-making year, each rival reacts in its own way', () => {
    const g = ceo({ makerId: 'bmw', year: 2015 });
    step(g, 12);
    for (const id of ['toyota', 'ford', 'ferrari']) {
      const c = g.companies.find((x) => x.dataId === id)!;
      for (const L of c.ledger.slice(-12)) L.profit = -Math.abs(L.revenue) * 0.1; // a bad year
      const prices = c.models.map((m) => m.price);
      runAiYear(g, c, makeRng(3));
      if (id === 'toyota') { expect(c.aiCostCut).toBe(18); expect(c.aiPriceCut ?? 0).toBe(0); }
      if (id === 'ford') expect(c.aiPriceCut ?? 0).toBeGreaterThan(-1);
      if (id === 'ferrari') { expect(c.aiCostCut ?? 0).toBe(0); expect(c.aiPriceCut ?? 0).toBe(0); }
      void prices;
    }
    expect(strategyOf(MAKER.ford).crisis).toBe('cut-prices');
    expect(strategyOf(MAKER.toyota).crisis).toBe('cut-costs');
    expect(strategyOf(MAKER.ferrari).crisis).toBe('hold-prices');
  });
  it('the starting year sets a manufacturer\'s position: Porsche in its early-1990s crisis vs. 2015, Hyundai 1990 vs. 2020', () => {
    const cashRatio = (id: string, y: number) => { const c = player(ceo({ makerId: id, year: y })); const rev = c.models.reduce((a, m) => a + m.price, 0); return { net: c.cash - c.debt, prestige: c.prestige, tech: c.tech.engine - y, rev }; };
    expect(cashRatio('porsche', 1993).net / cashRatio('porsche', 1993).rev).toBeLessThan(cashRatio('porsche', 2015).net / cashRatio('porsche', 2015).rev);
    expect(cashRatio('hyundai', 1990).prestige).toBeLessThan(cashRatio('hyundai', 2020).prestige - 10);
  });
});
