import { describe, expect, it } from 'vitest';
import { LAST_START_YEAR, MAKERS, makerStart, productionDataThrough } from '../src/data/manufacturers';
import { COUNTRY, MARKET_DATA_THROUGH, SEG } from '../src/data/world';
import { BODY } from '../src/sim/engineering';
import { DISCIPLINES, getRegs } from '../src/sim/racing/regs';
import { ceo, founder, motorsport, nonFinitePaths, player, step } from './helpers';

const activeNames = (makerId: string, year: number) => player(ceo({ makerId, year })).models.filter((m) => m.status === 'production').map((m) => m.name);

describe('manufacturer catalogue data', () => {
  it('every model row and plant is internally consistent', () => {
    for (const d of MAKERS) {
      expect(productionDataThrough(d)).toBeGreaterThanOrEqual(2020);
      for (let i = 1; i < d.production.length; i++) expect(d.production[i][0], d.name).toBeGreaterThan(d.production[i - 1][0]);
      for (const f of d.factories) expect(COUNTRY[f.country], `${d.name} ${f.name}`).toBeTruthy();
      for (const r of d.models) {
        const tag = `${d.name} ${r.name}`;
        expect(r.from, tag).toBeLessThanOrEqual(r.to);
        expect(SEG[r.seg], tag).toBeTruthy();
        expect(BODY[r.body], tag).toBeTruthy();
        if (r.layout === 'EV') { expect(r.kwh, tag).toBeGreaterThan(0); expect(r.kw, tag).toBeGreaterThan(0); } else expect(r.cc, tag).toBeGreaterThan(0);
      }
    }
  });
  it(`offers start years up to ${LAST_START_YEAR}; data after ${MARKET_DATA_THROUGH} is flagged as estimated`, () => {
    expect(LAST_START_YEAR).toBe(2026);
    expect(MARKET_DATA_THROUGH).toBeLessThan(LAST_START_YEAR);
  });
});

describe('line-ups follow the real model changes of 2023–2026', () => {
  it.each([
    ['ferrari', 2026, ['12Cilindri', 'Amalfi', 'F80', '296 GTB', '849 Testarossa'], ['Roma', 'SF90 Stradale']],
    ['bmw', 2025, ['5 Series (G60)', 'X3 (G45)', 'i5', 'iX3 (Neue Klasse)'], ['5 Series (G30)', 'X3 (G01)']], // 2024 overlaps old and new X3
    ['mercedes', 2025, ['E-Class (W214)', 'CLA (C178)'], ['E-Class (W213)']],
    ['lamborghini', 2025, ['Temerario', 'Revuelto', 'Urus'], ['Huracán']],
    ['toyota', 2025, ['Camry (XV80)', 'Prius (XW60)'], ['Camry (XV70)']],
    ['vw', 2025, ['Tiguan (3rd gen)', 'Passat (B9)', 'ID.7'], ['Tiguan II', 'Passat (B8)']],
    ['audi', 2025, ['A5 (B10)', 'Q6 e-tron', 'A6 (C9)'], ['A4 (B9)', 'e-tron']],
    ['jaguar', 2025, ['F-Pace'], ['XF', 'I-Pace', 'E-Pace', 'F-Type', 'XE']],
    ['ford', 2026, ['Mustang (S650)', 'F-150 (14th gen)'], ['Mustang (S550)', 'Focus (Mk3/Mk4)']],
    ['tesla', 2024, ['Model 3', 'Model Y', 'Cybertruck'], []],
  ] as const)('%s %i', (makerId, year, present, absent) => {
    const names = activeNames(makerId, year);
    for (const n of present) expect(names, `${makerId} ${year} should build ${n}`).toContain(n);
    for (const n of absent) expect(names, `${makerId} ${year} should no longer build ${n}`).not.toContain(n);
  });
});

describe('every mode starts in 2025 and 2026', () => {
  for (const year of [2025, 2026]) {
    it(`Historical CEO ${year} for every manufacturer`, () => {
      for (const d of MAKERS) {
        expect(makerStart(d)).toBeLessThanOrEqual(year);
        const g = ceo({ makerId: d.id, year });
        expect(player(g).models.some((m) => m.status === 'production'), d.name).toBe(true);
        expect(nonFinitePaths(g), d.name).toEqual([]);
      }
    });
    it(`Company Founder ${year}`, () => {
      const g = founder({ year });
      step(g, 3);
      expect(nonFinitePaths(g)).toEqual([]);
    });
    it(`Motorsport Director ${year} in every discipline`, () => {
      for (const d of DISCIPLINES) {
        const g = motorsport({ discipline: d.id, year });
        expect(player(g).motorsport!.championship.year).toBe(year);
        expect(nonFinitePaths(g), d.id).toEqual([]);
      }
    });
  }
  it('the 2026 Grand Prix grid has 11 teams including the new Audi and Cadillac (GM) works entries', () => {
    const ch = player(motorsport({ discipline: 'f1', year: 2026 })).motorsport!.championship;
    expect(ch.teams).toHaveLength(getRegs('f1', 2026).teams);
    const works = ch.teams.map((t) => t.companyId);
    expect(works).toContain('audi');
    expect(works).toContain('gm');
  });
  it('the 2026 endurance grid no longer has Lamborghini and gains the Hyundai (Genesis) entry', () => {
    const works = player(motorsport({ discipline: 'hypercar', year: 2026 })).motorsport!.championship.teams.map((t) => t.companyId);
    expect(works).not.toContain('lamborghini');
    expect(works).toContain('hyundai');
  });
  it('a 2026 CEO game runs into the estimated years without numeric corruption', () => {
    const g = ceo({ makerId: 'toyota', year: 2026 });
    step(g, 26);
    expect(g.year).toBe(2028);
    expect(nonFinitePaths(g)).toEqual([]);
  });
});
