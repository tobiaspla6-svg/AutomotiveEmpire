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

Models named in Higgsfield's pages (the list rotates; the connected tool's own list at activation is what counts):
July 2026 — images Seedream 5.0 Pro/Lite/4.5, Nano Banana Pro/2, GPT Image 2, Flux.2 Pro, Kling O1 Image, Soul 2.0;
video Seedance 2.0, Kling 3.0, Wan 2.7, Gemini Omni Flash. November 2026 (11.11 post) — Seedance 2.5 (+Flash), Nano
Banana Pro, Seedream 5.0 Pro, GPT Image 2.5 / 2.6. Images cap at about 2K in the promotions' listings.

## 1.2 Does *this* environment support it?

| Question | Finding | Evidence |
|---|---|---|
| Is a Higgsfield MCP server connected to this session? | **No.** The session's MCP servers are Finzon, Gmail, Google Calendar and Google Drive. | tool list / `~/.claude/mcp-needs-auth-cache.json` |
| Can the agent add the hosted MCP connector itself? | **No.** Adding a connector with OAuth is an account action done by the user in claude.ai / Desktop settings (or `claude mcp add` on their own machine). | Higgsfield help article |
| Can Claude Code (CLI) use the CLI route here? (not the chosen route) | **Partly.** Node 22 and npm work and the package resolves (`@higgsfield/cli` 1.2.2). Its postinstall downloads a prebuilt binary from GitHub Releases (checksum-verified) — not tested here, to avoid side effects. `higgsfield auth login` needs a **browser sign-in**, which a headless cloud container cannot complete unless the CLI offers a device/URL flow (unverified). | `npm view`, package README |
| Can the session reach Higgsfield? | `higgsfield.ai` answers through the session proxy with `curl` (HTTP 200); `mcp.higgsfield.ai` answers 404 to a plain GET (normal for an MCP endpoint, it needs the protocol + OAuth). The built-in WebFetch tool could not resolve `higgsfield.ai`. Generation traffic goes to API hosts not yet tested; the session network policy may need them allowed. | `curl` probes |
| Blender / image tooling | Blender 4.5.16 LTS, Python 3 with Pillow + NumPy, Node 22 are present — everything needed to ingest and check images. | `blender --version` |
| Is Higgsfield integration needed *inside the game*? | No. It is an offline production tool. The shipped game never calls it. | — |

**Decision (owner, 2026-11-14): connect through ChatGPT or Claude (claude.ai / Claude Desktop) with browser sign-in, and do
not assume Claude Code is installed locally.** Consequences:

* The connection is the chat client's own connector/plugin (`05-connect-procedure.md`); this repository session is
  not connected to Higgsfield and does not need to be.
* Generated files land in the owner's **Higgsfield Assets** (and a chat client cannot write into the repository).
  The owner downloads approved candidates and hands them over (attach to this conversation, or upload to the
  repository inbox — see 04 §4.5); the ingest tool then does hashing, compression, manifest and commit.
* The chat assistants **cannot read files attached in the chat as references**: reference images (our blueprints) go
  through Higgsfield's upload window, which the assistant opens on request (help article).
* Choice between the two chat clients: **Claude** supports image, video **and audio**; **ChatGPT** supports image and
  video only (no audio) — irrelevant here since audio is out of scope. Pick the one the owner already uses; the
  procedure covers both.
* The CLI route (Claude Code, local install) stays documented as an alternative but is **not** the plan.

## 1.3 Trial, credits and renewal — three different things

Revision 2 (2026-11-14): corrected with Higgsfield's own **11.11 post of 11 Nov 2026**
([Higgsfield 11.11 Deals](https://higgsfield.ai/blog/higgsfield-11-11-deals), read directly). It supersedes the
earlier "unconfirmed, third-party only" treatment of the 72-hour offer. Three separate regimes exist and must not be
mixed up:

| Regime | What it says | Source | Applies to us? |
|---|---|---|---|
| **A. The MCP free trial (November 2026 promotion)** | **US$0 for 3 days; "Unlimited access to all models"; after 3 days the subscription automatically renews on the Ultra 3K plan at a discounted price.** The post tells readers to review the discounted price and renewal terms before starting. It states no price, no start condition, no end date, no per-model resolution/duration limits and no concurrency limit. "The MCP free trial is a separate offer with its own terms." | [11.11 post, 11 Nov 2026](https://higgsfield.ai/blog/higgsfield-11-11-deals) | **Yes — this is the offer we would use** |
| **B. General MCP conditions (August 2026)** | An active **paid** subscription is required to use the agent connection; through MCP **"Unlimited model access ✕, Free generations ✕"** — every generation through a connected agent deducts credits, regardless of plan. | [Help article, 1 Aug 2026](https://higgsfield.ai/creator-hub/help-center/integrations/how-do-i-connect-higgsfield-to-ai-agent) | Applies **outside** the promotion (after it, or if the trial is not active for the account/surface) |
| **C. 11.11 plan bonuses (Unlimited Seedance 2.5, Nano Banana Pro, Seedream 5.0 Pro, GPT Image 2.5/2.6 for 7–60 days)** | Granted with Plus/Ultra plans bought by 14 Nov 23:59 UTC; **work only on higgsfield.ai**; "generations through MCP, CLI, Canvas, or Supercomputer still deduct credits". | same 11.11 post | **No** — we are not buying a plan, and these do not apply to MCP |

How to read A against B: B is the standing rule; A is a time-limited promotion that, according to Higgsfield's newer
post, grants unlimited access to all models for 3 days over MCP. The two are therefore **not contradictory** if A
really is "unlimited over MCP"; but the 11.11 post does not say *how* A is applied to a given account and surface, so
that has to be **proven for our account before generating** (see the gate below). The older 24-hour July trial
(card required, converts to Plus, cancel by chat message or Manage Account → Subscription) is a **historical
precedent** for the mechanics, not the current offer; in that offer unlimited ran **one generation at a time** and had
per-model resolution/duration limits — the November post is silent on both, so assume the same until shown otherwise.

What the generic Terms add ([Terms](https://higgsfield.ai/terms), Free Trials and Promotional Offers): unless the offer
states otherwise, a trial converts to a paid subscription at the then-current standard price and the payment method is
charged until cancelled; cancel before the trial ends to avoid charges.

Facts we **do not have** and must read on the checkout/trial screen: the Ultra 3K **price and billing date**, whether
the card is **charged or only held** at sign-up, **when the 3 days start** (at card entry, connection or first
generation), the exact end time, whether the offer is open to **this account** (one-time new-user offers exist), whether
**cancelling** keeps the unlimited window until it ends, and what "all models" includes (resolution, duration,
concurrency, daily caps). Model names also changed since July (the 11.11 post lists Seedance 2.5, GPT Image 2.5/2.6,
Nano Banana Pro, Seedream 5.0 Pro; the earlier lists named Seedance 2.0, GPT Image 2): the model for each prompt is
picked from what the connected tool actually lists.

### Gate G1 — verification before ANY generation (zero credits, owner present)

Decision recorded 2026-11-14: **do not activate the trial, any subscription or spend any credit until the owner
approves in writing after this gate.** The gate has two parts. **Part 1 is read-only (before signing up);** part 2 is
checked in the connected chat right after the owner activates, **before the first generation**.

*Part 1 — on the offer/checkout page (nothing is entered, nothing is started):*
1. The offer is the **72-hour / 3-day MCP free trial, US$0, Unlimited, renews on Ultra 3K** (as in the 11.11 post).
2. **Ultra 3K price after the trial** and the **exact renewal date and time** (shown in the owner's time zone).
3. Whether a charge or authorisation happens today; which payment method.
4. When the 72 hours start, and how the trial is **cancelled** (exact steps) and what happens to access on cancel.
5. Whether the account is eligible; which **surface** the offer attaches to (Claude connector, ChatGPT plugin, CLI, web).
6. Output / commercial terms shown at sign-up (note the version/date).

*Part 2 — in the connected chat, before generating (the prompts to paste are in `05-connect-procedure.md`):*
1. The assistant lists the Higgsfield tools (proves the connection works).
2. **Credit balance** and **subscription/trial status** as reported by the connector, including plan name and renewal date.
3. A **cost quote for one test image and one video** with the chosen model: it must show **0 credits / unlimited**, or the
   quoted credits (scenario A, with a ceiling the owner sets). If the quote shows credits while the trial is supposed to
   be unlimited, **stop**: that is regime B, not A.
4. The model list available inside the unlimited window, with resolution/duration limits and concurrency.

**Stop conditions** (do not generate; ask the owner): any item above is not visible or contradicts the 11.11 post;
credits would be deducted without an approved ceiling; the plan or price differs from what the owner approved; the
renewal date or price cannot be read; the connector cannot show a cost before generating.

Result to record in `trial-verification.md` (template in `02-production-plan.md` §2.7), including a screenshot or
copied text of the offer, the confirmation e-mail and the renewal date.

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
