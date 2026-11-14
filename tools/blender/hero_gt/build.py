"""Build AE GT-RS as a REAL editable and exportable original Blender asset.

    blender -b --factory-startup --python tools/blender/hero_gt/build.py

This script generates, independently of any AI image service:
  dist/hero_gt/AE_GTRS_HERO.blend
  dist/hero_gt/AE_GTRS_LOD0.glb
  dist/hero_gt/AE_GTRS_LOD1.glb
  dist/hero_gt/AE_GTRS_LOD2.glb
  dist/hero_gt/report.json
  dist/hero_gt/review_front.png / review_profile.png / review_engine.png

No production sedan or game source is modified. bpy 4.x/5.x.
"""
from pathlib import Path
import bpy, json, math

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
DEST=ROOT/"dist"/"hero_gt"
DEST.mkdir(parents=True,exist_ok=True)

# The numbered scripts are standalone procedural design steps; all are run in one session.
for phase in ("01_shell.py","02_v8_powertrain.py","03_finish.py","04_optimize_fit.py",
              "05_organic_surfacing.py","06_sculpted_fenders.py","07_rounded_nose.py",
              "08_engine_sculpt.py","09_fastback_and_grille.py"):
    code=(HERE/phase).read_text(encoding="utf-8")
    exec(compile(code,str(HERE/phase),"exec"),{"bpy":bpy,"__name__":"__main__"})
    print("[AE GT-RS] Built",phase,flush=True)

scene=bpy.context.scene
scene.frame_set(1)
SOURCE=DEST/"AE_GTRS_HERO.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=True)

def triangles():
    """Evaluated triangles include curves and live bevels, not merely raw mesh faces."""
    depsgraph=bpy.context.evaluated_depsgraph_get()
    total=0
    for obj in bpy.data.objects:
        if obj.type not in {"MESH","CURVE","FONT"}:continue
        if obj.name.startswith("STUDIO_"):continue
        evaluated=obj.evaluated_get(depsgraph)
        render_mesh=evaluated.to_mesh()
        if render_mesh is None:continue
        total+=sum(len(f.vertices)-2 for f in render_mesh.polygons)
        evaluated.to_mesh_clear()
    return total

def delete_unneeded(lod):
    # Cosmetic high-frequency details disappear with distance, not the primary silhouette.
    removable={
       1: ("ENGINE_coil_wiring_", "ENGINE_injector_", "ENGINE_hose_clamp_"),
       2: ("BRAKE_rotor_drill_pattern_", "ENGINE_coil_wiring_", "ENGINE_injector_",
           "ENGINE_hose_clamp_", "ENGINE_head_oil_galley_", "ENGINE_cam_finned_casting_",
           "ENGINE_coil_", "ENGINE_ignition_lock_", "ACCESSORY_alternator_vent_",
           "HOOD_louver_aluminium_blade_"),
    }
    if lod==0:return
    for o in list(bpy.data.objects):
        if any(o.name.startswith(k) for k in removable[lod]):
            bpy.data.objects.remove(o,do_unlink=True)

def simplify_lod(lod):
    if lod==0:return
    delete_unneeded(lod)
    for o in list(bpy.data.objects):
        if o.type!="MESH" or len(o.data.polygons)<270:continue
        if o.name.startswith(("GT_HOOD", "BODY_", "GLASS_", "WHEEL_tyre", "WHEEL_")):
            ratio=0.70 if lod==1 else 0.38
        else:
            ratio=0.8 if lod==1 else 0.45
        bpy.ops.object.select_all(action="DESELECT")
        o.hide_set(False)
        o.select_set(True)
        bpy.context.view_layer.objects.active=o
        m=o.modifiers.new("LOD_triangle_budget","DECIMATE")
        m.ratio=ratio
        m.use_collapse_triangulate=True
        try:bpy.ops.object.modifier_apply(modifier=m.name)
        except RuntimeError:
            o.modifiers.remove(m)
    # Merge static non-animated engine components by PBR material, reducing draw calls.
    # Leave the active bonnet, wheel sets, cabin and all articulated pieces untouched.
    for o in list(bpy.data.objects):
        if o.type!="CURVE" or not o.name.startswith(("ENGINE_","TURBO_","BAY_","ACCESSORY_")):continue
        bpy.ops.object.select_all(action="DESELECT")
        o.hide_set(False)
        o.select_set(True)
        bpy.context.view_layer.objects.active=o
        bpy.ops.object.convert(target="MESH")
    groups={}
    for o in bpy.data.objects:
        if o.type!="MESH" or not o.name.startswith(("ENGINE_","TURBO_","BAY_","ACCESSORY_")):continue
        name=o.data.materials[0].name if o.data.materials else "unpainted"
        groups.setdefault(name,[]).append(o)
    for mat,obs in groups.items():
        if len(obs)<2:continue
        bpy.ops.object.select_all(action="DESELECT")
        for o in obs:
            o.hide_set(False)
            o.select_set(True)
        active=obs[0]
        bpy.context.view_layer.objects.active=active
        bpy.ops.object.join()
        active.name="ENGINE_BATCH_"+mat.replace(" ","_")
    # Engine curves make up most of low-end poly count. Once they are batched,
    # decimate the baked static assemblies only for LOD2; preserve LOD0 source.
    if lod==2:
        for obj in list(bpy.data.objects):
            if not obj.name.startswith("ENGINE_BATCH_") or obj.type!="MESH":
                continue
            if len(obj.data.polygons)<450:continue
            bpy.ops.object.select_all(action="DESELECT")
            obj.hide_set(False);obj.select_set(True)
            bpy.context.view_layer.objects.active=obj
            dec=obj.modifiers.new("engine_low_hardware_budget","DECIMATE")
            dec.ratio=.43
            dec.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=dec.name)
    print("[AE GT-RS] LOD optimized",lod,"triangles",triangles(),flush=True)

def export_glb(lod):
    bpy.ops.object.select_all(action="DESELECT")
    count=0
    for o in bpy.data.objects:
        if o.type not in {"MESH","CURVE","EMPTY"}:continue
        if o.name.startswith(("STUDIO_","LGT_","CAM_")):continue
        if o.hide_render:continue
        o.hide_set(False)
        o.select_set(True);count+=1
    filename=DEST/f"AE_GTRS_LOD{lod}.glb"
    args=dict(filepath=str(filename),export_format="GLB",
         use_selection=True,export_yup=True,export_materials="EXPORT",
         export_animations=True,export_extras=True,export_cameras=False,export_lights=False)
    try:
        bpy.ops.export_scene.gltf(**args,
           export_draco_mesh_compression_enable=True,
           export_draco_mesh_compression_level=6)
    except TypeError:
        bpy.ops.export_scene.gltf(**args)
    print("[AE GT-RS] GLB",filename.name,filename.stat().st_size,"bytes",flush=True)
    return {"lod":lod,"triangles":triangles(),"objects":count,"bytes":filename.stat().st_size}


def export_split(lod,role):
    """Use the exact same world coordinates for body and engine.

    BODY glb is loaded first; ENGINE glb is streamed only when bonnet opens.
    """
    assert role in {"BODY","ENGINE"}
    bpy.ops.object.select_all(action="DESELECT")
    picked=0
    for o in bpy.data.objects:
        if o.type not in {"MESH","CURVE","EMPTY"}:continue
        if o.name.startswith(("STUDIO_","LGT_","CAM_")) or o.hide_render:continue
        engine=o.name.startswith(("ENGINE_","TURBO_","ACCESSORY_","BAY_"))
        if (role=="ENGINE")!=engine:continue
        o.hide_set(False);o.select_set(True);picked+=1
    path=DEST/f"AE_GTRS_{role}_LOD{lod}.glb"
    args=dict(filepath=str(path),export_format="GLB",
         use_selection=True,export_yup=True,export_materials="EXPORT",
         export_animations=(role=="BODY"),export_extras=True,
         export_cameras=False,export_lights=False)
    try:
        bpy.ops.export_scene.gltf(**args,export_draco_mesh_compression_enable=True,
                                   export_draco_mesh_compression_level=6)
    except TypeError:
        bpy.ops.export_scene.gltf(**args)
    return {"role":role,"lod":lod,"bytes":path.stat().st_size,"selected_objects":picked}

def review_render(camera,frame,name):
    scene.frame_set(frame)
    scene.camera=bpy.data.objects[camera]
    scene.render.engine="BLENDER_WORKBENCH"
    scene.render.resolution_x=1120;scene.render.resolution_y=700
    scene.render.resolution_percentage=100
    scene.render.image_settings.media_type="IMAGE"
    scene.render.image_settings.file_format="PNG"
    scene.display.shading.light="STUDIO"
    scene.display.shading.color_type="MATERIAL"
    scene.display.shading.show_shadows=True
    scene.render.filepath=str(DEST/name)
    bpy.ops.render.render(write_still=True)

for cam,frame,name in [
    ("CAM_front34",1,"review_front.png"),
    ("CAM_profile",1,"review_profile.png"),
    ("CAM_engine_under_hood",40,"review_engine.png"),
]:
    review_render(cam,frame,name)
scene.frame_set(1)
report={"artist":"Automotive Empire original GT-RS","source":"Procedural native Blender geometry",
        "vehicle_m":[4.6,1.98,1.34],"engine":"4.0L V8 twin turbo",
        "animation":{"hood_closed":1,"hood_open":40},
        "source_blend_size":SOURCE.stat().st_size,
        "lods":[],"split_assets":[] }
for lod in (0,1,2):
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    simplify_lod(lod)
    report["lods"].append(export_glb(lod))
    report["split_assets"].append(export_split(lod,"BODY"))
    report["split_assets"].append(export_split(lod,"ENGINE"))
(DEST/"report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
print("[AE GT-RS] COMPLETE",json.dumps(report),flush=True)
