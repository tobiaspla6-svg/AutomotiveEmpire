# Automotive Empire — Phase 5D: game-world progression and regional markets

> **Planning and integration contract, not a claim that features are finished.**
>
> Parent: `phase5c-flow-screens` (draft PR #15). Do not merge to `main`; keep the economic simulation, save format, existing achievements, 2D art and old save compatibility. Phase 5D's initial patch adds a **read-only F–S+ grade label in the garage**; the market/regulatory/map/technology proposals below remain scheduled work.

## Goal and player loop

**Research → unlock vehicle generation → build modular car → evaluate F–S+ → choose countries/regions → validate local homologation → choose launch price/marketing/factory supply → sell against AI rivals → complete missions → fund future R&D.**

A good design may fail commercially; the grade is **not** a magic sales boost. A cheap, reliable B hatch can outsell an S+ exotic. The grade is a product-quality explanation; the demand outcome comes from current competition, market size, brand, price, dealer reach and production capacity.

## Use the actual existing game

This is an extension, **not a rewrite**:

- `src/sim/types.ts`: `RegionId = NA | EU | JP | CN | LATAM | ROW`; `VehicleStats.scores`, model regional prices, company awareness/reach and unlocked technologies already exist.
- `src/data/world.ts`: market segment shares, dated preferences and region bias, actual in-game geographical markets, historical price/volume estimates and import tariffs. These are **game estimates**, not a live market feed.
- `src/sim/market.ts`: `utilityOf`, `appeal`, `priceResponse`, `computeMarket`, dealer reach, market shares, import tariffs and marketing already affect actual sales. **Do not multiply demand by the new product grade**, because that double-counts the same statistics.
- `src/ui/Regional.tsx`: regional price/demand inspection exists as a technical table; the new map should be an inviting visual presentation over the same logic.
- `src/sim/achievements.ts`: real simulation achievements, rewards and irreversible claiming exist. Extend them, don't create a disconnected second quest system.
- `src/sim/vehicleConfig.ts`: part slots, body families, roof compatibility and missing-asset markers already exist; the illustrated asset standard still needs real transparent variants.
- `src/data/tech.ts`: historically dated research milestones already exist. Introduce generation prerequisites and projects without releasing 2026 components in a 1960 save.

## Product quality: F → S+

Read-only `src/sim/marketGrade.ts` initially computes a bounded 0–100 grade based on **the chosen segment's current weights for existing engineering scores**, plus a small body-style compatibility factor. Baseline grading thresholds are initial game-balance hypotheses; run historical distribution tests and calibrate before releasing grade-triggered unlocks.

- F: <38; E: 38–47; D: 48–57; C: 58–67; B: 68–76; A: 77–85; S: 86–93; S+: ≥94
- A score is relative to its **target segment**, not an absolute prestige label (sports cars need performance, family cars need reliability/space/safety).
- Show grade in garage and vehicle design summary; display the weighted factors so a player knows why they got it.
- Market advice is **separate**: price suitability, regional body preferences, expected demand, dealer coverage and competitors. Marketing increases discovery, not the car's design grade.
- Do not add any F–S+ demand multiplier to `appeal` or `computeMarket`.

## Seven engineering generations

Starting reference years: **1950, 1965, 1980, 1995, 2005, 2015, 2026**. These are **game design generations**, not legal model year rules.

Body archetypes per era where historically plausible: hatch, sedan, wagon, coupe, roadster, SUV, pickup, supercar; include a separate racing branch for GT, endurance prototype, rally, formula, late-era hypercar and other historically valid formats.

To unlock next generation require **all**: reached an earliest year (allow only narrowly justified R&D lead), required preceding technology, funded R&D/resource budget, engineering team/facilities, elapsed development months, and branch dependencies. Don't permit purchase or loot boxes to override time/physics.

Each generation starts with a **master body asset and anchor contract**; body-specific modular pieces inherit wheelbase, wheel centers, door seams, roof structure, paint masks and era. Don't imply that all 56 body/era combinations or 100+ variant graphics are already produced.

## Regional map and dynamic desirability

The existing six market regions are the first playable map zones. A player can:

- Compare current market size, segment shares and estimated demand based on **year**; preference curves shift over decades.
- See each car's fitted segment, import tariffs, dealer presence, export cost, local taxes, current sale prices and expected supply constraints.
- Select active sale regions for each model with a **saved, backwards-compatible model-region field**; not merely visual checkboxes. Existing regional market UI can evolve into launch controls, while old saves remain active in the markets they were previously active in by default.
- View local AI rivals from the existing historical manufacturer dataset, with a challenge objective (star market) that can award **only one verified reward**, tied to actual sales/market share and not manufactured statistics.
- Adjust local advertising or dealerships only through existing company action rules, never as fake decorative buttons.

Marketing and rank guidance must account for product quality, customer fit and price, without granting extra demand twice.

## Homologation and emissions: separate concepts

**CO₂ = grams/km and manufacturer fleet-average targets.** **NOx / CO / HC / particulate pollutants = mg/km or particle counts**, with pollutant-specific laboratory / on-road test conventions. Don't invent one universal '300 mg' legality threshold.

Reference implementation should version a `RegionalRegulation` by region, vehicle category, registration/type approval year, fuel/powertrain, pollutants, and technology maturity, with source citations. First milestone EU only; the other regions after separate official research. Real registration requirements can vary with year, vehicle category and grandfathering.

Official starting references:
- Euro 7 Regulation (EU) 2024/1257, Article 21: new passenger-car/van types from **29 Nov 2026**, new vehicles from **29 Nov 2027**: https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32024R1257
- European Commission CO₂ for cars and vans, manufacturer **fleet-average** standards (not a universal per-vehicle roadworthiness threshold): https://climate.ec.europa.eu/areas-action/transport-decarbonisation/road-transport/cars-and-vans_en

The current `VehicleStats` has fuel consumption but **does not calculate certified tailpipe NOx, CO₂/HC/PM or catalyst effectiveness**. First add a **clearly labelled simulated emissions estimate**, plus effect of catalytic converter, fuel system, engine tuning and aftertreatment, with tests and confidence limits. Do **not** make real-world regulatory compliance promises from this approximation. Before blocking sales in the simulation, use an explicitly simplified, balanced, era-specific **game homologation** rule and communicate it as such.

## Missions, rarity and star markets

Keep existing `src/sim/achievements.ts` as the reward engine; expand to explainable tasks:
- First sale in each region; first 100 exports; launch an affordable grade-B family car.
- Improve an F vehicle to B with a redesigned successor.
- Reach 5% share in a targeted star market without selling below variable cost.
- Homologate a late-era model with catalysis and emissions tech.
- Beat a historic manufacturer in annual sales in a region, when the game simulates enough evidence.
- Win an eligible racing championship.

Rarity (common/rare/epic/legendary/mythic/relic) governs cosmetics, verified blueprints and materials with explicit time gates. Paid chests or premium purchases must not bypass research and must not be implemented on the static frontend.

## Visual asset production contract for ChatGPT Work + Google Flow

- For each master vehicle: make **4 image candidates**, critique side profile geometry, wheel centers, proportion, reflections, visible seams, panel fitting and consistency; select **only 1** after actual visual review.
- Ship original full-resolution art and web-optimized renders, separate actual alpha/masks when possible; no opaque white backgrounds falsely claimed as transparent layers.
- Layout metadata: 1600×700 target master canvas, vehicle bounding box, wheel centers, paint/body masks, lighting/style guide, door handles, lamp slots, bumper anchors, roof family compatibility, source ID and provenance.
- Test a composition with at least **two aligned wheel choices, two headlights and two bumpers** on *the same* master shell. No perceptible shift in wheelbase or silhouettes.
- A convertible/soft top requires its own engineered roof/body family; not a fake crop.
- Label each file `reference`, `selected`, `transparent asset`, or `verified modular`. Do not count generated images as usable layers until alpha/fit is tested.
- Reproduce the user's approved **premium semi-realistic 2D strict side profile** rather than the low-detail SVG placeholders.
- No unauthorized brand photographs, logos or protected illustrations bundled into a commercial game; track license and source.

## Division of responsibilities and checklists

### ChatGPT (connected GitHub, NOW)

- [x] Audit current PR and discover existing regional, marketing, achievement, technology and quality systems.
- [x] Define a read-only F–S+ grade based on actual segment-weighted engineering scores.
- [x] Add grade display in garage and unit tests in a separate chained branch.
- [ ] Add and test a *display-only* regional fit forecast with no change to demand formulas.
- [ ] Draft region-specific dated regulatory tables, starting with sourced EU rules.
- [ ] Implement and test the emission estimator only after checking available engine and catalyst design parameters.
- [ ] Later add verified grade and homologation mission rules using existing achievement engine.

### ChatGPT Work + Google Flow (NOW)

- [ ] Inspect approved green 1990s SUV and blue fastback references; read existing Flow visual manifest and GT-01 failed-production handoff.
- [ ] Produce 4 isolated visual candidates for one 1990s SUV master only; choose the best by rubric.
- [ ] Generate/select **actual aligned variants**: 2 wheels, 2 headlights, 2 bumpers. Verify alpha and anchor fit, don't claim unavailable assets.
- [ ] Prepare a clean same-style gallery and clickable *image-only* montage of the changed vehicle.
- [ ] Optionally illustrate a world market map and 7-generation technology tree background, **without** fictitious clickable UI burned into the art; real controls are coded.
- [ ] Publish manifests and files to a dedicated art branch and give Claude exact file references.
- [ ] Stop or request user intervention for provider rate limits, paid-credit prompts or site blocks, rather than infinite retry loops.

### Claude Code (AFTER LIMIT REFRESH)

- [ ] Review new code branch and current UI PR, avoid merging or rewriting existing mechanics.
- [ ] Integrate F–S+ into workshop and show **reason codes** and real market effects.
- [ ] Make the six-region world map interactive; connect launch toggles, marketing, tariffs and real demand.
- [ ] Implement unlock prerequisites, development timers and seven era generations in the existing research system.
- [ ] Wire homologation gates to the certified/simulated boundary, add in-game warnings/missions.
- [ ] Consume approved modular files only; never present reference JPEGs as verified transparent components.
- [ ] Run TypeScript/unit/browser tests, benchmark mobile/desktop and publish screenshots before/after to a draft PR.

## Acceptance scenarios

1. In 1960 a player can design a period-correct family vehicle but cannot select 2015 LED systems/EV modules, even with all earned credits.
2. Two vehicles with identical scores but different intended segments may receive different grades, with a clear description of why.
3. An S+ exotic with a very high price and minimal dealer coverage can sell less than a grade-B affordable family car.
4. The player exports an eligible model to the EU, receives a region-specific homologation warning (when appropriate), researches a compatible system and retests, without being told a simulated pollutant estimate is real certification.
5. Europe and North America do not have constant vehicle preferences from 1950 to 2026.
6. Progress is persisted and old saves continue loading; no repeated achievement claims or duplicate credit grants.
7. Side-profile wheels, lamps and bumpers swap with identical anchor coordinates and a visual before/after verified in browser.

## Milestone gates

**Milestone 1:** PR grade calculation + garage indicator + tests + Work approved SUV master.  
**Milestone 2:** real region map, active selling areas, grade breakdown, acceptance scenarios.  
**Milestone 3:** historically gated technology generations and race class gates.  
**Milestone 4:** documented simulated emissions, fair market rules, real star-market challenges and missions.  
**Milestone 5:** full modular 2D editor (and optional 3D later), with no invented availability.

**Keep all PRs draft until their tests and visual evidence are reviewed.**
