# Automotive Empire GT-RS — measured fit correction and GPU budgets.
# Corrects the actual bonnet/engine penetration from a vertex-level inspection.
import bpy,math
from mathutils import Vector
scene=bpy.context.scene;scene.frame_set(1)
moved=[]
for ob in bpy.data.objects:
 if ob.name=='ENGINE_V8TT_ROOT':continue
 if ob.name.startswith(('ENGINE_','TURBO_','ACCESSORY_')) and ob.type in {'MESH','CURVE'}:
  ob.location.z-=.11
  moved.append(ob.name)
for name in ('ENGINE_billet_throttle_body','ENGINE_electronic_throttle_butterfly'):
 ob=bpy.data.objects.get(name)
 if ob:ob.location.z-=.068
for name in ('BAY_radiator_frame','BAY_chassis_brace'):
 ob=bpy.data.objects.get(name)
 if ob:ob.location.z-=.055
# Tiny lettering used >8k triangles. Replace with a lightweight two-letter monogram:
badge=bpy.data.objects.get('BADGE_ae_gtrs')
if badge:bpy.data.objects.remove(badge,do_unlink=True)
ma=bpy.data.materials['GT_machined_alloy']
def strokes(name,paths,r=.006):
 curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=r;curve.bevel_resolution=2
 for pts in paths:
  spline=curve.splines.new('POLY');spline.points.add(len(pts)-1)
  for a,b in zip(spline.points,pts):a.co=(*b,1)
 ob=bpy.data.objects.new(name,curve);scene.collection.objects.link(ob);curve.materials.append(ma)
 return ob
strokes('BADGE_AE_light_geometry',[
 [(2.358,-.09,.58),(2.358,-.06,.65),(2.358,-.03,.58)],
 [(2.360,-.076,.608),(2.360,-.044,.608)],
 [(2.358,.012,.58),(2.358,.012,.65),(2.358,.082,.65)],
 [(2.358,.012,.613),(2.358,.07,.613)],
 [(2.358,.012,.58),(2.358,.082,.58)]],.0045)
# Render cost: tyre sidewall's two almost invisible inner rings and shoulder tread rings
# contributed about 20k triangles. Keep inner ribs and the two primary tread channels.
deleted=[]
for ob in list(bpy.data.objects):
 if ob.name.startswith('WHEEL_tread_channel_') and ('-0.07' in ob.name or ob.name.endswith('_0.07')):
  deleted.append(ob.name);bpy.data.objects.remove(ob,do_unlink=True)
 elif ob.name.startswith('WHEEL_tire_sidewall_rib_') and ob.name.endswith(('_1','_2')):
  deleted.append(ob.name);bpy.data.objects.remove(ob,do_unlink=True)
# Expose engine body geometry only; new bonnet remains a separate animated object.
# All edits are presentation-only and preserve working axle mounts and game rules.
scene.frame_set(1);bpy.context.view_layer.update()
tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.data.objects if o.type=='MESH')
result={'stage':'fit_optimization','engine_objects_lowered':len(moved),'deleted_inefficient_small_objects':len(deleted),'mesh_triangles_after':tris,'objects':len(bpy.data.objects),'badge':'lowpoly_ae','frame':scene.frame_current}
