# AE-01 open bonnet and engine bay — experimental visual asset

This is a **Blender prototype**, not a new vehicle specification and not yet a production game asset.

## What exists

- The original Phase 4 reference sedan is rebuilt with the original Blender source.
- A 2,548-face patch is separated from the body shell as `AE01_HOOD_OPENABLE`.
- The bonnet has a rear hinge at `(0.985, 0, 0.932)` in the source's Blender coordinates:
  frame 1 shut, frame 42 rotated **−57°** around Blender Y.
- The newly opened space contains a detailed illustrative **V6**, firewall, structural rails, suspension towers, intake, manifolds, accessory drive, airbox, battery and brace.
- `AE01_HOOD_UNDERSIDE` follows the animated bonnet, with separate under-bonnet material.
- The main sedan geometry outside the selected hood patch is unchanged.

The V6 is **illustrative**, not a CAD replica of a production engine. Automatic switching between engine configurations must be driven by game-side visuals (the separate PR #9 introduces a standalone interactive powertrain inspector). The open-bonnet prototype does not change horsepower, costs, vehicle design parameters or save format.

## Rebuild on a computer with Blender installed

```bash
blender -b --python tools/blender/sedan/build.py -- --no-ao
blender -b --python tools/blender/sedan/hood_engine.py
```

The second command loads `assets-src/sedan-ref/sedan.blend` and writes separate files:

- `assets-src/sedan-ref/sedan.hood-engine.blend` — editable geometry, rig and keyframes
- `assets-src/sedan-ref/sedan.hood-engine.glb` — experimental animated export

It **does not overwrite** `public/assets/vehicles/sedan-ref/sedan.lod*.glb` or `wheels.glb`. The game continues using its existing production assets until the new GLB is reviewed and deliberately integrated.

## Hosted Blender prototype

The same extraction and engine-bay construction operations were executed and committed in Blender **5.2** using a hosted 3D workspace:

[Open AE-01 prototype in 3D Jutsu](https://higgsfield.ai/3d-jutsu/16ef547f-58fb-4eac-bbce-1c0e528bd5b6)

Structural verification: original shell regenerated with 239 mesh objects; hood extraction retained 2,548 hood faces and 51,228 shell faces; keyframed opening 0° to −57°; engine crankcase exists in the bay. The hosted scene contains 294 objects and editable `.blend` and `.glb` exports.

A Blender Workbench still was generated, but client-side visual inspection and real-GPU performance validation are still outstanding. Do not mark this prototype approved for the game without those checks.

## Required before game integration

1. Inspect the open bonnet from front ¾, side, top, and closed views for visible gaps, collisions and wall thickness.
2. Check both closed and open animation frames in Blender and the browser.
3. Reduce draw calls and meshes for High/Medium/Low graphics presets.
4. Build interchangeable engine-bay assemblies (I3/I4/I6/V6/V8/EV) driven by the actual `VehicleSpec`.
5. Extend the asset contract and viewer with an `openBonnet` interaction, preserving the fallback for procedural cars.
6. Verify the final packed GLB, material slots, animations and game E2E tests before merging.
