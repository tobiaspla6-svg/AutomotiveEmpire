# Phase 4D — gameplay and stability audit

Branch `phase4d-gameplay-audit`, based on `phase4-premium-interface` (PR #5, still a draft). Nothing here touches `main`
or `visual-production-prep`, and no image-generation service was used.

## How the audit was done

| Tool | What it does | Evidence |
|---|---|---|
| `scripts/audit-playthrough.ts` | One founder game from day one through the real action API: three car designs, trims, regional prices, eight supplier contracts, dealers, a line per car, about 16 years of months, R&D, loans, a second plant, rivals, save/load. Checks every month: no NaN, ledger identities (Δequity = profit, Δcash = operating + investing + financing), no negative stock or cash, no sales without a line or stock. Also ~20 hostile inputs (negative, NaN, absurd sizes). | `evidence/playthrough.txt` |
| `scripts/audit-founder-sweep.ts` | 36 founder set-ups (3 eras × 3 capital levels × 2 specialisations × 2 difficulties) with a sensible single-car strategy, 10 years each. | `evidence/founder-sweep.txt` |
| `scripts/audit-accounting.ts` | The two ledger identities over 20 years of CEO and founder play with loans, dealers, automation and marketing changes between months. | `evidence/accounting.txt` |
| `scripts/audit-fuzz.ts` | ~1,450 random calls over 28 player actions on live CEO games (valid and invalid arguments, with months in between). Checks: no exception, no non-finite number, every cash movement booked, a success changes the state. | `evidence/fuzz-seed*.txt` |
| `e2e/audit.cjs` | The same journey in a real Chromium through the UI: found a company → design → develop 30 months → production line → price → 12 months of sales → loan/repay → research → market → found a race team → a season → save → reload the page → resume → keep playing. At 1920×1080 (English) and 1280×720 (Spanish). | `screens/*.png`, `screens/audit-results.json` |
| `e2e/audit-monkey.cjs` | Clicks every enabled button on every screen (EN, ES, founder), reporting console errors and clicks with no visible effect; each report was then checked by hand (`e2e/audit-focus.cjs`). | `monkey-results.json` |
| `e2e/audit-layout.cjs` | Horizontal overflow and clipped controls, 10 screens + menu + studio × 5 window sizes (1920×1080 … 1024×768) × 2 languages = 120 combinations. | `layout-results.json` |
| `e2e/audit-3d.cjs`, `e2e/audit-race-nowebgl.cjs` | Studio and live race with WebGL (software renderer), with WebGL blocked, graphics quality auto/medium/high. | `screens/3d-*`, `screens/race-*` |
| `e2e/audit-corrupt.cjs` | Imports ten damaged variants of a real save. | table below |

**What was not measured.** There is no GPU in this environment. The 3D runs use Chromium's *software* WebGL
(SwiftShader), so the 1–4 frames per second recorded there say nothing about real hardware; they only show that the 3D
path renders, does not throw, and that the fallback works. No GPU frame rate is claimed anywhere.

## Findings

### Fixed in this branch

| # | Class | Problem (reproduced) | Fix | Regression test |
|---|---|---|---|---|
| 1 | **P0** | A damaged save (truncated, hand-edited, or written by a future bug) loaded without any check. Missing `news`, `macro`, `ledger`, `tech`, `reach` or a vehicle's `stats` unmounted the whole React tree: a blank page, no message. Because the game autosaves every month, a state that crashes the interface is also saved to `autosave`, and **Resume** then crashes every time. Reproduced with 6 of 9 damaged variants (`audit-corrupt.cjs`). | `saveDamage()` in `src/sim/migrate.ts` is run after migration in `prepareLoadedGame`: a save missing anything the interface or the tick reads unguarded is refused with a message naming what is wrong; the menu stays usable and the autosave is not overwritten. | `tests/persistence.test.ts` (8 damage cases + healthy saves of all three modes); `e2e/run.cjs` *damaged saves* |
| 2 | **P0** | No error boundary anywhere: any render exception (a bug in one screen, a state the validator cannot foresee) blanked the whole application. | `src/ui/CrashGuard.tsx` wraps the app: plain message, "Back to the main menu" and "Reload", saves untouched; EN/ES. | `e2e/run.cjs` *crash guard* (a truncated racing division that passes validation) |
| 3 | **P1** | After a game over, **Review the books** navigated to Finance *behind* the game-over dialog, which cannot be closed: the button appeared to do nothing and the player could never read the accounts. | The dialog steps aside, a small strip "Your tenure is over · reason · Menu" stays; time stays blocked. `screens/gameover-after-fix.png` | `e2e/run.cjs` *game over* |
| 4 | **P1** (progression) | The guided path (design → develop → plant → line → sell) leaves a default founder selling ~18–70 cars a year from a line tooled for 60 a month, losing ~$10M a year, and nothing says why: the checklist's *sell* step is satisfied by the first sale, the "idle capacity" insight counts *assigned* line share, not sales, and dealer reach (the real limit; $8M of dealers took the same car from 72 to 597 a year) is never mentioned. | New executive insight `lowSales` (EN/ES): a car that sells under a quarter of the line it was tooled for, over three months, is flagged with the figures and a button to Market & sales (price vs recommended, dealers, marketing). No new system. | `tests/insights.test.ts` |
| 5 | P2 | `addTrim` threw on an unknown trim level (found by the fuzzer; the UI only offers valid ones). | Returns `Unknown trim level.` | `tests/trims.test.ts` |

### Checked and found sound

* **Accounting.** Over 20 founder years and 20 CEO years with player actions between months (`scripts/audit-accounting.ts`, `evidence/accounting.txt`; the playthrough repeats the check): Δequity equals profit and
  cash flow reconciles to Δcash in every month (0 violations); no negative stock, stock value or cash; the money moved by
  every action is booked in the ledger (the one apparent exception, `acquire`, takes over the target's debt as a
  documented non-cash liability).
* **Consequences.** Contracts, lines, prices, R&D budgets, dealers, loans, plant build/sell and trims all change state;
  a build-then-sell plant loses money (no arbitrage); borrow/repay loops are cash-neutral; a car with no line and no stock
  does not sell; a line cannot be added to a plant under construction; refused inputs (negative, zero, NaN, over capacity,
  over credit, unknown country) all return a message.
* **Saves.** JSON round trip is byte-identical; a reloaded game continues identically for 12 months (RNG state is saved);
  save size stays ≈0.9 MB after 40 years and the worst month tick is 55 ms (Node).
* **Interface.** All ten screens open without console errors in EN and ES; no button throws; every suspected "no-op"
  button was traced and works (the monkey run's 30 candidates were toasts masking the change or toggles); 120
  screen/size/language combinations have no horizontal overflow; no-WebGL falls back to the 2D illustration in the menu,
  studio and live race, even with graphics set to High.

### Pending (not fixed)

| Class | Item |
|---|---|
| P1 | **Modern-era founders sell very little.** With one car, a 2015 mass-market founder sells 90–240 cars a year (a 1965 one: 1,400–2,900) and a car loses sales as it ages; a 2015 "small plant" start only turns a profit with a sports car. The game does not block the player (credit and capital last 10+ years) but the early game is slow and unrewarding in the modern eras. Needs a calibration pass (founder reach/awareness per era, first-car demand), which would move the existing calibration tests; deliberately not retuned blind. Data: `evidence/founder-sweep.txt`. |
| P2 | Founder "no plant at start" (cap 0) always ends in insolvency within 6–10 years with one car: viable only if a plant is built early; the setup screen should say so. |
| P2 | The studio's default body is a family saloon even when the founder's speciality is sports; a player who accepts defaults builds the wrong car. |
| P2 | Supply-contract slider minimum is 100 sets a month, above a 60-a-month workshop's capacity; the take-or-pay penalty is small ($0.4M a year in the test) but the control should scale. |
| P2 | `setRd`, `setMarketing`, `setLineTarget`, `setDevBudget` silently ignore non-finite input (the number fields never produce it). |
| P2 | `startDevelopment` does not validate the segment id (the UI only sends valid ones). |
| P2 | Damaged-save and crash messages are English-only in the toast raised by the validator (the crash screen is bilingual). |
| P2 | If an action throws half-way, the state is not rolled back (the player is told the action failed). No such throw was found in ~1,450 fuzzed calls after fix 5. |
| P2 | Country names, championship names and circuit names stay in English in the Spanish interface (data, not interface). |
| — | GPU frame rate and real-hardware 3D performance were not measured (no GPU). |
