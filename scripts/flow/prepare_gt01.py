#!/usr/bin/env python3
"""GT-01 base layers from the untouched Flow original, by local image processing only (no generated pixels).

    python3 scripts/flow/prepare_gt01.py <user-gt-blue-original.jpg> public/flow/gt01

Steps, each reversible and verified at the end:
  1. background: the light studio backdrop is flood-filled from the image border (colour distance to the
     backdrop's median colour), giving a real alpha channel; edge pixels are un-mixed from the backdrop colour
     so the car has no light halo on dark scenes;
  2. shadow: inside the backdrop, pixels darker than the backdrop under the car become a separate black layer
     whose alpha is the measured darkening;
  3. wheels: the two tyres are cut as circular layers at the measured centres (source-geometry.json), radius
     92.1 px; their hole in the body layer is filled with the arch's dark colour;
  4. paint mask: body pixels whose hue is the car's blue (and saturated) form an alpha mask used to repaint the
     car at run time with CSS blending; glass, tyres, rims, lamps and black trim are excluded by hue/saturation.
Writes WebP/PNG layers, anchors.json (native and 1600×700 production coordinates) and a QA report with the
recomposition difference against the original.
"""
import hashlib, json, sys, os
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
raw = open(src, 'rb').read()
img = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
H, W, _ = img.shape

# 1 — backdrop colour and flood fill from the border
border = np.concatenate([img[:8].reshape(-1, 3), img[-8:].reshape(-1, 3), img[:, :8].reshape(-1, 3), img[:, -8:].reshape(-1, 3)])
bg = np.median(border, axis=0)
dist = np.sqrt(((img - bg) ** 2).sum(-1))
T_IN, T_OUT = 16.0, 46.0                    # below T_IN: backdrop; above T_OUT: car; between: soft edge
cand = dist < T_OUT
seen = np.zeros((H, W), bool)
stack = [(y, x) for x in range(W) for y in (0, H - 1)] + [(y, x) for y in range(H) for x in (0, W - 1)]
while stack:
    y, x = stack.pop()
    if y < 0 or y >= H or x < 0 or x >= W or seen[y, x] or not cand[y, x]:
        continue
    seen[y, x] = True
    stack += [(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)]
backdrop = seen                              # connected to the border and close to the backdrop colour
alpha = np.where(backdrop, np.clip((dist - T_IN) / (T_OUT - T_IN), 0, 1), 1.0)

# the shadow under the car is darker, unsaturated ground, not car: below the sills and outside the tyres it is
# measured into its own layer (alpha = how much darker than the backdrop) and removed from the car alpha
lum = img.mean(-1)
bgL = bg.mean()
mx0, mn0 = img.max(-1), img.min(-1)
sat0 = np.where(mx0 > 0, (mx0 - mn0) / np.maximum(mx0, 1), 0)
yy0, xx0 = np.mgrid[0:H, 0:W]
outside_tyres = np.ones((H, W), bool)
for cx, cy in ((321.5, 478.5), (1052.5, 477.5)):
    outside_tyres &= np.sqrt((xx0 - cx) ** 2 + (yy0 - cy) ** 2) > 93.5
car_rows = np.where((~backdrop).any(1))[0]
bottom = car_rows.max()
ground = (yy0 > 532) & outside_tyres & (sat0 < 0.14)
# the thin light gap between the sills and their shadow is backdrop too, even where it is enclosed
gap = (yy0 > 500) & outside_tyres & (dist < T_OUT)
alpha = np.where(gap, np.clip((dist - T_IN) / (T_OUT - T_IN), 0, 1), alpha)
shadow_a = np.where(ground | (backdrop & (yy0 > 380)), np.clip((bgL - lum) / bgL, 0, 0.97), 0)
alpha = np.where(ground, 0, alpha)
# un-mix soft edge pixels from the backdrop colour (c = a*fg + (1-a)*bg)
a3 = np.clip(alpha, 1e-3, 1)[..., None]
fg = np.clip((img - (1 - a3) * bg) / a3, 0, 255)
rgb = np.where(alpha[..., None] < 1, fg, img)

# 3 — wheels at the measured centres
geo = {'front': (321.5, 478.5), 'rear': (1052.5, 477.5)}
R = 92.1
yy, xx = np.mgrid[0:H, 0:W]
wheel_layers = {}
body_rgb, body_a = rgb.copy(), alpha.copy()
for k, (cx, cy) in geo.items():
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    wa = np.clip(R + 0.5 - d, 0, 1) * alpha                              # anti-aliased disc
    x0, y0, x1, y1 = int(cx - R - 2), int(cy - R - 2), int(cx + R + 3), int(cy + R + 3)
    layer = np.dstack([rgb, wa * 255])[y0:y1, x0:x1].astype(np.uint8)
    wheel_layers[k] = {'box': [x0, y0, x1 - x0, y1 - y0], 'center': [cx - x0, cy - y0], 'radius': R}
    Image.fromarray(layer, 'RGBA').save(f'{out}/wheel-{k}.webp', lossless=True)
    # fill the hole with the arch's dark colour so a turning or swapped wheel never shows the backdrop
    inner = d <= R + 1
    body_rgb[inner] = (20, 22, 26)
    body_a[inner] = np.maximum(body_a[inner], np.clip(R + 1.5 - d[inner], 0, 1))

# 4 — paint mask: the blue body paint
r, g, b = img[..., 0], img[..., 1], img[..., 2]
mx, mn = img.max(-1), img.min(-1)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
hue_blue = (b > r + 12) & (b > g + 4)
paint = (hue_blue & (sat > 0.27) & (mx > 26) & (alpha > 0.5)).astype(np.float32)   # glass is s≈0.15, paint s≈0.5–0.86 (highlights ≈0.3–0.5)
for k, (cx, cy) in geo.items():                                           # never inside the wheels
    paint[np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) <= R + 1] = 0
# soften by one pixel (3×3 mean) so the repaint has no jagged border
pad = np.pad(paint, 1, mode='edge')
paint = sum(pad[dy:dy + H, dx:dx + W] for dy in range(3) for dx in range(3)) / 9

Image.fromarray(np.dstack([body_rgb, body_a * 255]).astype(np.uint8), 'RGBA').save(f'{out}/body.webp', quality=92, alpha_quality=100, method=6)
Image.fromarray(np.dstack([np.zeros((H, W, 3)), shadow_a * 255]).astype(np.uint8), 'RGBA').save(f'{out}/shadow.webp', quality=85, method=6)
Image.fromarray(np.dstack([np.full((H, W, 3), 255), paint * 255]).astype(np.uint8), 'RGBA').save(f'{out}/paint-mask.png', optimize=True)

# QA — recompose on the backdrop colour and compare with the original
comp = np.zeros_like(img) + bg
comp = comp * (1 - shadow_a[..., None]) + 0 * shadow_a[..., None]
ba = body_a[..., None]
comp = comp * (1 - ba) + body_rgb * ba
for k, (cx, cy) in geo.items():
    x0, y0, w, h = wheel_layers[k]['box']
    wl = np.asarray(Image.open(f'{out}/wheel-{k}.webp')).astype(np.float32)
    wa = wl[..., 3:] / 255
    comp[y0:y0 + h, x0:x0 + w] = comp[y0:y0 + h, x0:x0 + w] * (1 - wa) + wl[..., :3] * wa
diff = np.abs(comp - img).mean(-1)
transparent = int((body_a < 0.01).sum())
qa = {
    'source': os.path.basename(src), 'sourceSha256': hashlib.sha256(raw).hexdigest(), 'size': [W, H],
    'backdropColour': [round(float(v), 1) for v in bg], 'transparentPixels': transparent, 'partialAlphaPixels': int(((body_a > 0.01) & (body_a < 0.99)).sum()),
    'paintMaskPixels': int((paint > 0.5).sum()),
    'recomposition': {'meanAbsDiff': round(float(diff.mean()), 3), 'p99AbsDiff': round(float(np.percentile(diff, 99)), 2), 'pixelsOver16': int((diff > 16).sum())},
    'note': 'Layers derived from the original by thresholding, flood fill and circular cuts; no pixels were generated. The wheel layers are the original wheels: there are still no approved alternative wheels.',
}
anchors = {
    'bodyFamilyId': 'gt01-fastback', 'anchorVersion': 'gt01-native-1', 'units': 'px of the 1376×768 original',
    'groundLine': float(bottom), 'wheels': {k: {'cx': v[0], 'cy': v[1], 'r': R} for k, v in geo.items()},
    'wheelLayers': wheel_layers, 'facing': 'left',
    'productionTransform': {'scale': 7 / 6, 'offsetX': -8 / 3, 'offsetY': -75.7, 'target': [1600, 700], 'status': 'candidate, not exported'},
    'status': 'base derivada para prototipo; anclajes de raster ±3 px, no aprobados como finales',
}
json.dump(anchors, open(f'{out}/anchors.json', 'w'), indent=1)
json.dump(qa, open(f'{out}/qa.json', 'w'), indent=1)
print(json.dumps(qa, indent=1))
