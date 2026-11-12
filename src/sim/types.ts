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
  /** optional equipment level 0..1 (trim content); absent = 0 */
  equipment?: number;
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

// ------------------------------------------------------------------- shared engineering (Phase 3)

/** Programme status shared by vehicles, engine families and platforms. */
export type ProgrammeStatus = 'development' | 'ready';
export interface Programme {
  status: ProgrammeStatus;
  devMonthsLeft: number; devMonthsTotal: number; devCostPaid: number; devCostTotal: number;
  /** id of the vehicle programme that pays for this one (bundled development); absent for a stand-alone programme */
  ownerModelId?: string;
}

/**
 * One engine variant of a family: the parameters that change without new hardware architecture.
 * Displacement varies with bore and stroke inside the family's envelope.
 */
export interface EngineVariant {
  id: string; name: string;
  tune: 'economy' | 'standard' | 'performance';
  displacement: number; aspiration: Aspiration; boost: number; compression: number; redline: number; cam: number; vvt: boolean; hybridKw: number;
  motorKw: number; batteryKwh: number; // EV variants
  /** a variant still being calibrated cannot go into production */
  status: ProgrammeStatus; readyIn: number; devCost: number;
  /** set while the variant is developed as part of a vehicle programme */
  ownerModelId?: string;
}
/** A reusable engine architecture: block, cylinder layout, head and fuel system. */
export interface EngineFamily extends Programme {
  id: string; name: string;
  layout: EngineLayout; boreStroke: number; valvetrain: Valvetrain; fuelSystem: FuelSystem; aluBlock: boolean;
  /** displacement the block was designed around; variants may range from 80 % to 125 % of it */
  baseDisplacement: number;
  /** EV: motor power the drive unit was designed around (variants 50–200 %) */
  baseMotorKw: number;
  techYear: number; introYear: number;
  variants: EngineVariant[];
  /** reliability events, newest last: recalls fix the fault, a quiet fix does not */
  history: { y: number; kind: 'recall' | 'quiet' | 'exposed'; units: number }[];
  /** total engines built */
  cumulativeUnits: number;
}
export type EngineBay = 'compact' | 'medium' | 'large';
/** Body-style group a platform can carry. */
export type PlatformClass = 'car' | 'sports' | 'truck';
/** A reusable vehicle architecture: structure, crash structure, suspension pick-up points, engine and drivetrain mounting. */
export interface Platform extends Programme {
  id: string; name: string;
  cls: PlatformClass;
  chassis: ChassisType;
  enginePos: 'front' | 'mid' | 'rear';
  transaxle: boolean;
  drives: ('FWD' | 'RWD' | 'AWD')[];
  bay: EngineBay;
  /** size factor (wheelbase and track scale with it) the platform was designed around, and the range it stretches to */
  baseSize: number; sizeMin: number; sizeMax: number;
  suspFront: SuspType; suspRear: SuspType;
  safety: number;
  techYear: number; introYear: number;
  history: { y: number; kind: 'recall' | 'quiet' | 'exposed'; units: number }[];
  cumulativeUnits: number;
}

export type TrimLevel = 'entry' | 'mid' | 'premium' | 'sport' | 'luxury' | 'performance' | 'limited';
/**
 * A version of a model (Phase 3). It has its own engine variant, gearbox, cabin, wheels, tyres, equipment, price and
 * production mix, its own stock and its own sales. The model's stock, sales and demand are the sums of its trims.
 */
export interface Trim {
  id: string; name: string; level: TrimLevel;
  engineVariantId?: string; gearbox?: Gearbox; gears?: number; interior: InteriorType; wheelDia: number; tireCompound: TireCompound; equipment: number;
  sport?: number; tireWidth?: number;
  price: number;
  /** planned share of the model's production (0..1; trims are normalised) */
  mix: number;
  /** limited edition: total cars that will ever be built */
  cap?: number;
  spec: VehicleSpec; stats: VehicleStats;
  inventory: number; inventoryValue: number; built: number;
  lastSales: Record<RegionId, number>; lastDemand: number; lastUnitCost: number; salesHistory: number[];
  revenue: number; cogs: number;
  /** order book (limited editions): waiting list, allocation policy, personalisation take-up 0..1 */
  orders?: number; allocation?: 'loyal' | 'open'; personal?: number;
}

export interface VehicleModel {
  /** trims (Phase 3); absent or empty = the model is sold as one version */
  trims?: Trim[];
  /** mid-life facelift in progress, and the number completed */
  facelift?: { monthsLeft: number; months: number; cost: number; paid: number } | null; facelifts?: number;
  /** exclusivity (Phase 3): cars a year the company is willing to build, and the order book that forms above it */
  annualCap?: number; orders?: number; allocation?: 'loyal' | 'open'; personal?: number;
  /** regional prices (Phase 3): multiple of the world price, fixed in local currency at exchange index `fx` */
  regional?: Partial<Record<RegionId, { ratio: number; fx: number }>>;
  /** shared engineering (Phase 3); absent on AI cars and on cars from older saves that were not migrated */
  engineFamilyId?: string; engineVariantId?: string; platformId?: string;
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

// ----------------------------------------------------------------------- supply chain & manufacturing (Phase 3)
export type ComponentCategory = 'metals' | 'electronics' | 'semiconductors' | 'batteries' | 'tires' | 'transmissions' | 'seats' | 'glass' | 'interior';
/** A supply contract for one component category. */
export interface Contract {
  supplierId: string;
  /** optional second source taking `secondShare` of the committed volume */
  secondId?: string; secondShare?: number;
  /** car sets a month committed (take-or-pay below 90 %) */
  commitment: number;
  /** price index agreed (market average = 1) */
  priceIndex: number;
  until: number; // last year of the contract
}
export interface SupplyState {
  contracts: Partial<Record<ComponentCategory, Contract>>;
  /** in-house component plants: monthly capacity in car sets */
  inHouse: Partial<Record<ComponentCategory, { capacity: number; capex: number }>>;
  /** supplier id → months of disrupted deliveries left */
  disrupted: Record<string, number>;
  /** component safety stock held, in months of production (0..2), and how much of it is currently on hand */
  safetyStock: number; buffer: number;
  /** last month: share of planned output lost to shortages, extra cost of spot buying, take-or-pay penalties */
  lastLoss: number; lastSpot: number; lastPenalty: number;
}
export type StageId = 'body' | 'paint' | 'powertrain' | 'assembly' | 'inspection';

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
  /** Phase 3: capacity of each production stage (cars a month); absent = every stage equals `capacity` */
  stages?: Record<StageId, number>;
  /** a stage expansion under construction */
  stageWork?: { stage: StageId; add: number; monthsLeft: number } | null;
  /** quality-inspection thoroughness 0..1 (absent = 0.5); output of the last month */
  inspection?: number; lastOutput?: number;
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
  /** Shared engineering (Phase 3). Player companies always have both arrays from save version 3 on. */
  engines?: EngineFamily[]; platforms?: Platform[];
  /** supply chain (Phase 3); absent = buys everything at average market terms */
  supply?: SupplyState;
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
  /** Phase 3 driver market (absent in older saves): potential pace, category specialty, seasons still to adapt to this
   *  category, sponsorship brought per year (pay driver), salary agreed in a contract, member of an academy */
  potential?: number; specialty?: 'single' | 'proto' | 'gt' | 'touring'; adapt?: number; backing?: number; contracted?: number; academy?: boolean;
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
  /** junior driver academy (Phase 3): level 0–3 and its juniors (not on the grid until promoted) */
  academy?: { level: number; juniors: Driver[] };
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
  macro: { fuelPrice: number; materialCost: number; interestBase: number; modifiers: Modifier[]; cycle: number;
    /** Phase 3: exchange-rate index per region (local units per dollar, 1.0 = start); absent = 1 */
    fx?: Partial<Record<RegionId, number>> };
  otherShare: Record<string, number>; // `${region}:${segment}` -> D_other (units/yr at start-year scale, as share of segment volume)
  news: NewsItem[];
  decision: Decision | null;
  schedule: { id: string; year: number; month: number; scale: number }[]; // historical events (possibly shifted in alternative history)
  fired: string[];
  gameOver: { reason: string } | null;
  nextId: number;
  savedAt: number;
}
