# Automotive Empire GT-RS 4.0L V8 biturbo — original detailed powertrain.
# Run after 01_shell.py (same .blend or hosted 3D Jutsu scene).
import bpy,math
from mathutils import Vector
scene=bpy.context.scene
def mat(name, rgb, metal=0, rough=.34, clear=.0, micro=False):
 m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
 m.diffuse_color=(*rgb,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF')
 p.inputs['Base Color'].default_value=(*rgb,1)
 p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 p.inputs['Coat Weight'].default_value=clear
 if micro:
  tex=m.node_tree.nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=290;tex.inputs['Detail'].default_value=2
  bump=m.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.065;bump.inputs['Distance'].default_value=.00028
  m.node_tree.links.new(tex.outputs['Fac'],bump.inputs['Height'])
  m.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
 return m
CAST=mat('V8_cast_aluminium',(.31,.34,.38),.82,.31,micro=True)
MACH=mat('V8_machined_aluminium',(.63,.69,.73),.87,.20)
DARK=mat('V8_black_magnesium_cast',(.047,.053,.062),.55,.31,micro=True)
POLY=mat('V8_polymer_dark',(.023,.026,.032),.06,.55)
STEEL=mat('V8_burnished_steel',(.35,.39,.42),.84,.27,micro=True)
CHROME=mat('V8_satin_chrome',(.62,.67,.69),.84,.24)
BOLT=mat('V8_titanium_fasteners',(.54,.57,.60),.78,.25)
BLUE=mat('V8_blue_silicone',(.016,.039,.072),.06,.49)
COPPER=mat('V8_copper_thermal',(.34,.17,.073),.63,.33)
CARBON=mat('V8_carbon_intake',(.012,.017,.022),.35,.23,.45,micro=True)
YELLOW=mat('V8_engine_warning_yellow',(.75,.39,.022),.16,.31)
HOSE=mat('V8_braided_lines',(.13,.15,.18),.25,.50)
RECESS=mat('V8_machined_recesses',(.007,.009,.012),.12,.7)
def cube(name,pos,dim,material,bevel=.0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
 o=bpy.context.object;o.name=name;o.dimensions=dim
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(material)
 if bevel:
  b=o.modifiers.new('precision_cast_radii','BEVEL');b.width=bevel;b.segments=3
  o.modifiers.new('accurate_corner_normals','WEIGHTED_NORMAL')
 return o
def cyl(name,loc,r,dep,m,axis='Z',segments=32):
 rot={'Z':(0,0,0),'Y':(math.pi/2,0,0),'X':(0,math.pi/2,0)}[axis]
 bpy.ops.mesh.primitive_cylinder_add(vertices=segments,radius=r,depth=dep,location=loc,rotation=rot)
 o=bpy.context.object;o.name=name;o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=True
 return o
def tor(name,loc,maj,minor,m,axis='X',seg=48,tube_seg=10):
 rot={'Z':(0,0,0),'Y':(math.pi/2,0,0),'X':(0,math.pi/2,0)}[axis]
 bpy.ops.mesh.primitive_torus_add(major_radius=maj,minor_radius=minor,major_segments=seg,minor_segments=tube_seg,location=loc,rotation=rot)
 o=bpy.context.object;o.name=name;o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=True
 return o
def tube(name,pts,r,m,smooth=0):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=20;c.bevel_depth=r;c.bevel_resolution=3
 s=c.splines.new('BEZIER');s.bezier_points.add(len(pts)-1)
 for b,p in zip(s.bezier_points,pts):
  b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);c.materials.append(m)
 return o
def mesh(name,verts,faces,m):
 md=bpy.data.meshes.new(name+'_mesh');md.from_pydata(verts,[],faces);md.update()
 obj=bpy.data.objects.new(name,md);scene.collection.objects.link(obj);md.materials.append(m)
 return obj
# Front-mid engine fits x 0.84..2.07 under opening hood x .57..2.27
# V8 with 90° bank angle and four cylinders per head.
engine_root=bpy.data.objects.new('ENGINE_V8TT_ROOT',None);scene.collection.objects.link(engine_root)
def attach(o):
 # Source object at world coordinates; store world transform and parent without movement.
 w=o.matrix_world.copy()
 o.parent=engine_root;o.matrix_world=w
 return o
# shallow engine bay to create real depth when hood opens.
attach(cube('BAY_satin_floor',(1.45,0,.267),(1.58,1.48,.065),POLY,.035))
attach(cube('BAY_firewall',(.69,0,.51),(.06,1.50,.64),DARK,.018))
attach(cube('BAY_radiator_frame',(2.175,0,.53),(.085,1.51,.48),DARK,.025))
for side in (-1,1):
 attach(cube('BAY_frame_rail_'+str(side),(1.48,side*.65,.42),(1.39,.10,.17),DARK,.021))
 attach(cyl('BAY_suspension_tower_'+str(side),(1.22,side*.726,.51),.115,.17,CAST))
 attach(cyl('BAY_strut_mount_'+str(side),(1.22,side*.726,.61),.078,.015,MACH))
 attach(tube('BAY_suspension_upper_link_'+str(side),[(1.0,side*.71,.55),(1.26,side*.75,.66),(1.51,side*.72,.53)],.022,STEEL))
# Underengine block, sump, gearbox interface.
attach(cube('ENGINE_crankcase_iron_6061',(1.38,0,.435),(.78,.53,.31),CAST,.055))
attach(cube('ENGINE_reinforced_deep_sump',(1.37,0,.29),(.70,.47,.14),DARK,.031))
for i in range(12):
 x=1.07+i*.053
 for side in (-1,1):
  attach(cube('ENGINE_crankcase_cast_rib_'+str(i)+'_'+str(side),(x,side*.27,.44),(.014,.018,.24),STEEL,.004))
attach(cube('ENGINE_bellhousing',(.94,0,.442),(.22,.64,.36),CAST,.055))
attach(cyl('ENGINE_front_timing_cover',(1.82,0,.482),.234,.060,DARK,'X',48))
# Angled banks and machined billet valve covers.
for side in (-1,1):
 bank=attach(cube('ENGINE_V8_bank_'+str(side),(1.37,side*.185,.624),(.76,.29,.22),CAST,.035))
 bank.rotation_euler[0]=side*.40
 head=attach(cube('ENGINE_V8_head_'+str(side),(1.37,side*.235,.705),(.78,.27,.15),MACH,.025))
 head.rotation_euler[0]=side*.46
 cover=attach(cube('ENGINE_V8_cam_cover_'+str(side),(1.37,side*.235,.778),(.72,.265,.105),DARK,.031))
 cover.rotation_euler[0]=side*.46
 # Billet perimeter lip, ignition coils and internal rounded fin channels.
 for i in range(4):
  x=1.11+i*.175
  attach(cyl('ENGINE_ignition_coil_'+str(side)+'_'+str(i),(x,side*.244,.831),.037,.043,POLY,'Z',16))
  attach(cyl('ENGINE_ignition_lock_'+str(side)+'_'+str(i),(x,side*.244,.856),.020,.016,RECESS,'Z',12))
  attach(cube('ENGINE_cam_finned_casting_'+str(side)+'_'+str(i),(x,side*.34,.782),(.026,.032,.090),MACH,.005))
 # fuel rails on either head and 4 high pressure injectors.
 attach(tube('ENGINE_fuel_rail_'+str(side),[(1.09,side*.42,.710),(1.64,side*.42,.710)],.025,CHROME))
 for i in range(4):
  x=1.105+i*.175
  attach(tube('ENGINE_injector_'+str(side)+'_'+str(i),[(x,side*.42,.710),(x,side*.32,.682)],.012,STEEL))
 # One cast manifold per cylinder with compound bends, feeding the turbo.
 for i in range(4):
  x=1.10+i*.175
  attach(tube('ENGINE_EXHAUST_PRIMARY_'+str(side)+'_'+str(i),
     [(x,side*.43,.615),(x-.045,side*.51,.58),(1.07+.07*i,side*.59,.45),(1.21,side*.57,.408)],
      .021,STEEL))
 # paired rails along exposed cam covers
 for j in range(2):
  attach(tube('ENGINE_head_oil_galley_'+str(side)+'_'+str(j),[(1.06,side*(.31+j*.045),.775),(1.70,side*(.31+j*.045),.775)],.009,MACH))
# Top center carbon composite plenum and eight tubular intake runners.
plenum=attach(cube('ENGINE_carbon_intake_plenum',(1.38,0,.813),(.66,.235,.116),CARBON,.051))
attach(cube('ENGINE_billet_throttle_body',(1.84,0,.804),(.18,.22,.18),MACH,.034))
attach(cyl('ENGINE_electronic_throttle_butterfly',(1.928,0,.81),.072,.028,DARK,'X',32))
for side in (-1,1):
 for i in range(4):
  x=1.10+i*.175
  attach(tube('ENGINE_ribbed_intake_runner_'+str(side)+'_'+str(i),
     [(x,side*.11,.817),(x+.018,side*.22,.82),(x,side*.33,.743)],.033,CAST))
# Two 3D snail-shaped hot-side turbocharger housings, compressors and shaft noses.
for side in (-1,1):
 x=1.035;y=side*.57;z=.435
 attach(tor('TURBO_twin_scroll_turbine_'+str(side),(x,y,z),.100,.049,CAST,'Y',40,12))
 attach(tor('TURBO_compressor_lip_'+str(side),(x, y+side*.042,z),.083,.018,MACH,'Y',40,10))
 attach(cyl('TURBO_compressor_hub_'+str(side),(x,y+side*.069,z),.033,.02,DARK,'Y',24))
 attach(cube('TURBO_wastegate_actuator_'+str(side),(x-.15,y,z+.08),(.18,.06,.08),CAST,.02))
 attach(tube('TURBO_turbine_to_exhaust_'+str(side),[(x-.05,y,z-.06),(.89,side*.58,.32),(.80,side*.61,.34)],.055,STEEL))
 attach(tube('TURBO_compressor_outlet_'+str(side),[(x+.07,y,z+.11),(1.20,side*.68,.64),(1.62,side*.60,.73),(1.79,side*.22,.79)],.042,BLUE))
 for j in range(2):
  attach(cyl('TURBO_clamp_'+str(side)+'_'+str(j),(1.2+j*.4,side*(.67-.06*j),.64+.07*j),.05,.014,MACH,'Y',24))
# Four auxiliary pulleys with physically shaped belt path on the X-facing accessory plane.
pulleys=[(.0,.47,.144),(-.18,.58,.079),(.21,.64,.067),(.31,.39,.062)]
for i,(y,z,r) in enumerate(pulleys):
 attach(cyl('ACCESSORY_pulley_'+str(i),(1.865,y,z),r,.052,DARK,'X',44))
 attach(cyl('ACCESSORY_center_fastener_'+str(i),(1.900,y,z),r*.30,.015,STEEL,'X',20))
 attach(tor('ACCESSORY_belt_retaining_lip_'+str(i),(1.897,y,z),r*.91,.008,MACH,'X',44,8))
# Rubber serpentine belt; path in front plane, looping past four pulleys.
belt=[(-.17,.732),(.195,.718),(.30,.46),(.205,.340),(-.035,.315),(-.182,.505),(-.17,.732)]
attach(tube('ACCESSORY_serpentine_belt',[(1.910,y,z) for y,z in belt],.014,POLY))
# Alternator with distinctive radial cooling vents and studs.
attach(cyl('ACCESSORY_alternator',(1.71,-.45,.54),.108,.21,CAST,'X',44))
for k in range(16):
 a=k*2*math.pi/16
 y=-.45+.107*math.cos(a);z=.54+.107*math.sin(a)
 attach(cube('ACCESSORY_alternator_vent_'+str(k),(1.82,y,z),(.017,.017,.048),DARK,.003))
# Intake air boxes, piping and heat exchangers, genuine under-hood components.
for side in (-1,1):
 attach(cube('BAY_air_filter_'+str(side),(1.82,side*.53,.49),(.25,.25,.16),POLY,.037))
 attach(tube('BAY_filter_to_turbo_'+str(side),[(1.79,side*.54,.58),(1.57,side*.57,.55),(1.12,side*.58,.50)],.053,POLY))
attach(cube('BAY_intercooler_core',(2.02,0,.51),(.116,1.02,.34),STEEL,.017))
for i in range(18):
 z=.37+i*.017
 attach(cube('BAY_intercooler_fin_'+str(i),(2.095,0,z),(.010,1.0,.009),CAST,.002))
attach(cube('BAY_coolant_reservoir',(.80,-.54,.59),(.22,.18,.21),CAST,.032))
attach(cyl('BAY_coolant_cap',(.80,-.54,.71),.058,.028,DARK,'Z',24))
attach(cube('BAY_12V_AGM_battery',(.83,.55,.51),(.26,.21,.21),POLY,.027))
attach(cube('BAY_12V_positive_terminal',(.83,.55,.632),(.105,.063,.029),YELLOW,.012))
attach(tube('BAY_chassis_brace',[(.79,-.69,.71),(1.05,0,.83),(.79,.69,.71)],.029,STEEL))
# High-end technical detail: bolt hex heads all batched into a single mesh.
verts=[];faces=[]
def bolt_at(x,y,z,rad=.011,h=.011):
 start=len(verts)
 for dz in (0,h):
  for k in range(6):
   a=k*math.tau/6;verts.append((x+rad*math.cos(a),y+rad*math.sin(a),z+dz))
 for k in range(6):
  a=start+k;b=start+(k+1)%6
  faces.append((a,b,b+6,a+6))
 faces.append(tuple(range(start,start+6)))
 faces.append(tuple(range(start+6,start+12)))
for side in (-1,1):
 for x in [1.05+i*.08 for i in range(9)]:
  for y in (side*.18,side*.39):
   bolt_at(x,y,.82)
 for x in (1.02,1.20,1.38,1.55,1.72):
  bolt_at(x,side*.28,.44)
for x in (1.08,1.67):
 for y in (-.25,0,.25):bolt_at(x,y,.86,.012,.008)
md=bpy.data.meshes.new('ENGINE_assembly_fasteners_mesh')
md.from_pydata(verts,[],faces);md.update()
bo=bpy.data.objects.new('ENGINE_84_hex_fasteners_batched',md);scene.collection.objects.link(bo);md.materials.append(BOLT);attach(bo)
# Braided ignition wiring harness and routed sensors near bank ends.
for side in (-1,1):
 attach(tube('ENGINE_main_harness_'+str(side),[(.89,side*.37,.56),(1.14,side*.43,.66),(1.62,side*.42,.78)],.014,HOSE))
 for i in range(4):
  x=1.11+i*.175
  attach(tube('ENGINE_coil_wiring_'+str(side)+'_'+str(i),
    [(x,side*.42,.75),(x,side*.33,.82),(x,side*.24,.853)],.008,POLY))
 for i in range(3):
  x=1.18+i*.23
  attach(cyl('ENGINE_hose_clamp_'+str(side)+'_'+str(i),(x,side*.59,.49),.046,.013,MACH,'Y',20))
# Optional technical identification plaque for original engine, no trademarks.
attach(cube('ENGINE_V8TT_identification_plate',(1.33,0,.872),(.29,.15,.012),MACH,.007))
# Footprint and intensity are procedural representations; no real engine manufacturer's CAD.
scene.frame_set(40)
scene.render.engine='BLENDER_EEVEE'
camdat=bpy.data.cameras.new('CAM_engine_under_hood')
cam=bpy.data.objects.new('CAM_engine_under_hood',camdat)
scene.collection.objects.link(cam)
cam.location=(3.3,-2.7,2.9)
cam.rotation_euler=(Vector((1.42,0,.68))-cam.location).to_track_quat('-Z','Y').to_euler()
camdat.lens=69
# Engine assembly is kept editable via root, keyed assembly and semantic names.
result={'stage':'engine','engine':'4.0 V8 twin turbo','engine_parts':len(engine_root.children),'visible_engine_components':len([o for o in bpy.data.objects if o.name.startswith(('ENGINE_','TURBO_','ACCESSORY_','BAY_'))]),'batched_fastener_count':len(verts)//12,'total_objects':len(bpy.data.objects),'camera':cam.name}
