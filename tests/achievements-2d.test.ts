// Phase 5: achievements and company level come from real simulation facts, are claimed once, are stored in the save
// and never add money, demand or performance.
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { founder, ceo, player } from './helpers';
import { SPECIALIZATIONS } from '../src/sim/world';
import type { VehicleModel } from '../src/sim/types';
import { ACHIEVEMENTS, achievementViews, claimAchievement, companyLevel, levelOf, LEVELS, nextLevelXp } from '../src/sim/achievements';
import { BLUEPRINTS, REDEEM_LEVEL, emptyArcade, fixedPrice, redeemPart } from '../src/sim/progression';
import { saveDamage } from '../src/sim/migrate';
import { ICONIC_ENGINES, iconicFor } from '../src/data/iconicEngines';
import { Car2D } from '../src/ui/art2d/Car2D';
import { Engine2D } from '../src/ui/art2d/Engine2D';
import { Chest2D, PartCard, RARITY_ORDER } from '../src/ui/art2d/Rewards2D';
import { Campus2D } from '../src/ui/art2d/Campus2D';
import { FactoryLine2D, SECTORS } from '../src/ui/art2d/FactoryLine2D';

describe('achievements', () => {
  it('a new founder has reached nothing and cannot claim anything, whatever the era or start', () => {
    for (const year of [1950, 1975, 2000, 2020]) for (const factory of [0, 1, 2, 3]) for (const specialization of SPECIALIZATIONS.map((x) => x.id)) {
      const g = founder({ year, factory, specialization });
      for (const v of achievementViews(g, player(g))) expect(v.done, `${year} ${factory} ${specialization} ${v.a.id}`).toBe(false);
    }
    const g = founder({ year: 2000 });
    expect(claimAchievement(g, 'first-car')).toBe('Achievement not reached yet.');
    expect(claimAchievement(g, 'nope')).toBe('Unknown achievement.');
  });

  it('is claimed once, gives xp and credits only, and is serialisable', () => {
    const g = founder({ year: 2000 }), p = player(g);
    const cash = p.cash, debt = p.debt, tech = { ...p.tech }, awareness = { ...p.awareness }, reach = { ...p.reach };
    const donor = player(ceo({ makerId: 'toyota', year: 1995 })).models[0];
    p.models.push({ ...structuredClone(donor), id: 'built', cumulativeUnits: 120, status: 'retired' } as VehicleModel);
    const r = claimAchievement(g, 'built-100');
    expect(typeof r).toBe('object');
    if (typeof r === 'string') throw new Error(r);
    expect(r.xp).toBe(80); expect(r.credits).toBe(40);
    expect(p.arcade!.xp).toBe(80); expect(p.arcade!.credits).toBe(40);
    expect(p.arcade!.achievements!['built-100']).toEqual({ y: g.year, m: g.month });
    expect(claimAchievement(g, 'built-100')).toBe('Achievement already claimed.');
    expect(p.arcade!.xp).toBe(80);
    expect(p.cash).toBe(cash); expect(p.debt).toBe(debt); expect(p.tech).toEqual(tech); expect(p.awareness).toEqual(awareness); expect(p.reach).toEqual(reach);
    expect(JSON.parse(JSON.stringify(p.arcade))).toEqual(p.arcade);
    expect(saveDamage(g)).toBeNull();
  });

  it('gives its blueprint only once the part exists in the era', () => {
    const donor = player(ceo({ makerId: 'toyota', year: 1995 })).models[0];
    const bp = BLUEPRINTS.find((b) => b.id === 'five-spoke')!;
    const late = founder({ year: 2000 }), early = founder({ year: 1950 });
    for (const g of [late, early]) player(g).models.push({ ...structuredClone(donor), id: 'sold', cumulativeUnits: 12000, status: 'retired' } as VehicleModel);
    const r = claimAchievement(late, 'sold-10k');
    if (typeof r === 'string') throw new Error(r);
    expect(r.blueprint).toBe('five-spoke');
    expect(player(late).arcade!.inventory['five-spoke']).toBe(1);
    const r2 = claimAchievement(early, 'sold-10k');
    if (typeof r2 === 'string') throw new Error(r2);
    expect(r2.blueprint).toBe(bp.firstYear <= 1950 ? 'five-spoke' : null);
    expect(r2.credits).toBe(80);
  });

  it('a manufacturer CEO game reflects the real company it inherits', () => {
    const g = ceo({ makerId: 'toyota', year: 1995 }), p = player(g);
    const done = achievementViews(g, p).filter((v) => v.done).map((v) => v.a.id);
    expect(done).toContain('first-car');
    expect(done).toContain('three-models');
    expect(done).not.toContain('champion');
  });

  it('every achievement has both languages, positive rewards and an existing blueprint', () => {
    const ids = new Set<string>();
    for (const a of ACHIEVEMENTS) {
      expect(ids.has(a.id)).toBe(false); ids.add(a.id);
      expect(a.es && a.en && a.descEs && a.descEn).toBeTruthy();
      expect(a.xp).toBeGreaterThan(0); expect(a.credits).toBeGreaterThan(0);
      if (a.blueprint) expect(BLUEPRINTS.some((b) => b.id === a.blueprint), a.id).toBe(true);
    }
  });
});

describe('company level', () => {
  it('follows the experience table', () => {
    expect(levelOf(0)).toBe(1); expect(levelOf(99)).toBe(1); expect(levelOf(100)).toBe(2); expect(levelOf(4500)).toBe(LEVELS.length);
    expect(nextLevelXp(0)).toBe(100); expect(nextLevelXp(4500)).toBeNull();
    expect(companyLevel(player(founder()))).toBe(1);
  });

  it('gates redemptions by level, and relics are never redeemable', () => {
    const g = founder({ year: 2030 }), p = player(g);
    p.arcade = { ...emptyArcade(), credits: 100000 };
    const epic = BLUEPRINTS.find((b) => b.rarity === 'epic' && b.firstYear <= 2030)!;
    expect(redeemPart(g, epic.id)).toBe(`Company level ${REDEEM_LEVEL.epic} needed.`);
    p.arcade.xp = 250; // level 3
    expect(redeemPart(g, epic.id)).toBeNull();
    expect(p.arcade.credits).toBe(100000 - fixedPrice('epic'));
    const relic = BLUEPRINTS.find((b) => b.rarity === 'relic');
    if (relic) { p.arcade.xp = 99999; expect(redeemPart(g, relic.id)).toBe('Relic blueprints are only won, never redeemed.'); }
  });

  it('rejects damaged experience or achievement records in a save', () => {
    const g = founder(), p = player(g);
    p.arcade = { ...emptyArcade(), xp: -5 };
    expect(saveDamage(g)).not.toBeNull();
    p.arcade = { ...emptyArcade(), xp: 10, achievements: { 'first-car': { y: 'x' as unknown as number, m: 1 } } };
    expect(saveDamage(g)).not.toBeNull();
    p.arcade = { ...emptyArcade(), xp: 10, achievements: { 'first-car': { y: 2000, m: 1 } } };
    expect(saveDamage(g)).toBeNull();
    delete p.arcade; // saves from before Phase 5 have no arcade at all
    expect(saveDamage(g)).toBeNull();
  });
});

describe('iconic engine catalogue', () => {
  it('every entry is dated, sourced and has a playable preset', () => {
    expect(ICONIC_ENGINES.length).toBeGreaterThanOrEqual(12);
    for (const e of ICONIC_ENGINES) {
      expect(e.decade).toBe(Math.floor(e.year / 10) * 10);
      expect(e.sources.length, e.id).toBeGreaterThan(0);
      for (const u of e.sources) expect(u.startsWith('https://'), u).toBe(true);
      expect(e.preset.layout).toBeTruthy();
      expect(e.fact.rated).toBeTruthy();
    }
    for (const id of ['toyota-2jz', 'ford-coyote', 'chevy-sbc-265', 'nissan-rb26', 'honda-k20']) expect(ICONIC_ENGINES.some((e) => e.id === id), id).toBe(true);
    expect(iconicFor(1960).every((e) => e.year <= 1960)).toBe(true);
  });
});

describe('2D art', () => {
  const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
  it('cars change with body, era and equipped cosmetics', () => {
    const plain = html(createElement(Car2D, { body: 'coupe', year: 2000, color: '#c8352e' }));
    const kitted = html(createElement(Car2D, { body: 'coupe', year: 2000, color: '#c8352e', equipped: { body: 'endurance' } }));
    const fifties = html(createElement(Car2D, { body: 'coupe', year: 1955, color: '#c8352e' }));
    const suv = html(createElement(Car2D, { body: 'suv', year: 2000, color: '#c8352e' }));
    expect(plain).toContain('<svg'); expect(plain).not.toContain('<canvas');
    expect(kitted).not.toBe(plain); expect(fifties).not.toBe(plain); expect(suv).not.toBe(plain);
  });
  it('engines, chests, cards, campus and plant render as SVG', () => {
    for (const l of ['I4', 'V8', 'F6', 'EV'] as const) expect(html(createElement(Engine2D, { engine: { layout: l } }))).toContain('<svg');
    const chests = RARITY_ORDER.map((r) => html(createElement(Chest2D, { rarity: r, state: 'ready' })));
    expect(new Set(chests).size).toBe(RARITY_ORDER.length);
    expect(html(createElement(PartCard, { part: BLUEPRINTS[0], lang: 'en' }))).toContain('card2d');
    const campus = { name: 'X', color: '#123456', officeTier: 2, studioTier: 1, labTier: 1, plants: [{ id: 'a', name: 'A', capacity: 500, building: false, automation: 0.6 }], showroomTier: 1, track: false, racing: false, trophies: 0, billboard: true, stock: 0 } as const;
    expect(html(createElement(Campus2D, { s: { ...campus, plants: [...campus.plants] }, active: null }))).toContain('<svg');
    const load = Object.fromEntries(SECTORS.map((s) => [s, { use: 0.5, bottleneck: s === 'paint', working: true }])) as never;
    const plant = html(createElement(FactoryLine2D, { load, automation: 0.8, color: '#c00', active: 'body', onPick: () => {}, labels: Object.fromEntries(SECTORS.map((s) => [s, s])) as never }));
    expect(plant).toContain('fl-bottleneck');
    const manual = html(createElement(FactoryLine2D, { load, automation: 0.1, color: '#c00', active: 'body', onPick: () => {}, labels: Object.fromEntries(SECTORS.map((s) => [s, s])) as never }));
    expect(manual).not.toBe(plant); // robots replace workers as automation rises
  });
});
