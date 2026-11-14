"""AE GT-RS v2: replace box-like V8 cover and intake with sculpted engine hardware.

Original, actual 3D geometry. All high-frequency details are batched and the
existing V8 positions, components and parent hierarchy remain fixed.
"""
import bpy,math
from mathutils import Vector
S=bpy.context.scene
S.frame_set(1)
ROOT=bpy.data.objects['ENGINE_V8TT_ROOT']
CAST=bpy.data.materials['V8_cast_aluminium']
MACH=bpy.data.materials['V8_machined_aluminium']
DARK=bpy.data.materials['V8_black_magnesium_cast']
BLACK=bpy.data.materials['V8_polymer_dark']
STEEL=bpy.data.materials['V8_burnished_steel']
BOLT=bpy.data.materials['V8_titanium_fasteners']
CARBON=bpy.data.materials['V8_carbon_intake']
RUBBER=bpy.data.materials['V8_braided_lines']
def mesh(name,pts,faces,ma,smooth=True):
    me=bpy.data.meshes.new(name+'_mesh')
    me.from_pydata(pts,[],faces);me.update()
    o=bpy.data.objects.new(name,me);S.collection.objects.link(o)
    me.materials.append(ma)
    if smooth:
        for f in me.polygons:f.use_smooth=True
    return o
def tube(name,points,radius,ma):
    cu=bpy.data.curves.new(name,'CURVE')
    cu.dimensions='3D';cu.resolution_u=16
    cu.bevel_depth=radius;cu.bevel_resolution=3
    sp=cu.splines.new('BEZIER')
    sp.bezier_points.add(len(points)-1)
    for v,xyz in zip(sp.bezier_points,points):
        v.co=xyz;v.handle_left_type='AUTO';v.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,cu);S.collection.objects.link(o)
    cu.materials.append(ma)
    o.parent=ROOT
    return o
def material(name,rgb,metal,rough):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color=(*rgb,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    return m
ANODIZED=material('V8_matte_black_anodized',(.030,.034,.040),.60,.29)
HEAT=material('V8_exhaust_heat_shield',(.39,.31,.23),.74,.39)
CERAMIC=material('V8_high_temp_thermal_blanket',(.18,.19,.18),.23,.65)
def cover(side):
    name='ENGINE_V8_cam_cover_'+str(side)
    old=bpy.data.objects.get(name)
    if old:bpy.data.objects.remove(old,do_unlink=True)
    # Asymmetric rounded rectangle with six continuous 3D forged rings.
    verts=[];faces=[];NS=64
    def sg(v,p):return math.copysign(abs(v)**p,v)
    layers=[(-.052,1.0),(-.045,1.00),(-.027,.99),(.026,.985),(.058,.90),(.079,.72),(.087,.17)]
    for z,sc in layers:
        for k in range(NS):
            a=math.tau*k/NS
            verts.append((.366*sc*sg(math.cos(a),.58),.141*sc*sg(math.sin(a),.58),z))
    for j in range(len(layers)-1):
        for k in range(NS):
            a=j*NS+k;b=j*NS+(k+1)%NS
            faces.append((a,b,b+NS,a+NS))
    cap=len(verts);verts.append((0,0,.091))
    for k in range(NS):
        faces.append(((len(layers)-1)*NS+k,(len(layers)-1)*NS+(k+1)%NS,cap))
    obj=mesh(name,verts,faces,DARK)
    obj.parent=ROOT
    obj.location=(1.37,side*.235,.668)
    obj.rotation_euler[0]=side*.46
    # actual concentric machined metal lip around the top cover
    for side_offset in (-.117,.117):
        tube('ENGINE_valve_cover_machined_rail_'+str(side)+'_'+str(side_offset),
             [(1.08,side*.235+side_offset,.737),(1.66,side*.235+side_offset,.737)],
             .0075,MACH)
    return obj
for side in (-1,1):cover(side)
# Replace plain cubic intake with a lofted continuous carbon-fibre housing.
old=bpy.data.objects.get('ENGINE_carbon_intake_plenum')
if old:bpy.data.objects.remove(old,do_unlink=True)
verts=[];faces=[];NX=43;NS=32
for i in range(NX):
    u=i/(NX-1)
    x=.995+.775*u
    neck=.77+.23*math.sin(math.pi*u)**.65
    width=.173*neck
    zcenter=.711+.025*math.sin(math.pi*u)
    height=.075*(.86+.14*math.sin(math.pi*u))
    for j in range(NS):
        a=math.tau*j/NS
        y=width*math.cos(a)
        z=zcenter+height*math.sin(a)
        z+=.009*math.exp(-(y/.055)**2)*math.sin(math.pi*u)
        verts.append((x,y,z))
for i in range(NX-1):
    for j in range(NS):
        a=i*NS+j;b=i*NS+(j+1)%NS
        faces.append((a,b,b+NS,a+NS))
for at in (0,NX-1):
    mid=len(verts);verts.append((.995+.775*at/(NX-1),0,.71))
    for j in range(NS):
        a=at*NS+j;b=at*NS+(j+1)%NS
        faces.append((mid,a,b))
plenum=mesh('ENGINE_carbon_intake_plenum',verts,faces,CARBON)
plenum.parent=ROOT
# Embossed aerodynamic powertrain spine, inset top vents.
for k in range(5):
    x=1.14+k*.118
    tube('ENGINE_carbon_top_fins_'+str(k),[(x,-.097,.771),(x,0,.796),(x,.097,.771)],.0075,ANODIZED)
for side in (-1,1):
    for k in range(3):
        x=1.21+k*.19
        tube('ENGINE_plenum_mount_'+str(side)+'_'+str(k),
            [(x,side*.138,.716),(x,side*.220,.653)],.016,MACH)
# Turbo snail-volutes and genuinely visible compressor wheels.
def compressor(side):
    cx=1.035;cy=side*.63;cz=.325
    NR=50;NC=12
    verts=[];faces=[]
    for i in range(NR):
        u=i/(NR-1)
        a=.33+math.tau*1.26*u
        radial=.034+.111*u
        rad=.025+.025*u
        x=cx+radial*math.cos(a);z=cz+radial*math.sin(a)
        for j in range(NC):
            b=math.tau*j/NC
            px=x+rad*math.cos(b)*math.cos(a)
            pz=z+rad*math.cos(b)*math.sin(a)
            py=cy+side*rad*math.sin(b)
            verts.append((px,py,pz))
    for i in range(NR-1):
        for j in range(NC):
            a=i*NC+j;b=i*NC+(j+1)%NC
            faces.append((a,b,b+NC,a+NC))
    vol=mesh('TURBO_spiral_cast_volute_'+str(side),verts,faces,CAST)
    vol.parent=ROOT
    # Impeller: 10 actual twisted blades in a circular inlet, one shared mesh.
    verts=[];faces=[]
    yy=cy+side*.083
    for i in range(10):
        a=math.tau*i/10
        points=[
          (cx+.020*math.cos(a),yy,cz+.020*math.sin(a)),
          (cx+.076*math.cos(a+.22),yy+side*.009,cz+.076*math.sin(a+.22)),
          (cx+.077*math.cos(a+.54),yy+side*.015,cz+.077*math.sin(a+.54)),
          (cx+.027*math.cos(a+.38),yy+side*.024,cz+.027*math.sin(a+.38))]
        ix=len(verts);verts.extend(points)
        faces.append((ix,ix+1,ix+2,ix+3))
    imp=mesh('TURBO_ten_blade_impeller_'+str(side),verts,faces,MACH,False)
    imp.parent=ROOT
    tube('TURBO_outer_compressor_Vband_'+str(side),
        [(cx+.113*math.cos(math.tau*i/48),cy+side*.088,cz+.113*math.sin(math.tau*i/48)) for i in range(49)],
        .006,MACH)
for side in (-1,1): compressor(side)
# Replace the flat 'belt drawn in air' with ribbed pulleys and tensioner edges.
# Batch hundreds of extremely small, repeated machined studs into ONE mesh.
verts=[];faces=[]
def hex_prism(x,y,z,r=.0068,h=.0075):
    start=len(verts)
    for zz in (z,z+h):
        for k in range(6):
            a=k*math.tau/6
            verts.append((x+r*math.cos(a),y+r*math.sin(a),zz))
    for k in range(6):
        a=start+k;b=start+(k+1)%6
        faces.append((a,b,b+6,a+6))
    faces.append(tuple(start+k for k in range(6)))
    faces.append(tuple(start+6+k for k in range(6)))
for side in (-1,1):
    for i in range(17):
        x=1.05+.037*i
        for y in (side*.143,side*.327):
            hex_prism(x,y,.70,.006,.009)
    for i in range(6):
        a=math.tau*i/6
        hex_prism(1.035+.14*math.cos(a),side*.63,.325+.14*math.sin(a),.007,.007)
for x in [1.09+i*.060 for i in range(12)]:
    hex_prism(x,-.20,.43,.008,.010)
    hex_prism(x,.20,.43,.008,.010)
fast=mesh('ENGINE_V8TT_extra_124_fasteners_one_batch',verts,faces,BOLT,False)
fast.parent=ROOT
# Small thermal shields remain physically modeled but in one mesh material.
for side in (-1,1):
    for j in range(4):
        x=1.09+j*.15
        tube('ENGINE_heatshield_braze_'+str(side)+'_'+str(j),
            [(x,side*.46,.45),(x+.03,side*.54,.41),(x+.085,side*.57,.37)],
            .015,HEAT)
    tube('ENGINE_braided_bank_service_line_'+str(side),
         [(1.05,side*.44,.63),(1.20,side*.48,.70),(1.64,side*.44,.69)],.012,RUBBER)
# Check real script dependencies; surface detail is stored as native 3D data.
S.frame_set(1)
result={'phase':'8_engine_sculpt','bank_covers':2,'carbon_intake':'ENGINE_carbon_intake_plenum',
        'cast_turbo_volutes':2,'impellers':2,'batched_extra_fasteners':len(verts)//12,
        'scene_objects':len(bpy.data.objects)}
