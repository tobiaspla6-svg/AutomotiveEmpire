# Automotive Empire — Phase 5: the 2D game

**Status: draft, PR #13, not merged.** Branch `phase5-2d-gameplay-vertical-slice`, built on `phase4f-industrial-growth`.
The economy, engineering, factory and racing simulations are the same as in Phase 4F: the 2D screens are a new
way to play them, not a parallel game. Saves from earlier versions still load.

## What the player sees now

The game opens at the **headquarters**. Every screen below drives the real simulation. Every figure is read from
the game state, and every button calls an existing simulation action.

| Screen (route) | What it shows | What its buttons really do |
|---|---|---|
| Headquarters (`hq2d`) | An isometric campus that grows from real data (see "How the campus grows"). It also shows the company level and XP, lifetime sales, earned credits, world rank, your range of cars (each drawn by segment and era), the onboarding checklist, the four closest objectives and the top-5 rivals. | Each building is a button that opens its screen. Claiming an objective calls `claimAchievement`. |
| Workshop (`workshop2d`) | Eight stages: engine → chassis & drive → gearbox → suspension & brakes → body → wheels & tyres → finish → approve. Each option is an illustrated card showing its era, level or technology lock and its effect on power, 0–100 km/h, reliability and unit cost, all computed with `computeVehicle` and `estimateUnitCost`. A live preview shows the car or engine, the scores, the programme budget and months (`planDevelopment`), and the segment it will compete in. | Approving calls `startDevelopment`. The "Hire" button calls `setEngineers`. |
| Iconic engines (inside the engine stage) | 16 historic engines grouped by decade: XK six, small-block 265, Bizzarrini V12, 901 flat-six, 426 Hemi, RB26DETT, Viper V10, S70/2, 2JZ-GTE, LS1, Prius THS, K20, S85 V10, 1LR-GUE, Coyote 5.0 and Tesla P85. Each shows its verified public data and its sources. | "Use as inspiration" loads a game preset that the player can then modify. It is still checked against the era, the company level and the researched technology. |
| Factory (`factory2d`) | A cut-away of each plant with seven sectors: raw materials → body shop → paint → powertrain → final assembly → inspection → dispatch. Load per sector comes from `stagesOf` and the plant's real `lastOutput`; the bottleneck flashes (`bottleneck`). Robots replace workers as automation rises. | Expand a sector (`expandStage`), set the inspection rate (`setInspection`), automate (`upgradeAutomation`) and enlarge the plant (`expandFactory`), each confirmed with its cost and lead time. A link opens the full factory manager. |
| Tech tree (`skills2d`) | The research skill tree mapped onto the real technologies by year. | Funding calls `setRd`. |
| Achievements & garage (`collection2d`) | Four tabs: **Achievements** (18, from real facts), **Chests** (sales milestones, with the odds for the current year shown), **Collection** (18 cosmetic blueprints by rarity, a showcase car, equip and unequip) and **Shop** (fixed prices in earned credits, gated by company level). | `claimAchievement`, `openSalesChest`, `equipPart` and `redeemPart`. |
| Marketing (`campaign2d`) | A brand billboard with your car, the monthly budget, awareness by region and the dealer network by region. | `setMarketing` and `investDealers`, using the same entry cost and cost per unit as the classic screen. |
| Rankings (`league2d`) | **Industry** league by units, revenue, profit, prestige, innovation or market share, with a podium, rises and falls against a year ago, and the season's awards. **Motorsport** shows the player's championship standings. | Read only. The rival makers are labelled as computer-controlled; nothing presents them as online players. |

The classic screens (dashboard, vehicles, research, factories, market, finance, company, motorsport, news, saves)
remain under **Advanced analysis** and the other menu groups.

### How the campus grows

Each part of the campus follows one real value:

- **Office:** its height follows annual units (1k / 10k / 100k / 1M). A wing appears at tier 3 and a mast at tier 4.
- **Design studio:** follows the number of engineers.
- **Laboratory:** follows the tech lead over the calendar.
- **Plants:** one building per real plant. Plants under construction show scaffolding and a crane; plants at automation ≥ 55 % show robots.
- **Showroom:** follows dealer reach.
- **Test track:** appears with a racing division or 10,000 sales.
- **Trophies:** count the claimed achievements.
- **Billboard:** lit while a marketing budget is active.

## Graphic system

One style throughout: **flat vector illustration** (SVG drawn by React, no bitmaps, no WebGL in the 2D path).
It uses a navy ground, warm gold for actions, and rarity colours only on rewards. All art is original and drawn in code.

| Component | File | Notes |
|---|---|---|
| Cars | `src/ui/art2d/Car2D.tsx` | All 8 body types with real proportions in metres and 6 era styles (1950s fins and chrome → modern). Equipped cosmetics change the drawing: kits, wings, scoops, stripes, roll cage, ride height and seven wheel designs. |
| Engines | `src/ui/art2d/Engine2D.tsx` | Inline, V, flat and EV layouts. Turbos, supercharger, hybrid motor, cam covers (OHV/DOHC) and block material are drawn. |
| Parts | `src/ui/art2d/Parts2D.tsx` | Chassis, gearbox, suspension, brakes and tyres. |
| Rewards | `src/ui/art2d/Rewards2D.tsx` | A chest per rarity with its own material, glow, rays and sparkles, and collectible cards with foil from legendary up. |
| Campus | `src/ui/art2d/Campus2D.tsx` | Isometric HQ. |
| Plant | `src/ui/art2d/FactoryLine2D.tsx` | The seven-sector line. |

- **Styles:** `src/styles/game2d.css`. Animations use only transform and opacity, and stop under `prefers-reduced-motion`.
- **Layouts:** desktop, tablet, and a 390 px phone (the campus buttons become a list).
- **Text:** in Spanish and English (`src/ui/game2d/text.ts`). The part names reuse the studio catalogue.
- **Keyboard:** every action is a real `<button>` reachable with Tab, with a visible focus ring.
- **Sound:** optional synthesised effects (`src/ui/game2d/sfx.ts`): a click, a claim jingle and a different chest jingle per rarity. Sound is **off by default**; the speaker button in the top bar turns it on, and the choice is remembered in the browser. There are no audio files.

## Progression and rewards

- **Achievements** (`src/sim/achievements.ts`): 18 achievements, each a fact read from the simulation.
  - Production and sales: first programme, first car, 100 built, 10k / 100k / 1M sold.
  - Engineering: first V8+, first turbo, first electrified car, technology leader (+3 years).
  - Range and reach: three models on sale, plant abroad, 10,000 a month of capacity, dealers in three regions.
  - Finance and standing: a profitable year, a 10 % margin, top ten, a teams' championship.

  Each can be claimed once. Claims are stored in the save with their date. A claim gives XP (company level) and earned credits, and some give a cosmetic blueprint. **They never give money, demand, prestige, dealers, capacity or performance.** A test checks that a new founder can claim nothing in any era, start size or speciality. Two thresholds were raised for that reason: a founder can start with a 5,000-a-month plant and two or three years of tech lead.
- **Company level:** 10 levels from XP. Levels gate the shop: epic needs level 3, legendary 5, mythic 7. Relics can never be bought.
- **Chests** are opened only at real cumulative-sales milestones (0, 50, 250, 1,000, 5,000 and 20,000 cars). Results are deterministic per save. The odds are shown for the current year: a rarity with no blueprint invented yet passes its share to common. **No chest can be bought, with real money or with credits.**
- **Cosmetics are visual only:** they change the illustrated car (showcase, range and billboard) but never horsepower, cost or sales.
- **Old saves:** `Company.arcade.xp` and `achievements` are optional, so old saves load. Damaged values are refused by `saveDamage`.

## Historic engines: real data and approximations

`src/data/iconicEngines.ts` keeps two things apart:

- **`fact`:** the published layout, displacement, induction and rated output, with 2 sources per engine (manufacturer heritage or press pages where available, otherwise reference articles). The sources were retrieved on 2026-11-15. Where sources differ, the commonly cited production figure is used and the difference is noted.
- **`preset`:** a **game approximation** fed to the simulator. It is not an official specification, and the power the game computes for it depends on the era's technology and the player's choices.

Maker names are used only to identify the historic engine. No logo, photograph, CAD or trade dress is included.

## Real brands, logos and photographs

- **No protected assets in this PR.** No logo, photograph, livery or 3D model was downloaded or added. Real maker names stay as data, as in earlier phases. All art is original vector drawing.
- **To add licensed art later:**
  1. Store each authorised file under `public/licensed/<owner>/`.
  2. Record its provenance: rights holder, licence text or contract, permitted scope (commercial use, territories, duration), attribution, source URL, date and the person who approved it.
  3. Only then reference it.
- **Every Phase 5 drawing works without licensed files**, and the original illustrations stay the fallback.

## Shop and Mercado Pago: not implemented, by design

This version **has no payment of any kind**. The shop sells cosmetic blueprints for **credits earned by playing**, at fixed prices. A "Collector packs (future)" panel explains this, and its button is disabled.

A future real-money shop for optional **fixed-content** cosmetic packs would need all of the following. None of it exists in this repository, and no credential was used or stored:

1. **Player accounts and a server database** that owns entitlements. A browser save can be edited and cannot be trusted with purchases.
2. **A server endpoint** that creates a Mercado Pago payment for a SKU defined on the server, using the merchant's **private access token**, which is held only on the server and never put into the Vite bundle.
3. **Webhook verification:** check the signature, fetch the payment from Mercado Pago independently, check amount, currency, SKU and account, then grant the items once (idempotently). Refunds and chargebacks reverse the grant.
4. **Legal and commercial review:** terms, privacy, consumer law, taxes and invoices, minors, and app-store rules.

Lootboxes for money are excluded: packs would list their full contents before purchase, and nothing in them may affect progress.

## Online leagues: not implemented

The rankings are computed from the current save. The rival makers are run by the computer and are labelled as such.

Weekly online leagues would need accounts, a server that defines each season (seed and start conditions), result verification or anti-cheat (replays or server-side simulation), and prize rules. The screen says this in both languages.

## Verification (run on this branch)

- `npm run typecheck`
- `npm test`: the whole unit suite. New tests in `tests/achievements-2d.test.ts` cover achievements, levels, shop gating, save validation, the engine catalogue and SVG rendering. `tests/phase5-2d-ui.test.ts` covers every 2D screen rendered on the server, in English and Spanish.
- `npm run build`
- `npm run test:e2e`: the browser suite in Chromium. It includes the two tests that failed before on PR #13 (the hub now contains the onboarding checklist). Two new tests cover:
  - the full 2D loop: building → workshop → V8 changes power → approve → achievement claimed once → starter chest → card in the collection → plant sector → rankings after a month;
  - phone width: nothing overflows 390 px.
- **Screenshots:** `docs/phase5-2d/screens/`, produced by `node e2e/shots-2d.cjs docs/phase5-2d/screens` from the real build. The game is a Toyota CEO game started in 1995 and advanced two months. Captures are desktop 1440 px in Spanish and phone 390 px in English. They are real captures, not mock-ups.
- **Art review page:** `npx tsx scripts/art-gallery.tsx out.html [cars|kits|engines|parts|rewards|campus]`.

## Still to do

- **Art:** more shape variants within each body type (one silhouette per type and era today), animated race scenes, and more factory equipment detail per era.
- **Skill tree:** it still uses the earlier Phase 5 styles (`empire2d.css`) and should move to the `g2` system.
- **Testing:** dedicated phone-layout passes for the factory and marketing screens, and a screen-reader audit.
- **Balance:** credit prices and achievement rewards need checking over long games once players try them.
