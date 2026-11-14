# Automotive Empire GT-RS — High-detail, low-weight original GT

**Status: visual-production prototype, not approved for gameplay merge.** Source modelling and structural verification were performed with hosted Blender 5.2; the production build pipeline is part of this draft PR.

## Target references supplied

1. Track-focused yellow modern GT: shallow roof, wide track, large brakes, multi-element headlamps, aggressive front aero, open-depth grilles, real wing supports and a clean hard-surface paint finish.
2. High-detail V engine: convincing 90° bank architecture, cam covers, fasteners, engine casting, intake, exhaust primaries, turbo housings, accessory drive, pulleys, wiring, hoses and manufacturing materials.
3. Production premium sedan: separate subsequent asset; **not** part of this GT build.

The AE GT-RS is an **original design**, not a copy or rebadge of Porsche, Honda or Italtecnica.

## Original model built

- Approximate GT envelope: **4.60 × 1.98 × 1.34 m**, with a **2.70 m wheelbase**.
- Split bonnet, real radial wheel arch openings, shaped front grille, three projectors per front lamp, side vents, rear bar, carbon splitter, side sills, rear diffuser, raised supported rear wing.
- Four bespoke Y-spoke forged wheels; 4 ventilated rotors, large front caliper shapes, tire volume with sidewall and tread channel details.
- 2-door GT cabin, carbon bucket seats, upholstery, steering wheel, center display, sealing, glass, windshield wipers and handles.
- Rebuildable **4.0L V8 twin-turbo** presentation engine: angled cylinder banks, two turbos, eight separate intake runners, headers, valve covers, coil modules, fuel rails, timing drive, pulleys, serpentine belt, alternator, airboxes, intercooler, cooling hoses, wiring and suspension bay structure.
- Cosmetic realism without physical CAD claims. Engine geometry is illustrative; no engine-performance/vehicle-cost/gameplay code was changed.

The bonnet opens between frames **1 and 40** to 54 degrees. Every piece is still editable in the source Blender scene.

## Grounded measurements, Blender 5.2 hosted scene

| Measurement | Observed |
|---|---:|
| Final source mesh triangles (excluding geometric evaluation of curves) | **68,912** |
| Total Blender objects including cameras/lights | **432** |
| Material datablocks | **32** |
| Committed hosted GLB size | **4,215,764 bytes** |
| Native Blender source size | **6,638,469 bytes** |
| Evaluated mesh + curve + modifier triangles, LOD0 | **145,728** |
| LOD1 evaluated triangles (dry run) | **113,727** |
| LOD2 evaluated triangles (dry run, after engine batch reduction) | **64,397** |
| Experimental BODY-only GLB | **1,429,228 bytes** |
| Experimental ENGINE-only GLB | **1,305,356 bytes** |
| Tested body animations | **1 track, bonnet node present** |
| Engine versus closed hood vertex penetrations | **0** (post-correction sample) |

**Caveats:** The raw 68,912 triangles count excludes curves and evaluated modifiers; the later evaluated LOD counts include them. The final packaged artifacts are still subject to build verification. Zero intersections is a targeted per-vertex hood-envelope check, **not** a full vehicle collision-detection or manufacturability certification.

## Rebuild and export

Run this on a machine with Blender installed:

```bash
blender -b --factory-startup --python tools/blender/hero_gt/build.py
python3 tools/blender/hero_gt/check_assets.py dist/hero_gt
```

The build creates the editable `AE_GTRS_HERO.blend`, three **combined** GLBs (LOD0/LOD1/LOD2), six **split** GLBs (body and engine at three LOD levels), and technical review renders. The GitHub workflow `gt-hero-assets.yml` can package the outputs as a downloadable Actions artifact without committing large binaries to the playable branch.

## Critical optimization design

The game should load `AE_GTRS_BODY_LOD*.glb` first, then load `AE_GTRS_ENGINE_LOD*.glb` only when the player requests **open bonnet / powertrain inspection**. The two exports use the same world coordinates and align by design. The editor can use full resolution; distant/menu previews should use LOD1 or LOD2.

**Target budgets (not all verified as achieved yet):**

| Resource | Hero/LOD0 | Standard/LOD1 | Distance/LOD2 |
|---|---:|---:|---:|
| Combined GLB max | 16 MB | 12 MB | 8 MB |
| Observed evaluated geometry (includes curves) | 145,728 tris | 113,727 tris | 64,397 tris |
| Body shading | full | reduced | simplified |
| V8 wiring/fasteners | complete | reduced | simplified or hidden |
| Motor downloaded if hood shut | no, on-demand | no, on-demand | no, on-demand |
| Animation | bonnet retained | bonnet retained | bonnet retained |

The LOD build also batches static engine meshes by PBR material. Important animated surfaces (hood, glass) remain separate.

## Visual acceptance criteria

Do **not** call the GT production-ready merely because Blender exported its meshes. Need to verify actual renders and browser views at all three LODs, comparing front ¾, side, hood open and tight engine details to the supplied references:

- Correct silhouette, plausible body surfacing, unbroken reflections, convincing panel gaps and lamp depth
- Recognizable brake package, believable tire contact, clean glazing and cockpit
- Engine intake, turbo routing, fasteners and accessory belts legible in the hood-open camera
- No gaps, clipping, penetration or bad normals when hood is closed/opened
- Material consistency between the .blend render and browser GLB (procedural bump nodes may not travel in glTF)
- Desktop GPU performance, memory load times, GLB draw calls, texture usage and switching without broken fallback

**Current limitations:** appearance has not been independently approved against the photoreal references; EEVEE stills and Workbench previews are useful but not a real-game GPU benchmark. The full GT is not yet connected to the playable vehicle catalog. No changes to `main`.

## 3D model and code

- Hosted editable [GT-RS 3D project](https://higgsfield.ai/3d-jutsu/ade7eac9-ef5b-4462-bfc7-32d4478e38cd)
- Build code: `tools/blender/hero_gt/`
- Original sedan with animated bonnet, separate preliminary prototype: [AE-01 3D project](https://higgsfield.ai/3d-jutsu/16ef547f-58fb-4eac-bbce-1c0e528bd5b6)

## Engineering recommendation

Do not multiply expensive geometry by producing hundreds of cars before these first three LODs pass visual and browser gates. Validate this one GT and V8 engine, then derive modular families and interchangeable engine architectures (I4, I6, V6, V8, EV). Same materials, shader groups and wheel packs should be reused across assets.
