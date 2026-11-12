"""Exterior details: lamps, grille and intakes (cut into the body), mirrors, handles, cowl, wipers, exhausts, aero parts.

Openings are made with boolean prisms on the closed body skin: the difference leaves a pocket whose walls take the
cutter's material (lamp housings, grille interiors), and the intersection with the same prism gives a lens that fits
the opening exactly.
"""
import math
import bpy
import bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import design as D
import bl_util as U


def bvh(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    return BVHTree.FromObject(ob, dg)


def hit_x(tree, y, z, front=True, x0=None):
    """x of the body surface hit by a ray along -x (front) or +x (rear) at (y, z)."""
    o = Vector((x0 if x0 is not None else (3.5 if front else -3.5), y, z))
    d = Vector((-1, 0, 0)) if front else Vector((1, 0, 0))
    loc, nor, idx, dist = tree.ray_cast(o, d)
    return (loc.x, nor) if loc is not None else (None, None)


def hit_y(tree, x, z):
    loc, nor, idx, dist = tree.ray_cast(Vector((x, 2.0, z)), Vector((0, -1, 0)))
    return (loc.y, nor) if loc is not None else (None, None)


def full_outline(half):
    """Symmetric outline from its y >= 0 half (points from the centre line round to the centre line)."""
    right = [(-y, z) for y, z in reversed(half) if y > 1e-6]
    return list(half) + right


def _strip_cutter_faces(ob, cutter_mat):
    idx = [i for i, m in enumerate(ob.data.materials) if m and m.name == cutter_mat]
    U.delete_faces(ob, lambda f, uv: f.material_index in idx)


def opening(body, name, outline, x_lo, x_hi, mats, wall_mat, lens_mat=None, mirror=True):
    """Cut an opening through the skin. Returns the lens / insert patch (or None)."""
    cutter = U.link(U.prism(name + "_cut", outline, "x", x_lo, x_hi, mirror=mirror, mat=mats[wall_mat]))
    lens = None
    if lens_mat:
        lens = body.copy()
        lens.data = body.data.copy()
        lens.name = name
        lens.data.name = name
        U.link(lens)
        lens.modifiers.clear()
        U.boolean(lens, cutter, "INTERSECT")
        _strip_cutter_faces(lens, wall_mat)
        lens.data.materials.clear()
        lens.data.materials.append(mats[lens_mat])
        for p in lens.data.polygons:
            p.material_index = 0
    U.boolean(body, cutter)
    bpy.data.objects.remove(cutter)
    return lens


def tube(name, pts, radius, mat, closed=False, res=6):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 2
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, q in zip(sp.points, pts):
        p.co = (*q, 1)
    sp.use_cyclic_u = closed
    ob = U.link(bpy.data.objects.new(name, cu))
    ob.data.materials.append(mat)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.active_object
    U.shade_smooth(ob)
    return ob


def rounded_box(name, size, loc, mat, bevel=0.01, segs=3, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    m = ob.modifiers.new("Bevel", "BEVEL")
    m.width = bevel
    m.segments = segs
    U.apply_modifiers(ob)
    ob.data.materials.append(mat)
    U.shade_smooth(ob)
    return ob


def resample(poly, n):
    P = np.array(poly + [poly[0]], float)
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    L = np.concatenate([[0], np.cumsum(seg)])
    t = np.linspace(0, L[-1], n, endpoint=False)
    return np.stack([np.interp(t, L, P[:, 0]), np.interp(t, L, P[:, 1])], 1)


def offset_outline(poly, d):
    """Shrink (d < 0) or grow a closed 2D outline by moving points along the averaged normal."""
    P = np.array(poly, float)
    c = P.mean(0)
    out = []
    for i in range(len(P)):
        a, b = P[i - 1], P[(i + 1) % len(P)]
        t = b - a
        n = np.array([t[1], -t[0]])
        n /= np.linalg.norm(n) + 1e-12
        if np.dot(n, P[i] - c) < 0:
            n = -n
        out.append(P[i] + n * d)
    return out


# --------------------------------------------------------------------------------------------- lamps
def lamp(body, mats, front=True):
    tag = "head" if front else "tail"
    half = D.HEADLAMP if front else D.TAILLAMP
    x_lo, x_hi = (1.98, 2.7) if front else (-2.75, -2.04)
    lens = opening(body, f"{tag}lamp_lens", half, x_lo, x_hi, mats, "lamp_housing", "lamp_lens" if front else "lamp_lens_red")
    parts = [lens]
    tree = bvh(lens)
    # back plate and LED light guide, per side
    for side in (1, -1):
        ol = resample(offset_outline(half, -0.006), 60)
        pts = []
        for y, z in ol:
            x, _ = hit_x(tree, side * y, z, front)
            if x is not None:
                pts.append((x, side * y, z))
        if len(pts) < 10:
            continue
        P = np.array(pts)
        back = 0.055 if front else 0.035
        # back plate: a fan from the outline centre, set back behind the lens
        bm = bmesh.new()
        cen = P.mean(0)
        cen[0] += -back if front else back
        vc = bm.verts.new(cen)
        vs = [bm.verts.new((p[0] + (-back if front else back), p[1], p[2])) for p in P]
        for i in range(len(vs)):
            bm.faces.new((vc, vs[i], vs[(i + 1) % len(vs)]))
        me = bpy.data.meshes.new(f"{tag}lamp_back_{side}")
        bm.to_mesh(me)
        bm.free()
        me.materials.append(mats["lamp_housing"])
        bp = U.link(bpy.data.objects.new(me.name, me))
        U.recalc_normals(bp)
        parts.append(bp)
        # LED signature: the lower / outer edge of the lamp as a light guide
        ol2 = resample(offset_outline(half, -0.012), 80)
        led = []
        for y, z in ol2:
            if front and z > np.mean([q[1] for q in half]) + 0.006:
                continue
            if not front and z < np.mean([q[1] for q in half]) - 0.004:
                continue
            x, _ = hit_x(tree, side * y, z, front)
            if x is not None:
                led.append((x + (-0.012 if front else 0.010), side * y, z))
        if len(led) > 4:
            led.sort(key=lambda p: abs(p[1]))
            parts.append(tube(f"{tag}lamp_led_{side}", led, 0.0045 if front else 0.006, mats["lamp_led" if front else "lamp_led_red"]))
        if front:
            # two projector modules
            for k, yy in enumerate((0.56, 0.70)):
                zz = 0.704
                x, _ = hit_x(tree, side * yy, zz, True)
                if x is None:
                    continue
                pj = bpy.data.objects.new(f"projector_{side}_{k}", bpy.data.meshes.new(f"projector_{side}_{k}"))
                bm = bmesh.new()
                bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=0.026, radius2=0.03, depth=0.05)
                bm.to_mesh(pj.data)
                bm.free()
                pj.data.materials.append(mats["lamp_housing"])
                U.link(pj)
                pj.rotation_euler = (0, math.pi / 2, 0)
                pj.location = (x - 0.05, side * yy, zz)
                parts.append(pj)
                bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.022, location=(x - 0.026, side * yy, zz))
                ln = bpy.context.active_object
                ln.name = f"projector_lens_{side}_{k}"
                ln.scale = (0.45, 1, 1)
                ln.data.materials.append(mats["lamp_lens_inner"])
                U.shade_smooth(ln)
                parts.append(ln)
    return parts


def rear_lightbar(body, mats):
    """A thin full-width light bar across the trunk lid between the tail lamps."""
    half = [(0.0, 0.982), (0.25, 0.982), (0.25, 0.994), (0.0, 0.994)]
    ol = full_outline(half)
    lens = opening(body, "lightbar_lens", ol, -2.75, -2.2, mats, "lamp_housing", "lamp_lens_red", mirror=False)
    tree = bvh(lens)
    led = []
    for y in np.linspace(-0.24, 0.24, 40):
        x, _ = hit_x(tree, y, 0.988, False)
        if x is not None:
            led.append((x + 0.008, y, 0.988))
    parts = [lens]
    if len(led) > 4:
        parts.append(tube("lightbar_led", led, 0.0035, mats["lamp_led_red"]))
    return parts


# -------------------------------------------------------------------------------------- grille, intakes
def grille(body, mats):
    """Opening with ICE bars (grille_ice) and a closed EV panel (grille_ev); the game shows one of them."""
    ol = full_outline(D.GRILLE)
    panel = opening(body, "grille_ev_panel", ol, 2.05, 2.7, mats, "grille_mesh", "trim_black", mirror=False)
    tree = bvh(panel)
    # push the EV panel back slightly so it reads as an insert
    panel.location.x -= 0.004
    ice = []
    zs = np.arange(0.425, 0.64, 0.022)
    for k, z in enumerate(zs):
        pts = []
        for y in np.linspace(-0.46, 0.46, 60):
            if not _inside(ol, y, z, -0.012):
                continue
            x, _ = hit_x(tree, y, z, True)
            if x is not None:
                pts.append((x - 0.022, y, z))
        if len(pts) > 3:
            ice.append(tube(f"grille_bar_{k}", pts, 0.0042, mats["trim_chrome"]))
    # mesh backing and surround
    back = []
    for y, z in resample(ol, 120):
        x, _ = hit_x(tree, y, z, True)
        if x is not None:
            back.append((x - 0.004, y, z))
    sur = tube("grille_surround", back, 0.006, mats["trim_chrome"], closed=True)
    return panel, ice, sur


def _inside(poly, y, z, margin=0.0):
    P = np.array(poly)
    inside = False
    j = len(P) - 1
    for i in range(len(P)):
        yi, zi = P[i]
        yj, zj = P[j]
        if (zi > z) != (zj > z) and y < (yj - yi) * (z - zi) / (zj - zi + 1e-12) + yi:
            inside = not inside
        j = i
    if not inside:
        return False
    if margin:
        d = min(np.hypot(P[:, 0] - y, P[:, 1] - z))
        return d > -margin
    return True


def intakes(body, mats):
    lower = opening(body, "intake_lower", full_outline(D.LOWER_INTAKE), 2.0, 2.7, mats, "grille_mesh", None, mirror=False)
    # vertical corner intakes (air curtains)
    curtain = [(0.70, 0.31), (0.78, 0.30), (0.80, 0.33), (0.79, 0.50), (0.74, 0.52), (0.70, 0.49)]
    opening(body, "intake_corner", curtain, 2.0, 2.7, mats, "grille_mesh", None, mirror=True)
    # splitter lip under the bumper (gloss black)
    tree = bvh(body)
    pts = []
    for y in np.linspace(-0.66, 0.66, 40):
        x, _ = hit_x(tree, y, 0.235, True)
        if x is not None:
            pts.append((x + 0.004, y, 0.226))
    return [tube("front_lip", pts, 0.010, mats["trim_black"])]


def rear_diffuser(body, mats):
    half = [(0.0, 0.29), (0.72, 0.29), (0.76, 0.33), (0.74, 0.40), (0.0, 0.40)]
    opening(body, "diffuser_cut", full_outline(half), -2.75, -2.25, mats, "plastic_black", None, mirror=False)
    tree = bvh(body)
    parts = []
    # fins
    for y in (-0.36, -0.18, 0.0, 0.18, 0.36):
        x, _ = hit_x(tree, y, 0.30, False, x0=-3.0)
        x = x if x is not None else -2.42
        parts.append(rounded_box(f"diffuser_fin_{y:+.2f}", (0.22, 0.008, 0.08), (x + 0.12, y, 0.33), mats["plastic_black"], 0.003, 2))
    return parts


def exhausts(mats, layout):
    """Exhaust tips for a layout: 'single', 'dual', 'quad'. Positioned in the diffuser opening."""
    ys = {"single": [0.56], "dual": [0.56, -0.56], "quad": [0.62, 0.49, -0.49, -0.62]}[layout]
    parts = []
    for i, y in enumerate(ys):
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.038, depth=0.12, location=(-2.43, y, 0.345), rotation=(0, math.pi / 2, 0))
        t = bpy.context.active_object
        t.name = f"exhaust_{layout}_{i}"
        t.scale = (1, 1.35 if layout != "quad" else 1.0, 0.72)
        sol = t.modifiers.new("S", "SOLIDIFY")
        sol.thickness = 0.003
        bm = bmesh.new()
        bm.from_mesh(t.data)
        caps = [f for f in bm.faces if abs(f.normal.x) > 0.9]
        bmesh.ops.delete(bm, geom=caps, context="FACES")
        bm.to_mesh(t.data)
        bm.free()
        t.data.materials.append(mats["exhaust"])
        U.apply_modifiers(t)
        U.shade_smooth(t)
        parts.append(t)
    return parts


# ----------------------------------------------------------------------------------- mirrors, handles
def mirrors(body, mats):
    parts = []
    tree = bvh(body)
    for side in (1, -1):
        yb, _ = hit_y(tree, 0.62, 1.0) if side > 0 else (None, None)
        y0 = 0.885
        bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=20, radius=1, location=(0.74, side * (y0 + 0.15), 1.045))
        h = bpy.context.active_object
        h.name = f"mirror_housing_{'L' if side > 0 else 'R'}"
        h.scale = (0.095, 0.135, 0.07)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        bm = bmesh.new()
        bm.from_mesh(h.data)
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(-0.022, 0, 0), plane_no=(1, 0, 0), clear_inner=True)
        edges = [e for e in bm.edges if e.is_boundary]
        bmesh.ops.edgeloop_fill(bm, edges=edges)
        # flatten the outboard tip slightly, sweep the top back
        for v in bm.verts:
            v.co.x -= 0.022 * max(0.0, v.co.z / 0.07)
            v.co.y += (0.02 if side > 0 else -0.02) * max(0.0, v.co.z / 0.07) * 0
        bm.to_mesh(h.data)
        bm.free()
        h.data.materials.append(mats["paint"])
        h.data.materials.append(mats["mirror_glass"])
        for p in h.data.polygons:
            if p.normal.x < -0.95:
                p.material_index = 1
        U.shade_smooth(h)
        parts.append(h)
        arm = rounded_box(f"mirror_arm_{'L' if side > 0 else 'R'}", (0.08, 0.12, 0.04), (0.75, side * (y0 + 0.04), 1.005), mats["trim_black"], 0.012, 3)
        parts.append(arm)
    return parts


def handles(body, mats):
    parts = []
    tree = bvh(body)
    for side in (1, -1):
        for k, x in enumerate((0.22, -0.88)):
            z = float(D._crease_z(x)) - 0.055
            y, nor = hit_y(tree, x, z)
            if y is None:
                continue
            h = rounded_box(f"door_handle_{'L' if side > 0 else 'R'}{k}", (0.19, 0.016, 0.026), (x, side * (y + 0.004), z), mats["trim_chrome"], 0.007, 3)
            parts.append(h)
            rec = rounded_box(f"door_handle_recess_{'L' if side > 0 else 'R'}{k}", (0.21, 0.004, 0.044), (x, side * (y - 0.0005), z - 0.004), mats["trim_black"], 0.0019, 2)
            parts.append(rec)
    return parts


def cowl_and_wipers(mats):
    parts = []
    bm = bmesh.new()
    ny, nx = 40, 6
    grid = []
    for i in range(nx):
        x = D.X_COWL + 0.13 * i / (nx - 1) - 0.02
        row = []
        for j in range(ny):
            y = -0.80 + 1.6 * j / (ny - 1)
            z = float(D.top_height(max(x, D.X_COWL), y)) + 0.004 + 0.012 * (1 - i / (nx - 1))
            row.append(bm.verts.new((x, y, z)))
        grid.append(row)
    for i in range(nx - 1):
        for j in range(ny - 1):
            bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
    me = bpy.data.meshes.new("cowl")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mats["plastic_black"])
    cowl = U.link(bpy.data.objects.new("cowl", me))
    U.recalc_normals(cowl)
    top = max(cowl.data.polygons, key=lambda p: p.center.z)
    if top.normal.z < 0:
        for p in cowl.data.polygons:
            p.flip()
    U.shade_smooth(cowl)
    parts.append(cowl)
    # wiper arms resting on the windscreen base
    for k, (y0, y1) in enumerate(((0.05, 0.62), (-0.55, 0.02))):
        pts = []
        for t in np.linspace(0, 1, 12):
            y = y0 + (y1 - y0) * t
            x = D.X_COWL - 0.035 - 0.06 * t
            z = float(D.gh_top(x)) + 0.012
            pts.append((x, y, z))
        parts.append(tube(f"wiper_{k}", pts, 0.006, mats["plastic_black"]))
    return parts


def antenna(mats):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1, location=(-1.0, 0, float(D.gh_top(-1.0)) - 0.005))
    a = bpy.context.active_object
    a.name = "antenna_fin"
    a.scale = (0.08, 0.025, 0.045)
    a.data.materials.append(mats["paint"])
    U.shade_smooth(a)
    return a


# ------------------------------------------------------------------------------------------ aero kit
def aero(mats):
    """Optional aerodynamic parts (hidden unless the car's aero settings call for them)."""
    parts = {}
    # trunk lip spoiler
    pts = []
    for y in np.linspace(-0.74, 0.74, 30):
        x = -2.43 + 0.02 * (y / 0.74) ** 2
        z = float(D.top_height(-2.4, y)) + 0.012
        pts.append((x, y, z))
    lip = tube("aero_lip_spoiler_mesh", pts, 0.012, mats["paint"])
    lip.scale = (1.6, 1, 0.8)
    parts["aero_lip_spoiler"] = [lip]
    # pedestal wing
    wing = rounded_box("aero_wing_blade", (0.24, 1.42, 0.022), (-2.34, 0, 1.20), mats["trim_black"], 0.008, 3, rot=(0, math.radians(-8), 0))
    posts = [rounded_box(f"aero_wing_post_{s}", (0.10, 0.02, 0.16), (-2.30, s * 0.5, 1.115), mats["trim_black"], 0.006, 2) for s in (1, -1)]
    plates = [rounded_box(f"aero_wing_plate_{s}", (0.28, 0.006, 0.12), (-2.34, s * 0.715, 1.21), mats["trim_black"], 0.003, 2) for s in (1, -1)]
    parts["aero_wing"] = [wing] + posts + plates
    # front splitter
    sp = rounded_box("aero_splitter_blade", (0.16, 1.62, 0.014), (2.33, 0, 0.205), mats["trim_black"], 0.005, 2)
    parts["aero_splitter"] = [sp]
    # side skirts
    skirts = [rounded_box(f"aero_skirt_{s}", (2.0, 0.035, 0.05), (0.0, s * 0.905, 0.205), mats["trim_black"], 0.012, 3) for s in (1, -1)]
    parts["aero_skirts"] = skirts
    return parts


def rear_plate(body, mats):
    """A blank registration plate on the rear bumper (no text, no real-world format)."""
    tree = bvh(body)
    xr, _ = hit_x(tree, 0.0, 0.67, False)
    xr = xr if xr is not None else -2.49
    rec = rounded_box("plate_recess", (0.01, 0.56, 0.135), (xr + 0.004, 0, 0.67), mats["trim_black"], 0.004, 2)
    plate = rounded_box("plate_rear", (0.006, 0.52, 0.112), (xr - 0.002, 0, 0.67), mats["plate"], 0.004, 2)
    return [rec, plate]


def arch_lips(body, mats):
    """Rolled lip along each wheel-arch edge (a fine paint highlight, as on pressed steel wings)."""
    tree = bvh(body)
    parts = []
    for ax in (D.AX_F, D.AX_R):
        for side in (1, -1):
            pts = []
            for a in np.linspace(math.radians(-8), math.radians(188), 70):
                x = ax + (D.ARCH_R + 0.003) * math.cos(a)
                z = D.TIRE_R + (D.ARCH_R + 0.003) * math.sin(a)
                if z < 0.22:
                    continue
                y, _ = hit_y(tree, x, z)
                if y is None or y < 0.8:
                    continue
                pts.append((x, side * (y - 0.002), z))
            if len(pts) > 5:
                parts.append(tube(f"arch_lip_{'F' if ax > 0 else 'R'}{'L' if side > 0 else 'R'}", pts, 0.0065, mats["paint"]))
    return parts
