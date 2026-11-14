# 3. Prompt packs

All prompts are tool-independent text; they work in Higgsfield (any image model) or any other generator. Nothing here
has been run. Each prompt has an ID used in the manifest (`prompt_id`).

> **Scope, revision 2:** only **AE-01 Meridian** is in production (phase 1). Families AE-02…06, backgrounds, UI
> references, motorsport imagery and all videos below are **specified but on hold** until the owner has reviewed the
> Meridian results. The ready-to-paste AE-01 prompts are in `prompts-ae01/`.

## 3.1 How consistency is enforced

A text-to-image model cannot guarantee that a car has the same wheelbase in five pictures. We therefore do not rely on
the prompt alone. Every vehicle goes through the same five steps:

1. **Blueprint first (free, deterministic).** A parametric side/front/rear/top drawing is produced from our own numbers
   (for family 1 this already exists: `assets-src/sedan-ref/references/*.png`, `reference_sheet.py`). Dimensions in the
   prompt come from the same table, so words and drawing agree.
2. **Hero first.** Generate several candidates of **one** view only — the front three-quarter *hero* — and approve one.
3. **Chain from the hero.** The other four views are generated with the approved hero uploaded as an image reference
   (or saved as a Higgsfield **Element** named `AE-0x-<name>`) plus the same *Design Lock* text. One variable changes
   per prompt: the camera.
4. **Overlay check.** `python3 tools/concept/ingest.py overlay` aligns a generated side view to the blueprint by the two
   wheel centres and writes a 50 % overlay. Pass = wheelbase, overhangs, roof height and belt line inside the
   tolerances below. Fail = regenerate (counts against the retry cap in `02-production-plan.md`).
5. **Checklist.** Lamps, windows, body lines, wheels, no badges/logos/plates. Only approved images are committed.

**Tolerances** (measured on the side view after alignment, as a fraction of wheelbase): front overhang ±4 %, rear
overhang ±4 %, roof height ±3 %, belt-line height ±3 %, wheel diameter ±5 %. Detail drift (lamp shape, grille pattern)
is judged against the checklist, not measured.

**Five views per vehicle** (file stems match what `build.py --references=DIR` loads, except `rear34`):

| # | Stem | Camera | Purpose |
|---|---|---|---|
| 1 | `front34` | front three-quarter, driver's side, eye level, 35 mm look, whole car in frame | **Hero**; marketing, menu, Blender mood reference |
| 2 | `side` | pure side elevation, 85 mm look, camera at wheel-centre height, car parallel to frame, front to the left | proportions: wheelbase, overhangs, roofline |
| 3 | `front` | pure front elevation, centred, wheel-centre height | lamps, grille, width, stance |
| 4 | `rear` | pure rear elevation, centred, wheel-centre height | tail lamps, diffuser, glass |
| 5 | `rear34` | rear three-quarter, driver's side, eye level | rear shoulder, C-pillar, deck |

The top view comes from the blueprint, not from AI. `interior` is optional and generated only for family 1 (it
already has a prompt in `assets-src/sedan-ref/references/PROMPTS.md`).

## 3.2 Shared blocks

**STUDIO-BASE** (appended to every vehicle prompt): `studio photograph on a seamless dark graphite floor and
backdrop, soft overhead softbox plus two long strip lights, low contrast reflections, sharp focus, no people, no
text, no watermark, no badges, no logos, no licence plate, no brand names, no recognisable production car, original
design`

**NEGATIVE** (use the model's negative field, or append "Avoid: …"): `badge, emblem, logo, brand lettering, licence
plate text, real manufacturer styling cues, extra wheels, mismatched wheels, asymmetric lamps, duplicated door
handles, warped proportions, melted details, fisheye distortion, cropped wheels, motion blur, people, reflections of
cameras or photographers`

**Per-view suffixes**

| Stem | Suffix |
|---|---|
| `front34` | `front three-quarter view from the driver's side at eye level, 35 mm lens, whole car in frame, wheels visible` |
| `side` | `exact side elevation, orthographic look, 85 mm lens, camera at wheel-centre height, car perfectly parallel to the frame, front of the car to the left, both wheels and both overhangs fully visible` |
| `front` | `exact front elevation, centred, camera at wheel-centre height, 85 mm lens, perfectly symmetrical framing` |
| `rear` | `exact rear elevation, centred, camera at wheel-centre height, 85 mm lens, perfectly symmetrical framing` |
| `rear34` | `rear three-quarter view from the driver's side at eye level, 35 mm lens, whole car in frame` |

**Chaining sentence** for views 2–5: `Same car as the reference image: identical proportions, wheelbase, lamps, glasshouse
and body lines; only the camera changes.`

## 3.3 The six design families

Working names are placeholders and must pass a trademark/real-car screen (a web search plus a check against the
manufacturers in `src/data/manufacturers.ts`) before any public use. Dimensions for families 2, 4, 5 follow the game's
body definitions (`BODY` in `src/sim/engineering.ts`, wheelbase as a fraction of length); family 1 follows
`design.py` and the catalogue entry (`catalog.ts`: 4.825 × 1.89 × 1.446 m); families 3 and 6 are era-specific. All are **targets for the prompt and the overlay**, not claims about
existing models.

| ID | Working name | Body / era | L × W × H (m) | Wheelbase | Layout | Game use |
|---|---|---|---|---|---|---|
| AE-01 | **Meridian** | executive saloon, 2020s | 4.83 × 1.89 × 1.45 | 2.90 | front engine, RWD/AWD | **exists as GLB** (`sedan-ref`) |
| AE-02 | **Kestrel** | compact hatchback, 2020s | 4.00 × 1.70 × 1.48 | 2.52 | front engine, FWD | mass-market, founder start |
| AE-03 | **Tallis** | grand-touring coupé, 1960s | 4.40 × 1.68 × 1.27 | 2.55 | front engine, RWD | historical CEO era, menu |
| AE-04 | **Orrin** | mid-engine supercar, 2020s | 4.50 × 1.95 × 1.16 | 2.66 | mid engine, RWD/AWD | prestige / supercar segment |
| AE-05 | **Brantley** | family SUV, 2020s | 4.70 × 1.88 × 1.72 | 2.82 | front engine, AWD | volume segment |
| AE-06 | **Vektor** | endurance prototype (Hypercar-style), 2020s | 4.95 × 2.00 × 1.05 | 3.05 | mid engine, hybrid | motorsport, race livery |

Pickup/van and wagon are not in this wave (noted for a second pass).

### Design Lock text (paste before the view suffix; one block per family)

Each lock states: overall silhouette, proportions in plain numbers, lamps, glasshouse, 2–3 distinctive lines, wheels,
colour. The same text is used in all five views.

**AE-01 Meridian — `DL-AE01`** (derived from `design.py` and the existing `PROMPTS.md`)
> Original modern four-door executive saloon, 4.83 m long, 1.89 m wide, 1.45 m high, wheelbase 2.90 m, long hood and
> short front overhang (0.89 m), longer rear overhang (1.04 m), cab-rearward glasshouse with a gently curved roof and a
> raked rear window ending on a short trunk lid, crisp shoulder crease running from the headlamps to the tail lamps,
> sculpted lower doors with gloss-black sills, slim LED headlamps with three projector modules, wide trapezoidal grille
> with a fine diamond mesh and one horizontal chrome blade, vertical corner intakes, full-width slim LED tail lamps
> with three horizontal light bars, rectangular exhaust finishers in a gloss-black diffuser, 19-inch ten-spoke turbine
> alloy wheels, chrome window surround, deep blue metallic paint.

**AE-02 Kestrel — `DL-AE02`**
> Original compact five-door hatchback, 4.00 m long, 1.70 m wide, 1.48 m high, wheelbase 2.52 m, very short overhangs
> (front 0.85 m, rear 0.63 m), upright tall-greenhouse profile with a steeply raked windscreen and a near-vertical
> tailgate, a single rising beltline that kicks up at the rear door, a rear quarter window shaped like a blade,
> compact horizontal LED headlamps joined by a thin light bar, small lower grille with a honeycomb mesh, two-part tail
> lamps wrapping into the tailgate, black roof pillars, 17-inch five-spoke aero alloy wheels, white pearl paint.

**AE-03 Tallis — `DL-AE03`**
> Original 1960s two-door grand-touring coupé, 4.40 m long, 1.68 m wide, 1.27 m high, wheelbase 2.55 m, very long bonnet,
> short fastback cabin set far back, short tail, front overhang 0.80 m and rear overhang 1.05 m, thin chrome-free
> body with a soft shoulder line from the front wheel arch to the tail, an oval full-width grille opening with a
> single horizontal bar, two round headlamps recessed in the fenders, small round tail lamps, side-vent behind the front
> wheel, thin pillars, wire-spoke wheels 15 inches, polished stainless exhaust tips, deep red solid-gloss paint.

**AE-04 Orrin — `DL-AE04`**
> Original mid-engine two-seat supercar, 4.50 m long, 1.95 m wide, 1.16 m high, wheelbase 2.66 m, cab-forward cabin,
> short front overhang 0.95 m and rear overhang 0.89 m, wedge profile, sharp horizontal beltline, large side air intakes
> ahead of the rear wheels feeding the engine bay, low split front splitter, thin Y-shaped LED headlamps, a
> mesh engine cover visible through the rear glass, full-width tail light blade above a rear diffuser, central exhaust
> exit, fixed rear wing integrated into the tail, 20-inch front and 21-inch rear centre-lock alloy wheels, matte
> metallic orange paint.

**AE-05 Brantley — `DL-AE05`**
> Original five-door family SUV, 4.70 m long, 1.88 m wide, 1.72 m high, wheelbase 2.82 m, upright squared-off body
> with a flat roof and roof rails, short overhangs (front 0.92 m, rear 0.96 m), strong horizontal shoulder with
> pronounced wheel-arch cladding in satin black, wide hexagonal grille with horizontal slats, slim LED headlamps above
> separate round fog lamps, skid plates front and rear, vertical full-height tail lamps at the tailgate edges, 20-inch
> five-spoke dual-tone wheels, forest-green metallic paint.

**AE-06 Vektor — `DL-AE06`**
> Original endurance-racing prototype in the Hypercar style, closed cockpit, 4.95 m long, 2.00 m wide, 1.05 m high,
> wheelbase 3.05 m, long sloping nose with a low front splitter, covered front and rear wheels with shaped arches, a
> teardrop canopy with a central roof air scoop, a tall vertical fin running from the cockpit to the rear, a
> full-width rear wing on twin uprights, slim LED headlamps in the nose corners, a red rain-light and rear LED
> strip, a flat floor with a rear diffuser, 18-inch centre-lock wheels, livery as **flat colour blocking only**, no
> numbers, no sponsors, no logos, base colours graphite and champagne gold (`#c9a35c`).

### Full assembled prompt (template)

```
[Design Lock DL-AEnn] [STUDIO-BASE] [view suffix] [for views 2–5: chaining sentence]
Negative: [NEGATIVE]
```

Prompt IDs: `P-AE01-front34`, `P-AE01-side`, … `P-AE06-rear34` (30 vehicle prompts). Store the final text actually
sent in `assets-src/concepts/prompts/<prompt_id>.txt` and its SHA-256 in the manifest.

### What to check on every vehicle image (checklist `QA-VEH`)

1. Wheelbase and overhangs match the table (overlay for the `side` view).
2. **Lights:** same shape, count and position in `front34`, `front`, `rear34`, `rear` (headlamps; tail lamps).
3. **Windows:** same glasshouse outline, number of side windows, pillar thickness, window-surround colour.
4. **Distinctive lines:** the named crease/beltline starts and ends at the same places in `side` and `front34`.
5. **Wheels:** same design, size and colour; four wheels, no mismatched pair.
6. No badge, logo, plate text, brand lettering, or recognisable production design (reject, do not retouch).
7. Symmetry in `front`/`rear` (mirrored halves agree to the eye).
8. Resolution ≥ 2048 px on the long side; no cropped wheels.

## 3.4 Premium studio backgrounds (plates, no vehicle)

Intended for the menu, store art and promo compositing. Palette must match the interface tokens: background
`#0a0b0e`, panels `#14161b`, accent champagne `#c9a35c`, steel `#8fa6c2`.

`BG-01 graphite-cyc`: `empty premium automotive photography studio, seamless dark graphite cyclorama, polished
concrete floor with a soft reflection, large overhead softbox, two long strip lights, faint champagne-gold rim light
from the left, wide 16:9, no objects, no text, no people, shallow depth, 2K`
`BG-02 brass-showroom`: `empty luxury car showroom at night, dark graphite walls with a thin brushed-brass line
running along the wall, polished black floor, warm pin spotlights, generous negative space in the centre, 16:9, no
cars, no text, no logos`
`BG-03 design-studio`: `automotive design clay studio, empty, large side-lit modelling platform, sketch boards out
of focus on the walls, cool steel and warm brass lighting, 16:9, no cars, no text`
`BG-04 wind-tunnel`: `empty automotive wind tunnel test section, turntable floor, smoke-rake lines, cool steel light
with a champagne accent, dramatic perspective, 16:9, no cars, no text`
`BG-05 factory-hall`: `modern automotive assembly hall, empty line with robot arms out of focus, dark graphite
and steel, warm amber work lights, clean floor with reflections, wide 16:9, no cars, no people, no signage text`
`BG-06 night-asphalt`: `empty wet asphalt apron at night, low sodium and cool blue lights in the distance, soft haze,
reflective ground, generous empty foreground for a car, 16:9, no cars, no text`

Variants: a 21:9 crop and a 9:16 crop for each approved plate (`outpaint/expand` in Higgsfield, or crop).

## 3.5 Game-interface concept references

**Mood and composition only.** Generated UI contains unreadable or invented text and must never be shipped or treated
as the implemented design — the real interface is React/CSS and already exists (`docs/interface.md`). Keep these in
`assets-src/concepts/ui-mood/` with `intended_use: "internal mood reference"`.

Common block `UI-BASE`: `premium dark-graphite automotive strategy-game interface, restrained champagne-gold accent,
steel-blue data colour, condensed display type with clean sans text, thin hairline borders, subtle depth, no
real brand logos, placeholder text only, 16:10`

* `UI-01 menu`: `UI-BASE, main menu, left column with three game-mode cards, large 3D showroom car on the right, dark
  studio floor`
* `UI-02 dashboard`: `UI-BASE, executive command centre, a row of KPI tiles with sparklines, a large trend chart, a
  ranked list of recommendations`
* `UI-03 studio`: `UI-BASE, vehicle engineering studio, three columns, controls left, large 3D car centre, performance
  metrics right`
* `UI-04 factory`: `UI-BASE, production flow diagram, five stage nodes connected by arrows with one highlighted
  bottleneck`
* `UI-05 motorsport`: `UI-BASE, race-team headquarters, driver cards, championship bars, race calendar strip`

## 3.6 Motorsport imagery

Fictional teams only (those in the game), **flat colour blocking, no sponsors, no real series logos, no numbers
that match real teams**. Base: `MS-BASE: original endurance racing prototype Vektor [DL-AE06 short form], graphite and
champagne-gold livery, no logos, no text`.

* `MS-01 grid`: `MS-BASE, on a starting grid at dusk, wide low angle, three cars in line, stadium lights, haze`
* `MS-02 pit`: `MS-BASE, in the pit lane during a stop, crew silhouettes out of focus, fuel-rig light trails`
* `MS-03 rain`: `MS-BASE, racing in heavy rain, spray rooster tail, low front three-quarter, headlights on`
* `MS-04 night`: `MS-BASE, night racing, light streaks, rear three-quarter at speed on a long straight`
* `MS-05 cockpit`: `first-person cockpit of an original endurance prototype, wheel display glowing, track ahead, no brand
  marks`
* `MS-06 podium`: `abstract celebratory podium scene with champagne spray and gold confetti, no people faces, no
  trophies with text`
* `MS-07 livery sheet`: `side elevation of Vektor on a plain light background in four different flat-colour livery
  schemes, no logos` — used to pick team colours; the in-game liveries stay procedural.

## 3.7 Cinematic promotion videos

Clips are short (about 8 s, 1080p at best). A trailer is **assembled** from clips in an editor outside the repository.
Every clip starts from an approved still (image-to-video) so the car design stays the one we approved.

Common block `VID-BASE`: `slow cinematic camera move, shallow depth of field, premium automotive commercial look,
dark graphite environment with champagne-gold accents, no text, no logos, no badges, 24 fps, 16:9`

| ID | Start frame | Prompt (after `VID-BASE`) | Use |
|---|---|---|---|
| `V-01 hero-reveal` | AE-01 `front34` on `BG-01` | `the car slowly emerges from darkness as the strip lights come on, camera dollies in low` | opening |
| `V-02 studio-orbit` | AE-01 `front34` | `smooth 90-degree orbit around the car, reflections sliding along the body` | menu loop |
| `V-03 design-line` | AE-04 `front34` | `camera tracks along the side shoulder line, a thin gold highlight follows the crease` | design pillar |
| `V-04 factory-flow` | `BG-05` | `camera glides along an empty assembly line as lights switch on in sequence` | industry pillar |
| `V-05 race-start` | MS-01 | `lights go out, the cars launch forward, camera pulls back` | racing pillar |
| `V-06 rain-race` | MS-03 | `cars race through spray, camera tracks beside them at low height` | racing pillar |
| `V-07 logo-sting` | `BG-01` | `dark studio, a champagne-gold light sweep reveals an empty centred space for a logo` | outro (logo added in the editor) |

Video labels: every clip is marked "concept / promotional footage, not gameplay" in the manifest and, when
published, on screen. Audio: not generated in this wave (keeps rights simple); add licensed or CC0 music separately
and record it in the manifest.

## 3.8 Prompt discipline

* One change per iteration; edit the prompt text, keep the Design Lock verbatim.
* Seeds: record the seed/job id whenever the tool exposes it.
* If a model refuses or adds a logo, do not retouch it: regenerate with a different model from the allowed list.
* The agent must state the credit cost and wait for approval before each batch (rule in `02-production-plan.md`).
