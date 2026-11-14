# 4. Storage, Blender access and the asset manifest

## 4.1 Where things live

```
assets-src/
  sedan-ref/                      existing: Blender build, GLB source, parametric blueprints (UNCHANGED)
  concepts/                       NEW — static concept media only; never imported by src/ or exported to the game
    manifest.json                 one entry per committed file (schema: manifest.schema.json)
    manifest.schema.json
    prompts/<prompt_id>.txt       the exact text sent for each committed asset
    vehicles/<family>/<stem>.webp  e.g. vehicles/ae01-meridian/front34.webp  (stems: front34 side front rear rear34)
    backgrounds/BG-01-graphite-cyc.webp
    motorsport/MS-01-grid.webp
    ui-mood/UI-01-menu.webp
    video-stills/                 first/last frames of clips (small), not the clips
    _candidates/                  git-ignored scratch: downloads before approval
public/assets/vehicles/...        the ONLY place vehicle models the game loads (GLB) — unaffected
```

Rules:

* **Concept ≠ model.** Nothing in `concepts/` is a vehicle asset. `catalog.ts` only references `public/assets/vehicles`.
* **Commit approved files only**, compressed: stills as WebP quality ≈ 90 (long side ≤ 2560 px, typically 150–500 KB).
  Budget for 48 stills: about 15–25 MB, comparable to the existing `assets-src` (38 MB). `.git` is already ≈ 92 MB, so
  no uncompressed PNG batches and no rejected candidates.
* **Videos are not committed** (8-second 1080p clips are 5–25 MB each). Decision 2026-11-14: they live in **Google
  Drive, `Automotive Empire/Visuales/Videos`** (one sub-folder per clip id, e.g. `V-01-hero-reveal/`, holding the
  original MP4 as downloaded). The manifest entry records `storage: { "location": "gdrive:Automotive Empire/Visuales/Videos/V-01-hero-reveal/<file>.mp4", "retention": "owner" }`,
  SHA-256 and size; `video-stills/` keeps a first-frame thumbnail in git. The Google Drive connector is **not
  connected** in the repository session, so the assistant does not write to Drive: the owner uploads, or authorises a
  connector in a later step. No videos exist or are planned until phase 4.
* Originals as downloaded from Higgsfield (PNG/MP4, with any C2PA marks) are kept in the owner's storage; the manifest
  records the SHA-256 of both the original and the committed file.

### 4.1b Hand-over inbox

Approved images arrive from the owner's Higgsfield download either as chat attachments or in
`assets-src/concepts/_inbox/` on the branch (`05-connect-procedure.md` §5.5). `_inbox/` is **transient**: the ingest tool
turns each file into a manifest entry under `vehicles/…` and the inbox copy is deleted in the same commit. Local
download scratch stays in git-ignored `_candidates/`.

## 4.2 Making images available to Blender and the existing scripts

The Blender builder already loads reference images by stem:
`blender -b --factory-startup --python tools/blender/sedan/build.py -- --references=DIR` reads
`side, front, rear, top, front34, interior` (`.png/.jpg/.jpeg/.webp`) from `DIR` as aligned image empties (never
exported). So a family folder works **without changing any code**:

```bash
# print the exact command for a family (also copies nothing)
python3 tools/concept/ingest.py blender-refs ae01-meridian
# → blender -b --factory-startup --python tools/blender/sedan/build.py -- --references=assets-src/concepts/vehicles/ae01-meridian
```

Constraints to know about:

* `top` is not an AI view; it comes from the parametric blueprint. For a family that has blueprints, copy the blueprint
  set into the same folder or into a staging directory (the tool's `blender-refs --stage` does this, see `--help`) so
  `build.py` finds `top` too.
* `rear34` is not a stem the builder knows. It is stored for human review and for the next family's modelling; accepting
  it in `REF_VIEWS` is a one-line change to be made when a family is actually modelled (not now).
* AI views are *mood and detail references*. **The numbers in `design.py` win.** The side view is checked against the
  blueprint (`ingest.py overlay`) before it is trusted for proportions.
* The reference image placement in `REF_VIEWS` assumes the blueprint scale (220 px/m). Generated images have no scale,
  so before use, `ingest.py overlay` aligns by wheel centres and the modeller scales accordingly; nothing
  automatic scales or traces an image into geometry.

## 4.3 The manifest

`assets-src/concepts/manifest.json` is a JSON object `{ "schema": 1, "assets": [ … ] }`. One entry per committed file.
`tools/concept/ingest.py validate` enforces the schema, file presence, SHA-256, image size, and that
`geometry` is `"none"`.

| Field | Meaning |
|---|---|
| `id` | stable id, e.g. `AE01-front34` |
| `kind` | `vehicle-view` · `background` · `ui-mood` · `motorsport` · `video` · `video-still` |
| `family`, `view` | vehicle family id and stem (vehicle views only) |
| `file` | path relative to `assets-src/concepts/` (videos: `null`, see `storage`) |
| `sha256`, `bytes`, `width`, `height` | of the committed file (stills) |
| `original_sha256` | of the file as downloaded, before compression |
| `source` | `{ "provider": "Higgsfield", "surface": "mcp"/"cli"/"web", "job_id", "account_ref" }` (no secrets) |
| `model` | `{ "name": "Seedream 5.0 Pro", "version": "as shown by the tool", "mode": "image"/"image-to-video" }` |
| `generated_at` | UTC ISO date-time |
| `prompt_id`, `prompt_sha256` | links to `prompts/<id>.txt` |
| `inputs` | ids of reference assets uploaded as inputs (all must be our own) |
| `credits_spent` | number or `null` (unknown / unlimited window) |
| `rights` | `{ "basis": "Higgsfield Terms (date retrieved)", "terms_retrieved": "2026-11-14", "commercial_use": "permitted per terms / unconfirmed", "owner_claim": "no ownership claimed by provider", "third_party_inputs": false, "c2pa_present": true/false/"unknown", "trademark_screen": "pass/fail/pending", "notes": "" }` |
| `intended_use` | one of: `marketing`, `store-art`, `blender-reference`, `internal-mood`, `trailer`, `ui-background` |
| `geometry` | always `"none"` — the item is a 2D image/video, not 3D geometry |
| `status` | `approved` (committed) · `superseded` |
| `qa` | `{ "checklist": "QA-VEH", "overlay": { "front_overhang_pct": …, "rear_overhang_pct": …, "roof_pct": … } , "reviewed_by": "" }` |
| `storage` | videos: `{ "location": "URL or path", "retention": "owner" }` |

An example entry with placeholder values is in `assets-src/concepts/manifest.example.json`; the real
`manifest.json` starts empty so that nothing claims a generation that did not happen.

## 4.4 The ingest tool (`tools/concept/ingest.py`)

Pure Python (Pillow + NumPy, both already used by `reference_sheet.py`). No network, no Higgsfield access, no
credentials.

```
python3 tools/concept/ingest.py validate                      # schema, files, hashes, sizes, geometry == "none"
python3 tools/concept/ingest.py add FILE --kind vehicle-view --family ae01-meridian --view front34 \
    --prompt-id P-AE01-front34 --prompt-file prompt.txt --model "Seedream 5.0 Pro" \
    --surface mcp --job-id <id> --generated-at 2026-11-15T10:00:00Z --credits 4 \
    --use blender-reference --use marketing
                                                               # compress to WebP, copy, hash, append an entry (status approved)
python3 tools/concept/ingest.py overlay GENERATED.png BLUEPRINT.png --wheels fx,fy,rx,ry --out overlay.png
                                                               # align by wheel centres, 50 % overlay + overhang/roof report
python3 tools/concept/ingest.py blender-refs ae01-meridian [--stage DIR]
```

The numbers printed by `overlay` come from a crude silhouette mask and are only reliable on a plain background; the
50 % overlay image is the primary evidence. The tool was exercised on the project's own render and a sandbox manifest
(add, validate, rejection of bad `--use`/dates/`geometry`), not on any generated image.

`add` refuses to run without a model, a prompt file and a date, so a file cannot be committed without provenance.
