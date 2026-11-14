"""AE GT-RS v2: organic hard-surface surfacing, recessed grille and lens forms.

Run AFTER the previous four GT phases. Operates on actual editable Blender mesh
rather than a reference image. The existing bonnet pivot and engine assembly
remain functional. All changes are compatible with Blender 5.2/glTF.
"""
import bpy, math
from mathutils import Vector

S=bpy.context.scene
S.frame_set(1)
PAINT=bpy.data.materials['GT_paint_deep_ochre_gold']
BLACK=bpy.data.materials['GT_gloss_black']
TRIM=bpy.data.materials['GT_black_urethane']
CARBON=bpy.data.materials['GT_carbon_satin']
VENT=bpy.data.materials['GT_duct_depth']
SILVER=bpy.data.materials['GT_machined_alloy']
CLEAR=bpy.data.materials['GT_dark_glass']
LED=bpy.data.materials['GT_white_drl']

def sm(x): return max(0.0,min(1.0,x))
def gaussian(x,center,width):return math.exp(-((x-center)/width)**2)
def created_mesh(name,verts,faces,mat):
    me=bpy.data.meshes.new(name+'_mesh')
    me.from_pydata(verts,[],faces)
    me.update()
    ob=bpy.data.objects.new(name,me)
    S.collection.objects.link(ob)
    me.materials.append(mat)
    for f in me.polygons:f.use_smooth=True
    return ob

def loft(name,rows,mat):
    n=len(rows[0])
    verts=[v for row in rows for v in row]
    faces=[(i*n+j,i*n+j+1,(i+1)*n+j+1,(i+1)*n+j) for i in range(len(rows)-1) for j in range(n-1)]
    return created_mesh(name,verts,faces,mat)

def curve(name,coords,radius,material):
    cu=bpy.data.curves.new(name,'CURVE')
    cu.dimensions='3D';cu.resolution_u=12
    cu.bevel_depth=radius;cu.bevel_resolution=3
    spl=cu.splines.new('POLY')
    spl.points.add(len(coords)-1)
    for bp,pt in zip(spl.points,coords):bp.co=(*pt,1)
    obj=bpy.data.objects.new(name,cu)
    S.collection.objects.link(obj)
    cu.materials.append(material)
    return obj

def remove(names):
    for name in names:
        ob=bpy.data.objects.get(name)
        if ob:bpy.data.objects.remove(ob,do_unlink=True)

# 1. Re-sculpt the long metal sides: raised muscular haunches, hollowed doors,
# three-dimensional rocker sweep, broad shoulder and fender curvature. No decal
# substitute: the actual mesh vertices and their normals change.
for sign,name in ((-1,'BODY_side_cutout_R'),(1,'BODY_side_cutout_L')):
    obj=bpy.data.objects[name]
    for vertex in obj.data.vertices:
        x,y,z=vertex.co
        low=.275
        for axle in (1.34,-1.36):
            d=abs(x-axle)
            if d<.416:
                low=max(low,.344+math.sqrt(max(0,.416**2-d*d))+.019)
        hi=.887+.025*math.cos((x+.05)*math.pi/4.7)
        t=sm((z-low)/max(0.05,hi-low))
        front_taper=.132*sm((x-1.82)/.50)**1.6
        rear_taper=.068*sm((-x-1.75)/.55)**1.5
        major=.901-front_taper-rear_taper
        fender=.064*gaussian(x,1.34,.49)+.085*gaussian(x,-1.36,.53)
        door_indent=.041*gaussian(x,-.15,.86)*gaussian(t,.42,.28)
        lower_waist=-.092*(1-t)**1.8
        upper_crest=.045*gaussian(t,.79,.20)+.022*gaussian(t,.96,.067)
        longitudinal_wake=.019*math.sin((x+2.1)*math.pi/4.5)*math.sin(math.pi*t)
        width=major+fender*(.38+.62*t)+lower_waist+upper_crest-door_indent+longitudinal_wake
        vertex.co.y=sign*width
        vertex.co.z=z+(.016*gaussian(x,.0,1.3)*math.sin(math.pi*t))
    for f in obj.data.polygons:f.use_smooth=True
    # Subdivision smooths the surface without erasing its modeled panel shaping.
    mod=obj.modifiers.get('AE_GT_curvature_surface')
    if not mod: mod=obj.modifiers.new('AE_GT_curvature_surface','SUBSURF')
    mod.levels=1;mod.render_levels=1
    obj.data.update()

# 2. Rework bonnet geometry in the existing articulated mesh. The closed
# panel remains attached to the exact original hinge/frames; underliner follows.
hood=bpy.data.objects['GT_HOOD_ARTICULATED']
for vert in hood.data.vertices:
    x=vert.co.x+hood.location.x
    y=vert.co.y
    u=sm((x-.57)/1.70)
    hw=.73+.10*math.sin(math.pi*u)+.015*u
    v=y/max(hw,.1)
    crown=.987-.245*u+.030*math.sin(math.pi*u)
    power_dome=.063*max(0,math.sin(math.pi*u))**1.3*gaussian(v,0,.48)
    arch_brow=.055*max(0,math.sin(math.pi*u))**.70*gaussian(abs(v),.65,.19)
    central_scoop=-.012*gaussian(v,0,.10)*math.sin(math.pi*u)
    vert.co.z=crown-.068*v*v+power_dome+arch_brow+central_scoop-hood.location.z
hood.data.update()
# Shared geometry duplicates must be updated too; first inspect local vertex
# indices, as they originated from an exact mesh copy before the redesign.
under=bpy.data.objects['GT_HOOD_UNDERSIDE']
assert len(hood.data.vertices)==len(under.data.vertices)
for i,v in enumerate(hood.data.vertices): under.data.vertices[i].co=v.co
under.data.update()

# Bonnet surfacing remains a real object, not a printed pattern.
for sign in (-1,1):
    edge=[]
    for k in range(41):
        u=k/40;x=.57+1.70*u
        hw=.73+.10*math.sin(math.pi*u)+.015*u
        v=sign*.99
        crown=.987-.245*u+.030*math.sin(math.pi*u)
        z=crown-.068*.99**2+.063*math.sin(math.pi*u)**1.3*gaussian(v,0,.48)+.055*math.sin(math.pi*u)**.70*gaussian(.99,.65,.19)-.012*gaussian(v,0,.10)*math.sin(math.pi*u)
        edge.append((x,sign*hw*.99,z+.003))
    # Parent to the original moving hood while preserving world coordinates.
    ob=curve('SURF_hood_seam_'+str(sign),edge,.0045,BLACK)
    bpy.context.view_layer.update()
    mw=ob.matrix_world.copy()
    ob.parent=hood
    ob.matrix_world=mw

# 3. Replace the completely flat fascia with a curved sculpted nose.
# Actual cut-outs: grille and twin side ducts are absences in the surface.
remove(['FRONT_bumper','FRONT_lower_grille_recess',
        'FRONT_corner_duct_-1','FRONT_corner_duct_1']+
       [n for n in list(bpy.data.objects.keys()) if n.startswith('FRONT_grille_blade_')])
def nose_x(y,z):
    q=abs(y)/.94
    return 2.284+.113*(1-sm(q)**1.65)+.020*math.sin(math.pi*sm((z-.22)/.64))-.023*q*q
def grille_area(y,z):
    return (y/.545)**2+((z-.528)/.200)**2
def duct_area(y,z,side):
    return ((y-side*.741)/.145)**2+((z-.417)/.125)**2
nu,nz=180,68
verts=[]
for i in range(nu+1):
    y=-.955+1.91*i/nu
    for j in range(nz+1):
        z=.235+.605*j/nz
        x=nose_x(y,z)
        verts.append((x,y,z))
faces=[]
for i in range(nu):
    for j in range(nz):
        ya=-.955+1.91*(i+.5)/nu
        za=.235+.605*(j+.5)/nz
        if grille_area(ya,za)<1.03:continue
        if duct_area(ya,za,-1)<1.01 or duct_area(ya,za,1)<1.01:continue
        a=i*(nz+1)+j
        faces.append((a,a+1,a+nz+2,a+nz+1))
surface=created_mesh('SURF_front_curved_nose',verts,faces,PAINT)

def oval_ring(name,yc,zc,ry,rz,mat,r=.010,back=.0,steps=112):
    pts=[]
    for i in range(steps+1):
        theta=2*math.pi*i/steps
        y=yc+ry*math.cos(theta);z=zc+rz*math.sin(theta)
        pts.append((nose_x(y,z)+back,y,z))
    return curve(name,pts,r,mat)

def oval_back(name,yc,zc,ry,rz,mat,back=.09,segments=76):
    verts=[(nose_x(yc,zc)-back,yc,zc)]
    for i in range(segments+1):
        t=2*math.pi*i/segments
        y=yc+ry*math.cos(t);z=zc+rz*math.sin(t)
        verts.append((nose_x(y,z)-back,y,z))
    fs=[(0,i,i+1) for i in range(1,segments+1)]
    return created_mesh(name,verts,fs,mat)

oval_back('SURF_grille_black_cavity',0,.528,.555,.209,VENT,.11)
oval_ring('SURF_grille_precision_outer_lip',0,.528,.558,.207,BLACK,.021,back=.006)
oval_ring('SURF_grille_chrome_inner_edge',0,.528,.536,.192,SILVER,.005,back=.014)
# 15 authentic vertical air-guiding grille bars following the elliptical opening;
# bars have a curved three-dimensional profile and dark end terminals.
for i in range(15):
    y=(i-7)*.068
    frac=math.sqrt(max(.06,1-(y/.545)**2))
    zlo=.528-.190*frac
    zhi=.528+.190*frac
    t=i/14
    points=[]
    for j in range(11):
        z=zlo+(zhi-zlo)*j/10
        x=nose_x(y,z)+.023+.022*math.sin(math.pi*j/10)
        points.append((x,y,z))
    curve('SURF_grille_forged_vertical_'+str(i),points,.011,SILVER)
for side in (-1,1):
    yc=side*.740;zc=.418
    oval_back('SURF_side_duct_shadow_'+str(side),yc,zc,.148,.128,VENT,.105)
    oval_ring('SURF_side_duct_shell_'+str(side),yc,zc,.151,.129,BLACK,.020,.001)
    for k in range(3):
        z=zc-.057+k*.056
        pts=[(nose_x(y,z)+.019,y,z) for y in (yc-side*.085,yc,yc+side*.085)]
        curve('SURF_side_duct_carbon_vane_'+str(side)+'_'+str(k),pts,.009,CARBON)

# 4. Replace front lamp 'stuck-on edge' appearance with a curved smoked lens
# floating only millimetres over the real headlamp internal geometry.
for side in (-1,1):
    rows=[]
    for i in range(25):
        u=i/24;x=2.245-.420*u
        yc=.53+.29*u
        wid=.075+.085*math.sin(math.pi*u)
        row=[]
        for j in range(15):
            v=-1+2*j/14
            y=side*(yc+wid*v)
            z=.781+.061*u-.029*v*v+.010*math.sin(math.pi*u)
            row.append((x,y,z))
        rows.append(row)
    obj=loft('SURF_headlight_smoked_polycarbonate_'+str(side),rows,CLEAR)
    path=[(2.245-.420*i/40,side*(.53+.29*i/40+.070*math.sin(math.pi*i/40)),
          .783+.061*i/40) for i in range(41)]
    curve('SURF_headlight_led_wake_'+str(side),path,.0065,LED)

# 5. Rear fascia no longer the planar wall of a box. Panel transitions taper
# to bumper ends and flow toward diffuser. This retains the original tail lamps.
rear=bpy.data.objects['REAR_bumper']
for v in rear.data.vertices:
    x,y,z=v.co
    q=abs(y)/.86
    v.co.x=-2.293-.076*(1-sm(q)**2.1)-.020*math.sin(math.pi*sm((z-.26)/.53))
    v.co.z=z+.021*max(0,1-q*q)*math.sin(math.pi*sm((z-.26)/.53))
rear.data.update()
deck=bpy.data.objects['BODY_rear_deck']
for v in deck.data.vertices:
    x,y,z=v.co
    v.co.z=z+.036*math.sin(math.pi*sm((-x-1.3)/.98))*gaussian(y,0,.54)
deck.data.update()

# 6. Long-hood GT paint response (glTF compatible) and studio look development.
p=PAINT.node_tree.nodes.get('Principled BSDF')
p.inputs['Base Color'].default_value=(.48,.145,.020,1)
p.inputs['Metallic'].default_value=.53
p.inputs['Roughness'].default_value=.19
p.inputs['Coat Weight'].default_value=.92
p.inputs['Coat Roughness'].default_value=.105

# No new 4K textures or material proliferation; improve body highlights by light
# shape. Portable glTF viewer uses stored Principled roughness/coat parameters.
S.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.62
for name,power in [('LGT_key',3200),('LGT_fill',2300),('LGT_rim',1650)]:
    if name in bpy.data.objects:bpy.data.objects[name].data.energy=power


# Choose the full-car delivery camera explicitly. Otherwise headless renders fall
# back to the prior engine macro camera and misleadingly crop the entire design.
cam=bpy.data.objects['CAM_front34']
cam.location=(6.7,-8.7,2.05)
cam.rotation_euler=(Vector((0,0,.68))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.lens=54
profile=bpy.data.objects['CAM_profile']
profile.location=(0,-10.2,1.70)
profile.rotation_euler=(Vector((0,0,.70))-profile.location).to_track_quat('-Z','Y').to_euler()
profile.data.ortho_scale=5.5
S.camera=cam

# Hosted Blender scenes can have camera-bound timeline markers. If Shot 001
# still points to the engine macro, frame_set(1) silently overrides scene.camera
# and every exterior render becomes a close-up of the engine.
for marker in S.timeline_markers:
    if marker.frame==1: marker.camera=cam
S.frame_set(1)
S.camera=cam

result={'phase':'5_gt_organic_surfacing',
        'body_side_vertices':sum(len(bpy.data.objects[n].data.vertices) for n in ('BODY_side_cutout_L','BODY_side_cutout_R')),
        'new_front_faces':len(surface.data.polygons),
        'grille_bars':len([o for o in bpy.data.objects if o.name.startswith('SURF_grille_forged_vertical_')]),
        'headlight_lenses':2,
        'open_hood_frames':[1,40],
        'scene_objects':len(bpy.data.objects)}
