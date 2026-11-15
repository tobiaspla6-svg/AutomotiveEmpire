#!/usr/bin/env python3
"""Measure the SUV captures from e2e/proof-suv90.cjs and build the proof sheets.

    python3 e2e/proof-suv90.py <proof dir> <public/flow/suv90/manifest.json> <public/flow/suv90/paint-mask.png>

Wheel/lamp combinations: pixels changed against the original (> 10 levels) and how many fall outside the union of
the chosen layers' boxes (scaled from the 1376×590 canvas, +3 px margin). Colours: pixels changed outside the paint
mask (mask dilated by 3 px for resampling) — they must be 0: glass, tyres, rims, lamps, black trim and the shadow keep
their pixels. Writes proof.json, sheet-combos.webp and sheet-paint.webp.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

d, man, maskf = sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3]
rj = json.load(open(os.path.join(d, 'render.json')))
load = lambda n: np.asarray(Image.open(os.path.join(d, f'{n}.png')).convert('RGB')).astype(np.int16)
base = load('base'); H, W = base.shape[:2]
cw, ch = man['canvas']; sx, sy = W / cw, H / ch
LAY = man['layers']
LAYERS_OF = {'wheel-suv90-steel5': [], 'wheel-suv90-steel6': ['wheel-steel-front', 'wheel-steel-rear'], 'wheel-suv90-alloy6': ['wheel-alloy-front', 'wheel-alloy-rear'],
             'headlamp-suv90-original': [], 'headlamp-suv90-halogen-a': ['headlamp-a'], 'headlamp-suv90-halogen-b': ['headlamp-b']}
def allowed(layers, m=3):
    a = np.zeros((H, W), bool)
    for l in layers:
        x, y, w, h = LAY[l]['box']
        a[max(0, int(y * sy) - m):int((y + h) * sy) + m, max(0, int(x * sx) - m):int((x + w) * sx) + m] = True
    return a
mask_im = Image.open(maskf).getchannel('A').resize((W, H), Image.BILINEAR)
mask_c = np.asarray(mask_im.point(lambda v: 255 if v > 5 else 0).filter(ImageFilter.MaxFilter(7))) > 0
out = {'vehicle': rj['vehicle'], 'captureSize': [W, H], 'errors': rj['errors'], 'combos': {}, 'paint': {}}
combo_imgs = []
for k in rj['states']:
    if '__' not in k: continue
    wv, lv = k.split('__')
    img = load(k); diff = np.abs(img - base).max(-1) > 10
    a = allowed(LAYERS_OF[wv] + LAYERS_OF[lv])
    out['combos'][k] = {'changedPixels': int(diff.sum()), 'changedOutsideLayers': int((diff & ~a).sum()), 'domParts': rj['states'][k]['parts']}
    combo_imgs.append((k, img))
for k in rj['states']:
    if not k.startswith('paint-'): continue
    img = load(k); diff = np.abs(img - base).max(-1) > 10
    out['paint'][k] = {'changedPixels': int(diff.sum()), 'changedOutsidePaintMask': int((diff & ~mask_c).sum()), 'repaintLayer': rj['states'][k]['repaint']}
ba = load('base-again'); out['baseAgainChangedPixels'] = int((np.abs(ba - base).max(-1) > 10).sum())
json.dump(out, open(os.path.join(d, 'proof.json'), 'w'), indent=1)
print(json.dumps(out, indent=1))

try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26)
except Exception: font = ImageFont.load_default()
NAMES = {'wheel-suv90-steel5': 'Llanta original', 'wheel-suv90-steel6': 'Acero 6', 'wheel-suv90-alloy6': 'Aleación 6', 'headlamp-suv90-original': 'faro original', 'headlamp-suv90-halogen-a': 'faro A', 'headlamp-suv90-halogen-b': 'faro B'}
s = 0.36; tw, th = int(W * s), int(H * s)
sheet = Image.new('RGB', (tw * 3 + 40, (th + 50) * 3), (16, 25, 35)); dr = ImageDraw.Draw(sheet)
for i, (k, img) in enumerate(combo_imgs):
    x, y = (i % 3) * (tw + 20), (i // 3) * (th + 50)
    sheet.paste(Image.fromarray(img.astype(np.uint8)).resize((tw, th), Image.LANCZOS), (x, y + 44))
    wv, lv = k.split('__'); c = out['combos'][k]
    dr.text((x + 6, y + 8), f"{NAMES[wv]} + {NAMES[lv]} · fuera: {c['changedOutsideLayers']}", fill=(216, 177, 106), font=font)
sheet.save(os.path.join(d, 'sheet-combos.webp'), quality=85)
pk = [k for k in rj['states'] if k.startswith('paint-')]
sheet = Image.new('RGB', (tw * 3 + 40, (th + 50) * 2), (16, 25, 35)); dr = ImageDraw.Draw(sheet)
for i, k in enumerate(pk):
    x, y = (i % 3) * (tw + 20), (i // 3) * (th + 50)
    sheet.paste(Image.fromarray(load(k).astype(np.uint8)).resize((tw, th), Image.LANCZOS), (x, y + 44))
    dr.text((x + 6, y + 8), f"{k[6:]} · fuera de la máscara: {out['paint'][k]['changedOutsidePaintMask']}", fill=(216, 177, 106), font=font)
sheet.save(os.path.join(d, 'sheet-paint.webp'), quality=85)
