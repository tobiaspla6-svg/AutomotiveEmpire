# Automotive Empire — visual direction 2D, Phase 5B

**Status:** draft on `phase5b-premium-2d-art-direction`, stacked on PR #13 and submitted as PR #14. Not merged.
**Scope:** visuals only. The economy, engineering and save format are unchanged, and no new mechanics were added.

## Chosen direction

The game has one style: **premium illustrated tycoon**, with real perspective.

- **Vector, not pixel art.** Everything is drawn in code as SVG: no photographs, no WebGL in the 2D path, no image files to download.
- **One renderer for every technical illustration.** A small "vector renderer" (`src/ui/art2d/vector3d.ts`) models objects as simple 3D surfaces and draws them as flat-shaded SVG polygons. It uses:
  - a pinhole camera;
  - back-face culling;
  - vertex-normal (smooth) shading;
  - depth ordering by solid;
  - a studio environment that the paint, glass and metal reflect.

  The hero cars, engines, parts, chests and factory all share this renderer and its lighting, so they belong together. The catalogue side views (`Car2D`) and the isometric campus keep their flat-vector look, with the same palette.
- **Palette:** graphite, steel and deep navy; warm gold for actions; cold cyan for technology. Rarity colours appear only on rewards.
- **Motion:** small and decorative, using `transform` and `opacity` only, and switched off under `prefers-reduced-motion`.
  - Cars drive the campus roads and units move along the factory line.
  - Chests rattle when ready and burst when opened.
  - The bottleneck bay pulses.

## What changed, screen by screen

Before/after pairs are in `docs/phase5-2d/before-after/`. They come from the real build: a Toyota CEO game started in 1995 and advanced two months, captured at 1440×900 in Spanish and 390×844 in English. "Before" is the PR #14 head (`fec7439`).

| Screen | Before | After |
|---|---|---|
| **Main menu / setup** (`HeroShowroom2D`) | A side profile with a cut-off tail, boxy grille and small wheels in an empty studio. | A real front three-quarter car modelled as a lofted body and greenhouse. It has clear-coat paint reflecting soft boxes and horizon, glass with sky reflections, LED lamps with projector lenses and light bloom, a mesh grille and lower intake, door cuts, handles and mirrors, and forged ten-spoke wheels with brake discs and callipers seen through clipped arches. The studio has a cyclorama wall, light fins, a turntable, contact shadows and a floor reflection drawn with `<use>` (no extra DOM). All 8 body types are distinct. The paint follows the player's colour, and the scene fills any panel shape without cropping. |
| **Workshop** | Flat engine silhouettes; the car preview only for 4 bodies. | Every engine option and the live preview is a perspective engine. The perspective car is used in the preview from 1985 on; earlier eras keep the period side-view art, so a 1950s game never shows a modern car. Parts are 3D (see below). All the numbers are still computed by the simulation. |
| **Engines** (`Engine2D`) | One drawing with small changes. | Built from real parts:<ul><li>block, sump, heads, ribbed cam covers, coil packs or plug leads;</li><li>plenum and runners, or individual throttle trumpets on racing engines;</li><li>headers into a collector, belt drive with pulleys and straps;</li><li>turbos (turbine and compressor housings, charge pipes) or a roots blower;</li><li>bell housing, hybrid motor with orange HV cables;</li><li>EV drive unit with motor, inverter and battery modules.</li></ul>Inline, V (with the real bank angle per layout), flat and EV engines each have their own silhouette. Discreet technical labels (HV 400 V, HYBRID) mark them. |
| **Parts** (`Parts2D`) | Flat icons. | Chassis:<ul><li>ladder frame;</li><li>steel or aluminium monocoque (with cast nodes);</li><li>tubular space frame;</li><li>carbon tub with subframes and hoop.</li></ul>Gearboxes:<ul><li>manual with shifter;</li><li>automatic with converter and cooler lines;</li><li>dual clutch with mechatronic unit;</li><li>one rib per gear.</li></ul>Suspension corners: solid axle with leaf springs, MacPherson, double wishbone and multi-link, with coil-overs.<br>Brakes: finned drum; solid, vented and drilled discs; carbon-ceramic with a gold six-piston calliper.<br>Tyres: rim and compound band, width from the spec. |
| **Headquarters** (`Campus2D`) | Blocks on a floating tile. | A place:<ul><li>the town around the site, with its roads continuing;</li><li>sidewalks, a zebra crossing, street lamps and hedges;</li><li>parking lots with isometric cars, and isometric cars driving the roads;</li><li>roof plant, curtain-wall mullions and an entrance canopy;</li><li>a racing-division garage by the track;</li><li>fenced plots for what can still be built (plants, dealers, test track).</li></ul>Growth still follows the real company. |
| **Factory** (`FactoryLine2D`) | Flat side elevation with small icons. | A perspective cut-away hall with seven distinct bays:<ul><li>coils, pallets and a forklift;</li><li>a stamping press with welding robots or crews in hard hats;</li><li>a glass paint booth with spray robots;</li><li>engines on stands under a hoist;</li><li>tyre stacks;</li><li>a light tunnel over a rolling road;</li><li>a car transporter.</li></ul>Robots replace workers as automation rises. Each bay's floor glows with its real load, and the bottleneck pulses. Bays are clickable, and there are keyboard buttons below. |
| **Chests and cards** (`Rewards2D`) | Flat chests. | Each rarity is a different 3D build:<ul><li>common: wood with iron bands;</li><li>rare: steel blue with silver bands;</li><li>epic: violet lacquer;</li><li>legendary: black with gold corner caps and a crown;</li><li>mythic: crimson with gold and gems;</li><li>relic: translucent crystal around a glowing core, with floating shards.</li></ul>When opened, the lid swings back and light pours out. Glow, rays and sparkles grow with rarity. Cards show the new engine and part art. Odds and rules are unchanged. |

## Performance

Measured with Playwright and Chromium against `vite preview` (headless, this container's CPU):

| Screen | SVG nodes | Time to open (click → second frame) |
|---|---|---|
| Main menu hero | 512 | switching cars 55–140 ms |
| Headquarters | ~1,350 | 21–38 ms |
| Workshop, engine stage (10 engine cards, catalogue, preview) | ~7,200 | ~200 ms the first time, 70–110 ms later (engine drawings are cached and shared) |
| Factory | ~935 | 13–28 ms |
| Chests tab (six chests) | ~760 | 48 ms |

- **Batching:** facets inside one convex solid never overlap, so they are merged by quantised colour into one `<path>` per colour. The hero car is about 340 paths instead of about 3,900.
- **Download size:** the art is generated, so its download cost is code, not images. The main JS bundle is 803 kB (259 kB gzip), against 786 kB / 252 kB measured after the hero car alone. The engine, parts, factory and chest rewrites add about 7 kB gzip. The PR #14 head was not measured separately. No image, font or model file was added.
- **Blur:** blur filters are limited to the floor shadow and lamp bloom. There are no full-screen filters.

## Higgsfield references

Checking the reference job named in the previous version of this file (`8fa3da92-…`) was **denied in this session**. No reference image was opened, so none was used. The current art is original work judged on browser screenshots.

## Quality gates (kept)

- Zero gameplay regressions: `npm run ci` passes (550 tests) and `npm run test:e2e` passes (14 browser tests, desktop and 390 px phone).
- No WebGL, GLB or remotely hosted images in the 2D path. Unique SVG ids per instance.
- Every action is a real, keyboard-reachable control. No clickable raster images.
- No real logos or brand marks.

## Still to do

- **Car silhouettes:** the perspective car has one design per body type. Front fascias and lamp signatures could vary by era and maker class.
- **Race cars:** motorsport still uses the older poster art (`ds/poster.tsx`). A formula and prototype model in the renderer would unify it.
- **Wheels:** the catalogue side views (`Car2D`) and wheel cards remain flat vector. They match the palette but not the perspective shading.
- **Phone factory:** on a phone the factory hall scrolls sideways inside its frame, and the sector buttons below it carry the actions. A taller, phone-specific composition would be better.
- **Workshop engine stage:** this is the heaviest screen. Lighter engine models for the small option cards would cut its DOM roughly in half.
