# Phase 1 · comparison round — `P-AE01-front34` on three models

Prepared 2026-11-15 on the owner's instruction. **Not executed: no image has been generated.**

## Why it has not run

The Higgsfield connector in this repository session exposes only read tools (`balance`, `list_workspaces`,
`workspace_select`, `models_list`, `models_get`, `show_generations`, `import-claude-motion-from-url`). Its own description:
*"cannot generate media, upload arbitrary files, or make purchases."* It has no generation call, no upload call and no cost
quote, so the rule "verify `0 credits` / `Unlimited` before each attempt" **cannot be satisfied here**, and attempting
anything else would break the rule. `balance` (credits 0, plan `ultra`) does not prove unlimited access. The round must be
run in the Claude or ChatGPT chat that has the full Higgsfield connector (`05-connect-procedure.md`), by the owner or an
assistant there. This file is the run sheet and the scoring sheet so that the results come back to this repository
comparable.

## Run sheet (identical for the three models)

Inputs: prompt = `prompts-ae01/1-front34.txt` (text between the PROMPT and NEGATIVE markers, plus the negative list);
references uploaded in this order: 1 `assets-src/sedan-ref/renders/after-front34.png`, 2 `assets-src/sedan-ref/references/side.png`.
Settings: **2K, 3:2, 1 image, no upscale, one attempt per model, no seed unless the model offers one.**

| Run | Model (catalogue id) | Settings to set | Notes |
|---|---|---|---|
| 1 | Nano Banana Pro (`nano_banana_pro`) | resolution `2k`; ≤14 refs | no quality or seed control |
| 2 | Seedream 5.0 Pro (**`seedream_v5_pro`** — the id `seedream_5_pro` does not exist in the catalogue) | resolution `2k`; ≤10 refs; `remove_bg` off; `is_inpaint` off | the prompt is the same; Seedream treats instructions literally |
| 3 | GPT Image 2.6 (`gpt_image_2_6`) | resolution `2k`; **quality**: not specified by the owner — use **`medium`** (the tier Higgsfield lists as unlimited for GPT Image 2.5/2.6 in the 11.11 post); `batch_size 1`; output `png`; background default | the default is `low`; `high`/`xhigh`/`max` may be priced — do not raise without asking |

**Gate before every run (copy the chat's answer into the table below):** the connected chat shows the cost of *that*
request as `0 credits` or `Unlimited`. If it shows any credit amount, or shows nothing, stop and tell the owner. Between
runs, ask again; do not assume the second quote equals the first.

| Run | Cost shown before generating | Job id | Model/version shown | Date (UTC) | File |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |

Download the full-resolution originals from higgsfield.ai → Assets (MCP source) as
`P-AE01-front34_<model>_<jobid>.png`; hand them over per `05` §5.5. Do not retouch, crop or upscale.

## Scoring sheet (scores 0–5 per criterion; fill after viewing the three images side by side with the Blender render)

| Criterion | What to look at | NBP | Seedream | GPT 2.6 |
|---|---|---|---|---|
| **Fidelity to the Meridian design** | same car as `after-front34.png`: nose, hood length, glasshouse, trunk, shoulder crease start/end | | | |
| **Automotive quality** | believable paint, glass, tyres, reflections, panel gaps; looks like a photograph of a real car | | | |
| **Proportion coherence** | wheelbase/overhang ratio, roof height, wheel size vs body (overlay mentally on the blueprint: front overhang 0.31, rear 0.36 of wheelbase; height/length 0.30) | | | |
| **Cleanliness of details** | headlamps (slim LED, three modules, symmetrical), grille (diamond mesh, one chrome blade), glass (clean pillars, no extra panes), wheels (ten-spoke turbine, four of them, matching) | | | |
| **No logos / copied traits** | no badge, emblem, lettering, plate text; no recognisable production-car signature | | | |
| **Total** (hard fail = any logo/badge, or a different car) | | | | |

Rules: a logo/badge or a clearly different car is a hard fail for that image whatever its total. Ties are broken by
"fidelity to the design". Reviewer's notes go under the table.

## After the three results

1. Hand the files over; this session records them (nothing is committed as approved yet), runs the checklist, and
   writes the comparison (scores, side-by-side contact sheet) into this file.
2. The best model is named with the evidence.
3. Up to **2 refinements on that winner only** are proposed (one change per refinement, from the failures observed,
   e.g. wheel design, grille pattern, lamp shape), each with its prompt and cost gate. They need the owner's go.
4. No other views (`side`, `front`, `rear`, `rear34`) are started in this round. The game and every PR stay untouched.
