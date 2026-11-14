# Automotive Empire GT-RS: exterior finishing, glass, cabin, realistic wheel detailing.
# Run after 01_shell.py and 02_v8_powertrain.py.
import bpy,math
from mathutils import Vector
sc=bpy.context.scene
def mat(name,rgb,metal=0,rough=.35,coat=.0):
 m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
 m.use_nodes=True;m.diffuse_color=(*rgb,1)
 p=m.node_tree.nodes.get('Principled BSDF')
 p.inputs['Base Color'].default_value=(*rgb,1)
 p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 p.inputs['Coat Weight'].default_value=coat
 p.inputs['Coat Roughness'].default_value=.12
 return m
LEATHER=mat('COCKPIT_dark_alcantara',(.057,.060,.067),.03,.80)
LEATHER_R=mat('COCKPIT_oxblood_leather',(.27,.038,.046),.04,.69)
SEAT_CARBON=mat('COCKPIT_carbon_shell',(.013,.018,.022),.43,.29,.3)
SCREEN=mat('COCKPIT_display_gloss',(.014,.032,.048),.20,.08,.8)
SILVER=bpy.data.materials['GT_machined_alloy']
CARBON=bpy.data.materials['GT_carbon_satin']
BLACK=bpy.data.materials['GT_gloss_black']
PAINT=bpy.data.materials['GT_paint_deep_ochre_gold']
VENT=bpy.data.materials['GT_duct_depth']
GLASS=bpy.data.materials['GT_dark_glass']
LED=bpy.data.materials['GT_white_drl']
RUBBER=bpy.data.materials['GT_tyre_rubber']
DRILL=mat('GT_brake_drill_dark',(.008,.010,.011),.1,.76)
METAL=mat('COCKPIT_brushed_titanium',(.36,.40,.45),.76,.37)
# Mildly transmissive tinted glass (PBR alpha and transmission remain user adjustable).
gp=GLASS.node_tree.nodes['Principled BSDF']
gp.inputs['Transmission Weight'].default_value=.18
gp.inputs['IOR'].default_value=1.48
gp.inputs['Coat Weight'].default_value=.80
def cube(name,pos,dim,ma,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
 o=bpy.context.object;o.name=name;o.dimensions=dim
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(ma)
 if bevel:
  b=o.modifiers.new('part_bevel','BEVEL');b.width=bevel;b.segments=3
  o.modifiers.new('weighted_corner_normals','WEIGHTED_NORMAL')
 return o
def cyl(name,loc,r,length,ma,axis='Z',sides=32):
 ro={'X':(0,math.pi/2,0),'Y':(math.pi/2,0,0),'Z':(0,0,0)}[axis]
 bpy.ops.mesh.primitive_cylinder_add(vertices=sides,radius=r,depth=length,location=loc,rotation=ro)
 o=bpy.context.object;o.name=name;o.data.materials.append(ma)
 return o
def tor(name,loc,maj,minor,ma,axis='X',seg=64):
 ro={'X':(0,math.pi/2,0),'Y':(math.pi/2,0,0),'Z':(0,0,0)}[axis]
 bpy.ops.mesh.primitive_torus_add(major_segments=seg,minor_segments=10,location=loc,rotation=ro,major_radius=maj,minor_radius=minor)
 o=bpy.context.object;o.name=name;o.data.materials.append(ma)
 for p in o.data.polygons:p.use_smooth=True
 return o
def tube(name,coords,r,ma):
 cr=bpy.data.curves.new(name,'CURVE');cr.dimensions='3D';cr.resolution_u=16;cr.bevel_depth=r;cr.bevel_resolution=3
 sp=cr.splines.new('POLY');sp.points.add(len(coords)-1)
 for p,c in zip(sp.points,coords):p.co=(*c,1)
 o=bpy.data.objects.new(name,cr);sc.collection.objects.link(o);cr.materials.append(ma)
 return o
def patch(name,grid,ma):
 pts=[x for row in grid for x in row];m=len(grid[0])
 faces=[(i*m+j,i*m+j+1,(i+1)*m+j+1,(i+1)*m+j) for i in range(len(grid)-1) for j in range(m-1)]
 me=bpy.data.meshes.new(name+'_mesh');me.from_pydata(pts,[],faces);me.update()
 o=bpy.data.objects.new(name,me);sc.collection.objects.link(o);me.materials.append(ma)
 for p in me.polygons:p.use_smooth=True
 return o
# Bolstered GT bucket seats, sculpted lumbar and carbon backs. Distinct materials, no flat boxes in profile.
for side in (-1,1):
 cy=side*.39
 cube('CABIN_seat_cushion_'+str(side),(-.36,cy,.45),(.61,.49,.12),LEATHER,.070)
 cube('CABIN_cushion_center_'+str(side),(-.35,cy,.525),(.42,.28,.040),LEATHER_R,.018)
 for edge in (-1,1):
  cube('CABIN_cushion_side_bolster_'+str(side)+'_'+str(edge),(-.37,cy+edge*.235,.55),(.60,.089,.16),LEATHER,.043)
 # Seatback sweeps rearward as it rises, anatomically contoured.
 rows=[]
 for i in range(17):
  t=i/16
  x=-.54-.105*t-.012*math.sin(math.pi*t)
  z=.55+.54*t
  rows.append([(x,cy+(-.232+.464*j/14)*(1-.16*t),z-.012*((j-7)/7)**2) for j in range(15)])
 patch('CABIN_carbon_bucket_back_'+str(side),rows,SEAT_CARBON)
 rows=[]
 for i in range(14):
  t=i/13;x=-.525-.105*t;z=.59+.43*t
  rows.append([(x+.021,cy+(-.15+.30*j/12)*(1-.10*t),z) for j in range(13)])
 patch('CABIN_alcantara_backpad_'+str(side),rows,LEATHER)
 cube('CABIN_headrest_'+str(side),(-.69,cy,1.09),(.13,.32,.105),LEATHER_R,.032)
 for off in (-.15,.15):
  tube('CABIN_six_point_harness_'+str(side)+'_'+str(off),
   [(-.66,cy+off,1.09),(-.58,cy+off*.8,.77),(-.34,cy+off*.6,.47)],.016,LEATHER_R)
# Cockpit: sculpted dash, display binnacle and driver wheel.
cube('CABIN_dashboard_traverse',(.425,0,.83),(.29,1.50,.27),LEATHER,.085)
cube('CABIN_front_defroster',(.55,0,.967),(.078,1.15,.028),BLACK,.012)
cube('CABIN_digital_gauge_clust',(.31,-.39,.97),(.052,.46,.155),SCREEN,.019)
cube('CABIN_center_touch_display',(.343,0,.927),(.029,.27,.18),SCREEN,.021)
cube('CABIN_tunnel',(-.20,0,.51),(1.17,.25,.24),LEATHER,.052)
for side in (-1,1):
 tube('CABIN_door_ambient_trim_'+str(side),[(.30,side*.75,.79),(-.7,side*.80,.80)],.006,SILVER)
 # Door handles are inset, with slight recess and separate chromed pull.
 cube('EXTERIOR_handle_recess_'+str(side),(-.30,side*.967,.827),(.175,.018,.050),BLACK,.016)
 cube('EXTERIOR_pull_handle_'+str(side),(-.3,side*.985,.826),(.13,.022,.022),PAINT,.009)
# Steering column, 3-spoke wheel and thumb grips.
cyl('CABIN_steering_column',(.22,-.37,.86),.052,.34,BLACK,'X',24)
tor('CABIN_steering_wheel',(.28,-.37,.93),.161,.020,LEATHER,'X',48)
for a in (0,math.tau/3,2*math.tau/3):
 y=-.37+.105*math.sin(a);z=.93+.105*math.cos(a)
 tube('CABIN_wheel_spoke_'+str(round(a,2)),[(.274,-.37,.93),(.282,y,z)],.016,SEAT_CARBON)
cyl('CABIN_center_airbag',(.298,-.37,.93),.059,.030,BLACK,'X',24)
# Front-louver heat extraction on both hood shoulders; all elements are parented to hood hinge.
hood=bpy.data.objects['GT_HOOD_ARTICULATED']
sc.frame_set(1)
for side in (-1,1):
 for i in range(5):
  x=1.42+.092*i;u=(x-.57)/1.70
  v=side*(.63-.035*i)
  width=.73+.10*math.sin(math.pi*u)+.015*u
  y=width*v
  z=.987-.245*u+.022*math.sin(math.pi*u)-.049*v*v+.027*math.exp(-((abs(v)-.68)/.23)**2)*math.sin(math.pi*u)-.012*math.exp(-(v/.18)**2)*math.sin(math.pi*u)
  a=cube('HOOD_louver_recess_'+str(side)+'_'+str(i),(x,y,z+.005),(.042,.20,.012),VENT,.006)
  b=cube('HOOD_louver_aluminium_blade_'+str(side)+'_'+str(i),(x-.013,y,z+.017),(.016,.212,.020),CARBON,.004)
  for o in (a,b):
   w=o.matrix_world.copy();o.parent=hood;o.matrix_world=w
 # Bonded glass seal at windshield bottom and upper roofrail.
 tube('EXTERIOR_windscreen_lower_seal_'+str(side),[(.55,side*.72,.98),(.43,side*.68,1.07)],.014,BLACK)
 tube('EXTERIOR_windscreen_top_seal_'+str(side),[(-.036,side*.62,1.313),(-.12,side*.625,1.33)],.014,BLACK)
# Windshield wipers, with shaped arms and suspended blades.
for side in (-1,1):
 tube('EXTERIOR_wiper_arm_'+str(side),[(.61,side*.53,.994),(.58,side*.23,1.014),(.45,side*.04,1.05)],.012,BLACK)
 tube('EXTERIOR_wiper_rubber_'+str(side),[(.50,side*.52,1.036),(.36,side*.08,1.075)],.008,BLACK)
# Side intake channels ahead of rear arches, and track splitter support rods.
for side in (-1,1):
 cube('EXTERIOR_rear_fender_inlet_'+str(side),(-.78,side*.959,.58),(.09,.024,.28),VENT,.025)
 for j in range(3):
  cube('EXTERIOR_inlet_vane_'+str(side)+'_'+str(j),(-.78,side*.979,.50+.09*j),(.085,.024,.015),CARBON,.004)
 tube('AERO_front_stay_'+str(side),[(2.36,side*.67,.226),(2.19,side*.72,.422)],.013,METAL)
# Tyre microfeatures: light tread shoulders and drilled brake rotor depressions batched per wheel.
for ax,ab in [(1.34,'F'),(-1.36,'R')]:
 for side,label in [(-1,'R'),(1,'L')]:
  name=ab+label;cy=side*.867
  for d in (-.070,-.035,.035,.070):
   tor('WHEEL_tread_channel_'+name+'_'+str(d),(ax,cy+d,.344),.350,.0032,RUBBER,'Y',72)
  # black drilled cavities in rotor face (one mesh, one draw call).
  vertices=[];faces=[]
  for j in range(36):
   a=2*math.pi*j/36
   r=.147 if j%2 else .174
   x=ax+r*math.cos(a);z=.344+r*math.sin(a)
   start=len(vertices);y=side*1.009
   vertices.extend([(x+.0088*math.cos(2*math.pi*k/10),y,z+.0088*math.sin(2*math.pi*k/10)) for k in range(10)])
   faces.append(tuple(start+k for k in range(10)))
  me=bpy.data.meshes.new('BRAKE_drillmesh_'+name);me.from_pydata(vertices,[],faces);me.update()
  obj=bpy.data.objects.new('BRAKE_rotor_drill_pattern_'+name,me);sc.collection.objects.link(obj);me.materials.append(DRILL)
# Original monogram / no copyrighted car brand logo.
def text_mesh(n,txt,location,size,ma,rotation=(0,0,0)):
 cu=bpy.data.curves.new(n,'FONT');cu.body=txt;cu.size=size;cu.extrude=.0015;cu.bevel_depth=.0007
 ob=bpy.data.objects.new(n,cu);sc.collection.objects.link(ob);ob.location=location;ob.rotation_euler=rotation
 cu.materials.append(ma)
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
 bpy.ops.object.convert(target='MESH')
 return bpy.context.object
# Discreet fictional badge on grille (not Porsche branding).
text_mesh('BADGE_ae_gtrs','AE / GT-RS',(2.365,-.18,.605),.09,SILVER,(math.pi/2,0,math.pi/2))
sc.frame_set(1)
result={'stage':'detail','objects':len(bpy.data.objects),'meshes':sum(o.type=='MESH' for o in bpy.data.objects),'materials':len(bpy.data.materials),'louver_count':len([o for o in bpy.data.objects if o.name.startswith('HOOD_louver')]),'full_cabin':all(x in bpy.data.objects for x in ['CABIN_steering_wheel','CABIN_carbon_bucket_back_-1'])}
