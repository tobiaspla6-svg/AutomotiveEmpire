// Tuning Empire prototype (Phase 6): data contracts. Independent of React and of Automotive Empire's simulation.
// Units are SI unless the name says otherwise (Nm, kg, m, s, bar gauge, kW).

export interface TorquePoint { rpm: number; nm: number }

export type Aspiration = 'na' | 'turbo';
export type Drive = 'FWD' | 'RWD' | 'AWD';

export interface EngineSpec {
  /** engine code: compatibility of engine parts is decided by it (flanges, ECU, injector bosses) */
  code: string;
  name: string;
  displacementL: number;
  aspiration: Aspiration;
  /** stock full-load torque curve (at stock boost for a turbo engine), measured points, rpm ascending */
  torque: TorquePoint[];
  idleRpm: number;
  /** stock rev limit and the valvetrain's mechanical limit (a calibration can raise the first, never above the second) */
  revLimit: number;
  mechanicalLimitRpm: number;
  /** stock boost (bar gauge) for a turbo engine; 0 for NA */
  stockBoostBar: number;
  /** rotating inertia of crank, flywheel and clutch (kg·m²) */
  inertiaKgm2: number;
  /** stock injector capacity, total for all cylinders (cc/min) */
  injectorCcMin: number;
}

export interface Drivetrain {
  /** gearbox family: gearboxes with the same pattern bolt on */
  gearboxPattern: string;
  gears: number[];
  finalDrive: number;
  drive: Drive;
  /** mechanical efficiency engine → wheels (0–1) */
  efficiency: number;
  shiftTimeS: number;
  /** clutch torque capacity (Nm); above it the clutch slips */
  clutchCapNm: number;
  /** limited-slip differential: share of the axle's grip usable at launch (open ≈ 0.88, LSD ≈ 0.97) */
  diffTraction: number;
}

export interface Tyre { name: string; radiusM: number; /** peak longitudinal friction coefficient on a prepared strip */ mu: number; widthMm: number; wheelInch: number }

export interface Vehicle {
  id: string;
  name: string;
  year: number;
  /** platform code: body parts and weight-reduction kits fit by platform */
  platform: string;
  massKg: number;
  /** static share of the mass on the front axle (0–1) */
  frontShare: number;
  cgHeightM: number;
  wheelbaseM: number;
  /** drag coefficient × frontal area (m²) */
  cdA: number;
  /** rolling resistance coefficient */
  crr: number;
  engine: EngineSpec;
  drivetrain: Drivetrain;
  tyre: Tyre;
}

/** Engine calibration (the ECU map), always bounded by the hardware installed. */
export interface Calibration {
  /** target boost (bar gauge); ignored on an NA engine */
  boostBar: number;
  revLimit: number;
  /** launch rpm held by the clutch before the start */
  launchRpm: number;
  /** shift point (rpm); the simulation never shifts above the rev limit */
  shiftRpm: number;
  /** ignition advance relative to stock (degrees); more advance gains a little torque, bounded by fuel and boost */
  timingDeg: number;
}

export interface Environment { airDensity: number; /** 1.0 = prepared drag strip; a street surface is lower */ surfaceGrip: number }
export const STANDARD_ENV: Environment = { airDensity: 1.2, surfaceGrip: 1 };
