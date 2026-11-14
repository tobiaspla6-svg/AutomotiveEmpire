"""AE GT-RS v2: round the actual nose, bumper, wheel-arch transitions and rear corners.

A real GT cannot have the vertical box ends of the initial procedural shell.
Works after 06_sculpted_fenders.py and before the powertrain refinements.
"""
import bpy,math
S=bpy.context.scene
S.frame_set(1)
PAINT=bpy.data.materials['GT_paint_deep_ochre_gold']
CARBON=bpy.data.materials['GT_carbon_satin']
BLACK=bpy.data.materials['GT_gloss_black']
def clip(x):return max(0.0,min(1.0,x))
def loft(name,rows,mat):
    pts=[p for row in rows for p in row];m=len(rows[0])
    faces=[(i*m+j,i*m+j+1,(i+1)*m+j+1,(i+1)*m+j) for i in range(len(rows)-1) for j in range(m-1)]
    me=bpy.data.meshes.new(name+'_mesh');me.from_pydata(pts,[],faces);me.update()
    o=bpy.data.objects.new(name,me);S.collection.objects.link(o);me.materials.append(mat)
    for f in me.polygons:f.use_smooth=True
    return o
def line(name,pts,r,mat):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=3
    sp=c.splines.new('POLY');sp.points.add(len(pts)-1)
    for v,p in zip(sp.points,pts):v.co=(*p,1)
    o=bpy.data.objects.new(name,c);S.collection.objects.link(o);c.materials.append(mat)
    return o
def round_end(x,sign):
    if sign>0:return x-.235*clip((x-1.82)/.48)**1.8
    return x+.205*clip((-x-1.77)/.53)**1.8
# Move only extreme ends of the true metal body, NOT wheel coordinates.
for n in ['BODY_side_cutout_L','BODY_side_cutout_R']:
    ob=bpy.data.objects[n]
    for v in ob.data.vertices:
        x,y,z=v.co
        if x>1.82:v.co.x=round_end(x,1)
        elif x< -1.77:v.co.x=round_end(x,-1)
    ob.data.update()
# Rounded front fascia: approx 30 cm setback at its outer corners relative to
# forward central nose. No flat vertical sheet should remain.
front=bpy.data.objects['SURF_front_curved_nose']
for v in front.data.vertices:
    x,y,z=v.co
    q=clip(abs(y)/.96)
    v.co.x=x-.245*(q**2.2)+.038*(1-q*q)*math.exp(-((z-.54)/.26)**2)
front.data.update()
# Intrinsic grille remains centered. Corner air ducts must follow the new nose.
for ob in bpy.data.objects:
    if ob.name.startswith('SURF_side_duct_'):
        ob.location.x-=.135
# No long black tabletop protruding from bumper; a sculpted lower lip shaped
# in plan view to match the round nose, and curling up at the corners.
to_delete=['AERO_front_splitter']
to_delete += [n for n in bpy.data.objects.keys() if n.startswith('AERO_front_end_flap_')]
to_delete += [n for n in bpy.data.objects.keys() if n.startswith('AERO_front_stay_')]
for n in to_delete:
    if n in bpy.data.objects:bpy.data.objects.remove(bpy.data.objects[n],do_unlink=True)
rows=[]
for i in range(115):
    v=-1+2*i/114
    yy=.958*v
    q=abs(v)
    x_center=2.325-.218*q**2
    z=.212+.026*q*q
    row=[]
    for j in range(9):
        t=j/8
        row.append((x_center-.12*t,yy,z+.030*t+.011*q*math.sin(math.pi*t)))
    rows.append(row)
loft('SURF_active_arched_front_splitter',rows,CARBON)
# A narrow, continuous real 3D rolled edge describes the premium front lip.
line('SURF_front_lip_rolled_edge',[(2.325-.218*(abs(v))**2,.958*v,.212+.026*v*v) for v in [-1+2*i/100 for i in range(101)]],.007,BLACK)
# Rear bumper curves back toward the body rather than forming a vertical box.
rear=bpy.data.objects['REAR_bumper']
for v in rear.data.vertices:
    x,y,z=v.co
    q=clip(abs(y)/.87)
    v.co.x=x+.19*q**2
rear.data.update()
deck=bpy.data.objects['BODY_rear_deck']
for v in deck.data.vertices:
    x,y,z=v.co
    if x< -1.83:
        v.co.x=x+.12*clip((-x-1.83)/.45)*(abs(y)/.85)**2
deck.data.update()
# Redirect the roll of the side greenhouse into the rear fender without
# introducing a full-width boxed spoiler.
obj=bpy.data.objects.get('SURF_integrated_rear_ducktail')
if obj:
    for v in obj.data.vertices:
        x,y,z=v.co
        q=clip(abs(y)/.82)
        v.co.x=x+.12*q*q
        v.co.z=z-.020*q*q
    obj.data.update()
# View geometry with a simple neutral stage, not a pitch-black floor.
floor=bpy.data.materials.get('STUDIO_charcoal_floor')
if floor:
    n=floor.node_tree.nodes.get('Principled BSDF')
    if n:
        n.inputs['Base Color'].default_value=(.17,.19,.21,1)
        n.inputs['Roughness'].default_value=.64
S.frame_set(1)
result={'phase':'7_round_gt_nose','side_ends_rounded':True,'new_splitter':'SURF_active_arched_front_splitter','objects':len(bpy.data.objects)}
