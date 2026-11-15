#!/usr/bin/env python3
"""GT-01 part variants, produced by editing and technical drawing on the approved geometry of the GT-01 original.

    python3 scripts/flow/make_gt01_parts.py <user-gt-blue-original.jpg> public/flow/gt01

Nothing here comes from a generative model and nothing is claimed to be a Flow deliverable. Every variant is drawn
in the original's native pixels (1376×768, facing left) and saved as a layer cropped to its box, so it is mounted at
exactly the coordinates it was drawn at:

  wheels      'multispoke': the original tyre is kept pixel for pixel (r ≥ 77.5 px from the measured centre);
              only the rim inside it is redrawn — barrel, drilled disc, red calliper, 10 twin spokes, lip, cap;
  headlamps   'matrix': inside the original lamp opening (segmented from the original), a smoked housing with six
              matrix LED cells and a lower light blade replaces the slim lamp graphics;
  handles     'flush': both door handles are removed by local inpainting of the paint around them, then a flush
              handle (slot outline + catch) is drawn on the same footprint;
  bumper      'sport': the front bumper keeps its paint; the side intake and lower grille get honeycomb mesh with
              gloss-black surrounds and a carbon splitter follows the bumper's lower edge;
  roof        'panoramic': the roof panel between the roof line and the window frames becomes tinted glass with a
              reflection, never above the original roof line and never over the pillars.

For every layer the script writes the RGBA crop, a paint mask (pixels that are body paint, for the run-time repaint)
and its box; parts.json records boxes, allowed regions and the QA of a real composition against the base:
changed pixels outside the allowed region must be zero, the wheel centres and tyres must be unchanged.
"""
import json, os, sys, hashlib
import numpy as np
import cv2
from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
pdir = os.path.join(out, 'parts'); os.makedirs(pdir, exist_ok=True)
orig = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
body = np.asarray(Image.open(os.path.join(out, 'body.webp')).convert('RGBA')).astype(np.float32)
anchors = json.load(open(os.path.join(out, 'anchors.json')))
H, W = orig.shape[:2]
SS = 4  # supersampling for drawn parts

def paintness(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    return ((b > r + 12) & (b > g + 4) & (sat > 0.27) & (mx > 26)).astype(np.float32)

def save_layer(name, rgba, box, allowed, paint=True, note=''):
    """rgba: full-canvas float RGBA (alpha 0..1). Saves the crop of `box` and its paint mask."""
    x, y, w, h = box
    crop = rgba[y:y + h, x:x + w]
    img = np.dstack([np.clip(crop[..., :3], 0, 255), np.clip(crop[..., 3] * 255, 0, 255)]).astype(np.uint8)
    Image.fromarray(img, 'RGBA').save(os.path.join(pdir, f'{name}.webp'), lossless=True)
    rec = {'file': f'parts/{name}.webp', 'box': box, 'allowed': allowed, 'note': note}
    if paint:
        pm = paintness(crop[..., :3]) * (crop[..., 3] > 0.5)
        pad = np.pad(pm, 1, mode='edge'); pm = sum(pad[dy:dy + h, dx:dx + w] for dy in range(3) for dx in range(3)) / 9
        Image.fromarray(np.dstack([np.full((h, w, 3), 255), pm * 255]).astype(np.uint8), 'RGBA').save(os.path.join(pdir, f'{name}-paint.png'), optimize=True)
        rec['paintMask'] = f'parts/{name}-paint.png'
    return rec

def draw_ss(size, fn):
    """Draw at SS× resolution with PIL and return a float RGBA array at 1×."""
    w, h = size
    im = Image.new('RGBA', (w * SS, h * SS), (0, 0, 0, 0))
    fn(ImageDraw.Draw(im), SS)
    im = im.resize((w, h), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    return np.dstack([a[..., :3], a[..., 3] / 255])

def over(dst, src):
    """Alpha-composite float RGBA src over dst (same shape)."""
    a = src[..., 3:4]
    out = dst.copy()
    out[..., :3] = src[..., :3] * a + dst[..., :3] * (1 - a)
    out[..., 3:4] = a + dst[..., 3:4] * (1 - a)
    return out

parts = {'canvas': [W, H], 'anchorVersion': anchors['anchorVersion'], 'source': hashlib.sha256(open(src, 'rb').read()).hexdigest(), 'layers': {}}

# ------------------------------------------------------------------------------------------------ wheels
RIM = 77.5
for k in ('front', 'rear'):
    wl = anchors['wheelLayers'][k]
    x0, y0, w, h = wl['box']; ccx, ccy = wl['center']
    base = np.asarray(Image.open(os.path.join(out, f'wheel-{k}.webp')).convert('RGBA')).astype(np.float32)
    base = np.dstack([base[..., :3], base[..., 3] / 255])
    def rim(d, s, ccx=ccx, ccy=ccy):
        C = (ccx * s, ccy * s)
        def circ(r, fill, outline=None, width=0):
            d.ellipse([C[0] - r * s, C[1] - r * s, C[0] + r * s, C[1] + r * s], fill=fill, outline=outline, width=int(width * s))
        circ(RIM, (22, 24, 28, 255))                                   # barrel
        circ(60, (58, 61, 66, 255))                                    # brake disc
        for i in range(36):                                            # drilled holes
            a = i / 36 * 2 * np.pi; rr = 47 + (i % 3) * 4
            px, py = C[0] + np.cos(a) * rr * s, C[1] + np.sin(a) * rr * s
            d.ellipse([px - 1.2 * s, py - 1.2 * s, px + 1.2 * s, py + 1.2 * s], fill=(28, 30, 33, 255))
        circ(30, (40, 42, 46, 255))
        # calliper at the top rear of the disc (the car faces left: rear is +x)
        cal = [(C[0] + np.cos(a) * r * s, C[1] + np.sin(a) * r * s) for a, r in
               [(-1.25, 66), (-0.95, 66), (-0.62, 66), (-0.4, 64), (-0.4, 44), (-0.62, 44), (-0.95, 44), (-1.25, 44)]]
        d.polygon(cal, fill=(176, 34, 30, 255))
        d.line(cal[:4], fill=(226, 92, 80, 255), width=int(1.2 * s))
        # ten twin spokes, machined faces lit from the upper left
        for i in range(10):
            a0 = i / 10 * 2 * np.pi - np.pi / 2
            for off in (-0.075, 0.075):
                a = a0 + off
                tang = np.array([-np.sin(a), np.cos(a)])
                p_in = np.array([C[0] + np.cos(a) * 16 * s, C[1] + np.sin(a) * 16 * s])
                p_out = np.array([C[0] + np.cos(a) * (RIM - 3) * s, C[1] + np.sin(a) * (RIM - 3) * s])
                win, wout = 3.0 * s, 2.0 * s
                poly = [tuple(p_in + tang * win), tuple(p_out + tang * wout), tuple(p_out - tang * wout), tuple(p_in - tang * win)]
                lit = 0.55 + 0.45 * max(0, np.cos(a + 2.4))
                col = tuple(int(v) for v in (90 + 140 * lit, 96 + 140 * lit, 104 + 140 * lit)) + (255,)
                d.polygon(poly, fill=col)
                d.line([poly[0], poly[1]], fill=(236, 240, 244, 255), width=max(1, int(0.6 * s)))
        circ(RIM - 1.5, None, (214, 220, 226, 255), 2.6)               # rim lip
        circ(RIM - 4.5, None, (120, 126, 134, 255), 1.0)
        circ(14, (32, 36, 42, 255), (200, 206, 212, 255), 1.4)          # centre cap
        for i in range(5):
            a = i / 5 * 2 * np.pi - np.pi / 2
            px, py = C[0] + np.cos(a) * 9 * s, C[1] + np.sin(a) * 9 * s
            d.ellipse([px - 1.6 * s, py - 1.6 * s, px + 1.6 * s, py + 1.6 * s], fill=(150, 156, 164, 255))
    drawn = draw_ss((w, h), rim)
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.sqrt((xx + 0.5 - ccx - 0.5) ** 2 + (yy + 0.5 - ccy - 0.5) ** 2)
    keep = (r >= RIM)[..., None]                                       # the original tyre, pixel for pixel
    new = np.where(keep, base, drawn)
    new[..., 3] = np.where(r[...] >= RIM, base[..., 3], np.maximum(drawn[..., 3], 0))
    img = np.dstack([np.clip(new[..., :3], 0, 255), np.clip(new[..., 3] * 255, 0, 255)]).astype(np.uint8)
    Image.fromarray(img, 'RGBA').save(os.path.join(pdir, f'wheel-multispoke-{k}.webp'), lossless=True)
    parts['layers'][f'wheel-multispoke-{k}'] = {'file': f'parts/wheel-multispoke-{k}.webp', 'box': wl['box'], 'center': wl['center'], 'rimRadius': RIM,
                                                 'note': 'tyre kept from the original (r >= 77.5); rim redrawn'}

# ------------------------------------------------------------------------------------------------ helpers on the full canvas
base_rgba = np.dstack([body[..., :3], body[..., 3] / 255])
def region_mask(box):
    m = np.zeros((H, W), bool); x, y, w, h = box; m[y:y + h, x:x + w] = True; return m
L = orig.mean(-1)
paint0 = paintness(orig)

# ------------------------------------------------------------------------------------------------ headlamp
LAMP_BOX = [108, 360, 112, 50]
lb = region_mask(LAMP_BOX)
# the opening: non-paint, opaque pixels in the lamp box that are connected to the lamp's bright core
cand = (lb & (paint0 < 0.5) & (body[..., 3] > 128)).astype(np.uint8)
n, lab = cv2.connectedComponents(cand)
core = lab[383, 160] if lab[383, 160] else np.bincount(lab[lb & (L > 200)]).argmax()
opening = cv2.morphologyEx((lab == core).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
opening = cv2.dilate(opening, np.ones((2, 2), np.uint8)).astype(bool) & lb
ys, xs = np.where(opening)
def lamp(d, s):
    # smoked housing following the opening, then matrix cells along its upper edge and a light blade below
    pts = np.column_stack([xs, ys])
    hull = cv2.convexHull(pts.astype(np.int32)).reshape(-1, 2)
    d.polygon([(int(x * s), int(y * s)) for x, y in hull], fill=(26, 32, 40, 255))
    x0, x1 = xs.min(), xs.max()
    top = {x: ys[xs == x].min() for x in range(x0, x1 + 1) if (xs == x).any()}
    bot = {x: ys[xs == x].max() for x in range(x0, x1 + 1) if (xs == x).any()}
    span = x1 - x0
    for i in range(7):
        cxp = x0 + span * (0.2 + i * 0.105)
        t, b = top[int(cxp)], bot[int(cxp)]
        cyp = t + (b - t) * 0.42
        r = max(1.6, min(3.0, (b - t) * 0.11))
        d.ellipse([(cxp - r * 1.9) * s, (cyp - r * 1.9) * s, (cxp + r * 1.9) * s, (cyp + r * 1.9) * s], fill=(60, 78, 98, 140))
        d.rounded_rectangle([(cxp - r) * s, (cyp - r) * s, (cxp + r) * s, (cyp + r) * s], radius=0.6 * s, fill=(110, 130, 150, 255))
        d.ellipse([(cxp - r * 0.55) * s, (cyp - r * 0.55) * s, (cxp + r * 0.55) * s, (cyp + r * 0.55) * s], fill=(244, 252, 255, 255))
    blade = [((x) * s, (bot[x] - 2.4) * s) for x in range(x0 + 6, x1 - 3, 2)]
    d.line(blade, fill=(236, 248, 255, 255), width=int(1.4 * s))
    d.line([((x) * s, (top[x] + 1.2) * s) for x in range(x0 + 3, x1 - 2, 3)], fill=(120, 140, 160, 255), width=int(0.8 * s))
lamp_layer = draw_ss((W, H), lamp)
lamp_layer[..., 3] *= opening
parts['layers']['headlamp-matrix'] = save_layer('headlamp-matrix', lamp_layer, LAMP_BOX, LAMP_BOX, paint=False, note='new graphics inside the segmented original opening')

# ------------------------------------------------------------------------------------------------ handles (flush)
HANDLES = [[670, 343, 64, 22], [940, 337, 66, 22]]   # boxes around the two conventional handles
hm = np.zeros((H, W), np.uint8)
for x, y, w, h in HANDLES:                                             # the whole handle footprint, not a threshold
    cv2.ellipse(hm, (int(x + w / 2), int(y + h / 2)), (int(w / 2) - 2, int(h / 2) - 2), 0, 0, 360, 1, -1)
inside = np.zeros((H, W), np.uint8)
for x, y, w, h in HANDLES: inside[y:y + h, x:x + w] = 1
hm = hm & inside
filled = cv2.inpaint(np.clip(orig, 0, 255).astype(np.uint8)[..., ::-1], hm * 255, 6, cv2.INPAINT_TELEA)[..., ::-1].astype(np.float32)
hl = np.zeros((H, W, 4), np.float32)
hm_b = hm.astype(bool)
hl[..., :3] = filled; hl[..., 3] = hm_b
def flush(d, s):
    for x, y, w, h in HANDLES:
        cx_, cy_ = x + w / 2, y + h / 2 - 1
        L2 = w * 0.36
        d.rounded_rectangle([(cx_ - L2) * s, (cy_ - 2.2) * s, (cx_ + L2) * s, (cy_ + 2.2) * s], radius=2.2 * s, outline=(10, 18, 34, 255), width=int(1.1 * s))
        d.line([((cx_ - L2 + 3) * s, (cy_ - 3.6) * s), ((cx_ + L2 - 3) * s, (cy_ - 3.6) * s)], fill=(150, 190, 236, 200), width=int(0.8 * s))
        d.ellipse([(cx_ + L2 - 6) * s, (cy_ - 1.1) * s, (cx_ + L2 - 3.8) * s, (cy_ + 1.1) * s], fill=(16, 24, 40, 255))
fl = draw_ss((W, H), flush)
hl = over(hl, fl)
hbox = [min(b[0] for b in HANDLES) - 2, min(b[1] for b in HANDLES) - 2, max(b[0] + b[2] for b in HANDLES) - min(b[0] for b in HANDLES) + 4, max(b[1] + b[3] for b in HANDLES) - min(b[1] for b in HANDLES) + 4]
parts['layers']['handle-flush'] = save_layer('handle-flush', hl, hbox, [list(map(int, b)) for b in HANDLES], note='handles inpainted from the surrounding paint; flush slot drawn on the same footprint')

# ------------------------------------------------------------------------------------------------ front bumper (sport)
BUMPER_BOX = [84, 420, 160, 120]
bb = region_mask(BUMPER_BOX)
alpha_b = body[..., 3] / 255
lower = {}
for x in range(BUMPER_BOX[0], BUMPER_BOX[0] + BUMPER_BOX[2]):
    col = np.where(alpha_b[430:540, x] > 0.5)[0]
    if len(col): lower[x] = 430 + col.max()
# smooth the contour (median then mean over 9 px) and keep its nearly horizontal part only
xs_l = sorted(lower); vals = np.array([lower[x] for x in xs_l], float)
med = np.array([np.median(vals[max(0, i - 6):i + 7]) for i in range(len(vals))])
med = np.convolve(np.pad(med, 4, mode='edge'), np.ones(9) / 9, mode='valid')
lower = {x: float(v) for x, v in zip(xs_l, med) if 100 <= x <= 204}
# dark openings in the bumper (side intake, lower grille), from the original
dark = bb & (L < 70) & (paint0 < 0.5) & (alpha_b > 0.5)
dark[:, 200:] = False; dark[:425, :] = False
n_, lab_ = cv2.connectedComponents(dark.astype(np.uint8))
sizes = np.bincount(lab_.ravel())
dark = np.isin(lab_, [i for i in range(1, n_) if sizes[i] > 120])
dark = (cv2.GaussianBlur(dark.astype(np.float32), (0, 0), 1.2) > 0.5) & bb      # the original outline, without JPEG steps
bl = np.zeros((H, W, 4), np.float32)
bl[..., :3] = orig; bl[..., 3] = 0
def bumper(d, s):
    # honeycomb mesh over the openings (clipped later), then a carbon splitter along the lower edge
    d.rectangle([0, 0, W * s, H * s], fill=(12, 14, 18, 255))
    for yy in range(424, 514, 3):
        for xx in range(84, 202, 4):
            ox = xx + (2 if (yy // 3) % 2 else 0)
            hexp = [((ox + 1.5 * np.cos(a)) * s, (yy + 1.3 * np.sin(a)) * s) for a in np.linspace(0, 2 * np.pi, 7)[:-1]]
            d.polygon(hexp, outline=(104, 112, 124, 255))
mesh = draw_ss((W, H), bumper)
mesh[..., 3] *= dark
bl = over(bl, mesh)
def splitter(d, s):
    xs_ = sorted(lower)
    top = [((x - 1) * s, (lower[x] + 0.6) * s) for x in xs_]
    botl = [((x - 4 - 3 * (1 - (x - xs_[0]) / (xs_[-1] - xs_[0]))) * s, (lower[x] + 4.6) * s) for x in reversed(xs_)]
    d.polygon(top + botl, fill=(24, 26, 30, 255))
    d.line(top, fill=(110, 116, 126, 255), width=int(0.8 * s))
    for x in range(xs_[0], xs_[-1], 6):                               # carbon weave hint
        d.line([((x - 3) * s, (lower[x] + 2) * s), ((x - 1) * s, (lower[x] + 4) * s)], fill=(46, 50, 56, 255), width=int(0.7 * s))
spl = draw_ss((W, H), splitter)
bl = over(bl, spl)
# gloss-black surround: a thin dark edge around each opening
edge = cv2.dilate(dark.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & ~dark & bb & (alpha_b > 0.5)
bl[edge, :3] = bl[edge, :3] * 0.35; bl[edge, 3] = 1
parts['layers']['bumper-front-sport'] = save_layer('bumper-front-sport', bl, BUMPER_BOX, BUMPER_BOX, paint=False, note='mesh in the original openings, gloss surrounds, carbon splitter along the measured lower edge')

# ------------------------------------------------------------------------------------------------ panoramic roof
ROOF_X = (560, 1150)
rl = np.zeros((H, W, 4), np.float32)
glass = np.zeros((H, W), bool)
spans = {}
mx_o, mn_o = orig.max(-1), orig.min(-1)
sat_o = np.where(mx_o > 0, (mx_o - mn_o) / np.maximum(mx_o, 1), 0)
for x in range(*ROOF_X):
    col = np.where(alpha_b[180:330, x] > 0.5)[0]
    if not len(col): continue
    ytop = 180 + col.min()
    # the side glass: grey, unsaturated, mid-light pixels some rows under the roof line
    gl = np.where((L[ytop + 8:ytop + 50, x] > 85) & (L[ytop + 8:ytop + 50, x] < 200) & (sat_o[ytop + 8:ytop + 50, x] < 0.22))[0]
    if not len(gl): continue
    yglass = ytop + 8 + gl[0]
    if (L[yglass - 6:yglass, x] < 30).sum() < 1: continue        # no black window frame right above: not over a window
    g0, g1 = ytop + 3, yglass - 7
    if g1 - g0 < 6: continue
    spans[x] = (g0, g1)
# the roof line comes from the body alpha (reliable); the glass depth is the median measured panel depth, capped by
# the local depth where it was measured. It spans from the first to the last column over a side window.
xs_r = sorted(spans)
x_a, x_b = xs_r[0] + 10, xs_r[-1] - 14
depth = float(np.median([spans[x][1] - spans[x][0] for x in xs_r]))
roof_line = np.array([np.where(alpha_b[150:330, x] > 0.5)[0].min() + 150 if (alpha_b[150:330, x] > 0.5).any() else 0 for x in range(x_a, x_b)], float)
k = 9; roof_line = np.convolve(np.pad(roof_line, k // 2, mode='edge'), np.ones(k) / k, mode='valid')
local = np.array([spans[x][1] - spans[x][0] if x in spans else depth for x in range(x_a, x_b)], float)
local = np.convolve(np.pad(np.minimum(local, depth), 7, mode='edge'), np.ones(15) / 15, mode='valid')
for i, x in enumerate(range(x_a, x_b)):
    a = roof_line[i] + 3; b = a + local[i] * min(1.0, (x - x_a) / 18, (x_b - x) / 18)       # tapered ends
    if b - a < 1.5: continue
    for y in range(int(a), int(np.ceil(b)) + 1):
        t = (y - a) / max(1, b - a)
        cov = min(1.0, y + 1 - a, b + 1 - y)
        if cov <= 0: continue
        rl[y, x, :3] = (20 + 26 * t, 28 + 30 * t, 40 + 36 * t); rl[y, x, 3] = cov; glass[y, x] = cov > 0.5
# reflection streak and a frame line along the glass
def roofline(d, s):
    xs_ = [x for x in range(*ROOF_X) if glass[:, x].any()]
    if not xs_: return
    top = [(x * s, (np.where(glass[:, x])[0].min() + 0.5) * s) for x in xs_[::3]]
    d.line(top, fill=(12, 16, 22, 255), width=int(0.9 * s))
    mid = [(x * s, (np.where(glass[:, x])[0].min() + 3.2) * s) for x in xs_[len(xs_) // 6: len(xs_) * 3 // 5: 3]]
    d.line(mid, fill=(170, 200, 224, 200), width=int(1.6 * s))
    low = [(x * s, (np.where(glass[:, x])[0].max() - 0.5) * s) for x in xs_[::3]]
    d.line(low, fill=(8, 10, 14, 255), width=int(0.9 * s))
rf = draw_ss((W, H), roofline)
rf[..., 3] *= glass
rl = over(rl, rf)
ys_, xs_ = np.where(glass)
ROOF_BOX = [int(xs_.min()), int(ys_.min()), int(xs_.max() - xs_.min() + 1), int(ys_.max() - ys_.min() + 1)]
parts['layers']['roof-panoramic'] = save_layer('roof-panoramic', rl, ROOF_BOX, ROOF_BOX, paint=False, note='glass drawn inside the roof panel: under the original roof line, above the window frames')

# ------------------------------------------------------------------------------------------------ QA: real compositions against the base
def compose(layers):
    c = np.zeros((H, W, 3), np.float32) + 235
    for rgba, box in layers:
        x, y, w, h = box
        a = rgba[..., 3:4]
        c[y:y + h, x:x + w] = rgba[..., :3] * a + c[y:y + h, x:x + w] * (1 - a)
    return c
def load(path):
    a = np.asarray(Image.open(path).convert('RGBA')).astype(np.float32); return np.dstack([a[..., :3], a[..., 3:] / 255])
wheels_base = [(load(os.path.join(out, f'wheel-{k}.webp')), anchors['wheelLayers'][k]['box']) for k in ('front', 'rear')]
base_layers = [(load(os.path.join(out, 'body.webp')), [0, 0, W, H])] + wheels_base
base_img = compose(base_layers)
qa = {}
def check(name, layers, allowed_boxes):
    img = compose(layers)
    diff = np.abs(img - base_img).max(-1) > 0.5
    allow = np.zeros((H, W), bool)
    for x, y, w, h in allowed_boxes: allow[y:y + h, x:x + w] = True
    outside = int((diff & ~allow).sum())
    qa[name] = {'changedPixels': int(diff.sum()), 'changedOutsideAllowed': outside}
    if os.environ.get('QA_IMAGES'):                                # a directory outside public/, for review only
        os.makedirs(os.environ['QA_IMAGES'], exist_ok=True)
        Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(os.path.join(os.environ['QA_IMAGES'], f'qa-{name}.png'))
    return img, diff
for k in ('front', 'rear'):
    pass
mw = [(load(os.path.join(pdir, f'wheel-multispoke-{k}.webp')), anchors['wheelLayers'][k]['box']) for k in ('front', 'rear')]
check('wheel-multispoke', base_layers[:1] + mw, [anchors['wheelLayers'][k]['box'] for k in ('front', 'rear')])
# tyres identical, centre unchanged
for k in ('front', 'rear'):
    b0 = load(os.path.join(out, f'wheel-{k}.webp')); b1 = load(os.path.join(pdir, f'wheel-multispoke-{k}.webp'))
    h, w = b0.shape[:2]; cx_, cy_ = anchors['wheelLayers'][k]['center']
    yy, xx = np.mgrid[0:h, 0:w]; ring = np.sqrt((xx - cx_) ** 2 + (yy - cy_) ** 2) >= RIM + 0.5
    pm0, pm1 = b0[..., :3] * b0[..., 3:], b1[..., :3] * b1[..., 3:]          # premultiplied: RGB under alpha 0 is meaningless
    qa[f'wheel-multispoke-{k}-tyre'] = {'maxDiffInTyre': float(np.abs(pm0[ring] - pm1[ring]).max()), 'alphaDiffInTyre': float(np.abs(b0[ring][:, 3] - b1[ring][:, 3]).max()), 'sameSize': list(b0.shape) == list(b1.shape)}
for name in ('headlamp-matrix', 'handle-flush', 'bumper-front-sport', 'roof-panoramic'):
    rec = parts['layers'][name]
    allowed = rec['allowed'] if isinstance(rec['allowed'][0], list) else [rec['allowed']]
    check(name, base_layers + [(load(os.path.join(out, rec['file'])), rec['box'])], allowed)
# roof: never above the original roof line
alpha_top = {x: np.where(alpha_b[:, x] > 0.5)[0].min() for x in range(*ROOF_X) if (alpha_b[:, x] > 0.5).any()}
rr = load(os.path.join(out, parts['layers']['roof-panoramic']['file'])); rx, ry, _, _ = parts['layers']['roof-panoramic']['box']
above = 0
for (yy, xx) in zip(*np.where(rr[..., 3] > 0.01)):
    if ry + yy < alpha_top.get(rx + xx, 0): above += 1
qa['roof-panoramic-aboveRoofLine'] = above
parts['qa'] = qa
json.dump(parts, open(os.path.join(out, 'parts.json'), 'w'), indent=1)
print(json.dumps(qa, indent=1))
