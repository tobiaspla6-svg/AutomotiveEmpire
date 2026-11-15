# Automotive Empire — Phase 5D: visual quality and the first modular GT

**Status: draft.**
- Branch: `phase5d-modular-gt`, built on `phase5c-flow-screens` (PR #15).
- PR target: `phase5c-flow-screens`.
- Nothing was merged; `main` and the earlier branches were not touched.

**Provenance, said plainly.** Google Flow did not deliver any part variants. The approved GT-01 original is the only GT art there is. Every variant below was produced by technical editing and drawing on that original's geometry, with the same canvas, anchors and perspective (`scripts/flow/make_gt01_parts.py`). No generative model and no Higgsfield were used.

## 1. Visible defects corrected

Each defect was checked in the captures in `docs/phase5c-flow/screens/` before any change. The before/after sheets are in `before-after/`: the left side is Phase 5C and the right side is this branch, same script, same game.

| Defect (Phase 5C) | Fix | Check |
|---|---|---|
| **Studio at 1280×720.** The parts tray ended at y = 1153, below the fold. | Above 1100 px the studio is a fixed-height grid (`100dvh − 122px`). The stage scales with container units, the side columns scroll inside themselves, and the tray height is fixed. | Tray bottom: 673 / 720 at 1280×720, 853 / 900 at 1440×900, 1033 / 1080 at 1920×1080. Covered by the e2e test `studio at 1280x720`. |
| **The car changed size between part categories.** The tray height followed its contents. | Fixed tray height (196 px, or 168 px on short screens). | The proof captures at 2× are pixel-identical in size across all categories. |
| **Soft, smeared walls behind the car** (workshop and garage); skewed cabinet drawers and a streaked tyre rack in the garage. | `prepare_backgrounds.py`:<br>• the wall texture is relit from a multi-scale illumination field;<br>• periodic panels are tiled by their measured period (24 px, and 38 px for the cabinet);<br>• the cabinet drawers and tyre rack are continued row by row from their clean side. | `before-after/bg-garaje.webp`, `before-after/bg-taller.webp` (the backgrounds alone, where the difference is visible) |
| **Specks under the GT-01 sill**, at the shadow line. | `prepare_gt01.py`:<br>• each column ends at the first light row under the sill;<br>• a morphological opening outside the tyres removes the specks;<br>• the shadow alpha is smoothed. | `qa.json`: `partialBodyPixelsUnderSills` = 0; recomposition mean error 0.42 levels. |
| **Speckled repaint on the sill** (found in this phase's own captures). | The charcoal sill strip sat at the blue-hue threshold of the paint mask. Below the belt the hue test is now stricter, a 5×5 median is applied, and islands under 80 px are dropped. The pearl layer is set to 0.5. | `proof/sill-before-after.webp` (5C mask vs. now), `proof/finish-pearl.webp` |
| **Old and non-GT cars looked like toys next to the GT-01.** | `Car2D illustrated`: ink contour, panel volume gradients, contact shadows, tyre gradient and sidewall highlight. Used in the garage, studio and factory queue. | `before-after/05-garaje-*.webp`. Better, but **still clearly below the GT-01's quality**: a vector side view cannot match an illustration. |
| **Ghost of the original car's roof** in the workshop background (a thin dark arc just outside the removed area). | The hole is grown by 12 px (`grow: 25`), so the outline is reconstructed too. | `before-after/bg-taller.webp` |
| **Parts tray cut its own text** once the tray had a fixed height (found in this phase's captures: up to 90 px of the reason text hidden). | On desktop each option is a horizontal card (thumbnail left, name and state right). Thumbnails are contained, not cropped, and the roof thumbnail is centred on the glass. | `screens/03c-taller-techo-1280.webp`, `-1920.webp`. The e2e test checks that every option fits. |
| **Factory queue thumbnails** used the flat cars. | Now `VehicleArt`: GT-01 when the family and era match, otherwise the illustrated vector car. | `before-after/04-fabrica-1920.webp` |

## 2. The first modular GT

All the variants share the base GT-01 canvas (1376×768) and its anchor version `gt01-native-1`. They are listed in `public/flow/gt01/parts.json`.

| Slot | Original (base drawing) | Variant (new layer) | How it was made |
|---|---|---|---|
| Wheels | Twin five-spoke | **Multi-spoke** (front and rear) | The original tyre is kept pixel for pixel (r ≥ 77.5). The rim is redrawn inside it: 10 spokes, hub, caliper. |
| Headlamps | Slim LED | **Matrix** (7 cells and a blade) | Drawn inside the original lamp opening. |
| Handles | Conventional | **Flush** (body colour, with its own paint mask) | The old handle footprint is inpainted, then a flush handle is drawn with a light line and a recess. |
| Front bumper | Standard | **Sport** (larger intake, mesh, splitter) | Drawn over the original opening, smoothed along its lower contour. |
| Roof | Fixed | **Panoramic glass** | Glass follows the measured roof line, at the median panel depth, with tapered ends. 0 pixels above the roof line, so the silhouette is unchanged. |
| Finish | Metallic | **Solid, pearl, matte** | Masked CSS layers over the same paint mask. |

**Verification.** No part is called swappable until a real composition proves it.

The verification runs at two levels.

**1. Python, on the native canvas.** `make_gt01_parts.py` composes the base and each variant, then counts the pixels that change outside the region the part is allowed to touch.

| Variant | Changed px | Outside region |
|---|---|---|
| Multi-spoke wheels | 37,656 | 0 (tyres: max difference 0, alpha difference 0) |
| Matrix headlamps | 3,197 | 0 |
| Flush handles | 1,868 | 0 |
| Sport front bumper | 5,710 | 0 |
| Panoramic roof | 6,869 | 0 |

**2. The real game in the browser.** `e2e/proof-gt01.cjs` opens the studio, picks each variant through the real buttons, screenshots only the car at 2× (2192×1224), switches back, and repeats. `e2e/proof-gt01.py` measures each capture against the base.

| Variant | Changed px (2×) | Outside region |
|---|---|---|
| Multi-spoke wheels | 89,549 | **0** |
| Matrix headlamps | 7,744 | **0** |
| Flush handles | 3,425 | **0** |
| Sport front bumper | 11,096 | **0** |
| Panoramic roof | 17,572 | **0** |
| Back to base | 0 | **0** |

This means:
- the body never changed by accident;
- every variant is cleanly reversible.

Sheets:
- `proof/sheet-variants.webp`: base | variant | difference map, with the allowed region outlined.
- `proof/sheet-finishes.webp`: the four finishes, plus red with every variant fitted.
- The individual captures (`proof/*.webp`) and `proof/proof.json`.

The numbers were measured on the lossless PNG captures. The WebP copies kept in the repo are for viewing.

## 3. In the simulator

- **Saved per vehicle.**
  - Parts and finish are stored in `Company.designs[modelId]` and survive the autosave.
  - The e2e test `modular GT` goes studio → save → garage (large view and thumbnail) → headquarters → studio → quit → reload the page → resume → garage. The variants and finish are recovered at every step, and another vehicle keeps its own configuration.
- **Incompatibilities.**
  - `fitProblems()` applies the same rules as the disabled buttons inside `saveVehicleConfig`, so an open roof can no longer be saved through any path.
  - Soft top and retractable hard top belong to the `gt01-open` family, which has no art. They stay disabled with the reason ("Necesita otra estructura…") and the simulation refuses them.
  - The solar panel needs an electrified model. If a stored part stops fitting (for example, the model loses its hybrid system), that slot falls back to its default and the rest is kept.
- **Old saves.** Saves without `designs`, or with 5C configurations, load unchanged (`saveDamage` = null). Validation was not tightened in any way that would refuse an old save.
- **No effect on the economy.** Saving a configuration does not touch money, the specification or the simulation. No formula changed.

## 4. Tests

- `tests/gt01-modular-5d.test.ts` (13 tests), on the manifest and the composition QA:
  - same source hash, canvas and anchors;
  - every file present and inside the canvas;
  - 0 changed pixels outside each region;
  - identical tyres;
  - wheels on the measured axle centres;
  - only verified parts marked `layer`.

  It also covers:
  - `GT01Car` rendering each variant, the wheels on both axles, and everything together;
  - two vehicles with different configurations through a JSON round trip;
  - open roofs refused by the simulation;
  - the solar roof rule, and the fallback to the slot default;
  - the studio and garage showing the saved configuration.
- `tests/flow-5c.test.ts`: the art-state test is updated to the new layers. The five-spoke wheel, canvas sunroof, open roofs and solar panel are still `missing`.
- e2e (`e2e/run.cjs`), two new tests:
  - `modular GT: … recovered in garage, studio and after reloading; open roofs refused`;
  - `studio at 1280x720: the stage and the parts tray fit the window` (wheels, roof and paint categories; no horizontal scroll).
- Results on this branch:
  - `npm run ci`: typecheck, 46 test files and 579 tests passed, build passed.
  - `npm run test:e2e`: 17 of 17 browser tests passed.
  - `e2e/proof-gt01.cjs`: 0 page errors.
  - `e2e/shots-flow.cjs`: 0 console errors at 1920, 1440, 1280 and 390 px.

## 5. Performance

- **Variant layers:** 75 kB in total for the seven files plus the handle mask. They load only when a variant is chosen.
- **Whole `gt01` folder:** 234 kB.
- **Test budget:** the unit test caps the variants at 200 kB.
- **Swapping a part:** one `<img>` and, for the handles, one masked layer. No canvas work and no re-layout of the scene.
- **Measured with `screens/metrics.json`** (same method as Phase 5C):
  - Flow assets for a full session: 669 kB, against 657 kB in 5C (the extra 12 kB are the variants shown in thumbnails).
  - JS: 348 kB transferred, against 346 kB.
  - Switching to a Flow screen: 13–37 ms.

## 6. Still missing (no art for it, so nothing is faked)

- **Five-spoke wheel, canvas sunroof, solar panel, camera mirrors, sport body kit, spoilers.** These stay in the data model, can be saved, and the studio says "Se guarda; sin representación todavía".
- **Open-top family (`gt01-open`).** Soft top and retractable hard top need their own body. Until it exists they are disabled and refused.
- **Interior canvas.**
- **Illustrated art for SUV, pickup, hatchback and older eras.** The improved vector cars are a stopgap.
- **Backgrounds.** Clean workshop and garage backgrounds without a reconstructed wall. The wall is better than in 5C, but it is still reconstructed.

## How to reproduce

```bash
scratchpad/venv/bin/python scripts/flow/prepare_gt01.py <user-gt-blue-original.jpg> public/flow/gt01
QA_IMAGES=/tmp/qa scratchpad/venv/bin/python scripts/flow/make_gt01_parts.py <user-gt-blue-original.jpg> public/flow/gt01
npx vite build && node e2e/proof-gt01.cjs docs/phase5d-modular/proof
node e2e/shots-flow.cjs docs/phase5d-modular/screens
python3 e2e/before-after.py docs/phase5c-flow/screens docs/phase5d-modular/screens docs/phase5d-modular/before-after
```
