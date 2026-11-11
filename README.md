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
npm test           # the full automated suite (about 75 seconds)
npm run ci         # what CI runs: type-check, tests, production build
```

The suite (`tests/`, Vitest, Node environment) exercises the simulation core headlessly; the
persistence tests run the real IndexedDB save layer against `fake-indexeddb`.

| File | What it proves |
|---|---|
| `engineering.test.ts` | Calibration against reference cars; design changes move results the right way; physical bounds (power at top speed, tyre-limited braking, Otto-cycle efficiency) on 150 random designs |
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

Development scripts (not part of the suite): `npm run sim:test` prints the engineering and
lap-time calibration table; `npx tsx scripts/playtest.ts` and `npx tsx scripts/longrun.ts` play
the modes in the terminal and print summaries.

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
    racing/            circuits, regulations, race cars, lap simulation, race, championships
  data/                manufacturers, technologies, world/market reference data
  store/               zustand store and IndexedDB saves
  three/               procedural car generator, studio viewer, race scene, 2D track map
  ui/                  screens
tests/                 automated test suite
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

These are documented approximations, not CFD or FEA; typical agreement with reference cars is
within ±10–20 % (see `tests/engineering.test.ts`).

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

### Saves

Games autosave to IndexedDB after every time advance, after each race and when returning to the
menu, and can be saved to named slots, exported to a file or copied as text. The save format is versioned (`SAVE_VERSION` in
`src/sim/migrate.ts`); every load path validates the data and upgrades older saves. Version 1
saves (before the accounting rework) load with their stock valued at its last unit cost and their
plants at estimated value. Saves from a newer version are refused with a message.

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
- Save / load in IndexedDB, autosave, file and clipboard export/import, migration of v1 saves.

### Known limitations

- **Economy balance** (not bookkeeping errors; the books reconcile):
  - Long-running motorsport teams on large budgets accumulate very large cash balances, because
    funding scales with the category's budget level.
  - A small team that redesigns its car every season can go insolvent.
  - Exotic and limited-series cars are priced by segment rules (for example, an F80 is listed
    far below its real price).
  - Some acceleration figures for high-power rear-drive cars are slow against reality.
- **Data simplifications**: corporate ownership is simplified (subsidiaries are stand-alone);
  regulations are condensed (no sub-classes or equivalence formulas); the race calendar uses at
  most 11–12 original circuits, so some months have two races; one world price per model;
  currencies are not modelled.
- **Simulation simplifications**: AI companies build to order (no inventory) and use a compact
  financial model; hybrid deployment in racing is a lap-average power contribution; a programme
  with very few engineers still progresses at a quarter of full speed.
- The interface is English only and designed for desktop.

### Not implemented yet

- Rapier rigid-body physics; cloud saves and accounts (Supabase).
- Driving the cars yourself; physical collisions between cars.
- Full safety car, multi-class endurance fields, stint limits, playable qualifying sessions.
- Detailed supply chain, trim levels, shared engine families and platforms beyond new-generation
  carry-over.
- Emissions and safety regulation as hard market-entry rules.
- Share price, dividends and equity financing.
