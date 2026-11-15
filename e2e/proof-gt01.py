#!/usr/bin/env python3
"""Measure the GT-01 part swaps captured from the real game (e2e/proof-gt01.cjs) and build the proof sheets.

    python3 e2e/proof-gt01.py <proof dir> <public/flow/gt01/parts.json>

For each variant: pixels that differ from the base capture (> 10 levels on any channel), how many of them fall
outside the part's allowed region (scaled from the 1376x768 native canvas to the capture, plus a 3 px margin for
resampling), and the same for the base captured again after switching back. Writes proof.json and two sheets:
side-by-side pairs with a difference map (changed pixels in red over a grey base, allowed region outlined).
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

d, manifest = sys.argv[1], json.load(open(sys.argv[2]))
base = np.asarray(Image.open(os.path.join(d, 'base.png')).convert('RGB')).astype(np.int16)
H, W = base.shape[:2]
sx, sy = W / manifest['canvas'][0], H / manifest['canvas'][1]
L = manifest['layers']
REG = {
    'wheel-multispoke': [L['wheel-multispoke-front']['box'], L['wheel-multispoke-rear']['box']],
    'headlamp-matrix': [L['headlamp-matrix']['box']], 'handle-flush': L['handle-flush']['allowed'],
    'bumper-front-sport': [L['bumper-front-sport']['box']], 'roof-panoramic': [L['roof-panoramic']['box']],
}
def allowed_mask(boxes, margin=3):
    m = np.zeros((H, W), bool)
    for x, y, w, h in boxes:
        m[max(0, int(y * sy) - margin):int((y + h) * sy) + margin, max(0, int(x * sx) - margin):int((x + w) * sx) + margin] = True
    return m
out, pairs = {}, []
for name, boxes in list(REG.items()) + [('base-again', [])]:
    img = np.asarray(Image.open(os.path.join(d, f'{name}.png')).convert('RGB')).astype(np.int16)
    diff = np.abs(img - base).max(-1) > 10
    allow = allowed_mask(boxes)
    out[name] = {'changedPixels': int(diff.sum()), 'changedOutsideRegion': int((diff & ~allow).sum()), 'captureSize': [W, H]}
    pairs.append((name, img, diff, allow, boxes))
json.dump(out, open(os.path.join(d, 'proof.json'), 'w'), indent=1)
print(json.dumps(out, indent=1))

try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
except Exception: font = ImageFont.load_default()
def diffmap(diff, allow):
    g = (base.mean(-1) * 0.35 + 140).astype(np.uint8)
    rgb = np.dstack([g, g, g]); rgb[diff] = (220, 40, 40)
    im = Image.fromarray(rgb); dr = ImageDraw.Draw(im)
    edge = allow ^ np.pad(allow, 1)[1:-1, 2:] | allow ^ np.pad(allow, 1)[2:, 1:-1]
    a = np.asarray(im).copy(); a[edge] = (40, 160, 230); return Image.fromarray(a)
TITLES = {'wheel-multispoke': ('Llantas: cinco radios dobles (original)', 'Llantas: multirradio'), 'headlamp-matrix': ('Faros: LED finos (original)', 'Faros: matriciales'),
          'handle-flush': ('Manijas: convencionales (original)', 'Manijas: enrasadas'), 'bumper-front-sport': ('Paragolpes: estándar (original)', 'Paragolpes: deportivo'),
          'roof-panoramic': ('Techo: fijo (original)', 'Techo: panorámico')}
s = 0.5
tw, th = int(W * s), int(H * s)
rows = [p for p in pairs if p[0] in TITLES]
sheet = Image.new('RGB', (tw * 3 + 40, (th + 60) * len(rows)), (16, 25, 35))
dr = ImageDraw.Draw(sheet)
b_img = Image.fromarray(base.astype(np.uint8)).resize((tw, th))
for i, (name, img, diff, allow, _) in enumerate(rows):
    y = i * (th + 60)
    sheet.paste(b_img, (0, y + 50)); sheet.paste(Image.fromarray(img.astype(np.uint8)).resize((tw, th)), (tw + 20, y + 50)); sheet.paste(diffmap(diff, allow).resize((tw, th)), (2 * tw + 40, y + 50))
    a, b2 = TITLES[name]
    dr.text((8, y + 10), a, fill=(238, 236, 229), font=font); dr.text((tw + 28, y + 10), b2, fill=(216, 177, 106), font=font)
    dr.text((2 * tw + 48, y + 10), f"cambian {out[name]['changedPixels']} px · fuera de la zona: {out[name]['changedOutsideRegion']}", fill=(238, 236, 229), font=font)
sheet.save(os.path.join(d, 'sheet-variants.webp'), quality=85)
# finishes and everything together
names = ['base', 'finish-solid', 'finish-pearl', 'finish-matte', 'all-variants-red']
labels = ['Metalizada (base)', 'Sólida', 'Perlada', 'Mate', 'Rojo + todas las variantes']
ims = [Image.open(os.path.join(d, f'{n}.png')).convert('RGB').resize((tw, th)) for n in names]
sheet2 = Image.new('RGB', (tw * 2 + 20, (th + 60) * 3), (16, 25, 35)); dr = ImageDraw.Draw(sheet2)
for i, (im, lab) in enumerate(zip(ims, labels)):
    x, y = (i % 2) * (tw + 20), (i // 2) * (th + 60)
    sheet2.paste(im, (x, y + 50)); dr.text((x + 8, y + 10), lab, fill=(216, 177, 106), font=font)
sheet2.save(os.path.join(d, 'sheet-finishes.webp'), quality=85)
