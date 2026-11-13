"""PBR materials of the reference sedan (Principled BSDF; every slot exports to glTF metallic-roughness + extensions).

Slot names are part of the asset contract: the game overrides 'paint' / 'paint_body' (body panels, with the panel-gap maps), 'trim_chrome', 'caliper', 'int_upholstery'
and 'int_accent' at runtime for customisation, so keep them stable.
"""
import bpy

SPEC = {
    # name: (base colour RGBA, metallic, roughness, extras)
    "paint": ((0.09, 0.16, 0.30, 1), 0.65, 0.32, {"coat": 1.0, "coat_rough": 0.03}),
    "paint_body": ((0.09, 0.16, 0.30, 1), 0.65, 0.32, {"coat": 1.0, "coat_rough": 0.03}),
    "glass": ((0.03, 0.04, 0.045, 1), 0.0, 0.02, {"alpha": 0.32, "ior": 1.52}),
    "glass_frit": ((0.01, 0.01, 0.012, 1), 0.0, 0.25, {}),
    "trim_chrome": ((0.92, 0.93, 0.95, 1), 1.0, 0.07, {}),
    "trim_black": ((0.01, 0.01, 0.012, 1), 0.0, 0.12, {"coat": 1.0, "coat_rough": 0.02}),
    "plastic_black": ((0.018, 0.018, 0.02, 1), 0.0, 0.62, {}),
    "underbody": ((0.03, 0.03, 0.033, 1), 0.0, 0.85, {}),
    "arch_liner": ((0.012, 0.012, 0.014, 1), 0.0, 0.9, {}),
    "lamp_lens": ((0.95, 0.96, 0.97, 1), 0.0, 0.0, {"alpha": 0.12, "ior": 1.49}),
    "lamp_lens_red": ((0.55, 0.02, 0.02, 1), 0.0, 0.05, {"alpha": 0.72, "coat": 1.0, "coat_rough": 0.0}),
    "lamp_housing": ((0.14, 0.145, 0.15, 1), 1.0, 0.22, {}),
    "lamp_led": ((1.0, 0.98, 0.94, 1), 0.0, 0.3, {"emit": (1.0, 0.97, 0.9), "emit_strength": 6.0}),
    "lamp_led_red": ((0.8, 0.02, 0.01, 1), 0.0, 0.3, {"emit": (1.0, 0.04, 0.02), "emit_strength": 4.0}),
    "lamp_lens_inner": ((0.6, 0.62, 0.66, 1), 0.0, 0.05, {"alpha": 0.5}),
    "rim_alloy": ((0.78, 0.79, 0.80, 1), 1.0, 0.24, {"coat": 0.6, "coat_rough": 0.08}),
    "rim_dark": ((0.06, 0.065, 0.07, 1), 1.0, 0.35, {"coat": 0.6, "coat_rough": 0.1}),
    "brake_disc": ((0.36, 0.36, 0.37, 1), 1.0, 0.42, {}),
    "brake_hat": ((0.08, 0.08, 0.085, 1), 0.6, 0.6, {}),
    "caliper": ((0.04, 0.04, 0.045, 1), 0.0, 0.35, {"coat": 1.0, "coat_rough": 0.1}),
    "rubber": ((0.028, 0.028, 0.03, 1), 0.0, 0.78, {}),
    "lug": ((0.7, 0.71, 0.72, 1), 1.0, 0.18, {}),
    "mirror_glass": ((0.85, 0.87, 0.9, 1), 1.0, 0.01, {}),
    "exhaust": ((0.55, 0.55, 0.56, 1), 1.0, 0.2, {}),
    "exhaust_inner": ((0.01, 0.01, 0.01, 1), 0.3, 0.8, {}),
    "grille_mesh": ((0.02, 0.02, 0.022, 1), 0.4, 0.3, {}),
    "int_upholstery": ((0.035, 0.032, 0.03, 1), 0.0, 0.55, {"sheen": 0.3}),
    "int_trim": ((0.028, 0.028, 0.03, 1), 0.0, 0.7, {}),
    "int_dash": ((0.02, 0.02, 0.022, 1), 0.0, 0.78, {}),
    "int_carpet": ((0.02, 0.02, 0.022, 1), 0.0, 0.95, {}),
    "int_headliner": ((0.32, 0.31, 0.29, 1), 0.0, 0.9, {}),
    "int_accent": ((0.55, 0.56, 0.58, 1), 1.0, 0.3, {}),
    "int_screen": ((0.004, 0.006, 0.01, 1), 0.0, 0.05, {"emit": (0.06, 0.12, 0.2), "emit_strength": 1.0}),
    "plate": ((0.92, 0.92, 0.9, 1), 0.0, 0.5, {}),
    "panel_gap": ((0.008, 0.008, 0.009, 1), 0.2, 0.55, {}),
    "lamp_amber": ((0.9, 0.42, 0.02, 1), 0.0, 0.2, {"emit": (1.0, 0.45, 0.02), "emit_strength": 0.6}),
    "rubber_seal": ((0.012, 0.012, 0.013, 1), 0.0, 0.7, {}),
    "lamp_bezel": ((0.035, 0.036, 0.04, 1), 0.3, 0.18, {"coat": 1.0, "coat_rough": 0.02}),
    "reflector": ((0.5, 0.03, 0.02, 1), 0.2, 0.2, {}),
}


def make_materials():
    mats = {}
    for name, (col, met, rough, ex) in SPEC.items():
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = col
        b.inputs["Metallic"].default_value = met
        b.inputs["Roughness"].default_value = rough
        if "coat" in ex:
            b.inputs["Coat Weight"].default_value = ex["coat"]
            b.inputs["Coat Roughness"].default_value = ex["coat_rough"]
        if "alpha" in ex:
            b.inputs["Alpha"].default_value = ex["alpha"]
            m.blend_method = "BLEND" if hasattr(m, "blend_method") else None
            m.surface_render_method = "BLENDED"
        if "ior" in ex:
            b.inputs["IOR"].default_value = ex["ior"]
        if "emit" in ex:
            b.inputs["Emission Color"].default_value = (*ex["emit"], 1)
            b.inputs["Emission Strength"].default_value = ex["emit_strength"]
        if "sheen" in ex:
            b.inputs["Sheen Weight"].default_value = ex["sheen"]
        if name in ("glass", "lamp_lens", "lamp_lens_red", "lamp_lens_inner", "int_headliner"):
            m.use_backface_culling = False
        else:
            m.use_backface_culling = True
        mats[name] = m
    return mats


def attach_paint_maps(mat, color_img, normal_img):
    """Panel-gap mask (multiplies the paint colour) and normal map on the body paint."""
    nt = mat.node_tree
    b = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = color_img
    tex.extension = "EXTEND"
    tex.location = (-700, 300)
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs[7].default_value = b.inputs["Base Color"].default_value
    nt.links.new(tex.outputs["Color"], mix.inputs[6])
    nt.links.new(mix.outputs[2], b.inputs["Base Color"])
    if normal_img is not None:
        nt2 = nt.nodes.new("ShaderNodeTexImage")
        nt2.image = normal_img
        nt2.extension = "EXTEND"
        normal_img.colorspace_settings.name = "Non-Color"
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt2.location = (-700, -100)
        nm.location = (-400, -100)
        nt.links.new(nt2.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    return tex, mix


def export_paint_setup(mat):
    """For glTF export the mask goes straight into Base Color (the game multiplies it by the chosen paint colour)."""
    nt = mat.node_tree
    b = nt.nodes["Principled BSDF"]
    tex = [n for n in nt.nodes if n.type == "TEX_IMAGE" and n.image and "seam" in n.image.name and "normal" not in n.image.name]
    if tex:
        nt.links.new(tex[0].outputs["Color"], b.inputs["Base Color"])
