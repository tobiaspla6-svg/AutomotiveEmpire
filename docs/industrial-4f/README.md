# Phase 4F — industrial growth, economies of scale and profitability

Branch `phase4f-industrial-growth`, based on `phase4e-founder-calibration` (PR #7). Founder capital is not touched. No
profit, demand, money or dealers are given to the player. Two rule errors were found and fixed (§3); the hard
difficulty was made harder without taking money away (§6). Everything else below is measured, not tuned.

| File | What it is |
|---|---|
| `scripts/industrial-economics.ts` → `economics-2015-germany.md`, `economics-2015-spain.md` | Steady-state economics of plants of 60, 600, 1,500, 3,000 and 5,000 cars a month, from the game's own cost and market functions. |
| `scripts/audit-industrial-strategies.ts` → `before.json/txt`, `after.json/txt` | 20-year founder games with five growth strategies (hold, conservative, debt-funded, ahead of demand, aggressive), played only through the game's actions; plus 60-a-month workshops. |
| `scripts/summarize-industrial.ts` → `tables.md` | Every table: production, sales, costs, profit, debt, cash, equity, return on investment, before/after, difficulty. |
| `scripts/audit-scale-volume.ts` → `scale-volume-before.txt`, `scale-volume-after.txt` | The evidence for fix 1. |
| `scripts/audit-ai-check.ts` | Rivals after 10 years, normal and hard. |

## 1. Plant size: what the rules say (2015, Germany)

Starter designs from 4E; the cheapest automation the technology allows (90 % is cheapest at every size); unit cost after
three years of learning; competitive price = the car's value price for that volume; dealer network sized on the real
market to sell the plant's output; fixed costs = plant, head office, 25 engineers, dealer upkeep; plus revenue-linked
overhead and 3 % marketing. Full tables in `economics-2015-*.md`.

| Capacity / month | Budget car: investment | unit cost (yr 3) vs price | operating at full sale | Sports coupé: investment | unit cost vs price | operating | ROI | payback |
|---|---|---|---|---|---|---|---|---|
| 60 | $7M | $23,477 vs $15,293 | −$13M | $9M | $34,971 vs $30,016 | −$13M | — | never |
| 600 | $74M | $13,718 vs $15,293 | −$23M | $107M | $20,585 vs $30,016 | +$12M | 11 % | 5.9 y |
| 1,500 | $201M | $12,003 vs $15,293 | −$22M | $276M | $18,058 vs $30,016 | +$80M | 29 % | 2.8 y |
| 3,000 | $420M | $11,238 vs $15,293 | −$13M | $571M | $16,930 vs $30,016 | +$203M | 36 % | 2.4 y |
| 5,000 | $712M | $10,964 vs $15,293 | −$2M | $1,002M | $16,525 vs $30,016 | +$359M | 36 % | 2.4 y |

* **Break-even**: the sports coupé needs 357 cars a month at 600, 1,276 at 5,000. The budget car never breaks even in
  Germany at these sizes (its break-even volume is above the plant's capacity at every size); in **Spain** (wages $25/h
  against $46) it does at 5,000 a month: +$25M a year, ROI 3.6 %, payback 10.8 years.
* **A 60-a-month workshop is not viable with any product**: parts bought in handfuls cost almost twice as much
  (the volume factor is 1.94 at 60 a month, 1.03 at 5,000) and the car costs more to build than buyers will pay.
* Premium saloon: 2.3 % at 600 a month, 27–41 % from 1,500 up.

## 2. Why the budget car sells more and loses more

Per car sold, medium capital, year 10 (`tables.md`):

| Strategy | Cars a year | Revenue per car | Cost of the car | Fixed costs per car (plant, staff, marketing, dealers) | Depreciation | Operating per car (after $193 of logistics) |
|---|---|---|---|---|---|---|
| Hold at 600 a month | 7,199 | $21,661 | $19,970 | $3,889 | $1,373 | **−$3,764** |
| Conservative growth (1,350) | 16,200 | $20,236 | $16,875 | $3,048 | $1,190 | −$1,071 |
| Debt-funded growth (2,400) | 28,800 | $20,236 | $16,090 | $2,535 | $867 | +$550 |
| Built ahead of demand (5,000) | 60,000 | $20,236 | $15,418 | $2,563 | $556 | **+$1,504** |

What destroys it is the **cost of the car itself at small scale**: at 600 a month the car costs 92 % of what the
dealer pays for it, leaving nothing for fixed costs. Each extra car sold from a small plant loses money, so selling more
loses more. Volume cuts the cost of the car by 23 % (purchasing volume, learning, automation) and spreads the fixed
costs; only then is there a margin, and it stays thin (≈7 % of revenue at best in Germany). That is the budget
segment's economics for everyone in this game: a rival's best-selling budget car (VW Golf, 2015) costs $12,279 against
a value of $16,837, and AI overheads take 17 % of revenue.

## 3. Rule errors found and fixed

| # | Error (reproduced) | Fix | Evidence / regression test |
|---|---|---|---|
| 1 | **Volume discounts were given for idle tooling.** Parts were priced on the capacity a line was *tooled* for, not on the cars actually built. Two identical games building exactly 400 cars a month: the one whose line was tooled for 3,000 paid **$13,964** per car, the one tooled for 600 paid **$15,964**, and came out $5.2M a year better despite the extra tooling. Buying idle tooling was a way to buy cheaper parts. | Parts are priced on the cars built that month across the car's lines (`runPlayerMonth`), and shared engines/platforms count other cars at their demand capped by capacity (`families.ts`), as the AI already did. Now both pay $16,987 vs $16,961 and the over-tooled game is worse. | `scale-volume-*.txt`; `tests/industrial.test.ts`. Two older tests relied on the old rule and were corrected: `supply.test.ts` (compare months with equal output: a supplier disruption had cut output, which now rightly raises the cost per car) and `consequences.test.ts` (the "calm" company now tools a line sized to what it sells). |
| 2 | **A dealer network could grow without limit and take most of a segment with one car.** Demand is `cell × D·q / ΣD·q`; the player's D was its dealer reach, which can be bought freely, while the AI's reach is by construction the volume it sells. With growth strategies a 2015 one-model sports maker reached **544,000 sports cars a year by 2035 (68 % of the EU + North American sports market)**; with only the home region, 52 % of the EU sports segment. | `playerCoverage()` (`market.ts`, also used by the price guide): the player's distribution for a model in a market cell counts `V·(1 − e^(−D/V))`, V = the segment's yearly volume there. A network a tenth of the segment counts 95 %, one as large as the segment 63 %, never more than the segment. AI untouched. The Market screen's dealer note says it (EN/ES). | `tests/industrial.test.ts`; 4E founder results unchanged in substance (B beats A in 34/36 instead of 33/36; 2015 sports, medium capital: still 7,199 cars and +$45.6M). |

Neither fix touches normal-difficulty rivals: `scripts/audit-ai-check.ts` gives identical rivals before and after (18/18
trading in 2025, 52.25M cars a year, same top five).

## 4. Five growth strategies over 20 years (2015, Germany, 600-a-month plant at the start)

All share the 4E reasonable commercial policy and decide once a year from what the player sees; expansions use
`expandFactory` / `upgradeAutomation` / `addLine` with their real costs, 9-month works and credit limits (definitions
at the top of the script). Normal difficulty, after the fixes; $M:

**Sports coupé, medium capital ($632M of equity at launch)**

| Strategy | Alive 20 y | Capacity y20 | Cars y10 → y20 | Operating y10 → y20 | Operating, 20 y | Capex, 20 y | Operating ÷ capex | Equity y20 | Max debt |
|---|---|---|---|---|---|---|---|---|---|
| H hold | yes | 600 | 7,199 → 7,200 | 53 → 95 | 808 | 91 | 8.9 | 1,644 | 0 |
| S1 conservative, own funds | yes | 6,836 | 10,800 → 57,658 | 118 → 1,149 | 5,836 | 2,090 | 2.8 | 5,548 | 0 |
| S2 progressive, debt | yes | 9,600 | 17,746 → 64,480 | 209 → 1,227 | 8,300 | 2,694 | 3.1 | 7,494 | 0 |
| S3 ahead of demand | **no (year 3)** | — | — | — | −152 | 664 | — | — | 228 |
| S4 aggressive sales + capacity | yes | 19,200 | 28,800 → 158,198 | 268 → 2,389 | 15,435 | 6,035 | 2.6 | 12,712 | 335 |

**Budget car, medium capital ($650M)**

| Strategy | Alive 20 y | Capacity y20 | Cars y10 → y20 | Operating y10 → y20 | Operating, 20 y | Capex, 20 y | Equity y20 | Max debt |
|---|---|---|---|---|---|---|---|---|
| H hold | yes | 600 | 7,199 → 7,200 | −27 → −30 | −510 | 190 | 453 | 0 |
| S1 conservative | yes | 3,038 | 16,200 → 26,884 | −17 → 1 | −135 | 675 | 677 | 0 |
| S2 progressive, debt | **no (year 18)** | — | 28,800 → — | 16 → — | −216 | 1,726 | — | 1,093 |
| S3 ahead of demand | yes | 5,000 | 60,000 → 60,471 | 90 → 71 | 903 | 1,341 | 1,312 | 237 |
| S4 aggressive | **no (year 12)** | — | 28,800 → — | −82 → — | −596 | 804 | — | 583 |

Large capital, the workshops and every before/after figure: `tables.md`.

## 5. The critical cases

1. **Sports car selling ~100 % of its capacity: expand.** Holding at 600 a month earns $808M over 20 years. Expanding
   with own funds (S1) earns $5.8B and ends with 3.4× the equity, and with debt (S2) $8.3B. Each expansion pays back in
   about 2.5–3 years (§1). Building 5,000 a month before the demand exists (S3) is the exception: on medium capital the
   $664M of works, automation and dealers exceeds what the company and its lenders can carry, and it goes insolvent in
   year 3. On large capital the same move works (equity $16.1B, second only to S4).
2. **Budget car that sells more and loses more: the cost of the car at small scale** (§2). Growth helps only when it
   reaches real scale (S3: +$71–90M a year at 60,000 cars). Debt-funded or sales-led growth that stops short of it
   (S2, S4) loses money on every car while the debt piles up, and ends in insolvency.
3. **A 60-a-month workshop is not viable with a sports or a premium car**: −$3M to −$12M operating a year in every
   variant that stays at 60 a month, even with 5 engineers. The way out is to grow out of it: with own funds and 5 engineers, a small-capital
   sports workshop reaches 1,031 a month and +$162M a year by year 20. Mistakes still kill: a premium workshop on small
   capital that grows while keeping 25 engineers goes insolvent in year 20.
4. **Aggressive commercial + capacity vs conservative**: for the sports car, yes. S4 beats S1 by 2.3× in equity
   ($12.7B vs $5.5B), because it spends on plants that sell what dealers bring in, not on dealers beyond the segment.
   For the budget car, no: the same aggression without scale economics goes bankrupt in year 12 (medium capital) or 14
   (large).

## 6. Difficulty

**Measured first** (36 normal/hard pairs, same seed, before any 4F change): hard had less equity in 26 of 35 pairs
after 10 years but only 16 of 32 after 20 years, with a median gap of 0.0 %. The 4E entry barriers (less awareness and
reach at the start, dealers 20 % dearer) fade once the company is established. Hard was not meaningfully harder in the
long run.

**Changed (no money taken away; normal untouched):**
* Construction takes a quarter longer: plants 19 months instead of 15, expansions 11 instead of 9, stage works 8
  instead of 6 (`buildMonths`). Capital is tied up longer and capacity arrives later than the demand that asked for it.
  The factory screen and the guide show the real durations (EN/ES).
* Buyers get to know a new brand more slowly: awareness moves at 4 % of the gap a month instead of 6 %.
* A new badge earns standing more slowly: prestige moves at 0.5 % of the gap a month instead of 0.8 %. That costs value
  price, and so margin, for as long as the brand is young.
* Rivals defend their sales sooner and harder: a 5 % fall in a quarter (not 10 %) triggers a price response, and they
  follow cheaper rivals 50 % further, never below their minimum margin.

**After**: hard ends with less equity in **32 of 35 pairs at 10 years** (median −2.5 %) and **21 of 30 at 20 years**
(median −7.1 %, operating −$13M a year). Survival is the same (31/36 at 20 years on both). The gap grows with time
instead of vanishing, but it remains moderate for cash-rich founders (§7). Rivals stay in business on hard (18/18 after
10 years, 52.3M cars a year).

## 7. Tests and remaining points

* `tests/industrial.test.ts`: volume discounts follow output; coverage saturates for the player only; expanding a sold-out
  sports car beats holding; building far ahead of demand on medium capital fails; the budget car needs scale; hard's
  construction times, slower brand building, unchanged capital, rivals still in business.
* `npm run ci` and `npm run test:e2e` pass (see the PR).

Open:
* **A single 2015 design keeps selling for 20 years** (the age penalty bottoms out at 55 %). The S4 sports maker sells
  158,000 a year of one car in 2035. Model ageing and the AI's product cycles are a separate question.
* **Strategy S3 on large capital overspends on dealers** (budget car: reach of 1M cars a year for 60,000 sold). That is
  the strategy's rule, not the game's; the coverage limit stops the waste from turning into share.
* **Hard is harder, but moderately** (−7 % equity after 20 years). Stronger levers (rivals' new models, credit terms,
  harsher supplier markets) were not added without a decision.
* The price guide's "recommended" price still optimises the current month (open since 4E).
