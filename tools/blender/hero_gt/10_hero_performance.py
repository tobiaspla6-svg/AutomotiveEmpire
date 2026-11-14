"""AE GT-RS v2: close-camera hard-surface quality without decorative over-tessellation.

Preserves V8/hood geometry and material slots. Optimizes source curves that
otherwise exploded into 30k triangles for two tiny V-band clamps.
"""
import bpy,math
S=bpy.context.scene
S.frame_set(1)
MACH=bpy.data.materials['V8_machined_aluminium']
removed=[]
for side in (-1,1):
    n='TURBO_outer_compressor_Vband_'+str(side)
    old=bpy.data.objects.get(n)
    if old:
        bpy.data.objects.remove(old,do_unlink=True);removed.append(n)
    bpy.ops.mesh.primitive_torus_add(major_segments=36,minor_segments=8,
          location=(1.035,side*.718,.325),rotation=(math.pi/2,0,0),
          major_radius=.113,minor_radius=.006)
    obj=bpy.context.object
    obj.name=n;obj.data.materials.append(MACH)
    obj.parent=bpy.data.objects['ENGINE_V8TT_ROOT']
    for f in obj.data.polygons:f.use_smooth=True
# Curve samples are geometric budget, not image pixels. A raised tiny seam,
# wiring harness or trim ring does not need 16 Bezier steps per control point.
optimized=[]
for o in bpy.data.objects:
    if o.type!='CURVE':continue
    if o.name.startswith(('ENGINE_','TURBO_','ACCESSORY_','BAY_')):
        o.data.resolution_u=min(o.data.resolution_u,7)
        o.data.bevel_resolution=min(o.data.bevel_resolution,2)
        optimized.append(o.name)
    elif o.name.startswith(('SURF_','SEAM_','ARCH_','LIGHT_')):
        o.data.resolution_u=min(o.data.resolution_u,9)
        o.data.bevel_resolution=min(o.data.bevel_resolution,2)
        optimized.append(o.name)
# Earlier 2x subdivision was excessive for 121 longitudinal grid rows and
# smooth weighted normals. Keep the editable vertices and surface contours.
for n in ('BODY_side_cutout_L','BODY_side_cutout_R'):
    o=bpy.data.objects[n]
    sub=o.modifiers.get('AE_GT_curvature_surface')
    if sub:sub.levels=0;sub.render_levels=0
    for f in o.data.polygons:f.use_smooth=True
# Do not destructively remove grille cutout topology. The export and rendering
# preserve the full modeled opening but evaluated skirt polygons are light.
S.frame_set(1)
result={'phase':'10_source_geometry_budget','removed_wasteful_curve_rings':removed,
        'optimized_curve_count':len(optimized),'scene_objects':len(bpy.data.objects)}
