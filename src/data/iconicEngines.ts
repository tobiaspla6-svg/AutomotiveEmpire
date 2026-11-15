// Historical engine encyclopedia for the 2D workshop.
//
// Two kinds of information live here and are kept apart on purpose:
//  • `fact`: published, historical figures (introduction year, layout, displacement, rated output, first car) checked
//    against the sources listed with each entry (retrieved 2026-11-15). Where sources disagree the commonly cited
//    manufacturer rating is given and the disagreement noted.
//  • `preset`: the approximate engineering parameters the game's engine model uses when the player takes the engine
//    as inspiration. They are game values, not official specifications or CAD data, and the simulation still decides
//    whether the player's technology can build them and what power they make.
// Manufacturer and engine names are used only to identify the historical engines (no logos, photographs or trade
// dress are used).
import type { EngineSpec } from '../sim/types';

export interface IconicEngine {
  id: string; decade: number; year: number; maker: string; name: string; car: string;
  fact: { layout: string; displacementCc: number; induction: string; rated: string; note?: string };
  /** level of the player's company needed to use the preset (see src/sim/achievements.ts) */
  level: number;
  preset: Partial<EngineSpec> & Pick<EngineSpec, 'layout'>;
  sources: string[];
}

export const ICONIC_ENGINES: readonly IconicEngine[] = [
  { id: 'jaguar-xk', decade: 1940, year: 1948, maker: 'Jaguar', name: 'XK straight-six', car: 'XK120 (1948)',
    fact: { layout: 'I6, DOHC', displacementCc: 3442, induction: 'Twin SU carburettors', rated: '160 bhp at 5,000 rpm', note: 'UK cars were offered with a lower 7:1 compression version.' },
    level: 1, preset: { layout: 'I6', displacement: 3442, valvetrain: 'dohc2', aspiration: 'na', compression: 8, redline: 5500, fuelSystem: 'carb', aluBlock: false },
    sources: ['https://www.jaguarheritage.com/jaguar-history/jaguar-engineering/6-cylinder-xk-engine', 'https://www.ultimatecarpage.com/spec/220/Jaguar-XK120-Roadster.html'] },
  { id: 'chevy-sbc-265', decade: 1950, year: 1955, maker: 'Chevrolet', name: 'Small-Block V8 265', car: '1955 Bel Air / Corvette',
    fact: { layout: 'V8, OHV', displacementCc: 4343, induction: 'Carburettor', rated: '162 hp base; up to 195 hp with the four-barrel option', note: 'Several versions in 1955; figures vary by version.' },
    level: 1, preset: { layout: 'V8', displacement: 4343, valvetrain: 'ohv', aspiration: 'na', compression: 8, redline: 5000, fuelSystem: 'carb', aluBlock: false },
    sources: ['https://en.wikipedia.org/wiki/Chevrolet_small-block_engine_(first-_and_second-generation)', 'https://www.hagerty.com/media/?p=7774'] },
  { id: 'lambo-v12', decade: 1960, year: 1964, maker: 'Lamborghini', name: 'Bizzarrini V12', car: '350 GT (1964)',
    fact: { layout: 'V12 60°, DOHC', displacementCc: 3464, induction: 'Six Weber carburettors', rated: '280 hp (production 350 GT)', note: 'The prototype race engine made far more; some sources list 270 hp.' },
    level: 3, preset: { layout: 'V12', displacement: 3464, valvetrain: 'dohc2', aspiration: 'na', compression: 9.5, redline: 7000, fuelSystem: 'carb', aluBlock: true },
    sources: ['https://en.wikipedia.org/wiki/Lamborghini_350_GT', 'https://www.conceptcarz.com/w20534/lamborghini-350gt.aspx'] },
  { id: 'porsche-901', decade: 1960, year: 1964, maker: 'Porsche', name: 'Type 901 flat-six', car: '911 (1964)',
    fact: { layout: 'F6, air-cooled, SOHC per bank', displacementCc: 1991, induction: 'Two triple-choke carburettors', rated: '130 PS at 6,100 rpm' },
    level: 2, preset: { layout: 'F6', displacement: 1991, valvetrain: 'sohc', aspiration: 'na', compression: 9, redline: 6800, fuelSystem: 'carb', aluBlock: true },
    sources: ['https://en.wikipedia.org/wiki/Porsche_911_(classic)', 'https://stuttcars.com/porsche-911-1964-1968/'] },
  { id: 'hemi-426', decade: 1960, year: 1966, maker: 'Chrysler', name: '426 Street Hemi', car: '1966 Plymouth Satellite / Dodge Coronet',
    fact: { layout: 'V8, OHV, hemispherical heads', displacementCc: 6981, induction: 'Two four-barrel carburettors', rated: '425 hp at 5,000 rpm', note: 'Widely regarded as conservatively rated.' },
    level: 3, preset: { layout: 'V8', displacement: 6981, valvetrain: 'ohv', aspiration: 'na', compression: 10.25, redline: 6000, fuelSystem: 'carb', aluBlock: false },
    sources: ['https://media.stellantisnorthamerica.com/pdf.do?id=739', 'https://www.slashgear.com/1579634/chrysler-426-hemi-horsepower-what-years-made'] },
  { id: 'nissan-rb26', decade: 1980, year: 1989, maker: 'Nissan', name: 'RB26DETT', car: 'Skyline GT-R R32 (1989)',
    fact: { layout: 'I6, DOHC 24v', displacementCc: 2568, induction: 'Twin turbochargers', rated: '280 PS (Japanese industry agreement)', note: 'Real output is often reported nearer 330 PS.' },
    level: 4, preset: { layout: 'I6', displacement: 2568, valvetrain: 'dohc4', aspiration: 'twinturbo', boost: 0.8, compression: 8.5, redline: 8000, fuelSystem: 'efi', aluBlock: false },
    sources: ['https://www.nissan-global.com/EN/HERITAGE/skyline_gt-r_1989.html', 'https://en.wikipedia.org/wiki/Nissan_RB_engine'] },
  { id: 'viper-v10', decade: 1990, year: 1992, maker: 'Dodge', name: 'Viper V10', car: 'Viper RT/10 (1992)',
    fact: { layout: 'V10, OHV', displacementCc: 7990, induction: 'Sequential fuel injection', rated: '400 hp at 4,600 rpm' },
    level: 4, preset: { layout: 'V10', displacement: 7990, valvetrain: 'ohv', aspiration: 'na', compression: 9.1, redline: 6000, fuelSystem: 'efi', aluBlock: true },
    sources: ['https://en.wikipedia.org/wiki/Viper_engine', 'https://www.topgear.com/car-news/supercars/best-ever-v10s-massive-80-litre-wild-dodge-viper'] },
  { id: 'bmw-s70', decade: 1990, year: 1992, maker: 'BMW M', name: 'S70/2 V12', car: 'McLaren F1 (1992)',
    fact: { layout: 'V12 60°, DOHC, dry sump', displacementCc: 6064, induction: 'Fuel injection, variable valve timing', rated: '627 PS (461 kW)' },
    level: 6, preset: { layout: 'V12', displacement: 6064, valvetrain: 'dohc4', aspiration: 'na', compression: 11, redline: 7500, fuelSystem: 'efi', vvt: true, aluBlock: true },
    sources: ['https://www.bmwblog.com/2024/01/23/bmw-s70-2-one-of-the-best-engines-ever-created/', 'https://en.wikipedia.org/wiki/McLaren_F1'] },
  { id: 'toyota-2jz', decade: 1990, year: 1993, maker: 'Toyota', name: '2JZ-GTE', car: 'Supra (A80, 1993)',
    fact: { layout: 'I6, DOHC 24v', displacementCc: 2997, induction: 'Sequential twin turbochargers', rated: '280 PS (Japan); 320 hp (US market)', note: 'Ratings differ by market and standard.' },
    level: 4, preset: { layout: 'I6', displacement: 2997, valvetrain: 'dohc4', aspiration: 'twinturbo', boost: 0.8, compression: 8.5, redline: 6800, fuelSystem: 'efi', aluBlock: false },
    sources: ['https://www.hpacademy.com/blog/everything-you-need-to-know-about-the-2jz-gte/', 'https://en.wikipedia.org/wiki/Toyota_JZ_engine'] },
  { id: 'gm-ls1', decade: 1990, year: 1997, maker: 'General Motors', name: 'LS1 V8', car: 'Corvette C5 (1997)',
    fact: { layout: 'V8, OHV, aluminium block', displacementCc: 5665, induction: 'Sequential fuel injection', rated: '345 hp at 5,600 rpm' },
    level: 3, preset: { layout: 'V8', displacement: 5665, valvetrain: 'ohv', aspiration: 'na', compression: 10.1, redline: 6000, fuelSystem: 'efi', aluBlock: true },
    sources: ['https://en.wikipedia.org/wiki/General_Motors_LS-based_small-block_engine', 'https://www.corvetteforum.com/articles/1997-chevrolet-c5-corvette-ls1-engine-pricing-peformance/'] },
  { id: 'prius-thsi', decade: 1990, year: 1997, maker: 'Toyota', name: '1NZ-FXE hybrid', car: 'Prius (1997)',
    fact: { layout: 'I4 petrol + electric motor', displacementCc: 1496, induction: 'Fuel injection; series-parallel hybrid', rated: '58 PS engine; motor about 30–33 kW', note: 'Sources disagree on the first motor rating.' },
    level: 3, preset: { layout: 'I4', displacement: 1496, valvetrain: 'dohc4', aspiration: 'na', compression: 13, redline: 4500, fuelSystem: 'efi', hybridKw: 30, aluBlock: true },
    sources: ['https://www.toyota-global.com/company/history_of_toyota/75years/vehicle_lineage/car/id60012360/index.html', 'https://en.wikipedia.org/wiki/Toyota_Prius_(XW10)'] },
  { id: 'honda-k20', decade: 2000, year: 2001, maker: 'Honda', name: 'K20A i-VTEC', car: 'Civic Type R (EP3, 2001)',
    fact: { layout: 'I4, DOHC, i-VTEC', displacementCc: 1998, induction: 'Fuel injection', rated: '215 PS at 8,000 rpm (Japan); 200 PS (Europe)' },
    level: 2, preset: { layout: 'I4', displacement: 1998, valvetrain: 'dohc4', aspiration: 'na', compression: 11.5, redline: 8400, fuelSystem: 'efi', vvt: true, aluBlock: true },
    sources: ['https://www.honda.co.jp/factbook/auto/civic-r/200110/08.html', 'https://en.wikipedia.org/wiki/Honda_K_engine'] },
  { id: 'bmw-s85', decade: 2000, year: 2005, maker: 'BMW M', name: 'S85 V10', car: 'M5 (E60, 2005)',
    fact: { layout: 'V10 90°, DOHC', displacementCc: 4999, induction: 'Individual throttle bodies', rated: '507 PS at 7,750 rpm', note: 'Often written as 507 hp; 500 hp is the closer conversion.' },
    level: 5, preset: { layout: 'V10', displacement: 4999, valvetrain: 'dohc4', aspiration: 'na', compression: 12, redline: 8250, fuelSystem: 'efi', vvt: true, aluBlock: true },
    sources: ['https://en.wikipedia.org/wiki/BMW_S85', 'https://www.bmwblog.com/2020/08/23/bmw-s85-v10-engine'] },
  { id: 'lexus-1lr', decade: 2010, year: 2010, maker: 'Lexus / Yamaha', name: '1LR-GUE V10', car: 'LFA (2010)',
    fact: { layout: 'V10 72°, DOHC', displacementCc: 4805, induction: 'Individual throttle bodies', rated: '560 PS at 8,700 rpm; redline 9,000 rpm' },
    level: 6, preset: { layout: 'V10', displacement: 4805, valvetrain: 'dohc4', aspiration: 'na', compression: 12, redline: 9000, fuelSystem: 'di', vvt: true, aluBlock: true },
    sources: ['https://en.wikipedia.org/wiki/Toyota_LR_engine', 'https://media.lexus.co.uk/lexus-lfa/'] },
  { id: 'ford-coyote', decade: 2010, year: 2011, maker: 'Ford', name: '5.0 Coyote V8', car: 'Mustang GT (2011)',
    fact: { layout: 'V8, DOHC 32v', displacementCc: 4951, induction: 'Port injection, twin independent variable cam timing', rated: '412 hp' },
    level: 3, preset: { layout: 'V8', displacement: 4951, valvetrain: 'dohc4', aspiration: 'na', compression: 11, redline: 7000, fuelSystem: 'efi', vvt: true, aluBlock: true },
    sources: ['https://www.auto-data.net/en/ford-mustang-v-facelift-2009-gt-5.0-v8-412hp-46039', 'https://www.streetmusclemag.com/?p=17651'] },
  { id: 'tesla-p85', decade: 2010, year: 2012, maker: 'Tesla', name: 'Model S drive unit', car: 'Model S P85 (2012)',
    fact: { layout: 'Electric, rear induction motor', displacementCc: 0, induction: '85 kWh battery (about 81 kWh usable)', rated: '310 kW (416 hp)' },
    level: 5, preset: { layout: 'EV', displacement: 0, motorKw: 310, batteryKwh: 85 },
    sources: ['https://www.arenaev.com/tesla_model_s_p85_2012-specs-201.php', 'https://greencarscompare.com/compare/cars/tesla-model-s-p85-vs-tesla-model-s-85/'] },
];

/** Engines available as inspiration in a given year (the original has been introduced). */
export const iconicFor = (year: number) => ICONIC_ENGINES.filter((e) => e.year <= year);
