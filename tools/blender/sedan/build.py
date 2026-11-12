"""Build the Automotive Empire reference sedan in Blender and export it for the game.

Run (Blender 4.5 LTS, no GPU needed):
    blender -b --factory-startup --python tools/blender/sedan/build.py -- [--renders] [--no-export] [--no-ao] [--references=DIR]

Outputs (default):
    public/assets/vehicles/sedan-ref/sedan.lod0.glb, sedan.lod1.glb, wheels.glb
    assets-src/sedan-ref/sedan.blend            (the editable source scene)
    assets-src/sedan-ref/renders/*.png          (Cycles reference renders, with --renders)
"""
import os
import sys
import math
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))

import bpy
import numpy as np
import design as D
import surfaces as S
import bl_util as U
import materials as M
import studio
import wheels as W
import details as X
import seams as SM
import interior as I

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RENDERS = "--renders" in ARGS
EXPORT = "--no-export" not in ARGS
STAGE = next((a.split("=")[1] for a in ARGS if a.startswith("--stage=")), "all")
OUT_GAME = os.path.join(ROOT, "public", "assets", "vehicles", "sedan-ref")
OUT_SRC = os.path.join(ROOT, "assets-src", "sedan-ref")


def log(*a):
    print("[sedan]", *a, flush=True)


# --------------------------------------------------------------------------------------------- body shell
def build_body(mats):
    G, par, st = S.body_grid()
    Uc, Vc, _ = G.shape
    uv = np.zeros((Uc, Vc, 2))
    # half-texel inset: the grid's edges (the mirror plane) map to texel centres, so filtering never reads unused texels
    uv[..., 0] = ((0.5 + np.linspace(0, 1, Uc) * (SM.TW - 1)) / SM.TW)[:, None]
    uv[..., 1] = ((0.5 + np.linspace(0, 1, Vc) * (SM.TH - 1)) / SM.TH)[None, :]
    floor_rows = sum(S.SPAN_COUNTS[:2])
    fm = np.full((Uc - 1, Vc - 1), "paint_body", dtype=object)
    fm[:, :floor_rows] = "underbody"
    sill = slice(sum(S.SPAN_COUNTS[:2]), sum(S.SPAN_COUNTS[:4]))
    xs_st = G[:, Vc // 2, 0]
    between = (np.minimum(xs_st[:-1], xs_st[1:]) > D.AX_R + D.ARCH_R - 0.01) & (np.maximum(xs_st[:-1], xs_st[1:]) < D.AX_F - D.ARCH_R + 0.01)
    for i in np.nonzero(between)[0]:
        fm[i, sill] = "trim_black"
    ob = U.grid_mesh("Body", G, uv, fm, mats)
    U.link(ob)
    U.mirror_merge(ob)
    U.recalc_normals(ob)
    fair_tops(ob)
    log("body skin", len(ob.data.polygons), "faces")
    bake_seams(G, mats)
    return ob, par


def fair_tops(ob, iterations=24):
    """Height-only Laplacian fairing of the hood and trunk-lid tops: removes the slight undulation the loft leaves
    between the fender crest and the centre line (clear coat makes such ripples obvious). Outlines, seams and UVs
    are unchanged; only z moves, by at most a few millimetres."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.normal_update()
    sel = []
    for v in bm.verts:
        x, y, z = v.co
        top = v.normal.z > 0.55 and abs(y) < 0.80 and z > 0.7
        if top and (x > D.X_COWL + 0.03 or x < D.X_DECK - 0.03) and not v.is_boundary:
            sel.append(v)
    z0 = {v: v.co.z for v in sel}
    for _ in range(iterations):
        bmesh.ops.smooth_vert(bm, verts=sel, factor=0.5, use_axis_x=False, use_axis_y=False, use_axis_z=True)
    moved = max((abs(v.co.z - z0[v]) for v in sel), default=0.0)
    bm.to_mesh(ob.data)
    bm.free()
    log("faired %d top vertices, max move %.1f mm" % (len(sel), moved * 1000))


def bake_seams(G, mats):
    t = time.time()
    mask, nrm = SM.bake(G)
    tex_dir = os.path.join(OUT_SRC, "textures")
    os.makedirs(tex_dir, exist_ok=True)
    imgs = []
    for name, arr in (("body_seams", mask), ("body_seams_normal", nrm)):
        img = bpy.data.images.new(name, SM.TW, SM.TH, alpha=False)
        px = np.ones((SM.TH, SM.TW, 4), np.float32)
        px[..., :3] = arr.astype(np.float32) / 255.0
        if name == "body_seams":
            img.colorspace_settings.name = "sRGB"
        else:
            img.colorspace_settings.name = "Non-Color"
        img.pixels.foreach_set(px.reshape(-1))
        img.filepath_raw = os.path.join(tex_dir, name + ".png")
        img.file_format = "PNG"
        img.save()
        imgs.append(img)
    M.attach_paint_maps(mats["paint_body"], imgs[0], imgs[1])
    log("seams baked %.1fs" % (time.time() - t))


def cut_arches(body, mats):
    for ax, name in ((D.AX_F, "ArchF"), (D.AX_R, "ArchR")):
        circle = [(ax + D.ARCH_R * math.cos(t), D.TIRE_R + D.ARCH_R * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 120, endpoint=False)]
        c = U.prism(name, circle, "y", 0.56, 1.4, mirror=True, mat=mats["arch_liner"])
        U.link(c)
        U.boolean(body, c)
        bpy.data.objects.remove(c)


def open_cabin(body, par):
    v_belt = sum(S.SPAN_COUNTS[:S.BELT_TRACK]) / (len(par) - 1)

    def pred(f, uv):
        c = f.calc_center_median()
        if not (D.X_DECK < c.x < D.X_COWL):
            return False
        v = (sum(l[uv].uv.y for l in f.loops) / len(f.loops) * SM.TH - 0.5) / (SM.TH - 1)
        return v > v_belt + 1e-4

    U.delete_faces(body, pred)


# --------------------------------------------------------------------------------------------- glasshouse
def build_glasshouse(mats):
    import bmesh
    G, par, xs = S.gh_grid()
    Uc, Vc, _ = G.shape
    uv = np.zeros((Uc, Vc, 2))
    uv[..., 0] = np.linspace(0, 1, Uc)[:, None]
    uv[..., 1] = np.linspace(0, 1, Vc)[None, :]
    ob = U.grid_mesh("Glasshouse", G, uv)
    names = ["paint", "glass", "glass_frit", "trim_chrome", "trim_black"]
    for n in names:
        ob.data.materials.append(mats[n])
    U.link(ob)
    vpar = lambda v: float(np.interp(v, np.linspace(0, 1, Vc), par))
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    uvl = bm.loops.layers.uv.active
    face_p = lambda f: vpar(sum(l[uvl].uv.y for l in f.loops) / len(f.loops))
    # cut the raked C-pillar edge and its chrome band exactly with planes (side glass zone only)
    for off in (0.0, S.TRIM):
        co, no = S.c_plane(off)
        side = [f for f in bm.faces if face_p(f) < S.GH_SIDE_SPANS and -1.7 < f.calc_center_median().x < -0.7]
        geom = list({e for f in side for e in f.edges}) + side + list({v for f in side for v in f.verts})
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no)
    co, no = S.c_plane(0.0)
    for f in bm.faces:
        c = f.calc_center_median()
        cd = float(np.dot(np.array(c) - co, no))
        f.material_index = names.index(S.gh_material(c.x, face_p(f), cd))
    bm.to_mesh(ob.data)
    bm.free()
    U.mirror_merge(ob)
    me = ob.data
    me.update()
    top = max(me.polygons, key=lambda p: p.center.z)
    if top.normal.z < 0:
        for p in me.polygons:
            p.flip()
    glass = U.separate_by_material(ob, {"glass"}, "Glass")
    log("glasshouse", len(ob.data.polygons), "glass", len(glass.data.polygons))
    return ob, glass


REF_VIEWS = {  # file stem -> (location, rotation, size) of an image empty in the scene
    "front": ((3.2, 0, 0.75), (math.radians(90), 0, math.radians(90)), 2.2),
    "side": ((0, -1.6, 0.75), (math.radians(90), 0, 0), 5.2),
    "rear": ((-3.3, 0, 0.75), (math.radians(90), 0, math.radians(-90)), 2.2),
    "front34": ((3.0, -3.0, 1.2), (math.radians(90), 0, math.radians(45)), 3.0),
    "interior": ((0, 3.2, 1.2), (math.radians(90), 0, math.radians(180)), 2.5),
}


def add_references(ref_dir):
    """Optional: load reference images (front/side/rear/front34/interior .png|.jpg) as image empties in the .blend,
    aligned with the model's axes, to guide manual modelling. They are never exported."""
    if not ref_dir or not os.path.isdir(ref_dir):
        return 0
    n = 0
    coll = U.collection("References")
    for stem, (loc, rot, size) in REF_VIEWS.items():
        for ext in (".png", ".jpg", ".jpeg", ".webp"):
            f = os.path.join(ref_dir, stem + ext)
            if os.path.exists(f):
                e = bpy.data.objects.new("ref_" + stem, None)
                e.empty_display_type = "IMAGE"
                e.data = bpy.data.images.load(f)
                e.empty_display_size = size
                e.location, e.rotation_euler = loc, rot
                e.hide_render = True
                coll.objects.link(e)
                n += 1
                break
    log("reference images", n)
    return n


def bake_ao(body, size=(2048, 1024), samples=48):
    """Bake ambient occlusion of the body (with the glasshouse, details, interior and wheels as occluders) and
    multiply it into the panel-gap mask, so the asset carries its own contact shadows on every renderer."""
    t = time.time()
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    img = bpy.data.images.new("body_ao", size[0], size[1], alpha=False, float_buffer=True)
    nodes = []
    for m in body.data.materials:
        if m is None:
            continue
        n = m.node_tree.nodes.new("ShaderNodeTexImage")
        n.image = img
        m.node_tree.nodes.active = n
        nodes.append((m, n))
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    sc.render.bake.margin = 6
    sc.world.light_settings.distance = 0.6 if sc.world else 0
    bpy.ops.object.bake(type="AO", margin=6, use_clear=True)
    for m, n in nodes:
        m.node_tree.nodes.remove(n)
    ao = np.array(img.pixels[:], np.float32).reshape(size[1], size[0], 4)[..., 0]
    # upsample to the mask resolution (bilinear) and fold into the mask
    mimg = bpy.data.images["body_seams"]
    H, Wd = mimg.size[1], mimg.size[0]
    ys = np.linspace(0, size[1] - 1, H)
    xs = np.linspace(0, size[0] - 1, Wd)
    y0 = np.floor(ys).astype(int); y1 = np.minimum(y0 + 1, size[1] - 1); fy = (ys - y0)[:, None]
    x0 = np.floor(xs).astype(int); x1 = np.minimum(x0 + 1, size[0] - 1); fx = (xs - x0)[None, :]
    a = ao[y0][:, x0] * (1 - fx) + ao[y0][:, x1] * fx
    b = ao[y1][:, x0] * (1 - fx) + ao[y1][:, x1] * fx
    up = a * (1 - fy) + b * fy
    occl = 0.30 + 0.70 * np.clip(up, 0, 1) ** 1.2
    px = np.array(mimg.pixels[:], np.float32).reshape(H, Wd, 4)
    px[..., :3] *= occl[..., None]
    mimg.pixels.foreach_set(px.reshape(-1))
    mimg.save()
    log("ao baked %.1fs" % (time.time() - t))


def build_wheels(mats):
    """Every rim design, the brakes and the reference tyre, each in its own collection at the origin."""
    root = U.collection("Wheels")
    sets = {}
    for design in ("sport5", "turbine10", "multi15"):
        col = U.collection("rim_" + design, root)
        before = set(bpy.data.objects)
        r = W.rim("rim_" + design, mats, design)
        for o in set(bpy.data.objects) - before:
            for c in list(o.users_collection):
                c.objects.unlink(o)
            col.objects.link(o)
        sets[design] = col
    col = U.collection("brakes", root)
    before = set(bpy.data.objects)
    W.brakes(mats)
    t = W.tire("tire_ref", mats)
    for o in set(bpy.data.objects) - before:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        col.objects.link(o)
    sets["_brakes"] = col
    return sets


def mount_wheels(sets, design="turbine10"):
    """Instance a rim design + brakes + tyre at the four wheel positions (for renders and the .blend)."""
    coll = U.collection("WheelInstances")
    for name, x, track in (("FL", D.AX_F, D.TRACK_F), ("FR", D.AX_F, D.TRACK_F), ("RL", D.AX_R, D.TRACK_R), ("RR", D.AX_R, D.TRACK_R)):
        side = 1 if name[1] == "L" else -1
        for key in (design, "_brakes"):
            e = bpy.data.objects.new(f"wheel_{name}_{key}", None)
            e.instance_type = "COLLECTION"
            e.instance_collection = sets[key]
            e.location = (x, side * track / 2, D.TIRE_R)
            e.scale = (1, side, 1)
            coll.objects.link(e)
    for c in sets.values():
        lc = bpy.context.view_layer.layer_collection.children["Wheels"].children[c.name]
        lc.exclude = True


def main():
    t0 = time.time()
    U.clear_scene()
    mats = M.make_materials()
    body, par = build_body(mats)
    cut_arches(body, mats)
    U.shade_smooth(body)
    cats = {"body": [body]}
    det = []
    det += X.lamp(body, mats, True)
    det += X.lamp(body, mats, False)
    det += X.rear_lightbar(body, mats)
    panel, bars, sur = X.grille(body, mats)
    det.append(sur)
    cats["grille_ice"] = bars
    cats["grille_ev"] = [panel]
    det += X.intakes(body, mats)
    det += X.rear_diffuser(body, mats)
    open_cabin(body, par)
    U.shade_smooth(body)
    for layout in ("single", "dual", "quad"):
        cats["exhaust_" + layout] = X.exhausts(mats, layout)
    det += X.mirrors(body, mats)
    det += X.handles(body, mats)
    det += X.cowl_and_wipers(mats)
    det.append(X.antenna(mats))
    det += X.rear_plate(body, mats)
    det += X.arch_lips(body, mats)
    for k, v in X.aero(mats).items():
        cats[k] = v
    log("details done %.1fs" % (time.time() - t0))
    gh, glass = build_glasshouse(mats)
    U.shade_smooth(gh)
    U.shade_smooth(glass)
    cats["body"] += det + [gh, glass]
    cats["interior"] = I.build(mats, gh)
    sets = build_wheels(mats)
    mount_wheels(sets)
    log("geometry done in %.1fs" % (time.time() - t0))
    if "--no-ao" not in ARGS and STAGE not in ("preview", "detail"):
        if bpy.context.scene.world is None:
            bpy.context.scene.world = bpy.data.worlds.new("BakeWorld")
        bake_ao(body)
    # the default look for renders: ICE grille, dual exhausts, no aero kit
    shown = {"body", "grille_ice", "exhaust_dual", "interior"}
    for k, objs in cats.items():
        for o in objs:
            o.hide_render = k not in shown
    if RENDERS or STAGE in ("preview", "detail"):
        os.makedirs(os.path.join(OUT_SRC, "renders"), exist_ok=True)
        cam = studio.setup(res=(1280, 720) if RENDERS else (960, 540), samples=64 if RENDERS else 24)
        views = ["front34", "side", "rear34", "front"] if STAGE == "preview" else (["detail_mirror", "interior", "detail_front"] if STAGE == "detail" else list(studio.VIEWS))
        for v in views:
            studio.render(cam, v, os.path.join(OUT_SRC, "renders", f"{STAGE}-{v}.png"), target=(0.6, 0.9, 1.0) if v == "detail_mirror" else ((0.0, 0.0, 0.85) if v == "interior" else (0, 0, 0.68)))
            log("render", v, "%.1fs" % (time.time() - t0))
    os.makedirs(OUT_SRC, exist_ok=True)
    add_references(next((a.split("=", 1)[1] for a in ARGS if a.startswith("--references=")), os.path.join(OUT_SRC, "references")))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_SRC, "sedan.blend"), compress=True)
    if EXPORT and STAGE not in ("preview", "detail"):
        import export as E
        for c in sets.values():
            bpy.context.view_layer.layer_collection.children["Wheels"].children[c.name].exclude = False
        rims = [o for o in bpy.data.objects if o.name in ("rim_sport5", "rim_turbine10", "rim_multi15")]
        brake = [bpy.data.objects["brake_disc"], bpy.data.objects["caliper"]]
        E.export_all(cats, rims, brake, mats, OUT_GAME, log)
    log("total %.1fs" % (time.time() - t0))


if __name__ == "__main__":
    main()
