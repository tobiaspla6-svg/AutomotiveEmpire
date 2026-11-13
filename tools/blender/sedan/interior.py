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


def soft_box(name, size, loc, mat, rot=(0, 0, 0), round_=0.3, levels=2):
    """A pillowy upholstered block: bevelled cube with subdivision (cushions, bolsters, headrests)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    m = ob.modifiers.new("Bevel", "BEVEL")
    m.width = min(size) * round_
    m.segments = 1
    s = ob.modifiers.new("Sub", "SUBSURF")
    s.levels = levels
    s.render_levels = levels
    U.apply_modifiers(ob)
    ob.data.materials.append(mat)
    U.shade_smooth(ob)
    return ob


def seat(name, x, y, mats, rear=False, width=0.52):
    """Sports-saloon seat: cushion with a recessed insert and raised side bolsters, a backrest with wraparound
    bolsters and a shoulder roll, and a separate headrest (front seats); a contoured bench at the rear."""
    up = mats["int_upholstery"]
    parts = []
    z0 = 0.40 if not rear else 0.42
    tilt = math.radians(-14 if not rear else -20)
    ct, st = math.cos(-tilt), math.sin(-tilt)
    if not rear:
        parts.append(soft_box(name + "_cushion", (0.50, width - 0.14, 0.10), (x, y, z0), up))
        for s_ in (1, -1):
            parts.append(soft_box(f"{name}_cushion_bolster{s_}", (0.48, 0.09, 0.15), (x, y + s_ * (width / 2 - 0.045), z0 + 0.03), up))
        parts.append(soft_box(name + "_knee_roll", (0.10, width - 0.12, 0.12), (x + 0.22, y, z0 + 0.015), up))
        bx, bz = x - 0.27, z0 + 0.34
        parts.append(soft_box(name + "_back", (0.09, width - 0.16, 0.58), (bx, y, bz), up, rot=(0, tilt, 0)))
        for s_ in (1, -1):
            parts.append(soft_box(f"{name}_back_bolster{s_}", (0.13, 0.09, 0.56), (bx + 0.03 * ct, y + s_ * (width / 2 - 0.045), bz - 0.01), up, rot=(0, tilt, 0)))
        parts.append(soft_box(name + "_shoulder", (0.12, width - 0.06, 0.10), (bx - 0.30 * st, y, bz + 0.29 * ct), up, rot=(0, tilt, 0)))
        parts.append(soft_box(name + "_headrest", (0.10, 0.27, 0.17), (x - 0.40, y, z0 + 0.74), up, rot=(0, math.radians(-8), 0)))
        for s_ in (1, -1):  # headrest posts
            parts.append(tube(f"{name}_post{s_}", [(x - 0.385, y + s_ * 0.07, z0 + 0.62), (x - 0.395, y + s_ * 0.07, z0 + 0.68)], 0.006, mats["int_accent"]))
    else:
        for k, yy in enumerate((-0.42, 0.0, 0.42)):
            parts.append(soft_box(f"{name}_cushion{k}", (0.46, 0.40, 0.12), (x, y + yy, z0), up))
            parts.append(soft_box(f"{name}_back{k}", (0.10, 0.40, 0.50), (x - 0.27, y + yy, z0 + 0.30), up, rot=(0, tilt, 0)))
    return parts


def build(mats, greenhouse):
    parts = []
    x_front, x_rear = D.X_COWL - 0.05, D.X_DECK + 0.2
    # floor and transmission tunnel
    parts.append(rounded_box("int_floor", (x_front - x_rear + 0.2, 1.62, 0.04), ((x_front + x_rear) / 2, 0, 0.27), mats["int_carpet"], 0.01, 1))
    parts.append(rounded_box("int_tunnel", (1.4, 0.22, 0.16), (0.10, 0, 0.36), mats["int_carpet"], 0.04, 2))
    # dashboard: a sculpted loft under the windscreen base, with an instrument hood over the driver
    secs = []
    top = float(D.belt_z(D.X_COWL)) - 0.01
    for y in np.linspace(-0.80, 0.80, 17):
        yy = float(y)
        hood = 0.035 * math.exp(-((yy - 0.38) / 0.16) ** 2)        # binnacle hump in front of the driver
        secs.append([(D.X_COWL + 0.02, yy, top - 0.03), (0.66, yy, top + 0.0 + hood), (0.48, yy, top - 0.005 + hood),
                     (0.43, yy, top - 0.035 + hood * 0.6), (0.40, yy, 0.80), (0.37, yy, 0.70), (0.40, yy, 0.58), (0.46, yy, 0.50), (D.X_COWL + 0.02, yy, 0.48)])
    dash = _loft_box("int_dash", secs, mats["int_dash"])
    _smooth(dash, 2)
    parts.append(dash)
    # decor inlay and air vents
    parts.append(rounded_box("int_dash_inlay", (0.012, 1.5, 0.03), (0.383, 0, 0.775), mats["int_accent"], 0.004, 2))
    for k, yy in enumerate((-0.66, -0.12, 0.12, 0.66)):
        parts.append(rounded_box(f"int_vent_{k}", (0.02, 0.14 if abs(yy) > 0.3 else 0.09, 0.05), (0.392, yy, 0.835), mats["int_trim"], 0.006, 2))
        for j in range(4):
            parts.append(rounded_box(f"int_vent_{k}_vane{j}", (0.012, 0.13 if abs(yy) > 0.3 else 0.08, 0.004), (0.382, yy, 0.818 + j * 0.011), mats["int_accent"], 0.0015, 1))
    # driver display under its hood, central touchscreen with a bezel
    parts.append(rounded_box("int_cluster", (0.02, 0.30, 0.11), (0.47, 0.38, 0.905), mats["int_screen"], 0.006, 2, rot=(0, math.radians(-12), 0)))
    parts.append(rounded_box("int_touch_bezel", (0.022, 0.36, 0.21), (0.425, 0.0, 0.905), mats["int_trim"], 0.01, 3, rot=(0, math.radians(-14), 0)))
    parts.append(rounded_box("int_touchscreen", (0.02, 0.33, 0.18), (0.418, 0.0, 0.905), mats["int_screen"], 0.006, 2, rot=(0, math.radians(-14), 0)))
    # steering wheel (driver on the left, +Y): thick rim, airbag hub, three flat spokes
    wx, wy, wz = 0.24, 0.38, 0.84
    tilt = math.radians(23)
    ring = []
    for a in np.linspace(0, 2 * math.pi, 65):
        u, v = 0.185 * math.cos(a), 0.17 * math.sin(a)
        ring.append((wx - v * math.sin(tilt), wy + u, wz + v * math.cos(tilt)))
    parts.append(tube("int_steering_rim", ring[:-1], 0.019, mats["int_upholstery"], closed=True))
    parts.append(soft_box("int_steering_hub", (0.06, 0.15, 0.12), (wx + 0.025, wy, wz), mats["int_trim"], rot=(0, -tilt, 0)))
    for a in (0.0, math.pi, -math.pi / 2):
        u, v = 0.12 * math.cos(a), 0.11 * math.sin(a)
        cx, cy, cz = wx + 0.01 - v * math.sin(tilt), wy + u, wz + v * math.cos(tilt)
        rot = (math.atan2(v, u) if a == -math.pi / 2 else 0.0, -tilt, 0)
        size = (0.018, 0.10, 0.035) if a != -math.pi / 2 else (0.018, 0.035, 0.10)
        parts.append(rounded_box(f"int_spoke_{a:.1f}", size, (cx, cy, cz), mats["int_accent"], 0.008, 2, rot=(0, -tilt, 0)))
    parts.append(tube("int_column", [(wx + 0.03, wy, wz - 0.01), (0.42, wy, 0.72)], 0.03, mats["int_trim"]))
    # seats
    parts += seat("int_seat_driver", -0.08, 0.38, mats)
    parts += seat("int_seat_passenger", -0.08, -0.38, mats)
    parts += seat("int_seat_rear", -1.08, 0.0, mats, rear=True, width=1.34)
    for y in (0.42, 0.0, -0.42):
        parts.append(rounded_box(f"int_rear_headrest_{y:+.1f}", (0.08, 0.24, 0.15), (-1.40, y, 1.06), mats["int_upholstery"], 0.03, 3, rot=(0, math.radians(-16), 0)))
    # centre console: armrest, decor panel, gear selector, rotary controller, cup holders, centre stack
    parts.append(soft_box("int_console", (0.80, 0.24, 0.22), (0.0, 0, 0.53), mats["int_trim"], round_=0.15))
    parts.append(soft_box("int_console_top", (0.46, 0.22, 0.05), (-0.20, 0, 0.655), mats["int_upholstery"], round_=0.4))
    parts.append(rounded_box("int_console_inlay", (0.34, 0.16, 0.008), (0.19, 0, 0.643), mats["int_accent"], 0.003, 2))
    parts.append(soft_box("int_gear_selector", (0.09, 0.05, 0.06), (0.25, 0, 0.675), mats["int_trim"], round_=0.4))
    parts.append(rounded_box("int_gear_trim", (0.092, 0.052, 0.012), (0.25, 0, 0.705), mats["int_accent"], 0.004, 2))
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.03, depth=0.022, location=(0.12, 0, 0.66))
    knob = bpy.context.active_object
    knob.name = "int_rotary_controller"
    knob.data.materials.append(mats["int_accent"])
    U.shade_smooth(knob, 40)
    parts.append(knob)
    for yy in (-0.045, 0.045):
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.035, depth=0.01, location=(0.03, yy, 0.646))
        cup = bpy.context.active_object
        cup.name = f"int_cupholder_{yy:+.2f}"
        cup.data.materials.append(mats["int_carpet"])
        parts.append(cup)
    parts.append(soft_box("int_centre_stack", (0.12, 0.24, 0.24), (0.40, 0, 0.56), mats["int_trim"], round_=0.2))
    # door cards (inner side panels) with armrests and a decor strip
    for s in (1, -1):
        y = s * 0.80
        for k, (x0, x1) in enumerate(((0.80, -0.20), (-0.26, -1.42))):
            xc, L = (x0 + x1) / 2, x0 - x1
            parts.append(rounded_box(f"int_door_{s}_{k}", (L, 0.05, 0.62), (xc, y, 0.62), mats["int_trim"], 0.02, 2))
            parts.append(soft_box(f"int_armrest_{s}_{k}", (L * 0.6, 0.08, 0.05), (xc, y - s * 0.045, 0.70), mats["int_upholstery"], round_=0.35))
            parts.append(soft_box(f"int_door_insert_{s}_{k}", (L * 0.7, 0.02, 0.16), (xc, y - s * 0.03, 0.80), mats["int_upholstery"], round_=0.3))
            parts.append(rounded_box(f"int_door_handle_{s}_{k}", (0.12, 0.012, 0.025), (x0 - 0.18, y - s * 0.035, 0.86), mats["int_accent"], 0.006, 2))
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
    names = [m.name if m else "" for m in hl.data.materials]
    keep_mats = {i for i, n in enumerate(names) if n in ("paint", "trim_black")}
    low = [f for f in bm.faces if f.material_index not in keep_mats or f.calc_center_median().z < float(D.belt_z(f.calc_center_median().x)) + 0.07]
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
