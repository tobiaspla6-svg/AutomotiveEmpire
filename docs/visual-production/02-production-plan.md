# 2. Asset-production plan

Revision 2 (2026-11-14), after the owner's review. Decisions in force:

| # | Decision |
|---|---|
| 1 | **Do not activate** the trial, any subscription or spend any credit yet. Every activation needs the owner's express authorisation. |
| 2 | Connect through **ChatGPT or Claude with browser sign-in**; do not assume Claude Code locally (`05-connect-procedure.md`). |
| 3 | **Videos are stored outside the repository**, preferably in Google Drive: `Automotive Empire/Visuales/Videos`. |
| 4 | Keep the six concepts, but **production starts with AE-01 Meridian only**. |
| 5 | First objective: **five consistent Meridian views**, built on its real dimensions and the existing Blender blueprints. |
| 6 | The other 43 stills and the 7 videos are **not generated** until the owner has reviewed the Meridian results. |
| 7 | Before any generation, verify the **72-hour Unlimited benefit is active for the owner's account and the chosen connection**, and check **renewal date and price** (Gate G1). |
| 8 | PR #5 and the simulation are not modified. |
| — | G0 is approved **provisionally**; the six names are **not** approved for commercial use (trademark screen pending). |

## 2.1 Scope by phase

| Phase | Output | Count | State |
|---|---|---|---|
| **1 — now** | **AE-01 Meridian**: `front34` (hero), `side`, `front`, `rear`, `rear34`, checked against the Blender blueprints | 5 stills | **Prepared**, waits for Gate G1/G2 |
| 2 | Backgrounds BG-01…06, AE-06 Vektor + motorsport stills | up to 14 | **On hold** until the owner reviews phase 1 |
| 3 | AE-02…AE-05 (hero + 4 views each) | 20 | **On hold** (this is most of the "other 43") |
| 4 | Clips V-01…07, UI mood | 7 clips + up to 5 stills | **On hold** |

(5 + 43 = 48 stills in total; the 7 videos are separate.) Nothing from phases 2–4 is generated, queued or
"warmed up" during phase 1, even if unlimited access is active and idle. If the owner later wants to use the
remainder of an active window, that is a new, written decision.

## 2.2 Phase 1 — AE-01 Meridian: exact objective

**Inputs (all ours):** `assets-src/sedan-ref/references/{side,front,rear}.png` (parametric blueprints, 220 px/m) and
the design numbers from `tools/blender/sedan/design.py` / `src/three/assets/catalog.ts`:

| Quantity | Value |
|---|---|
| Length × width × height | 4.825 × 1.89 × 1.446 m |
| Wheelbase | 2.90 m |
| Front overhang / rear overhang | 0.885 m / 1.04 m |
| Track front / rear | 1.62 / 1.63 m |
| Tyre | 245/40 R19 (rolling radius 0.339 m) |
| Layout | front engine, four-door saloon, glasshouse set rearward, short trunk lid |

Prompt text with these numbers is in `03-prompts.md` (`DL-AE01`) and fully assembled, ready to paste, in
`docs/visual-production/prompts-ae01/` (five files, one per view).

**Procedure:**
1. Hero first: up to **4 candidates** of `front34`; owner picks one. Name it `AE01-hero`.
2. Using the hero as image reference (and the blueprint for the matching view where useful), generate `side`, `front`,
   `rear`, `rear34` — up to **3 attempts** per view. Change only the camera.
3. For `side`: run the overlay check against the blueprint (`ingest.py overlay`, wheel pixel centres in
   `prompts-ae01/README.md`). Tolerances: overhangs ±4 % of wheelbase, roof height ±3 %, belt line ±3 %, wheel diameter ±5 %.
4. Checklist `QA-VEH` on all five (lamps, windows, body lines, wheels, no badges/logos/plates).
5. Owner reviews the set. Only then do approved files go through `ingest.py add` and are committed.

**Phase-1 success criteria** (decided before looking at results): the five images read as one car; the `side` view passes
the overlay tolerances; lamps and glasshouse agree between views; ≥ 4 of 5 views pass on the first or second attempt.
If not, the finding "AI stills cannot hold this design" is itself a result, reported to the owner before phases 2–4 are
considered. Images are references; the numbers in `design.py` win.

**Attempt ceiling:** at most 4 + 4×3 = **16 generations** for the whole of phase 1, plus at most **2** upscales of
approved images. Under scenario A (credits) the owner sets a credit ceiling; the assistant stops at 80 %.

## 2.3 Schedule

The trial promotion lasts **72 hours from activation** (to be confirmed). Phase 1 needs a few hours, not three days;
the rest of the window will go unused **unless** the owner decides otherwise. That has a cost consequence the owner
should weigh at Gate G2 (decision C below).

| Step | When | Credits | Owner action |
|---|---|---|---|
| Review revision 2 of these documents | now | 0 | approve / amend |
| Trademark screen of the six working names | before any public use | 0 | owner or counsel |
| Create the Drive folder `Automotive Empire/Visuales/Videos` | any time | 0 | owner |
| **Gate G1 part 1**: read the offer page, fill `trial-verification.md` | when the owner is ready | 0 | present, **no card entered** |
| **Gate G2**: written authorisation to start the trial | owner's call | trial starts | **explicit message** |
| **Gate G1 part 2**: connect, balance/status/quote checks (`05`) | immediately after G2 | 0 if unlimited | present |
| Phase 1 generation (hero → four views, QA) | same session, one sitting | 0 / ceiling | picks the hero, reviews |
| Hand-over of files, ingest, commit to `visual-production-prep` | same day | 0 | download + hand over |
| Owner review of the Meridian set | after phase 1 | 0 | decides on phases 2–4 |
| Subscription clean-up | before the 72 h end | — | owner decides cancel/keep |

Decision C (to take at G2): *(a)* start the trial only when ready to run phase 1 in one sitting and **cancel
auto-renewal straight away** if the terms keep access until the window ends (verify first); or *(b)* leave renewal as
is. The assistant never cancels or changes anything in the account by itself; it only tells the owner where the
button is.

## 2.4 Decision gates

| Gate | Question | State |
|---|---|---|
| G0 | Plan, six concepts, file structure | **provisionally approved**; names not cleared for commercial use |
| G1 | Offer/benefit/price/renewal verified (parts 1 and 2) | **not started** |
| G2 | Start the trial | **not authorised** |
| G3 | Phase 1 results reviewed → go / no-go for phases 2–4 | pending |
| G4 | Commit approved files to the repository | after phase 1, owner OK |
| G5 | Anything touching game code, the Blender builder, PR #5 | not part of this work |

## 2.5 What is *not* in this plan

* No change to the game, its tests, the GLB assets, `build.py`, PR #5 or the simulation. The future one-line `rear34`
  support in `REF_VIEWS` is listed, not applied.
* No 3D generation and no "image-to-3D". Generated stills are references; the Meridian GLB already exists and is not
  replaced by anything produced here.
* No audio, no voice cloning, no human likenesses.
* No video in phase 1 (see 04 §4.1 for where videos go when phase 4 happens).

## 2.6 Budget rules (hold in either scenario)

* Scenario A (credits deducted) or B (unlimited): determined by the Gate G1 quote, not assumed.
* The assistant states the credit cost and **waits for approval before each batch** ("Before generating anything, tell me
  the credit cost and wait for my confirmation").
* One image model for all five Meridian views (mixing models hurts consistency), chosen with up to **2 test
  candidates** inside the hero attempts. Use the best model among those the connected tool lists as unlimited inside
  the trial window.
* Unlimited runs are queued **one at a time**; do not plan parallel jobs.

## 2.7 Template: `trial-verification.md` (fill in at Gate G1)

```
Date / time (UTC and owner's time zone):        Who was present:
Offer page URL:                                  Screenshot / copied text saved at:
Offer name and duration:                         Start condition (card entry / connect / first generation):
Converts into:                                   Price after trial:        Renewal date and time:
Charge or authorisation today? (y/n)             Payment method:
Eligible account? (y/n)                          Surface the offer attaches to (Claude / ChatGPT / CLI / web):
"Unlimited access to all models" inside MCP? (y/n)  Models actually listed as unlimited:
Resolution / duration / concurrency / daily limits:
How to cancel (exact steps):                      What happens to access on cancel:
Connector-reported plan / trial status and renewal date:
Credit balance before generating:                Quote for 1 test image (credits):   Quote for 1 test video (credits):
Output / commercial terms shown (version/date):
Scenario (A credits / B unlimited):              Credit ceiling (if A):
Owner decision: GO / STOP                        Authorisation message quoted:
```
