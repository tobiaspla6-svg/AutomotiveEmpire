// Renders the 2D illustration components to a static HTML page for visual review (no game state needed).
// Run: npx tsx scripts/art-gallery.tsx out.html [section]
import * as fs from 'node:fs';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Car2D } from '../src/ui/art2d/Car2D';
import { HeroShowroom2D } from '../src/ui/art2d/HeroShowroom2D';
import type { BodyType } from '../src/sim/types';
import { Engine2D } from '../src/ui/art2d/Engine2D';
import { Chassis2D, Gearbox2D, Suspension2D, Brake2D, Tyre2D } from '../src/ui/art2d/Parts2D';
import { Chest2D, PartCard, RARITY_ORDER } from '../src/ui/art2d/Rewards2D';
import { Campus2D } from '../src/ui/art2d/Campus2D';
import { FactoryLine2D, SECTORS } from '../src/ui/art2d/FactoryLine2D';
import { BLUEPRINTS } from '../src/sim/progression';

const out = process.argv[2] ?? 'gallery.html', section = process.argv[3] ?? 'cars';
const cells: string[] = [];
const cell = (title: string, node: ReturnType<typeof h>) => cells.push(`<figure><div class="art">${renderToStaticMarkup(node, { identifierPrefix: 'c' + cells.length + '_' })}</div><figcaption>${title}</figcaption></figure>`);
if (section === 'showroom') {
  const modes = [
    { body: 'sedan' as const, color: '#315b8e', label: 'Founder / dark sapphire sedan' },
    { body: 'coupe' as const, color: '#a33135', label: 'CEO / metallic red grand-tourer' },
    { body: 'suv' as const, color: '#b69b71', label: 'SUV / satin champagne' },
    { body: 'supercar' as const, color: '#e2a92b', label: 'Supercar' },
    { body: 'hatch' as const, color: '#3d8a5a', label: 'Hatchback' },
    { body: 'wagon' as const, color: '#9aa4b1', label: 'Wagon' },
    { body: 'roadster' as const, color: '#c8352e', label: 'Roadster' },
    { body: 'pickup' as const, color: '#22262e', label: 'Pickup' },
  ];
  modes.forEach((car) => cell(car.label, h(HeroShowroom2D, { body:car.body, color:car.color, label:car.label })));
}
if (section === 'illustrated') {
  const bodies: BodyType[] = ['hatch', 'sedan', 'wagon', 'coupe', 'roadster', 'supercar', 'suv', 'pickup'];
  const colors = ['#c8352e', '#2f6db3', '#e2a92b', '#3d8a5a', '#e9e7df', '#22262e', '#7b3fb0', '#d86a2a'];
  for (const y of [1955, 1972, 1990]) bodies.forEach((b, i) => { cell(`${b} ${y} plano`, h(Car2D, { body: b, year: y, color: colors[i] })); cell(`${b} ${y} ilustrado`, h(Car2D, { body: b, year: y, color: colors[i], illustrated: true })); });
}
if (section === 'cars') {
  const bodies: BodyType[] = ['hatch', 'sedan', 'wagon', 'coupe', 'roadster', 'supercar', 'suv', 'pickup'];
  const colors = ['#c8352e', '#2f6db3', '#e2a92b', '#3d8a5a', '#e9e7df', '#22262e', '#7b3fb0', '#d86a2a'];
  for (const year of [1955, 1968, 1985, 1998, 2022]) bodies.forEach((b, i) => cell(`${b} ${year}`, h(Car2D, { body: b, year, color: colors[(i + year) % colors.length] })));
}
if (section === 'kits') {
  const kits = [{}, { wheels: 'five-spoke' }, { wheels: 'forged', body: 'aero-gt' }, { body: 'endurance', engine: 'race-v8' }, { body: 'hyperbody', engine: 'hybrid', chassis: 'carbon-frame' }, { body: 'fastback', engine: 'twinturbo', chassis: 'spaceframe' }, { engine: 'prototype', chassis: 'independent', wheels: 'steel-rims' }];
  kits.forEach((k, i) => cell(JSON.stringify(k), h(Car2D, { body: i % 2 ? 'coupe' : 'supercar', year: 2012, color: ['#c8352e', '#2f6db3', '#e2a92b', '#22262e'][i % 4], equipped: k as never, moving: i === 3 })));
}
if (section === 'engines') {
  const list = [{ layout: 'I4', displacement: 1600, valvetrain: 'ohv', aluBlock: false }, { layout: 'I4', displacement: 2000, valvetrain: 'dohc4', redline: 8600 }, { layout: 'I6', displacement: 2997, valvetrain: 'dohc4', aspiration: 'twinturbo' }, { layout: 'I3', displacement: 1000, aspiration: 'turbo' }, { layout: 'V6', displacement: 3500, aspiration: 'turbo', hybridKw: 100 }, { layout: 'V8', displacement: 5700, valvetrain: 'ohv' }, { layout: 'V8', displacement: 4951, valvetrain: 'dohc4', aspiration: 'supercharged' }, { layout: 'V10', displacement: 4999, redline: 8250 }, { layout: 'V12', displacement: 6064, redline: 7500 }, { layout: 'F6', displacement: 1991 }, { layout: 'F4', displacement: 2500, aspiration: 'turbo' }, { layout: 'EV', motorKw: 310, batteryKwh: 85 }];
  list.forEach((e) => cell(JSON.stringify(e), h(Engine2D, { engine: e as never })));
}
if (section === 'parts') {
  (['ladder', 'steel', 'spaceframe', 'aluminium', 'carbon'] as const).forEach((t) => cell(t, h(Chassis2D, { type: t })));
  (['manual', 'auto', 'dct'] as const).forEach((t) => cell(t, h(Gearbox2D, { type: t, gears: 6 })));
  (['solid', 'macpherson', 'wishbone', 'multilink'] as const).forEach((t) => cell(t, h(Suspension2D, { type: t })));
  (['drum', 'disc', 'vented', 'ceramic'] as const).forEach((t) => cell(t, h(Brake2D, { type: t })));
  (['economy', 'touring', 'sport', 'semislick'] as const).forEach((t) => cell(t, h(Tyre2D, { compound: t })));
}
if (section === 'rewards') {
  RARITY_ORDER.forEach((r) => cell(r, h(Chest2D, { rarity: r, state: r === 'legendary' || r === 'relic' ? 'open' : 'ready' })));
  BLUEPRINTS.forEach((b, i) => cell(b.id, h(PartCard, { part: b, owned: i % 3 ? 1 : 0, lang: 'es' })));
}
if (section === 'factory') {
  const labels = Object.fromEntries(SECTORS.map((x) => [x, x])) as never;
  for (const [auto, bn] of [[0.2, 'paint'], [0.85, 'assembly']] as const) {
    const load = Object.fromEntries(SECTORS.map((x, i) => [x, { use: x === bn ? 1.05 : 0.45 + i * 0.07, bottleneck: x === bn, working: true }])) as never;
    cell(`automation ${auto}, bottleneck ${bn}`, h(FactoryLine2D, { load, automation: auto, color: '#c8352e', active: 'body', onPick: () => {}, labels }));
  }
}
if (section === 'campus') {
  const base = { name: 'Aurelia Motors', color: '#c8352e', billboard: true, stock: 2000 } as const;
  cell('small founder', h(Campus2D, { s: { ...base, officeTier: 1, studioTier: 1, labTier: 1, plants: [{ id: 'a', name: 'A', capacity: 60, building: false, automation: 0.3 }], showroomTier: 0, track: false, racing: false, trophies: 0 } }));
  cell('growing', h(Campus2D, { s: { ...base, officeTier: 2, studioTier: 2, labTier: 2, plants: [{ id: 'a', name: 'A', capacity: 600, building: false, automation: 0.6 }, { id: 'b', name: 'B', capacity: 1500, building: true, automation: 0.6 }], showroomTier: 1, track: true, racing: false, trophies: 2 } }));
  cell('empire', h(Campus2D, { s: { ...base, officeTier: 4, studioTier: 3, labTier: 3, plants: [1, 2, 3, 4].map((i) => ({ id: String(i), name: String(i), capacity: 5000, building: false, automation: 0.9 })), showroomTier: 3, track: true, racing: true, trophies: 9 }, extraPlants: 3 }));
}
fs.writeFileSync(out, `<!doctype html><meta charset="utf-8"><style>body{background:#0e141d;color:#cfd8e3;font:12px system-ui;margin:16px}main{display:grid;grid-template-columns:repeat(${section === 'showroom' ? 2 : section === 'campus' || section === 'factory' ? 1 : section === 'rewards' ? 6 : 4},1fr);gap:10px}figure{margin:0;overflow:hidden;background:linear-gradient(#1b2737,#121a26);border-radius:10px;padding:6px}figure:has(.ae-hero-showroom){max-width:1280px;margin:auto;width:100%}.art svg{width:100%;display:block}figcaption{text-align:center;opacity:.7}</style><main>${cells.join('')}</main>`);
