"""Small Blender helpers: grid meshes, materials, modifiers, booleans."""
import bpy
import bmesh
import numpy as np


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def collection(name, parent=None):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in (parent or bpy.context.scene.collection).children:
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def link(obj, coll=None):
    (coll or bpy.context.scene.collection).objects.link(obj)
    return obj


def grid_mesh(name, G, uv=None, face_mat=None, mats=None, flip=False):
    """Quad mesh from a U x V x 3 grid. uv: U x V x 2. face_mat: (U-1) x (V-1) material names."""
    U, V, _ = G.shape
    verts = G.reshape(-1, 3)
    faces = []
    for i in range(U - 1):
        for j in range(V - 1):
            a, b, c, d = i * V + j, (i + 1) * V + j, (i + 1) * V + j + 1, i * V + j + 1
            faces.append((a, d, c, b) if flip else (a, b, c, d))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts.tolist(), [], faces)
    if uv is not None:
        layer = me.uv_layers.new(name="UVMap")
        uvf = uv.reshape(-1, 2)
        loop_v = np.zeros(len(me.loops), dtype=np.int64)
        me.loops.foreach_get("vertex_index", loop_v)
        layer.data.foreach_set("uv", uvf[loop_v].reshape(-1))
    if face_mat is not None:
        names = list(dict.fromkeys(face_mat.reshape(-1).tolist()))
        for n in names:
            me.materials.append(mats[n])
        idx = {n: k for k, n in enumerate(names)}
        mi = np.array([idx[n] for n in face_mat.reshape(-1)], dtype=np.int32)
        me.polygons.foreach_set("material_index", mi)
    elif mats is not None:
        for m in mats if isinstance(mats, list) else [mats]:
            me.materials.append(m)
    me.update()
    ob = bpy.data.objects.new(name, me)
    return ob


def shade_smooth(ob, angle=None):
    for p in ob.data.polygons:
        p.use_smooth = True
    if angle is not None:
        m = ob.modifiers.new("SmoothByAngle", "NODES")
        # Blender 4.1+: smooth by angle node group from the essentials asset library
        try:
            bpy.ops.object.select_all(action="DESELECT")
            bpy.context.view_layer.objects.active = ob
            ob.select_set(True)
            ob.modifiers.remove(m)
            bpy.ops.object.shade_smooth_by_angle(angle=angle, keep_sharp_edges=True)
        except Exception:
            ob.modifiers.remove(m) if m.name in ob.modifiers else None


def apply_modifiers(ob):
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def mirror_merge(ob, axis=1, threshold=1e-4):
    m = ob.modifiers.new("Mirror", "MIRROR")
    m.use_axis = [axis == 0, axis == 1, axis == 2]
    m.use_mirror_merge = True
    m.merge_threshold = threshold
    m.use_clip = False
    apply_modifiers(ob)


def boolean(ob, cutter, op="DIFFERENCE", solver="EXACT", hole_tolerant=False):
    m = ob.modifiers.new("Bool", "BOOLEAN")
    m.operation = op
    m.object = cutter
    m.solver = solver
    if solver == "EXACT":
        m.use_hole_tolerant = hole_tolerant
        m.material_mode = "TRANSFER"
    apply_modifiers(ob)


def recalc_normals(ob, inside=False):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if inside:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()


def prism(name, outline, axis, lo, hi, mirror=True, mat=None):
    """Closed prism: a 2D outline (in the plane perpendicular to `axis`) extruded from lo to hi along the axis.
    axis 'x': outline is (y, z); 'y': (x, z); 'z': (x, y). mirror: also add the mirrored outline (y -> -y)."""
    bm = bmesh.new()

    def make(ol, sign):
        vs_lo, vs_hi = [], []
        for a, b in ol:
            if axis == "x":
                p_lo, p_hi = (lo, sign * a, b), (hi, sign * a, b)
            elif axis == "y":
                p_lo, p_hi = (a, sign * lo, b), (a, sign * hi, b)
            else:
                p_lo, p_hi = (a, sign * b, lo), (a, sign * b, hi)
            vs_lo.append(bm.verts.new(p_lo))
            vs_hi.append(bm.verts.new(p_hi))
        n = len(ol)
        bm.faces.new(vs_lo[::-1])
        bm.faces.new(vs_hi)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((vs_lo[i], vs_lo[j], vs_hi[j], vs_hi[i]))
    make(outline, 1)
    if mirror:
        make(outline, -1)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if mat is not None:
        me.materials.append(mat)
    return bpy.data.objects.new(name, me)


def separate_by_material(ob, mat_names, new_name):
    """Move faces with any of the given materials into a new object; returns it (or None)."""
    me = ob.data
    idx = {i for i, m in enumerate(me.materials) if m and m.name in mat_names}
    if not idx:
        return None
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    for p in me.polygons:
        p.select = p.material_index in idx
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    new = [o for o in bpy.context.selected_objects if o is not ob][0]
    new.name = new_name
    new.data.name = new_name
    return new


def delete_faces(ob, pred):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    uv = bm.loops.layers.uv.active
    kill = [f for f in bm.faces if pred(f, uv)]
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    bm.to_mesh(ob.data)
    bm.free()


def remove_unused_material_slots(ob):
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.ops.object.material_slot_remove_unused()
