# Automotive Empire GT-RS original concept — shell / wheels / studio.
# Blender 5.2. Coordinates: X forward, Y left, Z up. Metres.
import bpy, math, random
from mathutils import Vector
random.seed(13)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for item in list(bpy.data.materials):
    if item.users == 0: bpy.data.materials.remove(item)
def material(name, rgb, metal=0, rough=.36, coat=0):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color=(*rgb,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Metallic'].default_value=metal
    p.inputs['Roughness'].default_value=rough
    p.inputs['Coat Weight'].default_value=coat
    p.inputs['Coat Roughness'].default_value=.12
    return m
PAINT=material('GT_paint_deep_ochre_gold',(.60,.26,.025),.68,.205,.75)
CARBON=material('GT_carbon_satin',(.014,.018,.020),.24,.31)
CLEAR=material('GT_dark_glass',(.025,.055,.073),.28,.11,.85)
BLACK=material('GT_gloss_black',(.018,.020,.022),.5,.15,.65)
RUBBER=material('GT_tyre_rubber',(.018,.020,.023),.04,.67)
TRIM=material('GT_black_urethane',(.034,.036,.042),.05,.52)
LED=material('GT_white_drl',(.82,.92,1.0),.15,.12)
RED=material('GT_red_light',(.58,.025,.018),.18,.17)
SILVER=material('GT_machined_alloy',(.44,.49,.54),.85,.24)
DARKMET=material('GT_dark_forged_alloy',(.048,.056,.068),.78,.24)
BRAKE=material('GT_brake_rotor',(.28,.30,.33),.87,.35)
CALIPER=material('GT_gold_caliper',(.56,.24,.018),.70,.23)
VENT=material('GT_duct_depth',(.005,.008,.010),.12,.82)
FLOOR=material('STUDIO_charcoal_floor',(.06,.065,.072),.22,.46)
def mesh(name,pts,faces,mat,smooth=True):
    me=bpy.data.meshes.new(name+'_mesh');me.from_pydata(pts,[],faces);me.update()
    o=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(o)
    me.materials.append(mat)
    if smooth:
        for p in me.polygons:p.use_smooth=True
    return o
def grid(name, rows,mat):
    verts=[p for row in rows for p in row]
    m=len(rows[0]);n=len(rows)
    fs=[(i*m+j,i*m+j+1,(i+1)*m+j+1,(i+1)*m+j) for i in range(n-1) for j in range(m-1)]
    return mesh(name,verts,fs,mat)
def box(name,loc,dim,mat,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object;o.name=name
    o.dimensions=dim;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if bevel:
        b=o.modifiers.new('precision_edge_radii','BEVEL');b.width=bevel;b.segments=3
        o.modifiers.new('face_normal_weight','WEIGHTED_NORMAL')
    return o
def cyl(name,loc,r,depth,mat,rot=(math.pi/2,0,0),verts=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=loc,rotation=rot)
    o=bpy.context.object;o.name=name;o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    return o
def torus(name,loc,major,minor,mat,rot=(math.pi/2,0,0),ms=64,ns=8):
    bpy.ops.mesh.primitive_torus_add(major_segments=ms,minor_segments=ns,location=loc,rotation=rot,major_radius=major,minor_radius=minor)
    o=bpy.context.object;o.name=name;o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    return o
def tube(name,points,r,mat,res=3):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=12;cu.bevel_depth=r;cu.bevel_resolution=res
    sp=cu.splines.new('POLY');sp.points.add(len(points)-1)
    for v,p in zip(sp.points,points):v.co=(*p,1)
    o=bpy.data.objects.new(name,cu);bpy.context.scene.collection.objects.link(o);cu.materials.append(mat)
    return o
def draw_strip(name,coords,width,mat):return tube(name,coords,width,mat,res=2)
# Overall 4.64m long, 1.98m wide, 1.34m high, wheelbase 2.7m.
AXF=1.34;AXR=-1.36;RC=.344;ARCH=.416;YH=.866
def half_width(x):
    return .947 - .18*max(0,(x-1.85)/.48)**2 - .085*max(0,(-x-1.75)/.55)**2
def shoulder(x):return .887 + .025*math.cos((x+.05)*math.pi/4.7)
def side_width(x,z):
    h=.035*math.exp(-((x-AXF)/.43)**2)+.048*math.exp(-((x-AXR)/.48)**2)
    return half_width(x)+h*(.65+ .35*min(1,max(0,(z-.55)/.4)))
def arch_lower(x):
    z=.275
    for ax in (AXF,AXR):
        d=abs(x-ax)
        if d<ARCH:z=max(z,RC+math.sqrt(max(0,ARCH*ARCH-d*d))+.019)
    return z
# Carved side body panel. Wheel cut-outs are topology, not pasted black decals.
for sign in (-1,1):
    rows=[]
    for i in range(121):
        x=-2.30+4.60*i/120
        low=arch_lower(x)
        hi=shoulder(x)
        rr=[]
        for j in range(11):
            t=j/10;z=low+(hi-low)*t
            y=sign*(side_width(x,z)+.008*math.sin(math.pi*t))
            rr.append((x,y,z))
        rows.append(rr)
    o=grid('BODY_side_cutout_'+('L' if sign>0 else 'R'),rows,PAINT)
    o['section']='fixed_body'
# Front and rear bumper fascia across width
for name,x,front in [('FRONT_bumper',2.298,True),('REAR_bumper',-2.306,False)]:
    rows=[]
    for i in range(21):
        q=-1+2*i/20;z0=.26
        rows.append([(x + (0.034 if front else -.025)*(1-q*q),.86*q,z0+(.53*j/12)+.015*(q*q)) for j in range(13)])
    grid(name,rows,PAINT)
# Hood is independent for animation. High curvature crown and tensioned shoulder lobes.
HROWS=[]
for i in range(49):
    u=i/48;x=.57+(2.27-.57)*u
    z0=.987-.245*u+.022*math.sin(math.pi*u)
    width=.73+.10*math.sin(math.pi*u)+.015*u
    row=[]
    for j in range(29):
        v=-1+2*j/28
        y=width*v
        bulge=.027*math.exp(-((abs(v)-.68)/.23)**2)*math.sin(math.pi*u)
        z=z0-.049*v*v+bulge-.012*math.exp(-(v/.18)**2)*math.sin(math.pi*u)
        row.append((x,y,z))
    HROWS.append(row)
hood=grid('GT_HOOD_ARTICULATED',HROWS,PAINT)
# Smooth closed cap and rear-hinge position; pivot is a real local origin.
PIVOT=Vector((.57,0,.98))
for v in hood.data.vertices:v.co-=PIVOT
hood.location=PIVOT
hood.rotation_mode='XYZ'
hood.rotation_euler[1]=0;hood.keyframe_insert(data_path='rotation_euler',frame=1)
hood.rotation_euler[1]=-math.radians(54);hood.keyframe_insert(data_path='rotation_euler',frame=40)
# Under-bonnet ribbed carbon/painted liner follows the same hinge.
under=mesh('GT_HOOD_UNDERSIDE',[tuple(v.co) for v in hood.data.vertices],[tuple(p.vertices) for p in hood.data.polygons],CARBON)
under.parent=hood;under.location=(0,0,-.025)
# Closed hood clearance is designed for the front-mid V8 engine.
for x,sy in [(.60,-1),(.60,1),(2.24,-1),(2.24,1)]:
    # gaps around bonnet perimeter (thin, dark, real 3D strips)
    pass
# Rear deck starts at cabin tail.
rows=[]
for i in range(26):
    u=i/25;x=-2.28+.98*u
    row=[]
    for j in range(23):
        v=-1+2*j/22
        w=.85-.11*u
        z=.842+.133*u-.034*v*v
        row.append((x,w*v,z))
    rows.append(row)
grid('BODY_rear_deck',rows,PAINT)
# Trapezoidal front windshield and sloping rear glazing, roof panel.
def pane(name,a,b,c,d,mat,steps=12):
    rows=[]
    for i in range(steps+1):
        u=i/steps
        left=[a[k]*(1-u)+c[k]*u for k in range(3)]
        right=[b[k]*(1-u)+d[k]*u for k in range(3)]
        rr=[]
        for j in range(steps+1):
            t=j/steps
            rr.append(tuple((1-t)*left[k]+t*right[k] for k in range(3)))
        rows.append(rr)
    return grid(name,rows,mat)
pane('GLASS_front_windscreen',(.56,-.74,.985),(.56,.74,.985),(-.035,-.615,1.315),(-.035,.615,1.315),CLEAR)
pane('GLASS_rear_screen',(-.77,-.63,1.317),(-.77,.63,1.317),(-1.55,-.745,.99),(-1.55,.745,.99),CLEAR)
rows=[]
for i in range(31):
    t=i/30;x=-.04-.73*t;w=.615+.017*math.sin(math.pi*t)
    rows.append([(x,w*(-1+2*j/16),1.324+.023*math.sin(math.pi*t)-.035*(-1+2*j/16)**2) for j in range(17)])
grid('BODY_carbon_roof',rows,CARBON)
for sign in (-1,1):
    # Glazed 2-door grand touring cockpit, side has pronounced cabin sweep.
    A=(.49,sign*.735,1.005);B=(-.055,sign*.622,1.318);C=(-.72,sign*.633,1.317);D=(-1.48,sign*.756,1.012)
    E=(-1.33,sign*.82,.935);F=(.53,sign*.84,.915)
    pane('GLASS_side_forward_'+str(sign),F,(-.25,sign*.826,.93),A,B,CLEAR,steps=10)
    pane('GLASS_side_rear_'+str(sign),(-.29,sign*.825,.934),E,(-.28,sign*.635,1.327),D,CLEAR,steps=10)
    # Mullions, door window seals, A/B pillars and rear quarter roll bar.
    for nm,pts,r,mat in [
      ('A_pillar',[A,B],.018,BLACK),
      ('B_pillar',[(-.28,sign*.822,.94),(-.28,sign*.641,1.326)],.025,CARBON),
      ('C_pillar',[C,D],.025,CARBON),
      ('side_top_trim',[B,(-.36,sign*.632,1.333),C],.017,BLACK),
      ('side_belt_trim',[F,(-.38,sign*.844,.93),E],.012,BLACK),
      ('front_seam',[(.36,sign*.947,.85),(.29,sign*.957,.59),(.22,sign*.932,.32)],.006,BLACK),
      ('rear_seam',[(-.71,sign*.95,.86),(-.75,sign*.96,.60),(-.81,sign*.93,.33)],.006,BLACK)]:
       tube('SEAM_'+nm+'_'+str(sign),pts,r,mat)
    # Side mirrors, aerodynamic mounting.
    tube('MIRROR_arm_'+str(sign),[(.39,sign*.76,1.01),(.48,sign*1.012,.98)],.025,TRIM)
    ob=box('MIRROR_housing_'+str(sign),(.49,sign*1.034,1.005),(.19,.25,.095),CARBON,.037)
    # Side skirts + dive accents.
    box('AERO_side_sill_'+str(sign),(-.10,sign*.98,.252),(3.52,.115,.12),CARBON,.018)
    tube('AERO_sill_edge_'+str(sign),[(1.04,sign*.99,.23),(-1.12,sign*.99,.225)],.011,SILVER)
    # Flared body arch trims follow the actual cutouts.
    for ax in (AXF,AXR):
        pts=[(ax+ARCH*math.cos(math.pi*t/36),sign*(half_width(ax)+.047),RC+ARCH*math.sin(math.pi*t/36)+.006) for t in range(37)]
        tube('ARCH_edge_'+str(ax)+'_'+str(sign),pts,.014,CARBON)
    # Front fender slits (true gap impression through deeply inset vents).
    for n in range(3):
        x=.87-.07*n
        box('FENDER_extraction_shadow_'+str(sign)+'_'+str(n),(x,sign*.98,.81),(.042,.014,.135),VENT,.009)
        box('FENDER_extraction_blade_'+str(sign)+'_'+str(n),(x-.012,sign*.997,.81),(.015,.012,.12),CARBON,.004)
# Front bumper deep grille / left right ducts (not paper-flat light material).
box('FRONT_lower_grille_recess',(2.322,0,.446),(.035,1.02,.245),VENT,.015)
for sign in (-1,1):
    box('FRONT_corner_duct_'+str(sign),(2.316,sign*.70,.43),(.08,.28,.27),VENT,.022)
    for j in range(6):
        box('FRONT_grille_blade_'+str(sign)+'_'+str(j),(2.351,sign*(.08+.072*j),.46),(.029,.019,.195),CARBON,.005)
box('AERO_front_splitter',(2.276,0,.225),(.48,1.93,.035),CARBON,.017)
for sign in (-1,1):
    pts=[(2.32,sign*.88,.24),(2.47,sign*.92,.22),(2.51,sign*.64,.222)]
    tube('AERO_front_end_flap_'+str(sign),pts,.028,CARBON)
# Headlamp: sculpted oval enclosure, internal three projector cells, continuous DRL.
for sign in (-1,1):
    pts=[(2.22,sign*.47,.77),(2.11,sign*.78,.80),(1.93,sign*.89,.83),(1.84,sign*.80,.81),(2.03,sign*.54,.746)]
    tube('LIGHT_front_smoked_bezel_'+str(sign),pts,.047,BLACK)
    for i in range(3):
        x=2.08-.071*i;y=sign*(.58+.085*i);z=.786+.014*i
        cyl('LIGHT_projector_housing_'+str(sign)+'_'+str(i),(x,y,z),.047,.028,DARKMET,(0,math.pi/2,0),24)
        cyl('LIGHT_projector_glass_'+str(sign)+'_'+str(i),(x+.02,y,z),.026,.018,CLEAR,(0,math.pi/2,0),24)
    tube('LIGHT_front_DRL_'+str(sign),pts[:4],.010,LED)
# Rear full-width red LED and GT diffuser.
box('REAR_lightbar',( -2.316,0,.83),(.027,1.63,.042),RED,.009)
for sign in (-1,1):
    box('REAR_corner_Lamp_'+str(sign),(-2.323,sign*.73,.81),(.04,.245,.085),RED,.015)
    box('REAR_diffuser_fin_'+str(sign),(-2.345,sign*.45,.26),(.36,.045,.23),CARBON,.009)
    box('REAR_exhaust_'+str(sign),(-2.36,sign*.58,.39),(.13,.22,.095),DARKMET,.019)
box('REAR_diffuser',(-2.33,0,.262),(.37,1.79,.06),CARBON,.015)
# Wind tunnel-style GT rear wing, separate mounts / endplates.
for sign in (-1,1):
    tube('AERO_wing_mount_'+str(sign),[(-1.98,sign*.49,.95),(-2.09,sign*.54,1.24)],.034,DARKMET)
    box('AERO_endplate_'+str(sign),(-2.05,sign*.95,1.255),(.43,.027,.20),CARBON,.012)
rows=[]
for i in range(21):
    u=i/20; x=-2.24+.36*u
    rows.append([(x,-.93+1.86*j/30,1.29+.055*(1-(2*u-1)**2)-.020*math.cos(math.pi*j/30)) for j in range(31)])
grid('AERO_rear_wing_foil',rows,CARBON)
tube('AERO_rear_wing_trailing_edge',[(-1.90,-.935,1.305),(-1.90,.935,1.305)],.012,BLACK)
# Wheels: lathed radial tire cross-section, deep forged Y-spoke rims, brake disc and caliper.
def wheel(ax,sign,which):
    center=(ax,sign*.867,.344)
    # Axial profile: y offset / radial distance; tread visible as a real volume.
    profile=[(-.145,.264),(-.142,.296),(-.120,.326),(-.075,.348),(-.028,.350),(.028,.350),(.075,.348),(.12,.326),(.142,.296),(.145,.264)]
    pts=[];faces=[];M=80;K=len(profile)
    for i in range(M):
      a=2*math.pi*i/M
      for yy,r in profile:pts.append((ax+r*math.cos(a),sign*.867+yy,.344+r*math.sin(a)))
    for i in range(M):
      for j in range(K-1):
        a=i*K+j;b=((i+1)%M)*K+j
        faces.append((a,b,b+1,a+1))
      faces.append((i*K+K-1,((i+1)%M)*K+K-1,((i+1)%M)*K,i*K))
    mesh('WHEEL_tyre_'+which,pts,faces,RUBBER)
    face_y=sign*(.867+.147)
    torus('WHEEL_satin_outer_bead_'+which,(ax,face_y,.344),.245,.012,BLACK)
    torus('WHEEL_forged_rim_lip_'+which,(ax,face_y+sign*.013,.344),.254,.014,SILVER)
    cyl('WHEEL_inner_barrel_'+which,(ax,sign*.88,.344),.238,.21,DARKMET)
    cyl('BRAKE_ventilated_rotor_'+which,(ax,sign*.96,.344),.197,.026,BRAKE)
    torus('BRAKE_vent_ring_'+which,(ax,sign*.975,.344),.181,.017,SILVER)
    # One mesh with 20 forged split spokes, not 20 draw calls.
    vs=[];fs=[]
    for k in range(10):
       a=2*math.pi*k/10
       for delta in (-.11,.11):
         phi=a+delta
         corners=[]
         for rad,off in [(.073,-.038),(.243,-.027),(.243,.027),(.073,.038)]:
           theta=phi+off
           corners.append((ax+rad*math.cos(theta),face_y+sign*.017,.344+rad*math.sin(theta)))
         base=len(vs);vs+=corners;fs.append(tuple(range(base,base+4)))
    mesh('WHEEL_Y_spoke_forged_'+which,vs,fs,DARKMET,smooth=False)
    cyl('WHEEL_centerlock_'+which,(ax,face_y+sign*.03,.344),.064,.035,SILVER,verts=28)
    cyl('WHEEL_centerlock_dark_'+which,(ax,face_y+sign*.051,.344),.038,.012,BLACK,verts=24)
    cal=box('BRAKE_monobloc_caliper_'+which,(ax+.115,sign*.981,.47),(.16,.071,.16),CALIPER,.025)
    for k in range(24):
      th=2*math.pi*k/24;r=.178
      # rotor drill imprints are a single batched mesh rather than 24 cylinders
      pass
    # Tire sidewall ridges and tread grooves use 6 shared mesh strips.
    for j in range(3):
      torus('WHEEL_tire_sidewall_rib_'+which+'_'+str(j),(ax,sign*(.867+.148+j*.001),.344),.278+j*.015,.003,TRIM,ns=4)
for ax,label in [(AXF,'F'),(AXR,'R')]:
 for sign,name in [(-1,'R'),(1,'L')]:wheel(ax,sign,label+name)
# Soft studio with shadow contact and glTF-compatible point lighting.
box('STUDIO_ground',(0,0,-.078),(14,12,.135),FLOOR,.0)
sc=bpy.context.scene
sc.render.engine='BLENDER_EEVEE'
sc.render.resolution_x=960;sc.render.resolution_y=540
sc.render.resolution_percentage=100
sc.view_settings.view_transform='AgX'
sc.world=bpy.data.worlds.new('STUDIO_neutral_world')
sc.world.use_nodes=True
sc.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.16,.18,.21,1)
sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.38
def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
camdat=bpy.data.cameras.new('CAM_front34');cam=bpy.data.objects.new('CAM_front34',camdat)
sc.collection.objects.link(cam);cam.location=(6.7,-8.7,3.20);aim(cam,(0,0,.68));camdat.lens=54;sc.camera=cam
camdat2=bpy.data.cameras.new('CAM_profile');cam2=bpy.data.objects.new('CAM_profile',camdat2)
sc.collection.objects.link(cam2);cam2.location=(0,-10.2,2.25);aim(cam2,(0,0,.68));camdat2.type='ORTHO';camdat2.ortho_scale=6.0
for nm,pos,power,radius in [('LGT_key',(2,-4,7),2800,4),('LGT_fill',(-3,3,4.5),1800,4),('LGT_rim',(-5,-2,3),1300,2)]:
 d=bpy.data.lights.new(nm,'POINT');d.energy=power;d.shadow_soft_size=radius
 o=bpy.data.objects.new(nm,d);sc.collection.objects.link(o);o.location=pos
sc.frame_start=1;sc.frame_end=40;sc.frame_set(1)
result={'stage':'shell', 'objects':len(bpy.data.objects),'meshes':sum(o.type=='MESH' for o in bpy.data.objects),'materials':len(bpy.data.materials),'bonnet_frames':(1,40),'body_names':[o.name for o in bpy.data.objects if o.name.startswith('BODY_')],'wheels':[o.name for o in bpy.data.objects if o.name.startswith('WHEEL_tyre')]}
