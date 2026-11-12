// Vehicle engineering model.
//
// Everything a car can do in the game is derived here from its specification with physically
// motivated formulas (documented inline). Constants are calibrated so that well-known real cars
// land within roughly ±10 % of their published figures; they are approximations, not CFD/FEA.
//
//  Engine      : mean-effective-pressure model. IMEP = air charge × fuel energy × indicated efficiency,
//                BMEP = IMEP − friction (piston-speed based) − pumping/drive losses, T = BMEP·Vd / 4π.
//  Performance : longitudinal time-step integration with gear ratios, traction limit incl. weight
//                transfer, aerodynamic drag ½ρCdA·v² and rolling resistance.
//  Braking     : v² / 2a with tyre-limited deceleration µ(g + downforce/m), capped by brake capacity.
//  Economy     : road-load energy (urban + highway) divided by part-load brake efficiency.
//  Cost        : bill of materials by mass and component, labour hours, programme cost.
import type {
  BodyType, EngineLayout, EngineSpec, EngineStats, CurvePoint, Scores, SegmentId, Tech, VehicleSpec, VehicleStats,
} from './types';
import { clamp, cpi, kf, lerp, smooth } from './util';

export const G = 9.81;
export const RHO = 1.225; // kg/m³ air density at sea level, 15 °C

export const CYL: Record<EngineLayout, number> = { I2: 2, I3: 3, I4: 4, I5: 5, I6: 6, V6: 6, V8: 8, V10: 10, V12: 12, F4: 4, F6: 6, F12: 12, EV: 0 };
export const LAYOUT_NAME: Record<EngineLayout, string> = {
  I2: 'Inline-2', I3: 'Inline-3', I4: 'Inline-4', I5: 'Inline-5', I6: 'Inline-6', V6: 'V6', V8: 'V8', V10: 'V10', V12: 'V12',
  F4: 'Flat-4', F6: 'Flat-6', F12: 'Flat-12', EV: 'Electric',
};

export interface BodyDef { name: string; L: number; W: number; H: number; wb: number; cd: number; seats: number; cargo: number; massF: number; r: number; gc: number }
export const BODY: Record<BodyType, BodyDef> = {
  hatch: { name: 'Hatchback', L: 4.0, W: 1.7, H: 1.48, wb: 0.63, cd: 0.35, seats: 5, cargo: 0.6, massF: 0.95, r: 0.3, gc: 0.15 },
  sedan: { name: 'Sedan', L: 4.65, W: 1.78, H: 1.45, wb: 0.6, cd: 0.33, seats: 5, cargo: 0.65, massF: 1.0, r: 0.32, gc: 0.15 },
  wagon: { name: 'Wagon / MPV', L: 4.75, W: 1.78, H: 1.52, wb: 0.6, cd: 0.35, seats: 5, cargo: 0.9, massF: 1.04, r: 0.32, gc: 0.15 },
  coupe: { name: 'Coupé', L: 4.45, W: 1.8, H: 1.33, wb: 0.59, cd: 0.32, seats: 4, cargo: 0.4, massF: 0.97, r: 0.32, gc: 0.13 },
  roadster: { name: 'Roadster', L: 4.05, W: 1.72, H: 1.25, wb: 0.59, cd: 0.37, seats: 2, cargo: 0.2, massF: 0.93, r: 0.31, gc: 0.13 },
  supercar: { name: 'Supercar', L: 4.5, W: 1.95, H: 1.16, wb: 0.59, cd: 0.34, seats: 2, cargo: 0.12, massF: 0.95, r: 0.34, gc: 0.11 },
  suv: { name: 'SUV', L: 4.7, W: 1.88, H: 1.72, wb: 0.6, cd: 0.4, seats: 5, cargo: 0.95, massF: 1.22, r: 0.37, gc: 0.21 },
  pickup: { name: 'Pickup / Van', L: 5.3, W: 1.92, H: 1.8, wb: 0.62, cd: 0.45, seats: 3, cargo: 1.0, massF: 1.18, r: 0.38, gc: 0.23 },
};

export function dims(s: VehicleSpec) {
  const b = BODY[s.body];
  const length = b.L * s.size;
  const width = b.W * (1 + (s.size - 1) * 0.5);
  const height = b.H * (1 + (s.size - 1) * 0.3) - 0.03 * s.sport;
  const wheelbase = length * b.wb;
  const tireR = b.r * (1 + (s.size - 1) * 0.4);
  const clearance = Math.max(0.08, b.gc - 0.04 * s.sport);
  const track = width - 0.24;
  return { length, width, height, wheelbase, tireR, clearance, track };
}

// ---------------------------------------------------------------------------------------- Engine

const VE_BASE = { ohv: 0.8, sohc: 0.84, dohc2: 0.87, dohc4: 0.93 } as const;
const VE_FUEL = { carb: -0.03, mfi: 0, efi: 0.01, di: 0.025 } as const;
const ETA_FUEL = { carb: 0.97, mfi: 0.99, efi: 1.0, di: 1.03 } as const;
const VALVE_RPM = { ohv: 5600, sohc: 6800, dohc2: 7600, dohc4: 8800 } as const;

/** Friction mean effective pressure [bar] as a function of mean piston speed [m/s]. */
function fmepBar(sp: number, k: number) { return (0.55 + 0.045 * sp + 0.0042 * sp * sp) * k; }

export function computeEngine(e: EngineSpec, techYear: number, quality = 0.5, race = false, year = techYear): EngineStats {
  if (e.layout === 'EV') return computeMotor(e, techYear, quality, year);
  const warnings: string[] = [];
  const cyl = CYL[e.layout];
  const litres = e.displacement / 1000;
  const vCyl = e.displacement / cyl / 1e6; // m³
  // Geometry from swept volume and bore/stroke ratio: V = π/4·b²·s
  const stroke = Math.cbrt((4 * vCyl) / (Math.PI * e.boreStroke ** 2));
  const bore = stroke * e.boreStroke;
  const t = clamp((techYear - 1950) / 70, 0, 1.1);
  const t1 = Math.min(t, 1);

  const vePeak = VE_BASE[e.valvetrain] + VE_FUEL[e.fuelSystem] + 0.07 * t + (e.vvt ? 0.03 : 0) + 0.08 * e.cam + (race ? 0.05 : 0);
  const valveLimit = VALVE_RPM[e.valvetrain] * (0.86 + 0.2 * t1 + 0.08 * quality) * (race ? 1.1 + 0.75 * t1 : 1) * Math.pow(0.0005 / vCyl, 0.15);
  // forged internals and tighter tolerances let a well-built road engine run faster piston speeds (≈25 m/s for the best)
  const spLimit = 17 + 6 * t1 + 2 * quality + (race ? 4.5 : 1.5 * quality);
  const spRed = (2 * stroke * e.redline) / 60;

  // Indicated efficiency: ideal Otto cycle (γ_eff ≈ 1.30) × real-cycle factor.
  const etaI = (1 - Math.pow(e.compression, -0.3)) * 0.8 * (0.93 + 0.07 * t1) * ETA_FUEL[e.fuelSystem] * (race ? 1.03 : 1);

  // Knock: effective compression rises with boost; limit grows with fuel/chamber technology.
  const boost = e.aspiration === 'na' ? 0 : e.boost;
  // road engines run intercooled charge and richer mixtures under boost than this simple index assumed (race path unchanged)
  const knockIdx = e.compression * Math.pow(1 + boost, race ? 0.65 : 0.55);
  const knockLimit = 8.6 + 4.4 * t1 + (e.fuelSystem === 'di' ? 1.4 : 0) + (e.valvetrain === 'dohc4' ? 0.4 : 0) + (race ? (boost > 0 ? 5.5 : 3) : 0) + (0.085 - bore) * 20;
  const knockMargin = knockLimit - knockIdx;
  const derate = knockMargin >= 0 ? 1 : Math.max(0.6, 1 + 0.05 * knockMargin);
  if (knockMargin < 0) warnings.push('Knock-limited: compression × boost too high for the available fuel — ignition retarded, power lost.');

  const rpmTune = e.redline * lerp(0.52, 0.86, e.cam);
  const kLow = e.vvt ? 0.28 : 0.5;
  const fmepK = (1.15 - 0.3 * t1) * (1 + 0.012 * (cyl - 4)) * (race ? 0.85 : 1);
  const isTurbo = e.aspiration === 'turbo' || e.aspiration === 'twinturbo';
  const spoolFull = clamp((1500 + boost * 1300) * (e.aspiration === 'twinturbo' ? 0.8 : 1) * (1.35 - 0.5 * t1) * Math.pow(2 / litres, 0.3), 1400, e.redline * 0.7);
  const icExp = 0.7 + 0.1 * t1; // intercooling effectiveness (density recovery)

  const curve: CurvePoint[] = [];
  let pk = { kw: 0, rpm: 0 }, tk = { nm: 0, rpm: 0 };
  const steps = Math.max(8, Math.round((e.redline - 1000) / 250));
  for (let i = 0; i <= steps; i++) {
    const rpm = 1000 + ((e.redline - 1000) * i) / steps;
    const x = (rpm - rpmTune) / rpmTune;
    let ve = vePeak * (1 - (x < 0 ? kLow : kLow * 1.8) * x * x);
    if (rpm > valveLimit) ve *= Math.max(0.3, 1 - ((rpm - valveLimit) / valveLimit) * 4); // valve float
    ve = Math.max(ve, vePeak * 0.45);
    let b = 0, parasitic = 0;
    if (isTurbo) {
      const spool = smooth((rpm - 0.45 * spoolFull) / (0.55 * spoolFull));
      b = boost * spool * (rpm > 0.7 * e.redline ? 1 - 0.35 * ((rpm / e.redline - 0.7) / 0.3) : 1); // compressor flow limit
      parasitic = 0.22 * b; // exhaust back-pressure
    } else if (e.aspiration === 'supercharged') {
      b = boost * (0.75 + (0.25 * rpm) / e.redline);
      parasitic = 1.5 * b; // compressor drive work
    }
    // 35.44 bar = ρ_air(1.184 kg/m³) × LHV/AFR (44 MJ/kg ÷ 14.7); ×1.04 for best-power enrichment
    const imep = 35.44 * ve * Math.pow(1 + b, icExp) * etaI * 1.04 * derate;
    const sp = (2 * stroke * rpm) / 60;
    const bmep = Math.max(0, imep - fmepBar(sp, fmepK) - parasitic);
    let nm = 7.958 * bmep * litres; // T = BMEP·Vd/4π
    if (e.hybridKw > 0) nm += Math.min((e.hybridKw * 9549) / Math.max(rpm, 2500), e.hybridKw * 3.2);
    const kw = (nm * rpm) / 9549;
    curve.push({ rpm: Math.round(rpm), nm, kw });
    if (kw > pk.kw) pk = { kw, rpm };
    if (nm > tk.nm) tk = { nm, rpm };
  }
  if (spRed > spLimit) warnings.push(`Mean piston speed ${spRed.toFixed(1)} m/s exceeds the safe ${spLimit.toFixed(1)} m/s — durability suffers.`);
  if (e.redline > valveLimit * 1.02) warnings.push(`Valvetrain floats above ~${Math.round(valveLimit / 100) * 100} rpm — revs beyond that add no power.`);

  const iceKw = pk.kw - (e.hybridKw > 0 ? e.hybridKw : 0);
  const specificKwL = iceKw / litres;
  const norm = 30 + 50 * t1 + (race ? 60 : 0);
  let reliability = 72 + 14 * t1 + 14 * quality;
  reliability -= Math.max(0, specificKwL / norm - 1) * 14;
  reliability -= Math.max(0, spRed / spLimit - 0.9) * 60;
  reliability -= Math.max(0, e.redline / valveLimit - 0.95) * 50;
  reliability -= Math.max(0, -knockMargin) * 6;
  if (isTurbo) reliability -= (3 + boost * 5) * (1.4 - t1);
  if (e.aspiration === 'supercharged') reliability -= 2 + boost * 3;
  reliability -= (e.valvetrain === 'dohc4' ? 1 : 0) + (e.vvt ? 1 : 0) + (e.fuelSystem === 'di' ? 1 : 0) + (e.hybridKw > 0 ? 2 : 0) + (cyl > 8 ? 2 : 0);
  reliability = clamp(reliability, 5, 99);

  let mass = (35 + 38 * litres + 9 * cyl) * (e.aluBlock ? 0.76 : 1) * (1.12 - 0.2 * t1) * (e.valvetrain.startsWith('dohc') ? 1.06 : 1);
  if (e.aspiration === 'turbo') mass += 20; if (e.aspiration === 'twinturbo') mass += 34; if (e.aspiration === 'supercharged') mass += 25;
  if (e.hybridKw > 0) mass += 30 + e.hybridKw * lerp(1.6, 0.9, clamp((techYear - 1997) / 25, 0, 1));
  if (race) mass *= 0.62;

  let cost = (300 + 300 * litres + 150 * cyl) * { ohv: 1, sohc: 1.12, dohc2: 1.25, dohc4: 1.4 }[e.valvetrain];
  cost += { carb: 60, mfi: 400, efi: 200, di: 450 }[e.fuelSystem];
  if (e.aspiration === 'turbo') cost += 700; if (e.aspiration === 'twinturbo') cost += 1500; if (e.aspiration === 'supercharged') cost += 1300;
  if (e.vvt) cost += 150;
  if (e.aluBlock) cost *= 1.1;
  if (cyl >= 10) cost *= 1.6;
  cost *= 0.65 + 0.9 * Math.pow(quality, 1.5) + 2 * Math.pow(quality, 4);
  // hybrid system: motor-generator, inverter and a small battery
  if (e.hybridKw > 0) cost += 700 + e.hybridKw * kf([[1997, 75], [2010, 42], [2025, 22]], techYear);

  return {
    isEV: false, powerKw: pk.kw, powerRpm: pk.rpm, torqueNm: tk.nm, torqueRpm: tk.rpm, curve, mass, cost2020: cost, reliability,
    bore, stroke, pistonSpeed: spRed, pistonSpeedLimit: spLimit, knockMargin, etaI, bmepPeak: tk.nm / (7.958 * litres), specificKwL,
    fmepK, valveLimitRpm: valveLimit, warnings,
  };
}

function computeMotor(e: EngineSpec, techYear: number, quality: number, year: number): EngineStats {
  const evT = clamp((techYear - 2005) / 20, 0, 1);
  // Constant torque up to the base speed, constant power above it. With the fixed 9:1 reduction a base speed of
  // 4300 rpm is ≈ 60 km/h, as in production EVs (e.g. 160 kW / 350 Nm, 150 kW / 310 Nm).
  // Rotor speed limit grows with motor technology (≈ 16,000 rpm in 2012, ≈ 19,000 rpm in 2025).
  const baseRpm = 4300, maxRpm = Math.round((14000 + 5000 * evT) / 500) * 500;
  const tq = (e.motorKw * 9549) / baseRpm;
  const curve: CurvePoint[] = [];
  for (let rpm = 0; rpm <= maxRpm; rpm += 500) {
    const nm = rpm <= baseRpm ? tq : (tq * baseRpm) / rpm * (rpm > 0.8 * maxRpm ? 1 - (rpm - 0.8 * maxRpm) / (0.75 * maxRpm) : 1);
    curve.push({ rpm, nm, kw: (nm * rpm) / 9549 });
  }
  const kgPerKwh = kf([[1990, 30], [2000, 22], [2008, 9.5], [2015, 7.3], [2020, 6.2], [2025, 5.4], [2035, 4.2]], techYear);
  const usdPerKwh = kf([[1990, 3000], [2000, 2200], [2008, 1100], [2012, 650], [2015, 380], [2020, 150], [2025, 115], [2035, 75]], Math.max(techYear, year - 1)); // cells are bought at today's price, whatever the age of the pack design
  const mass = e.motorKw * lerp(0.8, 0.3, evT) + 30 + e.batteryKwh * kgPerKwh;
  const batteryCost = e.batteryKwh * usdPerKwh * (0.9 + 0.3 * quality);
  const cost = (1500 + e.motorKw * 18) * (0.9 + 0.3 * quality) + batteryCost;
  const warnings: string[] = [];
  if (e.batteryKwh / e.motorKw < 0.12) warnings.push('Battery is small for this motor — peak power cannot be sustained.');
  return {
    isEV: true, batteryCost2020: batteryCost, powerKw: e.motorKw, powerRpm: baseRpm, torqueNm: tq, torqueRpm: 0, curve, mass, cost2020: cost,
    reliability: clamp(80 + 10 * quality + 6 * evT, 5, 99), bore: 0, stroke: 0, pistonSpeed: 0, pistonSpeedLimit: 0, knockMargin: 0,
    etaI: 0.9, bmepPeak: 0, specificKwL: 0, fmepK: 0, valveLimitRpm: maxRpm, warnings,
  };
}

export function torqueAt(st: EngineStats, rpm: number): number {
  const c = st.curve;
  if (rpm <= c[0].rpm) return c[0].nm * (st.isEV ? 1 : Math.max(0.6, rpm / c[0].rpm));
  const last = c[c.length - 1];
  if (rpm >= last.rpm) return 0;
  // curve points are evenly spaced
  const f = ((rpm - c[0].rpm) / (last.rpm - c[0].rpm)) * (c.length - 1);
  const i = Math.min(c.length - 2, Math.floor(f));
  return lerp(c[i].nm, c[i + 1].nm, f - i);
}

// --------------------------------------------------------------------------------------- Vehicle

export function gearRatios(n: number, isEV: boolean, sport = 0): number[] {
  if (isEV) return [1];
  // a sports gearbox has a taller first gear and closer ratios
  const first = (n <= 3 ? 2.9 : n === 4 ? 3.4 : n <= 6 ? 3.7 : 4.3) * (1 - 0.2 * sport);
  const top = n <= 4 ? 1.0 : n === 5 ? 0.82 : n === 6 ? 0.7 : n === 7 ? 0.63 : 0.58;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(first * Math.pow(top / first, n === 1 ? 0 : i / (n - 1)));
  return out;
}

const MU_COMPOUND = { economy: 0.95, touring: 1.04, sport: 1.15, semislick: 1.3 } as const;
const CRR_COMPOUND = { economy: 0.0085, touring: 0.0105, sport: 0.012, semislick: 0.015 } as const;
const TIRE_TECH: [number, number][] = [[1950, 0.74], [1960, 0.8], [1970, 0.86], [1980, 0.91], [1990, 0.95], [2000, 0.98], [2010, 1.0], [2025, 1.05]];
const SUSP_GRIP = { solid: 0.9, macpherson: 0.95, wishbone: 1.0, multilink: 0.99 } as const;

// Era reference values used to turn absolute figures into 0–100 scores ("how good is this for its time").
export const NORM = {
  accel: [[1950, 24], [1960, 19], [1970, 15], [1980, 13.5], [1990, 11.5], [2000, 10.8], [2010, 10], [2020, 8.8]] as [number, number][],
  top: [[1950, 120], [1970, 150], [1990, 180], [2010, 195], [2020, 200]] as [number, number][],
  latG: [[1950, 0.62], [1970, 0.72], [1990, 0.8], [2010, 0.86], [2020, 0.88]] as [number, number][],
  brake: [[1950, 62], [1970, 52], [1990, 44], [2010, 39], [2020, 37]] as [number, number][],
  fuel: [[1950, 13], [1970, 12.5], [1980, 10.5], [1990, 9], [2000, 8.3], [2010, 7.2], [2020, 6.3]] as [number, number][],
  safety: [[1950, 0], [1962, 0.6], [1975, 1.1], [1990, 1.8], [2000, 2.4], [2010, 3]] as [number, number][],
};
const sat = (ratio: number, pow = 1) => 100 * (1 - Math.pow(0.5, Math.pow(Math.max(ratio, 0), pow)));

export interface VehicleCtx { year: number; tech: Tech; materialIndex?: number }

export function computeVehicle(s: VehicleSpec, ctx: VehicleCtx): VehicleStats {
  const { tech, year } = ctx;
  const warnings: string[] = [];
  const b = BODY[s.body];
  const d = dims(s);
  const eng = computeEngine(s.engine, tech.engine, s.quality, false, year);
  warnings.push(...eng.warnings);
  const isEV = eng.isEV;
  const cyl = CYL[s.engine.layout];
  const tc = clamp((tech.chassis - 1950) / 70, 0, 1);

  // ---- mass (kg)
  const plan = d.length * d.width;
  const elecT = clamp((tech.electronics - 1950) / 70, 0, 1);
  const chassisF = { ladder: 1.25, steel: 1.0, spaceframe: 1.12, aluminium: 0.84, carbon: 0.66 }[s.chassis];
  // crash structures: every safety level adds reinforcement to the shell as well as equipment
  const mChassis = 50 * plan * Math.pow(plan / 8.28, 0.15) * chassisF * b.massF * (1.05 - 0.1 * tc) * (0.7 + 0.11 * s.safety);
  const mPanels = 12 * plan * { steel: 1, aluminium: 0.6, fibreglass: 0.55, carbon: 0.35 }[s.panels] * (s.body === 'suv' || s.body === 'pickup' ? 1.2 : 1);
  // seats, trim, sound deadening, heating/air conditioning; a sport-focused cabin sheds part of it
  const mInterior = { basic: 80, standard: 150, premium: 225, luxury: 330 }[s.interior] * s.size * (0.5 + s.seats / 10) * (0.7 + 0.3 * elecT) * (1 - 0.3 * s.sport);
  const mSafety = [0, 30, 80, 135][Math.round(s.safety)] ?? 0;
  const nGears = isEV ? 1 : s.gears;
  let mDrive = isEV ? 45 : ({ manual: 35, auto: 70, dct: 60 }[s.gearbox] + 5 * nGears + 0.09 * eng.torqueNm);
  if (s.drive === 'AWD') mDrive += s.chassis === 'ladder' ? 165 : 75; // off-roaders: transfer case and live axles
  if (s.drive === 'RWD' && s.enginePos === 'front') mDrive += 25;
  const transaxle = !!s.transaxle && s.enginePos === 'front' && s.drive !== 'FWD' && !isEV;
  if (transaxle) mDrive += 15; // torque tube
  // suspension, subframes, steering, brakes, wheels and tyres
  const mRunning = 140 * s.size * s.size + { drum: 0, disc: 6, vented: 14, ceramic: -6 }[s.brakes] + 4 * (4 + s.tireWidth / 30) + 4 * (s.wheelDia * 0.55);
  // glazing, wiring and electrics, and for combustion cars fuel, exhaust and cooling system
  const mMisc = 28 * s.size + lerp(20, 85, elecT) + (isEV ? 12 : 42 * s.size + 38) + s.wing * 12 + s.splitter * 6;
  const mass = mChassis + mPanels + mInterior + mSafety + mDrive + mRunning + mMisc + eng.mass;
  const massBreakdown = { Chassis: mChassis, 'Body panels': mPanels, Powertrain: eng.mass, Driveline: mDrive, 'Wheels, brakes, suspension': mRunning, Interior: mInterior, Safety: mSafety, 'Fluids & electrics': mMisc };

  // ---- layout
  // Static front axle share. A front-engined rear-drive car carries its gearbox and final drive behind the engine, and the
  // sportier the chassis the further back the engine sits (front-mid engine, rear transaxle): ≈ 53 % front for a
  // saloon, ≈ 51 % for a sports coupé and ≈ 47–48 % with a rear transaxle. A heavy engine moves the balance towards its own end.
  let wf = isEV ? 0.5 : s.enginePos === 'front' ? (s.drive === 'FWD' ? 0.615 : s.drive === 'AWD' ? 0.57 - 0.03 * s.sport : 0.54 - 0.04 * s.sport) : s.enginePos === 'mid' ? 0.43 : 0.39;
  if (transaxle) wf -= 0.04;
  if (!isEV) wf += (eng.mass / mass - 0.12) * 0.3 * (s.enginePos === 'front' ? 1 : -1);
  wf = clamp(wf, 0.3, 0.7);
  const cgH = d.height * (s.body === 'suv' || s.body === 'pickup' ? 0.42 : 0.38);

  // ---- aero
  const cdEra = kf([[1950, 1.42], [1965, 1.28], [1980, 1.1], [2000, 1.0], [2020, 0.9]], tech.aero);
  // Drag: body shape, aero devices, tyre width, and the cooling airflow a powerful engine needs (radiators, intercoolers, brake ducts).
  const coolingCd = isEV ? 0.00003 * Math.max(0, eng.powerKw - 150) : 0.00008 * Math.max(0, eng.powerKw - 100);
  const cd = b.cd * cdEra * (1 - 0.1 * s.aeroOpt) + 0.1 * s.wing + 0.02 * s.splitter + (s.flatFloor ? -0.008 : 0) + (s.tireWidth - 195) * 0.00025 + coolingCd;
  const frontalArea = 0.86 * d.width * (d.height - d.clearance * 0.5);
  const cdA = cd * frontalArea;
  const aeroTech = 0.7 + 0.5 * clamp((tech.aero - 1965) / 55, 0, 1);
  const cl = 0.16 - 0.04 * s.aeroOpt - 0.5 * s.wing * aeroTech - 0.16 * s.splitter * aeroTech - (s.flatFloor ? 0.2 * aeroTech : 0);
  const clA = cl * plan * 0.24; // referenced to frontal-ish area
  const downforce = (v: number) => -0.5 * RHO * clA * v * v; // N, positive = down

  // ---- tyres
  const tireTech = kf(TIRE_TECH, tech.chassis);
  const muBase = MU_COMPOUND[s.tireCompound] * tireTech;
  const mu = muBase * Math.pow((s.tireWidth * 4) / (mass * 0.62), 0.12); // tyre load sensitivity
  const crr = CRR_COMPOUND[s.tireCompound] * kf([[1950, 1.6], [1970, 1.3], [1990, 1.1], [2010, 1.0]], tech.chassis);

  // ---- driveline
  const ratios = gearRatios(nGears, isEV, s.sport);
  // electric cars: single reduction sized to the wheel, so that the motor's base speed is ≈ 60 km/h
  const final = isEV ? 9.0 * (d.tireR / 0.33) : s.finalDrive;
  const autoEta = kf([[1950, 0.84], [1980, 0.88], [2000, 0.94], [2015, 0.97]], tech.engine);
  const eta = (isEV ? 0.93 : { FWD: 0.91, RWD: 0.895, AWD: 0.86 }[s.drive]) * (s.gearbox === 'auto' && !isEV ? autoEta : 1);
  const shiftTime = isEV ? 0 : s.gearbox === 'dct' ? 0.08 : s.gearbox === 'auto' ? kf([[1950, 0.9], [1990, 0.6], [2015, 0.25]], tech.engine) : kf([[1950, 0.75], [1975, 0.6], [2000, 0.4], [2015, 0.35]], tech.engine);
  const redline = isEV ? eng.valveLimitRpm : s.engine.redline;
  // Launch. A manual or dual-clutch car slips its clutch at the launch revs; a torque-converter automatic stalls the
  // converter, which multiplies torque until the turbine catches up. Launch control (dual-clutch and modern automatic
  // gearboxes with engine electronics from the mid-2000s) holds the engine where it makes its torque.
  const launchControl = !isEV && s.gearbox !== 'manual' && tech.electronics >= 2004;
  const stallRpm = clamp(eng.torqueRpm * 0.75, 1800, 2800);
  const launchRpm = isEV ? 0 : s.gearbox === 'auto' ? (launchControl ? Math.max(stallRpm, Math.min(redline * 0.5, eng.torqueRpm)) : stallRpm) : Math.min(redline * 0.62, Math.max(2500, eng.torqueRpm));
  // Share of the tyres' peak grip that can actually be held on a full-throttle start: an open differential and the
  // driver's right foot, then limited-slip differentials, traction control and finally launch control.
  let tractionUse = isEV ? 0.98 : kf([[1950, 0.9], [1985, 0.93], [1998, 0.95], [2010, 0.97]], tech.electronics);
  if (launchControl) tractionUse = Math.max(tractionUse, kf([[2004, 0.96], [2014, 0.99]], tech.electronics));
  if (s.drive === 'AWD') tractionUse = Math.min(1, tractionUse + 0.02);
  const m = mass + 75; // with driver
  // rolling resistance rises with speed (tyre deformation): ≈ +20 % at 100 km/h, ×2.5 at 330 km/h
  const resist = (v: number) => 0.5 * RHO * cdA * v * v + crr * (1 + 0.55 * (v / 55) * (v / 55)) * m * G;
  // engine, flywheel and gearbox inertia reflected to the wheels (a sport flywheel is lighter; a motor rotor is small)
  const kInertia = isEV ? 0.0004 : 0.0015 * (1 - 0.3 * s.sport);

  // ---- acceleration: explicit Euler integration
  let v = 0, x = 0, tt = 0, gear = 0, shift = 0, aPrev = 3;
  let t100 = NaN, tQ = NaN, t80 = NaN, t120 = NaN, t200 = NaN;
  // run to the quarter mile and on to 200 km/h (or until the car has clearly stopped gaining speed)
  while (tt < 45 && (isNaN(t100) || isNaN(tQ) || (isNaN(t200) && (tt < 12 || aPrev > 0.25)))) {
    const dt = tt < 4 ? 0.01 : tt < 20 ? 0.03 : 0.1;
    const total = ratios[gear] * final;
    const rpm = (v / d.tireR) * total * 9.5493;
    if (!isEV && gear < nGears - 1 && shift <= 0) {
      // change up at the rev limit, or past the power peak as soon as the next gear pulls harder
      let up = rpm > redline * 0.985;
      if (!up && rpm > eng.powerRpm) {
        const rpmNext = (rpm * ratios[gear + 1]) / ratios[gear];
        up = torqueAt(eng, rpmNext) * ratios[gear + 1] > torqueAt(eng, rpm) * ratios[gear];
      }
      if (up) { gear++; shift = shiftTime; continue; }
    }
    let F = 0, Ftrac = 1e9;
    if (shift > 0) shift -= dt;
    else {
      const rpmEff = gear === 0 ? Math.max(rpm, launchRpm) : rpm;
      const converter = s.gearbox === 'auto' && !isEV && gear === 0 && rpm < stallRpm ? 1 + 0.8 * (1 - rpm / stallRpm) : 1;
      F = (torqueAt(eng, Math.min(rpmEff, redline - 1)) * converter * total * eta) / d.tireR;
      if (rpm >= redline) F = 0;
      const N = m * G + downforce(v);
      const transfer = (m * Math.max(aPrev, 0) * cgH) / d.wheelbase;
      const Nd = s.drive === 'AWD' ? N : s.drive === 'RWD' ? (1 - wf) * N + transfer : wf * N - transfer;
      Ftrac = mu * 1.05 * tractionUse * Math.max(Nd, 0);
    }
    // rotating inertia loads the engine, not the contact patch: evaluate both limits separately
    const aEng = (F - resist(v)) / (m * (1.03 + kInertia * total * total));
    const a = shift > 0 ? aEng : Math.min(aEng, (Ftrac - resist(v)) / (m * 1.03));
    aPrev = a;
    v = Math.max(0, v + a * dt);
    x += v * dt;
    tt += dt;
    if (isNaN(t80) && v >= 22.22) t80 = tt;
    if (isNaN(t100) && v >= 27.78) t100 = tt;
    if (isNaN(t120) && v >= 33.33) t120 = tt;
    if (isNaN(t200) && v >= 55.56) t200 = tt;
    if (isNaN(tQ) && x >= 402.3) tQ = tt;
  }
  if (isNaN(t100)) t100 = 45 * Math.max(1, 27.78 / Math.max(v, 3)); if (isNaN(tQ)) tQ = 45;

  // ---- top speed: highest speed at which some gear still has tractive surplus (within rev range)
  let top = 5;
  for (let vv = 8; vv < 140; vv += 0.5) {
    let ok = false;
    for (let g = 0; g < ratios.length; g++) {
      const rpm = (vv / d.tireR) * ratios[g] * final * 9.5493;
      if (rpm > redline || rpm < 900) continue;
      if ((torqueAt(eng, rpm) * ratios[g] * final * eta) / d.tireR >= resist(vv)) { ok = true; break; }
    }
    if (ok) top = vv; else if (vv > top + 6) break;
  }
  if (!isEV && top * 3.6 > 60) {
    const rpmTop = (top / d.tireR) * ratios[ratios.length - 1] * final * 9.5493;
    if (rpmTop > redline * 0.985) warnings.push('Top speed is rev-limited — a taller final drive would raise it.');
  }

  // ---- braking 100–0 km/h
  const elec = clamp((tech.electronics - 1950) / 60, 0, 1);
  const brakeEff = s.safety >= 2 ? 0.97 : 0.84 + 0.06 * elec;
  const brakeCap = { drum: 0.72, disc: 0.98, vented: 1.12, ceramic: 1.3 }[s.brakes] * (0.9 + s.wheelDia / 100) * Math.sqrt(1400 / mass);
  const vb = 27.78;
  const decel = Math.min(mu * brakeEff * (G + downforce(vb * 0.7) / m), brakeCap * G);
  const braking100 = (vb * vb) / (2 * decel);

  // ---- cornering
  const suspGrip = (SUSP_GRIP[s.suspFront] + SUSP_GRIP[s.suspRear]) / 2;
  const lateralG = 0.9 * mu * suspGrip * (0.93 + 0.07 * s.sport) * (1 - 0.35 * Math.abs(wf - 0.48)) * (1 - Math.max(0, cgH / d.track - 0.33) * 0.6) * (1 + downforce(33) / (m * G));

  // ---- fuel / energy consumption
  const eco = fuelModel(s, eng, { m, cdA, crr, eta, tireR: d.tireR, topRatio: ratios[ratios.length - 1] * final, tech });
  let rangeKm = isEV ? (s.engine.batteryKwh * 0.92 * 100) / eco.combined : (50 * s.size * 100) / eco.combined;
  if (isEV && s.engine.batteryKwh < 15) warnings.push('Very small battery: range will not satisfy most buyers.');

  // ---- cost (2020 USD → nominal)
  // Craftsmanship and bespoke parts: gentle through the volume-car range, steep at the hand-built top
  // (≈ 0.9 for a budget car, 1.1 at mid quality, 1.5 for a volume luxury car, 2.3–3.5 for an exotic).
  const cq = 0.75 + 0.5 * s.quality + 2.2 * Math.pow(s.quality, 5);
  // carbon structures: $ per kg of finished tub, falling as lay-up is automated; already a hand-built price, so build quality adds less
  const carbonKg = kf([[1980, 300], [1995, 170], [2010, 100], [2025, 65]], tech.chassis);
  const cChassis = mChassis * { ladder: 2.0, steel: 2.4, spaceframe: 6, aluminium: 9, carbon: carbonKg }[s.chassis] * (s.chassis === 'carbon' ? Math.sqrt(cq) : cq);
  const cPanels = (mPanels * { steel: 3, aluminium: 9, fibreglass: 10, carbon: carbonKg * 0.85 }[s.panels] + 600 * s.size) * cq;
  const cDrive = (isEV ? 900 : { manual: 500 + 90 * nGears, auto: 1100 + 150 * nGears, dct: 2400 + 100 * nGears }[s.gearbox]) + (s.drive === 'AWD' ? 1200 : 0) + (transaxle ? 900 : 0);
  const suspCost = { solid: 200, macpherson: 350, wishbone: 650, multilink: 800 };
  const cRunning = (suspCost[s.suspFront] + suspCost[s.suspRear]) * (1 + 0.5 * s.sport) + { drum: 150, disc: 300, vented: 520, ceramic: 6500 }[s.brakes]
    + 4 * (50 + s.tireWidth * 0.4) * { economy: 1, touring: 1.2, sport: 1.7, semislick: 2.6 }[s.tireCompound] + 4 * (40 + (s.wheelDia - 13) * 22);
  const cInterior = { basic: 600, standard: 1500, premium: 3600, luxury: 7500 }[s.interior] * s.size * (0.6 + s.seats / 12.5) * cq;
  const cSafety = [0, 250, 700, 1300][Math.round(s.safety)] ?? 0;
  const cElec = kf([[1950, 60], [1980, 300], [2000, 800], [2020, 1400]], tech.electronics) * { basic: 0.7, standard: 1, premium: 1.5, luxury: 2.3 }[s.interior];
  const cAero = s.wing * 600 + s.splitter * 250 + (s.flatFloor ? 350 : 0) + s.aeroOpt * 200;
  // ×1.5: supplier margins, warranty provision, inbound logistics and scrap that a pure bill of materials leaves out.
  // A traction battery is bought (or built) close to cost: ×1.15 on that part.
  const battery = eng.batteryCost2020 ?? 0;
  const cPower = 1.5 * (eng.cost2020 - battery) + 1.15 * battery;
  const parts2020 = cPower + 1.5 * (cChassis + cPanels + cDrive * cq + cRunning * cq + cInterior + cSafety + cElec + cAero);
  const nominal = cpi(year) * (ctx.materialIndex ?? 1);
  const costBreakdown: Record<string, number> = {
    Chassis: 1.5 * cChassis * nominal, 'Body & paint': 1.5 * cPanels * nominal, Powertrain: cPower * nominal, Driveline: 1.5 * cDrive * cq * nominal,
    'Running gear': 1.5 * cRunning * cq * nominal, Interior: 1.5 * cInterior * nominal, 'Safety & electronics': 1.5 * (cSafety + cElec) * nominal, Aero: 1.5 * cAero * nominal,
  };
  const labourHours = 18 + mass / 100 + { basic: 4, standard: 8, premium: 16, luxury: 40 }[s.interior]
    + { ladder: 0, steel: 0, spaceframe: 40, aluminium: 10, carbon: 120 }[s.chassis] + (cyl >= 12 ? 10 : 0) + Math.pow(s.quality, 3) * 320
    + (s.panels === 'carbon' ? 30 : s.panels === 'fibreglass' ? 12 : 0);

  // ---- programme cost & duration
  const complexity = 1 + 0.08 * s.safety + (isEV ? 0.25 : 0) + (s.engine.hybridKw > 0 ? 0.2 : 0) + (s.chassis === 'carbon' ? 0.25 : s.chassis === 'aluminium' ? 0.12 : 0)
    + (s.drive === 'AWD' ? 0.06 : 0) + (s.engine.aspiration !== 'na' ? 0.05 : 0) + 0.1 * s.aeroOpt;
  const devEra = kf([[1950, 0.22], [1970, 0.4], [1990, 0.7], [2010, 1.0], [2025, 1.15]], year);
  const devCost = (25e6 + 12e6 * (parts2020 / 10000)) * devEra * (0.7 + 0.8 * s.quality) * complexity * cpi(year);
  const devMonths = Math.round(clamp((16 + 14 * complexity + 10 * s.quality) * lerp(0.8, 1, clamp((year - 1950) / 50, 0, 1)), 12, 60));
  const toolingPerUnitCapacity = parts2020 * 3.2 * cpi(year) * (0.6 + 0.4 * devEra);

  // ---- scores
  const powerKw = eng.powerKw;
  const sAccel = sat(kf(NORM.accel, year) / t100), sTop = sat((top * 3.6) / kf(NORM.top, year), 2), sLat = sat(lateralG / kf(NORM.latG, year), 3), sBrake = sat(kf(NORM.brake, year) / braking100, 3);
  const performance = 0.45 * sAccel + 0.2 * sTop + 0.25 * sLat + 0.1 * sBrake;
  const fuelEquiv = isEV ? eco.combined / 8.9 * 0.42 : eco.combined; // 1 L petrol ≈ 8.9 kWh; EV score reflects running cost
  const economy = sat(kf(NORM.fuel, year) / fuelEquiv, 1.5);
  let comfort = { basic: 25, standard: 45, premium: 68, luxury: 88 }[s.interior] + (1 - s.sport) * 12 - 6
    + ({ solid: -6, macpherson: 0, wishbone: 3, multilink: 5 }[s.suspFront] + { solid: -6, macpherson: 0, wishbone: 3, multilink: 5 }[s.suspRear]) / 2
    + (s.gearbox !== 'manual' || isEV ? 4 : 0) + (d.wheelbase - 2.6) * 10 + (isEV ? 7 : cyl >= 12 ? 9 : cyl >= 8 ? 6 : cyl >= 6 ? 4 : cyl <= 3 ? -4 : 0)
    + s.quality * 8 - Math.max(0, s.wheelDia - 17) * 1.2 - (s.tireCompound === 'semislick' ? 6 : 0)
    - (s.body === 'roadster' ? 6 : s.body === 'supercar' ? 8 : s.body === 'pickup' ? 6 : 0) - s.engine.cam * 6;
  let practicality = (s.seats <= 2 ? 15 : s.seats <= 4 ? 38 : s.seats === 5 ? 52 : 66) + b.cargo * 34 + (s.size - 1) * 30 + (s.drive === 'AWD' && (s.body === 'suv' || s.body === 'pickup') ? 6 : 0)
    - (s.enginePos !== 'front' && !isEV ? 8 : 0) + (isEV && rangeKm < 250 ? -(250 - rangeKm) / 6 : 0);
  let safety = 50 + (s.safety - kf(NORM.safety, year)) * 22 + (mass - 1200) / 100 * 1.5 + { drum: -4, disc: 2, vented: 5, ceramic: 7 }[s.brakes]
    + (tech.electronics - year) * 1.5 + (s.drive === 'AWD' ? 3 : 0) + s.quality * 6 + (s.chassis === 'ladder' ? -5 : s.chassis === 'carbon' ? 5 : 0);
  let reliability = 0.55 * eng.reliability + 0.45 * (62 + s.quality * 30 + (tech.manufacturing - year) * 1.2 - (s.drive === 'AWD' ? 3 : 0)
    - (s.interior === 'luxury' ? 4 : 0) - (s.gearbox === 'dct' ? 3 : 0) - (s.chassis === 'carbon' ? 2 : 0));
  let prestige = { basic: 5, standard: 20, premium: 45, luxury: 70 }[s.interior] + (cyl >= 12 ? 18 : cyl >= 10 ? 14 : cyl >= 8 ? 10 : cyl >= 6 ? 5 : 0)
    + (s.chassis === 'carbon' ? 10 : s.chassis === 'aluminium' ? 4 : 0) + performance * 0.25 + s.quality * 12 + (s.body === 'supercar' ? 8 : s.body === 'coupe' || s.body === 'roadster' ? 3 : 0)
    + (isEV ? 4 : 0);
  const lowEnd = isEV ? 1 : torqueAt(eng, 2000) / eng.torqueNm;
  let drivability = 55 + (lowEnd - 0.7) * 40 - s.engine.cam * 15 - (s.engine.aspiration.includes('turbo') ? s.engine.boost * 8 * (1.5 - clamp((tech.engine - 1960) / 60, 0, 1)) : 0)
    + (s.gearbox !== 'manual' ? 4 : 0) - Math.abs(wf - 0.5) * 30 + (s.safety >= 3 ? 5 : 0) + (isEV ? 8 : 0);
  const scores: Scores = {
    performance: clamp(performance, 0, 100), comfort: clamp(comfort, 0, 100), economy: clamp(economy, 0, 100), reliability: clamp(reliability, 0, 100),
    safety: clamp(safety, 0, 100), practicality: clamp(practicality, 0, 100), prestige: clamp(prestige, 0, 100), drivability: clamp(drivability, 0, 100),
  };

  if (s.enginePos !== 'front' && s.drive === 'FWD' && !isEV) warnings.push('Mid/rear engine cannot drive the front wheels only.');
  if (mu * 1.05 * (s.drive === 'FWD' ? wf : 1 - wf) * G < 3 && powerKw / mass > 0.12) warnings.push('Traction-limited off the line — consider wider tyres or AWD.');
  if (brakeCap * G < mu * brakeEff * G * 0.92) warnings.push('Brakes are the limiting factor under hard stops — upgrade brake type.');

  return {
    engine: eng, length: d.length, width: d.width, height: d.height, wheelbase: d.wheelbase, mass, weightFront: wf, massBreakdown,
    powerKw, torqueNm: eng.torqueNm, powerToWeight: powerKw / (mass / 1000),
    zeroTo100: t100, quarterMile: tQ, topSpeed: top * 3.6, zeroTo200: isNaN(t200) ? null : t200, passing80to120: isNaN(t80) || isNaN(t120) ? null : t120 - t80, braking100, lateralG, cd, frontalArea, cdA, clA,
    downforce200: downforce(55.56) / G, fuelUrban: eco.urban, fuelHighway: eco.highway, fuelCombined: eco.combined, rangeKm,
    partsCost: parts2020 * nominal, costBreakdown, labourHours, devCost, devMonths, toolingPerUnitCapacity, scores, warnings,
  };
}

/** Urban + highway consumption from road-load energy and part-load efficiency. Returns L/100 km (kWh/100 km for EVs). */
function fuelModel(s: VehicleSpec, eng: EngineStats, p: { m: number; cdA: number; crr: number; eta: number; tireR: number; topRatio: number; tech: Tech }) {
  const { m, cdA, crr, eta } = p;
  const roll = crr * m * G;
  const acc = 600; // accessory load, W
  // urban: 32 km/h average, 2.2 stops/km from 50 km/h, 25 % idling
  const vU = 11.1, vPeak = 13.9;
  const inertia = 0.5 * m * vPeak * vPeak * 2.2; // J per km
  const eUrbanWheel = (roll + 0.5 * RHO * cdA * vU * vU) * 1000 + inertia;
  const vH = 30.6; // 110 km/h
  const fH = roll + 0.5 * RHO * cdA * vH * vH;
  if (eng.isEV) {
    const regen = 0.65;
    const urban = ((eUrbanWheel - inertia * regen) / 0.86 + acc * 112) / 3.6e6 * 100;
    const highway = ((fH * 1000) / 0.88 + (acc * 1000) / vH) / 3.6e6 * 100;
    return { urban, highway, combined: 0.55 * urban + 0.45 * highway };
  }
  const e = s.engine;
  const vd = e.displacement / 1e6;
  const stroke = eng.stroke;
  const pumpK = (e.fuelSystem === 'di' ? 0.75 : 1) * (e.vvt ? 0.8 : 1) * 0.7;
  const bmepMax = eng.bmepPeak;
  const etaAt = (pWheel: number, rpm: number) => {
    const pEng = pWheel / eta + acc;
    const bmep = pEng / (vd * (rpm / 120)) / 1e5; // bar
    const load = clamp(bmep / bmepMax, 0.02, 1);
    const sp = (2 * stroke * rpm) / 60;
    const fmep = fmepBar(sp, eng.fmepK);
    const etaInd = eng.etaI * (0.9 + 0.1 * load);
    return { etaB: etaInd * (bmep / (bmep + fmep + pumpK * (1 - load))), pEng };
  };
  const J_PER_L = 32e6;
  // highway
  const rpmH = clamp((vH / p.tireR) * p.topRatio * 9.5493, 1300, e.redline);
  const h = etaAt(fH * vH, rpmH);
  const highway = ((h.pEng / h.etaB) * (1000 / vH)) / J_PER_L * 100;
  // urban: mean tractive power while moving, ~2000 rpm, plus idle fuel
  const hyb = e.hybridKw > 0 ? clamp(e.hybridKw / (m * 0.02), 0, 1) * 0.6 : 0;
  const eU = eUrbanWheel - inertia * hyb;
  const tMove = 1000 / vU * 0.75;
  const u = etaAt(eU / tMove, 2000);
  const startStop = e.hybridKw > 0 || p.tech.engine >= 2009;
  const idleFuelW = (fmepBar((2 * stroke * 800) / 60, eng.fmepK) * 1e5 * vd * (800 / 120)) / 0.25;
  const urban = ((u.pEng / u.etaB) * tMove + (startStop ? 0.15 : 1) * idleFuelW * 28) / J_PER_L * 100;
  return { urban, highway, combined: 0.55 * urban + 0.45 * highway };
}

/**
 * Final drive ratio an engineer would pick for this car: top gear is matched to the speed the car can reach on its
 * power. Boxes with few gears run close to peak power in top; five or more gears make top an overdrive for quiet,
 * economical cruising. Sporty cars keep the gearing shorter.
 */
export function suggestFinalDrive(s: VehicleSpec, ctx: VehicleCtx): number {
  if (s.engine.layout === 'EV') return s.finalDrive;
  const st = computeVehicle(s, ctx);
  const d = dims(s);
  const eta = { FWD: 0.91, RWD: 0.895, AWD: 0.86 }[s.drive];
  const m = st.mass + 75;
  // speed at which peak power equals drag + rolling resistance (bisection)
  let lo = 10, hi = 140;
  for (let i = 0; i < 40; i++) {
    const v = (lo + hi) / 2;
    const need = (0.5 * RHO * st.cdA * v * v + 0.012 * (1 + 0.55 * (v / 55) * (v / 55)) * m * G) * v;
    if (need < st.powerKw * 1000 * eta) lo = v; else hi = v;
  }
  const overdrive = [1.03, 1.03, 1.03, 1.05, 1.12, 1.24, 1.32, 1.45, 1.55, 1.6][clamp(s.gears, 1, 9)];
  const over = lerp(overdrive, Math.max(1.03, overdrive * 0.86), s.sport);
  const ratios = gearRatios(s.gears, false, s.sport);
  const fd = (s.engine.redline * d.tireR) / (9.5493 * ratios[ratios.length - 1] * over * lo);
  return clamp(Math.round(fd * 20) / 20, 2.2, 5.5);
}

// ------------------------------------------------------------------------------------- Defaults

export function defaultEngine(year: number): EngineSpec {
  return {
    layout: 'I4', displacement: year < 1970 ? 1500 : 1800, boreStroke: 1.0,
    valvetrain: year < 1965 ? 'ohv' : year < 1988 ? 'sohc' : 'dohc4',
    aspiration: 'na', boost: 0.6, compression: year < 1960 ? 7.5 : year < 1980 ? 8.8 : year < 2000 ? 9.8 : 11,
    redline: year < 1965 ? 5000 : year < 1990 ? 6000 : 6500, cam: 0.35,
    fuelSystem: year < 1975 ? 'carb' : year < 2005 ? 'efi' : 'di', vvt: year >= 1998, aluBlock: year >= 2000, hybridKw: 0, motorKw: 150, batteryKwh: 60,
  };
}

export function defaultVehicle(year: number, body: BodyType = 'sedan'): VehicleSpec {
  return {
    body, size: 1, chassis: 'steel', panels: 'steel', engine: defaultEngine(year), enginePos: 'front',
    drive: year < 1975 ? 'RWD' : 'FWD', gearbox: 'manual', gears: year < 1964 ? 4 : year < 1990 ? 5 : 6, finalDrive: 3.9,
    suspFront: 'macpherson', suspRear: year < 1975 ? 'solid' : 'macpherson', sport: 0.3,
    brakes: year < 1960 ? 'drum' : year < 1985 ? 'disc' : 'vented', tireWidth: year < 1970 ? 155 : year < 1995 ? 185 : 205,
    tireCompound: 'touring', wheelDia: year < 1975 ? 13 : year < 2000 ? 15 : 17, wing: 0, splitter: 0, aeroOpt: 0.3, flatFloor: false,
    interior: 'standard', seats: BODY[body].seats, safety: year < 1962 ? 0 : year < 1985 ? 1 : year < 2000 ? 2 : 3, quality: 0.5, color: '#b3261e',
  };
}

export const SCORE_KEYS: (keyof Scores)[] = ['performance', 'comfort', 'economy', 'reliability', 'safety', 'practicality', 'prestige', 'drivability'];
export const SEGMENT_HINT: Record<SegmentId, string> = {
  budget: 'Cheap to buy and run', family: 'Space, comfort, dependability', premium: 'Comfort and status', luxury: 'Ultimate comfort and prestige',
  sports: 'Driving fun at an attainable price', supercar: 'Extreme performance and exclusivity', suv: 'Space and versatility', pickup: 'Workhorse utility',
};
