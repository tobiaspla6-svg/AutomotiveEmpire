// Shared data model for every game mode. Everything here is plain JSON so that a
// GameState can be written to IndexedDB (or exported to a file) without any custom serialisation.

export type GameMode = 'ceo' | 'founder' | 'motorsport';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type HistoryMode = 'historical' | 'alternative';
export type RegionId = 'NA' | 'EU' | 'JP' | 'CN' | 'LATAM' | 'ROW';
export type SegmentId = 'budget' | 'family' | 'premium' | 'luxury' | 'sports' | 'supercar' | 'suv' | 'pickup';
export type BodyType = 'hatch' | 'sedan' | 'wagon' | 'coupe' | 'roadster' | 'supercar' | 'suv' | 'pickup';
export type EngineLayout = 'I2' | 'I3' | 'I4' | 'I5' | 'I6' | 'V6' | 'V8' | 'V10' | 'V12' | 'F4' | 'F6' | 'F12' | 'EV';
export type Valvetrain = 'ohv' | 'sohc' | 'dohc2' | 'dohc4';
export type Aspiration = 'na' | 'turbo' | 'twinturbo' | 'supercharged';
export type FuelSystem = 'carb' | 'mfi' | 'efi' | 'di';
export type TechArea = 'engine' | 'chassis' | 'aero' | 'electronics' | 'manufacturing';

export interface EngineSpec {
  layout: EngineLayout;
  displacement: number; // cc
  boreStroke: number; // bore / stroke ratio
  valvetrain: Valvetrain;
  aspiration: Aspiration;
  boost: number; // bar (gauge)
  compression: number; // :1
  redline: number; // rpm
  cam: number; // 0 mild .. 1 race
  fuelSystem: FuelSystem;
  vvt: boolean;
  aluBlock: boolean;
  hybridKw: number; // electric assist
  motorKw: number; // EV only
  batteryKwh: number; // EV only
}

export type ChassisType = 'ladder' | 'steel' | 'spaceframe' | 'aluminium' | 'carbon';
export type PanelType = 'steel' | 'aluminium' | 'fibreglass' | 'carbon';
export type SuspType = 'solid' | 'macpherson' | 'wishbone' | 'multilink';
export type BrakeType = 'drum' | 'disc' | 'vented' | 'ceramic';
export type TireCompound = 'economy' | 'touring' | 'sport' | 'semislick';
export type InteriorType = 'basic' | 'standard' | 'premium' | 'luxury';
export type Gearbox = 'manual' | 'auto' | 'dct';

export interface VehicleSpec {
  body: BodyType;
  size: number; // 0.85 .. 1.15
  chassis: ChassisType;
  panels: PanelType;
  engine: EngineSpec;
  enginePos: 'front' | 'mid' | 'rear';
  /** Gearbox mounted at the rear axle of a front-engined car (better weight distribution, dearer driveline). Absent = false. */
  transaxle?: boolean;
  drive: 'FWD' | 'RWD' | 'AWD';
  gearbox: Gearbox;
  gears: number;
  finalDrive: number;
  suspFront: SuspType;
  suspRear: SuspType;
  sport: number; // 0 comfort .. 1 track
  brakes: BrakeType;
  tireWidth: number; // mm
  tireCompound: TireCompound;
  wheelDia: number; // inches
  wing: number; // 0..1
  splitter: number; // 0..1
  aeroOpt: number; // 0..1 drag optimisation effort
  flatFloor: boolean;
  interior: InteriorType;
  seats: number;
  safety: number; // 0..3
  quality: number; // 0..1
  color: string;
}

export interface Tech { engine: number; chassis: number; aero: number; electronics: number; manufacturing: number }

export interface CurvePoint { rpm: number; nm: number; kw: number }
export interface EngineStats {
  /** Battery pack share of cost2020 (electric cars); absent for combustion engines and in older saves. */
  batteryCost2020?: number;
  isEV: boolean;
  powerKw: number; powerRpm: number; torqueNm: number; torqueRpm: number;
  curve: CurvePoint[];
  mass: number; cost2020: number; reliability: number;
  bore: number; stroke: number; pistonSpeed: number; pistonSpeedLimit: number;
  knockMargin: number; etaI: number; bmepPeak: number; specificKwL: number;
  fmepK: number; // friction scale for part-load model
  valveLimitRpm: number;
  warnings: string[];
}

export interface Scores {
  performance: number; comfort: number; economy: number; reliability: number;
  safety: number; practicality: number; prestige: number; drivability: number;
}

export interface VehicleStats {
  engine: EngineStats;
  length: number; width: number; height: number; wheelbase: number;
  mass: number; weightFront: number;
  massBreakdown: Record<string, number>;
  powerKw: number; torqueNm: number; powerToWeight: number; // kW/t
  zeroTo100: number; quarterMile: number; topSpeed: number; // s, s, km/h
  /** 0–200 km/h in seconds (null if the car cannot reach it) and 80–120 km/h under full throttle. Absent in stats computed by older versions. */
  zeroTo200?: number | null; passing80to120?: number | null;
  braking100: number; lateralG: number;
  cd: number; frontalArea: number; cdA: number; clA: number; downforce200: number; // kg at 200 km/h (negative = lift)
  fuelUrban: number; fuelHighway: number; fuelCombined: number; // L/100km (or kWh/100km for EV)
  rangeKm: number;
  partsCost: number; // nominal currency of ctx.year
  costBreakdown: Record<string, number>;
  labourHours: number;
  devCost: number; devMonths: number; toolingPerUnitCapacity: number;
  scores: Scores;
  warnings: string[];
}

export interface VehicleModel {
  id: string;
  name: string;
  spec: VehicleSpec;
  segment: SegmentId;
  status: 'design' | 'development' | 'ready' | 'production' | 'retired';
  devMonthsLeft: number; devMonthsTotal: number; devCostPaid: number; devCostTotal: number;
  frozenTech: Tech; // technology level the car was engineered with
  designYear: number;
  launchYear: number; launchMonth: number; // 0 until first sale
  price: number;
  inventory: number;
  cumulativeUnits: number;
  generation: number;
  stats: VehicleStats;
  historical: boolean; // seeded from the historical catalogue (name/years/layout real; details estimated)
  endYear?: number; // AI: historical end of production
  volumeWeight: number; // AI: relative volume inside the company
  lastSales: Record<RegionId, number>;
  lastDemand: number;
  lastUnitCost: number;
  salesHistory: number[]; // monthly units, most recent last (max 120)
  lifetimeRevenue: number;
  inventoryValue: number; // cost of the cars in stock (inventory asset); released as COGS when sold
  recallRisk: number;
}

export interface FactoryLine { modelId: string; share: number; ramp: number; target: number }
export interface Factory {
  id: string; name: string; country: string; region: RegionId;
  capacity: number; // units / month
  automation: number; // 0..1
  lines: FactoryLine[];
  expansion: { add: number; monthsLeft: number } | null;
  builtYear: number;
  historical: boolean;
  disruption: number; // months of disrupted output remaining
  bookValue: number; // net book value (cost of plant, expansions, automation and tooling less depreciation)
}

export interface MonthLedger {
  y: number; m: number;
  // ---- income statement (accrual basis)
  revenue: number; // car sales net of dealer margin, plus sponsorship and owner funding of a race team
  otherIncome: number; // grants, prize money, fleet clearance sales
  cogs: number; // cost of the cars SOLD this month (released from inventory at average cost)
  factoryFixed: number; wages: number; rd: number; marketing: number;
  dev: number; logistics: number; motorsport: number; interest: number; other: number;
  oneOff: number; // one-off expenses: hiring/severance, settlements, recalls, inventory write-offs
  depreciation: number; // non-cash: wear of plants, tooling, dealer networks, racing facilities, goodwill
  assetGains: number; // non-cash part of asset sales (proceeds − book value) and bargain purchases; may be negative
  tax: number; profit: number;
  // ---- production and investment
  production: number; // cost of cars BUILT this month (added to inventory, paid in cash)
  capex: number; // cash invested in plants, tooling, dealers, facilities, acquisitions
  units: number;
  // ---- cash-flow statement (operating is derived indirectly from profit, see accounts.ts)
  operatingCash: number; investingCash: number; financingCash: number;
  // ---- balance sheet at month end (and cash at the start of the month)
  cashStart: number; cash: number; debt: number; inventoryValue: number; fixedAssets: number; equity: number;
}

/** Cash movements made between monthly ticks (player actions, events); merged into the next ledger. */
export interface Pending {
  dev: number; motorsport: number; oneOff: number; // cash expenses
  income: number; // cash income
  writeOff: number; // non-cash expense (inventory written off; value already removed from stock)
  capex: number; proceeds: number; acquiredCash: number; // investing cash flows
  assetGain: number; // non-cash gain/loss
  borrow: number; repay: number; // financing cash flows
}
export interface Books {
  otherAssets: number; // book value of dealer networks, racing facilities and acquisition goodwill
  pending: Pending;
  close: { cash: number; debt: number; inventoryValue: number; fixedAssets: number }; // balances at the last month end
}

export interface Objective {
  id: string; kind: 'profit' | 'volume' | 'prestige' | 'reliability' | 'debt' | 'motorsport' | 'share' | 'title' | 'position';
  text: string; target: number; byYear: number; progress: number; done: boolean; failed: boolean;
}

export interface Company {
  id: string; name: string; country: string; homeRegion: RegionId; color: string; color2: string;
  founded: number; isPlayer: boolean; dataId: string | null;
  cash: number; debt: number; interestRate: number;
  reach: Record<RegionId, number>; // distribution capability, units / year
  awareness: Record<RegionId, number>; // 0..100
  prestige: number; reliabilityRep: number; sportiness: number;
  factories: Factory[]; models: VehicleModel[];
  tech: Tech;
  rdBudget: Record<TechArea, number>; // per month
  engineers: number;
  marketingBudget: number; // per month
  ledger: MonthLedger[];
  motorsport: MotorsportDivision | null;
  board: { confidence: number; objectives: Objective[]; note: string } | null;
  alive: boolean;
  specialization: string;
  baseVolume: number; // AI: historical annual volume anchor
  taxAccrued: number;
  ytdProfit: number;
  msGlow: number; // decaying brand halo from motorsport results
  autoPrice: boolean; // index list prices to inflation every January
  /** AI only: months left of a cost-cutting programme / of crisis price cuts (absent = none; older saves have neither). */
  aiCostCut?: number; aiPriceCut?: number;
  /** Player: months left of a restructuring programme (lower overheads and plant fixed costs). Absent = none. */
  restructuring?: number;
  aiFactor: number; // AI: drift of distribution strength relative to the historical baseline
  troubleMonths: number; // consecutive months beyond the credit limit
  books: Books;
}

export interface Modifier {
  id: string; label: string; monthsLeft: number;
  demand?: Partial<Record<RegionId, number>>; // multiplier
  demandAll?: number;
  segment?: Partial<Record<SegmentId, number>>;
  fuelPrice?: number; // multiplier
  materialCost?: number; // multiplier
  interest?: number; // additive (annual, e.g. 0.03)
  production?: Partial<Record<RegionId, number>>; // multiplier on factories in region
  productionAll?: number;
  motorsportCost?: number;
  evDemand?: number;
  importPenalty?: Partial<Record<RegionId, number>>; // demand multiplier for cars not built in the region
}

export interface NewsItem { y: number; m: number; title: string; body: string; kind: 'historical' | 'world' | 'company' | 'motorsport' | 'market' | 'finance'; tag?: string }

export interface DecisionOption { label: string; detail: string; effect: string }
export interface Decision { id: string; title: string; body: string; options: DecisionOption[]; data?: Record<string, number | string> }

// ---------------------------------------------------------------- Motorsport

export type Discipline = 'f1' | 'hypercar' | 'lmdh' | 'gt' | 'touring';

export interface Driver {
  id: string; name: string; nat: string; age: number;
  pace: number; consistency: number; racecraft: number; wet: number; tyre: number;
  salary: number; contractEnd: number; teamId: string | null;
  wins: number; titles: number;
}

export interface RaceCarSpec {
  engine: EngineSpec;
  aeroBias: number; // 0 low drag .. 1 high downforce design philosophy
  weightEffort: number; // 0..1 spend to reach min weight
  cooling: number; // 0 tight (fast, fragile) .. 1 generous
  stiffness: number; // 0 soft (mech. grip, kind to tyres) .. 1 stiff (aero platform)
  color: string; color2: string;
}

export interface DevLevels { aero: number; engine: number; chassis: number; reliability: number }

export interface RaceTeam {
  id: string; name: string; companyId: string | null; isPlayer: boolean;
  color: string; color2: string;
  tier: number; // 0..1 resource level
  ruleset: Discipline;
  car: RaceCarSpec; dev: DevLevels;
  drivers: string[];
  pitCrew: number; strategy: number;
}

export interface Round { trackId: string; name: string; month: number; hours: number; laps: number; done: boolean; pointsScale: number }

export interface CarResult {
  teamId: string; carIdx: number; driverId: string; pos: number; grid: number; laps: number; time: number;
  status: 'finished' | 'dnf'; reason: string; bestLap: number; stops: number; points: number;
}
export interface RoundResult { round: number; trackId: string; name: string; results: CarResult[]; fastest: string; weather: string }
export interface SeasonSummary { year: number; discipline: Discipline; driverChampion: string; teamChampion: string; playerTeamPos: number; playerPoints: number }

export interface Championship {
  discipline: Discipline; year: number; name: string;
  rounds: Round[]; nextRound: number;
  teams: RaceTeam[]; drivers: Driver[];
  driverPoints: Record<string, number>; teamPoints: Record<string, number>;
  results: RoundResult[];
}

export interface MotorsportDivision {
  discipline: Discipline; teamId: string; teamName: string; founded: number;
  championship: Championship;
  facilities: { windTunnel: number; simulator: number; workshop: number; engineShop: number };
  staff: { technical: number; aero: number; raceOps: number; strategy: number };
  devBudget: number; // per month
  devFocus: DevLevels; // weights
  ownerGrant: number; // per year (motorsport mode: owner/parent funding)
  /** Team size relative to a typical entrant of its category (Privateer 0.55 … Front-runner 1.35). Absent in saves before Phase 2. */
  scale?: number;
  /** Funding the owners have agreed per year; `ownerGrant` is what they actually pay this season. Absent in older saves. */
  ownerBase?: number;
  sponsors: { name: string; annual: number }[];
  history: SeasonSummary[];
  seasonIncome: number; seasonCost: number;
  carDesignedYear: number;
  objective: Objective | null;
}

export interface GameState {
  version: number;
  id: string; name: string;
  mode: GameMode; difficulty: Difficulty; historyMode: HistoryMode;
  year: number; month: number; // month 1..12
  startYear: number;
  rng: { s: number };
  playerId: string;
  companies: Company[];
  macro: { fuelPrice: number; materialCost: number; interestBase: number; modifiers: Modifier[]; cycle: number };
  otherShare: Record<string, number>; // `${region}:${segment}` -> D_other (units/yr at start-year scale, as share of segment volume)
  news: NewsItem[];
  decision: Decision | null;
  schedule: { id: string; year: number; month: number; scale: number }[]; // historical events (possibly shifted in alternative history)
  fired: string[];
  gameOver: { reason: string } | null;
  nextId: number;
  savedAt: number;
}
