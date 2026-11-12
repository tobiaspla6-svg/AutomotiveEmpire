"""A neutral photo studio for Cycles reference renders (not exported)."""
import math
import bpy
from mathutils import Vector


def setup(res=(1280, 720), samples=64):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("StudioWorld")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.035, 0.037, 0.042, 1)
    bg.inputs["Strength"].default_value = 1.0
    coll = bpy.data.collections.new("Studio")
    sc.collection.children.link(coll)
    # floor with a soft gradient
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.name = "StudioFloor"
    fm = bpy.data.materials.new("studio_floor")
    fm.use_nodes = True
    fb = fm.node_tree.nodes["Principled BSDF"]
    fb.inputs["Base Color"].default_value = (0.03, 0.031, 0.034, 1)
    fb.inputs["Roughness"].default_value = 0.35
    floor.data.materials.append(fm)
    for o in list(floor.users_collection):
        o.objects.unlink(floor)
    coll.objects.link(floor)

    def area(name, loc, rot, size, energy, color=(1, 1, 1)):
        ld = bpy.data.lights.new(name, "AREA")
        ld.shape = "RECTANGLE"
        ld.size, ld.size_y = size
        ld.energy = energy
        ld.color = color
        ob = bpy.data.objects.new(name, ld)
        ob.location = loc
        ob.rotation_euler = rot
        coll.objects.link(ob)
        return ob

    area("Top", (0, 0, 5.2), (0, 0, 0), (7.0, 2.6), 1500)
    area("KeyL", (1.5, 5.0, 2.2), (math.radians(-65), 0, 0), (6.0, 1.2), 520)
    area("KeyR", (-1.0, -5.0, 2.2), (math.radians(65), 0, 0), (6.0, 1.2), 420)
    area("Front", (6.0, 0, 1.6), (0, math.radians(75), 0), (1.6, 3.0), 300, (1.0, 0.96, 0.9))
    area("Rear", (-6.5, 0, 2.0), (0, math.radians(-70), 0), (1.6, 3.0), 280, (0.9, 0.95, 1.0))
    cam_d = bpy.data.cameras.new("Cam")
    cam_d.lens = 70
    cam = bpy.data.objects.new("Cam", cam_d)
    coll.objects.link(cam)
    sc.camera = cam
    return cam


VIEWS = {
    "front34": (math.radians(35), math.radians(8), 9.6),
    "rear34": (math.radians(215), math.radians(9), 9.6),
    "side": (math.radians(90), math.radians(2), 10.5),
    "front": (math.radians(0), math.radians(5), 10.0),
    "rear": (math.radians(180), math.radians(6), 10.0),
    "top": (math.radians(90), math.radians(80), 11.0),
    "detail_front": (math.radians(28), math.radians(4), 4.2),
    "detail_mirror": (math.radians(60), math.radians(12), 2.6),
    "interior": (math.radians(70), math.radians(28), 4.0),
}


def aim(cam, view, target=(0, 0, 0.68)):
    az, el, dist = VIEWS[view]
    t = Vector(target)
    pos = t + Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el))) * dist
    cam.location = pos
    d = t - pos
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def render(cam, view, path, target=(0, 0, 0.68)):
    aim(cam, view, target)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
