# Automotive Empire

An automotive CEO, engineering and motorsport simulation that runs entirely in the browser.
Three modes share one simulated world from 1950 to today:

1. **Historical Automotive CEO** – run one of 18 real manufacturers from any year of its history.
2. **Automotive Company Founder** – found a new marque and engineer its first car from scratch.
3. **Professional Motorsport Director** – run a Grand Prix, Hypercar, LMDh, GT or touring-car team.

No backend, no account, no paid engine or API. Static files only.

> Unofficial. Manufacturer names are used descriptively for historical context. No logos,
> liveries or licensed assets are included. Circuits, drivers, sponsors and independent teams
> are fictional. Historical facts and estimated game data are labelled separately in the UI
> (`historical` / `approx.` / `estimate`) and in the data files.

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # development server on http://localhost:5173
```

```bash
npm run build      # type-checks, then writes the static site to dist/
npm run preview    # serves dist/ on http://localhost:4173
```

Other scripts:

```bash
npm run sim:test                 # engineering + lap-time calibration table (headless)
npx tsx scripts/playtest.ts      # plays each mode for a few years in the terminal
npx tsx scripts/longrun.ts       # decades-long soak test of all modes and player actions
```

## Deploy (any static host)

`vite.config.ts` uses `base: './'`, so `dist/` works from a domain root, a sub-path or a zip.

**Cloudflare Pages** – connect the repository, build command `npm run build`, output directory
`dist`. Or upload directly:

```bash
npm run build
npx wrangler pages deploy dist --project-name automotive-empire
```

**GitHub Pages** – push the repository, then publish `dist/`:

```bash
npm run build
npx gh-pages -d dist
```

This repository also ships `.github/workflows/deploy.yml`, which builds and publishes `dist/` on every
push to `main`. Enable it once under Settings → Pages → Source: "GitHub Actions".

**Anything else** (Netlify, S3, nginx, itch.io): upload the contents of `dist/`.

## Technology

| Layer | What is used |
|---|---|
| UI | React 19 + TypeScript, plain CSS |
| 3D | Three.js via React Three Fiber and drei |
| Simulation | Custom TypeScript engines (`src/sim`), no dependencies, runnable headless |
| State | zustand (UI state only; the game state is a plain JSON object) |
| Saves | IndexedDB (`src/store/saves.ts`) + export / import as a JSON file |
| Build | Vite |

All dependencies are MIT-licensed open source.

**Not integrated (stated plainly):**

- **Rapier** is *not* used. Vehicle performance and racing run on the custom deterministic models
  described below (time-step longitudinal dynamics, quasi-steady-state lap simulation); nothing in
  the current game needs rigid-body collision physics. A free-driving test track would be the
  natural place to add `@react-three/rapier`.
- **Supabase / cloud saves / accounts** are *not* implemented. `SaveBackend` in
  `src/store/saves.ts` is the interface a cloud backend would implement.

## Project layout

```
src/
  sim/                 simulation engines (no React, no DOM)
    engineering.ts     engine, vehicle dynamics, fuel, cost, ratings
    market.ts          segments, regions, demand and market share
    company.ts         factories, unit cost, research, finance, monthly tick of the player
    ai.ts              builds every historical manufacturer and runs the AI competitors
    events.ts          historical events (real dates) and procedural events / decisions
    world.ts           game creation for the three modes, monthly and yearly world tick
    actions.ts         every player action (validated, returns an error string or null)
    racing/
      tracks.ts        original circuit layouts → geometry, curvature, overtaking zones
      regs.ts          regulations and points systems by discipline and year
      racecar.ts       race-car performance from spec + development + regulations
      lapsim.ts        point-mass lap-time simulation
      race.ts          deterministic race simulation
      season.ts        championships, drivers, calendars, results, season roll-over
  data/                manufacturers, technologies, world/market reference data
  store/               zustand store and IndexedDB saves
  three/               procedural car generator, studio viewer, race scene, 2D track map
  ui/                  screens
scripts/               headless calibration and soak tests
```

## How the simulation works

### Vehicle engineering (`src/sim/engineering.ts`)

- **Engine** – mean-effective-pressure model. Air charge from volumetric efficiency (valvetrain,
  fuel system, cam profile, tuned rpm, valve float) and boost (spool curve, intercooling);
  indicated efficiency from the ideal Otto cycle with a real-cycle factor; knock limit from
  compression × boost against era fuel/chamber technology; friction from mean piston speed;
  `T = BMEP·Vd / 4π`. Bore and stroke follow from displacement and bore/stroke ratio and set the
  safe rev limit. Electric motors use a constant-torque / constant-power curve with era-dependent
  battery mass and cost.
- **Mass** – component build-up (structure by plan area and material, panels, powertrain,
  driveline, running gear, interior, safety equipment, electrics).
- **Acceleration** – explicit time-step integration with gear ratios, shift times, clutch slip
  at launch, traction limit with longitudinal weight transfer, aerodynamic drag and rolling
  resistance. Top speed is the highest speed at which any gear still has tractive surplus.
- **Braking / cornering** – tyre friction with load sensitivity, brake capacity, downforce.
- **Fuel consumption** – road-load energy for an urban and a highway cycle divided by part-load
  brake efficiency (friction and pumping losses grow in importance at low load); idle fuel;
  regeneration for hybrids and EVs.
- **Cost** – bill of materials by mass and component, labour hours, programme cost and duration,
  line tooling; unit cost then depends on plant wages, automation, volume and learning curve.
- **Ratings** – eight 0–100 scores *relative to the standards of the current year*, so designs age.

Calibration (`npm run sim:test`) compares generic specifications against well-known real cars;
typical agreement is within about ±10 % on power, 0–100 km/h and top speed. These are documented
approximations, not CFD or FEA.

### Market, company and world

- Six regions × eight segments with approximate historical volumes. Demand per model follows a
  share-of-appeal model: appeal = exp(utility) × price elasticity × brand × age × awareness ×
  tariffs × EV acceptance, weighted by dealer reach; unmodelled manufacturers are an aggregate
  "other" competitor.
- Every AI manufacturer is a full company built from the same engineering model. They launch
  their real models in the real years and open their real plants on time; in alternative history
  their fortunes drift.
- Monthly tick: production → inventory → sales → development programmes → research → overheads,
  interest, tax → brand dynamics → solvency. January: inflation, model re-rating, AI line-ups,
  board review, new racing season.
- Money is nominal USD scaled by a US CPI index.

### Racing

- Circuits are rounded polygons (straights and constant-radius corners). The same sampled centre
  line and curvature feed the lap simulation, the race and the 3D/2D views.
- Lap time: corner speed from `m·v²·κ = µ(m·g + ½ρ·ClA·v²)`, forward pass limited by power and
  the friction circle, backward pass for braking.
- Race: fixed 0.5 s steps from a seeded RNG. Each car follows its own speed profile scaled for
  fuel mass, compound, wear, wetness, driver, engine mode and lap-to-lap noise. Traffic,
  overtaking attempts in overtaking zones, pit stops (strategy planner + reactive rules),
  refuelling where the era allowed it, weather, virtual safety car, mechanical failures and
  accidents. The same seed and the same player inputs give the same race.
- The 3D view reads car positions from the simulation state every frame; it decides nothing.

## Feature status

**Functional**

- Main menu with the three modes; setup screens with per-manufacturer dossiers (budget, debt,
  portfolio, technology, plants, capacity, engineers, workforce, reputation, market presence,
  motorsport programmes, board objectives), founder budget allocation, motorsport regulations.
- CEO dashboard, alerts, charts, news.
- Vehicle design studio with live physics, torque/power curves, cost and mass breakdowns,
  technology locks, segment fit, suggested price; new generations re-using platform/engine.
- Procedural, rotatable 3D cars generated from the specification (road cars, single-seaters by
  era, prototypes, GT/touring).
- Factories (build, expand, automate, sell, tool lines, output targets), learning curve, wages
  by country, tariffs and local production.
- Market: segments, regions, competitors, dealer reach, awareness, marketing.
- Research by area with technology unlocks; engineering staff.
- Finance: income statement, loans, credit limit, insolvency; board confidence and objectives.
- Acquisitions of competitors (plants, dealers, engineers, technology and models transfer).
- Motorsport division in every mode: car design to era regulations, drivers, staff, facilities,
  development, sponsors, objectives, full seasons, standings, prize money, regulation changes;
  results feed prestige, awareness and research; costs hit the parent company.
- Live race screen (3D, four cameras, timing tower, minimap, per-car strategy controls, weather)
  and instant simulation.
- 28 dated historical events plus procedural events and decisions; historical / alternative
  timelines.
- Save / load (IndexedDB), autosave, export and import of save files.

**Approximations (by design, flagged in data files)**

- Financial starting positions, brand scores, regional splits, plant capacities, prices and all
  model details beyond name / years / engine layout / displacement / drive layout are estimates.
- Production volumes are rounded historical keyframes, interpolated.
- Corporate ownership is simplified: subsidiaries are stand-alone companies.
- Regulations are condensed (no sub-classes or equivalence formulas); the calendar uses eleven
  to twelve original circuits regardless of the real calendar length.
- One world price per model; inventory is pooled globally; currencies are not modelled (currency
  events act as import penalties).
- Hybrid deployment in racing is a lap-average power contribution; no energy-store strategy.
- AI finances are a compact approximation; AI companies do not go bankrupt or acquire each other.

**Not implemented yet**

- Rapier rigid-body physics; cloud saves / accounts (Supabase).
- Driving the cars yourself; damage and collisions between cars as physical bodies.
- Full safety car (only a virtual safety car), multi-class endurance fields, driver stint limits
  by regulation, qualifying sessions as separate playable events.
- Detailed supply chain (suppliers, parts sharing between models), trim levels, engine families
  as separate assets, platform sharing bonuses beyond new-generation carry-over.
- Emissions regulation as hard constraints; safety regulation as market-entry rules.
- Labour relations beyond event decisions; share price, dividends and equity financing.
- Player-facing rival motorsport programmes outside the championship you entered.
- Localisation (the interface is English only); touch-optimised layout.
