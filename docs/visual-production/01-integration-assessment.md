# 1. Higgsfield integration assessment

Status: **preparation only**. Nothing has been signed up for, installed, authenticated or generated. No credits have
been spent. Research date: 2026-11-14. Sources are Higgsfield's own pages (read with `curl`, public, no login) plus
third-party reporting where Higgsfield's pages are silent. Where they disagree, this document says so.

## 1.1 What Higgsfield offers for an agent workflow

| Route | What it is | Official? | Source |
|---|---|---|---|
| **MCP connector** | Hosted MCP server `https://mcp.higgsfield.ai/mcp`, added as a custom connector in Claude (claude.ai / Desktop), sign-in with OAuth, "no API key" | Yes | [Help: connect to Claude, ChatGPT or another agent](https://higgsfield.ai/creator-hub/help-center/integrations/how-do-i-connect-higgsfield-to-ai-agent) |
| **CLI + skills** (the route for Claude Code) | `npm i -g @higgsfield/cli`, `higgsfield auth login` (browser sign-in), `npx skills add higgsfield-ai/skills`; then `higgsfield generate create <model> --prompt …` | Yes | [Higgsfield CLI page](https://higgsfield.ai/cli), [npm `@higgsfield/cli` 1.2.2, MIT](https://www.npmjs.com/package/@higgsfield/cli) |
| Node SDK | `@higgsfield/client` (API key style) | Yes (npm) | npm registry |
| Community MCP servers | e.g. `jfikrat/higgsfield-mcp` | **No** — do not use | — |

What the official help article says can be done through MCP/CLI: image and video generation on all models,
upscaling, background removal, outpainting/reframing, Kling 3.0 Motion Control, reusable **Elements** (reference
props/environments/characters), Soul characters, audio, listing past generations, **checking credit balance**. Results
land in the account's Assets at higgsfield.ai (tagged with the MCP source). Reference images reach Higgsfield through
an upload window the agent opens, or by pasting a direct image URL — **the agent cannot read images attached to the
chat**. Files therefore have to be downloaded from Higgsfield afterwards and committed by us (see 4).

Models named in Higgsfield's pages (availability must be re-checked at activation, the list rotates): images —
Seedream 5.0 Pro/Lite/4.5, Nano Banana Pro/2, GPT Image 2, Flux.2 Pro, Kling O1 Image, Soul 2.0; video — Seedance 2.0
(+Fast/Mini), Kling 3.0 (+Motion Control), Wan 2.7, Gemini Omni Flash. Images cap at about 2K; video clips are about
7–8 s.

## 1.2 Does *this* environment support it?

| Question | Finding | Evidence |
|---|---|---|
| Is a Higgsfield MCP server connected to this session? | **No.** The session's MCP servers are Finzon, Gmail, Google Calendar and Google Drive. | tool list / `~/.claude/mcp-needs-auth-cache.json` |
| Can the agent add the hosted MCP connector itself? | **No.** Adding a connector with OAuth is an account action done by the user in claude.ai / Desktop settings (or `claude mcp add` on their own machine). | Higgsfield help article |
| Can Claude Code (CLI) use the CLI route here? | **Partly.** Node 22 and npm work and the package resolves (`@higgsfield/cli` 1.2.2). Its postinstall downloads a prebuilt binary from GitHub Releases (checksum-verified) — not tested here, to avoid side effects. `higgsfield auth login` needs a **browser sign-in**, which a headless cloud container cannot complete unless the CLI offers a device/URL flow (unverified). | `npm view`, package README |
| Can the session reach Higgsfield? | `higgsfield.ai` answers through the session proxy with `curl` (HTTP 200); `mcp.higgsfield.ai` answers 404 to a plain GET (normal for an MCP endpoint, it needs the protocol + OAuth). The built-in WebFetch tool could not resolve `higgsfield.ai`. Generation traffic goes to API hosts not yet tested; the session network policy may need them allowed. | `curl` probes |
| Blender / image tooling | Blender 4.5.16 LTS, Python 3 with Pillow + NumPy, Node 22 are present — everything needed to ingest and check images. | `blender --version` |
| Is Higgsfield integration needed *inside the game*? | No. It is an offline production tool. The shipped game never calls it. | — |

**Recommendation.** Run generation where the human can sign in:

1. **Preferred — Claude Code or Claude Desktop on the owner's computer.** Connect the connector or CLI there (sign-in
   works, the browser is available), generate, download, then commit the approved files with the ingest tool (4).
2. **Alternative — this cloud session**, only after (a) the owner approves the trial, (b) the required Higgsfield hosts
   are added to the environment's network allow-list, and (c) a sign-in path that works headlessly is confirmed. If
   (c) is not possible, the owner downloads images from higgsfield.ai Assets and uploads them to the repository.
3. **Fallback with zero integration risk**: the owner generates in the Higgsfield web app using the prompt packs in
   `03-prompts.md`, downloads, and the ingest tool handles the rest. The prompt packs are tool-independent.

## 1.3 Trial, credits and renewal — what is known and what is not

This is the part that must be verified **before** any generation. The sources conflict.

| Claim | Source | Reliability |
|---|---|---|
| A **free 24-hour** "Unlimited MCP" trial existed until 31 July 2026: no credit deduction for the window, card required, **auto-converts to the Plus monthly plan** unless cancelled; cancel by chat message ("I want to cancel the trial") or Manage Account → Subscription → Cancel auto-renewal; cancelling keeps access until the 24 h end. | [Higgsfield blog, 28 Jul 2026](https://higgsfield.ai/blog/unlimited-mcp) | Official, but a **past** promotion |
| An **active paid subscription is required** to use the agent connection, and **"Unlimited model access ✕, Free generations ✕"** through MCP: *every generation through a connected agent deducts credits, regardless of plan*. | [Higgsfield help article, 1 Aug 2026](https://higgsfield.ai/creator-hub/help-center/integrations/how-do-i-connect-higgsfield-to-ai-agent) | Official, **newer** than the blog; contradicts it |
| Unlimited/All-Unlimited is a web-side purchase (e.g. 1-day $99, 3-day $250 bundles) with 1 concurrent generation per format; works only with an active subscription; the 1-day free trial converts to Plus (card charged) if not cancelled. | [Higgsfield "All Unlimited explained"](https://higgsfield.ai/blog/higgsfield-all-unlimited-explained) | Official |
| A **72-hour MCP free trial** opened on 9 Nov 2026, **rolls into the Ultra plan automatically**, e-mail before expiry. | One news article ([pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/31553/higgsfield-free-72-hour-trial-claude-fable-5-2)); no Higgsfield page found | **Unconfirmed** |
| Terms: free trials convert to a paid subscription at the then-current standard price and charge the payment method until cancelled; cancel before the end to avoid charges. | [Higgsfield Terms](https://higgsfield.ai/terms), Free Trials and Promotional Offers | Official |

Consequences for us:

* We **cannot assume** the 72-hour trial is "unlimited", nor that it is free of credit cost through MCP. Plan for both:
  *scenario A* (credits deducted, a hard budget) and *scenario B* (unlimited within the window, one job at a time).
* The trial **needs a card and probably auto-converts to a paid plan** (Plus in July's offer, Ultra in the 72 h report).
  Starting it is a financial commitment unless cancelled — therefore **only with the owner's explicit approval**.
* Higgsfield's own recommendation covers the risk: start every session with *"Before generating anything, tell me the
  credit cost and wait for my confirmation."* and ask *"What is my current Higgsfield credit balance?"*.

### Pre-flight checklist (Gate G1 — zero credits, owner present)

Do these on the offer/checkout page and in the account **before** pressing "start trial". Record the answers in
`docs/visual-production/trial-verification.md` (template at the end of `02-production-plan.md`).

1. Offer page states the duration (72 h?) and **start condition** (starts at card entry? at first generation? at connect?).
2. Plan it converts into, **price, billing date, whether the card is charged at sign-up** (auth hold vs charge).
3. Whether "unlimited" covers **MCP/CLI generations** or only the web; which models/resolutions/durations are inside it.
4. Whether credits are deducted anyway, the starting **credit balance**, and the credit price of one image / one 8 s video
   for each model we plan to use (the agent can quote them).
5. Concurrency limit (1 at a time in Unlimited) and any daily cap.
6. How to **cancel auto-renewal** and where the confirmation shows; set a reminder to verify it 24 h before expiry.
7. Commercial-use and output terms shown at sign-up (see 1.4) and the model-provider terms for the chosen models.
8. Whether the surface we will use (Claude connector, CLI, web) is eligible for the offer.

**Stop conditions** (do not generate and ask the owner): the plan/price is not visible; credits would be deducted and a
budget has not been approved; the offer converts to a plan the owner did not approve; the connector cannot show a cost
before generating.

## 1.4 Rights

From [Higgsfield's Terms](https://higgsfield.ai/terms) (retrieved 2026-11-14; re-read at sign-up, they change):

* Higgsfield **does not claim ownership of Inputs or Outputs and does not restrict commercial use of Outputs**; the
  user's rights in exported Outputs **survive cancellation**; Outputs may be transferred/sublicensed.
* You may **not** use Outputs (or data derived from them) to **train, fine-tune or distil** another machine-learning
  model. Using images as Blender modelling references is not training; **never** feed them into a dataset or model.
* Higgsfield may embed **C2PA / Content Credentials** provenance marks in Outputs; do not strip them. Record whether
  they are present.
* We are responsible for the Inputs: **upload only material we have the right to use** (our own blueprints and
  renders). Do not upload photos of real cars, logos, or third-party artwork.
* Underlying models are provided by third parties and may have their own terms; the model used is therefore recorded
  per asset (5).

Cautions that are **not legal advice**: AI-generated images may have **weak or no copyright protection** in some
jurisdictions (human authorship matters), so the project's protection comes from the Blender models, the game, the
selection/arrangement and any human-made edits — not from the raw images. Outputs can resemble real vehicles or
marks by accident: every image is reviewed for badges, logos, plates and recognisable production designs before it is
approved (`03-prompts.md`, negative list), and the manufacturer names in the game stay descriptive only (see the
README disclaimer).

## 1.5 Audit of the current pipeline (what the new material plugs into)

| Area | Present state | Implication |
|---|---|---|
| Blender build | `tools/blender/sedan/build.py` (+ 12 modules) builds the reference sedan from numeric parameters in `design.py`, exports `sedan.lod{0,1,2}.glb` + `wheels.glb` (Draco, merged draws, ~42 primitives), Blender 4.5.16 verified | The model is **parametric**; images guide and check it, they never replace the numbers |
| Reference images | `assets-src/sedan-ref/references/{side,front,rear,top,design-sheet}.png`, generated **parametrically** by `reference_sheet.py` (orthographic, 220 px/m); `build.py --references=DIR` loads `side, front, rear, top, front34, interior` (`.png/.jpg/.jpeg/.webp`) as aligned image empties, never exported; `PROMPTS.md` already holds a base prompt for `front34`/`interior` | **A reference hook already exists.** A per-family directory with those stems works with no code change. `rear34` is not a supported stem yet (needs a one-line `REF_VIEWS` entry when the first family is modelled — not done now) |
| Existing renders | `assets-src/sedan-ref/renders/*` (before/after review renders, CC0 HDRI lighting) | Useful as the *consistency baseline* for family 1 |
| Game assets | `public/assets/vehicles/sedan-ref/` (2.5 MB), `public/assets/env/studio_small_09_1k.hdr` (Poly Haven CC0), catalogue `src/three/assets/catalog.ts` lists **one road asset**; race cars and every other body are **procedural** | Only family 1 can become a GLB today; families 2–6 stay concept-only until modelled |
| Repository weight | `.git` ≈ 92 MB, `assets-src` ≈ 38 MB, no LFS, no `LICENSE` file | Commit only approved, compressed stills; **videos stay out of git** (see 4) |
| Licensing records | `docs/asset-pipeline.md` §licence lists CC0 HDRI source and requires author/licence/source for future assets | The manifest in 5 extends this rule to generated media |
| Game code | Untouched by this preparation. Branch `visual-production-prep` contains only docs, `tools/concept/`, and empty `assets-src/concepts/` folders | PR #5 and `main` are not affected |

## 1.6 The line between images and 3D

Higgsfield produces **pixels**. It does not produce editable geometry, UV layouts, rigs or GLB files, and nothing in
this plan says or implies that it does.

* A generated image or video is a **concept reference** (`geometry: "none"` in the manifest, enforced by the validator).
* The GLB vehicles are modelled in **Blender from the numeric design parameters**, by hand/script, and are the only
  things the game loads as vehicles.
* Turntable-style videos show a *picture* of a car rotating; they are marketing material and must be labelled as
  concept/promotional footage, never as in-game footage or as the 3D asset.
* Separation is physical: concept media lives in `assets-src/concepts/`; GLBs live in `assets-src/<family>/` and
  `public/assets/vehicles/`. Nothing under `concepts/` is ever imported by `src/`.
