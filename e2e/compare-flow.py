#!/usr/bin/env python3
"""Reference-vs-implementation sheets for the seven Flow screens.

    python3 e2e/compare-flow.py <design-assets dir> <screens dir>

For each screen: the selected Flow original (left) beside the 1920×1080 capture of the game (right), both scaled to
the same height without stretching, plus a 50 % overlay of the two at the original's aspect ratio (the capture is
fitted inside, not stretched, so differing layouts show as offsets rather than being hidden). Composition is the point
of comparison, not pixels: the captures contain live data and the game's shell.
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

ref_dir, shots = sys.argv[1], sys.argv[2]
PAIRS = [('01-inicio/E-garaje-refinado.jpg', '01-inicio-1920.png', 'Inicio'), ('02-headquarters/A-campus.jpg', '02-headquarters-1920.png', 'Headquarters'),
         ('03-taller/A.jpg', '03-taller-1920.png', 'Taller de diseño'), ('04-fabrica/A.jpg', '04-fabrica-1920.png', 'Fábrica'),
         ('05-garaje/A.jpg', '05-garaje-1920.png', 'Garaje'), ('06-cofres/B.jpg', '06-cofres-1920.png', 'Cofres'), ('07-configuracion/A.jpg', '07-configuracion-1920.png', 'Configuración')]
out = os.path.join(shots, 'compare'); os.makedirs(out, exist_ok=True)
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26)
except Exception: font = ImageFont.load_default()
H = 600
for ref, shot, name in PAIRS:
    rp, sp = os.path.join(ref_dir, ref), os.path.join(shots, shot)
    if not (os.path.exists(rp) and os.path.exists(sp)):
        print('skip', name); continue
    r = Image.open(rp).convert('RGB'); s = Image.open(sp).convert('RGB')
    r2 = r.resize((round(r.width * H / r.height), H)); s2 = s.resize((round(s.width * H / s.height), H))
    sheet = Image.new('RGB', (r2.width + s2.width + 16, H + 48), (16, 25, 35))
    sheet.paste(r2, (0, 48)); sheet.paste(s2, (r2.width + 16, 48))
    d = ImageDraw.Draw(sheet)
    d.text((10, 10), f'{name}: referencia Flow ({ref}, {r.width}×{r.height})', fill=(216, 177, 106), font=font)
    d.text((r2.width + 26, 10), 'juego real 1920×1080', fill=(238, 236, 229), font=font)
    slug = shot.split('-1920')[0]
    sheet.save(os.path.join(out, f'{slug}.webp'), quality=80)
    # 50 % overlay at the reference's aspect ratio, capture fitted inside (letterboxed, not stretched)
    k = min(r.width / s.width, r.height / s.height)
    fit = s.resize((round(s.width * k), round(s.height * k)))
    canvas = Image.new('RGB', r.size, (0, 0, 0)); canvas.paste(fit, ((r.width - fit.width) // 2, (r.height - fit.height) // 2))
    Image.blend(r, canvas, 0.5).save(os.path.join(out, f'{slug}-overlay50.webp'), quality=78)
    print('ok', name)
