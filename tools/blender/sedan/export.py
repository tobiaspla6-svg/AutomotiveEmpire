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


def export_all(cats, rims, brake_parts, mats, out_dir, log):
    os.makedirs(out_dir, exist_ok=True)
    M.export_paint_setup(mats["paint_body"])
    for o in bpy.data.objects:
        o.hide_render = False
    # ---------------------------------------------------------------- LOD 0
    roots = []
    for name, objs in cats.items():
        roots.append(group(name, objs))
    for name, x, track in (("wheel_FL", D.AX_F, D.TRACK_F), ("wheel_FR", D.AX_F, -D.TRACK_F), ("wheel_RL", D.AX_R, D.TRACK_R), ("wheel_RR", D.AX_R, -D.TRACK_R)):
        e = bpy.data.objects.new(name, None)
        e.location = (x, track / 2, D.TIRE_R)
        bpy.context.scene.collection.objects.link(e)
        roots.append(e)
    info = {"lod0_tris": tri_count([o for objs in cats.values() for o in objs])}
    # hide wheel instances while exporting
    sizes = {"sedan.lod0.glb": _export(os.path.join(out_dir, "sedan.lod0.glb"), roots)}
    # ---------------------------------------------------------------- LOD 1: decimated shell, simplified interior
    lod_cats = {}
    for name, objs in cats.items():
        meshes = [o for o in objs if o.type == "MESH"]
        if name == "interior":
            meshes = [o for o in meshes if any(k in o.name for k in ("seat", "dash", "floor", "door_", "steering_rim", "headliner", "bulkhead", "parcel"))]
        lod_cats[name] = decimate_copy(meshes, 0.3, ".lod1")
    lroots = [group(n, objs) for n, objs in lod_cats.items()]
    # the LOD0 groups still hold the contract names: move them aside, then name the LOD1 groups
    wheel_empties = [o for o in roots if o.name.startswith("wheel_")]
    for o in roots:
        o.name = o.name + "_lod0"
    for r, n in zip(lroots, lod_cats.keys()):
        r.name = n
    wl = []
    for e in wheel_empties:
        c = bpy.data.objects.new(e.name.replace("_lod0", ""), None)
        c.location = e.location
        bpy.context.scene.collection.objects.link(c)
        wl.append(c)
    info["lod1_tris"] = tri_count([o for objs in lod_cats.values() for o in objs])
    sizes["sedan.lod1.glb"] = _export(os.path.join(out_dir, "sedan.lod1.glb"), lroots + wl)
    for o in roots:
        o.name = o.name.replace("_lod0", "")
    # ---------------------------------------------------------------- wheels
    sizes["wheels.glb"] = _export(os.path.join(out_dir, "wheels.glb"), list(rims) + list(brake_parts))
    info["wheel_tris"] = {r.name: tri_count([r] + list(r.children_recursive)) for r in rims}
    # ---------------------------------------------------------------- tyre profile for the browser
    with open(os.path.join(out_dir, "tire_profile.json"), "w") as f:
        json.dump({"profile": W.TIRE_PROFILE, "grooves": W.TIRE_GROOVES, "grooveDepth": 0.007}, f, indent=1)
    info["sizes"] = sizes
    log("export", json.dumps(info))
    return info
