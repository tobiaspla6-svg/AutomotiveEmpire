# Automotive Empire — visual direction 2D, Phase 5B

**Status:** visual-development draft, stacked on PR #13. Source assets are original React/SVG. The simulation remains untouched.

## Chosen direction: premium illustrated automotive tycoon

Not retro pixel art and not a fixed photograph of a dashboard. The current game already has procedural, era-aware side silhouettes. Those remain appropriate for model catalogs and part cards; they were too simple for the game **first impression**, so the hero menu and critical workshop stages use a separate, more detailed **three-quarter showroom illustration**.

Art language:

- **Architectural environment:** realistic three-point studio lighting, glass, brushed metal, performance-car materials, geometric buildings with visual mass
- **Vehicles:** proportional tyres and wheelbase, non-rectangular greenhouse, curved body and lamp cutouts, physically understandable highlights, subtle chrome and tire materials
- **Interface:** legible white typography on dark navy/graphite, cold cyan for tech status, warm gold for primary actions; rarity colours only for loot tiers
- **Motion:** small hover changes, glints and short reveals; reduced-motion preference always disables decorative movement
- **No raster screen-as-button trick:** images/reference compositions may guide art, but every major action must remain a real clickable, keyboard-accessible control

## Implemented in this PR

| Component | Actual change |
|---|---|
| `HeroShowroom2D.tsx` | New custom-authored dynamic SVG automotive studio and three-quarter premium sedan/GT/SUV. Variable paint, headlights, mirror, carved grille, 10-spoke forged rims, architectural background and floor lighting. No 3D or external image requests. |
| `MainMenu.tsx` | CEO and Founder hero illustration. Motorsport retains its appropriate racing image. Existing menu navigation, save and settings controls are untouched. |
| `Empire2D.tsx` | Body, finish, approval stages use the richer vehicle preview for supported silhouettes. Engine/chassis continue to use technically meaningful 2D illustrations. |
| `Campus2D.tsx` | Improved skyline depth, atmospheric horizon, roadway materials, building-ground occlusion, roof-edge highlights and multi-layer tree shading. Existing isometric map and hot spots remain based on the game state. |
| `premium2d.css` | Unified high-value material/lighting tokens, responsive composition and accessibility-preserving transitions. |
| `hero-showroom-2d.test.ts` | SSR tests of the actual SVG scene, dynamic paint, distinctive roofs, unique SVG IDs, sanitized colour and no WebGL/network imagery. |

## Higgsfield reference integration

A separate 2K/16:9 image-generation job has been submitted for the menu's AAA visual direction (job id `8fa3da92-b540-4f1b-bf4e-fb10c44ae490`); at last status it was **waiting**, not delivered or approved. Do **not** claim this reference is already the source of current Blender/SVG assets.

When it completes, compare it with:
- `docs/phase5-2d/screens/desktop-es-00-menu.png`
- `docs/phase5-2d/screens/desktop-es-01-hq2d-full.png`
- `docs/phase5-2d/screens/desktop-es-02-workshop2d-full.png`
- `docs/phase5-2d/screens/desktop-es-03-factory2d-full.png`
- `docs/phase5-2d/screens/phone-en-00-menu.png`

The reference may propose better composition, color and lighting; reconstruct the *actual UI and art components* rather than pasting an opaque screenshot behind buttons.

## Next visual work, in priority order

1. **Full visual screenshot acceptance.** Review new menu and workshop at 1440×900 and 390×844, including 1950/1995/2026 vehicles. Check body shape for panel breakage, wheel overlap and lens alignment.
2. **Premium motor illustrations.** Give the existing I4/I6/V6/V8/V10/V12/EV art consistent cast-metal, belts, intake architecture and readable textures — while retaining true era distinctions and avoiding fake branded parts.
3. **Factory stage-by-stage enlargement.** Keep the existing seven real station actions; expand each to a richer illustrated close-up with consistent scale, animated progress where appropriate and a clear current bottleneck.
4. **Card and chest detailing.** Replace symbol-only cosmetic pictograms with meaningful unique technical/vector artwork. Preserve visible odds and the existing no-paid-chance policy.
5. **Mobile-specific scene art direction.** Recompose panels and illustrations; do not just shrink desktop cards.
6. **Coherent sound and transitions.** Existing sounds are opt-in; keep mute by default, never autoplay music.

## Quality gates and budgets

- Zero gameplay regression, TypeScript errors, or failing existing tests.
- No WebGL, GLB files or any remotely hosted image dependency in the critical 2D path.
- Native SVG gradient IDs must stay unique across simultaneous screens.
- No clickable controls represented solely by a raster element.
- Preserve all keyboard and screen-reader labels.
- Use browser screenshots, not a model-written claim of photorealism, to approve the final result.
- No real logos or manufacturer marketing images without rights/provenance verification.
- Avoid expensive full-screen SVG blur filters; restrict blur to small highlights and shadows.
- Keep the initial hero asset source small and cacheable; monitor actual bundle weight rather than comparing unrelated PNG sizes.

## Approval standard

The reference ceiling is high-end automotive game art, not the early procedural 3D GT model. The current vector hero is a **better initial treatment**, but it is **not photo-real**. Do not mark the visual design as finished until the actual browser screenshots, mobile layout, continuity with factory/engine/reward art and gameplay interaction have been reviewed together.
