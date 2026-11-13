"""Organise the scene into the asset contract and export GLB files for the game.

Node contract of sedan.lod*.glb (names are read by src/three/assets/adapter.ts):
    body/            always shown (paint_body, glass, lamps, trim, mirrors, handles, plate, ...)
    grille_ice/      combustion grille bars            grille_ev/   closed EV panel
    exhaust_single/  exhaust_dual/  exhaust_quad/      (none for EVs)
    aero_lip_spoiler/ aero_wing/ aero_splitter/ aero_skirts/
    interior/
    wheel_FL, wheel_FR, wheel_RL, wheel_RR             empties at the hub centres (wheel attachment points)
wheels.glb: rim_sport5, rim_turbine10, rim_multi15, brake_disc (+ hat), caliper — all at the origin, axis +Y.
"""
import json
import math
import os
import bpy
import design as D
import wheels as W
import bl_util as U
import materials as M


def group(name, objs, parent=None):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    if parent is not None:
        e.parent = parent
    for o in objs:
        if o.parent is None:
            o.parent = e
    return e


def tri_count(objs):
    n = 0
    for o in objs:
        if o.type == "MESH":
            n += sum(len(p.vertices) - 2 for p in o.data.polygons)
    return n


def _select_tree(roots):
    bpy.ops.object.select_all(action="DESELECT")
    stack = list(roots)
    while stack:
        o = stack.pop()
        o.hide_set(False)
        o.select_set(True)
        stack.extend(o.children)


def _export(path, roots, draco=True):
    _select_tree(roots)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_image_format="WEBP",
        export_image_quality=88,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
        export_draco_mesh_compression_enable=draco,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=15,
        export_draco_normal_quantization=12,
        export_draco_texcoord_quantization=14,
    )
    return os.path.getsize(path)


def decimate_copy(objs, ratio, suffix):
    """Linked-free copies of objects with a decimate modifier applied (LOD meshes)."""
    out = []
    for o in objs:
        c = o.copy()
        if o.type == "MESH":
            c.data = o.data.copy()
        c.name = o.name + suffix
        c.parent = None
        bpy.context.scene.collection.objects.link(c)
        if o.type == "MESH" and len(o.data.polygons) > 400:
            m = c.modifiers.new("Dec", "DECIMATE")
            m.ratio = ratio
            m.use_collapse_triangulate = True
            U.apply_modifiers(c)
        out.append(c)
    return out


INTERIOR_LOD = {
    1: ("seat", "dash", "floor", "door_", "steering", "headliner", "bulkhead", "parcel", "console", "cluster", "touch", "firewall", "tunnel"),
    2: ("seat_driver_cushion", "seat_driver_back", "seat_passenger_cushion", "seat_passenger_back", "seat_rear", "dash", "floor", "door_0", "door_1", "headliner", "steering_rim"),
}
DECIMATE = {1: {"body": 0.32, "interior": 0.45, "_": 0.5}, 2: {"body": 0.13, "interior": 0.3, "_": 0.3}}


def _joined(name, objs, lod):
    """Copies of the objects joined into one mesh (one draw per material), decimated for LOD > 0."""
    copies = []
    for o in objs:
        if o.type != "MESH":
            continue
        c = o.copy()
        c.data = o.data.copy()
        mw = o.matrix_world.copy()
        c.parent = None
        c.matrix_world = mw
        bpy.context.scene.collection.objects.link(c)
        copies.append(c)
    if not copies:
        return None
    bpy.ops.object.select_all(action="DESELECT")
    for c in copies:
        c.select_set(True)
    bpy.context.view_layer.objects.active = copies[0]
    if len(copies) > 1:
        bpy.ops.object.join()
    j = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    j.name = j.data.name = f"{name}_mesh"
    if lod > 0 and len(j.data.polygons) > 300:
        m = j.modifiers.new("Dec", "DECIMATE")
        m.ratio = DECIMATE[lod].get(name, DECIMATE[lod]["_"])
        m.use_collapse_triangulate = True
        U.apply_modifiers(j)
    return j


def _draws(objs):
    return sum(len({p.material_index for p in o.data.polygons}) for o in objs if o.type == "MESH")


def export_all(cats, rims, brake_parts, mats, out_dir, log):
    os.makedirs(out_dir, exist_ok=True)
    M.export_paint_setup(mats["paint_body"])
    for o in bpy.data.objects:
        o.hide_render = False
    info, sizes = {}, {}
    for lod in (0, 1, 2):
        made, roots = [], []
        for name, objs in cats.items():
            subset = objs
            if name == "interior" and lod > 0:
                subset = [o for o in objs if any(k in o.name for k in INTERIOR_LOD[lod])]
            j = _joined(name, subset, lod)
            if j is None:
                continue
            made.append(j)
            g = bpy.data.objects.new(name, None)
            bpy.context.scene.collection.objects.link(g)
            j.parent = g
            roots.append(g)
        for wname, x, track in (("wheel_FL", D.AX_F, D.TRACK_F), ("wheel_FR", D.AX_F, -D.TRACK_F), ("wheel_RL", D.AX_R, D.TRACK_R), ("wheel_RR", D.AX_R, -D.TRACK_R)):
            e = bpy.data.objects.new(wname, None)
            e.location = (x, track / 2, D.TIRE_R)
            bpy.context.scene.collection.objects.link(e)
            roots.append(e)
        bad = [r.name for r in roots if "." in r.name]
        assert not bad, f"contract names already taken: {bad}"
        fn = f"sedan.lod{lod}.glb"
        info[f"lod{lod}"] = {"tris": tri_count(made), "draws": _draws(made), "meshes": len(made)}
        sizes[fn] = _export(os.path.join(out_dir, fn), roots)
        for o in made + roots:
            bpy.data.objects.remove(o)
    # ---------------------------------------------------------------- wheels: each rim, the disc and the caliper joined
    wroots = []
    for r in list(rims) + list(brake_parts):
        parts = [r] + list(r.children_recursive)
        j = _joined(r.name + "_tmp", parts, 0)
        g = bpy.data.objects.new(r.name + "_tmpgrp", None)
        bpy.context.scene.collection.objects.link(g)
        j.parent = g
        wroots.append((r, g, j))
    for r, g, j in wroots:
        r.name = r.name + "_src"
    for r, g, j in wroots:
        g.name = r.name.replace("_src", "")
        j.name = g.name + "_mesh"
    info["wheels"] = {g.name: {"tris": tri_count([j]), "draws": _draws([j])} for r, g, j in wroots}
    sizes["wheels.glb"] = _export(os.path.join(out_dir, "wheels.glb"), [g for r, g, j in wroots])
    for r, g, j in wroots:
        bpy.data.objects.remove(j)
        bpy.data.objects.remove(g)
        r.name = r.name.replace("_src", "")
    # ---------------------------------------------------------------- tyre profile for the browser
    with open(os.path.join(out_dir, "tire_profile.json"), "w") as f:
        json.dump({"profile": W.TIRE_PROFILE, "grooves": W.TIRE_GROOVES, "grooveDepth": 0.007}, f, indent=1)
    info["sizes"] = sizes
    log("export", json.dumps(info))
    with open(os.path.join(out_dir, "..", "..", "..", "..", "assets-src", "sedan-ref", "export-report.json"), "w") as f:
        json.dump(info, f, indent=1)
    return info
