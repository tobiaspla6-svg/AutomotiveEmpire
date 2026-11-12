"""A basic but complete visible interior: floor, dashboard with displays, steering wheel, seats, console, door
cards, parcel shelf and headliner. Left-hand drive (driver at +Y). Material slots: int_upholstery (seat covers),
int_trim, int_dash, int_carpet, int_headliner, int_accent (decor inlays), int_screen.
"""
import math
import bpy
import bmesh
import numpy as np
import design as D
import bl_util as U
from details import rounded_box, tube


def _loft_box(name, sections, mat):
    """Closed loft through rectangular-ish sections given as lists of 4+ (x, y, z) points (same count)."""
    bm = bmesh.new()
    rings = [[bm.verts.new(p) for p in s] for s in sections]
    n = len(sections[0])
    for a, b in zip(rings[:-1], rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = U.link(bpy.data.objects.new(name, me))
    return ob


def _smooth(ob, levels=2, bevel=None):
    if bevel:
        m = ob.modifiers.new("Bevel", "BEVEL")
        m.width = bevel
        m.segments = 2
    s = ob.modifiers.new("Sub", "SUBSURF")
    s.levels = levels
    s.render_levels = levels
    U.apply_modifiers(ob)
    U.shade_smooth(ob)
    return ob


def seat(name, x, y, mats, rear=False, width=0.52):
    parts = []
    z0 = 0.40 if not rear else 0.42
    cush = rounded_box(name + "_cushion", (0.50 if not rear else 0.46, width, 0.12), (x, y, z0), mats["int_upholstery"], 0.04, 3)
    parts.append(cush)
    # bolsters
    if not rear:
        for s in (1, -1):
            parts.append(rounded_box(f"{name}_bolster{s}", (0.44, 0.07, 0.07), (x, y + s * (width / 2 - 0.03), z0 + 0.07), mats["int_upholstery"], 0.03, 3))
    back = rounded_box(name + "_back", (0.11, width, 0.60 if not rear else 0.50), (x - 0.27, y, z0 + 0.34), mats["int_upholstery"], 0.04, 3,
                       rot=(0, math.radians(-14 if not rear else -20), 0))
    parts.append(back)
    if not rear:
        hr = rounded_box(name + "_headrest", (0.09, 0.26, 0.17), (x - 0.38, y, z0 + 0.73), mats["int_upholstery"], 0.035, 3, rot=(0, math.radians(-10), 0))
        parts.append(hr)
    return parts


def build(mats, greenhouse):
    parts = []
    x_front, x_rear = D.X_COWL - 0.05, D.X_DECK + 0.2
    # floor and transmission tunnel
    parts.append(rounded_box("int_floor", (x_front - x_rear + 0.2, 1.62, 0.04), ((x_front + x_rear) / 2, 0, 0.27), mats["int_carpet"], 0.01, 1))
    parts.append(rounded_box("int_tunnel", (1.4, 0.22, 0.16), (0.10, 0, 0.36), mats["int_carpet"], 0.04, 2))
    # dashboard: a lofted body under the windscreen base
    secs = []
    for y in np.linspace(-0.80, 0.80, 9):
        yy = float(y)
        top = float(D.belt_z(D.X_COWL)) - 0.01
        secs.append([(D.X_COWL + 0.02, yy, top - 0.02), (0.55, yy, top + 0.005), (0.40, yy, top - 0.03), (0.36, yy, 0.70), (0.42, yy, 0.52), (D.X_COWL + 0.02, yy, 0.50)])
    dash = _loft_box("int_dash", secs, mats["int_dash"])
    _smooth(dash, 1)
    parts.append(dash)
    # decor inlay across the dashboard
    parts.append(rounded_box("int_dash_inlay", (0.012, 1.5, 0.035), (0.375, 0, 0.79), mats["int_accent"], 0.004, 2))
    # driver display and central touchscreen
    parts.append(rounded_box("int_cluster", (0.02, 0.32, 0.12), (0.43, 0.38, 0.93), mats["int_screen"], 0.006, 2, rot=(0, math.radians(-18), 0)))
    parts.append(rounded_box("int_touchscreen", (0.02, 0.34, 0.19), (0.42, 0.0, 0.90), mats["int_screen"], 0.006, 2, rot=(0, math.radians(-14), 0)))
    # steering wheel (driver on the left, +Y)
    wx, wy, wz = 0.24, 0.38, 0.84
    tilt = math.radians(23)
    ring = []
    for a in np.linspace(0, 2 * math.pi, 49):
        u, v = 0.185 * math.cos(a), 0.17 * math.sin(a)
        ring.append((wx + v * math.sin(tilt) * 0 - 0.0 + (-v * math.sin(tilt)), wy + u, wz + v * math.cos(tilt)))
    parts.append(tube("int_steering_rim", ring[:-1], 0.017, mats["int_trim"], closed=True))
    hub = rounded_box("int_steering_hub", (0.06, 0.13, 0.11), (wx + 0.02, wy, wz), mats["int_trim"], 0.02, 3, rot=(0, -tilt, 0))
    parts.append(hub)
    for a in (0.0, math.pi, -math.pi / 2):
        u, v = 0.17 * math.cos(a), 0.155 * math.sin(a)
        p0 = (wx + 0.02, wy, wz)
        p1 = (wx - v * math.sin(tilt), wy + u, wz + v * math.cos(tilt))
        parts.append(tube(f"int_spoke_{a:.1f}", [p0, p1], 0.012, mats["int_accent"]))
    parts.append(tube("int_column", [(wx + 0.03, wy, wz - 0.01), (0.42, wy, 0.72)], 0.03, mats["int_trim"]))
    # seats
    parts += seat("int_seat_driver", -0.08, 0.38, mats)
    parts += seat("int_seat_passenger", -0.08, -0.38, mats)
    parts += seat("int_seat_rear", -1.08, 0.0, mats, rear=True, width=1.34)
    for y in (0.42, 0.0, -0.42):
        parts.append(rounded_box(f"int_rear_headrest_{y:+.1f}", (0.08, 0.24, 0.15), (-1.40, y, 1.06), mats["int_upholstery"], 0.03, 3, rot=(0, math.radians(-16), 0)))
    # centre console with armrest
    parts.append(rounded_box("int_console", (0.78, 0.22, 0.20), (0.0, 0, 0.53), mats["int_trim"], 0.03, 3))
    parts.append(rounded_box("int_console_top", (0.50, 0.21, 0.04), (-0.18, 0, 0.645), mats["int_upholstery"], 0.015, 3))
    parts.append(rounded_box("int_console_inlay", (0.30, 0.12, 0.008), (0.20, 0, 0.635), mats["int_accent"], 0.003, 2))
    # door cards (inner side panels) with armrests and a decor strip
    for s in (1, -1):
        y = s * 0.80
        for k, (x0, x1) in enumerate(((0.80, -0.20), (-0.26, -1.42))):
            xc, L = (x0 + x1) / 2, x0 - x1
            parts.append(rounded_box(f"int_door_{s}_{k}", (L, 0.05, 0.62), (xc, y, 0.62), mats["int_trim"], 0.02, 2))
            parts.append(rounded_box(f"int_armrest_{s}_{k}", (L * 0.6, 0.07, 0.04), (xc, y - s * 0.04, 0.70), mats["int_upholstery"], 0.015, 2))
            parts.append(rounded_box(f"int_door_inlay_{s}_{k}", (L * 0.85, 0.006, 0.025), (xc, y - s * 0.028, 0.85), mats["int_accent"], 0.002, 1))
    # parcel shelf and rear bulkhead
    parts.append(rounded_box("int_parcel_shelf", (0.42, 1.5, 0.02), (D.X_DECK + 0.22, 0, float(D.belt_z(D.X_DECK)) - 0.03), mats["int_trim"], 0.006, 1))
    parts.append(rounded_box("int_bulkhead", (0.03, 1.5, 0.5), (D.X_DECK + 0.02, 0, 0.75), mats["int_trim"], 0.006, 1))
    parts.append(rounded_box("int_firewall", (0.03, 1.6, 0.5), (D.X_COWL - 0.02, 0, 0.55), mats["int_dash"], 0.006, 1))
    # headliner: the glasshouse's inner side (pillars and roof), set 1 cm inside
    hl = greenhouse.copy()
    hl.data = greenhouse.data.copy()
    hl.name = hl.data.name = "int_headliner"
    U.link(hl)
    bm = bmesh.new()
    bm.from_mesh(hl.data)
    bm.normal_update()
    low = [f for f in bm.faces if f.calc_center_median().z < float(D.belt_z(f.calc_center_median().x)) + 0.07]
    bmesh.ops.delete(bm, geom=low, context="FACES")
    bm.normal_update()
    for v in bm.verts:
        v.co -= v.normal * 0.012
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(hl.data)
    bm.free()
    hl.data.materials.clear()
    hl.data.materials.append(mats["int_headliner"])
    for p in hl.data.polygons:
        p.material_index = 0
    parts.append(hl)
    return parts
