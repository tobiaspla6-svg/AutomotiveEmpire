#!/usr/bin/env python3
"""Before/after sheets for Phase 5D: the Phase 5C captures (docs/phase5c-flow/screens, committed on phase5c-flow-screens)
beside the same screen captured from this branch with e2e/shots-flow.cjs, same size, same script, same game.

    python3 e2e/before-after.py <before dir> <after dir> <out dir>

Writes one sheet per screen and size (before left, after right) and converts the after PNGs to WebP.
Live data (dates, money) can differ slightly between runs; the point is the art and the layout.
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

before, after, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26)
except Exception: font = ImageFont.load_default()
SHEETS = [('03-taller', '1280'), ('03-taller', '1920'), ('03-taller', '390'), ('05-garaje', '1280'), ('05-garaje', '1920'), ('05-garaje', '390'), ('04-fabrica', '1920'), ('01-inicio', '1920')]
for name, tag in SHEETS:
    b, a = os.path.join(before, f'{name}-{tag}.webp'), os.path.join(after, f'{name}-{tag}.png')
    if not (os.path.exists(b) and os.path.exists(a)): print('skip', name, tag); continue
    ib, ia = Image.open(b).convert('RGB'), Image.open(a).convert('RGB')
    h = min(ib.height, ia.height, 1100)
    ib, ia = ib.resize((round(ib.width * h / ib.height), h)), ia.resize((round(ia.width * h / ia.height), h))
    narrow = ib.width < 900                                   # phone captures: two short title lines
    top = 84 if narrow else 52
    sheet = Image.new('RGB', (ib.width + ia.width + 24, h + top), (16, 25, 35)); d = ImageDraw.Draw(sheet)
    sheet.paste(ib, (0, top)); sheet.paste(ia, (ib.width + 24, top))
    for x, label, col in ((8, 'ANTES (fase 5C)', (238, 236, 229)), (ib.width + 32, 'DESPUÉS (fase 5D)', (216, 177, 106))):
        if narrow: d.text((x, 10), label, fill=col, font=font); d.text((x, 44), f'{name} · {tag}px', fill=col, font=font)
        else: d.text((x, 12), f'{label} · {name} · {tag}px', fill=col, font=font)
    sheet.save(os.path.join(out, f'{name}-{tag}.webp'), quality=80)
for f in sorted(os.listdir(after)):
    if f.endswith('.png'):
        Image.open(os.path.join(after, f)).save(os.path.join(after, f[:-4] + '.webp'), quality=82); os.remove(os.path.join(after, f))
print('done')
