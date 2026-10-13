"""
The temple kit: a temple hall, a five-storey pagoda, a stone lantern and a torii, in one GLB for the
game (`assets/models/temple-kit.glb`, which `pnpm models` compresses into the game). Built from code so it can be changed and run again:

    blender -b -P assets/blender/temple_kit.py -- assets/models/temple-kit.glb [preview.png]
    pnpm models

Every piece is written in the game's own frame: metres, y up, the front toward +z, standing on the
ground at the origin. `at()` turns that into Blender's z-up frame; the glTF exporter turns it back.

The roofs are what code-built boxes can't do: hip roofs that sweep up from low eaves to the ridge,
with corners that lift at the ends (`curved_roof`).
"""

import math
import sys

import bmesh
import bpy
from mathutils import Vector


def at(x, y, z):
    """The game's (x, y up, z toward the camera) in Blender's (x, -y toward the camera, z up)."""
    return Vector((x, -z, y))


# -- Materials ---------------------------------------------------------------------------------------

def material(name, colour, roughness=0.8, metallic=0.0, emission=None, strength=0.0):
    made = bpy.data.materials.new(name)
    made.use_nodes = True
    shader = made.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = (*colour, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    if emission is not None:
        shader.inputs['Emission Color'].default_value = (*emission, 1)
        shader.inputs['Emission Strength'].default_value = strength
    return made


def srgb(hex_colour):
    """A hex colour as linear RGB, the way Blender and glTF keep colours."""
    def channel(value):
        value /= 255
        return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4
    return tuple(channel((hex_colour >> shift) & 0xFF) for shift in (16, 8, 0))


MATERIALS = {}


def materials():
    MATERIALS.update({
        'Lacquer': material('Lacquer', srgb(0xB0281C), 0.55),
        'LacquerDark': material('LacquerDark', srgb(0x7A1C14), 0.6),
        'Plaster': material('Plaster', srgb(0xEDE5D2), 0.95),
        'Timber': material('Timber', srgb(0x4A3426), 0.8),
        'RoofTile': material('RoofTile', srgb(0x2E333C), 0.65),
        'RoofEdge': material('RoofEdge', srgb(0x5A606A), 0.7),
        'Stone': material('Stone', srgb(0x9A9488), 1.0),
        'StoneDark': material('StoneDark', srgb(0x6E685E), 1.0),
        'Gold': material('Gold', srgb(0xD4A94A), 0.35, metallic=0.8),
        'Black': material('Black', srgb(0x1C1A18), 0.6),
        'Paper': material('Paper', srgb(0xFFE6B8), 0.9, emission=srgb(0xFFC27A), strength=1.6),
        'Lantern': material('Lantern', srgb(0xE04A24), 0.7, emission=srgb(0xFF6A30), strength=2.2),
    })


# -- Shapes --------------------------------------------------------------------------------------------

def new_object(name, mesh, material_names, parent):
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    for material_name in material_names:
        obj.data.materials.append(MATERIALS[material_name])
    obj.parent = parent
    return obj


def box(parent, material_name, centre, size, turn=0.0):
    """A box `size` (width, height, depth) metres, centred on `centre`, turned `turn` about y."""
    mesh = bpy.data.meshes.new('box')
    built = bmesh.new()
    bmesh.ops.create_cube(built, size=1.0)
    bmesh.ops.scale(built, vec=Vector((size[0], size[2], size[1])), verts=built.verts)
    bmesh.ops.rotate(built, verts=built.verts, cent=Vector(), matrix=_turn(turn))
    bmesh.ops.translate(built, vec=at(*centre), verts=built.verts)
    built.to_mesh(mesh)
    built.free()
    return new_object('box', mesh, [material_name], parent)


def cylinder(parent, material_name, centre, radius, height, sides=10, top_radius=None):
    """An upright cylinder (or cone, with `top_radius`) standing on `centre`."""
    mesh = bpy.data.meshes.new('cylinder')
    built = bmesh.new()
    bmesh.ops.create_cone(built, cap_ends=True, segments=sides, radius1=radius,
                          radius2=radius if top_radius is None else top_radius, depth=height)
    bmesh.ops.translate(built, vec=at(centre[0], centre[1] + height / 2, centre[2]), verts=built.verts)
    built.to_mesh(mesh)
    built.free()
    return new_object('cylinder', mesh, [material_name], parent)


def sphere(parent, material_name, centre, radius):
    mesh = bpy.data.meshes.new('sphere')
    built = bmesh.new()
    bmesh.ops.create_uvsphere(built, u_segments=10, v_segments=6, radius=radius)
    bmesh.ops.translate(built, vec=at(*centre), verts=built.verts)
    built.to_mesh(mesh)
    built.free()
    return new_object('sphere', mesh, [material_name], parent)


def _turn(angle):
    from mathutils import Matrix
    return Matrix.Rotation(angle, 3, 'Z')


def curved_roof(parent, centre, width, depth, height, lift, thickness=0.28, steps=6, run=10, faces=('RoofTile', 'RoofEdge'), sweep=1.7):
    """
    A hip roof `width` by `depth` metres at the eaves, `height` metres from eave to ridge, standing
    on `centre`. Each of its four slopes goes from the eave to the ridge (a point when the roof is
    square), rising slowly at first and steeply at the top, the way temple roofs sweep. The eaves
    lift toward the corners by up to `lift` metres. Tiles on top, a lighter edge round the rim.
    """
    a = width / 2
    b = depth / 2
    ridge = max(a - b, 0.0)
    # Each slope as (eave start, eave end, ridge start, ridge end), in (x, z).
    slopes = [
        ((-a, b), (a, b), (-ridge, 0), (ridge, 0)),
        ((a, b), (a, -b), (ridge, 0), (ridge, 0)),
        ((a, -b), (-a, -b), (ridge, 0), (-ridge, 0)),
        ((-a, -b), (-a, b), (-ridge, 0), (-ridge, 0)),
    ]
    mesh = bpy.data.meshes.new('roof')
    built = bmesh.new()
    for eave_from, eave_to, ridge_from, ridge_to in slopes:
        grid = []
        for row in range(steps + 1):
            t = row / steps
            line = []
            for column in range(run + 1):
                s = column / run
                ex = eave_from[0] + (eave_to[0] - eave_from[0]) * s
                ez = eave_from[1] + (eave_to[1] - eave_from[1]) * s
                rx = ridge_from[0] + (ridge_to[0] - ridge_from[0]) * s
                rz = ridge_from[1] + (ridge_to[1] - ridge_from[1]) * s
                x = ex + (rx - ex) * t
                z = ez + (rz - ez) * t
                corner = abs(2 * s - 1) ** 4
                y = height * t ** sweep + lift * corner * (1 - t) ** 2
                line.append(built.verts.new(at(centre[0] + x, centre[1] + y, centre[2] + z)))
            grid.append(line)
        for row in range(steps):
            for column in range(run):
                quad = [grid[row][column], grid[row][column + 1], grid[row + 1][column + 1], grid[row + 1][column]]
                if len({id(vert) for vert in quad}) == 4:
                    built.faces.new(quad)
    bmesh.ops.remove_doubles(built, verts=built.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(built, faces=built.faces)
    # Normals up: the side the tiles are on.
    for face in built.faces:
        if face.normal.z < 0:
            face.normal_flip()
    built.to_mesh(mesh)
    built.free()
    roof = new_object('roof', mesh, list(faces), parent)
    solid = roof.modifiers.new('thickness', 'SOLIDIFY')
    solid.thickness = thickness
    solid.offset = -1
    solid.material_offset_rim = 1
    solid.use_rim = True
    return roof


def ridge_cap(parent, centre, length, height=0.35):
    """The ridge along x, with a gilt ornament (shibi) standing at each end."""
    box(parent, 'RoofEdge', (centre[0], centre[1] + height / 2, centre[2]), (length + 0.3, height, 0.45))
    if length > 0:
        for side in (-1, 1):
            x = centre[0] + side * length / 2
            box(parent, 'Gold', (x, centre[1] + height + 0.45, centre[2]), (0.35, 0.9, 0.3))
            box(parent, 'Gold', (x - side * 0.18, centre[1] + height + 0.95, centre[2]), (0.5, 0.25, 0.28))


# -- The pieces ----------------------------------------------------------------------------------------

def root(name):
    empty = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(empty)
    return empty


def temple_hall():
    """The hall (hondō): a stone platform with steps, red pillars, white walls with lattice doors, two roofs."""
    hall = root('Hall')
    width, depth = 22.0, 13.0
    floor = 2.0
    box(hall, 'Stone', (0, 0.9, 0), (width + 3, 1.8, depth + 3))
    box(hall, 'StoneDark', (0, 1.85, 0), (width + 3.2, 0.12, depth + 3.2))
    for step in range(6):
        box(hall, 'Stone', (0, 0.15 + step * 0.3, depth / 2 + 1.5 + 2.7 - step * 0.45), (6.5, 0.3, 0.45 + step * 0.9))
    box(hall, 'Timber', (0, floor - 0.08, 0), (width + 1.6, 0.2, depth + 1.6))

    # Pillars all round, the front row clear of the walls as a veranda.
    columns = 8
    xs = [-width / 2 + 0.6 + i * (width - 1.2) / (columns - 1) for i in range(columns)]
    for x in xs:
        cylinder(hall, 'Lacquer', (x, floor, depth / 2), 0.34, 5.2, sides=12)
        cylinder(hall, 'StoneDark', (x, floor, depth / 2), 0.5, 0.18, sides=8)
        box(hall, 'Timber', (x, floor + 5.35, depth / 2), (0.9, 0.3, 0.9))
        box(hall, 'Gold', (x, floor + 5.55, depth / 2 + 0.46), (0.5, 0.18, 0.06))
    for z in (-depth / 2 + 0.4, 0):
        for x in (xs[0], xs[-1]):
            cylinder(hall, 'Lacquer', (x, floor, z), 0.34, 5.2, sides=12)

    # Walls behind the veranda: plaster above a timber band, framed in red.
    wall_depth = depth - 2.6
    wall_z = -1.3
    box(hall, 'Plaster', (0, floor + 2.6, wall_z), (width - 1.6, 5.2, wall_depth))
    box(hall, 'Timber', (0, floor + 0.35, wall_z), (width - 1.5, 0.7, wall_depth + 0.1))
    for y in (floor + 3.6, floor + 5.0):
        box(hall, 'Lacquer', (0, y, depth / 2), (width + 0.2, 0.32, 0.36))
        box(hall, 'Lacquer', (0, y, wall_z + wall_depth / 2 + 0.05), (width - 1.4, 0.26, 0.12))

    # Lattice doors across the front wall: paper lit from inside, behind a grid of thin bars.
    front = wall_z + wall_depth / 2 + 0.08
    door_width = (width - 3) / 6
    for door in range(6):
        x = -width / 2 + 1.5 + door_width * (door + 0.5)
        box(hall, 'Paper', (x, floor + 1.95, front - 0.03), (door_width - 0.2, 2.5, 0.05))
        box(hall, 'Timber', (x - door_width / 2, floor + 1.95, front), (0.14, 2.7, 0.12))
        for bar in range(1, 4):
            box(hall, 'Timber', (x - door_width / 2 + bar * door_width / 4, floor + 1.95, front + 0.02), (0.05, 2.5, 0.05))
        for bar in range(1, 7):
            box(hall, 'Timber', (x, floor + 0.7 + bar * 2.5 / 7, front + 0.02), (door_width - 0.2, 0.05, 0.05))

    # Red paper lanterns hanging under the eaves, between the pillars.
    for left, right in zip(xs, xs[1:]):
        x = (left + right) / 2
        cylinder(hall, 'Black', (x, floor + 4.25, depth / 2), 0.36, 0.08, sides=10)
        cylinder(hall, 'Lantern', (x, floor + 3.4, depth / 2), 0.42, 0.85, sides=10)
        cylinder(hall, 'Black', (x, floor + 3.32, depth / 2), 0.36, 0.08, sides=10)
        box(hall, 'Black', (x, floor + 4.6, depth / 2), (0.03, 0.7, 0.03))

    box(hall, 'Gold', (0, floor + 4.35, depth / 2 + 0.25), (2.6, 0.9, 0.1))
    box(hall, 'Black', (0, floor + 4.35, depth / 2 + 0.3), (2.3, 0.65, 0.05))

    eaves = floor + 5.7
    curved_roof(hall, (0, eaves, 0), width + 6, depth + 6, 3.4, 1.1)
    upper_y = eaves + 2.2
    box(hall, 'Plaster', (0, upper_y + 0.9, 0), (12, 2.4, 6.2))
    box(hall, 'Lacquer', (0, upper_y + 2.0, 0), (12.3, 0.28, 6.5))
    for x in (-6, -2, 2, 6):
        box(hall, 'Lacquer', (x, upper_y + 0.9, 3.12), (0.3, 2.4, 0.1))
    curved_roof(hall, (0, upper_y + 2.1, 0), 17, 10.5, 4.4, 0.9)
    ridge_cap(hall, (0, upper_y + 6.4, 0), 17 - 10.5)
    return hall


def pagoda():
    """A five-storey pagoda: storeys narrowing upward under wide curved roofs, a gilt spire on top."""
    tower = root('Pagoda')
    box(tower, 'Stone', (0, 0.45, 0), (8.5, 0.9, 8.5))
    for step in range(3):
        box(tower, 'Stone', (0, 0.15 + step * 0.3, 4.25 + 1.2 - step * 0.4), (2.6, 0.3, 0.4 + step * 0.8))
    y = 0.9
    for storey in range(5):
        size = 5.2 - storey * 0.62
        tall = 2.5 if storey == 0 else 2.1
        box(tower, 'Lacquer', (0, y + tall / 2, 0), (size, tall, size))
        # A dark timber door on each face, with a gilt band over it.
        box(tower, 'Timber', (0, y + tall * 0.45, size / 2 + 0.02), (size * 0.36, tall * 0.62, 0.04))
        box(tower, 'Timber', (0, y + tall * 0.45, -size / 2 - 0.02), (size * 0.36, tall * 0.62, 0.04))
        box(tower, 'Gold', (0, y + tall * 0.82, size / 2 + 0.03), (size * 0.44, 0.08, 0.04))
        for side in (-1, 1):
            box(tower, 'Timber', (side * (size / 2 + 0.02), y + tall * 0.45, 0), (0.04, tall * 0.62, size * 0.36))
        box(tower, 'Timber', (0, y + tall + 0.15, 0), (size + 0.6, 0.3, size + 0.6))
        roof_size = size + 3.4 - storey * 0.15
        curved_roof(tower, (0, y + tall + 0.25, 0), roof_size, roof_size, 1.25, 0.65, thickness=0.22, steps=4, run=8)
        y += tall + 1.0
    # The spire (sōrin): a post with nine rings, a canopy and a jewel.
    cylinder(tower, 'Gold', (0, y - 0.2, 0), 0.6, 0.5, sides=8, top_radius=0.4)
    cylinder(tower, 'Gold', (0, y, 0), 0.14, 5.0, sides=8)
    for ring in range(9):
        cylinder(tower, 'Gold', (0, y + 0.6 + ring * 0.42, 0), 0.42 - ring * 0.015, 0.1, sides=12)
    cylinder(tower, 'Gold', (0, y + 4.5, 0), 0.5, 0.25, sides=12, top_radius=0.1)
    sphere(tower, 'Gold', (0, y + 5.15, 0), 0.25)
    return tower


def stone_lantern():
    """A stone lantern (tōrō): hexagonal base, post, the lit firebox, a flared roof and a jewel on top."""
    lantern = root('StoneLantern')
    cylinder(lantern, 'Stone', (0, 0, 0), 0.5, 0.25, sides=6)
    cylinder(lantern, 'Stone', (0, 0.25, 0), 0.36, 0.12, sides=6, top_radius=0.2)
    cylinder(lantern, 'Stone', (0, 0.37, 0), 0.17, 0.8, sides=12)
    cylinder(lantern, 'Stone', (0, 1.17, 0), 0.24, 0.18, sides=6, top_radius=0.42)
    cylinder(lantern, 'Paper', (0, 1.35, 0), 0.27, 0.42, sides=6)
    for side in range(6):
        angle = side * math.pi / 3 + math.pi / 6
        box(lantern, 'Stone', (math.sin(angle) * 0.27, 1.56, math.cos(angle) * 0.27), (0.1, 0.42, 0.1))
    cylinder(lantern, 'Stone', (0, 1.77, 0), 0.62, 0.12, sides=6, top_radius=0.55)
    cylinder(lantern, 'Stone', (0, 1.89, 0), 0.55, 0.32, sides=6, top_radius=0.08)
    sphere(lantern, 'Stone', (0, 2.3, 0), 0.12)
    return lantern


def torii():
    """A torii (myōjin style): leaning posts, a tie beam, and a top beam that sweeps up at its ends."""
    gate = root('Torii')
    span = 3.6
    tall = 4.7
    for side in (-1, 1):
        post = cylinder(gate, 'Lacquer', (0, 0, 0), 0.24, tall, sides=12, top_radius=0.2)
        # Leaning in a little at the top.
        post.location = at(side * span / 2, 0, 0)
        post.rotation_euler = (0, side * math.radians(2.5), 0)
        cylinder(gate, 'Black', (side * span / 2, 0, 0), 0.3, 0.45, sides=12)
    box(gate, 'Lacquer', (0, 3.75, 0), (span + 1.4, 0.26, 0.22))
    box(gate, 'Lacquer', (0, 4.1, 0), (0.28, 0.6, 0.18))
    box(gate, 'Black', (0, 4.1, 0.1), (0.5, 0.45, 0.04))
    _swept_beam(gate, 'Lacquer', y=4.45, half=span / 2 + 1.25, height=0.32, depth=0.42, sweep=0.35)
    _swept_beam(gate, 'Black', y=4.77, half=span / 2 + 1.4, height=0.2, depth=0.5, sweep=0.42)
    return gate


def _swept_beam(parent, material_name, y, half, height, depth, sweep, segments=16):
    """A beam along x whose ends sweep up by `sweep` metres, like a torii's top beams."""
    mesh = bpy.data.meshes.new('beam')
    built = bmesh.new()
    rings = []
    for index in range(segments + 1):
        x = -half + 2 * half * index / segments
        lift = sweep * (abs(x) / half) ** 2.5
        ring = [built.verts.new(at(x, y + lift + dy, dz)) for dy, dz in
                ((0, -depth / 2), (0, depth / 2), (height, depth / 2), (height, -depth / 2))]
        rings.append(ring)
    for first, second in zip(rings, rings[1:]):
        for corner in range(4):
            built.faces.new([first[corner], first[(corner + 1) % 4], second[(corner + 1) % 4], second[corner]])
    built.faces.new(list(reversed(rings[0])))
    built.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(built, faces=built.faces)
    built.to_mesh(mesh)
    built.free()
    return new_object('beam', mesh, [material_name], parent)


# -- Putting it together ---------------------------------------------------------------------------

def join_children(root_object):
    """Bakes each piece's modifiers and joins it into one mesh under its root, so a piece is one mesh."""
    children = [child for child in root_object.children if child.type == 'MESH']
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for child in children:
        evaluated = child.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(evaluated)
        mesh.transform(child.matrix_basis)
        child.modifiers.clear()
        child.data = mesh
        child.matrix_basis.identity()
    bpy.ops.object.select_all(action='DESELECT')
    for child in children:
        child.select_set(True)
    bpy.context.view_layer.objects.active = children[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = f'{root_object.name}Mesh'
    joined.data.name = root_object.name
    for polygon in joined.data.polygons:
        polygon.use_smooth = False
    return joined


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = argv[0] if argv else 'temple-kit.glb'
    preview = argv[1] if len(argv) > 1 else None

    bpy.ops.wm.read_factory_settings(use_empty=True)
    materials()
    pieces = [temple_hall(), pagoda(), stone_lantern(), torii()]
    for piece in pieces:
        join_children(piece)

    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True,
                              export_materials='EXPORT', export_extras=False, export_lights=False,
                              export_cameras=False)

    if preview is not None:
        render_preview(pieces, preview)


def render_preview(pieces, path):
    """Lays the pieces out side by side and renders them, to look at without starting the game."""
    for piece, x in zip(pieces, (0, 22, 34, 41)):
        piece.location = at(x, 0, 0)
    ground = bpy.data.meshes.new('ground')
    built = bmesh.new()
    bmesh.ops.create_grid(built, x_segments=1, y_segments=1, size=80)
    built.to_mesh(ground)
    built.free()
    plane = new_object('Ground', ground, ['StoneDark'], None)
    plane.location = at(20, 0, -10)

    sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
    sun.data.energy = 4
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
    bpy.context.collection.objects.link(sun)
    world = bpy.data.worlds.new('World')
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.42, 0.45, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    bpy.context.scene.world = world

    camera = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera'))
    bpy.context.collection.objects.link(camera)
    camera.location = at(20, 12, 46)
    direction = at(20, 6, 0) - camera.location
    camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    camera.data.lens = 32
    scene = bpy.context.scene
    scene.camera = camera
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 800
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    main()
