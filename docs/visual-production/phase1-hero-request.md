# Phase 1 · first generation request — AE-01 Meridian, front three-quarter (hero)

Prepared 2026-11-15 after the owner activated the 72-hour MCP trial and cancelled auto-renewal (access stated until
**2026-11-17 17:45 UTC**). **Nothing has been generated.** This file is the request for the owner's authorisation.

## 1. What was verified in this session (read-only)

| Check | Result |
|---|---|
| Higgsfield MCP connected to this session | **Yes.** Server `Higgsfield_AI` answers; tools: `balance`, `list_workspaces`, `workspace_select`, `models_list`, `models_get`, `show_generations`, `import-claude-motion-from-url`. |
| Can this connector generate media? | **No.** The connector's own description: *"cannot generate media, upload arbitrary files, or make purchases."* There is no generation, upload or cost-quote tool in this session. |
| Account | One private workspace, **not selected** (`is_selected: false`; name empty). `balance` → **credits 0, plan `ultra`**. |
| Existing history | One older generation (an image-to-video clip, 2025 timestamp). Not ours to use; untouched. |
| Trial end / renewal | **Not exposed by any tool** here (`balance` returns only credits and plan). Taken from the owner's statement (until 2026-11-17 17:45 UTC, auto-renewal cancelled); to be confirmed on higgsfield.ai → Manage Account → Subscription. |
| Cost of a generation = 0 credits | **Cannot be confirmed from this session**: no tool returns a price quote, and `credits: 0` is consistent with both "unlimited" and "no credits at all". The catalogue flags models with `supports_unlim: true`, which is the only evidence available (below). |

**Consequence.** Generation has to happen in a chat client whose Higgsfield connector can generate (Claude or ChatGPT with the
full connector, per `05-connect-procedure.md`), where the cost quote is shown before the job. This session can prepare
everything, check models, and later ingest the files. The "0 credits" confirmation is therefore a **checkpoint in that
chat** (`05` §5.3, steps 2–3), not something I can sign off here.

## 2. Models included without credits (catalogue flag `supports_unlim`)

Read from `models_list`; the flag says the model participates in Unlimited, **not** its resolution/duration limits for
this trial (the 11.11 post lists, for plan bonuses: Nano Banana Pro up to 2K; GPT Image 2.5/2.6 up to 2K, Medium quality;
Seedream 5.0 Pro up to 2K; Seedance 2.5 up to 1080p — the trial's own limits are not published).

| Type | Models flagged unlimited |
|---|---|
| Image | Nano Banana Pro, Nano Banana 2, Nano Banana 2.1, Seedream 5.0 Pro, GPT Image 2, GPT Image 2.5, GPT Image 2.6, Higgsfield Soul 2.0 |
| Video (page 1 of 2) | Seedance 2.0, Seedance 2.5 |
| Not flagged | FLUX 3 Image, FLUX.2, Seedream 5.5/5.0 Lite/Flash/4.5, Kling O1 Image, Grok Image, Ideogram 4.5, Cinema Studio (image/video), Minimax, MiniMax H3, Grok Video, Wan 2.6, FLUX 3 Video |

The video catalogue has a second page and the audio/3D lists were not read (out of scope). Credits-priced models must not
be used for Phase 1.

## 3. Model selected for the Meridian: **Nano Banana Pro** (`nano_banana_pro`)

| Criterion | Nano Banana Pro | Runner-up |
|---|---|---|
| In the unlimited set | yes | Seedream 5.0 Pro, GPT Image 2.5/2.6 (yes); Nano Banana 2.1 (yes) |
| Reference images | **up to 14** "style, composition, or subject anchor" | Seedream 5.0 Pro 10; GPT Image 2.6 16; NB 2.1 14 |
| Photorealism | tagged photorealistic, "ultimate quality", 4K capable, **default 2k** | GPT Image 2.5/2.6 (quality tiers; promo lists Medium) |
| Aspect ratio | 3:2 and 16:9 offered | all |
| Reproducibility | no seed parameter | **Nano Banana 2.1 has `seed`** |

Reasoning: the job is to keep one design across five views from a render and a blueprint; a model built around
reference anchoring with a generous reference limit, strong photorealism and 2K output inside the unlimited set fits best.
Use the **same** model for all five views. **Fallbacks**, in order, if the hero fails the checklist twice: Seedream 5.0 Pro
(instruction-following edits), then Nano Banana 2.1 (seeded, so a good result can be repeated). Choosing the fallback is
the owner's call, one change at a time.

Parameters: `resolution: 2k`, aspect ratio `3:2`, one image, no upscaling, no batch.

## 4. The request (prompt `P-AE01-front34`)

* **References to upload through Higgsfield's upload window** (our own material only):
  1. `assets-src/sedan-ref/renders/after-front34.png` — Blender render of the real Meridian model from almost the same
     camera (the design anchor);
  2. `assets-src/sedan-ref/references/side.png` — blueprint, proportions only.
* **Prompt text:** exactly the contents of `docs/visual-production/prompts-ae01/1-front34.txt` (Design Lock `DL-AE01`
  with 4.825 × 1.89 × 1.446 m and 2.90 m wheelbase, studio block, front three-quarter suffix, the reference sentence
  and the negative list).
* The render's paint is light blue and the prompt asks for deep blue metallic: finish may change, **design may not**.
* Attempt cap: **4** for this view; no upscale; no other view is started.

Acceptance check on the result (before it counts): `QA-VEH` in `prompts-ae01/README.md` — lamps (three-module slim LED
headlamps), grille (diamond mesh with one chrome blade), glasshouse, shoulder crease, ten-spoke turbine wheels, no badge/
logo/plate, long side ≥ 2048 px. Record job id, model name/version shown, and date for the manifest.

## 5. Authorisation requested (G2-b: first generation)

> **¿Autorizas UNA generación (hasta 4 intentos si no pasa el control) de `P-AE01-front34` con Nano Banana Pro, 2k, 3:2,
> referencias y prompt de §4, sin gastar créditos?** Condición: antes de generar, el chat conectado debe mostrar coste
> **0 créditos / Unlimited** para ese modelo; si muestra créditos, se detiene y te consulta.

Until that message arrives: no generation, no upload to Higgsfield, no workspace change.
