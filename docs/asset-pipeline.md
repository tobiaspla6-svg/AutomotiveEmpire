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

Options: `--renders` (Cycles reference renders into `assets-src/sedan-ref/renders/`), `--no-export`, `--no-ao`,
`--references=DIR`. A full build takes about one minute on four CPU cores and writes:

* `public/assets/vehicles/sedan-ref/sedan.lod0.glb` (≈226k triangles, ≈0.93 MB), `sedan.lod1.glb` (≈80k triangles),
  `wheels.glb` (three rims, brake disc, caliper), `tire_profile.json`
* `assets-src/sedan-ref/sedan.blend` — the editable source scene (all rim designs, brakes, tyre, studio-free)
* `assets-src/sedan-ref/textures/` — panel-gap mask (with baked AO) and its normal map

After a re-export, update the byte sizes and triangle counts in `catalog.ts` (the test suite checks them within 5 %).

How the model is made (all in `tools/blender/sedan/`): the body is lofted through fourteen longitudinal tracks
(floor, rocker, sill crease, sculpted lower door, waist, shoulder crease, belt, hood/deck) that turn towards the
centre line along superellipses at the ends, mirrored into a closed skin; the hood and deck tops are faired.
Wheel arches, lamps, grille and intakes are boolean-cut, which leaves housings and pockets with the right
materials and lenses that fit exactly. The glasshouse is a separate loft with an exact (plane-bisected) raked
C-pillar edge, chrome window surround, black frit and B-pillar. Panel gaps are drawn on the real surface and baked
into the body's UV space as a mask and a normal map; ambient occlusion is baked with Cycles. Rims are lathed,
dished faces with boolean-cut spoke openings and bevelled edges.

## 4. Licence and provenance

The sedan, its wheels, textures and the Blender source are **original work made for this project** by a script in
this repository: no third-party models, scans, textures, logos or manufacturer CAD were used, and no production
car was traced (proportions are generic for a mid-size saloon; the registration plate is blank). They are
distributed under the project's licence. **Note:** the repository does not contain a LICENSE file yet; the owner
should choose one (e.g. MIT for code and CC BY 4.0 for assets) before others reuse the assets.

Third-party files: `public/draco/draco_wasm_wrapper.js` and `draco_decoder.wasm` come from the `three` npm package
(Google Draco, Apache-2.0). Future assets must list author, licence, source URL (only verified sources, never
models taken from commercial games or manufacturer CAD without rights) in their catalogue entry.

## 5. Reference images (Google Flow or other image generators)

Reference images can guide modelling, but they are only pictures: no supported integration turns them into 3D
geometry or editable GLB files, and the game never calls an image service at runtime (no paid API dependency).

For each new vehicle, prepare five views and put them in `assets-src/<asset-id>/references/`:

| File | View | Guidance |
|---|---|---|
| `front.png` | orthographic-looking front, eye level | car centred, full width visible |
| `side.png` | true side (left side), wheels round | both axles visible; used to place wheelbase and belt line |
| `rear.png` | rear, eye level | lamps and bumper split readable |
| `front34.png` | front three-quarter | overall character |
| `interior.png` | dashboard from the driver's door | layout, screens, materials |

Prompts should ask for an *original* design (no brand names or badges). The Blender build loads whichever of these
files exist as aligned image empties in the `.blend` (`--references=DIR`, default `assets-src/<id>/references`), so
a modeller can trace proportions; they are never exported. The current sedan was modelled from dimensions only —
no generated reference images were used. If a team later has a supported image-generation API and its own
credentials, generating the five views can be scripted outside the game (e.g. a `scripts/` tool writing into
`references/`); keep keys out of the repository.

## 6. Motorsport assets (architecture only)

Race cars keep the procedural era-specific models (`RaceCar` in `CarModel.tsx`). The catalogue already supports
race entries: `category: 'race'`, `discipline` (f1, hypercar, lmdh, gt, touring), `era`, `livery` slots
(primary / secondary / number material names) and the same component nodes for aero parts. A future race asset
plugs in by adding a catalogue entry and a `pickAsset` rule for `discipline + year`; the race simulation stays
independent of rendering (it never imports `src/three`).

## 7. Performance

Quality presets (Low / Medium / High, stored per browser): pixel ratio, LOD (High = LOD0, others LOD1),
environment-map size, shadows (none / contact / contact + key-light shadow map + reflective floor) and tyre
tessellation. Shadow maps and contact shadows are rendered once per change of the shown car, not every frame.
The viewer has an **FPS test** button (5 s turntable) reporting average FPS, 95th-percentile frame time, draw calls,
triangles, resolution and the GPU string.

Measured in this project's CI container, which has **no GPU** (Chromium software rendering, SwiftShader on 4 CPU
cores), viewer 652×428 px:

| Preset | Draw calls / frame | Triangles / frame | FPS (software) |
|---|---|---|---|
| Low | 166 | 182k | 11 |
| Medium | 167 | 192k | 2.2 |
| High | 370 | 731k (reflective floor draws the car twice) | 0.8 |

Asset load: ≈9 s download + Draco decode under software rendering; building the instance takes ≈60 ms.
These numbers do **not** describe a desktop GPU and are not evidence of 60 FPS; the per-frame workload (≤370 draw
calls, ≤0.75M triangles) is modest for desktop GPUs, but the 60 FPS target must be confirmed with the in-app FPS
test on real hardware. Further headroom if needed: merge the ≈176 meshes by material (fewer draw calls), lighter
interior on LOD1, and a Medium preset without MSAA.

## 8. Visual acceptance review of the reference sedan

Delivered and verified: original sedan GLB (2 LODs) + Blender source; working studio viewer with front, rear,
side, three-quarter and top cameras, zoom, turntable and full-screen inspection; paint colour and four finishes;
three wheel designs and 12–22" sizes; ride height, aero parts, grille/exhaust by powertrain, trim styling and
cabin materials driven by the car's data; licence recorded; build and full test suite passing; screenshots in
`docs/screenshots/phase4/` taken from the actual asset in the game.

Compared with a professional automotive configurator it is **not yet at that level**, so the visual stage is not
marked complete. Specifically missing:

1. Surface quality: the loft still leaves a slight dip in the roofline above the A-pillar and a soft, generic
   front fascia; no subdivision-quality highlight flow on the flanks.
2. Detail density: no badges or emblems (deliberately none), simple exhaust tips, no tyre sidewall lettering or
   tread blocks in geometry, no door-shut depth (gaps are texture-based), basic interior (no stitching, vents,
   switchgear).
3. Materials: no metallic flake layer, no headlamp reflector detail at close range, window trim reads grey rather
   than polished.
4. Lighting: studio built from light panels only (no measured HDR photograph); no screen-space ambient occlusion
   or anti-aliased post-processing.

Recommended next iteration before the UI redesign: a hand-modelled subdivision body in Blender using the
reference-image workflow above (keeping the node/material contract so the game code does not change), metallic
flake normal map, optional measured HDR environment with a recorded licence, and real-GPU benchmarks.
