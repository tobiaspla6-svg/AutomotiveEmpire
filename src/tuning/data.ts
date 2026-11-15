// Tuning Empire prototype: fictional vehicles, parts and stages. Names and numbers are invented, in the range of
// 1990s production cars; they are game data, not the specification of any real model.
import type { Part, Stage } from './parts';
import type { Tyre, Vehicle } from './types';

const STREET_195: Tyre = { name: 'Street 195/60 R15', radiusM: 0.29, mu: 0.95, widthMm: 195, wheelInch: 15 };
const STREET_225: Tyre = { name: 'Street 225/45 R16', radiusM: 0.30, mu: 1.0, widthMm: 225, wheelInch: 16 };

/** 2.0-litre turbo four shared by two platforms (so its engine parts fit both). */
const K20T = {
  code: 'K20T', name: '2.0 16V turbo', displacementL: 2.0, aspiration: 'turbo' as const,
  torque: [{ rpm: 1000, nm: 150 }, { rpm: 2000, nm: 215 }, { rpm: 3000, nm: 285 }, { rpm: 3500, nm: 300 }, { rpm: 4500, nm: 300 }, { rpm: 5500, nm: 288 }, { rpm: 6500, nm: 262 }, { rpm: 7200, nm: 225 }],
  idleRpm: 850, revLimit: 7000, mechanicalLimitRpm: 7600, stockBoostBar: 0.8, inertiaKgm2: 0.16, injectorCcMin: 4 * 550,
};

export const VEHICLES: Record<string, Vehicle> = {
  kestrel: {
    id: 'kestrel', name: 'Kestrel GT-T', year: 1994, platform: 'KS', massKg: 1290, frontShare: 0.53, cgHeightM: 0.48, wheelbaseM: 2.47, cdA: 0.62, crr: 0.012,
    engine: K20T,
    drivetrain: { gearboxPattern: 'R5', gears: [3.36, 2.06, 1.42, 1.07, 0.83], finalDrive: 4.1, drive: 'RWD', efficiency: 0.86, shiftTimeS: 0.35, clutchCapNm: 380, diffTraction: 0.88 },
    tyre: STREET_225,
  },
  atlas: {
    id: 'atlas', name: 'Atlas 4WD Turbo', year: 1995, platform: 'AT', massKg: 1420, frontShare: 0.58, cgHeightM: 0.5, wheelbaseM: 2.52, cdA: 0.66, crr: 0.013,
    engine: K20T,
    drivetrain: { gearboxPattern: 'A5', gears: [3.08, 1.88, 1.31, 0.97, 0.76], finalDrive: 4.44, drive: 'AWD', efficiency: 0.8, shiftTimeS: 0.4, clutchCapNm: 400, diffTraction: 0.95 },
    tyre: STREET_225,
  },
  marlin: {
    id: 'marlin', name: 'Marlin 1.8 16V', year: 1992, platform: 'MR', massKg: 1060, frontShare: 0.62, cgHeightM: 0.5, wheelbaseM: 2.45, cdA: 0.6, crr: 0.012,
    engine: {
      code: 'M18N', name: '1.8 16V', displacementL: 1.8, aspiration: 'na',
      torque: [{ rpm: 1000, nm: 120 }, { rpm: 2500, nm: 150 }, { rpm: 4000, nm: 165 }, { rpm: 5000, nm: 172 }, { rpm: 6000, nm: 168 }, { rpm: 7000, nm: 150 }, { rpm: 7600, nm: 128 }],
      idleRpm: 800, revLimit: 7200, mechanicalLimitRpm: 7800, stockBoostBar: 0, inertiaKgm2: 0.12, injectorCcMin: 4 * 280,
    },
    drivetrain: { gearboxPattern: 'F5', gears: [3.42, 1.95, 1.36, 1.03, 0.84], finalDrive: 4.06, drive: 'FWD', efficiency: 0.9, shiftTimeS: 0.3, clutchCapNm: 260, diffTraction: 0.88 },
    tyre: STREET_195,
  },
};

export const PARTS: Record<string, Part> = Object.fromEntries(([
  // ECUs: calibrations are engine-specific
  { id: 'ecu-k20t-flash', category: 'ecu', name: 'K20T ECU reflash', price: 650, fits: { engineCodes: ['K20T'] }, effect: { remappable: true } },
  { id: 'ecu-m18-flash', category: 'ecu', name: 'M18N ECU reflash', price: 450, fits: { engineCodes: ['M18N'] }, effect: { remappable: true } },
  // breathing
  { id: 'intake-k20t', category: 'intake', name: 'K20T cold-air intake', price: 280, fits: { engineCodes: ['K20T'] }, effect: { flowGain: 0.03, flowFromRpm: 5000 } },
  { id: 'exhaust-k20t-3in', category: 'exhaust', name: 'K20T 3" turbo-back exhaust', price: 900, fits: { engineCodes: ['K20T'] }, effect: { flowGain: 0.05, flowFromRpm: 4500 } },
  { id: 'intake-m18', category: 'intake', name: 'M18N intake and airbox', price: 220, fits: { engineCodes: ['M18N'] }, effect: { flowGain: 0.035, flowFromRpm: 5500 } },
  { id: 'exhaust-m18-4-2-1', category: 'exhaust', name: 'M18N 4-2-1 header and exhaust', price: 750, fits: { engineCodes: ['M18N'] }, effect: { flowGain: 0.06, flowFromRpm: 5500 } },
  // forced induction (turbo parts only fit the turbo engine's manifold flange)
  { id: 'turbo-k20t-hybrid', category: 'turbo', name: 'K20T hybrid turbo', price: 1600, fits: { engineCodes: ['K20T'], aspiration: 'turbo' }, effect: { turbo: { maxBoostBar: 1.45, fullBoostRpm: 3900, lagS: 0.6 } } },
  { id: 'turbo-k20t-big', category: 'turbo', name: 'K20T big-frame turbo', price: 2600, fits: { engineCodes: ['K20T'], aspiration: 'turbo' }, effect: { turbo: { maxBoostBar: 2.1, fullBoostRpm: 5200, lagS: 1.1 } } },
  { id: 'intercooler-k20t-fmic', category: 'intercooler', name: 'K20T front-mount intercooler', price: 850, fits: { engineCodes: ['K20T'], aspiration: 'turbo' }, effect: { intercoolerEff: 0.78 } },
  { id: 'injectors-k20t-750', category: 'injectors', name: 'K20T 750 cc injectors', price: 700, fits: { engineCodes: ['K20T'] }, effect: { injectorCcMin: 4 * 750 } },
  { id: 'injectors-k20t-1000', category: 'injectors', name: 'K20T 1000 cc injectors', price: 950, fits: { engineCodes: ['K20T'] }, effect: { injectorCcMin: 4 * 1000 } },
  // driveline
  { id: 'clutch-r5-stage2', category: 'clutch', name: 'R5 stage-2 clutch (520 Nm)', price: 600, fits: { gearboxPatterns: ['R5'] }, effect: { clutchCapNm: 520 } },
  { id: 'clutch-r5-twin', category: 'clutch', name: 'R5 twin-plate clutch (700 Nm)', price: 1300, fits: { gearboxPatterns: ['R5'] }, effect: { clutchCapNm: 700 } },
  { id: 'clutch-a5-stage2', category: 'clutch', name: 'A5 stage-2 clutch (560 Nm)', price: 650, fits: { gearboxPatterns: ['A5'] }, effect: { clutchCapNm: 560 } },
  { id: 'clutch-f5-stage1', category: 'clutch', name: 'F5 stage-1 clutch (320 Nm)', price: 380, fits: { gearboxPatterns: ['F5'] }, effect: { clutchCapNm: 320 } },
  { id: 'gearbox-r5-close', category: 'gearbox', name: 'R5 close-ratio gearset', price: 2200, fits: { gearboxPatterns: ['R5'] }, effect: { gears: [3.06, 2.05, 1.52, 1.19, 0.97], shiftTimeS: 0.3 } },
  { id: 'diff-r-lsd-41', category: 'differential', name: 'Rear LSD, 4.1 final', price: 1100, fits: { drives: ['RWD'] }, effect: { diffTraction: 0.97 } },
  { id: 'diff-r-lsd-439', category: 'differential', name: 'Rear LSD, 4.39 final', price: 1150, fits: { drives: ['RWD'] }, effect: { diffTraction: 0.97, finalDrive: 4.39 } },
  { id: 'diff-f-lsd', category: 'differential', name: 'Front helical LSD', price: 900, fits: { drives: ['FWD'] }, effect: { diffTraction: 0.95 } },
  // tyres (fit the wheel size)
  { id: 'tyres-16-semi', category: 'tyres', name: 'Semi-slick 225/45 R16', price: 720, fits: { wheelInch: [16] }, effect: { tyre: { name: 'Semi-slick 225/45 R16', radiusM: 0.30, mu: 1.25, widthMm: 225, wheelInch: 16 } } },
  { id: 'tyres-16-drag', category: 'tyres', name: 'Drag radial 245/50 R16', price: 900, fits: { wheelInch: [16] }, effect: { tyre: { name: 'Drag radial 245/50 R16', radiusM: 0.317, mu: 1.5, widthMm: 245, wheelInch: 16 } } },
  { id: 'tyres-15-semi', category: 'tyres', name: 'Semi-slick 205/50 R15', price: 560, fits: { wheelInch: [15] }, effect: { tyre: { name: 'Semi-slick 205/50 R15', radiusM: 0.29, mu: 1.25, widthMm: 205, wheelInch: 15 } } },
  // weight
  { id: 'weight-ks-strip', category: 'weight', name: 'Kestrel interior strip and lightweight seats (−65 kg)', price: 400, fits: { platforms: ['KS'] }, effect: { massDeltaKg: -65 } },
  { id: 'weight-mr-strip', category: 'weight', name: 'Marlin interior strip (−45 kg)', price: 300, fits: { platforms: ['MR'] }, effect: { massDeltaKg: -45 } },
] as Part[]).map((p) => [p.id, p]));

/** Stages: curated kits for one engine code, with the calibration they were developed with. */
export const STAGES: Stage[] = [
  { id: 'k20t-stage1', name: 'K20T Stage 1', engineCode: 'K20T', parts: ['ecu-k20t-flash', 'intake-k20t', 'exhaust-k20t-3in'], calibration: { boostBar: 1.0, revLimit: 7000, timingDeg: 1 } },
  { id: 'k20t-stage2', name: 'K20T Stage 2', engineCode: 'K20T', parts: ['ecu-k20t-flash', 'intake-k20t', 'exhaust-k20t-3in', 'intercooler-k20t-fmic', 'turbo-k20t-hybrid', 'injectors-k20t-750'], calibration: { boostBar: 1.35, revLimit: 7200, timingDeg: 1 } },
  { id: 'k20t-stage3', name: 'K20T Stage 3', engineCode: 'K20T', parts: ['ecu-k20t-flash', 'intake-k20t', 'exhaust-k20t-3in', 'intercooler-k20t-fmic', 'turbo-k20t-big', 'injectors-k20t-1000'], calibration: { boostBar: 1.9, revLimit: 7400, timingDeg: 0 } },
  { id: 'm18-stage1', name: 'M18N Stage 1', engineCode: 'M18N', parts: ['ecu-m18-flash', 'intake-m18', 'exhaust-m18-4-2-1'], calibration: { boostBar: 0, revLimit: 7600, timingDeg: 2 } },
];
