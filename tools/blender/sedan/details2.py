"""Second-pass details (Phase 4B): real shut-line grooves, rolled arch flanges, lamp internals, window seals,
mirror indicators. Everything is built from the actual surfaces (ray casts), so it stays correct when the
body changes.
"""
import math
import bpy
import bmesh
import numpy as np
from mathutils import Vector
import design as D
import bl_util as U
import seams as SM
from details import bvh, hit_x, hit_y, tube, resample, offset_outline, rounded_box, chaikin, full_outline


def _densify(pts, step):
    P = np.array(pts, float)
    out = [P[0]]
    for a, b in zip(P[:-1], P[1:]):
        n = max(1, int(np.linalg.norm(b - a) / step))
        for t in np.linspace(0, 1, n + 1)[1:]:
            out.append(a + (b - a) * t)
    return np.array(out)


def _project(tree, proj, a, b):
    if proj == "xz":
        loc, nor, _, _ = tree.ray_cast(Vector((a, 2.0, b)), Vector((0, -1, 0)))
    elif proj == "xy":
        loc, nor, _, _ = tree.ray_cast(Vector((a, b, 2.5)), Vector((0, 0, -1)))
    else:
        loc, nor, _, _ = tree.ray_cast(Vector((-3.5, a, b)), Vector((1, 0, 0)))
    return (np.array(loc), np.array(nor)) if loc is not None else (None, None)


def _ribbon(bm, P, N, width, out, depth):
    """A closed thin solid along the surface curve P (normals N): the shape removed to make a panel gap."""
    rings = []
    for i in range(len(P)):
        t = P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]
        t /= np.linalg.norm(t) + 1e-12
        n = N[i] / (np.linalg.norm(N[i]) + 1e-12)
        b = np.cross(n, t)
        b /= np.linalg.norm(b) + 1e-12
        c = [P[i] + b * width / 2 + n * out, P[i] - b * width / 2 + n * out, P[i] - b * width / 2 - n * depth, P[i] + b * width / 2 - n * depth]
        # extend the ends a little so grooves meet cleanly
        if i == 0:
            c = [q - t * 0.002 for q in c]
        if i == len(P) - 1:
            c = [q + t * 0.002 for q in c]
        rings.append([bm.verts.new(tuple(q)) for q in c])
    for r0, r1 in zip(rings[:-1], rings[1:]):
        for k in range(4):
            j = (k + 1) % 4
            bm.faces.new((r0[k], r0[j], r1[j], r1[k]))
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])


def shut_lines(body, mats, width=0.0042, depth=0.0065):
    """Cut the panel gaps (doors, hood, boot lid, bumper joints) into the skin as real grooves."""
    tree = bvh(body)
    bm = bmesh.new()
    n_ribbons = 0
    for proj, facing, pts in SM.SEAMS:
        P2 = _densify(pts, 0.008)
        for sign in (1, -1):
            Ps, Ns = [], []
            for a, b in P2:
                if proj == "xz":
                    loc, nor = _project(tree, proj, a, b)
                    if loc is not None and sign < 0:
                        loc, nor = loc * np.array([1, -1, 1]), nor * np.array([1, -1, 1])
                else:
                    loc, nor = _project(tree, proj, a, sign * b)
                if loc is None:
                    continue
                Ps.append(loc)
                Ns.append(nor)
            if len(Ps) > 3:
                _ribbon(bm, np.array(Ps), np.array(Ns), width, 0.012, depth)
                n_ribbons += 1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("shutline_cutter")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mats["panel_gap"])
    cut = U.link(bpy.data.objects.new("shutline_cutter", me))
    U.boolean(body, cut, self_intersect=True)
    bpy.data.objects.remove(cut)
    return n_ribbons


def arch_flanges(body, mats):
    """Rolled lip and the visible return flange inside each wheel arch (pressed-steel look, real thickness)."""
    tree = bvh(body)
    parts = []
    for ax in (D.AX_F, D.AX_R):
        for side in (1, -1):
            lip, ring_o, ring_i = [], [], []
            for a in np.linspace(math.radians(-6), math.radians(186), 80):
                R = D.ARCH_R + 0.004
                x = ax + R * math.cos(a)
                z = D.TIRE_R + R * math.sin(a)
                if z < 0.21:
                    continue
                y, _ = hit_y(tree, x, z)
                if y is None or y < 0.78:
                    continue
                lip.append((x, side * (y - 0.003), z))
                ring_o.append((x, side * (y - 0.006), z))
                ring_i.append((x, side * (y - 0.045), z))
            if len(lip) < 6:
                continue
            tag = f"{'F' if ax > 0 else 'R'}{'L' if side > 0 else 'R'}"
            parts.append(tube(f"arch_lip_{tag}", lip, 0.006, mats["paint"]))
            bm = bmesh.new()
            vo = [bm.verts.new(p) for p in ring_o]
            vi = [bm.verts.new(p) for p in ring_i]
            for k in range(len(vo) - 1):
                bm.faces.new((vo[k], vo[k + 1], vi[k + 1], vi[k]))
            me = bpy.data.meshes.new(f"arch_flange_{tag}")
            bm.to_mesh(me)
            bm.free()
            me.materials.append(mats["paint"])
            fl = U.link(bpy.data.objects.new(me.name, me))
            # faces must look towards the wheel centre
            c = Vector((ax, 0, D.TIRE_R))
            for p in fl.data.polygons:
                if p.normal.dot(c - p.center * Vector((1, 0, 1))) < 0:
                    p.flip()
            U.shade_smooth(fl)
            parts.append(fl)
    return parts


def _lamp_line(half):
    """Centre line of a lamp outline: for each y, the middle of its z extent."""
    P = np.array(half)
    ys = np.linspace(P[:, 0].min() + 0.02, P[:, 0].max() - 0.02, 12)
    out = []
    for y in ys:
        zs = []
        for (y0, z0), (y1, z1) in zip(P, np.roll(P, -1, axis=0)):
            if (y0 - y) * (y1 - y) <= 0 and y0 != y1:
                zs.append(z0 + (z1 - z0) * (y - y0) / (y1 - y0))
        if len(zs) >= 2:
            out.append((y, (min(zs) + max(zs)) / 2, max(zs) - min(zs)))
    return out


def headlamp_internals(lens, mats):
    """Three projector modules with chrome reflector cups and black bezels, an upper LED light guide,
    an amber indicator strip, all set behind the clear lens."""
    tree = bvh(lens)
    parts = []
    line = _lamp_line(D.HEADLAMP)
    for side in (1, -1):
        for k, yy in enumerate((0.55, 0.66, 0.77)):
            zz = float(np.interp(yy, [p[0] for p in line], [p[1] for p in line]))
            x, _ = hit_x(tree, side * yy, zz, True)
            if x is None:
                continue
            bm = bmesh.new()
            bmesh.ops.create_cone(bm, cap_ends=False, segments=28, radius1=0.022, radius2=0.012, depth=0.035)
            me = bpy.data.meshes.new(f"projector_cup_{side}_{k}")
            bm.to_mesh(me)
            bm.free()
            me.materials.append(mats["lamp_housing"])
            cup = U.link(bpy.data.objects.new(me.name, me))
            cup.rotation_euler = (0, math.pi / 2, 0)
            cup.location = (x - 0.045, side * yy, zz)
            U.shade_smooth(cup)
            parts.append(cup)
            bpy.ops.mesh.primitive_torus_add(major_radius=0.023, minor_radius=0.0035, major_segments=32, minor_segments=8, location=(x - 0.028, side * yy, zz), rotation=(0, math.pi / 2, 0))
            ring = bpy.context.active_object
            ring.name = f"projector_bezel_{side}_{k}"
            ring.data.materials.append(mats["lamp_bezel"])
            U.shade_smooth(ring)
            parts.append(ring)
            bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.019, location=(x - 0.03, side * yy, zz))
            ln = bpy.context.active_object
            ln.name = f"projector_lens_{side}_{k}"
            ln.scale = (0.5, 1, 1)
            ln.data.materials.append(mats["lamp_lens_inner"])
            U.shade_smooth(ln)
            parts.append(ln)
        # upper light guide following the top edge
        top = []
        for y, zc, h in line:
            z = zc + h * 0.32
            x, _ = hit_x(tree, side * y, z, True)
            if x is not None:
                top.append((x - 0.012, side * y, z))
        if len(top) > 3:
            parts.append(tube(f"headlamp_drl_upper_{side}", top, 0.0028, mats["lamp_led"]))
        # amber indicator along the inner lower edge
        ind = []
        for y, zc, h in line[:5]:
            z = zc - h * 0.3
            x, _ = hit_x(tree, side * y, z, True)
            if x is not None:
                ind.append((x - 0.014, side * y, z))
        if len(ind) > 2:
            parts.append(tube(f"headlamp_indicator_{side}", ind, 0.0035, mats["lamp_amber"]))
    return parts


def taillamp_internals(lens, mats):
    """Three stacked LED light bars inside each tail lamp (the 3D signature seen through the red lens)."""
    tree = bvh(lens)
    parts = []
    line = _lamp_line(D.TAILLAMP)
    for side in (1, -1):
        for k, f in enumerate((0.28, 0.0, -0.28)):
            pts = []
            for y, zc, h in line:
                z = zc + f * h
                x, _ = hit_x(tree, side * y, z, False)
                if x is not None:
                    pts.append((x + 0.012, side * y, z))
            if len(pts) > 3:
                parts.append(tube(f"taillamp_bar_{side}_{k}", pts, 0.0032, mats["lamp_led_red"]))
    return parts


def window_seals(glass, mats):
    """Black rubber seals around every pane (the boundary loops of the glass)."""
    bm = bmesh.new()
    bm.from_mesh(glass.data)
    bm.normal_update()
    edges = {e for e in bm.edges if e.is_boundary}
    parts = []
    k = 0
    while edges:
        e = edges.pop()
        loop = [e.verts[0], e.verts[1]]
        while True:
            last = loop[-1]
            nxt = [x for x in last.link_edges if x in edges]
            if not nxt:
                break
            e2 = nxt[0]
            edges.discard(e2)
            v = e2.other_vert(last)
            if v is loop[0]:
                break
            loop.append(v)
        if len(loop) < 8:
            continue
        pts = [tuple(v.co + v.normal * 0.0015) for v in loop]
        P = resample([(p[0], p[2]) for p in pts], len(pts))  # keep order; resample only used for spacing check
        del P
        parts.append(tube(f"window_seal_{k}", pts, 0.0032, mats["rubber_seal"], closed=True))
        k += 1
    bm.free()
    return parts


def mirror_indicators(mats):
    """Amber LED repeaters along the lower outer edge of each mirror housing."""
    parts = []
    for o in bpy.data.objects:
        if not o.name.startswith("mirror_housing_"):
            continue
        side = 1 if o.name.endswith("L") else -1
        c = o.location
        pts = []
        for a in np.linspace(math.radians(25), math.radians(85), 10):
            pts.append((c.x - 0.004 + 0.07 * math.cos(a) * 0.35, c.y + side * 0.125 * math.sin(a), c.z - 0.028))
        parts.append(tube(f"mirror_indicator_{'L' if side > 0 else 'R'}", pts, 0.004, mats["lamp_amber"]))
    return parts
