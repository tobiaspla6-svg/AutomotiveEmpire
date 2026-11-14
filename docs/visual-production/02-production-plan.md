# 2. Asset-production plan

Nothing in this plan starts until the owner approves **Gate G1** (trial verification) and each later gate. All counts
are *maximum* numbers of final assets; generation attempts are capped separately.

## 2.1 Outputs, ranked by value to Automotive Empire

| Rank | Output | Count (final) | Why it matters | Feeds |
|---|---|---|---|---|
| 1 | **Family AE-01 (Meridian) hero + 4 views**, checked against the existing blueprint | 5 | The only family that already has a GLB; a hero still is the best store/README/menu image and the check shows whether AI stills are good enough to guide modelling | marketing, Blender references |
| 2 | **Studio background plates** (BG-01…06) | 6 | Reusable for every screenshot, trailer and the menu; no consistency problem (no car) | UI/marketing |
| 3 | **Families AE-02…AE-06, hero + 4 views** | 25 | Defines the next five models to build; AE-06 doubles as the motorsport car | roadmap, Blender references |
| 4 | **Motorsport stills** (MS-01…07) | 7 | The racing mode has no promotional imagery at all | marketing |
| 5 | **Cinematic clips** (V-01…07) | 7 clips (~50 s assembled) | Highest cost per asset, highest promotional value; depends on approved stills | trailer |
| 6 | **UI mood references** (UI-01…05) | 5 | Internal only; low value (the interface already exists) | design review |

Totals: 48 stills + 7 clips. Aspect ratios: vehicles 16:9 (hero 3:2 acceptable), plates 16:9 then crops, UI 16:10, clips 16:9.

## 2.2 Generation budget (to be fixed at Gate G1)

Unknown until the credit prices are quoted (1.3). Rules that hold in either scenario:

* **Attempts per approved still:** at most **4** for a hero, **3** for each derived view; **2** for plates, MS and UI;
  **3** per clip. After that the prompt is revised (not re-rolled) or the item is dropped.
* **Ceiling:** the owner sets a maximum credit spend per day at G1. The agent stops at 80 % and asks.
* **Cheap-first:** candidates are made with the model's lower-resolution/fast option when one exists; only the approved
  candidate is upscaled (`upscale` is also credit-priced — ask first).
* **Models:** pick one image model for all vehicle views (mixing models inside a family hurts consistency), chosen on
  a 3-candidate test of AE-01 `front34` against the blueprint. A second model may be used for plates and UI.
  Video: Seedance 2.0 or Kling 3.0 (image-to-video), chosen on one test clip.
* **Concurrency:** Unlimited modes run one generation at a time — queue jobs sequentially and do not plan for parallel
  runs.

## 2.3 Workflow per asset

```
prompt pack  ─►  agent states credit cost, waits for approval  ─►  generate  ─►  candidate downloaded to
assets-src/concepts/_candidates/ (git-ignored)  ─►  checklist QA (+ overlay for vehicles)  ─►  owner picks  ─►
ingest.py add (copy, hash, compress, manifest entry)  ─►  approved file committed
```

Rejected candidates are kept locally for the session only; they are never committed.

## 2.4 Three-day schedule

Day boundaries are working sessions; the 72-hour trial clock (if that is what is activated) starts only when Gate G2 is
passed, so Day 0 costs nothing. Higgsfield jobs are sequential, so the schedule is ordered by value and every day ends
with ingested, committed assets.

**Day 0 — preparation (this deliverable, zero credits)**
Assessment, prompt packs, manifest, ingest tool, folder structure. Owner decisions: approve G1 questions, daily credit
ceiling, trademark screen of working names, where videos are stored.

**Gate G1 — trial verification (owner present, zero credits).** Run the pre-flight checklist (1.3), fill in
`trial-verification.md`. Owner says "go" or "stop". No card is entered before this.

**Gate G2 — activation.** Owner explicitly approves starting the trial (and sees plan, price, renewal date). The
agent sets a reminder to confirm auto-renewal is cancelled (if the owner wants that) 24 h before expiry.

**Day 1 — the highest-value material (target 19 stills)**
1. Connect, ask for credit balance and per-job prices, pick the models with 3 test candidates (AE-01 hero).
2. AE-01 hero → approve → `side`, `front`, `rear`, `rear34` chained; overlay QA against the blueprint. *(5 stills)*
3. Plates BG-01…BG-06. *(6 stills)*
4. AE-06 (Vektor) hero + 4 views, because it unlocks both the motorsport stills and the race-car concept. *(5 stills)*
5. MS-01 grid, MS-03 rain, MS-04 night. *(3 stills)*
6. Ingest and commit what is approved; update the manifest. End-of-day check: credits used vs ceiling.

**Day 2 — breadth (target 24–29 stills + 2 test clips)**
1. AE-04 Orrin, AE-03 Tallis, AE-02 Kestrel, AE-05 Brantley: hero + 4 views each (AE-06 was done on Day 1). *(20 stills)*
2. MS-02 pit, MS-05 cockpit, MS-06 podium, MS-07 livery sheet. *(4 stills)*
3. UI mood UI-01…UI-05 only if credits remain. *(2–5 stills)*
4. **Test clips** V-01 and V-05 to choose the video model. *(2 clips)*
5. Ingest and commit.

**Day 3 — clips, selection, closing (target 5 more clips; V-01 and V-05 came from Day 2)**
1. V-02, V-03, V-04, V-06, V-07 (each at most 3 attempts).
2. Final selection with the owner; ingest videos (stored outside git, see 4) with manifest entries.
3. Re-run `ingest.py validate`; update the README section and `docs/asset-pipeline.md` link.
4. Close-out: confirm the subscription status in the account (cancel auto-renewal **only if the owner asks**), record
   total credits used and the model chosen per output in the manifest.

If time or credits run out, the order above is the order of cuts: UI mood → video clips beyond the first three →
AE-05 / AE-02 → motorsport extras. Items 1–4 of Day 1 are never cut.

## 2.5 Decision gates

| Gate | Question | Needed from owner |
|---|---|---|
| G0 | Approve this plan, the working names to screen, the video storage location | yes |
| G1 | Trial terms verified, scenario A or B, daily credit ceiling | yes — written answer |
| G2 | Start the trial / connect the account | **explicit approval** |
| G3 | Each batch over the ceiling or any `upscale`/outpaint/audio use | approval per batch |
| G4 | Commit approved assets | approval (or standing "commit approved only") |
| G5 | Anything touching game code, the Blender builder, or a PR | separate request — not part of this work |

## 2.6 What is *not* in this plan

* No change to the game, its tests, the GLB assets, `build.py`, or the pull requests. (The one future Blender-side
  change — accepting a `rear34` stem — is listed, not applied.)
* No 3D generation, no "image-to-3D" step. If a 3D-from-image tool is ever considered it is a separate evaluation with its
  own rights review.
* No audio generation, no voice cloning, no human likenesses.

## 2.7 Template: `trial-verification.md` (fill in at Gate G1)

```
Date / time (UTC):                 Who was present:
Offer page URL:
Offer name and duration:           Start condition:
Converts into plan:                Price / billing date:      Card charged at sign-up? (y/n/hold)
"Unlimited" covers MCP/CLI? (y/n)  Which models / resolution / duration are inside it:
Credits deducted anyway? (y/n)     Starting balance:          Cost per image / per 8 s video (by model):
Concurrency / daily cap:
How to cancel auto-renewal (exact steps):                   Where confirmation appears:
Output / commercial terms shown at sign-up (version/date):
Eligible surfaces (Claude connector / CLI / web):
Scenario chosen (A credits / B unlimited):   Daily credit ceiling:
Owner decision:   GO / STOP                  Signature (message quoted):
```
