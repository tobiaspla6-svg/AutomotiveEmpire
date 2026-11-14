# AE GT-RS v2: genuine Blender mesh redesign

**Status:** working editable 3D prototype in draft. This is not a 2D concept or image-derived illusion.

Hosted Blender scene: https://higgsfield.ai/3d-jutsu/ade7eac9-ef5b-4462-bfc7-32d4478e38cd

## What changed relative to GT-RS v1

The actual Blender geometry was modified with these reproducible scripts:

| Script | Blender geometry |
|---|---|
| `05_organic_surfacing.py` | Raised shoulder lines, waisted side panels, reshaped articulated bonnet, real grille cavity, revised front lamp lenses |
| `06_sculpted_fenders.py` | Curved front-guard bridges, swept door tops, rear haunches, integrated road-GT spoiler and non-boxed side skirts |
| `07_rounded_nose.py` | More rounded front and rear corners, curved front splitter matching bumper rather than a protruding cuboid |
| `08_engine_sculpt.py` | Sculpted 90-degree V8 cam covers, real lofted carbon intake, spiral turbocharger volutes, compressor blades, fasteners and heat shields |
| `09_fastback_and_grille.py` | Lower, cab-rearward GT roof/glass profile; dark smoked windows; re-cut trapezoid mouth with 17 3D slats |
| `10_hero_performance.py` | Turbo V-band rings changed from over-tessellated curves to small meshes; bevel/curve subdivisions limited; unneeded side subsurf removed |

**Measurements from hosted Blender 5.2:**

- Geometry after styling pass, before optimization: **255,892 evaluated triangles**.
- Geometry after optimization: **170,188 evaluated triangles**, including curve tessellation and evaluated modifiers, approximately **33.5% lighter**.
- Hood remains a distinct `GT_HOOD_ARTICULATED` mesh animated from **0° to −54°** between frames 1 and 40.
- An independent engine-hood envelope test after all surfacing and V8 adjustments found **zero motor mesh vertices above the closed bonnet clearance envelope**.
- The realistic and road-going exterior uses a subtler integrated rear lip. The very large motorsport wing from v1 is deliberately excluded from this default road-GT GLB.
- Original 4.60 m-class GT and longitudinal V8 positioning retained.
- All changes are in actual bpy geometry; cameras/materials/objects are editable and GLB-exportable.

## Browser game asset strategy

Run from repository root with Blender installed:

```bash
blender -b --factory-startup --python tools/blender/hero_gt/build.py
python3 tools/blender/hero_gt/check_assets.py dist/hero_gt
```

The build emits `AE_GTRS_HERO.blend` and compressed full/split GLBs in three LODs. The standalone engine GLB should be **streamed only when inspecting/opening the bonnet**, while ordinary showroom/car cards use the appropriately reduced body-only LOD.

The `GT Hero Blender assets` GitHub Actions workflow also builds and uploads these files as artifacts. These assets intentionally **do not overwrite** existing sedan assets and do not change vehicle simulation or physics.

## Visual validation and remaining gap

The updated mesh was inspected with actual Blender Workbench and EEVEE camera renders (not AI-generated images). The initial render had a camera-marker bug in the hosted scene; the frame-1 marker was corrected to the whole-car `CAM_front34` view.

The model has made measurable progress in shape and mechanical construction, but still **does not match the photoreal Mercedes-AMG GT photography or dense V8 marketing CGI reference**. The remaining gap is high-end Class-A body surfacing, actual sculpted headlights, realistic glass PBR, proper image-based reflections/lighting, UVs, and baked physically based textures. Achieving the reference quality requires human visual surfacing and texture validation, not merely more procedural bolts.

Before game integration, validate exported GLBs in Three.js, headlight/bonnet collisions, frame-1 and frame-40 animation, dynamic loading, mobile/desktop FPS and memory, and a visual review of all three LODs. Do not mark this as production-approved or merge the draft without that review.

## Branches

- Source: `visual-gt-hero-surfacing-v2`, stacked on `visual-gt-hero-production`.
- The published game, `main`, and prior branches remain unchanged.
