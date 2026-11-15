# Automotive Empire — Phase 5C: the Google Flow screens in the game

**Status: draft.**
- Branch: `phase5c-flow-screens`, built on `phase5b-premium-2d-art-direction`.
- PR target: `phase5b-premium-2d-art-direction`. Not merged.
- `main` was not touched.

**Sources.**
- Visual references: branch `art/flow-reference-20261115-01a1dd27`, folder `design-assets/flow-reference-20261115/`.
- GT production: branch `art/production-gt01-20261115-01a1dd27`, folder `production-assets/`.

Both were read and their files checked before any work. The originals were neither modified nor copied into this branch. Only derived files are in this branch, each recorded with its source hash.

## What was built

| Screen | Flow reference | Live controls (React) | Data / actions behind them |
|---|---|---|---|
| Inicio | `01-inicio/E-garaje-refinado.jpg` | Continuar, Nueva partida (the 3 modes), Cargar partida (list, delete, import), gear → settings, language | Real saves. Continuar is disabled with the reason when there is none. Nueva partida warns before the autosave is replaced. |
| Sede | `02-headquarters/A-campus.jpg` | 7 pins: Oficinas centrales, Taller de diseño, Investigación, Fábrica, Garaje, Concesionarios, Motorsport. Destination bar: Sede / Taller / Fábrica / Garaje / Cofres. | Each pin opens an existing screen and shows live data. Buildings the company has not developed are shaded and their pins greyed. |
| Taller de diseño | `03-taller/A.jpg` | 12 categories, large GT-01, paint swatches and finish, parts tray, separate interior view, Deshacer / Rehacer / Restablecer, unsaved marker, Guardar, vehicle selector | Structured configuration per vehicle (`sim/vehicleConfig.ts`, stored in `Company.designs`). Mechanics open Ingeniería, where the simulator's rules apply. |
| Fábrica | `04-fabrica/A.jpg` | 4 stations with load meter, % and bottleneck; production queue; Iniciar | The plant's real stages (`stagesOf`, `bottleneck`). Iniciar = `addLine`, with the tooling cost confirmed first, or disabled with the reason. The existing sector panel (expand, inspection, automation, enlarge) is kept below. |
| Garaje | `05-garaje/A.jpg` | Volver, sheet with explicit-scale bars, collection tray, Personalizar | Only vehicles built or finished. Personalizar opens the studio on that vehicle; the same configuration shows in both places. |
| Cofres | `06-cofres/B.jpg` | Chest tray by milestone (name, symbol and state, not colour alone), Abrir, Reclamar / Reclamar y equipar, Saltar animación, odds | Existing rules: `openSalesChest` is called once and the button is disabled while opening. There is no purchase. |
| Configuración | `07-configuracion/A.jpg` | Audio, Video, Juego and Accesibilidad tabs; Aplicar / Volver with Guardar / Descartar / Cancelar; Restaurar | Only real options: effects on/off and volume (master × effects), 3D quality presets and performance test, full screen, interface scale, language, reduced motion, high contrast. Preferences are kept in this browser, never in the save. |

**Left out on purpose.** Music, subtitles and a resolution selector are not offered: the game has no music or voices, and a browser cannot set the screen resolution. A "Salir" button is also left out, because a browser tab cannot close itself.

**Navigation on scene screens.** The side navigation shrinks to icons so the scene has the room.

## How the Flow images were used

The seven originals are flat images with generated text, buttons and invented numbers. None is used as-is behind controls. `scripts/flow/prepare_backgrounds.py` derives each scene by:
- cropping away the generated menus, headers and trays (React replaces them);
- reconstructing small covered areas (pins, labels, a card, a title) with OpenCV inpainting;
- removing the reference car in the workshop and garage by structure-guided reconstruction (wall continued from above, floor interpolated row by row), so the selected vehicle can stand there.

No generative model was used. `public/flow/bg/provenance.json` lists each source hash, crop and rectangle.

| Scene | Size | Result |
|---|---|---|
| inicio | 917×768, 59 kB | Clean: the menu panel was cropped. |
| headquarters | 1376×578, 131 kB | Small inpainted patches where the pins were. React pins sit over them. |
| taller | 1060×516, 16 kB | **Approximate**: the area behind the removed car is soft and blurry, and the GT-01 covers most of it. |
| fabrica | 1376×556, 124 kB | Blurred bands where the English station signs were. The React station signs sit over them. |
| garaje | 944×600, 25 kB | **Approximate**: brick and cabinet were continued from above. A small seam is visible at the cabinet and the tyre rack. |
| cofres | 1376×636, 70 kB | Title, BACK and the generated card were inpainted. A soft light streak remains where the card was. |
| configuracion | 1376×768, 11 kB | The panel area was inpainted and the image blurred, as in the reference. The React panel covers it. |

## GT-01 (blue fastback)

**Source.** `production-assets/gt-blue-v1/sources/user-gt-blue-original.jpg` (1376×768 JPEG, no alpha, sha256 `d5ff9b7b…`).

**What was derived.** `scripts/flow/prepare_gt01.py` produced the following from that one file, without generating any pixels:

| Layer | What it is |
|---|---|
| `body.webp` | The car with a **real alpha channel**. The backdrop was removed by flood fill from the border; edge pixels were un-mixed from the backdrop colour, so there is no light halo on dark scenes. |
| `shadow.webp` | Separate shadow layer, measured as the darkening of the floor. |
| `wheel-front.webp`, `wheel-rear.webp` | The original wheels, cut as discs at the **measured** centres (321.5, 478.5) and (1052.5, 477.5), r = 92.1 (handoff values, ±3 px). Their holes in the body are filled with the arch's dark colour. |
| `paint-mask.png` | Blue body paint selected by hue and saturation; glass, tyres, rims, lamps and black trim are excluded. Used to repaint with CSS blending, so the original shading is kept. |
| `anchors.json` | `bodyFamilyId: gt01-fastback`, `anchorVersion: gt01-native-1`, wheel anchors, ground line, and the candidate 1600×700 transform. The transform is still a candidate and was not exported. |
| `qa.json` | Recomposing the layers on the original backdrop gives a mean difference of 0.26 levels, p99 2.0, and 755 pixels above 16 levels (out of 1.06 M). |

**What it is NOT.**
- These are **not** approved modular parts. Flow never delivered the A–D bases or any part variants, and the handoff says so.
- Only two things change independently:
  - the **wheels**, which are separate layers, but there is only one design;
  - the **ride height**, which moves the body and shadow against the fixed wheels.
- Handles, mirrors, lamps, bumpers, grille, roof and spoiler are drawn **inside the base body layer**. The studio marks them "Dibujada en la carrocería base; no intercambiable todavía".
- Alternatives such as multi-spoke wheels, matrix lamps, flush handles, panoramic roof and solar roof are in the data model. They can be recorded, but the studio states that they are not drawn ("Elegido pero sin dibujar (falta asset)").
- Open roofs (soft top, retractable hard top) belong to the family `gt01-open`, which has **no asset**. They are disabled with that reason; no layer is hidden to fake them.
- Finishes other than metallic are saved, but the layer is metallic and the studio says so.

**Where it is used.** The GT-01 represents the saloon and coupé family designed in **2005 or later**. Other bodies and eras use the existing vector side views, labelled "Representación vectorial provisional". This avoids presenting a 1990s saloon as a modern fastback; the garage card names the art family it uses.

## Tests

- `npm run typecheck`, `npm test` (45 files, 566 tests) and `npm run build`: all pass.
- `npm run test:e2e`: 15 browser tests pass in Chromium. New or rewritten:
  - the Flow menu, including the settings draft and its unsaved-changes guard;
  - the 2D loop: studio paint, ride height, undo, redo, the disabled open roof, save, then chest open and claim, and the factory station;
  - the garage: Personalizar opens that vehicle, and its saved paint shows in the garage;
  - the phone layout at 390 px.
- `tests/flow-5c.test.ts`:
  - **Layers:** source hash, alpha, sizes, wheel mounting at the anchors (≤ 0.5 px), and ride height that leaves the wheels in place.
  - **Backgrounds:** provenance and sizes.
  - **Configuration:** validation, compatibility, a JSON round trip, save-load validation, old saves without designs, and no effect on money or the specification.
  - **Screens:** each renders with the expected controls.

## Screenshots and comparisons

- `screens/`: real captures from the build in Spanish at **1920×1080, 1440×900, 1280×720 and 390×844**. The game is a Toyota CEO game in 2024 after two months. Captures were taken as PNG and converted to WebP q86 for the repository.
- `screens/compare/`: each Flow original beside the 1920 capture, plus a 50 % overlay with the capture fitted (not stretched).
- `before-after/`: the PR #14 head beside this branch.
- Scripts: `node e2e/shots-flow.cjs <out> <design-assets dir>` takes the captures, and `python3 e2e/compare-flow.py` builds the comparison sheets.

### Known defects (from the captures)

- **Scene inside the game shell.** The game keeps its top bar, so no screen fills 1920×1080 the way the flat references do. At 1280×720 the studio's parts tray is below the fold.
- **HQ growth.** Growth can only be shown by shading and pins; the buildings themselves cannot grow without new art.
- **Workshop and garage backgrounds.** The reconstructed wall behind the car is soft. Some speckle remains under the GT-01 sill at the shadow line.
- **Garage on non-GT families.** SUVs, pickups and hatchbacks use the flat vector side view. It does not match the illustrated garage and looks toy-like next to it.
- **Cofres.**
  - Only one chest drawing exists (the green trunk). Tiers in the tray are colour variations of it, with a name and symbol for each.
  - There is no closed state of that trunk, because closed and open would need matching art.
  - On a phone the reward card in the scene is small.
- **Factory.** The four stations map to the sim's stages: Bastidor y mecánica ↔ powertrain, Carrocería ↔ body, Pintura ↔ paint, Montaje final ↔ assembly. Inspection, materials and dispatch stay in the tabs below.
- **Mobile.** No mobile proposal was generated in Flow, so the phone layouts are adaptations (stacked scene, icon pins with a named list underneath).

## Performance (measured, headless Chromium, `screens/metrics.json`)

- **Flow assets downloaded by the end of a full session:** 657 kB in total, covering the 7 backgrounds and the GT-01 layers. They load only when their screen opens.
- **JS bundle:** 346 kB transferred.
- **Switching to a Flow screen:** 16–34 ms (click → second frame).
- **DOM nodes:** 240–1,220 per screen.
- **JS heap:** 10–17 MB.
- No video was added. The animations (sparks, mist, chest burst) are CSS only and stop under reduced motion.

## Still pending (needs art that does not exist yet)

- **GT-01:** approved base (A–D), part variants on the same anchors (wheels, lamps, bumpers, handles, roofs), and the open-top family. This is blocked in Flow ("actividad inusual"); see `ASSET_HANDOFF.md`.
- **Interior:** canvas and anchors.
- **Backgrounds:** clean versions of all seven without reconstruction, especially the workshop and garage without a car.
- **Other vehicle families:** the green SUV of the start screen as a separated, side-view asset, and illustrated art for SUV, pickup, hatchback and older eras.
- **Chests:** matching closed and open states of one trunk, and per-rarity materials.
