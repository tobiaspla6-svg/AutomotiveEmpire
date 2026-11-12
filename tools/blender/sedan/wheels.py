"""Alloy wheels, brakes and tyres. Built at true size around the origin: wheel axis +Y (outboard), centre at 0.

Rim designs (node names are part of the asset contract):
    rim_sport5    five broad spokes
    rim_turbine10 ten twisted spokes
    rim_multi15   fifteen slim spokes (aero / luxury)
The tyre is generated from TIRE_PROFILE, which is also written to the game assets so the browser can build the same
tyre for any size (the game knows each car's tyre width, aspect and rim diameter).
"""
import math
import bpy
import bmesh
import numpy as np
import bl_util as U

RIM_R = 19 * 0.0254 / 2      # bead seat radius (19")
RIM_W = 0.216                # 8.5J
FACE_Y = 0.088               # outboard edge of the spokes

# tyre cross-section, normalised: (radial position 0 = bead .. 1 = tread surface, lateral -1..1 of the section width / 2)
TIRE_PROFILE = [
    (0.00, 0.86), (0.04, 0.90), (0.12, 0.97), (0.30, 1.03), (0.48, 1.05), (0.66, 1.03), (0.80, 0.98),
    (0.90, 0.93), (0.96, 0.86), (0.99, 0.78), (1.00, 0.68), (1.00, 0.50), (1.00, 0.25), (1.00, 0.0),
]
TIRE_GROOVES = [(-0.62, 0.065), (-0.22, 0.06), (0.22, 0.06), (0.62, 0.065)]  # lateral centre, width (fractions)


def lathe(name, profile_ry, steps=96, angle=2 * math.pi, mat=None, close=False, start=0.0):
    """Revolve a (radius, y) polyline around the Y axis."""
    bm = bmesh.new()
    verts = [bm.verts.new((r * math.cos(start), y, r * math.sin(start))) for r, y in profile_ry]
    edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    if close:
        edges.append(bm.edges.new((verts[-1], verts[0])))
    full = abs(angle - 2 * math.pi) < 1e-6
    res = bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 1, 0), angle=-angle, steps=steps, use_merge=full, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if mat is not None:
        me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    U.link(ob)
    return ob


def _bevel(ob, width=0.0015, segments=2, angle=35):
    m = ob.modifiers.new("Bevel", "BEVEL")
    m.width = width
    m.segments = segments
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(angle)
    m.harden_normals = False
    U.apply_modifiers(ob)


def _window_outline(t0, t1, r_in, r_out, half_w, twist=0.0, n=9, corner=0.35):
    """Opening between two spokes centred at angles t0 < t1 (radians), as (x, z) points.
    half_w(r): half width of a spoke at radius r. twist: extra angle at r_out (curved spokes)."""
    def ang(r, base, side):
        tw = twist * (r - r_in) / (r_out - r_in)
        return base + tw + side * half_w(r) / r
    rs = np.linspace(r_in, r_out, n)
    left = [(r, ang(r, t0, +1)) for r in rs]
    right = [(r, ang(r, t1, -1)) for r in rs[::-1]]
    pts = []
    # outer arc between the spokes (rounded corners are produced by the bevel)
    a_out0, a_out1 = left[-1][1], right[0][1]
    a_in0, a_in1 = right[-1][1], left[0][1]
    for r, a in left:
        pts.append((r, a))
    for a in np.linspace(a_out0, a_out1, 7)[1:-1]:
        pts.append((r_out, a))
    for r, a in right:
        pts.append((r, a))
    for a in np.linspace(a_in0, a_in1, 4)[1:-1]:
        pts.append((r_in, a))
    xy = [(r * math.cos(a), r * math.sin(a)) for r, a in pts]
    # round the corners: Chaikin smoothing on the closed polygon
    for _ in range(2):
        P = np.array(xy)
        Q = []
        for i in range(len(P)):
            a, b = P[i], P[(i + 1) % len(P)]
            Q.append(a * (1 - corner * 0.5) + b * corner * 0.5)
            Q.append(a * corner * 0.5 + b * (1 - corner * 0.5))
        xy = [tuple(q) for q in Q]
    return xy


def rim(name, mats, design):
    r_lip = RIM_R + 0.018
    # barrel (inner visible surface) with a lip curl, thickened
    barrel = lathe(name + "_barrel", [
        (RIM_R + 0.010, FACE_Y + 0.016), (RIM_R + 0.0185, FACE_Y + 0.010), (RIM_R + 0.016, FACE_Y + 0.003),
        (RIM_R + 0.004, FACE_Y - 0.004), (RIM_R - 0.010, FACE_Y - 0.012), (RIM_R - 0.016, 0.03),
        (RIM_R - 0.03, 0.0), (RIM_R - 0.032, -0.06), (RIM_R - 0.012, -0.095), (RIM_R + 0.004, -0.108),
    ], steps=72, mat=mats["rim_alloy"])
    m = barrel.modifiers.new("Solid", "SOLIDIFY")
    m.thickness = 0.006
    m.offset = -1
    U.apply_modifiers(barrel)
    U.shade_smooth(barrel)
    # wheel face: a dished disc (closed solid), then the openings between the spokes are cut out
    hub_y, face_r = 0.050, RIM_R - 0.004
    front = [(0.0, hub_y + 0.012), (0.03, hub_y + 0.012), (0.05, hub_y + 0.006), (0.075, hub_y + 0.004),
             (0.11, hub_y + 0.010), (0.15, hub_y + 0.022), (0.19, FACE_Y - 0.004), (face_r, FACE_Y + 0.002)]
    back = [(face_r, FACE_Y - 0.03), (0.17, hub_y - 0.002), (0.11, hub_y - 0.016), (0.06, hub_y - 0.024), (0.0, hub_y - 0.024)]
    disc = lathe(name, front + back, steps=96, mat=mats["rim_alloy"], close=True)
    U.recalc_normals(disc)
    spec = {
        "sport5": dict(n=5, r_in=0.078, r_out=face_r - 0.016, w=lambda r: 0.020 + 0.028 * (r - 0.078) / 0.12, twist=0.0),
        "turbine10": dict(n=10, r_in=0.08, r_out=face_r - 0.014, w=lambda r: 0.0085 + 0.010 * (r - 0.08) / 0.13, twist=0.42),
        "multi15": dict(n=15, r_in=0.09, r_out=face_r - 0.012, w=lambda r: 0.0055 + 0.0055 * (r - 0.09) / 0.12, twist=0.0),
    }[design]
    n = spec["n"]
    bm = bmesh.new()
    for k in range(n):
        t0 = 2 * math.pi * k / n + math.pi / 2
        t1 = t0 + 2 * math.pi / n
        ol = _window_outline(t0, t1, spec["r_in"], spec["r_out"], spec["w"], spec["twist"])
        lo = [bm.verts.new((x, -0.08, z)) for x, z in ol]
        hi = [bm.verts.new((x, 0.2, z)) for x, z in ol]
        bm.faces.new(lo[::-1])
        bm.faces.new(hi)
        for i in range(len(ol)):
            j = (i + 1) % len(ol)
            bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name + "_cut")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mats["rim_dark"])
    cut = U.link(bpy.data.objects.new(name + "_cut", me))
    U.boolean(disc, cut)
    bpy.data.objects.remove(cut)
    _bevel(disc, 0.0018, 2, 30)
    U.shade_smooth(disc)
    # lug bolts and centre cap
    parts = [barrel]
    for k in range(5):
        a = 2 * math.pi * k / 5 + math.pi / 2
        bolt = lathe(f"{name}_lug{k}", [(0.0, hub_y + 0.016), (0.0075, hub_y + 0.016), (0.0095, hub_y + 0.012), (0.0095, hub_y - 0.004)], steps=6, mat=mats["lug"])
        bolt.location = (0.056 * math.cos(a), 0, 0.056 * math.sin(a))
        parts.append(bolt)
    cap = lathe(name + "_cap", [(0.0, hub_y + 0.02), (0.022, hub_y + 0.019), (0.029, hub_y + 0.015), (0.03, hub_y + 0.008)], steps=48, mat=mats["rim_dark"])
    U.shade_smooth(cap)
    parts.append(cap)
    for p in parts:
        p.parent = disc
    disc["contract"] = "rim"
    disc["rim_design"] = design
    return disc


def brakes(mats, disc_r=0.182):
    """Ventilated, cross-drilled disc with a dark hat, and a fixed caliper (separate object; it does not rotate)."""
    inner = 0.095
    rotor = lathe("brake_disc", [(inner, 0.016), (disc_r, 0.016), (disc_r, -0.014), (inner, -0.014)], steps=96, mat=mats["brake_disc"], close=True)
    # cross-drilled holes
    bm = bmesh.new()
    for ring, cnt, off in ((0.130, 18, 0.0), (0.151, 18, 0.5), (0.171, 18, 0.0)):
        for k in range(cnt):
            a = 2 * math.pi * (k + off) / cnt
            cx, cz = ring * math.cos(a), ring * math.sin(a)
            res = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=10, radius1=0.0035, radius2=0.0035, depth=0.06)
            for v in res["verts"]:
                v.co = (v.co.x + cx, v.co.z, v.co.y + cz)
    me = bpy.data.meshes.new("holes")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mats["brake_hat"])
    holes = U.link(bpy.data.objects.new("holes", me))
    U.recalc_normals(holes)
    U.boolean(rotor, holes)
    bpy.data.objects.remove(holes)
    U.shade_smooth(rotor)
    hat = lathe("brake_hat", [(0.0, 0.03), (0.07, 0.03), (0.085, 0.024), (inner + 0.002, 0.012), (inner + 0.002, -0.01)], steps=64, mat=mats["brake_hat"])
    hat.parent = rotor
    # caliper: a bent block straddling the disc, at the rear-top of the disc
    prof = [(0.125, 0.040), (0.206, 0.040), (0.214, 0.020), (0.214, -0.042), (0.206, -0.05), (0.125, -0.05), (0.119, -0.03), (0.119, 0.03)]
    cal = lathe("caliper", prof, steps=24, angle=math.radians(68), mat=mats["caliper"], close=True, start=math.radians(102))
    U.recalc_normals(cal)
    _bevel(cal, 0.006, 3, 40)
    U.shade_smooth(cal)
    cal["contract"] = "caliper"
    rotor["contract"] = "brake_disc"
    return rotor, cal


def tire(name, mats, width=0.245, aspect=0.40, rim_r=RIM_R, steps=128):
    """Tyre from the shared profile: sidewalls, shoulders and a tread with four circumferential grooves."""
    side_h = width * aspect
    prof = []
    for t, l in TIRE_PROFILE:
        prof.append((rim_r + t * side_h, l * width / 2))
    # tread with grooves (lateral -1..1), across the top
    tread = []
    lat = np.linspace(0.68, -0.68, 69)
    for l in lat:
        depth = 0.0
        for c, w in TIRE_GROOVES:
            if abs(l - c) < w / 2:
                depth = 0.007
        tread.append((rim_r + side_h - depth, l * width / 2))
    right = [(r, -y) for r, y in reversed(prof)]
    left = prof[:-4]
    full = left + tread + [p for p in right[4:]]
    ob = lathe(name, full, steps=steps, mat=mats["rubber"])
    U.shade_smooth(ob)
    return ob
