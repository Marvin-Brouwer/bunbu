"""
The stage kit: the buildings and props of the stages besides castle town, in one GLB for the game
(`assets/models/stage-kit.glb`, which `pnpm models` compresses into the game):

    blender -b -P assets/blender/stage_kit.py -- assets/models/stage-kit.glb [preview.png]
    pnpm models

It builds on the temple kit's tools (`temple_kit.py`: the frame, the materials, the curved roofs), so
the stages share one style with the temple. Each piece is a root named for it, in the game's frame.

- Rice fields: `Farmhouse`, a farmhouse (minka) under a thick thatched roof, and `Scarecrow`, a
  scarecrow (kakashi) in a straw coat and hat.
- Bamboo forest: `BambooClump`, a few tall stalks with leaves at the top, light enough to stand by
  the thousand; `Shrine`, a small wayside shrine (hokora); and `Jizo`, a stone Jizō in a red bib.
- Mountain temple: `Pine`, a Japanese black pine with a twisting trunk and flat pads of needles.
- Edo castle: `CastleWall`, six metres of curving stone wall (ishigaki) under a white plastered wall
  with a tiled cap, its face toward +z; `CastleGate`, a gatehouse (yaguramon) over an eight-metre
  passage; and `CastleKeep`, the keep (tenshu): five storeys of white walls under curved roofs on a
  sloping stone base, with gilt fish-tigers (shachihoko) on the top ridge; and `CastleTurret`, a
  corner turret (sumi-yagura): two white storeys on a stone base as high as the walls; and
  `CastleOuterGate`, the plain first gate (kōraimon) of a square gate court (masugata): two posts
  under a small roof over an eight-metre passage, with a little roof over each post behind.
  `CastleTamon`, a long storehouse along the top of the wall (tamon-yagura): six metres of the same
  stone wall, under a white storey with barred windows and a tiled roof, to stand in a row of walls.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

import temple_kit as kit  # noqa: E402
from temple_kit import box, curved_roof, cylinder, ridge_cap, root, sphere  # noqa: E402


def stage_materials():
    kit.materials()
    kit.MATERIALS.update({
        'Thatch': kit.material('Thatch', kit.srgb(0x9C7A48), 1.0),
        'ThatchEdge': kit.material('ThatchEdge', kit.srgb(0x6E5432), 1.0),
        'Straw': kit.material('Straw', kit.srgb(0xC9A85E), 1.0),
        'Cloth': kit.material('Cloth', kit.srgb(0xE6DCC4), 0.95),
        'Indigo': kit.material('Indigo', kit.srgb(0x2F4A7A), 0.9),
        'Earth': kit.material('Earth', kit.srgb(0x7A6448), 1.0),
        'Bamboo': kit.material('Bamboo', kit.srgb(0x7FA046), 0.6),
        'BambooNode': kit.material('BambooNode', kit.srgb(0x5E7A32), 0.7),
        'BambooLeaf': kit.material('BambooLeaf', kit.srgb(0x7AA848), 0.8),
        'Bib': kit.material('Bib', kit.srgb(0xC0281E), 0.9),
        'Moss': kit.material('Moss', kit.srgb(0x5A6E34), 1.0),
        'Bark': kit.material('Bark', kit.srgb(0x4A3A30), 1.0),
        'Needles': kit.material('Needles', kit.srgb(0x2F5230), 0.9),
        'WallStone': kit.material('WallStone', kit.srgb(0x8C877C), 1.0),
        'Iron': kit.material('Iron', kit.srgb(0x2A2A2E), 0.5, metallic=0.6),
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


def bamboo_clump():
    """A few tall stalks, leaning a little apart, each ringed at its nodes and tufted with leaves up top."""
    clump = root('BambooClump')
    stalks = [(0.0, 0.0, 11.0, 0.0), (0.45, 0.3, 9.5, 0.05), (-0.35, 0.4, 10.2, -0.04), (0.15, -0.45, 8.6, 0.03)]
    for x, z, tall, lean in stalks:
        stalk = cylinder(clump, 'Bamboo', (0, 0, 0), 0.07, tall, sides=6, top_radius=0.045)
        stalk.location = kit.at(x, 0, z)
        stalk.rotation_euler = (lean, lean * 0.6, 0)
        # The rings lean with their stalk, so each sits on it rather than beside it.
        for node in range(1, int(tall / 2.0)):
            ring = cylinder(clump, 'BambooNode', (0, node * 2.0 - 0.03, 0), 0.08 - node * 0.004, 0.06, sides=6)
            ring.location = stalk.location
            ring.rotation_euler = stalk.rotation_euler
        # Leaves: a few flat sprays near the top, pointing out and drooping.
        for leaf in range(5):
            angle = leaf * 2 * math.pi / 5 + x
            height = tall * (0.72 + 0.05 * leaf)
            spray = box(clump, 'BambooLeaf', (0, 0, 0), (1.0, 0.02, 0.24))
            spray.location = kit.at(x + math.cos(angle) * 0.65, height, z + math.sin(angle) * 0.65)
            spray.rotation_euler = (0.0, 0.35, -angle)
    return clump


def shrine():
    """A small wayside shrine (hokora): a stone base, a wooden house with a gable roof, a red cloth."""
    house = root('Shrine')
    box(house, 'Stone', (0, 0.25, 0), (1.2, 0.5, 1.0))
    box(house, 'Stone', (0, 0.55, 0), (1.0, 0.1, 0.85))
    box(house, 'Timber', (0, 1.0, 0), (0.75, 0.8, 0.6))
    box(house, 'Black', (0, 0.95, 0.31), (0.4, 0.55, 0.02))
    box(house, 'Gold', (0, 1.25, 0.32), (0.18, 0.12, 0.02))
    # A gable roof of two boards, steep, overhanging front and back.
    for side in (-1, 1):
        board = box(house, 'Timber', (0, 0, 0), (1.05, 0.06, 0.62))
        board.location = kit.at(0, 1.58, side * 0.24)
        board.rotation_euler = (side * 0.75, 0, 0)
    box(house, 'Timber', (0, 1.8, 0), (1.1, 0.08, 0.08))
    box(house, 'Bib', (0, 1.38, 0.33), (0.6, 0.12, 0.02))
    return house


def jizo():
    """A stone Jizō: a round-headed figure in a red bib and cap, on a lotus base, hands together."""
    figure = root('Jizo')
    cylinder(figure, 'Stone', (0, 0, 0), 0.32, 0.18, sides=10)
    cylinder(figure, 'Stone', (0, 0.18, 0), 0.2, 0.55, sides=10, top_radius=0.17)
    box(figure, 'Bib', (0, 0.62, 0.12), (0.34, 0.24, 0.08))
    sphere(figure, 'Stone', (0, 0.88, 0), 0.15)
    cylinder(figure, 'Bib', (0, 0.94, 0), 0.155, 0.12, sides=10, top_radius=0.1)
    box(figure, 'Stone', (0, 0.5, 0.18), (0.1, 0.14, 0.06))
    return figure


def pine():
    """A black pine (kuromatsu): a trunk that twists up in three bends, and flat pads of needles on its branches."""
    tree = root('Pine')
    # The trunk in three bends, each leaning a little more than the one below.
    bends = [(0.0, 0.0, 0.0, 0.32, 2.6, 0.12), (0.3, 2.5, 0.1, 0.26, 2.4, -0.25), (-0.25, 4.8, -0.15, 0.2, 2.2, 0.3)]
    for x, y, z, radius, tall, lean in bends:
        part = cylinder(tree, 'Bark', (0, 0, 0), radius, tall, sides=7, top_radius=radius * 0.78)
        part.location = kit.at(x, y, z)
        part.rotation_euler = (lean * 0.5, lean, 0)
    # Pads of needles: wide, flat and dark, layered up the tree and out on its branches.
    pads = [(1.4, 3.4, 0.4, 1.5), (-1.3, 4.3, -0.3, 1.3), (0.9, 5.6, -0.6, 1.2), (-0.6, 6.6, 0.5, 1.1), (0.1, 7.4, 0.0, 0.9), (-1.6, 2.6, 0.7, 1.0)]
    for x, y, z, size in pads:
        branch = cylinder(tree, 'Bark', (0, 0, 0), 0.07, abs(x) + 0.2, sides=5)
        branch.location = kit.at(0, y - 0.2, z * 0.5)
        branch.rotation_euler = (0, math.copysign(math.pi / 2, -x), 0)
        # Made at the origin and then moved, so flattening it doesn't move it.
        pad = sphere(tree, 'Needles', (0, 0, 0), size)
        pad.location = kit.at(x, y, z)
        pad.scale = (1.0, 1.0, 0.32)
    return tree


def _extrude(parent, material_name, profile, length):
    """A shape from `profile` (z, y points, wound round) pushed along x for `length` metres, centred."""
    import bmesh
    mesh = bpy.data.meshes.new('extruded')
    built = bmesh.new()
    ends = []
    for x in (-length / 2, length / 2):
        ends.append([built.verts.new(kit.at(x, y, z)) for z, y in profile])
    count = len(profile)
    for index in range(count):
        a, b = index, (index + 1) % count
        built.faces.new([ends[0][a], ends[0][b], ends[1][b], ends[1][a]])
    built.faces.new(list(reversed(ends[0])))
    built.faces.new(ends[1])
    bmesh.ops.recalc_face_normals(built, faces=built.faces)
    built.to_mesh(mesh)
    built.free()
    return kit.new_object('extruded', mesh, [material_name], parent)


# The stone wall's face: a concave batter, wide at the foot and rising nearly upright (ōgi-kōbai).
WALL_FACE = [(1.6, 0.0), (1.0, 1.1), (0.55, 2.2), (0.22, 3.3), (0.05, 4.3), (0.0, 4.8)]


def castle_wall():
    """Six metres of stone wall: the curving stone face, a white wall on top, a tiled cap."""
    wall = root('CastleWall')
    length = 6.0
    profile = WALL_FACE + [(-2.0, 4.8), (-2.0, 0.0)]
    _extrude(wall, 'WallStone', profile, length)
    # Courses of stone: darker bands across the face.
    for z, y in WALL_FACE[1:-1]:
        _extrude(wall, 'StoneDark', [(z + 0.06, y - 0.06), (z + 0.06, y + 0.06), (z - 0.1, y + 0.06), (z - 0.1, y - 0.06)], length + 0.02)
    box(wall, 'Plaster', (0, 5.55, -0.7), (length + 0.02, 1.5, 0.45))
    box(wall, 'Timber', (0, 4.95, -0.7), (length + 0.03, 0.3, 0.5))
    # A cap of tiles: two sloping boards meeting over the wall, and the ridge on top.
    for side in (-1, 1):
        board = box(wall, 'RoofTile', (0, 0, 0), (length + 0.04, 0.12, 0.75))
        board.location = kit.at(0, 6.45, -0.7 + side * 0.3)
        board.rotation_euler = (side * 0.45, 0, 0)
    box(wall, 'RoofEdge', (0, 6.62, -0.7), (length + 0.06, 0.16, 0.2))
    return wall


def castle_gate():
    """A gatehouse (yaguramon): stone footings either side of the passage, a white storey across it, a roof."""
    gate = root('CastleGate')
    passage = 8.0
    for side in (-1, 1):
        footing = _extrude(gate, 'WallStone', WALL_FACE + [(-6.0, 4.8), (-6.0, 0.0)], 5.0)
        footing.location = kit.at(side * (passage / 2 + 2.5), 0, 3.0)
        # Doors swung open against the footings: dark timber studded with iron.
        box(gate, 'Timber', (side * (passage / 2 - 0.15), 2.3, -0.4), (0.25, 4.6, 3.6))
        for row in range(4):
            box(gate, 'Iron', (side * (passage / 2 - 0.3), 0.8 + row * 1.1, -0.4), (0.06, 0.12, 3.2))
    width = passage + 10.4
    box(gate, 'Timber', (0, 5.0, 0.4), (width, 0.4, 6.4))
    box(gate, 'Plaster', (0, 6.6, 0.4), (width - 0.4, 2.8, 5.8))
    box(gate, 'Timber', (0, 5.5, 3.32), (width - 0.3, 0.6, 0.06))
    # Arrow slits and a row of latticed windows in the white wall.
    for index in range(6):
        x = -width / 2 + 1.8 + index * (width - 3.6) / 5
        box(gate, 'Black', (x, 6.9, 3.33), (1.2, 0.9, 0.04))
        for bar in range(-2, 3):
            box(gate, 'Timber', (x + bar * 0.24, 6.9, 3.36), (0.05, 0.9, 0.04))
    curved_roof(gate, (0, 7.9, 0.4), width + 2.6, 8.4, 3.2, 0.7)
    ridge_cap(gate, (0, 11.1, 0.4), width + 2.6 - 8.4)
    return gate


def castle_keep():
    """The keep (tenshu): a sloping stone base, then five white storeys, each under its own curved roof."""
    keep = root('CastleKeep')
    base = cylinder(keep, 'WallStone', (0, 0, 0), 17.0, 9.0, sides=4, top_radius=14.2)
    base.rotation_euler = (0, 0, math.pi / 4)
    y = 9.0
    for storey in range(5):
        width = 18.0 - storey * 2.8
        depth = 14.0 - storey * 2.2
        tall = 4.2 if storey < 4 else 3.6
        box(keep, 'Plaster', (0, y + tall / 2, 0), (width, tall, depth))
        box(keep, 'Black', (0, y + 0.3, 0), (width + 0.1, 0.6, depth + 0.1))
        # Windows in a row along each long side.
        windows = max(2, int(width / 3))
        for index in range(windows):
            x = -width / 2 + (index + 0.5) * width / windows
            for z in (depth / 2 + 0.02, -depth / 2 - 0.02):
                box(keep, 'Black', (x, y + tall * 0.55, z), (1.0, 1.1, 0.04))
        roof_y = y + tall - 0.1
        curved_roof(keep, (0, roof_y, 0), width + 3.4, depth + 3.4, 2.6 if storey < 4 else 4.0, 1.0, steps=4, run=8)
        # A small gable (chidori-hafu) on the front of the middle roofs.
        if 0 < storey < 4:
            gable = cylinder(keep, 'RoofTile', (0, 0, 0), 2.4, 1.8, sides=3)
            gable.location = kit.at(0, roof_y + 0.4, depth / 2 + 1.0)
            gable.rotation_euler = (math.pi / 2, 0, 0)
        y += tall + (1.8 if storey < 4 else 0)
    top = y + 4.0
    ridge = (18.0 - 4 * 2.8 + 3.4) - (14.0 - 4 * 2.2 + 3.4)
    ridge_cap(keep, (0, top - 0.3, 0), ridge)
    for side in (-1, 1):
        box(keep, 'Gold', (side * (ridge / 2 + 0.3), top + 0.9, 0), (0.5, 1.6, 0.5))
        box(keep, 'Gold', (side * (ridge / 2 + 0.6), top + 1.6, 0), (0.7, 0.35, 0.4))
    return keep


def castle_turret():
    """A corner turret (sumi-yagura): a sloping stone base as high as the walls, then two white storeys under curved roofs."""
    turret = root('CastleTurret')
    base = cylinder(turret, 'WallStone', (0, 0, 0), 4.6, 4.8, sides=4, top_radius=3.6)
    base.rotation_euler = (0, 0, math.pi / 4)
    y = 4.8
    for storey, (width, tall) in enumerate([(5.0, 2.8), (3.6, 2.4)]):
        box(turret, 'Plaster', (0, y + tall / 2, 0), (width, tall, width))
        box(turret, 'Black', (0, y + 0.2, 0), (width + 0.1, 0.4, width + 0.1))
        # Two windows on each side.
        for offset in (-width / 4, width / 4):
            for z in (width / 2 + 0.02, -width / 2 - 0.02):
                box(turret, 'Black', (offset, y + tall * 0.55, z), (0.8, 0.8, 0.04))
                box(turret, 'Black', (z, y + tall * 0.55, offset), (0.04, 0.8, 0.8))
        roof_y = y + tall - 0.1
        curved_roof(turret, (0, roof_y, 0), width + 2.4, width + 2.4, 1.6 if storey == 0 else 2.6, 0.6, steps=4, run=8)
        y += tall + (1.0 if storey == 0 else 0)
    ridge_cap(turret, (0, y + 2.3, 0), 0)
    return turret


def castle_outer_gate():
    """A kōraimon: two posts under a beam and a small gable roof, a post behind each with a roof of its own, doors swung open."""
    gate = root('CastleOuterGate')
    passage = 8.0
    def gable(centre, length, depth, lift=0.4):
        x, y, z = centre
        for side in (-1, 1):
            board = box(gate, 'RoofTile', (0, 0, 0), (length, 0.12, depth / 2 + 0.1))
            board.location = kit.at(x, y, z + side * depth / 4)
            board.rotation_euler = (side * lift, 0, 0)
        box(gate, 'RoofEdge', (x, y + depth / 4 * math.sin(lift) + 0.1, z), (length + 0.04, 0.16, 0.22))
    for side in (-1, 1):
        x = side * (passage / 2 + 0.3)
        box(gate, 'Timber', (x, 2.5, 0), (0.6, 5.0, 0.6))
        box(gate, 'Timber', (x, 1.8, -2.2), (0.35, 3.6, 0.35))
        box(gate, 'Timber', (x, 3.2, -1.1), (0.25, 0.25, 2.2))
        gable((x, 3.9, -2.2), 1.2, 1.4)
        # The door swung open, back against the post behind.
        box(gate, 'Timber', (side * (passage / 2 - 0.15), 2.1, -1.1), (0.15, 4.0, 2.0))
        for row in range(3):
            box(gate, 'Iron', (side * (passage / 2 - 0.25), 0.9 + row * 1.3, -1.1), (0.04, 0.1, 1.8))
    box(gate, 'Timber', (0, 4.7, 0), (passage + 2.4, 0.5, 0.6))
    gable((0, 5.25, 0), passage + 3.2, 2.0)
    return gate


def castle_tamon():
    """Six metres of the stone wall with a long white storey on it (tamon-yagura), its windows toward +z."""
    tamon = root('CastleTamon')
    length = 6.0
    depth = 3.4
    _extrude(tamon, 'WallStone', WALL_FACE + [(-depth + 0.2, 4.8), (-depth + 0.2, 0.0)], length)
    for z, y in WALL_FACE[1:-1]:
        _extrude(tamon, 'StoneDark', [(z + 0.06, y - 0.06), (z + 0.06, y + 0.06), (z - 0.1, y + 0.06), (z - 0.1, y - 0.06)], length + 0.02)
    middle = 0.2 - depth / 2
    box(tamon, 'Timber', (0, 4.95, middle), (length + 0.03, 0.3, depth + 0.1))
    box(tamon, 'Plaster', (0, 6.4, middle), (length + 0.02, 2.6, depth))
    box(tamon, 'Black', (0, 5.25, middle), (length + 0.04, 0.3, depth + 0.04))
    # Two barred windows toward the way.
    for x in (-1.5, 1.5):
        box(tamon, 'Black', (x, 6.6, middle + depth / 2 + 0.01), (1.3, 0.8, 0.04))
        for bar in range(-2, 3):
            box(tamon, 'Timber', (x + bar * 0.25, 6.6, middle + depth / 2 + 0.04), (0.05, 0.8, 0.04))
    # A tiled roof of two slopes meeting over the middle, overhanging the walls.
    for side in (-1, 1):
        board = box(tamon, 'RoofTile', (0, 0, 0), (length + 0.04, 0.14, depth / 2 + 0.9))
        board.location = kit.at(0, 8.1, middle + side * (depth / 4 + 0.3))
        board.rotation_euler = (side * 0.5, 0, 0)
    box(tamon, 'RoofEdge', (0, 8.55, middle), (length + 0.06, 0.18, 0.24))
    return tamon


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = argv[0] if argv else 'stage-kit.glb'
    preview = argv[1] if len(argv) > 1 else None

    bpy.ops.wm.read_factory_settings(use_empty=True)
    stage_materials()
    pieces = [farmhouse(), scarecrow(), bamboo_clump(), shrine(), jizo(), pine(), castle_wall(), castle_gate(), castle_keep(), castle_turret(), castle_outer_gate(), castle_tamon()]
    for piece in pieces:
        kit.join_children(piece)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True,
                              export_materials='EXPORT', export_extras=False)
    if preview is not None:
        render_preview(pieces, preview)


def render_preview(pieces, path):
    for piece, x in zip(pieces, (0, 10, 13, 15, 17, 20, -12, -30, -60)):
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
    camera.location = kit.at(-28, 14, 60)
    camera.rotation_euler = (kit.at(-28, 10, 0) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene = bpy.context.scene
    scene.camera = camera
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 600
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    main()
