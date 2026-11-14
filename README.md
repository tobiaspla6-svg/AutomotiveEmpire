# Automotive Empire

An automotive CEO, engineering and motorsport simulation that runs entirely in the browser.
Three modes share one simulated world from 1950 to 2026:

1. **Historical Automotive CEO** – run one of 18 real manufacturers from any year of its history.
2. **Automotive Company Founder** – found a new marque and engineer its first car from scratch.
3. **Professional Motorsport Director** – run a Grand Prix, Hypercar, LMDh, GT or touring-car team.

No backend, no account, no paid engine or API. Static files only.

> Unofficial. Manufacturer names are used descriptively for historical context. No logos,
> liveries or licensed assets are included. Circuits, drivers, sponsors and independent teams
> are fictional. Historical facts and estimated game data are labelled separately in the UI
> (`historical` / `approx.` / `estimate`) and in the data files.

## Run it locally

Requires **Node.js 22.12 or newer** (Vite 8 and Vitest 5 need it).

```bash
npm ci
```

```bash
npm run dev        # development server on http://localhost:5173
```

```bash
npm run build      # type-check, then write the static site to dist/
npm run preview    # serve dist/ on http://localhost:4173
```

## Tests

```bash
npm test           # the full automated suite (about 2 minutes)
npm run ci         # what CI runs: type-check, tests, production build
npm run test:e2e   # browser tests on the production build (needs Playwright with Chromium)
```

The interface (design system, English/Spanish, graphics on different hardware, onboarding, browser tests) is
described in [docs/interface.md](docs/interface.md).

The suite (`tests/`, Vitest, Node environment) exercises the simulation core headlessly; the
persistence tests run the real IndexedDB save layer against `fake-indexeddb`.

| File | What it proves |
|---|---|
| `engineering.test.ts` | Calibration against reference cars; design changes move results the right way; physical bounds (power at top speed, tyre-limited braking, Otto-cycle efficiency) on 150 random designs |
| `calibration.test.ts` | 83 real cars (affordable cars, saloons, SUVs/pickups, sports cars, supercars, hypercars, EVs; 1950s–2020s) built from the catalogue against published power, mass, 0–100 km/h and top speed; error and bias per class; plausibility of all 595 catalogue cars; each mechanism (weight distribution, traction, launch control, tyres, gearing, drag, mass, EV drive) in isolation |
| `pricing.test.ts` | List prices of 33 real cars; limited-series premiums; market ranking; margin ordering Ferrari > Lamborghini > Porsche > Toyota > Ford cars; badge value; demand falls with price and collapses above a car's worth; forecast vs market agreement; scarcity rules; break-even and contribution identities |
| `motorsport-finance.test.ts`, `motorsport-careers-*.test.ts` | 20–22-season careers in F1, hypercar, GT and touring from 1986–2005: large teams stay strong without hoarding cash, privateers survive (also redesigning every year); budget identities, break-even funding, sponsor ceiling, owner reserve and rescue rules, redesign cost by team size, prize money, pre-Phase-2 saves |
| `consequences.test.ts` | Cheap reliable car pays back; over-engineered supercar is flagged non-viable; over-expansion on credit leads to a cash crisis; a shared-engine defect hits exactly the models that use it; recall vs cover-up; restructuring; recovery by cutting overheads; competitor identities, price-war following and crisis reactions; starting-year positions |
| `forecast.test.ts` | Decision impact estimates are read-only, reproducible and equal to what happens when the decision is taken |
| `families.test.ts` | Engine families and platforms: variants inside the displacement envelope, bay and body compatibility, shared development and tooling cost less than stand-alone, shared volume lowers unit cost, maturity, a family defect reaches every user, cancelled owners hand architecture to heirs |
| `trims.test.ts` | Trim presets, per-trim cost/price/contribution, mix and caps, model figures equal the sum of trims, facelifts, new generations inherit trims |
| `supply.test.ts` | Supplier quotes, contracts, take-or-pay, second sources, disruptions and safety stock, spot buying, in-house parts, stage bottlenecks limit plant output, inspection and defect hazard |
| `orders.test.ts` | Production caps build order books, cancellations by allocation policy, personalisation margin, list / willingness / collector prices, F80 and series sports-car price bands |
| `drivers.test.ts` | Driver development and decline, category adaptation, asking salaries and refusals, buy-outs, AI transfer window, summer scouting, academy, privately funded teams can recruit competitive drivers |
| `regional.test.ts` | Regional prices in local currency move with exchange rates, demand per region, revenue per region equals the books, FX does not consume random numbers, games without regional prices are unchanged |
| `render-assets.test.ts` | Render descriptor and cosmetic fields (no effect on cost or engineering); every catalogued GLB exists and contains its declared components, wheel mounts and material slots; arch-preserving stretch, wheels on the drawn axles and inside the arches; clamping notes; engine/aero/trim → components and materials; procedural fallbacks for other bodies, mid engines and older eras; failed downloads retried; every car in a 2024 world gets a valid plan; cosmetic choices survive save/load; pre-Phase-4 saves render with trim defaults |
| `render-instance.test.ts` | Building a car with Three.js (no WebGL): stretched geometry, wheel placement and mirroring, component visibility, per-car materials restyled in place without touching the shared template, disposal, tyre dimensions, transmissive glass only on High, paint flake per finish |
| `phase3-integration.test.ts` | Every Phase 3 system together for a year with balanced books; save/load and file export continue identically; v2 → v3 save migration; render descriptor |
| `development.test.ts` | A vehicle programme costs exactly its approved budget, all of it in the P&L, whatever the staffing; concurrent, new-generation, cancelled and old-save programmes |
| `accounting.test.ts` | Every month: Δequity = profit and Δcash = operating + investing + financing; inventory roll-forward; unsold cars stay in stock; stock clearance, plant sales, acquisitions; v1 → v2 save migration |
| `manufacturing.test.ts` | Line ramp-up and capacity ceiling; sales bounded by demand and stock; unit cost vs volume, automation and wages; construction and expansion timing |
| `market.test.ts` | Demand conservation: every unit of segment demand goes to a modelled car or to "other" |
| `startup.test.ts`, `years.test.ts` | All three modes start for every manufacturer and discipline, including 2025 and 2026; catalogue consistency; 2023–2026 line-ups and grids |
| `persistence.test.ts` | IndexedDB save → load returns the same game, and play continues identically |
| `racing.test.ts` | Race determinism (cloned state; watched vs instant clock); consistent classification; lap-time physics on every circuit |
| `championship.test.ts` | Points tables for every Grand Prix season 1950–2026, fastest-lap rule by year, endurance double points, standings equal to the sum of race results |
| `robustness.test.ts` | Invalid prices and non-finite amounts are rejected; run-out stock keeps selling; the race briefing is read-only |
| `longrun.test.ts` | 35 years of CEO play, 25 years of Founder play and 20–25 racing seasons with yearly invariant checks |

Development scripts (not part of the suite): `npx tsx scripts/benchmarks.ts [class]` prints the
benchmark table (game vs real for every reference car, error by class);
`npx tsx scripts/motorsport-finance.ts [--verbose]` plays 22-season careers and prints cash, debt
and positions; `npm run sim:test` prints the lap-time calibration table; `npx tsx scripts/playtest.ts`
and `npx tsx scripts/longrun.ts` play the modes in the terminal and print summaries.

## Continuous integration and GitHub Pages

`.github/workflows/ci.yml` runs on every push and pull request:

1. **verify** – `npm ci`, type-check, `npm test`, `vite build`;
2. **deploy** (pushes to `main` only, after verify) – publishes `dist/` to GitHub Pages.

**One-time setting:** GitHub Pages must be enabled with GitHub Actions as its source:
repository **Settings → Pages → Build and deployment → Source: GitHub Actions**. Until then the
deploy job stops at "Check that Pages is enabled" with *Get Pages site failed*. The first failed
deployment of this repository (`deploy-pages`: *Failed to create deployment (status: 404)*) had
exactly this cause; the build itself succeeded. A workflow token cannot change this setting.

Once enabled, the site is served at `https://<owner>.github.io/<repository>/`.

## Deploy to other static hosts

`vite.config.ts` uses `base: './'`, so `dist/` works from a domain root, a sub-path or a zip.

**Cloudflare Pages** – connect the repository with build command `npm run build` and output
directory `dist`, or upload directly:

```bash
npm run build
```

```bash
npx wrangler pages deploy dist --project-name automotive-empire
```

**Anything else** (Netlify, S3, nginx, itch.io): upload the contents of `dist/`.

## Technology

| Layer | What is used |
|---|---|
| UI | React 19 + TypeScript, plain CSS |
| 3D | Three.js via React Three Fiber and drei |
| Simulation | Custom TypeScript engines (`src/sim`), no dependencies, runnable headless |
| State | zustand (UI state only; the game state is a plain JSON object) |
| Saves | IndexedDB (`src/store/saves.ts`) + export / import as a JSON file or clipboard text |
| Tests | Vitest + fake-indexeddb |
| Build | Vite |

All dependencies are MIT-licensed open source.

**Not integrated (stated plainly):**

- **Rapier** is *not* used. Vehicle performance and racing run on the custom deterministic models
  described below; nothing in the current game needs rigid-body collision physics.
- **Supabase / cloud saves / accounts** are *not* implemented. `SaveBackend` in
  `src/store/saves.ts` is the interface a cloud backend would implement.

## Project layout

```
src/
  sim/                 simulation engines (no React, no DOM)
    engineering.ts     engine, vehicle dynamics, fuel, cost, ratings
    market.ts          segments, regions, demand and market share
    company.ts         factories, unit cost, research, the player's monthly tick
    accounts.ts        bookkeeping: postings, inventory, fixed assets, cash flow, balance sheet
    ai.ts              builds every historical manufacturer and runs the AI competitors
    events.ts          historical events (real dates) and procedural events / decisions
    world.ts           game creation for the three modes, monthly and yearly world tick
    actions.ts         every player action (validated, returns an error string or null)
    migrate.ts         save format versions and upgrades
    families.ts        engine families, variants, platforms, shared development and maturity
    trims.ts           trims, production mix, facelifts
    supply.ts          supplier contracts, disruptions, in-house parts, production stages
    orders.ts          production caps, order books, personalisation, price levels
    regional.ts        regional prices, purchasing power, taxes, exchange rates
    render.ts          render descriptor for graphics pipelines
    racing/            circuits, regulations, race cars, lap simulation, race, championships, driver market
    render.ts          render descriptor: the only data the 3D layer reads
  data/                manufacturers, technologies, world/market reference data, suppliers
  store/               zustand store and IndexedDB saves
  three/               studio viewer, procedural car generator, race scene, 2D track map
    assets/            asset catalogue, descriptor → visual adapter, GLB loader, car instances, tyre, materials
  ui/                  screens
tests/                 automated test suite
tools/blender/sedan/   Blender build of the reference sedan (python, headless)
assets-src/            Blender source scenes and baked textures
public/assets/         GLB vehicle assets; public/draco: Draco decoder (no CDN)
docs/                  asset pipeline, licences, reference-image workflow, Phase 4 screenshots
scripts/               calibration and soak scripts for development
```

## How the simulation works

### Vehicle engineering (`src/sim/engineering.ts`)

- **Engine** – mean-effective-pressure model: air charge from volumetric efficiency and boost,
  indicated efficiency from the Otto cycle with a real-cycle factor, knock limit, friction from
  mean piston speed, `T = BMEP·Vd / 4π`. Electric motors use a constant-torque / constant-power
  curve with era-dependent battery mass and cost.
- **Mass** – component build-up. **Acceleration** – time-step integration with gears, shifts,
  traction limit and weight transfer, drag and rolling resistance. **Braking / cornering** – tyre
  friction with load sensitivity and downforce. **Fuel** – road-load energy over urban and
  highway cycles divided by part-load efficiency.
- **Cost** – bill of materials, labour hours, programme budget and duration, line tooling.
- **Ratings** – eight 0–100 scores relative to the standards of the current year.

These are documented approximations, not CFD or FEA. Against 83 reference cars the mean absolute
error of 0–100 km/h is 5–10 % per class (13 % for SUVs and pickups), of power 5–9 %, of mass 5–8 %
and of top speed 3–5 % (`npx tsx scripts/benchmarks.ts`, `tests/calibration.test.ts`). The
acceleration model includes static weight distribution by layout (with an optional rear
transaxle), weight transfer, tyre compound and width with load sensitivity, the share of grip that
can be used at launch (open differential → traction control → launch control, by electronics
level), torque-converter multiplication, close-ratio sport gearboxes, change-up at the best point,
shift times, flywheel inertia, drivetrain losses, speed-dependent rolling resistance, cooling and
tyre drag, and for EVs a constant-torque/constant-power motor with a wheel-matched reduction and a
rotor speed limit.

### Prices and manufacturer strategies (`src/sim/market.ts`, `src/sim/pricing.ts`, `src/data/strategy.ts`)

- **Value price**: what buyers of a segment consider a fair price for a particular car from a
  particular brand — the segment reference price × the car's quality for that segment × the brand's
  pricing power × its reliability reputation × a scarcity premium (only for prestige segments and
  desirable badges, growing as supply shrinks).
- **Demand** responds to the asked price ÷ value price with the segment's elasticity and falls away
  steeply above value, so no segment rewards endless price rises.
- **Design studio**: unit cost at a planned volume, development and tooling per car over the
  model's planned life, break-even price, value to buyers, recommended retail price (most
  contribution at the planned volume, never below the company's minimum margin), contribution
  margin and expected demand — all labelled as estimates. The model card compares the current
  price with the recommended one.
- **Strategies**: every manufacturer has a profile (price position by segment, minimum margin, how
  readily it follows a price cut, research and marketing intensity, research focus, renewal
  cadence, what it does after a loss-making year). Ferrari prices above value, restrains volume and
  never discounts; Porsche earns ~20 % margins; Toyota prices just below value on the lowest cost;
  Ford prices cars sharply and trucks richly; Hyundai undercuts and follows every price cut.
- **Competitors react**: quarterly price following when rivals undercut and sales fall; January
  model-year repricing (gradual, never downward for makers that hold prices); earlier renewals when
  a newer player car takes share; cost-cutting or price cuts after a loss-making year.

### Engine families and vehicle platforms (`src/sim/families.ts`)

- An **engine family** is a block (layout, valvetrain, fuel, bore/stroke ratio) with a displacement
  envelope (0.8–1.25× the base) and **variants**: displacement, NA/turbo, tune (performance or
  economy) and, when the era allows, hybrid assistance. A **platform** is a chassis architecture
  (class, wheelbase and track range, suspension mounting points, engine bay and position, drive
  layouts, structure, safety architecture) shared by compatible bodies (cars: hatch, saloon, wagon,
  coupé, SUV; sports: coupé, roadster, supercar; trucks: pickup, SUV).
- A vehicle programme's budget splits into engine (30 %), platform (35 %) and the car itself (35 %).
  Reusing a ready family or platform removes that share (a new variant costs 6–30 % of it); tooling
  for a shared engine or platform is cheaper too, and parts cost falls with the volume of every
  model that shares them. Families and platforms can also be developed on their own (×1.08).
- **Maturity**: reliability grows with years in service and with lessons from recalls; a defect in
  a family or platform affects every model built on it, so sharing is also a common risk.
- The design studio shows compatibility (what does not fit and why), the cost split, the saving
  from reuse and the risk; the Architecture tab lists families, variants, platforms and their users.

### Trims, facelifts and generations (`src/sim/trims.ts`)

- A model can have several **trims** (entry, mid, premium, sport, luxury, high-performance,
  limited edition), each with its own engine variant, gearbox, cabin, wheels, equipment, price,
  production share and optional cap. Buyers choose between them as separate market entries; the
  model's figures are the sums of its trims, and each trim reports its own sales and contribution.
- A **facelift** (about a quarter of the car's engineering budget, 8 months) refreshes the car
  after three years; a new generation inherits the trims of the car it replaces.

### Supply chain and production stages (`src/sim/supply.ts`, `src/data/suppliers.ts`)

- Nine component categories (metals, electronics, semiconductors, batteries, tyres, transmissions,
  seats, glass, interior). Without a contract parts are bought at market terms. A contract with one
  of 32 fictional suppliers sets a price from the supplier's list price, the commitment and the
  term, with its quality (which moves reliability) and delivery reliability; output below 90 % of
  the commitment pays take-or-pay. A second source halves the exposure to one supplier.
- **Disruptions** take most of a supplier's deliveries for a few months; a component safety stock
  (held at 1.5 % a month) and spot buying (up to 20 %, at +25 %) soften them; lost output is news.
- **In-house** component plants remove the supplier margin for an investment and running costs.
- Each plant has five **stages** (body/stamping and welding, paint, powertrain, final assembly,
  inspection); the smallest limits the plant's output and can be expanded on its own. A more
  thorough inspection costs labour on every car and lets fewer defects reach customers.

### Exclusivity, order books and rarity (`src/sim/orders.ts`)

- A yearly production cap (or a capped limited-edition trim) turns unmet demand into a **waiting
  list**: buyers wait, some cancel (fewer when cars are allocated to loyal customers), and the queue
  supports the badge. A personalisation programme earns up to a quarter more per car from buyers of
  a desirable badge at 8 % extra cost.
- The order book shows three prices: the list price, what buyers would pay given how many cars
  exist, and the collector value of a car in a queue that cannot be served.
- The scarcity premium grows with the era (collector demand for very small series is far stronger
  today than in the 1980s). This lifts a 799-car hypercar such as the F80 to about $3.5M in 2026
  (real ≈ $3.9M), while series sports cars keep their prices (911, Mustang, Corvette unchanged).

### Regional pricing (`src/sim/regional.ts`)

- The books stay in US dollars. A car sells at its world price unless the player sets a price for
  a region; that price is fixed in local currency, so its dollar value moves with the region's
  exchange rate. Regional demand compares the price buyers see (plus tariffs) with what the car is
  worth to them there (purchasing power, sales and registration taxes). Revenue is booked per
  region at the dollar value of that month.
- Exchange rates are a generated mean-reverting index driven by a hash of the date, so they do not
  change the game's random sequence; games without regional prices behave exactly as before.

### Consequences

- **Engine families**: models built on the same engine family (or, for AI makers and old saves, with
  the same layout, aspiration and similar displacement) share an engine; platforms share defects in
  the same way. Defects surface where the hazard is highest (cars built × weak engine
  reliability × new design) and affect every model in the family: an open recall costs money and a
  little trust; an exposed cover-up hits all those models' demand and the brand's reputation.
- **Restructuring**: half a year of savings up front, then lower overheads and plant fixed costs for
  three years.
- **Impact estimates** (`src/sim/forecast.ts`): plants, expansions, automation, dealers, loans and
  hiring show what they cost now, their monthly effect, before → after (debt, credit headroom,
  monthly profit) and the main risks. The estimate plays the decision forward on a copy of the game
  against not taking it — one possible future, not a guarantee.

### Company accounting (`src/sim/accounts.ts`)

- Cars built are paid for in cash and held as **inventory** at cost; the **cost of sales** is
  released at the average cost of stock when cars are sold.
- **Fixed assets**: plants (purchase, expansions, automation, tooling) carry a book value;
  dealer networks, racing facilities and acquisition goodwill form a second pool. Both
  depreciate monthly (5 % and 10 % a year).
- **Vehicle programmes** spend their approved budget in proportion to the work done each month.
- Anything that happens between monthly ticks (player actions, event settlements, grants, prize
  money) is posted once through `accounts.ts` and merged into the next month's ledger.
- Every month records an income statement, a cash-flow statement (operating cash derived
  indirectly from profit) and a balance sheet. The Finance screen shows all three.

### Market, AI competitors and world

- Six regions × eight segments with approximate historical volumes; demand per model follows a
  share-of-appeal model weighted by dealer reach. Manufacturers that are not simulated form an
  aggregate "other" competitor.
- Every AI manufacturer is a full company built from the same engineering model. They launch
  their real models in the real years and open their real plants on time; in alternative
  history their fortunes drift.
- 28 dated historical events plus procedural events and decisions. Money is nominal USD scaled
  by a US CPI index.

### Racing

- Circuits are original rounded-polygon layouts; the same centre line feeds the lap simulation,
  the race and the 3D/2D views.
- Lap time from a point-mass quasi-steady-state simulation with downforce and a friction circle.
- Race: fixed 0.5 s steps from a seeded RNG, with fuel, tyres, weather, traffic, overtaking,
  pit strategy, failures, accidents and a virtual safety car. Same seed and inputs → same race.
  The 3D view only reads the simulation state.
- **Team finances** (`seasonBudget` in `racing/season.ts`): people, facilities upkeep, car build and
  parts, travel, drivers and development, scaled by team size (privateer … front-runner), staff and
  facilities. Owners fund a reference team of that size to break even at its target position;
  sponsorship converges each season towards a ceiling set by results and team size; every entrant
  gets a base prize plus a steeply rising share by position. Owners reduce funding while a team
  sits on more than about a third of a season's cost in cash, and cover part of a deficit while
  their confidence lasts. A redesign costs a small team less than a works team. The motorsport
  screen shows the season's budget, expected balance and the development budget the team can
  afford.
- **Driver market** (`racing/drivers.ts`): drivers have a potential, develop until their mid-twenties
  and decline from 33; they belong to a category (single-seaters, prototypes, GT, touring) and need
  up to two seasons to adapt to another. A driver asks a salary from their rating and age, discounted
  by an attractive team and raised by competing interest from stronger teams; offers below the ask
  are refused, contracted drivers can be bought out. AI teams sign clearly better free agents every
  January. Small teams have routes of their own: pay drivers who bring sponsorship, veterans,
  experienced drivers from other categories (offered each summer) and a driver academy.

### Render-ready data (`src/sim/render.ts`)

`renderDescriptor(company, model, trim?)` returns plain data a renderer needs — body style,
dimensions, the platform's wheelbase and track, wheel and tyre size, ride height, suspension,
engine layout and position, drive, aero parts, structure and panels, interior, colour, trim and
platform. The simulation does not depend on graphics, so a future GLB/Blender pipeline can read
this descriptor instead of engineering internals.

### 3D vehicles (`src/three`, [docs/asset-pipeline.md](docs/asset-pipeline.md))

- The 3D layer reads only the **render descriptor**. An adapter decides whether a GLB asset fits (body, engine
  position, era) and plans how to stretch it (wheel arches stay round), where the wheels go, how big rims and tyres
  are, the ride height, which parts are shown (EV or combustion grille, one to four exhausts, lip spoiler, wing,
  splitter, skirts) and the materials (paint finish, chrome / black / satin trim, rims, calipers, cabin). What it
  cannot draw is clamped with a visible note or falls back to the procedural model with the reason.
- The reference asset is an original four-door saloon built by a Blender script (`tools/blender/sedan`), exported as
  Draco-compressed GLBs in three levels of detail (≈314k / 109k / 49k triangles, about 42 draws each) with three
  alloy wheel designs; tyres are generated in the browser for each car's tyre size. Its hood, boot lid and roof are
  analytic curvature-continuous surfaces checked with zebra stripes; shut lines are real grooves; lamps, grille,
  wheels and interior are modelled in detail. Other body styles, older eras and race cars use the procedural models.
- The studio viewer has front, rear, side, three-quarter and top cameras, zoom, turntable, full-screen inspection,
  Low / Medium / High quality presets and an FPS test. Medium and High light the studio with a CC0 HDRI ("Studio
  Small 09", Poly Haven); High adds transmissive glass and lenses, a key-light shadow map and a reflective floor.
  Metallic and pearl paints have a subtle, distance-faded flake under the clear coat. Paint finish and wheel design are cosmetic fields of the
  specification (Body tab); wheel size, ride height, aero parts and cabin are engineering choices the model follows.

### Saves

Games autosave to IndexedDB after every time advance, after each race and when returning to the
menu, and can be saved to named slots, exported to a file or copied as text. The save format is versioned (`SAVE_VERSION` in
`src/sim/migrate.ts`); every load path validates the data and upgrades older saves. Version 1
saves (before the accounting rework) load with their stock valued at its last unit cost and their
plants at estimated value. Saves from a newer version are refused with a message. Phase 2 added only
optional fields (team size and agreed owner funding of a racing team, a rear-transaxle flag, AI
crisis and player restructuring counters, acceleration figures); version-2 saves without them load
with documented defaults. Phase 3 moved to **format 3**: on loading a version-2 save the player's
existing models are grouped into engine families and platforms (`adoptFamilies`), so shared
engines keep sharing; trims, contracts, stages, order books, regional prices, driver potentials
and the academy are optional fields that start empty. Phase 4 added only the optional cosmetic fields `finish` and
`wheelStyle` (absent = the trim's default look), so the format stays at version 3.

## Data coverage and labels

- **Start years 1950–2026.** Market volumes, fuel and interest data run to 2025
  (`MARKET_DATA_THROUGH`); later years hold the last values and the setup screens say so.
  Production figures run to each manufacturer's last known year and are labelled "held at YYYY
  level" beyond it. The last dated historical event is in 2022; later events are generated.
- **Historical** (public record, written from memory and rounded): founding years, plant
  locations and opening years, model names and production years, engine layout, displacement,
  aspiration and drive layout, racing programme eras, regulation eras and points systems.
- **Approximate**: annual production keyframes, regional market volumes, CPI.
- **Estimated game data**: finances, brand scores, regional splits, plant capacities, prices,
  every car detail beyond the historical fields, race-car aero and power levels (including the
  2026 Grand Prix power cap and aero), budgets and sponsorship.

## Feature status

### Verified (covered by the automated suite and checked in a browser)

- Main menu, setup screens and starting conditions for all three modes, 1950–2026.
- Vehicle design studio with live physics; development programmes; new generations.
- Factories: build, expand, automate, sell, tool lines, ramp-up, output targets.
- Market demand, dealer networks, pricing; AI competitors.
- Finance: income statement, cash flow, balance sheet, loans, credit limit, insolvency.
- Acquisitions, model retirement with stock clearance.
- Motorsport divisions in every mode, full seasons, standings, prize money, regulation changes.
- Live and instant race simulation (deterministic).
- Save / load in IndexedDB, autosave, file and clipboard export/import, migration of v1 and v2 saves.
- Engine families and variants, platforms, trims, facelifts, supplier contracts, production
  stages, order books, regional prices, driver market and academy (Phase 3).

### Benchmark sources and model assumptions

- **Performance references** (`tests/benchmarks.ts`): manufacturer-published power, DIN/EU kerb
  weight, 0–100 km/h and top speed, and contemporary road tests, written from memory and rounded.
  Published 0–100 times of the same car vary by ±0.3 s between sources; pre-1972 American power is
  converted from SAE gross to an approximate net value; supercar "dry" weights are converted to an
  approximate kerb weight. Electronically limited top speeds are only required to be reached.
- **Price references** (`tests/benchmarks.ts`): approximate base list prices in USD of the year
  (US prices where the car was sold there, otherwise converted at the exchange rate of the time).
  The game has one world price per model, so the suite asks for the right order of magnitude and
  ranking, not the exact figure.
- **Catalogue cars** carry only real coarse facts (years, layout, displacement, aspiration, driven
  wheels, engine position). Everything else — boost, compression, rev limit, gearbox, tyres,
  construction, quality — is estimated by era- and class-typical rules in `specFromRow` (`ai.ts`),
  with a few historical exceptions (pushrod V8s, Jaguar's twin-cam six, Bosch mechanical injection,
  Honda VTEC, rear transaxles).
- **Strategy profiles, team-finance shares, sponsor and prize curves** are estimated game data,
  shaped on public descriptions of how these businesses work, not published figures.
- **Phase 3 data**: all suppliers and drivers are fictional; supplier prices, quality, capacity and
  reliability, development-cost shares, maturity rates, purchasing-power levels, sales-tax rates,
  the rarity-by-era curve and driver salaries are estimated game data. Exchange rates are a
  generated index, not historical rates.

### Known limitations

- **One specification per catalogue row.** Detuned or special variants of a shared engine get the
  row's single tune (a Ferrari Roma comes out at 566 kW against a real 456 kW; the F8 Tributo with
  the same engine is within 8 %). Since Phase 3 the F80 is priced at about 0.9× its real price;
  older limited series stay below theirs (F40 ≈ $220k vs $400k), as collector demand was weaker then.
- **Phase 3 simplifications**: AI makers do not use trims, supplier contracts or regional prices
  (their engines and platforms are grouped implicitly); component safety stock is a holding-cost
  policy, not an inventory asset on the balance sheet; preorders and deposits are not taken in
  cash; a regional price is stored as a multiple of the world price at a fixed exchange rate;
  drivers do not move between championships except through scouting.
- **Benchmark outliers**: the McLaren F1 (bespoke lightweight) and Alpine A110 (compact
  all-aluminium) are built heavier than the real cars and are tested against a wider band.
- **Motorsport**: privately funded front-runners in GT and touring fade after about ten seasons
  against six or more works teams; the prudent AI test principal does not use the driver market. Passive play (never adjusting the development budget)
  can still go bankrupt — by design.
- **Market**: demand forecasts hold competitors at today's prices;
  competitor price moves are quarterly and rule-based, not game-theoretic.
- **Data simplifications**: corporate ownership is simplified (subsidiaries are stand-alone);
  regulations are condensed (no sub-classes or equivalence formulas); the race calendar uses at
  most 11–12 original circuits, so some months have two races.
- **Simulation simplifications**: AI companies build to order (no inventory) and use a compact
  financial model; hybrid deployment in racing is a lap-average power contribution; a programme
  with very few engineers still progresses at a quarter of full speed. Impact estimates replay
  random events identically in both copies of the world, so they show a decision's effect, not the
  range of possible outcomes.
- **3D**: one GLB asset (modern saloon, 2005–2035, front engine); every other body, era and the race cars use the
  procedural models. The reference sedan is a detailed, credible game asset but not photorealistic or configurator-grade
  (remaining defects are listed in the visual review in [docs/asset-pipeline.md](docs/asset-pipeline.md));
  performance was measured only with software rendering (no GPU available), so 60 FPS on desktop GPUs is a target
  to confirm with the in-app FPS test (procedure in the same document).
- The interface is in English and Spanish and designed for desktop (it reflows down to tablet width). Text the
  simulation writes as sentences (news, board objectives, decisions, the race log, engineering warnings) and proper
  names are not translated; see [docs/interface.md](docs/interface.md).

### Not implemented yet

- Rapier rigid-body physics; cloud saves and accounts (Supabase).
- Driving the cars yourself; physical collisions between cars.
- Full safety car, multi-class endurance fields, stint limits, playable qualifying sessions.
- Emissions and safety regulation as hard market-entry rules.
- Share price, dividends and equity financing.
