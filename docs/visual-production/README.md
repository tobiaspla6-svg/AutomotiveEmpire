# Visual-production workflow (Higgsfield) — preparation

**Status: prepared, nothing activated.** No subscription or trial has been started, nothing installed or authenticated,
no credits spent, no image or video generated. The game, the Blender pipeline and all pull requests are untouched.
This branch contains documents, an offline ingest tool and empty folders only.

| Document | Content |
|---|---|
| [01 Integration assessment](01-integration-assessment.md) | what Higgsfield offers, whether this environment supports it, trial/credit/renewal facts and the conflicts between sources, rights, audit of the current pipeline |
| [02 Production plan](02-production-plan.md) | outputs ranked by value, budget rules, workflow, **three-day schedule**, decision gates, trial-verification template |
| [03 Prompts](03-prompts.md) | consistency method, six design families with Design Locks, five views per vehicle, backgrounds, UI mood, motorsport, video prompts, QA checklist |
| [04 Storage and manifest](04-storage-and-manifest.md) | repository layout, how Blender picks up references, the asset manifest and the `tools/concept/ingest.py` tool |

Rule that runs through everything: **images and videos are pictures.** They guide modelling and marketing; they never
become, and are never described as, editable 3D geometry. Vehicle models are GLB files built in Blender from numeric
parameters (`geometry: "none"` is enforced in the manifest).

## Needed from the owner before anything starts

1. Approve (or change) the plan and the six working names (trademark screen pending).
2. Choose where to run: your own computer (recommended) or this cloud session (needs network allow-listing and a sign-in
   path).
3. Gate G1: verify the trial terms together (checklist in 01 §1.3). Decide scenario A (credits) or B (unlimited) and a
   daily credit ceiling.
4. Gate G2: explicit written approval to start any trial or subscription.
5. Where video clips are stored (outside git).
