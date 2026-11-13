# Vehicle asset pipeline (Phase 4)

How 3D vehicles get from Blender into the game, what the renderer may and may not do with them, and where the
reference sedan stands against the visual acceptance criteria.

## 1. Architecture

```
simulation (src/sim)                         graphics (src/three)
VehicleSpec ──► specDescriptor / renderDescriptor ──► planVehicle (adapter.ts, pure data)
                (src/sim/render.ts)                     │  asset fits?  ── no ──► procedural RoadCar (CarModel.tsx)
                                                        ▼ yes
                                     loadGLB (loader.ts, cached, Draco) ─► buildCar (instance.ts)
                                                                            stretch · wheels · tyre · materials
                                                                          ─► styleCar (paint, trim, cabin, parts)
```

* The **render descriptor** is the only thing the 3D layer reads: body, dimensions, wheelbase, track, wheel and tyre
  size, ride height, engine layout and position, drive, aero parts, structure, cabin, colour, paint finish, wheel
  design, trim level and platform. Graphics never compute gameplay; gameplay never depends on graphics.
* The **adapter** (`src/three/assets/adapter.ts`) is pure TypeScript (unit-tested without WebGL). It picks an asset
  that fits the body, engine position and era, and produces a *plan*: how to stretch the body (piecewise along the
  length so the wheel arches stay round), where the four hubs are, rim and tyre size, the ride-height lift, which
  swappable parts are visible and which materials to apply. Anything the asset cannot represent is either clamped
  with a note shown under the viewer ("24" wheels are drawn as 22"…") or the plan falls back to the procedural
  model with the reason. The interface never claims a customisation that is not drawn.
* **Instances** share the GLB template's buffers and textures. Each car owns only the geometry it stretches and the
  materials it recolours; both are disposed on unmount (`disposeCar`). Paint, finish, trim, calipers and cabin
  changes restyle materials in place; a rebuild happens only when the geometry key changes (size, ride height,
  wheel size or design).
* **Loading** is lazy (first use), cached per URL, retried after a failure, and decoded by the Draco WebAssembly
  decoder vendored in `public/draco/` (from the `three` package; Apache-2.0) — nothing is fetched from a CDN.
* While an asset loads, or if it fails, the procedural car from the specification is shown, so a view is never
  empty. A React error boundary keeps any 3D failure inside the viewer.

## 2. Asset contract (`src/three/assets/catalog.ts`)

Each catalogue entry records: category (`road` / `race`), bodies or racing discipline, era, engine positions,
LOD files with triangle counts and sizes, the wheel file and tyre profile, native dimensions, the compatible
stretch range, wheel attachment points, material slots the game may override, swappable components, livery slots
(race assets) and licence/attribution.

Node and material names in the GLB are part of the contract (tests check them against the catalogue):

| Node (top level) | Meaning |
|---|---|
| `body` | always shown |
| `grille_ice`, `grille_ev` | combustion grille bars / closed EV panel |
| `exhaust_single`, `exhaust_dual`, `exhaust_quad` | one is shown for combustion cars, none for EVs |
| `aero_lip_spoiler`, `aero_wing`, `aero_splitter`, `aero_skirts` | follow the car's wing, splitter and flat-floor settings |
| `interior` | seats, dashboard, displays, steering wheel, console, door cards, headliner |
| `wheel_FL/FR/RL/RR` | hub centres (attachment points) |

Material slots the game overrides: `paint`, `paint_body` (body panels, carries the panel-gap mask, baked ambient
occlusion and normal map), `trim_chrome` (chrome / gloss black / satin by trim), `rim_alloy`, `caliper`,
`int_upholstery`, `int_accent`. `wheels.glb` holds `rim_sport5`, `rim_turbine10`, `rim_multi15`, `brake_disc`
and `caliper` at the origin (axis = wheel axis); the tyre is revolved in the browser from `tire_profile.json`
for the car's exact tyre size.

## 3. Building the reference sedan

Requirements: Blender 4.5 LTS (tested with 4.5.16, official build from download.blender.org; no GPU needed).

```bash
blender -b --factory-startup --python tools/blender/sedan/build.py
```

Options: `--renders` (the 8 Cycles review views into `assets-src/sedan-ref/renders/<stage>-*.png`), `--stage=NAME`
(`preview`, `detail`, `probe`, `wheelcheck`, `refcheck`), `--zebra` (surface-quality check, see below),
`--no-export`, `--no-ao`, `--no-normal`, `--references=DIR`. A full build takes about 1.5 minutes on four CPU cores
(about 10 minutes with `--renders`) and writes:

* `public/assets/vehicles/sedan-ref/sedan.lod0.glb` (≈315k triangles, 1.18 MB), `sedan.lod1.glb` (≈109k, 0.85 MB),
  `sedan.lod2.glb` (≈49k, 0.61 MB), `wheels.glb` (three rims, brake disc, caliper; 0.26 MB), `tire_profile.json`
* `assets-src/sedan-ref/sedan.blend` — the editable source scene (all rim designs, brakes, tyre, reference planes)
* `assets-src/sedan-ref/textures/` — panel-gap mask (with baked AO) and its normal map
* `assets-src/sedan-ref/export-report.json` — triangles, draw calls and sizes per LOD

After a re-export, copy the sizes and triangle counts from `export-report.json` into `catalog.ts` (the test suite
checks them within 5 %).

**How the model is made** (all in `tools/blender/sedan/`):
* The body sides are lofted through fourteen longitudinal tracks (floor, rocker, sill crease, sculpted lower door,
  waist, shoulder crease, belt) that turn towards the centre line along superellipses at the ends, mirrored into a
  closed skin. The **hood, boot lid and roof** (with windscreen and rear window) are analytic height fields with C2
  (curvature-continuous) centre profiles, a parabolic cross crown and the glass corner sweep, blended into the
  loft at the fender crest and roof rail; the whole skin then gets volume-preserving Laplacian fairing that
  leaves the feature lines untouched. The roof rail is the centre profile shifted by the glass sweep, so the
  silhouette has no hump or dip at the headers.
* Surface features on the skin: arch flare rings, a recessed rear-bumper step.
* Openings (wheel arches, lamps, grille, intakes, diffuser) are boolean-cut; pockets take the cutter material
  (housings), lenses are the matching intersections. Normals of everything lying on the original surface are then
  transferred from the uncut skin, so cut edges shade cleanly.
* **Shut lines are real grooves** (4.2 mm wide, 6.5 mm deep) cut along the seam curves (doors, hood, boot lid,
  bumper joints), plus the baked mask and normal map for the fine edge shading; ambient occlusion is baked with
  Cycles into the same mask.
* Details: rolled arch lips and return flanges, three-projector headlamps with LED light guides and amber
  indicators, tail lamps with three stacked LED bars, diamond-mesh grille with a chrome blade and a gloss-black frame,
  corner intakes with fins, integrated rectangular exhaust finishers, rubber window seals, mirrors with indicators,
  door handles, cowl and wipers, aero kit.
* Interior: subdivided bolstered seats, sculpted dashboard with an instrument hood, four air vents and a decor inlay,
  driver display and bezelled touchscreen, three-spoke steering wheel with an airbag hub, centre console with a gear
  selector, rotary controller and cup holders, door cards with inserts, armrests and handles, headliner.
* Wheels: lathed rims with boolean-cut spokes; the smooth normals of the uncut dished face are transferred to the
  spoke tops (no faceting); ventilated drilled discs; calipers.

**Surface-quality check (zebra).** `--stage=probe --zebra --no-normal` renders the body as a mirror in a striped
environment. Smooth, continuous stripes mean smooth panels; this is how the hood and roof undulation was found
(the stripes were marbled) and confirmed fixed (parallel bands) — the check looks at geometry only, not lighting.

**Reference check.** `--stage=refcheck` renders orthographic side and front views at the design sheet's scale and
composites them over the blueprints (`renders/refcheck-side.png`, `refcheck-front.png`).

## 4. Licence and provenance

The sedan, its wheels, textures and the Blender source are **original work made for this project** by a script in
this repository: no third-party models, scans, textures, logos or manufacturer CAD were used, and no production
car was traced (proportions are generic for a mid-size saloon; the registration plate is blank). They are
distributed under the project's licence. **Note:** the repository does not contain a LICENSE file yet; the owner
should choose one (e.g. MIT for code and CC BY 4.0 for assets) before others reuse the assets.

Third-party files: `public/draco/draco_wasm_wrapper.js` and `draco_decoder.wasm` come from the `three` npm package
(Google Draco, Apache-2.0). `public/assets/env/studio_small_09_1k.hdr` is **"Studio Small 09" by Sergej Majboroda,
Poly Haven, CC0 1.0** (public domain dedication; downloaded from dl.polyhaven.org, MD5 d5d7eb9d26d341d6aa4d11c1a54fd97c
matching Poly Haven's API); it lights the game's studio on Medium/High quality and the Blender review renders. Future assets must list author, licence, source URL (only verified sources, never
models taken from commercial games or manufacturer CAD without rights) in their catalogue entry.

## 5. Reference images (design sheet; optional Google Flow references)

The sedan's single, consistent design statement is the orthographic **design sheet** generated from the design
parameters by `tools/blender/sedan/reference_sheet.py` (`assets-src/sedan-ref/references/side.png`, `front.png`,
`rear.png`, `top.png`, `design-sheet.png`; 220 px per metre). The Blender build loads them as image planes aligned
with the model (`ref_*` empties in `sedan.blend`), and the reference check renders the model over them; the side
silhouette, belt and crease lines, wheel arches, daylight opening, lamps and grille line up with the sheet.

Image generators such as Google Flow can add mood references for the three-quarter and interior views. They are
pictures only — no supported path turns them into editable geometry — and the game never calls an image service.
No such tool was available while building this asset, so **no generated images are included**;
`references/PROMPTS.md` holds consistent prompts (one shared base description for every view) for anyone who wants
to produce them, and the build loads `front34.png` / `interior.png` if they are added. Only images you have the
right to use belong there.

## 6. Motorsport assets (architecture only)

Race cars keep the procedural era-specific models (`RaceCar` in `CarModel.tsx`). The catalogue already supports
race entries: `category: 'race'`, `discipline` (f1, hypercar, lmdh, gt, touring), `era`, `livery` slots
(primary / secondary / number material names) and the same component nodes for aero parts. A future race asset
plugs in by adding a catalogue entry and a `pickAsset` rule for `discipline + year`; the race simulation stays
independent of rendering (it never imports `src/three`).

## 7. Performance

**Presets** (stored per browser; every 3D view uses the same one):

| Preset | LOD | Pixel ratio | Lighting | Shadows | Glass and lenses | Tyre segments |
|---|---|---|---|---|---|---|
| Low | LOD2 (≈49k triangles) | 0.75–1 | generated light panels (no download) | none | translucent | 48 |
| Medium | LOD1 (≈109k) | 1–1.5 | CC0 studio HDRI | contact shadows | translucent | 72 |
| High | LOD0 (≈314k) | 1–2 | CC0 studio HDRI + strip lights | contact + key-light shadow map, reflective floor | physically transmissive | 96 |

Static shadow maps and contact shadows are re-rendered only when the shown car changes. Each component group is
one mesh, so a car costs about 42 draws plus 4 × (rim, disc, caliper, tyre) whatever its detail level.

**Measured in this project's container** — no GPU, Chromium software rendering (SwiftShader on 4 CPU cores):

<!-- METRICS -->

These figures say nothing about a real graphics card: software rendering is one to two orders of magnitude slower.
They are useful for comparing presets and for the hardware-independent numbers (triangles, draw calls, download
size, memory). **60 FPS has not been verified** — no GPU was available.

### Measuring real FPS on your own computer

1. Run the game (`npm run dev`, or the deployed GitHub Pages site) in Chrome, Edge or Firefox with hardware
   acceleration on (Chrome: `chrome://gpu` should say "Hardware accelerated" for WebGL).
2. Start any game in 2005 or later, open **Vehicles → Design a new vehicle** (body style Sedan).
3. In the viewer's toolbar pick the quality preset, wait until the top-right label says "Asset: …", then click
   **FPS test**. The viewer turns the car for 5 seconds and reports average FPS, 95th-percentile frame time, draw
   calls, triangles, the canvas size and the GPU name.
4. Repeat for Low, Medium and High, and in full-screen inspection (⤢) for the worst case. Keep the window
   in front: browsers throttle background tabs.
5. Optional cross-check: Chrome DevTools → More tools → Rendering → **Frame rendering stats** shows a live FPS meter.

A result of ≥ 58 FPS average with p95 ≤ 20 ms on High means the 60 FPS target is met on that machine; otherwise
use Medium (half the triangles, no transmission pass) or Low.

## 8. Visual review (Phase 4B)

Screenshots: `docs/screenshots/phase4/before/` (Phase 4A, game viewer) and `docs/screenshots/phase4/after/`
(Phase 4B, game viewer, High quality, full screen: front three-quarter, rear three-quarter, side, front, rear,
headlight detail, wheel detail, interior). Cycles renders of the same views from the Blender geometry:
`assets-src/sedan-ref/renders/before-*.png` and `after-*.png` (same CC0 studio lighting for both).

**What improved (verified in the renders and screenshots):**
* Surfaces: the hood, boot lid and roof are fair — zebra stripes run in smooth, parallel bands where they were
  marbled before; the roofline no longer humps and dips at the windscreen header; arch flares; a crisper fascia
  (upright chin, forward hood edge, trapezoidal grille).
* Details: real recessed shut lines; three-projector headlamps with LED light guides and amber indicators; tail
  lamps with three stacked light bars behind a red lens; diamond-mesh grille with chrome surround and blade;
  integrated rectangular exhaust finishers; window seals; mirror indicators; rolled arch lips and flanges.
* Wheels: smooth machined spoke faces (the faceting is gone), ribbed tyre sidewalls, drilled discs.
* Interior: bolstered seats, sculpted dashboard with vents and an instrument hood, bezelled touchscreen, three-spoke
  wheel with airbag hub, console with gear selector, rotary controller and cup holders, door inserts.
* Materials: CC0 studio HDRI lighting, clear coat with a subtle distance-faded metallic flake (sparkle up close, no
  noise at a distance), physically transmissive glass and lenses on High, clean cut edges (normal transfer).
* Performance: draw calls cut from ~176 meshes to ~42 primitives per body; LOD2 added for Low.

**What remains imperfect (visible in the screenshots):**
1. The overall form is still conservative and slightly heavy: flanks are plain between the arches and the tail is
   tall and plain (the new rear step line barely reads). It looks like a credible game car, not a hand-sculpted
   production design.
2. The front fender crest near the headlamp has a sharp fold where the analytic hood blends into the loft; the front
   corner intakes read as dark blobs.
3. Gaps follow the seam curves but door shut lines have no inner door-frame geometry (they are 6.5 mm grooves).
4. Interior up close is simple: no stitching, switchgear, seat belts or pedals; the dashboard top is plain.
5. Under the HDRI's large softbox the hood can read very bright on High at some angles.
6. With the game's default (narrow) tyres the wheel-arch gap looks large — this follows the car's data.
7. Exhaust finishers and the plate are simple shapes; there are no badges by design.

**Verdict:** a clear, measurable step up — smooth surfaces, detailed lamps and wheels, credible interior, realistic
materials — and good enough to stand as the game's reference saloon. It is **not** photorealistic and not yet the
level of a manufacturer's configurator; the remaining gap is mostly form refinement (items 1–2), which would need
hand modelling on a subdivision cage in Blender against the design sheet.
