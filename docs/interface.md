# Interface (Phase 4C)

How the game's interface is built: the design system, localisation, graphics on different hardware, onboarding and
the tests that cover it. Screenshots of every screen, before and after, in English and Spanish, are in
[`docs/screenshots/phase4c`](screenshots/phase4c).

## Design system

One visual language for every screen: graphite surfaces, hairline borders, one champagne-brass accent for primary
actions and highlights, steel blue for data, and semantic colours that are never decorative (green = profit or
healthy, red = loss or danger, amber = warning). Display type is Barlow Condensed, text is Inter; both are bundled
(`@fontsource`), so nothing is fetched from a CDN.

| File | What it holds |
|---|---|
| `src/styles/base.css` | tokens (colours, radii, shadows, fonts), typography, buttons, forms, tables, dialogs |
| `src/styles/shell.css` | top bar, grouped navigation, content area |
| `src/styles/menu.css`, `dashboard.css`, `studio.css`, `factory.css`, `motorsport.css`, `corporate.css` | one file per screen family |
| `src/styles.css` | setup screens, 3D viewer overlay, race weekend |
| `src/ui/ds/primitives.tsx` | `Panel`, `KpiTile`, `Tabs`, `HBar`, `RingGauge`, `StackBar`, `Sparkline`, `TrendChart`, `EmptyState` |
| `src/ui/ds/icons.tsx` | the icon set (inline SVG paths, one stroke weight) and the emblem |
| `src/ui/ds/poster.tsx` | drawn cars shown while 3D loads or when it is unavailable |

Screens: `MainMenu`, `Dashboard`, `Studio` (engineering studio) and `Vehicles` (range), `Factories`, `Motorsport` and
`RaceScreen`, `Corporate` (finance, market, research), `Views` (company, news, saves), `Setup`, `Guide`
(onboarding), `SettingsDialog`.

Rules the screens follow:

* A screen opens with what matters now (KPI tiles), then comparisons and trends, then detail. Tables are kept
  where the content really is a table (income statement, driver market, results).
* A visual comparison replaces a table where the comparison is the point: capacity against sales by region, cost
  against net price per car, the price ladder in the studio, the production flow of a plant.
* Nothing is decorative: every figure comes from the simulation, and every control of the previous interface is
  still present.
* Decisions that cannot be undone, or that cost more than the company can comfortably fund, state what is at stake
  and ask for confirmation: selling a plant, removing a line, ending a contract, retiring a model, cancelling a
  programme, an unaffordable development programme, a large factory or expansion, heavy borrowing, lay-offs,
  restructuring, acquisitions, releasing a driver, withdrawing from racing, loading or overwriting a save.
  Most decisions also offer **Estimate impact**, which plays the same simulation forward with and without them.

## Languages

English and Spanish. Components never hard-code text; they call `t('key')` from `src/i18n`.

* `src/i18n/en.ts` / `es.ts` — the catalogues. `es` is typed as `Record<MessageKey, string>`, so a missing Spanish
  string is a compile error.
* `src/i18n/parts/*.ts` — screen catalogues written as `[English, Spanish]` pairs, so a string cannot exist in one
  language only. `tests/i18n.test.ts` also checks that both languages use the same `{placeholders}`.
* `src/i18n/format.ts` — money, counts, percentages and dates per locale (`$16.7B` / `16,7 mil M $`).
* `src/i18n/terms.ts` — Spanish names for the fixed vocabulary the simulation produces (body styles, segments,
  regions, countries, engine layouts, technology areas, component categories, trim levels, founding options). The
  simulation keeps a single set of names; the interface maps them when it draws them. No game logic is duplicated.

Adding a language means adding a column to the pairs, a catalogue file and a `terms` dictionary.

**Not translated**: text the simulation writes as sentences — news items, board objectives and notes, decision
dialogs, the race log, engineering warnings and rule notes, history text — and proper names (models, technologies,
circuits, people, companies). These appear in English in the Spanish interface.

## Graphics on different hardware

The 3D viewers are optional. `src/three/hardware.ts` inspects the machine once; `src/three/quality.ts` resolves the
setting in force:

| Situation | Result |
|---|---|
| Graphics set to **Automatic** (the default) | Medium on a normal desktop; Low on software rendering, phones and machines with few cores or little memory. Automatic never chooses High. |
| WebGL missing, or a 3D view fails while playing | 3D is turned off for the session |
| Graphics set to **Off** | drawn cars everywhere; the race weekend uses a 2D track view |

Everything that imports Three.js is reached through `src/ui/Lazy3D.tsx`, so the menu, dashboard and management
screens are usable before, or without, any 3D code being downloaded. `Guard3D` mounts a viewer only when it is on
screen and the browser is idle, shows the drawn car until then, and catches a failing viewer. Low, Medium and High
use reduced-detail models (LOD2, LOD1, LOD0); the reduced models take their shading normals from the full-detail
surface (`tools/blender/sedan/export.py`), so they shade cleanly without loading the heavy model.

### Checking the frame rate on your own computer

No GPU was available where the game was built: frame rates there come from software rendering and say nothing
about a real graphics card. To validate on your hardware:

1. Open the game in Chrome, Edge or Firefox and click the settings button (sliders icon) on the menu or top bar.
2. Choose a quality level and press **Run test**. The dialog draws the reference car for 5 seconds and reports the
   average FPS, the frame time 95% of frames stay under, draw calls and triangles, the renderer the browser reports
   and a verdict (try a higher setting, good, choose a lower one).
3. Repeat for each level you want to compare. The engineering studio's viewer has the same test in its toolbar and
   also reports draw calls and triangles.
4. If the renderer shown is "SwiftShader", "llvmpipe" or "Basic Render Driver", the browser is not using the GPU:
   enable hardware acceleration in the browser settings and update the graphics driver.
5. A result of 58 FPS or more on a 60 Hz display, with the slowest frames under 20 ms, means the level is smooth on
   that machine.

## Onboarding

`src/sim/onboarding.ts` derives the getting-started steps from the state of the game (nothing is stored): design a
car, finish its development, own a factory, tool a line, sell, make a profitable month; a motorsport director gets
racing steps instead. The dashboard shows them as a checklist with one button to the next screen. A one-time welcome
explains the four basics (briefing, advancing time, estimating impact, confirmations). The top bar's help button
reopens both.

## Tests

| Suite | Covers |
|---|---|
| `tests/i18n.test.ts` | catalogue completeness, placeholders, plurals, locale formatting |
| `tests/graphics-fallback.test.ts` | automatic quality choice, software-renderer detection, WebGL-missing path |
| `tests/insights.test.ts`, `tests/onboarding.test.ts` | the briefing and the getting-started steps follow the simulation and are read-only |
| `tests/ui-render.test.ts`, `studio`, `factories`, `motorsport-ui`, `corporate-ui`, `setup-ui` | every redesigned screen renders from a live game in both languages, keeps its controls, shows no raw message key and no `NaN` |
| `e2e/run.cjs` | browser tests on the production build: menu, language switching, every screen, studio and time, borrowing / confirmations / contracts, save and load, a race weekend, the no-WebGL path, onboarding |

```bash
npm run ci          # type-check, unit and render tests, production build
npm run test:e2e    # builds, then runs the browser tests (needs Playwright with Chromium)
```

The browser tests are not part of `npm run ci`, so the unit suite still runs where no browser is installed.
