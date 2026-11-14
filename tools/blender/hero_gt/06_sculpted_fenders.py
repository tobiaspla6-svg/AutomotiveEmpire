"""AE GT-RS v2 second sculpt pass: true curved fenders, nose height and road-GT aero.

Works on the original geometry after phase 05_organic_surfacing.py.
Does not change the engine, simulation, wheel positions or bonnet animation.
"""
import bpy, math
from mathutils import Vector
S=bpy.context.scene
S.frame_set(1)
PAINT=bpy.data.materials['GT_paint_deep_ochre_gold']
BLACK=bpy.data.materials['GT_gloss_black']
CARBON=bpy.data.materials['GT_carbon_satin']
def clamp(a):return max(0,min(1,a))
def gauss(x,c,r):return math.exp(-((x-c)/r)**2)
def loft(name,rows,mat):
    v=[p for row in rows for p in row];w=len(rows[0])
    f=[(i*w+j,i*w+j+1,(i+1)*w+j+1,(i+1)*w+j) for i in range(len(rows)-1) for j in range(w-1)]
    m=bpy.data.meshes.new(name+'_mesh')
    m.from_pydata(v,[],f);m.update()
    ob=bpy.data.objects.new(name,m);S.collection.objects.link(ob)
    m.materials.append(mat)
    for face in m.polygons:face.use_smooth=True
    return ob
def make_curve(name,pts,thick,mat):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=thick;c.bevel_resolution=3
    s=c.splines.new('POLY');s.points.add(len(pts)-1)
    for p,xyz in zip(s.points,pts):p.co=(*xyz,1)
    ob=bpy.data.objects.new(name,c);S.collection.objects.link(ob);c.materials.append(mat)
    return ob
def remove(names):
    for n in names:
        if n in bpy.data.objects:bpy.data.objects.remove(bpy.data.objects[n],do_unlink=True)
def side_width(x,z):
    low=.275
    for axle in (1.34,-1.36):
        d=abs(x-axle)
        if d<.416: low=max(low,.344+math.sqrt(max(0,.416**2-d*d))+.019)
    hi=.887+.025*math.cos((x+.05)*math.pi/4.7)
    t=clamp((z-low)/max(.05,hi-low))
    major=.901-.132*clamp((x-1.82)/.50)**1.6-.068*clamp((-x-1.75)/.55)**1.5
    fender=.064*gauss(x,1.34,.49)+.085*gauss(x,-1.36,.53)
    door_indent=.041*gauss(x,-.15,.86)*gauss(t,.42,.28)
    width=major+fender*(.38+.62*t)-.092*(1-t)**1.8+.045*gauss(t,.79,.20)+.022*gauss(t,.96,.067)-door_indent+.019*math.sin((x+2.1)*math.pi/4.5)*math.sin(math.pi*t)
    return width
def bonnet_edge(x):
    u=clamp((x-.57)/1.70)
    hw=.73+.10*math.sin(math.pi*u)+.015*u
    v=.99
    z=.987-.245*u+.030*math.sin(math.pi*u)-.068*v*v
    z+=.063*math.sin(math.pi*u)**1.3*gauss(v,0,.48)
    z+=.055*math.sin(math.pi*u)**.7*gauss(v,.65,.19)
    z-=.012*gauss(v,0,.1)*math.sin(math.pi*u)
    return hw,z
# Replacing the square upper fender corner with an actual swept 3D panel.
# Front hood/fender transition terminates before the headlamp lens for clearance.
for side in (-1,1):
    rows=[]
    for i in range(83):
        x=.58+(1.85-.58)*i/82
        hw,hz=bonnet_edge(x)
        outer=side_width(x,.88)+.008
        oz=.887+.025*math.cos((x+.05)*math.pi/4.7)+.014*gauss(x,1.34,.50)
        row=[]
        for j in range(19):
            t=j/18
            y=side*(hw+.015+(outer-hw-.015)*t)
            z=(1-t)*hz+t*oz+.024*math.sin(math.pi*t)
            row.append((x,y,z))
        rows.append(row)
    ob=loft('SURF_front_sculpted_fender_'+str(side),rows,PAINT)
    ob['surface_role']='organic_tensioned_front_haunch'
    # The cabin glass sits on the metal shoulder, not on a disconnected prism.
    rows=[]
    for i in range(69):
        x=-1.48+(2.05)*i/68
        outer=side_width(x,.90)
        inner=.795-.037*math.cos((x+.3)*math.pi/2.6)
        row=[]
        for j in range(13):
            t=j/12
            y=side*(inner+(outer-inner)*t)
            z=.933+.033*math.sin(math.pi*t)-.031*t+.012*math.sin((x+1.5)*math.pi/2.1)
            row.append((x,y,z))
        rows.append(row)
    loft('SURF_door_shoulder_blend_'+str(side),rows,PAINT)
    # Rear shoulders close the gap between the deck and outer wheel arch.
    rows=[]
    for i in range(51):
        x=-1.73+.89*i/50
        outer=side_width(x,.90)+.005
        inner=.775+.025*math.sin(math.pi*i/50)
        row=[]
        for j in range(17):
            t=j/16
            y=side*(inner+(outer-inner)*t)
            z=.957-.047*t+.028*gauss(x,-1.36,.36)*math.sin(math.pi*t)
            row.append((x,y,z))
        rows.append(row)
    loft('SURF_rear_sculpted_haunch_'+str(side),rows,PAINT)
# Front fascia height varies with lateral position, matching the low central
# bonnet nose and rising onto the front guard above the headlights.
front=bpy.data.objects['SURF_front_curved_nose']
for v in front.data.vertices:
    x,y,z=v.co
    t=clamp((z-.235)/.605)
    top=.746+.100*(clamp(abs(y)/.955)**1.35)
    z1=.235+t*(top-.235)
    q=abs(y)/.94
    x1=2.284+.113*(1-clamp(q)**1.65)+.020*math.sin(math.pi*clamp((z1-.22)/.64))-.023*q*q
    v.co=(x1,y,z1)
front.data.update()
# Unused square racing aero overwhelmed the road-GT silhouette. The large
# wing is removed from this road-body variant, not discarded from earlier source.
remove([n for n in list(bpy.data.objects.keys()) if
        n.startswith(('AERO_endplate_','AERO_wing_mount_','AERO_rear_wing_foil',
                      'AERO_rear_wing_trailing_edge'))])
# OEM-style integrated rear spoiler / ducktail remains part of metal design.
rows=[]
for i in range(20):
    x=-2.24+.19*i/19
    row=[]
    for j in range(33):
        v=-1+2*j/32
        y=.80*v
        z=.88+.025*math.sin(math.pi*i/19)-.034*v*v
        z+=.048*(1-i/19)**2
        row.append((x,y,z))
    rows.append(row)
loft('SURF_integrated_rear_ducktail',rows,PAINT)
# Swept rocker replaces rectangular prism.
for side in (-1,1):
    remove(['AERO_side_sill_'+str(side),'AERO_sill_edge_'+str(side)])
    rows=[]
    for i in range(45):
        x=-1.07+2.20*i/44
        row=[]
        for u,z in ((-.06,.315),(-.01,.285),(.02,.250),(.03,.230),(.01,.209),(-.046,.225)):
            y=side*(.90+u+.024*math.sin(math.pi*i/44))
            row.append((x,y,z+.008*math.sin(math.pi*i/44)))
        rows.append(row)
    loft('SURF_swept_carbon_rocker_'+str(side),rows,CARBON)
# Refocus studio camera toward a realistic low press-photo perspective.
cam=bpy.data.objects['CAM_front34']
cam.location=(6.4,-8.35,1.92)
cam.rotation_euler=(Vector((0,0,.72))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.lens=51
for marker in S.timeline_markers:
    if marker.frame==1:marker.camera=cam
S.frame_set(1);S.camera=cam
result={'phase':'6_gt_body_organic_bridges',
        'new_panels':[n for n in bpy.data.objects if n.startswith('SURF_front_sculpted_fender')],
        'old_large_wing_removed':not any(n.startswith('AERO_rear_wing') for n in bpy.data.objects.keys()),
        'camera':S.camera.name,'object_count':len(bpy.data.objects)}
