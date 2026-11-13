"""Orthographic design references (front, side, rear, top) drawn from the design parameters in design.py.

They are the single source of the sedan's intended proportions and character lines: Blender loads them as aligned
image planes (build.py --references), so the model can be checked against the design in every view. Run with any
Python that has numpy and Pillow:

    python3 tools/blender/sedan/reference_sheet.py

Output: assets-src/sedan-ref/references/{front,side,rear,top}.png and design-sheet.png
"""
import os
import sys
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import design as D  # noqa: E402

OUT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "assets-src", "sedan-ref", "references"))
PX = 220  # pixels per metre
BG, INK, SOFT, ACC = (250, 250, 247), (25, 30, 38), (150, 158, 170), (196, 120, 20)


def canvas(w_m, h_m):
    W, H = int(w_m * PX), int(h_m * PX)
    im = Image.new("RGB", (W, H), BG)
    return im, ImageDraw.Draw(im), W, H


def grid(d, W, H, to):
    for g in np.arange(-3, 3.01, 0.5):
        x, _ = to(g, 0)
        d.line([(x, 0), (x, H)], fill=(232, 232, 228), width=1)
    for g in np.arange(0, 2.01, 0.25):
        _, y = to(0, g)
        d.line([(0, y), (W, y)], fill=(232, 232, 228), width=1)
    gy = to(0, 0)[1]
    d.line([(0, gy), (W, gy)], fill=SOFT, width=2)


def poly(d, pts, to, fill=None, outline=INK, width=3, closed=True):
    P = [to(a, b) for a, b in pts]
    if closed:
        d.polygon(P, fill=fill, outline=outline, width=width)
    else:
        d.line(P, fill=outline, width=width, joint="curve")


def side():
    im, d, W, H = canvas(5.6, 1.9)
    to = lambda x, z: (W / 2 - x * PX, H - 0.15 * PX - z * PX)   # front to the left, like the game's side camera
    grid(d, W, H, to)
    xs = np.linspace(D.X_REAR + 0.02, D.X_FRONT - 0.03, 300)
    top = [float(D.gh_top(x)) if D.X_DECK <= x <= D.X_COWL else float(D.top_centre(x)) for x in xs]
    poly(d, list(zip(xs, top)), to, closed=False, width=4)
    poly(d, [(D.X_FRONT, 0.24), (D.X_FRONT, 0.66), (D.X_FRONT - 0.05, 0.775), (xs[-1], top[-1])], to, closed=False, width=4)
    poly(d, [(D.X_REAR, 0.32), (D.X_REAR, 0.90), (D.X_REAR + 0.03, 1.03), (xs[0], top[0])], to, closed=False, width=4)
    poly(d, [(D.X_FRONT, 0.24), (D.X_FRONT - 0.15, 0.20), (D.AX_F + D.ARCH_R, 0.20)], to, closed=False, width=3)
    poly(d, [(D.AX_F - D.ARCH_R, 0.20), (D.AX_R + D.ARCH_R, 0.20)], to, closed=False, width=3)
    poly(d, [(D.AX_R - D.ARCH_R, 0.22), (D.X_REAR + 0.1, 0.27), (D.X_REAR, 0.32)], to, closed=False, width=3)
    xb = np.linspace(D.XS_R, D.XS_F, 200)
    poly(d, list(zip(xb, D.belt_z(xb))), to, closed=False, outline=SOFT, width=2)
    poly(d, list(zip(xb, D._crease_z(xb))), to, closed=False, outline=ACC, width=3)
    xr = np.linspace(D.X_DECK + 0.1, D.X_COWL - 0.1, 200)
    poly(d, list(zip(xr, D.rail_z(xr))), to, closed=False, outline=SOFT, width=2)
    # daylight opening, B-pillar, C-pillar edge
    for xa in (D.DLO_FRONT, D.B_PILLAR[0], D.B_PILLAR[1]):
        poly(d, [(xa, float(D.belt_z(xa))), (xa, float(D.rail_z(xa)))], to, closed=False, outline=SOFT, width=2)
    poly(d, [(D.DLO_REAR_BOTTOM, float(D.belt_z(D.DLO_REAR_BOTTOM))), (D.DLO_REAR_TOP, float(D.rail_z(D.DLO_REAR_TOP)))], to, closed=False, outline=SOFT, width=2)
    for ax in (D.AX_F, D.AX_R):
        cx, cy = to(ax, D.TIRE_R)
        r = D.TIRE_R * PX
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=INK, width=3)
        r2 = D.RIM_D / 2 * PX
        d.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], outline=SOFT, width=2)
        ra = (D.ARCH_R) * PX
        d.arc([cx - ra, cy - ra, cx + ra, cy + ra], 180, 360, fill=INK, width=3)
    return im


def front():
    im, d, W, H = canvas(2.4, 1.9)
    to = lambda y, z: (W / 2 + y * PX, H - 0.15 * PX - z * PX)
    grid(d, W, H, to)
    half = [(0, 0.20), (0.78, 0.20), (0.88, 0.25), (0.93, 0.56), (0.92, 0.86), (0.87, 0.96), (0.79, 1.0), (0.70, 1.38), (0.35, 1.44), (0, 1.446)]
    full = half + [(-y, z) for y, z in reversed(half)]
    poly(d, full, to, width=4)
    for outline, col in ((D.HEADLAMP, ACC), (D.GRILLE, INK), (D.LOWER_INTAKE, INK)):
        for s in (1, -1):
            pts = [(s * y, z) for y, z in outline]
            poly(d, pts, to, outline=col, width=3)
    for s in (1, -1):
        for x0 in (-1,):
            cx, cy = to(s * D.TRACK_F / 2, D.TIRE_R)
            d.rectangle([cx - D.TIRE_W / 2 * PX, cy - D.TIRE_R * PX, cx + D.TIRE_W / 2 * PX, cy + D.TIRE_R * PX], outline=INK, width=3)
    return im


def rear():
    im, d, W, H = canvas(2.4, 1.9)
    to = lambda y, z: (W / 2 - y * PX, H - 0.15 * PX - z * PX)
    grid(d, W, H, to)
    half = [(0, 0.29), (0.80, 0.29), (0.90, 0.33), (0.935, 0.6), (0.94, 0.9), (0.90, 1.03), (0.80, 1.05), (0.70, 1.38), (0.35, 1.44), (0, 1.446)]
    full = half + [(-y, z) for y, z in reversed(half)]
    poly(d, full, to, width=4)
    for s in (1, -1):
        poly(d, [(s * y, z) for y, z in D.TAILLAMP], to, outline=(170, 20, 20), width=3)
    poly(d, [(-0.26, 0.61), (0.26, 0.61), (0.26, 0.725), (-0.26, 0.725)], to, outline=SOFT, width=2)
    poly(d, [(-0.72, 0.29), (0.72, 0.29), (0.74, 0.40), (-0.74, 0.40)], to, outline=SOFT, width=2)
    poly(d, [(-0.9, 0.578), (0.9, 0.578)], to, closed=False, outline=ACC, width=3)
    return im


def top():
    im, d, W, H = canvas(5.6, 2.4)
    to = lambda x, y: (W / 2 - x * PX, H / 2 - y * PX)
    pts = []
    n = 4.0
    for th in np.linspace(0, math.pi / 2, 40):
        c, s = math.cos(th) ** (2 / n), math.sin(th) ** (2 / n)
        pts.append((D.XS_F + (D.X_FRONT - D.XS_F) * c, D.HALF_W * s))
    pts += [(D.XS_R, D.HALF_W)]
    for th in np.linspace(math.pi / 2, 0, 40):
        c, s = math.cos(th) ** (2 / n), math.sin(th) ** (2 / n)
        pts.append((D.XS_R + (D.X_REAR - D.XS_R) * c, D.HALF_W * s))
    full = pts + [(x, -y) for x, y in reversed(pts)]
    poly(d, full, to, width=4)
    xr = np.linspace(D.X_DECK, D.X_COWL, 120)
    rail = list(zip(xr, D.rail_y(xr)))
    poly(d, rail + [(x, -y) for x, y in reversed(rail)], to, outline=SOFT, width=2)
    for s in (1, -1):
        cx, cy = to(0.74, s * 1.03)
        d.ellipse([cx - 0.09 * PX, cy - 0.06 * PX, cx + 0.09 * PX, cy + 0.06 * PX], outline=INK, width=2)
    return im


def main():
    os.makedirs(OUT, exist_ok=True)
    views = {"side": side(), "front": front(), "rear": rear(), "top": top()}
    for k, im in views.items():
        im.save(os.path.join(OUT, f"{k}.png"))
    sheet = Image.new("RGB", (views["side"].width + views["front"].width, views["side"].height + views["top"].height), BG)
    sheet.paste(views["side"], (0, 0))
    sheet.paste(views["front"], (views["side"].width, 0))
    sheet.paste(views["top"], (0, views["side"].height))
    sheet.paste(views["rear"], (views["side"].width, views["side"].height))
    d = ImageDraw.Draw(sheet)
    d.text((20, 16), "Automotive Empire reference saloon - design sheet (orthographic, 1 m grid / 0.5 m). Generated from design.py.", fill=INK)
    sheet.save(os.path.join(OUT, "design-sheet.png"))
    print("written", OUT)


if __name__ == "__main__":
    main()
