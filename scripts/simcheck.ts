import { computeVehicle, defaultVehicle, defaultEngine } from '../src/sim/engineering';
import type { VehicleSpec, Tech } from '../src/sim/types';

const tech = (y: number): Tech => ({ engine: y, chassis: y, aero: y, electronics: y, manufacturing: y });
function show(name: string, s: VehicleSpec, y: number, ref: string) {
  const v = computeVehicle(s, { year: y, tech: tech(y) });
  console.log(`${name.padEnd(26)} ${v.mass.toFixed(0).padStart(5)}kg ${v.powerKw.toFixed(0).padStart(4)}kW@${v.engine.powerRpm.toFixed(0)} ${v.torqueNm.toFixed(0).padStart(4)}Nm  0-100 ${v.zeroTo100.toFixed(1).padStart(5)}s  top ${v.topSpeed.toFixed(0).padStart(3)}  brk ${v.braking100.toFixed(0)}m  ${v.lateralG.toFixed(2)}g  cd ${v.cd.toFixed(2)}  ${v.fuelCombined.toFixed(1)} L/100  parts $${(v.partsCost/1000).toFixed(1)}k dev $${(v.devCost/1e6).toFixed(0)}M/${v.devMonths}mo  rel ${v.scores.reliability.toFixed(0)}`);
  console.log(`   ref: ${ref}   scores: ${Object.entries(v.scores).map(([k, x]) => k.slice(0, 4) + ' ' + x.toFixed(0)).join(' ')}  ${v.warnings.join(' | ')}`);
}
// 1965 Mustang 289: 1300kg, 149kW(200hp gross→~150 net), 0-100 ~8.5, top 190
let s = defaultVehicle(1965, 'coupe'); s.engine = { ...defaultEngine(1965), layout: 'V8', displacement: 4728, valvetrain: 'ohv', compression: 9.3, redline: 5200, cam: 0.35 }; s.gears = 4; s.finalDrive = 3.0; s.tireWidth = 175; s.drive = 'RWD';
show('1965 pony V8 4.7', s, 1965, '~1300kg 150kW 0-100 8.5 top 190');
// 1975 Golf 1.5: 800kg, 51kW, 0-100 13, top 160, 8 L
s = defaultVehicle(1975, 'hatch'); s.size = 0.93; s.engine = { ...defaultEngine(1975), displacement: 1457, valvetrain: 'sohc', compression: 8.2, redline: 6000 }; s.gears = 4; s.drive = 'FWD'; s.tireWidth = 155;
show('1975 hatch 1.5', s, 1975, '~800kg 51kW 0-100 13 top 160 8L');
// 1990 NSX-like: 1370kg 201kW, 0-100 5.9, top 270
s = defaultVehicle(1990, 'supercar'); s.size = 0.98; s.chassis = 'aluminium'; s.panels = 'aluminium'; s.enginePos = 'mid'; s.drive = 'RWD'; s.engine = { ...defaultEngine(1990), layout: 'V6', displacement: 2977, valvetrain: 'dohc4', vvt: true, compression: 10.2, redline: 8000, cam: 0.6, aluBlock: true }; s.gears = 5; s.finalDrive = 4.06; s.tireWidth = 225; s.tireCompound = 'sport'; s.suspFront = s.suspRear = 'wishbone'; s.sport = 0.7; s.wheelDia = 16; s.seats = 2; s.interior = 'premium';
show('1990 alu V6 mid', s, 1990, '~1370kg 201kW 0-100 5.9 top 270');
// 2020 2.0T sedan: 1500kg 180kW 0-100 6.2 top 250 6.5L
s = defaultVehicle(2020, 'sedan'); s.engine = { ...defaultEngine(2020), displacement: 1998, aspiration: 'turbo', boost: 1.1, compression: 10.2, redline: 6500 }; s.gearbox = 'auto'; s.gears = 8; s.drive = 'RWD'; s.finalDrive = 3.2; s.tireWidth = 225; s.interior = 'premium'; s.suspRear = 'multilink';
show('2020 2.0T premium sedan', s, 2020, '~1550kg 190kW 0-100 5.8 top 250 6.5L');
// 2020 budget hatch 1.0 3cyl: 1000kg 50kW 0-100 14 top 160 5L
s = defaultVehicle(2020, 'hatch'); s.size = 0.9; s.engine = { ...defaultEngine(2020), layout: 'I3', displacement: 999, compression: 11.5, redline: 6200 }; s.gears = 5; s.tireWidth = 175; s.wheelDia = 14; s.interior = 'basic';
show('2020 1.0 city hatch', s, 2020, '~950kg 50kW 0-100 14 top 160 5L');
// 2019 V8TT mid supercar: 1450 kg, 530 kW, 0-100 2.9, 340
s = defaultVehicle(2019, 'supercar'); s.chassis = 'carbon'; s.panels = 'carbon'; s.enginePos = 'mid'; s.drive = 'RWD'; s.engine = { ...defaultEngine(2019), layout: 'V8', displacement: 3994, aspiration: 'twinturbo', boost: 1.4, compression: 8.7, redline: 8500, cam: 0.7, aluBlock: true }; s.gearbox = 'dct'; s.gears = 7; s.finalDrive = 3.3; s.tireWidth = 305; s.tireCompound = 'semislick'; s.suspFront = s.suspRear = 'wishbone'; s.sport = 0.85; s.brakes = 'ceramic'; s.wheelDia = 20; s.wing = 0.5; s.splitter = 0.5; s.flatFloor = true; s.seats = 2; s.interior = 'premium'; s.quality = 0.8;
show('2019 V8TT carbon supercar', s, 2019, '~1420kg 530kW 0-100 2.9 top 341');
// 1955 small sedan 1.2 flat four 22kW: 0-100 ~35, top 110
s = defaultVehicle(1955, 'hatch'); s.size = 1.0; s.engine = { ...defaultEngine(1955), layout: 'F4', displacement: 1192, compression: 6.6, redline: 4000, cam: 0.2 }; s.enginePos = 'rear'; s.drive = 'RWD'; s.gears = 4; s.finalDrive = 4.4; s.tireWidth = 145; s.wheelDia = 15; s.interior = 'basic';
show('1955 rear flat-4 1.2', s, 1955, '~740kg 22kW 0-100 35+ top 110 7.5L');
// 2022 EV sedan 60kWh 208kW RWD: 1750kg, 0-100 6.1, 15 kWh/100
s = defaultVehicle(2022, 'sedan'); s.engine = { ...defaultEngine(2022), layout: 'EV', motorKw: 208, batteryKwh: 60 }; s.drive = 'RWD'; s.gearbox = 'auto'; s.tireWidth = 235; s.aeroOpt = 0.9;
show('2022 EV sedan 60kWh', s, 2022, '~1760kg 208kW 0-100 6.1 top 225 14-15kWh');
// 1968 V12 4.4 front GT: 1280kg(dry) 259kW 0-100 5.9 top 280
s = defaultVehicle(1968, 'coupe'); s.chassis = 'spaceframe'; s.panels = 'steel'; s.engine = { ...defaultEngine(1968), layout: 'V12', displacement: 4390, valvetrain: 'dohc2', compression: 9.3, redline: 7700, cam: 0.6, boreStroke: 1.14 }; s.drive = 'RWD'; s.gears = 5; s.finalDrive = 3.3; s.tireWidth = 215; s.tireCompound = 'sport'; s.suspFront = s.suspRear = 'wishbone'; s.sport = 0.6; s.brakes = 'vented'; s.seats = 2; s.interior = 'premium'; s.wheelDia = 15; s.quality = 0.75;
show('1968 V12 4.4 GT', s, 1968, '~1500kg 259kW 0-100 5.9 top 280');
// 2015 pickup V8 5.0
s = defaultVehicle(2015, 'pickup'); s.chassis = 'ladder'; s.engine = { ...defaultEngine(2015), layout: 'V8', displacement: 4951, compression: 10.5, redline: 6500 }; s.drive = 'AWD'; s.gearbox = 'auto'; s.gears = 6; s.finalDrive = 3.55; s.tireWidth = 265; s.suspRear = 'solid';
show('2015 V8 pickup', s, 2015, '~2200kg 287kW 0-100 6.5 top 170(lim) 14L');

// ---- racing checks
import { getRegs } from '../src/sim/racing/regs';
import { computeRaceCar, defaultRaceCar } from '../src/sim/racing/racecar';
import { lapSim } from '../src/sim/racing/lapsim';
import { TRACKS, trackGeom } from '../src/sim/racing/tracks';
console.log('\n--- race cars (default spec, dev 0.5) on each era');
for (const [d, y] of [['f1', 1950], ['f1', 1958], ['f1', 1963], ['f1', 1970], ['f1', 1979], ['f1', 1986], ['f1', 1992], ['f1', 2004], ['f1', 2010], ['f1', 2016], ['f1', 2023], ['hypercar', 1967], ['hypercar', 1988], ['hypercar', 2008], ['hypercar', 2016], ['hypercar', 2023], ['lmdh', 2023], ['gt', 1970], ['gt', 2020], ['touring', 1965], ['touring', 1995], ['touring', 2020]] as const) {
  const regs = getRegs(d, y);
  const car = defaultRaceCar(regs, y);
  const perf = computeRaceCar(car, { aero: 0.5, engine: 0.5, chassis: 0.5, reliability: 0.5 }, regs, y, 0.5);
  const laps = ['parco', 'riviera', 'ouest'].map((id) => { const g = trackGeom(id); const r = lapSim(g, { mass: perf.mass + 40, powerW: perf.powerKw * 1000 * 0.9, cdA: perf.cdA, clA: perf.clA, mu: perf.mu, awd: perf.awd }); return `${id} ${Math.floor(r.time / 60)}:${(r.time % 60).toFixed(1).padStart(4, '0')} vmax ${(r.vMax * 3.6).toFixed(0)} ${(r.energyKwh * perf.fuelKgPerKwh).toFixed(2)}kg/lap`; });
  console.log(`${d.padEnd(8)} ${y} ${car.engine.layout} ${car.engine.displacement}cc ${car.engine.aspiration} b${car.engine.boost} cr${car.engine.compression} ${car.engine.redline}rpm ${perf.powerKw.toFixed(0)}kW${perf.capped ? '(cap)' : ''} ${perf.mass.toFixed(0)}kg ClA ${perf.clA.toFixed(2)} rel ${perf.reliability.toFixed(2)} | ${laps.join(' | ')} ${perf.legal.join(';')}`);
}
console.log('\n--- tracks');
for (const t of TRACKS) { const g = trackGeom(t.id); let minR = 1e9; for (let i = 0; i < g.n; i++) if (g.curv[i] > 0) minR = Math.min(minR, 1 / g.curv[i]); console.log(t.id.padEnd(11), 'n', g.n, 'zones', g.zones.length, 'minR', minR.toFixed(0)); }
