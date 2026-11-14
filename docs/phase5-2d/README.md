# Automotive Empire — Phase 5 2D game-first transition

**Status: draft playable vertical slice**, PR #13, not merged. Built on `phase4f-industrial-growth`. The 500+ existing simulation tests, financial equations, save v3 and prior Blender prototypes remain unchanged unless explicitly noted below.

## Product decision

Players enter a **native 2D manufacturer headquarters**, not a spreadsheet dashboard. Render original vector illustrations (scalable on small/mobile screens, lightweight without WebGL). Keep detailed dashboards accessible behind **Advanced analysis**, not deleted: experienced players can still diagnose costs, cash flow and production bottlenecks.

New 2D routes:

| Route | Gameplay |
|---|---|
| `hq2d` | Interactive HQ, factory and workshop site map; brand status, rewards, rival rankings and calls to action |
| `workshop2d` | Actual five-stage vehicle programme: engine → chassis → body → finish → approval; calls existing `startDevelopment` |
| `factory2d` | Clickable illustration of the five *real* production stages (body, paint, powertrain, assembly, inspection), with per-factory capacity and links to production configuration |
| `skills2d` | Real research skill tree: maps `TECHS` technology names/year requirements to existing `Company.tech`. The R&D investment control calls `setRd`; no instant magical tech unlocks |
| `collection2d` | Earned sales-milestone chest animation, disclosed rarity odds, era-limited cosmetic blueprints, collection and visual equipment, earned-credit redemption |
| `campaign2d` | Actual monthly advertising spending through `setMarketing` and dealership expansion through `investDealers` |
| `league2d` | Real **in-save AI manufacturer** ranking by simulated monthly or annual unit sales, explicitly not a network multiplayer ladder |

All menus and gameplay are in Spanish and English. Visuals use React SVG + CSS; the previous optional 3D viewport is not loaded by default. The game's existing `CarPoster` now visibly changes wheel styling and trim with **equipped** collectible cosmetics.

### Real historical engine inspiration

For the first build, the workshop includes reference presets inspired by the **1993 Toyota 2JZ-GTE** and **2011 Ford Coyote 5.0**. The parameters are **approximate gameplay values**, not exact licensed digital copies or official engineering designs. The simulation validates whether the current player's technology can support the selected specs. Expand the historic catalog with verified displacement, year, layout, induction, power and vehicle references, distinguishing public facts from game approximations. Never invent exact CAD or permission to publish a logo.

## Earned chest rules

`src/sim/progression.ts` is deterministic and additive to the existing save:

- Earn one free chest after company-wide cumulative model sales milestones **0, 50, 250, 1,000, 5,000, 20,000**.
- Six tiers: common, rare, epic, legendary, mythic, relic; public base weights **49.9%, 30%, 14%, 5%, 1%, 0.1%**. For early eras without any items of a rarity, that weight visibly transfers to common, so the displayed **effective odds** are honest.
- Rewards are original cosmetic **blueprints only**, not simulation horsepower, free cash or industrial equipment that would distort balance.
- Each chest awards **40 earned credits**; duplicates add another rarity-based consolation amount. Fixed-price blueprint redemption uses only earned credits.
- Equipment is selected from verified owned inventory, shows visibly on 2D car art and is saved inside optional `Company.arcade`.
- All older saves remain compatible because `arcade` is optional. Saves that contain a malformed `arcade` inventory are rejected during corruption validation, not silently loaded.
- Chests are not bought with fiat money, premium currency or paid credits.

## Commercial packs and Mercado Pago — future phase

The user wants optional real-money purchases. **There is no working checkout in this PR**, no product shipped behind a misleading payment button.

Only after an explicit business/legal review, implement **fixed-content cosmetic packs**, with everything listed before purchase; do not implement paid random-loot boxes. Proposed architecture:

1. User signs in to an authenticated game account; server stores owned purchases and rewards.
2. Static game frontend requests a pre-registered SKU from authenticated `POST /api/purchases`, never accepting client-provided prices, balances or entitlements.
3. Server creates a **Mercado Pago Checkout Pro** order using the provider's current server-side API and an account-owned private access token; returns a checkout redirect. No provider secret is ever bundled in Vite.
4. Server validates the provider's signed webhook, retrieves the payment independently, verifies account, SKU, currency, amount, status, uniqueness and idempotency before transactionally granting fixed entitlements.
5. A refund/reversal updates ownership and never regrants purchases from a duplicated webhook.
6. Administrative tools support order reconciliation, support and refunds; age/region restrictions, tax receipts, privacy policies, terms, chargebacks and platform rules must be addressed before launch.

**Never fund real-money purchases by simply trusting a browser mutation or a save-game field.** Cross-device inventory and competitions require a server database. Until then, credits are a single-player save currency.

## Real logos and cars

Real manufacturer names / historical lineups already appear as data in the simulation. Logo files, recognizable photographs, CAD and protected trade dress need an asset provenance register. For each asset record the rights holder, permitted scope, original source URL, license text, attribution, permitted commercial distribution, revocation, and local packaged filename. Don't hotlink random logo websites. In the meantime ship original vector silhouettes and clearly labeled public factual references.

A separate **historical engine encyclopedia** can show researched specifications and notable cars by era while preserving the distinction between historical reference and copyable in-game powertrain parameters. The same rule applies to official race car liveries.

## Ladders and rewards — future phase

The current leaderboard sorts live simulated **AI manufacturers in the current save**, with monthly/annual toggles. It is not an online server leaderboard and has no prizes.

A true weekly league would require authenticated players, server-defined start conditions and deterministic seeds, submitted actions or attested save progression, replay/anti-tamper checks, clear season cutoffs and prize eligibility. Separate manufacturer standings from race series standings. Do not advertise online weekly rewards until a trusted server can actually award them.

## Acceptance gates

- `npm run typecheck` / `npm test` / `npm run build` on the PR head.
- Browser flow: choose CEO/founder → land at HQ map → workshop five stages → create model → month advance → factory & marketing → free chest & re-open after autosave → monthly/annual league.
- Validate accessibility and mobile widths (especially 500px). Test reduced-motion mode and keyboard operation.
- Refine vector car art (the current original SVG is intentionally a **first 2D style pass**, not finalized pixel-art quality).
- Verify progression for long-running CEO games and historic eras; confirm exact published probabilities.
- Keep existing original finance dashboard as **Advanced analysis**, never discard simulation or break historical save imports.
- No merge until PR tests and browser acceptance pass.

### Rollout sequence

1. **Phase 5A (this PR):** 2D shell, map, functional guided workshop, real industrial stage selector, actual marketing, AI rankings, earned-only chests, research tree and game-first visual language.
2. **Phase 5B:** higher-quality 2D vehicle / engine illustration atlas across decades, authentic wheel/body variants, interactive factory building presentation, improved first-time onboarding and sounds.
3. **Phase 5C:** deeper achievement/skill objectives, balanced collectible cosmetics, historical catalog with verified attribution and asset provenance.
4. **Phase 5D:** backend accounts, server-authoritative weekly manufacturer/racing leagues, optional authorized fixed-content purchases with server-verified Mercado Pago payment fulfillment.
