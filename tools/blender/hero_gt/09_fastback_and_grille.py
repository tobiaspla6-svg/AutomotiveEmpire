"""AE GT-RS v2.3: cab-rearward grand-tourer glass and rounded trapezoid nose.

Updates actual editable Blender vertices, window framing and genuine open
front grille mesh. No image-generation dependence, no real-car branding.
"""
import bpy,math
from mathutils import Vector
S=bpy.context.scene;S.frame_set(1)
PAINT=bpy.data.materials['GT_paint_deep_ochre_gold']
BLACK=bpy.data.materials['GT_gloss_black']
SILVER=bpy.data.materials['GT_machined_alloy']
VENT=bpy.data.materials['GT_duct_depth']
CARBON=bpy.data.materials['GT_carbon_satin']
GLASS=bpy.data.materials['GT_dark_glass']
def clamp(x):return max(0.0,min(1.0,x))
def sg(x,p):return math.copysign(abs(x)**p,x)
def create_mesh(name,pts,faces,mat):
    m=bpy.data.meshes.new(name+'_mesh');m.from_pydata(pts,[],faces);m.update()
    o=bpy.data.objects.new(name,m);S.collection.objects.link(o);m.materials.append(mat)
    for p in m.polygons:p.use_smooth=True
    return o
def line(name,pts,r,mat):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.bevel_depth=r;cu.bevel_resolution=3
    sp=cu.splines.new('POLY');sp.points.add(len(pts)-1)
    for v,p in zip(sp.points,pts):v.co=(*p,1)
    ob=bpy.data.objects.new(name,cu);S.collection.objects.link(ob);cu.materials.append(mat);return ob
def delete(names):
    for n in names:
        ob=bpy.data.objects.get(n)
        if ob:bpy.data.objects.remove(ob,do_unlink=True)
# A low, cab-rearward, fastback greenhouse is fundamental to a real front-engine GT.
def coupe_glass_coordinate(x,y,z):
    # Windshield moves rearward 22cm; glass roof sinks 7cm; rear trailing foot stays put.
    shift=.22*clamp((x+1.52)/1.85)
    xx=x-shift
    zz=.903+(z-.903)*.836 if z>.903 else z
    # Rounded convex side glazing rather than a completely flat polygon.
    y2=y+math.copysign(.017*math.sin(math.pi*clamp((z-.90)/.44))*.88,y)
    return xx,y2,zz
for o in list(bpy.data.objects):
    if o.type=='MESH' and (o.name.startswith('GLASS_') or o.name=='BODY_carbon_roof'):
        for vert in o.data.vertices:
            x,y,z=vert.co
            vert.co=coupe_glass_coordinate(x,y,z)
        o.data.update()
    elif o.type=='CURVE' and (o.name.startswith('SEAM_A_pillar') or
       o.name.startswith('SEAM_B_pillar') or o.name.startswith('SEAM_C_pillar') or
       o.name.startswith('SEAM_side_top_trim') or o.name.startswith('SEAM_side_belt_trim') or
       o.name.startswith('EXTERIOR_windscreen_')):
        for spl in o.data.splines:
            for p in spl.points:
                x,y,z,_=p.co
                p.co=(*coupe_glass_coordinate(x,y,z),1)
# The paint-side shoulder acquires a real crease and concave sculpting under
# door windows. Near-zero influence on wheel openings and front/rear fenders.
for name,side in [('BODY_side_cutout_L',1),('BODY_side_cutout_R',-1)]:
    obj=bpy.data.objects[name]
    for v in obj.data.vertices:
        x,y,z=v.co
        if -.82<x<.55:
            t=clamp((z-.28)/.64)
            wt=math.exp(-((x+.18)/.73)**4)
            swell=.052*math.exp(-((t-.85)/.17)**2)
            hollow=.065*math.exp(-((t-.47)/.26)**2)
            v.co.y=y+side*wt*(swell-hollow)
    obj.data.update()
# Lower the roof's carbon clearcoat intensity so showroom light doesn't turn
# the previously all-white glass panel into an opaque chrome mirror.
p=GLASS.node_tree.nodes.get('Principled BSDF')
p.inputs['Base Color'].default_value=(.008,.017,.027,1)
p.inputs['Metallic'].default_value=.09
p.inputs['Roughness'].default_value=.155
p.inputs['Transmission Weight'].default_value=.07
p.inputs['Coat Weight'].default_value=.48
cb=CARBON.node_tree.nodes.get('Principled BSDF')
cb.inputs['Roughness'].default_value=.43
cb.inputs['Metallic'].default_value=.16
# Purposefully deep trapezoidal grille opening, not a giant flat oval pasted
# on a squared nose. New surfacing maintains real face cutouts.
def nose_x(y,z):
    q=clamp(abs(y)/.94)
    return 2.284+.113*(1-q**1.65)+.020*math.sin(math.pi*clamp((z-.22)/.64))-.023*q*q-.245*q**2.2+.038*(1-q*q)*math.exp(-((z-.54)/.26)**2)
def top_height(y):return .746+.100*clamp(abs(y)/.955)**1.35
def ghalf(z):
    return .503+.107*clamp((z-.32)/.42)
def inside_grille(y,z):
    return (abs(y)/ghalf(z))**3.15+(abs(z-.526)/.209)**2.92<1.06
def inside_duct(y,z,side):
    return ((y-side*.741)/.145)**2+((z-.417)/.125)**2<1.01
delete(['SURF_front_curved_nose','SURF_grille_black_cavity',
        'SURF_grille_precision_outer_lip','SURF_grille_chrome_inner_edge']+
        [n for n in list(bpy.data.objects.keys()) if n.startswith('SURF_grille_forged_vertical_')])
NU,NZ=172,68
verts=[]
for i in range(NU+1):
    y=-.955+1.91*i/NU
    for j in range(NZ+1):
        t=j/NZ;z=.235+t*(top_height(y)-.235)
        verts.append((nose_x(y,z),y,z))
faces=[]
for i in range(NU):
    for j in range(NZ):
        y=-.955+1.91*(i+.5)/NU
        z=.235+(j+.5)/NZ*(top_height(y)-.235)
        if inside_grille(y,z) or inside_duct(y,z,1) or inside_duct(y,z,-1):continue
        a=i*(NZ+1)+j
        faces.append((a,a+1,a+NZ+2,a+NZ+1))
create_mesh('SURF_front_curved_nose',verts,faces,PAINT)
def ring(y_factor=1,z_factor=1,back=0):
    coords=[]
    for i in range(121):
        th=math.tau*i/120
        z=.526+.209*z_factor*sg(math.sin(th),.62)
        y=ghalf(z)*y_factor*sg(math.cos(th),.63)
        coords.append((nose_x(y,z)+back,y,z))
    return coords
line('SURF_grille_precision_outer_lip',ring(1.04,1.02,.009),.014,BLACK)
line('SURF_grille_chrome_inner_edge',ring(1.015,1.004,.016),.004,SILVER)
rim=ring(1.015,1.004,-.09)
pts=[(2.15,0,.526)]+rim
faces=[(0,i,i+1) for i in range(1,len(rim))]
create_mesh('SURF_grille_black_cavity',pts,faces,VENT)
for i in range(17):
    y=(i-8)*.061
    inside=[.321+.42*j/100 for j in range(101) if inside_grille(y,.321+.42*j/100)]
    if not inside:continue
    lo=min(inside)+.011;hi=max(inside)-.011
    pts=[(nose_x(y,lo+(hi-lo)*j/14)+.030+.008*math.sin(math.pi*j/14),y,
          lo+(hi-lo)*j/14) for j in range(15)]
    line('SURF_grille_forged_vertical_'+str(i),pts,.010,SILVER)
# Narrow central cowl between new windshield foot and bonnet rear.
rows=[]
for i in range(19):
    x=.34+.24*i/18
    row=[]
    for j in range(33):
        q=-1+2*j/32;y=.76*q
        z=.955+.020*(i/18)-.018*q*q
        row.append((x,y,z))
    rows.append(row)
NV=len(rows[0]);verts=[p for row in rows for p in row]
faces=[(i*NV+j,i*NV+j+1,(i+1)*NV+j+1,(i+1)*NV+j) for i in range(len(rows)-1) for j in range(NV-1)]
create_mesh('SURF_cowl_below_windshield',verts,faces,PAINT)
S.frame_set(1)
result={'phase':'9_gt_glass_and_grille','nose_faces':len(bpy.data.objects['SURF_front_curved_nose'].data.polygons),
        'roof_height':round(max(v.co.z for v in bpy.data.objects['BODY_carbon_roof'].data.vertices),3),
        'bars':len([x for x in bpy.data.objects.keys() if x.startswith('SURF_grille_forged_vertical_')]),
        'objects':len(bpy.data.objects)}
