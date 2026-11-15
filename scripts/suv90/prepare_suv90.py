#!/usr/bin/env python3
"""SUV 1990 (suv90-green) game layers from the untouched art-branch files, by local image processing only.

    python3 scripts/suv90/prepare_suv90.py <production-assets/suv-1990-v1 dir> public/flow/suv90 [qa dir]

Inputs (branch art/suv90-master-20261115-01a1dd27, never modified):
  sources/proposal-01.jpg                       master geometry, 2752×1536, opaque white background
  generated/steel-v2-original.png, alloy-v2-original.png      wheel sprites (ChatGPT image tool), real alpha
  generated/light-a-v2-original.png, light-b-v2-original.png  headlamp detail sprites
  generated/bumper-a-v1-original.png, bumper-b-v1-original.png bumper-face trials (evaluated, see QA)
  qa/sprite-mounts.json, qa/insert-mounts.json  mounting contracts measured on the art branch

Canvas: the source rows 220…1400 at half scale → 1376×590 ("canvas px"): canvas = (source − (0, 220)) × 0.5.
One uniform transform for every layer; nothing is stretched or re-framed per part.

Steps:
  1. body alpha: the white backdrop is the set of near-white pixels connected to the image border (connected
     components, colour distance to white); soft edges are un-mixed from white (c = a·fg + (1−a)·white) so the
     body has no light halo on dark scenes; light parts enclosed by the outline (glass, lamps, rims) stay opaque;
  2. shadow: below the sills (y ≥ 1265) and outside the tyres, unsaturated darkening of the ground is moved into a
     separate black layer whose alpha is the measured darkening; the body alpha there is 0;
  3. paint mask: the green paint is selected by hue on the source (g − r > 8 and g − b > 7, max > 20): black flares,
     trim, bumpers, glass (g − b ≈ 0), tyres, rims, lamps, indicators and the backdrop are excluded; specks under
     60 px are dropped and the mask is softened by 1 px;
  4. wheels: each sprite is resampled once with its uniform scale so that its measured pivot lands on the hub
     (566, 1115) / (2094, 1115) source px; both axles use the same image;
  5. headlamp inserts: sprite at its uniform scale and origin, clipped by the lamp-opening polygon (anti-aliased,
     4× supersampled), cropped to the polygon's box: only the lens interior changes;
  6. QA: recomposition against the original, composites on white/black/blue/grey, halo measurement, per-variant
     changed pixels outside the allowed region, bumper-face trial seams.
"""
import hashlib, json, os, sys
import numpy as np
import cv2
from PIL import Image, ImageDraw

art, out = sys.argv[1], sys.argv[2]
qa_dir = sys.argv[3] if len(sys.argv) > 3 else None
os.makedirs(os.path.join(out, 'parts'), exist_ok=True)
if qa_dir: os.makedirs(qa_dir, exist_ok=True)
P = lambda *a: os.path.join(art, *a)
sha = lambda f: hashlib.sha256(open(f, 'rb').read()).hexdigest()

Y0, SCALE = 220, 0.5                     # canvas = (source − (0, Y0)) × SCALE
SRC_ROWS = (Y0, 1400)
CW, CH = int(2752 * SCALE), int((SRC_ROWS[1] - SRC_ROWS[0]) * SCALE)
HUBS = {'front': (566.0, 1115.0), 'rear': (2094.0, 1115.0)}
TYRE_R = 222.0                           # measured: dark tyre from x 345…787 at y 1115 (front), contact at y 1336
to_canvas = lambda x, y: ((x) * SCALE, (y - Y0) * SCALE)

img_full = np.asarray(Image.open(P('sources', 'proposal-01.jpg')).convert('RGB')).astype(np.float32)
img = img_full[SRC_ROWS[0]:SRC_ROWS[1]]
H, W, _ = img.shape
yy, xx = np.mgrid[0:H, 0:W]
ys = yy + Y0                              # source row of each pixel

# 1 — backdrop: near-white, connected to the border
WHITE = np.array([255, 255, 255], np.float32)
dist = np.sqrt(((img - WHITE) ** 2).sum(-1))
T_IN, T_OUT = 9.0, 42.0
cand = (dist < T_OUT).astype(np.uint8)
n, lab = cv2.connectedComponents(cand, connectivity=4)
edge_labels = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
# the white seen under the chassis, between the tyres, is enclosed by the chassis, the tyres and the darker shadow
# band, so it is not connected to the border: near-white regions whose centre lies below the body (source y > 1140)
# are backdrop too. Enclosed light regions higher up (lens highlights, rim faces) stay car.
ys_lab = cv2.connectedComponentsWithStats(cand, connectivity=4)
_, _, st0, cen0 = ys_lab
under = {i for i in range(1, n) if cen0[i][1] + Y0 > 1140 and st0[i, cv2.CC_STAT_AREA] > 200}
# small enclosed holes of near-pure white (mean distance to white < 10) are the backdrop seen through the drawing:
# the tow-hook eyes, the gap behind the wiper arm and between the front arch and the mud flap. Light enclosed parts
# of the car (lens and tail-lamp highlights) measure 22–31 and stay car.
holes = {i for i in range(1, n) if i not in edge_labels and st0[i, cv2.CC_STAT_AREA] >= 20 and dist[lab == i].mean() < 10}
backdrop = np.isin(lab, list(edge_labels | under | holes)) & cand.astype(bool)
alpha = np.where(backdrop, np.clip((dist - T_IN) / (T_OUT - T_IN), 0, 1), 1.0)
# Edge band (2 px inside the backdrop boundary): the drawing's ink outline was anti-aliased against white, so these
# pixels are a mix of the outline and white even above T_OUT. With the darkest colour of the 5×5 neighbourhood as the
# foreground F, c = a·F + (1 − a)·white gives a; the pixel keeps the smaller of the two alphas.
bd = backdrop.astype(np.uint8)
band = cv2.dilate(bd, np.ones((5, 5), np.uint8)).astype(bool) & ~backdrop
lum0 = img.mean(-1)
k5 = np.ones((5, 5), np.uint8)
Lf = cv2.erode(np.where(backdrop, 255, lum0).astype(np.float32), k5)
alpha_ink = np.clip((255 - lum0) / np.maximum(255 - Lf, 1), 0, 1)
alpha = np.where(band & (lum0 > Lf + 12), np.minimum(alpha, alpha_ink), alpha)

# 2 — shadow on the ground
mx, mn = img.max(-1), img.min(-1)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
lum = img.mean(-1)
outside_tyres = np.ones((H, W), bool)
for cx, cy in HUBS.values():
    outside_tyres &= np.sqrt((xx - cx) ** 2 + (ys - cy) ** 2) > TYRE_R + 1.5
ground = (ys >= 1265) & outside_tyres & (sat < 0.12)
shadow_a = np.where(ground | (backdrop & (ys >= 1150)), np.clip((255 - lum) / 255, 0, 0.97), 0)
for _ in range(2):                         # JPEG grain off the soft shadow, without moving its edge
    pad = np.pad(shadow_a, 1, mode='edge'); shadow_a = sum(pad[dy:dy + H, dx:dx + W] for dy in range(3) for dx in range(3)) / 9
alpha = np.where(ground, 0, alpha)
# un-mix soft edges from white
a3 = np.clip(alpha, 1e-3, 1)[..., None]
fg = np.clip((img - (1 - a3) * WHITE) / a3, 0, 255)
rgb = np.where(alpha[..., None] < 1, fg, img)

# 3 — paint mask (on the source)
r, g, b = img[..., 0], img[..., 1], img[..., 2]
paint = ((g - r > 8) & (g - b > 7) & (mx > 20) & (alpha > 0.5)).astype(np.uint8)
for cx, cy in HUBS.values():                                  # never inside the wheels
    paint[np.sqrt((xx - cx) ** 2 + (ys - cy) ** 2) <= TYRE_R + 1] = 0
# the lower edge of the rear quarter (above the black bumper) fades to near-black paint around the hue threshold and
# gave a ragged, speckled edge that a light repaint shows as dark specks: below the side strip (source y > 880) a
# 5×5 median settles each pixel to its neighbourhood (the shut lines above are left untouched)
med = cv2.medianBlur(paint * 255, 5) > 127
low_band = ys > 880
paint = np.where(low_band, med, paint.astype(bool)).astype(np.uint8)
# that edge is still ragged because the paint darkens to near black there (occlusion over the bumper). In its box
# (source x 2330–2620, y 880–1000) the lower boundary of the paint is taken per column (end of the run that starts
# at the top of the box, gaps up to 3 px bridged), smoothed with a 21-column median, and the mask is set to the
# smoothed boundary: one clean edge following the drawing, no specks.
bx0, bx1, by0, by1 = 2330, 2620, 880 - Y0, 1000 - Y0
bnd = np.full(bx1 - bx0, -1, np.int32)
for i, x in enumerate(range(bx0, bx1)):
    col = paint[by0:by1, x].astype(bool)
    if not col[:4].any(): continue
    last, gap = 0, 0
    for yv in range(len(col)):
        if col[yv]: last, gap = yv, 0
        else:
            gap += 1
            if gap > 3: break
    bnd[i] = last
valid = bnd >= 0
if valid.any():
    sm = bnd.copy()
    for i in np.where(valid)[0]:
        w = bnd[max(0, i - 10):i + 11]; w = w[w >= 0]; sm[i] = int(np.median(w))
    for i, x in enumerate(range(bx0, bx1)):
        if valid[i]:
            seg = slice(by0, by0 + sm[i] + 1)   # holes above the edge: only pixels still tinted green (dark paint), never black trim
            greenish = (g[seg, x] - r[seg, x] > 2) & (g[seg, x] - b[seg, x] > 1) & (alpha[seg, x] > 0.5)
            paint[seg, x] = np.maximum(paint[seg, x], greenish.astype(np.uint8))
            paint[by0 + sm[i] + 1:by1, x] = 0
nc, lab2, st, _ = cv2.connectedComponentsWithStats(paint, 8)
keep = np.zeros(nc, bool); keep[1:] = st[1:, cv2.CC_STAT_AREA] >= 60
paint = keep[lab2].astype(np.float32)
paint = cv2.blur(paint, (3, 3))

def down(rgb_, a_):
    """Premultiplied area resampling to the canvas, then un-premultiply."""
    pm = cv2.resize(rgb_ * a_[..., None], (CW, CH), interpolation=cv2.INTER_AREA)
    a = cv2.resize(a_, (CW, CH), interpolation=cv2.INTER_AREA)
    c = np.where(a[..., None] > 1e-3, pm / np.maximum(a[..., None], 1e-3), 0)
    return np.clip(c, 0, 255), np.clip(a, 0, 1)

body_c, body_ac = down(rgb, alpha)
shadow_c = cv2.resize(shadow_a, (CW, CH), interpolation=cv2.INTER_AREA)
paint_c = cv2.resize(paint, (CW, CH), interpolation=cv2.INTER_AREA)
Image.fromarray(np.dstack([body_c, body_ac * 255]).round().astype(np.uint8), 'RGBA').save(f'{out}/body.webp', quality=92, alpha_quality=100, method=6)
Image.fromarray(np.dstack([np.zeros((CH, CW, 3)), shadow_c * 255]).round().astype(np.uint8), 'RGBA').save(f'{out}/shadow.webp', quality=85, method=6)
Image.fromarray(np.dstack([np.full((CH, CW, 3), 255), paint_c * 255]).round().astype(np.uint8), 'RGBA').save(f'{out}/paint-mask.png', optimize=True)

# 4 — wheels
mounts = json.load(open(P('qa', 'sprite-mounts.json')))['designs']
layers, qa = {}, {}
def shrink_warp(pm, s, tx, ty, bw, bh):
    """Uniform scale s and translation (tx, ty) of a premultiplied image into a bw×bh box. warpAffine has no area
    filter, so a strong reduction is first done with INTER_AREA to about 2× the final size (same uniform factor on
    both axes), and the remaining factor with bilinear warping."""
    h, w = pm.shape[:2]
    if s < 0.5:
        k = min(1.0, s * 2)
        pw, ph = max(1, round(w * k)), max(1, round(h * k))
        pm = cv2.resize(pm, (pw, ph), interpolation=cv2.INTER_AREA)
        sx, sy = s * w / pw, s * h / ph          # equal up to rounding of the intermediate size (< 0.1 %)
    else:
        sx = sy = s
    M = np.array([[sx, 0, tx], [0, sy, ty]], np.float32)
    return cv2.warpAffine(pm, M, (bw, bh), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
def place_sprite(sprite, s_src, pivot, hub):
    """Resample a sprite once, uniform scale s_src (sprite px → source px) × SCALE, pivot onto the hub. Returns the
    canvas-resolution RGBA crop and its integer box."""
    s = s_src * SCALE
    hx, hy = to_canvas(*hub)
    x0f, y0f = hx - pivot[0] * s, hy - pivot[1] * s
    w, h = sprite.size
    bx0, by0 = int(np.floor(x0f)), int(np.floor(y0f))
    bw, bh = int(np.ceil(x0f + w * s)) - bx0 + 1, int(np.ceil(y0f + h * s)) - by0 + 1
    # premultiplied resample: output pixel (u, v) samples sprite at ((u + bx0 − x0f)/s, (v + by0 − y0f)/s)
    arr = np.asarray(sprite.convert('RGBA')).astype(np.float32)
    pm = np.dstack([arr[..., :3] * arr[..., 3:] / 255, arr[..., 3]])
    res = shrink_warp(pm, s, x0f - bx0, y0f - by0, bw, bh)
    a = np.clip(res[..., 3], 0, 255)
    c = np.where(a[..., None] > 0.5, res[..., :3] * 255 / np.maximum(a[..., None], 1e-3), 0)
    return np.dstack([np.clip(c, 0, 255), a]), [bx0, by0, bw, bh]

for key in ('steel', 'alloy'):
    d = mounts[key]
    sprite = Image.open(P(d['original']))
    first = None
    for axle, hub in HUBS.items():
        lay, box = place_sprite(sprite, d['uniform_scale_to_source'], d['native_pivot'], hub)
        name = f'wheel-{key}-{axle}'
        lay8 = lay.round().astype(np.uint8)
        # the hubs are a whole number of canvas px apart, so both axles resample identically: one file, mounted twice
        if first is None or not np.array_equal(first, lay8):
            fname = f'parts/wheel-{key}.webp' if first is None else f'parts/{name}.webp'
            Image.fromarray(lay8, 'RGBA').save(f'{out}/{fname}', quality=90, alpha_quality=100, method=6)
            first = lay8 if first is None else first
        hx, hy = to_canvas(*hub)
        layers[name] = {'file': fname, 'box': box, 'hubCanvas': [hx, hy], 'source': d['original'], 'sourceSha256': sha(P(d['original'])),
                        'uniformScaleToSource': d['uniform_scale_to_source'], 'pivot': d['native_pivot'], 'externalAspectRatio': d['external_aspect_ratio']}

# 5 — headlamp inserts (and the bumper-face trials, for QA only)
inserts = json.load(open(P('qa', 'insert-mounts.json')))
SS = 4
def place_insert(key):
    d = inserts[key]
    poly = np.array(d['clip_polygon_source_pixels'], np.float32)
    sprite = Image.open(P(d['source'])).convert('RGBA')
    s = d['uniform_scale']
    ox, oy = d['image_origin']
    x0, y0 = np.floor(poly.min(0)).astype(int) - 2
    x1, y1 = np.ceil(poly.max(0)).astype(int) + 2
    bw, bh = x1 - x0, y1 - y0
    # sprite rendered in source px over the polygon box
    arr = np.asarray(sprite).astype(np.float32)
    pm = np.dstack([arr[..., :3] * arr[..., 3:] / 255, arr[..., 3]])
    src_box = shrink_warp(pm, s, ox - x0, oy - y0, bw, bh)
    # anti-aliased polygon mask (supersampled)
    big = Image.new('L', (bw * SS, bh * SS), 0)
    ImageDraw.Draw(big).polygon([((px - x0) * SS, (py - y0) * SS) for px, py in poly], fill=255)
    clip = np.asarray(big.resize((bw, bh), Image.LANCZOS)).astype(np.float32) / 255
    src_box *= clip[..., None]
    return src_box, (x0, y0, bw, bh), poly

def composite_source(base, layer_pm, box):
    """Composite a premultiplied RGBA layer (source px) over an RGB source image."""
    x0, y0, bw, bh = box
    out_ = base.copy()
    a = layer_pm[..., 3:] / 255
    out_[y0:y0 + bh, x0:x0 + bw] = layer_pm[..., :3] + out_[y0:y0 + bh, x0:x0 + bw] * (1 - a)
    return out_

for key in ('headlamp-a', 'headlamp-b'):
    lay_src, box, poly = place_insert(key)
    x0, y0, bw, bh = box
    # to canvas: one area resample of the premultiplied layer
    cx0, cy0 = x0 * SCALE, (y0 - Y0) * SCALE
    bx0, by0 = int(np.floor(cx0)), int(np.floor(cy0))
    cw_, ch_ = int(np.ceil(cx0 + bw * SCALE)) - bx0 + 1, int(np.ceil(cy0 + bh * SCALE)) - by0 + 1
    res = shrink_warp(lay_src, SCALE, cx0 - bx0, cy0 - by0, cw_, ch_)
    a = res[..., 3]
    c = np.where(a[..., None] > 0.5, res[..., :3] * 255 / np.maximum(a[..., None], 1e-3), 0)
    Image.fromarray(np.dstack([np.clip(c, 0, 255), a]).round().astype(np.uint8), 'RGBA').save(f'{out}/parts/{key}.webp', quality=92, alpha_quality=100, method=6)
    d = inserts[key]
    layers[key] = {'file': f'parts/{key}.webp', 'box': [bx0, by0, cw_, ch_], 'allowedCanvas': [bx0, by0, cw_, ch_], 'source': d['source'], 'sourceSha256': sha(P(d['source'])),
                   'uniformScale': d['uniform_scale'], 'clipPolygonSource': d['clip_polygon_source_pixels']}

# 6 — QA
def canvas_compose(bg_rgb, parts=()):
    c = np.zeros((CH, CW, 3), np.float32) + np.array(bg_rgb, np.float32)
    c = c * (1 - shadow_c[..., None])
    c = c * (1 - body_ac[..., None]) + body_c * body_ac[..., None]
    for name in parts:
        L = layers[name]; x, y, w, h = L['box']
        im = np.asarray(Image.open(f"{out}/{L['file']}")).astype(np.float32)
        a = im[..., 3:] / 255
        region = c[y:y + h, x:x + w]
        c[y:y + h, x:x + w] = region * (1 - a) + im[..., :3] * a
    return c

orig_c = cv2.resize(img, (CW, CH), interpolation=cv2.INTER_AREA)
recomp = canvas_compose((255, 255, 255))
diff = np.abs(recomp - orig_c).max(-1)
qa['recomposition'] = {'meanAbsDiff': round(float(np.abs(recomp - orig_c).mean()), 3), 'p99': round(float(np.percentile(diff, 99)), 2), 'pixelsOver16': int((diff > 16).sum())}
# halo: on black, the ring just outside the opaque body should be dark (a white halo would be bright)
hard = (body_ac > 0.98).astype(np.uint8)
ring = cv2.dilate(hard, np.ones((5, 5), np.uint8)).astype(bool) & ~hard.astype(bool) & (body_ac > 0.02)
on_black = canvas_compose((0, 0, 0))
qa['halo'] = {'ringPixels': int(ring.sum()), 'ringMeanLumaOnBlack': round(float(on_black[ring].mean()), 2),
              'ringPixelsBrighterThan140OnBlack': int((on_black[ring].mean(-1) > 140).sum()),
              'note': 'luma of the semi-transparent edge ring composited on black; a white halo would read ≈200+'}
qa['alpha'] = {'opaque': int((body_ac > 0.98).sum()), 'transparent': int((body_ac < 0.02).sum()), 'soft': int(((body_ac >= 0.02) & (body_ac <= 0.98)).sum())}
# light enclosed parts must stay opaque: glass, headlamp lens, rim centres
probes = {'glass-front': (1300, 450), 'glass-rear': (2200, 450), 'headlamp': (250, 790), 'rim-front': (566, 1115), 'rim-rear': (2094, 1115), 'hood-highlight': (600, 640)}
qa['opaqueProbes'] = {k: round(float(body_ac[int((y - Y0) * SCALE), int(x * SCALE)]), 3) for k, (x, y) in probes.items()}
# paint mask: what it covers and what it must not
pm_bin = paint_c > 0.5
excl = {'glass': (1300, 450), 'flare-front': (700, 830), 'flare-rear': (2000, 800), 'side-strip': (1200, 870), 'bumper': (250, 960), 'rocker': (1400, 1090), 'mirror': (1070, 580),
        'handle': (1410, 710), 'tail-lamp': (2575, 800), 'indicator': (840, 750), 'headlamp': (250, 790), 'rim': (566, 1115), 'tyre': (566, 1300), 'backdrop': (1300, 1250)}
incl = {'door': (1200, 800), 'door-low': (1200, 1000), 'hood': (600, 640), 'roof': (1500, 310), 'rear-quarter': (2400, 800), 'fuel-door': (2310, 720)}
val = lambda x, y: round(float(paint_c[int((y - Y0) * SCALE), int(x * SCALE)]), 3)
qa['paintMask'] = {'coverage': int(pm_bin.sum()), 'mustBeExcluded': {k: val(*v) for k, v in excl.items()}, 'mustBeIncluded': {k: val(*v) for k, v in incl.items()},
                   'grayLevels': int(len(np.unique((paint_c * 255).round()))), 'note': 'binary selection softened by a 3×3 blur at source scale then area-resampled: only the edge is grey'}
# per-variant: pixels changed outside the allowed region (canvas compose vs base)
base = canvas_compose((255, 255, 255))
var = {}
for name in layers:
    comp = canvas_compose((255, 255, 255), [name])
    ch = np.abs(comp - base).max(-1) > 6
    x, y, w, h = layers[name]['box']
    allow = np.zeros_like(ch); allow[y:y + h, x:x + w] = True
    var[name] = {'changedPixels': int(ch.sum()), 'changedOutsideBox': int((ch & ~allow).sum())}
qa['variants'] = var
# wheel sprites: hub position after resampling (alpha-weighted centre of the rim disc) vs the declared hub
for key in ('steel', 'alloy'):
    for axle in HUBS:
        L = layers[f'wheel-{key}-{axle}']; im = np.asarray(Image.open(f"{out}/{L['file']}")).astype(np.float32)[..., 3]
        yy2, xx2 = np.mgrid[0:im.shape[0], 0:im.shape[1]]; m = im > 128
        L['measuredCentreCanvas'] = [round(float(xx2[m].mean() + L['box'][0]), 2), round(float(yy2[m].mean() + L['box'][1]), 2)]
        # the sprite itself is slightly off-round (aspect ≈0.98–0.99), so its alpha centroid is not exactly its pivot
        L['pivotToCentroidPx'] = round(float(np.hypot(L['measuredCentreCanvas'][0] - L['hubCanvas'][0], L['measuredCentreCanvas'][1] - L['hubCanvas'][1])), 2)

# bumper-face trials: rendered at source scale for review only (not exported as game layers)
bump = {}
for key in ('bumper-face-a', 'bumper-face-b'):
    lay_src, box, poly = place_insert(key)
    comp = composite_source(img_full, lay_src, box)
    x0, y0, bw, bh = box
    region = comp[y0:y0 + bh, x0:x0 + bw]; orig = img_full[y0:y0 + bh, x0:x0 + bw]
    # seam: gradient energy along the clip outline (inner band) compared with the original's
    big = Image.new('L', (bw, bh), 0); ImageDraw.Draw(big).polygon([(px - x0, py - y0) for px, py in poly], outline=255, width=3)
    edge = np.asarray(big) > 0
    gx = lambda a: np.abs(cv2.Sobel(a.mean(-1), cv2.CV_32F, 1, 0)) + np.abs(cv2.Sobel(a.mean(-1), cv2.CV_32F, 0, 1))
    bump[key] = {'edgeGradientTrial': round(float(gx(region)[edge].mean()), 1), 'edgeGradientOriginal': round(float(gx(orig)[edge].mean()), 1),
                 'meanChangeInside': round(float(np.abs(region - orig).mean()), 2)}
    if qa_dir:
        Image.fromarray(np.clip(np.concatenate([orig, region], 1), 0, 255).astype(np.uint8)).resize((bw * 4, bh * 2), Image.LANCZOS).save(f'{qa_dir}/{key}-trial.png')
qa['bumperFaceTrials'] = bump

if qa_dir:
    tiles = []
    for name, col in (('white', (255, 255, 255)), ('black', (0, 0, 0)), ('blue', (28, 64, 140)), ('grey', (128, 128, 128))):
        tiles.append(canvas_compose(col).astype(np.uint8))
    sheet = np.concatenate([np.concatenate(tiles[:2], 1), np.concatenate(tiles[2:], 1)], 0)
    Image.fromarray(sheet).save(f'{qa_dir}/backgrounds.png')
    Image.fromarray(np.concatenate([orig_c, recomp, np.clip(np.abs(recomp - orig_c) * 8, 0, 255)], 0).astype(np.uint8)).save(f'{qa_dir}/recomposition.png')
    Image.fromarray((paint_c * 255).astype(np.uint8)).save(f'{qa_dir}/paint-mask-view.png')

manifest = {
    'familyId': 'suv90-green', 'canvas': [CW, CH], 'anchorVersion': 'suv90-canvas-1',
    'sourceTransform': {'note': 'canvas = (source − offset) × scale', 'offset': [0, Y0], 'scale': SCALE, 'sourceSize': [2752, 1536]},
    'source': 'production-assets/suv-1990-v1/sources/proposal-01.jpg', 'sourceSha256': sha(P('sources', 'proposal-01.jpg')),
    'artBranch': 'art/suv90-master-20261115-01a1dd27',
    'hubsCanvas': {k: list(to_canvas(*v)) for k, v in HUBS.items()}, 'tyreRadiusCanvas': TYRE_R * SCALE,
    'layers': layers, 'qa': qa,
}
json.dump(manifest, open(f'{out}/manifest.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps(qa, indent=1, ensure_ascii=False))
