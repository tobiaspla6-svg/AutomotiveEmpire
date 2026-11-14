"""Automotive Empire AE-01: reproducible opening bonnet and engine-bay prototype.

Run after tools/blender/sedan/build.py has produced assets-src/sedan-ref/sedan.blend:

    blender -b --python tools/blender/sedan/hood_engine.py

This creates separate, experimental files and NEVER overwrites the production sedan GLBs:
    assets-src/sedan-ref/sedan.hood-engine.blend
    assets-src/sedan-ref/sedan.hood-engine.glb

The V6 is a geometrical preview; game-driven engine variants remain the responsibility of
the interactive 3D layer. The bonnet pivots about the rear/cowl at frame 1 (shut) to
frame 42 (57 degrees open). This script intentionally does not change game physics.
"""
from __future__ import annotations

import math
import os
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "assets-src/sedan-ref/sedan.blend"
OUT_BLEND = ROOT / "assets-src/sedan-ref/sedan.hood-engine.blend"
OUT_GLB = ROOT / "assets-src/sedan-ref/sedan.hood-engine.glb"


def material(name, rgb, metal=0, rough=0.43):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    if p:
        p.inputs["Base Color"].default_value = (*rgb, 1)
        p.inputs["Metallic"].default_value = metal
        p.inputs["Roughness"].default_value = rough
    return m


def cube(name, loc, size, m, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(m)
    if bevel:
        mod = o.modifiers.new("Manufactured edges", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        o.modifiers.new("Corner normals", "WEIGHTED_NORMAL")
    return o


def cylinder(name, loc, radius, length, m, rotation=(0, 0, 0), vertices=20):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=length,
        location=loc, rotation=rotation,
    )
    o = bpy.context.object
    o.name = name
    o.data.materials.append(m)
    return o


def tube(name, pts, radius, m):
    c = bpy.data.curves.new(name, "CURVE")
    c.dimensions = "3D"
    c.bevel_depth = radius
    c.bevel_resolution = 3
    c.resolution_u = 12
    sp = c.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for v, p in zip(sp.bezier_points, pts):
        v.co = p
        v.handle_left_type = v.handle_right_type = "AUTO"
    o = bpy.data.objects.new(name, c)
    bpy.context.scene.collection.objects.link(o)
    c.materials.append(m)
    return o


def is_hood(f):
    c = f.calc_center_median()
    return 1.02 < c.x < 2.14 and abs(c.y) < 0.76 and 0.73 < c.z < 1.08 and f.normal.z > 0.52


def split_body_faces(ob, keep_hood):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.normal_update()
    faces = [f for f in bm.faces if is_hood(f)]
    if len(faces) < 1000:
        bm.free()
        raise RuntimeError(f"Unexpected bonnet selection: only {len(faces)} faces; original topology may have changed")
    erase = [f for f in bm.faces if f not in set(faces)] if keep_hood else faces
    bmesh.ops.delete(bm, geom=erase, context="FACES")
    if bm.faces:
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return len(faces)


def install():
    sc = bpy.context.scene
    body = bpy.data.objects["Body"]
    if "AE01_HOOD_OPENABLE" in bpy.data.objects:
        raise RuntimeError("The bonnet has already been extracted. Run on the original sedan.blend.")
    # Create fresh objects, not object.copy(): the 3D Jutsu scene format assigns unique
    # object IDs in custom properties, which object.copy() would duplicate.
    hood = bpy.data.objects.new("AE01_HOOD_OPENABLE", body.data.copy())
    sc.collection.objects.link(hood)
    selected = split_body_faces(hood, True)
    split_body_faces(body, False)
    pivot = Vector((0.985, 0, 0.932))
    for v in hood.data.vertices:
        v.co -= pivot
    hood.location = pivot
    hood.rotation_mode = "XYZ"
    hood.rotation_euler[1] = 0
    hood.keyframe_insert(data_path="rotation_euler", frame=1)
    hood.rotation_euler[1] = -math.radians(57)
    hood.keyframe_insert(data_path="rotation_euler", frame=42)
    sc.frame_start, sc.frame_end = 1, 42
    sc.frame_set(42)

    bay = material("AE01_bay_graphite", (.045, .047, .055), .08, .65)
    alloy = material("AE01_cast_alloy", (.45, .50, .56), .73, .31)
    dark = material("AE01_engine_dark", (.09, .10, .13), .56, .36)
    rubber = material("AE01_rubber", (.025, .028, .033), .02, .74)
    red = material("AE01_red_accents", (.45, .032, .048), .25, .34)
    steel = material("AE01_fasteners", (.65, .70, .75), .82, .24)

    underside = bpy.data.objects.new("AE01_HOOD_UNDERSIDE", hood.data.copy())
    sc.collection.objects.link(underside)
    underside.parent = hood
    underside.location = (0, 0, -.034)
    underside.data.materials.clear()
    underside.data.materials.append(bay)
    for f in underside.data.polygons:
        f.material_index = 0

    cube("BAY_floor", (1.57, 0, .31), (1.31, 1.37, .07), bay, .03)
    cube("BAY_firewall", (1.00, 0, .58), (.045, 1.36, .51), bay, .018)
    cube("BAY_radiator_crossmember", (2.15, 0, .48), (.08, 1.42, .25), dark, .017)
    for side in (-1, 1):
        cube(f"BAY_rail_{side}", (1.59, side*.63, .44), (1.27, .11, .15), dark, .03)
        cylinder(f"BAY_suspension_tower_{side}", (1.48, side*.70, .54), .13, .18, alloy)
        cylinder(f"BAY_suspension_top_{side}", (1.48, side*.70, .645), .065, .023, steel)

    cube("ENGINE_V6_crankcase", (1.52, 0, .48), (.80, .53, .29), alloy, .05)
    cube("ENGINE_V6_oil_pan", (1.50, 0, .335), (.73, .45, .12), dark, .038)
    cube("ENGINE_V6_bellhousing", (1.065, 0, .45), (.17, .53, .37), alloy, .042)
    for side in (-1, 1):
        head = cube(f"ENGINE_V6_cylinder_bank_{side}", (1.48, side*.20, .62), (.68, .255, .185), dark, .026)
        head.rotation_euler[0] = side*.31
        cover = cube(f"ENGINE_V6_valve_cover_{side}", (1.48, side*.20, .715), (.65, .225, .05), alloy, .012)
        cover.rotation_euler[0] = side*.31
        for i, x in enumerate((1.25, 1.48, 1.71)):
            cylinder(f"ENGINE_V6_ignition_coil_{side}_{i}", (x, side*.20, .752), .031, .026, rubber, vertices=12)
            cylinder(f"ENGINE_V6_bolt_{side}_{i}", (x, side*.315, .716), .017, .018, steel, vertices=8)
        tube(f"ENGINE_exhaust_header_{side}",
             [(1.2, side*.35, .58), (1.5, side*.43, .50), (1.8, side*.37, .42)], .026, steel)
    cube("ENGINE_air_plenum", (1.46, 0, .758), (.53, .24, .086), rubber, .024)
    for side in (-1, 1):
        tube(f"ENGINE_intake_manifold_{side}",
             [(1.44, side*.12, .75), (1.56, side*.23, .75), (1.44, side*.33, .67)], .028, dark)
    cylinder("ENGINE_crank_pulley", (1.965, 0, .45), .128, .06, rubber, (0, math.pi/2, 0), 28)
    cylinder("ENGINE_pulley_hub", (2.008, 0, .45), .069, .06, steel, (0, math.pi/2, 0))
    cylinder("ENGINE_accessory_pulley", (1.982, -.23, .56), .078, .05, rubber, (0, math.pi/2, 0))
    cube("BAY_air_filter_box", (1.76, -.52, .59), (.38, .20, .18), rubber, .03)
    tube("BAY_air_intake",
         [(1.77, -.53, .66), (1.81, -.36, .71), (1.61, 0, .774)], .047, rubber)
    cube("BAY_12v_battery", (1.18, .50, .54), (.25, .21, .18), rubber, .026)
    cube("BAY_battery_terminal", (1.18, .50, .64), (.085, .075, .018), red, .004)
    tube("BAY_strut_brace", [(1.48, -.70, .66), (1.42, 0, .79), (1.48, .70, .66)], .021, alloy)

    # Diagnostics guard against a blank mesh or a wrongly rotating hood.
    assert len(hood.data.polygons) == selected
    assert len(body.data.polygons) > 50000
    assert "ENGINE_V6_crankcase" in bpy.data.objects
    return {"hood_faces": selected, "body_faces": len(body.data.polygons)}


def main():
    if not SOURCE.is_file():
        raise FileNotFoundError(
            f"Missing original sedan.blend: {SOURCE}. Run tools/blender/sedan/build.py first."
        )
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    info = install()
    OUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND), compress=True)
    # Export a separate experimental model; do not overwrite the released sedan LODs.
    bpy.ops.object.select_all(action="DESELECT")
    for ob in bpy.data.objects:
        if ob.type in {"MESH", "CURVE", "EMPTY"} and not ob.hide_render:
            try:
                ob.hide_set(False)
                ob.select_set(True)
            except RuntimeError:
                pass
    bpy.ops.export_scene.gltf(
        filepath=str(OUT_GLB),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_materials="EXPORT",
        export_animations=True,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
    )
    print("[AE01 opening bonnet]", info, "BLEND:", OUT_BLEND, "GLB:", OUT_GLB)


if __name__ == "__main__":
    main()
