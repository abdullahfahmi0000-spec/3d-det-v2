"""
Builds a character GLB for the viewer from Mixamo FBX exports: the skinned mesh, and every clip
given, merged by bone name onto one armature (Mixamo exports of one rig share their bone names,
so this is a merge, not a retarget).

  blender -b --factory-startup --python build_character.py -- \
      --out character.glb --skin Walking.fbx --skin-clip Walk \
      --clip Idle="Breathing Idle.fbx" --clip Talk=Talking.fbx --in-place Walk

What it does to the export, each for the web:
  - Strips root motion from the clips named by --in-place. A Mixamo clip exported without
    "In Place" drifts the hips forward a stride per cycle; the viewer moves the character itself,
    so the drift would slide it off its path. The forward channel of the hips is detrended,
    keeping the sway and the bob.
  - Drops the normal, specular and gloss maps and scales the diffuse maps down (4096 -> 2048 by
    default, a quarter of that for the hair), written as WebP. The hair keeps its alpha as a cutout
    (glTF MASK).
  - Samples the clips at 15 fps.
  - Decimates the heavier meshes and removes the eyelashes, which no camera gets close to.
  - Compresses the geometry with Draco (3DV-14). KTX2 textures are not produced: Blender has no
    KTX2 encoder.

Each clip becomes one glTF animation named after it, through one NLA track per clip.
"""
import argparse
import os
import sys

import bpy

DECIMATE = {
    "Body": 0.5,
    "Suit": 0.45,
    "Pants": 0.45,
    "Shoes": 0.25,
    "Belt": 0.3,
    "Tie": 0.4,
}


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--skin", required=True, help="FBX exported With Skin")
    parser.add_argument("--skin-clip", required=True, help="name of the clip in the skin FBX")
    parser.add_argument("--clip", action="append", default=[], help="Name=path.fbx, without skin")
    parser.add_argument("--in-place", action="append", default=[], help="clip to strip root motion from")
    parser.add_argument("--texture-size", type=int, default=2048)
    return parser.parse_args(argv)


def fcurves_of(action):
    """Every F-curve of a layered (Blender 4.4+) action."""
    curves = []
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                curves.extend(bag.fcurves)
    return curves


def import_fbx(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, ignore_leaf_bones=True)
    added = [ob for ob in bpy.data.objects if ob not in before]
    armature = next(ob for ob in added if ob.type == "ARMATURE")
    action = armature.animation_data.action if armature.animation_data else None
    if action is None:
        raise RuntimeError(f"{path}: no animation")
    return armature, action, added


def strip_root_motion(action):
    """Detrends the hips' forward channel: the one that ends furthest from where it starts."""
    hips = [c for c in fcurves_of(action) if c.data_path == 'pose.bones["mixamorig:Hips"].location']
    if not hips:
        return
    drift = {c.array_index: c.keyframe_points[-1].co[1] - c.keyframe_points[0].co[1] for c in hips}
    for curve in hips:
        keys = curve.keyframe_points
        delta = drift[curve.array_index]
        # Only travel, not the sway or the bob: a few centimetres of drift is a loop seam.
        if abs(delta) < 10:
            continue
        f0, f1 = keys[0].co[0], keys[-1].co[0]
        for key in keys:
            shift = delta * (key.co[0] - f0) / (f1 - f0)
            key.co[1] -= shift
            key.handle_left[1] -= shift
            key.handle_right[1] -= shift
        curve.update()
        print(f"  {action.name}: removed {delta / 100:.2f} m of travel on hips axis {curve.array_index}"
              f" over {(f1 - f0) / bpy.context.scene.render.fps:.2f} s", flush=True)


def simplify_material(material, size):
    """Keeps the diffuse map only, scaled down; a cutout for anything with an alpha link."""
    tree = material.node_tree
    bsdf = next(n for n in tree.nodes if n.type == "BSDF_PRINCIPLED")
    base = bsdf.inputs["Base Color"].links[0].from_node if bsdf.inputs["Base Color"].links else None
    alpha_linked = bool(bsdf.inputs["Alpha"].links)
    # Compared by name: every access to a node returns a new Python wrapper, so `is` never holds.
    keep = base.name if base is not None else None
    for node in list(tree.nodes):
        if node.type in ("TEX_IMAGE", "NORMAL_MAP") and node.name != keep:
            tree.nodes.remove(node)
    for name in ("Normal", "Roughness", "Specular IOR Level", "Metallic"):
        for link in list(bsdf.inputs[name].links):
            tree.links.remove(link)
    bsdf.inputs["Roughness"].default_value = 0.78
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Specular IOR Level"].default_value = 0.5
    if base is not None and base.image is not None:
        image = base.image
        # Hair cards are fine detail at a distance; the body atlas carries the face and clothes.
        width = size if not alpha_linked else max(256, size // 4)
        if image.size[0] > width:
            image.scale(width, width)
        image.name = f"{material.name}_diffuse"
        if alpha_linked:
            # A Round node between the alpha and the BSDF exports as alphaMode MASK.
            for link in list(bsdf.inputs["Alpha"].links):
                tree.links.remove(link)
            clip = tree.nodes.new("ShaderNodeMath")
            clip.operation = "ROUND"
            tree.links.new(base.outputs["Alpha"], clip.inputs[0])
            tree.links.new(clip.outputs[0], bsdf.inputs["Alpha"])


def decimate(ob, ratio):
    bpy.context.view_layer.objects.active = ob
    modifier = ob.modifiers.new("Decimate", "DECIMATE")
    modifier.ratio = ratio
    bpy.ops.object.modifier_move_to_index(modifier=modifier.name, index=0)
    before = len(ob.data.polygons)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    print(f"  {ob.name}: {before} -> {len(ob.data.polygons)} faces", flush=True)


def main():
    args = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)

    armature, skin_action, _ = import_fbx(args.skin)
    skin_action.name = args.skin_clip
    actions = {args.skin_clip: skin_action}

    for entry in args.clip:
        name, path = entry.split("=", 1)
        source, action, added = import_fbx(path)
        action.name = name
        action.use_fake_user = True
        actions[name] = action
        for ob in added:
            bpy.data.objects.remove(ob, do_unlink=True)

    for name in args.in_place:
        strip_root_motion(actions[name])

    # One NLA track per clip, so that each exports as its own animation.
    data = armature.animation_data
    data.action = None
    for name, action in actions.items():
        track = data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, int(action.frame_range[0]), action)
        if action.slots:
            strip.action_slot = action.slots[0]

    for ob in list(bpy.data.objects):
        if ob.type != "MESH":
            continue
        if ob.name.endswith("Eyelashes"):
            bpy.data.objects.remove(ob, do_unlink=True)
            continue
        part = ob.name.split("_")[-1]
        if part in DECIMATE:
            decimate(ob, DECIMATE[part])

    for material in bpy.data.materials:
        if material.node_tree is not None:
            simplify_material(material, args.texture_size)

    bpy.ops.export_scene.gltf(
        filepath=args.out,
        export_format="GLB",
        export_animation_mode="NLA_TRACKS",
        # Keys at 15 fps: the clips are smooth mocap, and interpolation fills the rest.
        export_frame_step=2,
        export_optimize_animation_size=True,
        export_def_bones=True,
        export_image_format="WEBP",
        export_image_quality=82,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
    )
    print(f"wrote {args.out} with clips {sorted(actions)}", flush=True)


if __name__ == "__main__":
    main()
    # Blender sometimes crashes tearing down after the meshes were edited; the file is written.
    os._exit(0)
