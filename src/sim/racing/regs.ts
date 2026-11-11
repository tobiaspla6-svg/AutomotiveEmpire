// Technical & sporting regulations by discipline and year.
//
// DATA STATUS: the era boundaries, engine formulas, minimum weights, refuelling eras and points
// systems below summarise real historical regulations (Grand Prix racing, top-class endurance
// prototypes, GT and touring cars), written from memory and SIMPLIFIED — sub-classes, equivalence
// formulas and year-by-year tweaks are collapsed. Aero/tyre reference levels, reliability and
// budgets are ESTIMATED GAME DATA. Series names are generic and unofficial.
import type { Discipline, EngineSpec, EngineLayout } from '../types';
import { kf, type KF } from '../util';

export interface TyreCompound { id: 'soft' | 'medium' | 'hard' | 'inter' | 'wet'; name: string; delta: number; lifeKm: number; wetType: 0 | 1 | 2 }
export interface Regs {
  discipline: Discipline; className: string; seriesName: string; note: string;
  minWeight: number; maxDispNA: number; maxDispForced: number; cylinders: number[] | null; layouts: EngineLayout[] | null;
  powerCapKw: number; hybridKw: number; maxBoost: number;
  refuel: boolean; tankKg: number; refuelRate: number; tyreChange: number; twoCompound: boolean; tyres: TyreCompound[];
  clA: number; cdA: number; tyreMu: number; relRef: number; refKm: number; accidentPerKm: number;
  raceKm: number; teams: number; carsPerTeam: number; driversPerCar: number; points: number[]; flPoint: boolean; drs: boolean;
  budget2020: number; devScope: { aero: number; engine: number; chassis: number; reliability: number };
  awd: boolean; rounds: number; typical: Partial<EngineSpec>; spec: boolean;
}

export const DISCIPLINES: { id: Discipline; name: string; from: number; blurb: string }[] = [
  { id: 'f1', name: 'Grand Prix single-seaters', from: 1950, blurb: 'Formula 1-style open-wheel world championship. Maximum technology, maximum budget.' },
  { id: 'hypercar', name: 'Endurance prototypes / Hypercar', from: 1953, blurb: 'Top class of world endurance racing: sports prototypes, Group C, LMP1 and today\'s Le Mans Hypercars. 6-hour races and a 24-hour classic.' },
  { id: 'lmdh', name: 'LMDh prototypes', from: 2023, blurb: 'Cost-capped prototypes on a spec chassis and spec hybrid system, racing in the same top class as Hypercars.' },
  { id: 'gt', name: 'GT racing', from: 1962, blurb: 'Production-based grand tourers. Balance of Performance keeps the field close from 2006 on.' },
  { id: 'touring', name: 'Touring cars', from: 1958, blurb: 'Door-to-door sprint races for family saloons. Small budgets, big grids.' },
];
export const DISC_NAME: Record<Discipline, string> = Object.fromEntries(DISCIPLINES.map((d) => [d.id, d.name])) as Record<Discipline, string>;
export const disciplineAvailable = (d: Discipline, year: number) => year >= DISCIPLINES.find((x) => x.id === d)!.from;

const P_MODERN = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
function f1Points(y: number) {
  if (y <= 1959) return [8, 6, 4, 3, 2];
  if (y === 1960) return [8, 6, 4, 3, 2, 1];
  if (y <= 1990) return [9, 6, 4, 3, 2, 1];
  if (y <= 2002) return [10, 6, 4, 3, 2, 1];
  if (y <= 2009) return [10, 8, 6, 5, 4, 3, 2, 1];
  return P_MODERN;
}

const dry = (softLife: number, mediumLife: number, hardLife: number, n: 1 | 2 | 3): TyreCompound[] => {
  const all: TyreCompound[] = [
    { id: 'soft', name: 'Soft', delta: -0.006, lifeKm: softLife, wetType: 0 },
    { id: 'medium', name: 'Medium', delta: 0, lifeKm: mediumLife, wetType: 0 },
    { id: 'hard', name: 'Hard', delta: 0.005, lifeKm: hardLife, wetType: 0 },
  ];
  const d = n === 1 ? [all[2]] : n === 2 ? [all[0], all[2]] : all;
  return [...d, { id: 'inter', name: 'Intermediate', delta: 0, lifeKm: mediumLife * 0.9, wetType: 1 }, { id: 'wet', name: 'Wet', delta: 0, lifeKm: mediumLife * 0.9, wetType: 2 }];
};

export function getRegs(discipline: Discipline, year: number): Regs {
  const y = year;
  if (discipline === 'f1') {
    let e: Pick<Regs, 'className' | 'note' | 'maxDispNA' | 'maxDispForced' | 'cylinders' | 'layouts' | 'hybridKw' | 'maxBoost' | 'typical'>;
    if (y <= 1953) e = { className: '4.5-litre formula', note: '1950–53: 4.5 L unsupercharged or 1.5 L supercharged engines. No minimum weight; front-engined cars on narrow treaded tyres.', maxDispNA: 4500, maxDispForced: 1500, cylinders: null, layouts: null, hybridKw: 0, maxBoost: 1.6, typical: { layout: 'V12', displacement: 4494, aspiration: 'na', valvetrain: 'dohc2' } };
    else if (y <= 1960) e = { className: '2.5-litre formula', note: '1954–60: 2.5 L unsupercharged engines (0.75 L supercharged). The rear-engine revolution arrives at the end of the decade.', maxDispNA: 2500, maxDispForced: 750, cylinders: null, layouts: null, hybridKw: 0, maxBoost: 1.5, typical: { layout: 'I4', displacement: 2495, aspiration: 'na', valvetrain: 'dohc2' } };
    else if (y <= 1965) e = { className: '1.5-litre formula', note: '1961–65: 1.5 L unsupercharged engines, 450 kg minimum weight. Monocoque chassis appear.', maxDispNA: 1500, maxDispForced: 0, cylinders: null, layouts: null, hybridKw: 0, maxBoost: 0, typical: { layout: 'V8', displacement: 1496, aspiration: 'na', valvetrain: 'dohc2' } };
    else if (y <= 1986) e = { className: '3-litre formula', note: '1966–86: 3.0 L naturally aspirated or 1.5 L forced-induction engines. Wings from 1968, slicks from 1971, ground effect 1977–82, turbo power dominant from 1983.', maxDispNA: 3000, maxDispForced: 1500, cylinders: null, layouts: null, hybridKw: 0, maxBoost: y < 1977 ? 0.01 : 3.2, typical: y >= 1982 ? { layout: 'V6', displacement: 1496, aspiration: 'twinturbo', boost: 2.4, valvetrain: 'dohc4' } : { layout: 'V8', displacement: 2993, aspiration: 'na', valvetrain: 'dohc4' } };
    else if (y <= 1988) e = { className: '3.5 L / turbo formula', note: '1987–88: 3.5 L naturally aspirated engines are admitted alongside 1.5 L turbos, whose boost is capped at 4.0 bar (1987) and 2.5 bar (1988) before they are banned.', maxDispNA: 3500, maxDispForced: 1500, cylinders: null, layouts: null, hybridKw: 0, maxBoost: y === 1987 ? 3.0 : 1.5, typical: { layout: 'V6', displacement: 1496, aspiration: 'twinturbo', boost: y === 1987 ? 2.6 : 1.5, valvetrain: 'dohc4' } };
    else if (y <= 1994) e = { className: '3.5-litre formula', note: '1989–94: 3.5 L naturally aspirated engines only (V8, V10 and V12). Refuelling returns in 1994.', maxDispNA: 3500, maxDispForced: 0, cylinders: null, layouts: null, hybridKw: 0, maxBoost: 0, typical: { layout: 'V10', displacement: 3493, aspiration: 'na', valvetrain: 'dohc4' } };
    else if (y <= 2005) e = { className: '3.0-litre formula', note: '1995–2005: 3.0 L naturally aspirated engines, V10 mandatory from 2000. Grooved tyres 1998–2008, refuelling throughout.', maxDispNA: 3000, maxDispForced: 0, cylinders: y >= 2000 ? [10] : null, layouts: null, hybridKw: 0, maxBoost: 0, typical: { layout: 'V10', displacement: 2998, aspiration: 'na', valvetrain: 'dohc4' } };
    else if (y <= 2013) e = { className: '2.4-litre V8 formula', note: '2006–13: 2.4 L V8 engines, rev-limited from 2007 and frozen in specification. Refuelling banned from 2010, DRS and high-degradation tyres from 2011.', maxDispNA: 2400, maxDispForced: 0, cylinders: [8], layouts: ['V8'], hybridKw: y >= 2011 ? 60 : 0, maxBoost: 0, typical: { layout: 'V8', displacement: 2398, aspiration: 'na', valvetrain: 'dohc4' } };
    else if (y <= 2025) e = { className: '1.6-litre V6 turbo-hybrid formula', note: '2014–2025: 1.6 L V6 turbo engines with energy recovery (120 kW electric), fuel-flow limited. Cost cap from 2021, ground-effect cars from 2022.', maxDispNA: 0, maxDispForced: 1600, cylinders: [6], layouts: ['V6'], hybridKw: 120, maxBoost: 3.5, typical: { layout: 'V6', displacement: 1598, aspiration: 'turbo', boost: 2.6, valvetrain: 'dohc4', fuelSystem: 'di' } };
    else e = { className: '2026 power-unit formula', note: '2026 on: 1.6 L V6 turbo engines without the MGU-H, electric power raised to 350 kW (close to half of the total) and fully sustainable fuel; smaller, lighter cars with active aerodynamics, and a manual override energy boost for the following car in place of DRS. In-game power cap and aero levels for 2026 are estimates.', maxDispNA: 0, maxDispForced: 1600, cylinders: [6], layouts: ['V6'], hybridKw: 350, maxBoost: 3.5, typical: { layout: 'V6', displacement: 1598, aspiration: 'turbo', boost: 2.4, valvetrain: 'dohc4', fuelSystem: 'di' } };
    const refuel = y <= 1983 || (y >= 1994 && y <= 2009);
    const lifeScale = y >= 2011 ? 1 : y >= 1990 ? 1.5 : 2.2;
    return {
      discipline, seriesName: 'Grand Prix World Championship', ...e,
      minWeight: kf([[1950, 640], [1960, 560], [1961, 450], [1966, 500], [1969, 530], [1972, 550], [1973, 575], [1981, 585], [1983, 540], [1987, 500], [1995, 595], [2009, 605], [2010, 620], [2011, 640], [2014, 691], [2017, 728], [2019, 743], [2021, 752], [2022, 798], [2024, 798], [2025, 800], [2026, 768]], y),
      powerCapKw: y >= 2014 ? kf([[2014, 640], [2019, 735], [2025, 750]], y) : 0, refuel, tankKg: refuel ? 75 : 160, refuelRate: 9, tyreChange: kf([[1950, 55], [1965, 30], [1980, 12], [1993, 6.5], [2010, 3.6], [2014, 2.6]], y),
      twoCompound: y >= 2007, tyres: dry(100 * lifeScale, 160 * lifeScale, 240 * lifeScale, y >= 2011 ? 3 : y >= 1985 ? 2 : 1),
      clA: kf([[1950, 0.0], [1967, 0.05], [1968, 0.6], [1970, 1.0], [1976, 1.6], [1978, 2.8], [1982, 3.6], [1983, 2.4], [1990, 3.3], [1994, 3.6], [1995, 3.0], [2004, 4.3], [2008, 4.8], [2009, 4.0], [2013, 4.7], [2014, 4.3], [2017, 5.4], [2021, 5.6], [2022, 5.2], [2025, 5.6], [2026, 4.4]], y), // 2026 value is an estimate
      cdA: kf([[1950, 0.75], [1967, 0.65], [1970, 0.85], [1980, 1.05], [1990, 1.15], [2004, 1.25], [2017, 1.4], [2022, 1.35], [2025, 1.35], [2026, 1.1]], y), // 2026 value is an estimate
      tyreMu: kf([[1950, 1.05], [1960, 1.2], [1970, 1.45], [1975, 1.65], [1990, 1.85], [1997, 1.9], [1998, 1.75], [2008, 1.8], [2009, 1.9], [2020, 1.95]], y),
      relRef: kf([[1950, 0.55], [1970, 0.6], [1985, 0.6], [1995, 0.72], [2005, 0.88], [2020, 0.95]], y), refKm: 305,
      accidentPerKm: kf([[1950, 5e-4], [1980, 4e-4], [2000, 3e-4], [2020, 2.2e-4]], y),
      // fastest-lap point: 1950–59, and again 2019–24 for a top-10 finisher (abolished for 2025)
      // 11 teams from 2026; drs stands for the era's overtaking aid (DRS 2011–25, manual override from 2026)
      raceKm: 305, teams: y >= 2026 ? 11 : 10, carsPerTeam: 2, driversPerCar: 1, points: f1Points(y), flPoint: y <= 1959 || (y >= 2019 && y <= 2024), drs: y >= 2011,
      budget2020: kf([[1950, 3e6], [1970, 8e6], [1980, 30e6], [1990, 90e6], [2005, 400e6], [2019, 420e6], [2021, 190e6]], y),
      devScope: { aero: y < 1968 ? 0.4 : 1, engine: y >= 2007 && y <= 2013 ? 0.3 : 1, chassis: 1, reliability: 1 },
      awd: false, rounds: Math.round(kf([[1950, 7], [1960, 10], [1973, 15], [1990, 16], [2005, 19], [2016, 21], [2024, 24]], y)), spec: false,
    };
  }
  if (discipline === 'hypercar' || discipline === 'lmdh') {
    const lmdh = discipline === 'lmdh';
    let e: Pick<Regs, 'className' | 'note' | 'maxDispNA' | 'maxDispForced' | 'minWeight' | 'powerCapKw' | 'hybridKw' | 'typical' | 'maxBoost'>;
    if (lmdh) e = { className: 'LMDh', note: '2023 on: LMDh prototypes use one of four licensed spec chassis, a spec 50 kW rear hybrid system and the manufacturer\'s own engine and bodywork. 1,030 kg, 500 kW combined, performance balanced against Le Mans Hypercars.', maxDispNA: 8000, maxDispForced: 8000, minWeight: 1030, powerCapKw: 500, hybridKw: 50, maxBoost: 2, typical: { layout: 'V8', displacement: 4000, aspiration: 'twinturbo', boost: 1.0, valvetrain: 'dohc4' } };
    else if (y <= 1961) e = { className: 'Sports cars', note: '1953–61: World Sportscar Championship for open sports-racing cars; 3.0 L limit from 1958.', maxDispNA: y >= 1958 ? 3000 : 5000, maxDispForced: 0, minWeight: 800, powerCapKw: 0, hybridKw: 0, maxBoost: 0, typical: { layout: 'V12', displacement: 2953, aspiration: 'na', valvetrain: 'sohc' } };
    else if (y <= 1967) e = { className: 'Prototypes', note: '1962–67: prototypes with no capacity limit; 7-litre V8s battle 4-litre V12s.', maxDispNA: 7000, maxDispForced: 0, minWeight: 850, powerCapKw: 0, hybridKw: 0, maxBoost: 0, typical: { layout: 'V8', displacement: 4736, aspiration: 'na', valvetrain: 'ohv' } };
    else if (y <= 1971) e = { className: 'Group 5 sports cars', note: '1968–71: 3.0 L prototypes race 5.0 L homologated sports cars; flat-12 and V12 5-litre monsters exceed 380 km/h.', maxDispNA: 5000, maxDispForced: 0, minWeight: 800, powerCapKw: 0, hybridKw: 0, maxBoost: 0, typical: { layout: 'F12', displacement: 4907, aspiration: 'na', valvetrain: 'dohc2' } };
    else if (y <= 1981) e = { className: 'Group 6 prototypes', note: '1972–81: 3.0 L prototypes; turbocharged engines admitted with a 1.4 equivalence factor (2.1 L).', maxDispNA: 3000, maxDispForced: 2140, minWeight: 700, powerCapKw: 0, hybridKw: 0, maxBoost: 1.4, typical: { layout: 'F6', displacement: 2140, aspiration: 'twinturbo', boost: 1.3, valvetrain: 'dohc2' } };
    else if (y <= 1992) e = { className: 'Group C', note: '1982–92: Group C — free engine choice within a fuel-consumption limit, 800–850 kg minimum, ground-effect bodies. 3.5 L atmospheric engines from 1991.', maxDispNA: 7000, maxDispForced: 3500, minWeight: y >= 1985 ? 850 : 800, powerCapKw: 560, hybridKw: 0, maxBoost: 1.8, typical: { layout: 'F6', displacement: 2994, aspiration: 'twinturbo', boost: 1.3, valvetrain: 'dohc4' } };
    else if (y <= 1998) e = { className: 'GT1 / WSC', note: '1993–98: no world championship; open-top WSC prototypes and extreme GT1 homologation specials contest the great endurance races.', maxDispNA: 6000, maxDispForced: 3600, minWeight: 900, powerCapKw: 460, hybridKw: 0, maxBoost: 1.6, typical: { layout: 'V12', displacement: 5990, aspiration: 'na', valvetrain: 'dohc4' } };
    else if (y <= 2011) e = { className: 'LMP900 / LMP1', note: '1999–2011: Le Mans Prototypes — 900 kg, 6.0 L atmospheric or 4.0 L turbo engines breathing through air restrictors; diesels win from 2006.', maxDispNA: 6000, maxDispForced: 4000, minWeight: 900, powerCapKw: 480, hybridKw: 0, maxBoost: 1.6, typical: { layout: 'V8', displacement: 3596, aspiration: 'twinturbo', boost: 1.3, valvetrain: 'dohc4' } };
    else if (y <= 2020) e = { className: 'LMP1 Hybrid', note: '2012–20: LMP1 hybrids in the new World Endurance Championship: fuel-energy-limited engines with up to 8 MJ of recovered energy per lap of the 24-hour circuit; around 735 kW combined, four-wheel drive under deployment.', maxDispNA: 5500, maxDispForced: 5500, minWeight: 875, powerCapKw: 520, hybridKw: 280, maxBoost: 2.2, typical: { layout: 'V6', displacement: 2400, aspiration: 'twinturbo', boost: 1.8, valvetrain: 'dohc4', fuelSystem: 'di' } };
    else e = { className: 'Le Mans Hypercar', note: '2021 on: Le Mans Hypercar — bespoke chassis, free engine architecture, optional front-axle hybrid; 1,030 kg and 500 kW combined, with aero efficiency fixed inside a regulated window and Balance of Performance.', maxDispNA: 8000, maxDispForced: 8000, minWeight: 1030, powerCapKw: 500, hybridKw: 200, maxBoost: 2.2, typical: { layout: 'V6', displacement: 3500, aspiration: 'twinturbo', boost: 1.4, valvetrain: 'dohc4', fuelSystem: 'di' } };
    const bop = y >= 2021 || lmdh;
    return {
      discipline, seriesName: 'World Endurance Championship', ...e, cylinders: null, layouts: null,
      refuel: true, tankKg: kf([[1953, 110], [1982, 72], [2000, 66], [2014, 50], [2021, 65]], y), refuelRate: 2.2, tyreChange: kf([[1953, 90], [1980, 35], [2000, 22], [2020, 16]], y), twoCompound: false,
      tyres: dry(260, 420, 600, y >= 1985 ? 3 : 1),
      clA: bop ? 3.6 : kf([[1953, 0.0], [1967, 0.3], [1970, 0.8], [1978, 1.6], [1982, 3.6], [1988, 4.6], [1993, 3.0], [2005, 4.0], [2015, 5.0], [2020, 4.8]], y),
      cdA: bop ? 0.92 : kf([[1953, 0.7], [1970, 0.65], [1982, 0.85], [1988, 0.95], [1995, 0.85], [2015, 0.85]], y),
      tyreMu: kf([[1953, 1.05], [1970, 1.4], [1985, 1.7], [2000, 1.75], [2015, 1.8]], y),
      relRef: kf([[1953, 0.6], [1975, 0.65], [1990, 0.75], [2005, 0.85], [2020, 0.92]], y), refKm: 1200, accidentPerKm: kf([[1953, 1.4e-4], [1990, 9e-5], [2020, 6e-5]], y),
      raceKm: 0, teams: 6, carsPerTeam: 2, driversPerCar: 3, points: y >= 2012 ? P_MODERN : y >= 1991 ? [10, 6, 4, 3, 2, 1] : [9, 6, 4, 3, 2, 1], flPoint: false, drs: false,
      budget2020: lmdh ? 35e6 : kf([[1953, 4e6], [1968, 12e6], [1975, 8e6], [1988, 45e6], [1995, 20e6], [2005, 60e6], [2015, 200e6], [2021, 85e6]], y),
      devScope: lmdh ? { aero: 0.3, engine: 0.2, chassis: 0.1, reliability: 1 } : bop ? { aero: 0.4, engine: 0.2, chassis: 0.6, reliability: 1 } : { aero: 1, engine: 1, chassis: 1, reliability: 1 },
      awd: (!lmdh && y >= 2012), rounds: y >= 2012 ? 8 : 7, spec: lmdh,
    };
  }
  if (discipline === 'gt') {
    const bop = y >= 2006;
    return {
      discipline, seriesName: 'International GT Championship',
      className: y < 1982 ? 'Grand Touring (Group 3/4)' : y < 1994 ? 'Group B GT' : y < 2006 ? 'GT1 / GT2' : 'GT3',
      note: y < 1994 ? 'Homologated grand touring cars with limited modifications; capacity classes simplified to a single field.'
        : y < 2006 ? '1994–2005: GT1 and GT2 cars based on road-going supercars, with air restrictors and minimum weights by engine size.'
          : '2006 on: GT3 — customer race cars from many manufacturers equalised by Balance of Performance (weight, restrictors, boost). About 400 kW and 1,300 kg.',
      minWeight: kf([[1962, 950], [1982, 1050], [1994, 1100], [2006, 1300]], y), maxDispNA: bop ? 7000 : y < 1994 ? 5000 : 8000, maxDispForced: bop ? 6000 : y < 1975 ? 0 : 3600,
      cylinders: null, layouts: null, powerCapKw: bop ? 410 : y >= 1994 ? 450 : 0, hybridKw: 0, maxBoost: 1.6,
      refuel: true, tankKg: 85, refuelRate: 2.0, tyreChange: kf([[1962, 60], [1990, 25], [2010, 14]], y), twoCompound: false, tyres: dry(200, 300, 420, y >= 1990 ? 2 : 1),
      clA: kf([[1962, 0.0], [1972, 0.5], [1985, 0.9], [1996, 2.2], [2006, 1.7], [2020, 2.2]], y), cdA: kf([[1962, 0.72], [1996, 0.95], [2020, 0.98]], y),
      tyreMu: kf([[1962, 1.1], [1975, 1.4], [1995, 1.6], [2015, 1.65]], y), relRef: kf([[1962, 0.65], [1990, 0.78], [2010, 0.9]], y), refKm: 400, accidentPerKm: 1.8e-4,
      raceKm: 0, teams: 10, carsPerTeam: 2, driversPerCar: 2, points: y >= 2010 ? P_MODERN : [9, 6, 4, 3, 2, 1], flPoint: false, drs: false,
      budget2020: kf([[1962, 1.5e6], [1985, 4e6], [1997, 30e6], [2006, 5e6], [2020, 7e6]], y),
      devScope: bop ? { aero: 0.25, engine: 0.15, chassis: 0.5, reliability: 1 } : { aero: 0.8, engine: 0.8, chassis: 0.8, reliability: 1 },
      awd: false, rounds: 9, typical: y >= 2006 ? { layout: 'V8', displacement: 5200, aspiration: 'na', valvetrain: 'dohc4' } : y >= 1975 ? { layout: 'F6', displacement: 3200, aspiration: 'twinturbo', boost: 1.0, valvetrain: 'dohc2' } : { layout: 'V12', displacement: 2953, aspiration: 'na', valvetrain: 'sohc' }, spec: false,
    };
  }
  // touring
  let t: Pick<Regs, 'className' | 'note' | 'maxDispNA' | 'maxDispForced' | 'minWeight' | 'powerCapKw' | 'typical'>;
  if (y < 1982) t = { className: 'Group 2 touring cars', note: '1958–81: modified production saloons in capacity classes (simplified here to one field of up to 3.0 L).', maxDispNA: 3000, maxDispForced: 0, minWeight: 950, powerCapKw: 0, typical: { layout: 'I4', displacement: 1990, aspiration: 'na', valvetrain: 'sohc' } };
  else if (y < 1990) t = { className: 'Group A', note: '1982–89: Group A — 5,000-off homologation saloons; turbocharged 2-litre cars become the class of the field.', maxDispNA: 5000, maxDispForced: 2000, minWeight: 1100, powerCapKw: 370, typical: { layout: 'I4', displacement: 1993, aspiration: 'turbo', boost: 1.3, valvetrain: 'dohc4' } };
  else if (y < 2001) t = { className: 'Super Touring', note: '1990–2000: Super Touring — 2.0 L naturally aspirated engines limited to 8,500 rpm, 975 kg, sophisticated chassis and soaring budgets.', maxDispNA: 2000, maxDispForced: 0, minWeight: 975, powerCapKw: 235, typical: { layout: 'I4', displacement: 1998, aspiration: 'na', valvetrain: 'dohc4' } };
  else if (y < 2015) t = { className: 'Super 2000', note: '2001–14: Super 2000 — 2.0 L naturally aspirated (later 1.6 L turbo) production-based saloons, 1,150 kg, tightly cost-controlled.', maxDispNA: 2000, maxDispForced: 1600, minWeight: 1150, powerCapKw: 215, typical: { layout: 'I4', displacement: 1998, aspiration: 'na', valvetrain: 'dohc4' } };
  else t = { className: 'TCR', note: '2015 on: TCR — front-drive 2.0 L turbo touring cars built by manufacturers and sold to customer teams, about 250 kW and 1,265 kg, Balance of Performance.', maxDispNA: 2000, maxDispForced: 2000, minWeight: 1265, powerCapKw: 255, typical: { layout: 'I4', displacement: 1998, aspiration: 'turbo', boost: 1.1, valvetrain: 'dohc4', fuelSystem: 'di' } };
  return {
    discipline, seriesName: 'World Touring Car Cup', ...t, cylinders: null, layouts: null, hybridKw: 0, maxBoost: 1.6,
    refuel: false, tankKg: 60, refuelRate: 2, tyreChange: 25, twoCompound: false, tyres: dry(120, 170, 240, 1),
    clA: kf([[1958, 0.0], [1975, 0.15], [1990, 0.5], [1996, 0.9], [2001, 0.6], [2015, 0.75]], y), cdA: kf([[1958, 0.75], [2020, 0.78]], y),
    tyreMu: kf([[1958, 1.0], [1975, 1.3], [1995, 1.5], [2015, 1.5]], y), relRef: kf([[1958, 0.7], [1990, 0.82], [2010, 0.92]], y), refKm: 70, accidentPerKm: 7e-4,
    raceKm: 62, teams: 10, carsPerTeam: 2, driversPerCar: 1, points: y >= 2010 ? P_MODERN : [9, 6, 4, 3, 2, 1], flPoint: false, drs: false,
    budget2020: kf([[1958, 0.6e6], [1985, 4e6], [1996, 14e6], [2002, 5e6], [2015, 1.8e6]], y),
    devScope: y >= 2001 ? { aero: 0.25, engine: 0.2, chassis: 0.6, reliability: 1 } : { aero: 0.7, engine: 0.8, chassis: 1, reliability: 1 },
    awd: false, rounds: 10, spec: false,
  };
}

export const MS_KEYFRAMES: KF = [[1950, 1], [2030, 1]];
