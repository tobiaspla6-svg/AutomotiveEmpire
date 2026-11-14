# AE-01 Meridian — phase-1 prompts (ready to paste, NOT yet used)

Run in order 1 → 5. Nothing here has been sent to any tool. Each file lists the references to attach, the attempt cap,
the exact prompt and the negative list. The wording of the design (`DL-AE01`) is identical in all five files; only the
camera sentence changes. If you edit a prompt, edit all five and update `03-prompts.md`.

| Order | File | Prompt ID | Attempts |
|---|---|---|---|
| 1 | `1-front34.txt` | P-AE01-front34 (hero) | up to 4 |
| 2 | `2-side.txt` | P-AE01-side | up to 3 |
| 3 | `3-front.txt` | P-AE01-front | up to 3 |
| 4 | `4-rear.txt` | P-AE01-rear | up to 3 |
| 5 | `5-rear34.txt` | P-AE01-rear34 | up to 3 |

## Overlay check for the side view

Blueprint `assets-src/sedan-ref/references/side.png` is 1232 × 418 px at 220 px/m; wheel centres (front to the left):
**front (297, 310), rear (935, 310)** (axles at x = ±1.45 m, rolling radius 0.339 m). Measure the two wheel centres in
the generated image (any image viewer shows pixel coordinates), then:

```bash
python3 tools/concept/ingest.py overlay GENERATED_side.png assets-src/sedan-ref/references/side.png \
    --wheels fx,fy,rx,ry --bp-wheels 297,310,935,310 --out overlay-side.png
```

Judge the 50 % overlay by eye first; the printed numbers are a crude aid and are reliable only on a plain background.
Tolerances: overhangs ±4 % of wheelbase, roof ±3 %, belt line ±3 %, wheel diameter ±5 %.

## Checklist (`QA-VEH`)

Wheelbase/overhangs (overlay) · identical headlamp shape and count in `front34`, `front`, `rear34` · identical tail-lamp
bars in `rear`, `rear34` · same glasshouse outline, window count, pillar width · shoulder crease starts at the
headlamps and ends at the tail lamps in `side` and `front34` · same ten-spoke turbine 19" wheels · symmetry in
`front`/`rear` · no badge, logo, plate text or recognisable production design · long side ≥ 2048 px.
