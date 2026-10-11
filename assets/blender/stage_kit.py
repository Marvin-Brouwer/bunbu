"""
The stage kit: the buildings and props of the stages besides castle town, in one GLB for the game
(`apps/game/public/models/stage-kit.glb`):

    blender -b -P assets/blender/stage_kit.py -- <out.glb> [preview.png]

It builds on the temple kit's tools (`temple_kit.py`: the frame, the materials, the curved roofs), so
the stages share one style with the temple. Each piece is a root named for it, in the game's frame.

- Rice fields: `Farmhouse`, a farmhouse (minka) under a thick thatched roof, and `Scarecrow`, a
  scarecrow (kakashi) in a straw coat and hat.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

import temple_kit as kit  # noqa: E402
from temple_kit import box, curved_roof, cylinder, root, sphere  # noqa: E402


def stage_materials():
    kit.materials()
    kit.MATERIALS.update({
        'Thatch': kit.material('Thatch', kit.srgb(0x9C7A48), 1.0),
        'ThatchEdge': kit.material('ThatchEdge', kit.srgb(0x6E5432), 1.0),
        'Straw': kit.material('Straw', kit.srgb(0xC9A85E), 1.0),
        'Cloth': kit.material('Cloth', kit.srgb(0xE6DCC4), 0.95),
        'Indigo': kit.material('Indigo', kit.srgb(0x2F4A7A), 0.9),
        'Earth': kit.material('Earth', kit.srgb(0x7A6448), 1.0),
    })


def farmhouse():
    """A farmhouse (minka): a stone footing, dark timber and white plaster, a veranda, a thatched roof."""
    house = root('Farmhouse')
    width, depth = 11.0, 7.5
    box(house, 'Stone', (0, 0.2, 0), (width + 0.6, 0.4, depth + 0.6))
    box(house, 'Plaster', (0, 1.75, 0), (width, 2.7, depth))
    # Timber frame: posts at the corners and along the front, a beam under the eaves.
    for x in (-width / 2, -width / 6, width / 6, width / 2):
        for z in (-depth / 2, depth / 2):
            box(house, 'Timber', (x, 1.75, z), (0.26, 2.7, 0.26))
    box(house, 'Timber', (0, 3.05, depth / 2), (width + 0.2, 0.3, 0.3))
    box(house, 'Timber', (0, 3.05, -depth / 2), (width + 0.2, 0.3, 0.3))
    box(house, 'Timber', (0, 0.55, 0), (width + 0.1, 0.3, depth + 0.1))
    # Sliding doors of paper in the middle bay, a dark board door to one side.
    box(house, 'Paper', (0, 1.6, depth / 2 + 0.03), (width / 3 - 0.3, 1.9, 0.05))
    for bar in range(1, 6):
        box(house, 'Timber', (-width / 6 + bar * width / 18, 1.6, depth / 2 + 0.06), (0.05, 1.9, 0.04))
    box(house, 'Timber', (width / 3, 1.5, depth / 2 + 0.03), (1.6, 1.9, 0.06))
    # The veranda (engawa) along the front.
    box(house, 'Timber', (0, 0.62, depth / 2 + 0.7), (width, 0.12, 1.2))
    for x in (-width / 2 + 0.3, 0, width / 2 - 0.3):
        box(house, 'Timber', (x, 0.3, depth / 2 + 1.2), (0.15, 0.6, 0.15))
    # The thatch: thick and steep, without the temple's lifted corners, and a timber-capped ridge.
    curved_roof(house, (0, 3.1, 0), width + 3.0, depth + 3.0, 4.6, 0.0, thickness=0.7, faces=('Thatch', 'ThatchEdge'), sweep=1.1)
    ridge = width + 3.0 - (depth + 3.0)
    box(house, 'ThatchEdge', (0, 7.75, 0), (ridge + 1.2, 0.5, 1.1))
    for x in range(-2, 3):
        box(house, 'Timber', (x * ridge / 4.5, 8.0, 0), (0.18, 0.25, 1.5))
    # A woodpile and a barrel by the side.
    for row in range(3):
        box(house, 'Timber', (-width / 2 - 0.8, 0.2 + row * 0.25, 1.2), (0.9, 0.22, 1.8 - row * 0.4))
    cylinder(house, 'Timber', (width / 2 + 0.9, 0, 2.2), 0.4, 0.9, sides=10)
    return house


def scarecrow():
    """A scarecrow (kakashi): a pole and crossbar, a straw coat (mino), a cloth face, a wide straw hat."""
    figure = root('Scarecrow')
    cylinder(figure, 'Timber', (0, 0, 0), 0.05, 2.1, sides=6)
    box(figure, 'Timber', (0, 1.55, 0), (1.5, 0.07, 0.07))
    # The coat hangs from the shoulders, wider toward the hem.
    cylinder(figure, 'Straw', (0, 0.75, 0), 0.42, 0.85, sides=9, top_radius=0.2)
    box(figure, 'Indigo', (0, 1.5, 0), (0.62, 0.32, 0.3))
    for side in (-1, 1):
        cylinder(figure, 'Straw', (side * 0.68, 1.3, 0), 0.1, 0.32, sides=6, top_radius=0.05)
    sphere(figure, 'Cloth', (0, 1.85, 0), 0.17)
    # Painted eyes: two dark dots on the cloth face.
    for side in (-1, 1):
        sphere(figure, 'Black', (side * 0.06, 1.88, 0.15), 0.025)
    # The hat (kasa): a wide, shallow cone.
    cylinder(figure, 'Straw', (0, 1.96, 0), 0.5, 0.22, sides=12, top_radius=0.04)
    return figure


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = argv[0] if argv else 'stage-kit.glb'
    preview = argv[1] if len(argv) > 1 else None

    bpy.ops.wm.read_factory_settings(use_empty=True)
    stage_materials()
    pieces = [farmhouse(), scarecrow()]
    for piece in pieces:
        kit.join_children(piece)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True,
                              export_materials='EXPORT', export_extras=False)
    if preview is not None:
        render_preview(pieces, preview)


def render_preview(pieces, path):
    for piece, x in zip(pieces, (0, 10)):
        piece.location = kit.at(x, 0, 0)
    sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
    sun.data.energy = 4
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
    bpy.context.collection.objects.link(sun)
    world = bpy.data.worlds.new('World')
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.5, 0.6, 0.7, 1)
    bpy.context.scene.world = world
    camera = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera'))
    bpy.context.collection.objects.link(camera)
    camera.location = kit.at(5, 6, 20)
    camera.rotation_euler = (kit.at(5, 2.5, 0) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene = bpy.context.scene
    scene.camera = camera
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 600
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    main()
