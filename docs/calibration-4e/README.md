# Phase 4E — founder economics: diagnosis, strategy comparison, calibration

Branch `phase4e-founder-calibration`, based on `phase4d-gameplay-audit`. The demand model (`src/sim/market.ts`) is **not**
changed: no demand, prestige, money or dealers are given to the player. What changed is listed in §4 and justified by
the measurements in §1–§3.

| File | What it is |
|---|---|
| `scripts/diag-founder.ts` → `diagnosis.txt` | Demand decomposition of the player's car in its home market, 1965 / 1990 / 2015 (run on the baseline code). |
| `scripts/audit-founder-strategies.ts` → `before.json/txt`, `after.json/txt` | The 36 set-ups of the 4D sweep × strategies A, B, C (and B2 after), 10 years each. *Before* = commit `cd1cdbf`, *after* = this branch. |
| `scripts/summarize-founder-sweep.ts` → `tables.md` | All tables, including every individual game. |
| `scripts/audit-ai-check.ts` | Rivals after 10 years of a founder game (identical before and after, §5). |
| `e2e/audit-4e.cjs` → `screens/` | What the player is told now, in English and Spanish. |

## 1. Why a modern founder sells so little (baseline, strategy A)

The market formula is `demand = cell volume × D·q / (Σ D·q + D_other·q̄)`: **D** is dealer reach (cars a year the network
can handle) and **q** the car's appeal, a product of factors (product, price, prestige, reliability, age, awareness,
home market). For the founder's car in its home cell after two years on sale (`diagnosis.txt`, Germany, medium capital,
600-a-month plant, 80 engineers, $150k a month of marketing, opening price):

| | Mass 1965 | Mass 1990 | Mass 2015 | Sports 1965 | Sports 1990 | Sports 2015 |
|---|---|---|---|---|---|---|
| Player reach, share of all distribution in the cell | 0.21 % | 0.09 % | 0.13 % | 0.31 % | 0.26 % | 0.41 % |
| Appeal player / AI average | 0.32 | 0.07 | **0.02** | 0.82 | 0.38 | **0.21** |
| — price factor (list ÷ value price) | 0.11 (1.69×) | 0.04 (1.99×) | **0.02 (2.30×)** | 0.64 (1.21×) | 0.44 (1.38×) | **0.33 (1.50×)** |
| — product factor, player vs best-selling rival | 2.07 vs 1.52 | 1.81 vs 1.63 | 1.71 vs 1.48 | 1.20 vs 1.48 | 1.20 vs 1.74 | 1.26 vs 1.78 |
| — awareness, prestige | 0.85, 0.93 | 0.82, 0.92 | 0.78, 0.92 | 0.86, 0.90 | 0.82, 0.89 | 0.77, 0.89 |
| Unit cost vs value price | $2,455 vs $2,252 | $12,447 vs $9,337 | **$29,350 vs $17,344** | $2,677 vs $4,030 | $12,856 vs $16,905 | $30,555 vs $32,516 |
| Cars sold, last 12 months (line: 5,760) | 1,909 | 386 | 107 | 920 | 535 | 257 |
| Engineers (80, idle after launch), $M a year | 1.1 | 6.6 | **11.8** | 1.1 | 6.6 | **11.8** |
| Operating result, last 12 months | −3.9 | −14.6 | −25.5 | −3.5 | −13.1 | −22.6 |

(Operating = net profit minus the interest earned on cash; the diagnosis prints net profit and interest separately.)

**What this means.** The low sales are explained by four measurable causes, and none is a fault in the demand model:

1. **Distribution is never bought.** Sales ≈ reach × relative appeal × (cell volume ÷ total distribution). Strategy A keeps
   the starting 1,610–7,155 cars a year of reach for ten years. With a reasonable dealer policy the same 2015 sports car
   sells 7,200 a year (§2).
2. **The car costs more to build than its buyers think it is worth.** The studio's generic default design (build quality
   0.5, standard interior, 1.8 L) is a family car. Sold as a budget car its break-even price is 1.27× its value in 1965,
   1.59× in 1990 and **1.77×** in 2015 at 480 a month; even at 5,000 a month with 80 % automation it is 1.41× in 2015. Rival
   Golfs cost $12,300 to build against a value of $16,800: they were designed for that segment, and they have scale and
   decades of learning (unit cost falls 20 % over the first ~130,000 cars). A lean design (quality 0.25, basic interior,
   1.2 L, 15" wheels) brings 2015 to 1.23× at 480 a month and **0.98×** at 5,000 a month.
3. **The price chosen.** A demand-limited newcomer at 1.5–2.3× the value price sells a fraction of what it could. The
   guide's "recommended" price maximises *this month's* contribution at the current reach, which is right for a car
   with no dealers but leaves volume (and with it brand growth) on the table.
4. **Fixed costs nobody looked at.** An 80-engineer team idle after launch costs $11.8M a year in 2015 — more than the
   whole contribution of the car. And every maker paid a flat head office of $0.4M a month (2020 dollars), the same for a
   60-car workshop as for a volume manufacturer (§4.1).

**Era differences that are real and stay:** rivals' appeal rises from 0.67–0.89 (1965) to 1.16–1.71 (2015); modern cars
need volume to be cheap; wages (engineers cost $14k a year in 1965, $148k in 2015). These are the historical barriers
to entry and are not flattened.

## 2. Three commercial strategies on the 36 set-ups

Defined at the top of `scripts/audit-founder-strategies.ts`. Every decision uses only what the player sees at that
moment (price guide, last year's sales, stock, cash, dealer cost); no future information, actions only through the
action API.

* **A basic** — the 4D audit: line at 80 % of the plant, opening price, $150k a month of marketing, nothing else.
* **B reasonable** — price at the value price (never below unit cost + 8 %), marketing 3 % of revenue, dealers in the
  home region (+50 % network a year, at most 8 % of cash) only while each car earns a contribution and sales are below
  the line, line grown when it sells out, engineers trimmed to 25 after launch.
* **C aggressive** — 5 % under value, marketing 7 % of revenue, dealers in home and North America (×2 a year, up to 25 %
  of cash), the whole plant tooled, borrowing to keep two months of costs.
* **B2** (after only) — B with the starter design the studio now proposes for the speciality.

Before the calibration (baseline code):

* B beats A on the 10-year operating result in **30 of 36** set-ups; survival A 24/36, B 34/36; C does worse than B in 34/36.
* 2015, sports, medium capital: A sells 395 cars a year and loses $24.3M operating; **B sells 7,199 and earns +$41.5M**
  operating (first full year with an operating profit: year 8); C sells 7,200 and earns +$3.4M (it paid $186M for dealers it did not need).
* 2015, budget car, generic design: every strategy loses money operationally (A −29.5, B −25.1, C −60.2 $M a year at
  medium capital) — the product, not the commercial strategy, is the problem.

So the "modern founder sells too little" of the 4D audit was mostly the audit's strategy. Two genuine imbalances
remained, and only those were changed.

## 3. The imbalances found

| # | Measurement | Verdict |
|---|---|---|
| 1 | Normal and hard founders were not distinguishable: of the 36 pairs with an investing strategy, hard came out *better* in 17, worse in 15, identical in 4 (median operating gap +$0.1M a year). Founder hard mode only raised the interest rate on debt (most founders have none) and shortened the insolvency grace period. | Imbalance: the difficulty setting did nothing for a founder. |
| 2 | The head office cost a flat $0.4M a month (2020 $) whatever the size of the maker: about 13 % of a 60-a-month workshop's revenue in the 2020s, under 2 % of a 600-a-month plant's, negligible for Toyota. With every strategy, every small-capital founder lost money in 1990 and 2015. | Imbalance: a cost calibrated for volume makers applied unscaled to the smallest. |
| — | Low founder sales | Not an imbalance (§1–§2): strategy and product. Answered with information (§4.3), not with demand. |
| — | Interest earned on the founding capital (the era's base rate minus 2 points: from under 2 % to over 10 % a year) makes a cash-rich founder show a net profit while losing money on cars. | Real yields of the era, not an exploit (≈ zero in real terms), but misleading: the guide's "profit" step now requires an operating profit (§4.3), and the tables report operating results. |

## 4. Changes

### 4.1 Calibration (simulation)

* **Head office scales with capacity** (`headOffice()` in `src/sim/company.ts`): $0.4M × CPI × clamp(√(capacity ÷ 5,000),
  0.2, 1) a month. Unchanged for any maker with 5,000 cars a month of capacity or more (every volume maker, every
  established CEO company of that size); a 600-a-month plant pays 35 %, a workshop 20 %. Nothing pays more than before.
* **Hard difficulty, founders** (`src/sim/world.ts`, `src/sim/actions.ts`): the newcomer starts less known (home
  awareness 12 instead of 18, abroad 3 instead of 4) with 15 % less dealer reach, and dealers cost 20 % more on hard.
  Capital is not touched. Normal and easy are unchanged.

### 4.2 AI

No AI code changed. `scripts/audit-ai-check.ts` gives identical rivals before and after (15/15 trading in 1975 with
18.85M cars a year; 18/18 in 2025 with 52.25M; same top five).

### 4.3 Information for the player (no rules changed)

* **First design by speciality** (`starterVehicle()` in `src/sim/engineering.ts`, used by the studio for founders and by
  the founder set-up preview): affordable cars → lean hatchback (quality 0.3, basic interior, small engine); sports →
  2.0 L rear-drive coupé; luxury → six-cylinder saloon with a premium interior; utility → four-wheel-drive SUV; EV →
  electric coupé. Every value stays editable. Tested valid and buildable with the founder's technology in every era.
* **Studio warning when the car costs more than buyers think it is worth** (`st.market.costAboveWorth`, EN/ES): "Buyers
  of this segment value this car at about $15k, but at 3,000 a month it needs $17k just to break even. Simplify it…"
* **Insight "N engineers, no programme running"** with their yearly cost and the severance rule (EN/ES).
* **Guide step "Sell what your lines can build"** (founders only) between first sales and profit: done when sales reach
  half of the tooled line capacity; it explains dealers, marketing, price against value, a smaller line, and that each
  costs money. The profit step now requires an **operating** profit, so interest on the founding capital does not tick it.
* Already present and checked: the Market screen shows the reach and awareness per region, what an amount buys, and an
  impact preview; the Phase 4D `lowSales` insight points there.

`screens/en-02-studio-starter.png`, `screens/es-03-dashboard-guidance.png` and the rest show these in both languages
(`screens/results.txt`: warning shown, guide on the "reach" step, idle-engineers insight, no console errors).

## 5. Results after the calibration

Full tables: `tables.md`. Headline numbers:

| | Before | After |
|---|---|---|
| B better than A (10-year operating result) | 30/36 | **33/36** |
| Survival 10 years, A / B / C | 24 / 34 / 25 | 28 / 36 / 30 |
| C (aggressive) worse than B | 34/36 | 36/36 |
| Year-5 sales lower on hard than on normal | 27 of 52 pairs (more in 10) | **49 of 72** pairs (more in 4) |
| Rivals | — | identical |

Medians, 10th year (six set-ups per cell; operating result in $M a year; full table with net profit, cash, debt and
world share in `tables.md`):

| Era | Strategy | Alive 10 y before → after | Cars/yr before → after | Operating before → after |
|---|---|---|---|---|
| 1965 | A | 4/6 → 4/6 | 1,435 → 1,435 | −4.6 → −3.9 |
| 1965 | B | 5/6 → 6/6 | 6,300 → 6,173 | −2.1 → −1.4 |
| 1965 | B2 | — → 6/6 | — → 6,195 | — → +1.7 |
| 1990 | A | 4/6 → 5/6 | 638 → 611 | −13.4 → −10.0 |
| 1990 | B | 6/6 → 6/6 | 7,199 → 7,199 | −7.2 → −5.1 |
| 1990 | B2 | — → 6/6 | — → 7,160 | — → −3.3 |
| 2015 | A | 4/6 → 6/6 | 356 → 250 | −26.5 → −19.9 |
| 2015 | B | 6/6 → 6/6 | 5,895 → 5,895 | −14.3 → −10.4 |
| 2015 | B2 | — → 6/6 | — → 7,199 | — → −9.5 |

(normal difficulty; the medians mix profitable sports makers with loss-making budget-car makers, see below)

What a 2015 founder can now expect (normal difficulty, after):

| 2015 set-up | A basic | B reasonable | B2 reasonable + starter design | C aggressive |
|---|---|---|---|---|
| Sports, medium capital | 395 cars, −$20.2M | **7,199 cars, +$45.6M** | **7,199 cars, +$52.6M** | 7,200 cars, +$7.0M |
| Sports, large capital | 680 cars, −$15.4M | 7,199 cars, +$43.5M | 7,200 cars, +$54.4M | 7,200 cars, +$9.1M |
| Budget car, medium capital | 183 cars, −$25.5M | 4,753 cars, −$21.8M | 7,199 cars, −$27.3M | 7,200 cars, −$57.2M |
| Sports, small (workshop, 60 a month) | 66 cars, −$18.4M | 720 cars, −$8.3M | 720 cars, −$8.3M | 720 cars, −$15.4M |

So: a new maker in 2015 **can grow** with good decisions (sports, medium capital: from 395 to 7,199 cars a year and from
−$20M to +$46–53M operating), **still loses money** with poor ones, and a budget car from a 600-a-month plant **stays
unprofitable** in 2015 whatever the commercial strategy — it needs volume (a bigger plant) the strategies here never
buy. Workshops lose less than before (the head office) but are still not viable without further choices (fewer
engineers, a dearer car). Bankruptcy still happens: 11 of the 16 small-capital games played with A or C in 1965 and
1990 (both difficulties) end in insolvency within ten years.

**Difficulty after.** Hard slows growth consistently (fewer cars in year 5 in 49 of 72 pairs). In money the gap is
clear where the company grows into its dealer network (2015 sports, medium capital, B: +$45.6M normal vs +$36.8M hard),
but small elsewhere: a founder with a large cash pile and no debt barely feels a 20 % dearer dealer network. See §6.

**Accounting, inventories, saves.** The full unit suite (accounting identities, inventory, production, persistence,
long-run tests) passes unchanged except where a test was added; saves need no migration (no new state).

## 6. Not done / open

* **Difficulty in money for cash-rich founders** stays modest. Making hard bite harder would mean touching capital (as
  the CEO mode does with 0.7×) or rivals' behaviour; not done without a decision, because the request was to keep
  changes small and not to take or give money.
* The **price guide's "recommended" price** maximises the current month's contribution; for a newcomer with few dealers
  that is a high price and low volume. It is labelled an estimate and the Market screen shows the alternatives, but a
  "price for growth" hint could help. Not changed.
* **Plant expansion** is outside every strategy here (all cap at the 600-a-month plant). A budget-car founder in 2015
  probably needs it; not measured.
* The founder **capital options** and **reach at start** are unchanged; the sweep found no reason to change them.
