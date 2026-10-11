"""
The town kit: the parts castle town stamps out for its houses, made with more care than code-built
boxes can give them (`apps/game/public/models/town-kit.glb`):

    blender -b -P assets/blender/town_kit.py -- <out.glb> [preview.png]

Each part has exactly the size of the shape it replaces in `fight/world/castle-town.mts`, so the town
places, stretches and colours it as before:

- `GableRoof`: a gable roof one unit wide, deep and high, eaves at z = ±0.5, ridge along x at the top.
  The slopes sweep a little, the tiles run in ribs from ridge to eave, and a round ridge ends in
  raised end tiles.
- `PentRoof`: the tiled pent roof over a ground floor, a unit box centred on the origin.
- `Lantern`: a paper lantern (chōchin) with ribs and black caps, a unit cylinder centred on the origin.
- `Barrel`: a barrel (taru) with hoops, the same.

Each part is one mesh with one plain white material: the town gives every copy its own colour. What
should stay darker whatever the colour (grooves between tiles, the ridge, caps, hoops) is darkened in
the vertex colours, which multiply with it. Few triangles, since a street holds hundreds of copies.

Like the temple kit, everything is written in the game's frame (y up, +z toward the street) and
`at()` turns it into Blender's.
"""

import math
import sys

import bmesh
import bpy
from mathutils import Vector


def at(x, y, z):
    """The game's (x, y up, z toward the street) in Blender's (x, -y toward the street, z up)."""
    return Vector((x, -z, y))


def part(name, vertices, faces, shades, material):
    """A mesh from game-frame `vertices`, `faces` (index lists) and a grey `shade` per vertex."""
    mesh = bpy.data.meshes.new(name)
    built = bmesh.new()
    made = [built.verts.new(at(*vertex)) for vertex in vertices]
    for face in faces:
        try:
            built.faces.new([made[index] for index in face])
        except ValueError:
            # The same face twice, where a strip closes on itself.
            pass
    colour = built.loops.layers.color.new('Col')
    for face in built.faces:
        for loop in face.loops:
            shade = shades[loop.vert.index]
            loop[colour] = (shade, shade, shade, 1.0)
    bmesh.ops.recalc_face_normals(built, faces=built.faces)
    built.to_mesh(mesh)
    built.free()
    for polygon in mesh.polygons:
        polygon.use_smooth = False
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def gable_roof(material):
    """
    Two tiled slopes from the eaves (y = 0, z = ±0.5) to the ridge (y = 1, z = 0), the tiles in ribs
    running down the slope, a thin edge under the eaves, the gable ends closed, a round ridge on top
    and a raised end tile (onigawara) at each end of it.
    """
    ribs = 14
    across = ribs * 2
    down = 5
    rib = 0.035
    vertices, faces, shades = [], [], []

    def slope(side):
        start = len(vertices)
        for row in range(down + 1):
            t = row / down
            # A slight sweep: flatter toward the eaves, steeper up to the ridge.
            y = t ** 1.25
            z = side * 0.5 * (1 - t)
            for column in range(across + 1):
                x = -0.5 + column / across
                crest = column % 2 == 1
                vertices.append((x, y + (rib if crest else 0.0), z))
                shades.append(1.0 if crest else 0.72)
        for row in range(down):
            for column in range(across):
                a = start + row * (across + 1) + column
                b = a + 1
                c = a + across + 2
                d = a + across + 1
                faces.append([a, b, c, d] if side > 0 else [a, d, c, b])
        return start

    front = slope(1)
    back = slope(-1)

    # The eaves' edge: a strip under each slope's lowest row, so the roof reads as having thickness.
    for start, side in ((front, 1), (back, -1)):
        top = list(range(start, start + across + 1))
        base = len(vertices)
        for index in top:
            x, y, z = vertices[index]
            vertices.append((x, -0.06, z))
            shades.append(0.55)
        for column in range(across):
            a, b = top[column], top[column + 1]
            c, d = base + column + 1, base + column
            faces.append([a, d, c, b] if side > 0 else [a, b, c, d])

    # The gable ends: a triangle at each end, under the slopes.
    for x in (-0.5, 0.5):
        base = len(vertices)
        vertices.extend([(x, 0.0, 0.5), (x, 0.0, -0.5), (x, 1.0, 0.0)])
        shades.extend([0.85, 0.85, 0.85])
        faces.append([base, base + 1, base + 2] if x > 0 else [base + 2, base + 1, base])

    # The ridge: a round cap along x, darker than the tiles.
    sides = 8
    radius = 0.07
    rings = []
    for x in (-0.52, 0.52):
        ring = []
        for index in range(sides):
            angle = math.pi * index / (sides - 1)
            ring.append(len(vertices))
            vertices.append((x, 1.0 + math.sin(angle) * radius * 1.3, math.cos(angle) * radius))
            shades.append(0.5)
        rings.append(ring)
    for index in range(sides - 1):
        faces.append([rings[0][index], rings[0][index + 1], rings[1][index + 1], rings[1][index]])

    # The end tiles (onigawara): a raised block at each end of the ridge, darker still.
    for x in (-0.52, 0.52):
        base = len(vertices)
        width, height, depth = 0.025, 0.2, 0.13
        for dx in (-width, width):
            for dy in (0.0, height):
                for dz in (-depth, depth):
                    vertices.append((x + dx, 0.95 + dy, dz))
                    shades.append(0.4)
        # A box from its eight corners.
        for quad in ([0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]):
            faces.append([base + corner for corner in quad])

    return part('GableRoof', vertices, faces, shades, material)


def pent_roof(material):
    """A slab of tiles, a unit box: ribs along its top, darker grooves, a darker edge all round."""
    ribs = 14
    across = ribs * 2
    rib = 0.25
    vertices, faces, shades = [], [], []
    for row, z in enumerate((-0.5, 0.5)):
        for column in range(across + 1):
            x = -0.5 + column / across
            crest = column % 2 == 1
            vertices.append((x, (0.5 if crest else 0.5 - rib), z))
            shades.append(1.0 if crest else 0.7)
    for column in range(across):
        a = column
        faces.append([a, a + 1, a + across + 2, a + across + 1])
    base = len(vertices)
    for y in (-0.5,):
        for z in (-0.5, 0.5):
            for x in (-0.5, 0.5):
                vertices.append((x, y, z))
                shades.append(0.55)
    # Underside, and the sides from the ribs down to it.
    faces.append([base, base + 2, base + 3, base + 1])
    front_top = [across + 1 + column for column in range(across + 1)]
    back_top = list(range(across + 1))
    for column in range(across):
        faces.append([front_top[column], front_top[column + 1], base + 3, base + 2] if column == 0 else [front_top[column], front_top[column + 1], base + 3])
        faces.append([back_top[column + 1], back_top[column], base, base + 1] if column == 0 else [back_top[column + 1], back_top[column], base])
    faces.append([back_top[0], front_top[0], base + 2, base])
    faces.append([front_top[-1], back_top[-1], base + 1, base + 3])
    return part('PentRoof', vertices, faces, shades, material)


def lathe(name, profile, sides, material):
    """A shape turned about y from `profile`: (radius, y, shade) from bottom to top, closed at both ends."""
    vertices, faces, shades = [], [], []
    for radius, y, shade in profile:
        for index in range(sides):
            angle = 2 * math.pi * index / sides
            vertices.append((math.cos(angle) * radius, y, math.sin(angle) * radius))
            shades.append(shade)
    for ring in range(len(profile) - 1):
        for index in range(sides):
            a = ring * sides + index
            b = ring * sides + (index + 1) % sides
            faces.append([a, b, b + sides, a + sides])
    faces.append(list(reversed(range(sides))))
    top = (len(profile) - 1) * sides
    faces.append([top + index for index in range(sides)])
    return part(name, vertices, faces, shades, material)


def lantern(material):
    """A paper lantern: a round body in ribs, light and slightly darker, between black caps."""
    profile = [(0.3, -0.5, 0.12), (0.3, -0.44, 0.12), (0.32, -0.42, 1.0)]
    rings = 7
    for ring in range(1, rings):
        t = ring / rings
        y = -0.42 + 0.84 * t
        radius = 0.32 + 0.18 * math.sin(math.pi * t)
        profile.append((radius, y, 1.0 if ring % 2 else 0.86))
    profile += [(0.32, 0.42, 1.0), (0.3, 0.44, 0.12), (0.3, 0.5, 0.12)]
    return lathe('Lantern', profile, 10, material)


def barrel(material):
    """A barrel: staves bulging out between two dark hoops near each end, a dark lid."""
    profile = []
    for y, shade in ((-0.5, 0.6), (-0.4, 0.6), (-0.36, 0.95), (-0.3, 0.45), (-0.24, 0.45), (-0.2, 0.95),
                     (0.2, 0.95), (0.24, 0.45), (0.3, 0.45), (0.36, 0.95), (0.4, 0.6), (0.5, 0.6)):
        radius = 0.4 + 0.06 * math.cos(math.pi * y)
        profile.append((radius, y, shade))
    return lathe('Barrel', profile, 12, material)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = argv[0] if argv else 'town-kit.glb'
    preview = argv[1] if len(argv) > 1 else None

    bpy.ops.wm.read_factory_settings(use_empty=True)
    white = bpy.data.materials.new('Kit')
    white.use_nodes = True
    nodes = white.node_tree.nodes
    shader = nodes['Principled BSDF']
    shader.inputs['Roughness'].default_value = 0.8
    # Show the vertex colours in Blender too; the game multiplies them with each copy's own colour.
    attribute = nodes.new('ShaderNodeVertexColor')
    attribute.layer_name = 'Col'
    white.node_tree.links.new(attribute.outputs['Color'], shader.inputs['Base Color'])

    parts = [gable_roof(white), pent_roof(white), lantern(white), barrel(white)]
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, export_vertex_color='ACTIVE',
                              export_materials='EXPORT', export_extras=False)
    if preview is not None:
        render_preview(parts, preview)


def render_preview(parts, path):
    """The parts side by side, the roofs stretched to a house's size, to look at without the game."""
    for obj, (x, scale) in zip(parts, ((0, (6, 1.5, 8)), (5, (5, 0.15, 1.2)), (7.5, (1, 1, 1)), (9, (1, 1, 1)))):
        obj.location = at(x, 2 if obj.name in ('Lantern', 'Barrel') else 0, 0)
        obj.scale = (scale[0], scale[2], scale[1])
    sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
    sun.data.energy = 4
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
    bpy.context.collection.objects.link(sun)
    world = bpy.data.worlds.new('World')
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.42, 0.45, 1)
    bpy.context.scene.world = world
    camera = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera'))
    bpy.context.collection.objects.link(camera)
    camera.location = at(4.5, 6, 12)
    camera.rotation_euler = (at(4.5, 1, 0) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene = bpy.context.scene
    scene.camera = camera
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 600
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


main()
