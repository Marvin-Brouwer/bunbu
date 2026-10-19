/**
 * Castle town ([2 Quiz + stage](../../../../../docs/design/screens.md#2-quiz--stage)) from dusk to night:
 * streets of two-storey town houses with lattice fronts, tiled roofs, noren curtains and paper
 * lanterns, and between them gardens with maples, bamboo, stone lanterns, a pond under a red bridge
 * and a torii at the gate. The path turns corners and winds through the gardens ({@link Path}).
 *
 * The houses and props are made here from simple shapes; the trees, bamboo and torii are Quaternius
 * models (CC0), added once they have loaded. Everything is laid out when the run starts as a few
 * blocks of a round of the path each, stitched together ahead of the samurai for as long as the run
 * goes ([blocks](./blocks.mts)), in stretches of path that are each their own `InstancedMesh`, so
 * only what is in view is drawn.
 */

import {
	AdditiveBlending,
	BoxGeometry,
	BufferGeometry,
	CircleGeometry,
	Color,
	CylinderGeometry,
	DirectionalLight,
	DodecahedronGeometry,
	Float32BufferAttribute,
	Fog,
	Group,
	HemisphereLight,
	Matrix4,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Points,
	PointsMaterial,
	Vector3,
	type Material,
	type Object3D,
	type Scene,
} from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { layBlocks } from './blocks.mts'
import { Batch, chunkOf, gableGeometry, glowTexture, partOf, placed, scatter, slatsTexture, within, type Cursor } from './kit.mts'
import { beside, type Path, type PathPoint } from './path.mts'
import { addAll, castsShadows, followSun, clearanceOf, facingPath, fogFar, isFree, passTime, sky, skyRadius, stamp, strip, type Daylight, type Owned, type Planting, type StageView, type Taken } from './landscape.mts'
import type { District } from './backdrop.mts'
import type { CoverSet } from './cover.mts'

export { fogFar, skyRadius, type StageView }

/** Half the width of the street, and of the garden path, in metres. */
export const streetHalfWidth = 4.6
export const gardenHalfWidth = 1.8


const palette = {
	street: 0x7a6650,
	gardenPath: 0xa79e8e,
	ground: 0x5e5044,
	grass: 0x4f6b3a,
	timber: [0x5a4030, 0x6a4a32, 0x4d3a2c, 0x7a5236],
	plaster: [0xe8e0cc, 0xd9cfb6, 0xefe7d6],
	roof: 0x3a3e46,
	/** Roof tiles vary from house to house: grey, brown, blue-grey. */
	roofs: [0x3a3e46, 0x4d3c33, 0x34404f, 0x2e3036],
	signs: [0xe9e2d0, 0x1f2a44, 0x8e2a22, 0xd8b25a],
	flags: [0x8e2a22, 0x23345e, 0xe9e2d0, 0x3d6b3a, 0xc9a24a],
	eave: 0x5a5f68,
	noren: [0x23345e, 0x8e2a22, 0xe9e2d0, 0x2f4a3a],
	lantern: 0xff5a2a,
	paper: 0xffd9a0,
	stone: 0x8d877b,
	water: 0x2d4a5a,
	bridge: 0xa8261c,
}

/**
 * The town's four districts ([districts](./districts.mts)), behind and beside its streets and
 * gardens ([backdrop](./backdrop.mts)): the gate gardens, the shop street, the pond with its red
 * bridges, and the castle approach.
 */
export const townDistricts: readonly District[] = [
	{
		name: 'Gate gardens',
		cover: [{ kind: 'market-stand' }, { kind: 'crates' }, { kind: 'villager', ambush: 0.3, decoy: 2 }],
		rows: [
			{ shape: 'torii', across: true, span: gardenHalfWidth * 2 + 0.6, zone: 'garden', from: 0, to: 0, perTile: 0.8, colours: [[0xa8261c], [0xa8261c], [0x2a2a2e, 0x8e2a22]] },
			{ shape: 'torii', across: true, span: streetHalfWidth * 2 + 0.4, zone: 'street', from: 0, to: 0, perTile: 0.25, colours: [[0xa8261c], [0xa8261c], [0x2a2a2e, 0x8e2a22]] },
			{ shape: 'lantern', from: gardenHalfWidth + 0.8, to: gardenHalfWidth + 1.4, zone: 'garden', perTile: 0.5, colours: [[0x8d877b, 0x9a958a], [0x8d877b, 0x7a756c]] },
			{ shape: 'broadleaf', from: 24, to: 70, perTile: 3, colours: [[0x4a3a2c], [0xb8402a, 0xd0602e, 0x9e3a24, 0xc8862e]] },
			{ shape: 'pine', from: 60, to: 135, perTile: 2, colours: [[0x4a3a2c], [0x2f4a2e, 0x35502e]] },
		],
	},
	{
		name: 'Shop street',
		cover: [{ kind: 'market-stand' }, { kind: 'cart' }, { kind: 'barrels' }, { kind: 'villager', ambush: 0.3, decoy: 1.5 }],
		rows: [
			{ shape: 'house', from: 24, to: 36, perTile: 2, colours: [palette.plaster, palette.roofs] },
			{ shape: 'hut', from: 38, to: 62, perTile: 1.6, colours: [palette.timber, [0x7a6440, 0x6a5a3c]] },
			{ shape: 'pine', from: 60, to: 135, perTile: 2.4, colours: [[0x4a3a2c], [0x2f4a2e, 0x35502e]] },
			{ shape: 'broadleaf', from: 55, to: 135, perTile: 1.6, colours: [[0x4a3a2c], [0x4a6634, 0x8e3a24, 0x6a7a34]] },
		],
	},
	{
		name: 'Pond and red bridge',
		cover: [{ kind: 'sake-barrels' }, { kind: 'rock' }, { kind: 'villager', ambush: 0.3, decoy: 1.5 }],
		rows: [
			{ shape: 'lantern', from: gardenHalfWidth + 0.8, to: gardenHalfWidth + 1.4, zone: 'garden', perTile: 0.8, colours: [[0x8d877b, 0x9a958a], [0x8d877b, 0x7a756c]] },
			{ shape: 'bridge', from: 22, to: 40, perTile: 0.9, colours: [[0x2d4a5a], [0xa8261c], [0xa8261c]] },
			{ shape: 'pond', from: 28, to: 70, perTile: 0.7, colours: [[0x2d4a5a, 0x34566a]] },
			{ shape: 'broadleaf', from: 24, to: 80, perTile: 2, colours: [[0x4a3a2c], [0x5e8a3a, 0x6f9440, 0x4f7a34]] },
			{ shape: 'house', from: 55, to: 85, perTile: 0.6, colours: [palette.plaster, palette.roofs] },
			{ shape: 'pine', from: 70, to: 135, perTile: 1.5, colours: [[0x4a3a2c], [0x2f4a2e, 0x35502e]] },
		],
	},
	{
		name: 'Castle approach',
		cover: [{ kind: 'guard', ambush: 0.3, decoy: 1.5 }, { kind: 'sake-barrels' }, { kind: 'crates' }],
		rows: [
			{ shape: 'wall', from: 22, to: 30, perTile: 1.6, colours: [[0x8d877b, 0x7a756c], [0xeae4d4, 0xddd5c2], [0x2e3036, 0x34404f]] },
			{ shape: 'pagoda', from: 45, to: 90, perTile: 0.3, colours: [[0xeae4d4], [0x2e3036, 0x34404f]] },
			{ shape: 'pine', from: 40, to: 135, perTile: 3, colours: [[0x4a3a2c], [0x2f4a2e, 0x35502e]] },
		],
	},
]

/** What ninjas hide behind in town, on the street by the shops ([cover](./cover.mts)). */
export const townCover: CoverSet = {
	kinds: ['crates', 'barrels', 'cart'],
	aside: streetHalfWidth - 1.3,
	colours: { crates: [0xb89a6a, 0x8a6a46, 0x7a5a3a], barrels: [0x6a4a30, 0x5a4030, 0x7a5236], cart: [0xd8c8a0, 0xc2ad84], 'market-stand': [0x2f4a7a, 0xb3391f, 0x4f6b2f], villager: [0x2f4a7a, 0x5b5348, 0x4f6b2f, 0x8e2a22], 'sake-barrels': [0xe8dcc0, 0xd8c8a0], guard: [0x2f3a44, 0x6e1f0f] },
}

/** From dusk to night: the sun goes down and the shops and lanterns light up. One light per quarter of the stage ({@link passTime}). */
const daylight: Daylight = [
	{
		skyTop: 0x1d2147,
		skyHorizon: 0xe58a5c,
		fog: 0x8a6070,
		ambient: { sky: 0xb0b4e0, ground: 0x5a4236, intensity: 2.4 },
		sun: { colour: 0xffb27a, intensity: 2.4 },
		lamps: 0,
	},
	{
		skyTop: 0x181a3e,
		skyHorizon: 0xc86a58,
		fog: 0x745468,
		ambient: { sky: 0xa0a6dc, ground: 0x4c3a32, intensity: 2.2 },
		sun: { colour: 0xff9a6a, intensity: 1.9 },
		lamps: 0.35,
	},
	{
		skyTop: 0x121638,
		skyHorizon: 0x7a5070,
		fog: 0x524862,
		ambient: { sky: 0x8c96d4, ground: 0x3c3230, intensity: 2.0 },
		sun: { colour: 0xc8a0b8, intensity: 1.3 },
		lamps: 0.7,
	},
	{
		skyTop: 0x0b0e28,
		skyHorizon: 0x34305a,
		fog: 0x34324c,
		ambient: { sky: 0x7a86cc, ground: 0x2c2630, intensity: 1.8 },
		sun: { colour: 0xa8b8e8, intensity: 0.9 },
		lamps: 1,
	},
]


/** The models the town uses; it is built without them first and gets them when they are in. */
export type TownModels = Partial<{
	readonly maple: GLTF
	readonly torii: GLTF
	readonly bamboo: GLTF
	/** Our own parts for the houses (`assets/blender/town_kit.py`): roofs, pent roofs, lanterns, barrels. */
	readonly kit: GLTF
}>


type Town = {
	readonly walls: Batch
	readonly lattice: Batch
	readonly plaster: Batch
	readonly windows: Batch
	readonly roofs: Batch
	readonly eaves: Batch
	readonly ridges: Batch
	readonly noren: Batch
	readonly lanterns: Batch
	readonly stone: Batch
	readonly lanternLight: Batch
	readonly barrels: Batch
	readonly water: Batch
	readonly bridge: Batch
	readonly rocks: Batch
	/** Painted boards and cloth: shop signs, banners, flags, bench covers. */
	readonly cloth: Batch
	/** Red-lacquered wood: balcony railings. */
	readonly railings: Batch
	/** Bamboo blinds, poles and carts. */
	readonly bamboo: Batch
	readonly glows: number[]
}

/** The point a matrix places its origin at, for the glow of a lantern. */
const origin = (matrix: Matrix4) => new Vector3().setFromMatrixPosition(matrix).toArray()

/** A roof colour for the building at `index`. */
const roofOf = (index: number) => palette.roofs[Math.floor(scatter(index + 31) * palette.roofs.length)] ?? palette.roof

/** Which kind of building stands at `index`: mostly town houses, with storehouses, shops and teahouses. */
function kindOf(index: number): 'house' | 'storehouse' | 'shop' | 'teahouse' {
	const roll = scatter(index + 40)
	if (roll < 0.45) return 'house'
	if (roll < 0.62) return 'storehouse'
	if (roll < 0.84) return 'shop'
	return 'teahouse'
}

/** Builds the building at `index`, `width` wide, its front on the street. */
function building(town: Town, frame: Matrix4, width: number, index: number): void {
	const kind = kindOf(index)
	if (kind === 'storehouse') storehouse(town, frame, width, index)
	else if (kind === 'shop') shop(town, frame, width, index)
	else if (kind === 'teahouse') teahouse(town, frame, width, index)
	else house(town, frame, width, index)
}

/** A gable roof with its ridge, `top` metres up over a body `depth` deep set `back` from the front. */
function roof(town: Town, frame: Matrix4, width: number, depth: number, top: number, back: number, colour: number): void {
	town.roofs.add(within(frame, placed(0, top, back, 0, width + 0.5, 1.5, depth + 1.2)), colour)
	town.ridges.add(within(frame, placed(0, top + 1.5, back, 0, width + 0.5, 0.18, 0.3)), 0x2a2d33)
}

/** A storehouse (kura): thick white plaster on a black base, small barred windows, a heavy roof. */
function storehouse(town: Town, frame: Matrix4, width: number, index: number): void {
	const depth = 6
	const front = depth / 2 - 0.5
	town.plaster.add(within(frame, placed(0, 2.75, -0.5, 0, width, 5.5, depth)), palette.plaster[0])
	// The tiled base (namako) and the plaster band under the eaves.
	town.walls.add(within(frame, placed(0, 0.65, -0.5, 0, width + 0.04, 1.3, depth + 0.04)), 0x2a2a2e)
	town.ridges.add(within(frame, placed(0, 5.35, -0.5, 0, width + 0.1, 0.3, depth + 0.1)), 0x2a2d33)
	for (const y of [2.1, 4.2]) town.windows.add(within(frame, placed((scatter(index + 41) - 0.5) * (width - 2), y, front + 0.04, 0, 0.9, 0.7, 0.08)), 0x2a2420)
	town.walls.add(within(frame, placed(width / 4, 1.1, front + 0.03, 0, 1.2, 2.2, 0.06)), 0x3a2a1f)
	roof(town, frame, width, depth, 5.5, -0.5, roofOf(index))
}

/** A shop: an awning over goods in front, and a tall painted sign by the door. */
function shop(town: Town, frame: Matrix4, width: number, index: number): void {
	house(town, frame, width, index)
	const front = 3.5
	// From the wall out over the goods.
	const awning = within(frame, placed(0, 2.55, front + 0.8))
	awning.multiply(new Matrix4().makeRotationX(0.22)).multiply(placed(0, 0, 0, 0, width - 0.6, 0.06, 1.6))
	town.cloth.add(awning, palette.flags[Math.floor(scatter(index + 51) * palette.flags.length)] ?? palette.flags[0])
	// The standing sign (kanban): a framed board on the street side of the door.
	const side = scatter(index + 52) > 0.5 ? 1 : -1
	const sign = within(frame, placed(side * (width / 2 - 0.45), 1.25, front + 1.6))
	town.walls.add(within(sign, placed(0, 0, 0, 0, 0.7, 2.5, 0.16)), 0x2a1f18)
	town.cloth.add(within(sign, placed(0, 0.1, 0.09, 0, 0.55, 2.1, 0.02)), palette.signs[Math.floor(scatter(index + 53) * palette.signs.length)] ?? palette.signs[0])
	// Goods out front: crates and sacks.
	for (let crate = 0; crate < 3; crate++) {
		const along = (crate - 1) * 0.9 - side * 0.6
		const size = 0.45 + scatter(index + 54 + crate) * 0.25
		// Out past where a house keeps its barrel.
		town.barrels.add(within(frame, placed(along, size / 2, front + 1.6 + scatter(index + 57 + crate) * 0.3, scatter(index + 60 + crate), size, size, size)), crate === 1 ? 0xb89a6a : 0x7a5a3a)
	}
}

/** A teahouse: two storeys, a balcony with a red railing, bamboo blinds, a row of lanterns, a bench. */
function teahouse(town: Town, frame: Matrix4, width: number, index: number): void {
	const depth = 7
	const front = depth / 2
	const timber = palette.timber[Math.floor(scatter(index + 12) * palette.timber.length)] ?? palette.timber[0]
	town.walls.add(within(frame, placed(0, 1.5, 0, 0, width, 3, depth)), timber)
	town.lattice.add(within(frame, placed(0, 1.35, front + 0.04, 0, width - 0.5, 2.2, 0.08)), timber)
	town.walls.add(within(frame, placed(0, 4.3, -0.3, 0, width - 0.2, 2.6, depth - 0.6)), timber)
	// The balcony: a floor out over the street, a red railing, blinds rolled half down behind it.
	town.walls.add(within(frame, placed(0, 3.1, front + 0.5, 0, width - 0.2, 0.15, 1.2)), 0x3a2a1f)
	town.railings.add(within(frame, placed(0, 3.75, front + 1.05, 0, width - 0.2, 0.08, 0.08)), palette.bridge)
	// Posts spread evenly from end to end of the balcony.
	const posts = Math.max(1, Math.round((width - 0.4) / 1.2))
	for (let post = 0; post <= posts; post++) {
		town.railings.add(within(frame, placed(-width / 2 + 0.2 + (post * (width - 0.4)) / posts, 3.45, front + 1.05, 0, 0.08, 0.6, 0.08)), palette.bridge)
	}
	town.bamboo.add(within(frame, placed(0, 4.6, front - 0.25, 0, width - 0.6, 1.3, 0.05)), 0xc8a86a)
	// Lanterns all along the eaves.
	for (let lantern = 0; lantern < Math.floor(width / 1.4); lantern++) {
		// Hung under the eaves, which end at the front wall.
		const at = within(frame, placed(-width / 2 + 0.8 + lantern * 1.4, 5.25, front - 0.15))
		town.lanterns.add(within(at, placed(0, 0, 0, 0, 0.36, 0.48, 0.36)), lantern % 2 === 0 ? palette.lantern : palette.paper)
		town.glows.push(...origin(at))
	}
	town.noren.add(within(frame, placed(0, 2.15, front + 0.16, 0, Math.min(2.6, width - 1), 0.75, 0.04)), palette.noren[1] ?? palette.lantern)
	// A bench out front under a red cloth, for tea.
	town.cloth.add(within(frame, placed(width / 4, 0.5, front + 1.3, 0, 1.6, 0.12, 0.7)), 0xb3281f)
	town.bamboo.add(within(frame, placed(width / 4, 0.22, front + 1.3, 0, 1.5, 0.44, 0.6)), 0x5a4030)
	roof(town, frame, width, depth - 0.6, 5.6, -0.3, roofOf(index))
}

/** Street furniture between the houses: a banner on a pole (nobori), or a handcart. */
function streetThing(town: Town, point: PathPoint, side: number, index: number): void {
	if (scatter(index + 70) > 0.4) {
		const at = beside(point, side * (streetHalfWidth - 0.4), 0)
		const frame = placed(at.x, 0, at.z, facingPath(point, side))
		town.bamboo.add(within(frame, placed(0, 2.2, 0, 0, 0.08, 4.4, 0.08)), 0x6a5a3a)
		town.cloth.add(within(frame, placed(0.32, 2.6, 0, 0, 0.55, 2.6, 0.02)), palette.flags[Math.floor(scatter(index + 71) * palette.flags.length)] ?? palette.flags[0])
	} else {
		// Parked along the street at its edge, out of the way, the handle along the street too.
		const at = beside(point, side * (streetHalfWidth + 0.1), 0)
		const frame = placed(at.x, 0, at.z, facingPath(point, side))
		const cart = within(frame, placed(0, 0, 0, (scatter(index + 72) - 0.5) * 0.3))
		town.bamboo.add(within(cart, placed(0, 0.75, 0, 0, 1.8, 0.12, 1)), 0x7a5a3a)
		town.barrels.add(within(cart, placed(0, 1.05, 0, 0, 0.7, 0.6, 0.7)), 0xb89a6a)
		for (const wheel of [-1, 1]) {
			const turned = within(cart, placed(0, 0.45, wheel * 0.55))
			turned.multiply(new Matrix4().makeRotationX(Math.PI / 2)).multiply(placed(0, 0, 0, 0, 0.9, 0.08, 0.9))
			town.barrels.add(turned, 0x4a3324)
		}
		town.bamboo.add(within(cart, placed(-1.4, 0.75, 0, 0, 1.2, 0.06, 0.06)), 0x7a5a3a)
	}
}

/** A town house (machiya) `width` wide, its front on the street. */
function house(town: Town, frame: Matrix4, width: number, index: number): void {
	const depth = 7
	const two = scatter(index + 11) > 0.3
	const timber = palette.timber[Math.floor(scatter(index + 12) * palette.timber.length)] ?? palette.timber[0]
	const plaster = palette.plaster[Math.floor(scatter(index + 13) * palette.plaster.length)] ?? palette.plaster[0]
	const front = depth / 2

	town.walls.add(within(frame, placed(0, 1.5, 0, 0, width, 3, depth)), timber)
	town.lattice.add(within(frame, placed(0, 1.35, front + 0.04, 0, width - 0.5, 2.2, 0.08)), timber)
	// The pent roof over the ground floor, sloping down toward the street.
	const eave = within(frame, placed(0, 3.15, front + 0.4))
	eave.multiply(new Matrix4().makeRotationX(0.5)).multiply(placed(0, 0, 0, 0, width - 0.1, 0.1, 1))
	town.eaves.add(eave, palette.eave)

	const door = (scatter(index + 14) - 0.5) * (width - 2)
	town.noren.add(within(frame, placed(door, 2.15, front + 0.16, 0, 1.3, 0.75, 0.04)), palette.noren[Math.floor(scatter(index + 15) * palette.noren.length)] ?? palette.noren[0])

	let top = 3
	let roofDepth = depth + 1
	if (two) {
		const upperDepth = depth - 1.6
		town.plaster.add(within(frame, placed(0, 3 + 1.1, -0.8, 0, width - 0.2, 2.2, upperDepth)), plaster)
		town.windows.add(within(frame, placed(0, 4.1, upperDepth / 2 - 0.8 + 0.04, 0, Math.min(2.4, width - 1.2), 0.6, 0.06)), timber)
		top = 5.2
		roofDepth = upperDepth + 1.2
	}
	town.roofs.add(within(frame, placed(0, top, two ? -0.8 : 0, 0, width + 0.5, 1.5, roofDepth)), roofOf(index))
	town.ridges.add(within(frame, placed(0, top + 1.5, two ? -0.8 : 0, 0, width + 0.5, 0.18, 0.3)), 0x2a2d33)

	if (scatter(index + 16) > 0.45) {
		const side = scatter(index + 17) > 0.5 ? 1 : -1
		const at = within(frame, placed(side * (width / 2 - 0.7), 2.45, front + 1))
		town.lanterns.add(within(at, placed(0, 0, 0, 0, 0.42, 0.55, 0.42)), palette.lantern)
		town.glows.push(...origin(at))
	}
	if (scatter(index + 18) > 0.75) {
		const along = (scatter(index + 19) - 0.5) * width
		town.barrels.add(within(frame, placed(along, 0.45, front + 0.9, 0, 0.9)), 0x6a4a30)
	}
}

/** A stone lantern (tōrō): base, post, the lit firebox, roof and knob. */
function stoneLantern(town: Town, frame: Matrix4): void {
	town.stone.add(within(frame, placed(0, 0.15, 0, 0, 0.7, 0.3, 0.7)), palette.stone)
	town.stone.add(within(frame, placed(0, 0.75, 0, 0, 0.28, 0.9, 0.28)), palette.stone)
	town.lanternLight.add(within(frame, placed(0, 1.4, 0, 0, 0.45, 0.4, 0.45)), palette.paper)
	town.stone.add(within(frame, placed(0, 1.72, 0, Math.PI / 4, 0.95, 0.22, 0.95)), palette.stone)
	town.stone.add(within(frame, placed(0, 1.95, 0, 0, 0.2, 0.25, 0.2)), palette.stone)
	town.glows.push(...origin(within(frame, placed(0, 1.4, 0))))
}

/** A five-storey pagoda on the skyline. */
function pagoda(town: Town, frame: Matrix4): void {
	for (let storey = 0; storey < 5; storey++) {
		const size = 7 - storey * 0.9
		const y = storey * 3.2
		town.walls.add(within(frame, placed(0, y + 1.3, 0, 0, size * 0.62, 2.6, size * 0.62)), palette.bridge)
		town.roofs.add(within(frame, placed(0, y + 2.4, 0, 0, size + 1.6, 1.1, size + 1.6)), palette.roof)
		town.roofs.add(within(frame, placed(0, y + 2.4, 0, Math.PI / 2, size + 1.6, 1.1, size + 1.6)), palette.roof)
	}
	town.ridges.add(within(frame, placed(0, 18, 0, 0, 0.25, 4, 0.25)), 0xb8913a)
}

/** A castle keep (tenshu) far off: a stone base and white storeys under dark roofs. */
function castle(town: Town, frame: Matrix4): void {
	town.stone.add(within(frame, placed(0, 3, 0, 0, 26, 6, 20)), 0x6e685e)
	for (let storey = 0; storey < 4; storey++) {
		const width = 18 - storey * 3.5
		const depth = 14 - storey * 2.8
		const y = 6 + storey * 4.2
		town.plaster.add(within(frame, placed(0, y + 1.8, 0, 0, width, 3.6, depth)), 0xeae4d4)
		town.roofs.add(within(frame, placed(0, y + 3.4, 0, 0, width + 3, 2.2, depth + 3)), palette.roof)
	}
}


/** What a block of the town places once the models are in: maples, bamboo, the torii; and its houses, to reshape with the kit. */
type Pending = {
	readonly town: Town
	readonly maples: Planting[]
	readonly bamboo: Planting[]
	readonly torii: Planting[]
}

/** Stretches of their own for landmarks far off the path, so each is culled on its own. */
const landmarkChunks = 100_000

/** Metres a garden's trees reach along the path, which the last of them keep clear of the block's end. */
const treeReach = 3

/** The stretches of path that run through a garden, from where they start to where they end. */
function gardensOf(path: Path, from: number, to: number): { start: number; end: number }[] {
	const gardens: { start: number; end: number }[] = []
	// By whole metres from `from`, which needn't be a whole number, so a garden is never split by rounding.
	let previous = Number.NaN
	for (let metre = 0; from + metre < to; metre++) {
		const distance = from + metre
		if (path.at(distance).zone !== 'garden') continue
		const last = gardens.at(-1)
		if (last !== undefined && previous === metre - 1) last.end = distance
		else gardens.push({ start: distance, end: distance })
		previous = metre
	}
	return gardens
}

/** One kind of piece of the town: its shape, what it is made of, and its shadows. */
type Shape = { readonly geometry: BufferGeometry; readonly material: Material; readonly shadows?: { cast?: boolean; receive?: boolean } }

/** The shapes and materials every block of the town is built from, made once for all of them. */
type Shapes = Readonly<Record<Exclude<keyof Town, 'glows'>, Shape>>

function shapesOf(owned: Owned): { shapes: Shapes; shopLight: MeshStandardMaterial } {
	const geometry = <T extends BufferGeometry>(made: T) => {
		owned.geometries.push(made)
		return made
	}
	const material = <T extends Material>(made: T) => {
		owned.materials.push(made)
		return made
	}
	const slats = slatsTexture()
	owned.textures.push(slats)
	slats.repeat.set(3, 1)

	const box = geometry(new BoxGeometry(1, 1, 1))
	const lit = (roughness = 0.85) => material(new MeshStandardMaterial({ roughness, flatShading: true }))
	// Shops open at dusk: warm light from inside shows through the lattice, brighter as night falls.
	const shopLight = material(new MeshStandardMaterial({ map: slats, roughness: 0.9, emissive: 0xffa050, emissiveMap: slats, emissiveIntensity: 0.35 }))
	const shapes: Shapes = {
		walls: { geometry: box, material: lit(), shadows: { cast: true, receive: true } },
		lattice: { geometry: box, material: shopLight },
		plaster: { geometry: box, material: lit(0.95), shadows: { cast: true, receive: true } },
		windows: { geometry: box, material: material(new MeshStandardMaterial({ map: slats, roughness: 0.9 })) },
		roofs: { geometry: geometry(gableGeometry()), material: lit(0.7), shadows: { cast: true } },
		eaves: { geometry: box, material: lit(0.7) },
		ridges: { geometry: box, material: lit(0.7) },
		noren: { geometry: box, material: lit(1) },
		lanterns: { geometry: geometry(new CylinderGeometry(0.5, 0.5, 1, 10)), material: material(new MeshBasicMaterial()) },
		stone: { geometry: box, material: lit(1), shadows: { cast: true } },
		lanternLight: { geometry: box, material: material(new MeshBasicMaterial()) },
		barrels: { geometry: geometry(new CylinderGeometry(0.45, 0.4, 1, 10)), material: lit(0.9), shadows: { cast: true } },
		water: { geometry: geometry(new CircleGeometry(1, 28).rotateX(-Math.PI / 2)), material: material(new MeshStandardMaterial({ roughness: 0.15, metalness: 0.4 })) },
		bridge: { geometry: box, material: lit(0.6), shadows: { cast: true } },
		rocks: { geometry: geometry(new DodecahedronGeometry(1, 0)), material: lit(1), shadows: { cast: true } },
		cloth: { geometry: box, material: lit(0.9), shadows: { cast: true } },
		railings: { geometry: box, material: lit(0.5) },
		bamboo: { geometry: box, material: lit(0.8), shadows: { cast: true } },
	}
	return { shapes, shopLight }
}

/** Lays out the town from `from` to `to` along `path`, picking with `base`: one block ([blocks](./blocks.mts)). */
function lay(path: Path, from: number, to: number, base: number, shapes: Shapes): { town: Town; pending: Pending; group: Group } {
	const cursor: Cursor = { chunk: 0 }
	const batch = (name: keyof Shapes) => new Batch(shapes[name].geometry, shapes[name].material, cursor, shapes[name].shadows)
	const town: Town = {
		walls: batch('walls'),
		lattice: batch('lattice'),
		plaster: batch('plaster'),
		windows: batch('windows'),
		roofs: batch('roofs'),
		eaves: batch('eaves'),
		ridges: batch('ridges'),
		noren: batch('noren'),
		lanterns: batch('lanterns'),
		stone: batch('stone'),
		lanternLight: batch('lanternLight'),
		barrels: batch('barrels'),
		water: batch('water'),
		bridge: batch('bridge'),
		rocks: batch('rocks'),
		cloth: batch('cloth'),
		railings: batch('railings'),
		bamboo: batch('bamboo'),
		glows: [],
	}
	const pending: Pending = { town, maples: [], bamboo: [], torii: [] }
	// The landmarks look far along the path, into the next round too.
	const clear = clearanceOf(path, from - 400, to + 400)
	const taken: Taken = []
	const plant = (into: Planting[], matrix: Matrix4) => { into.push({ matrix, chunk: cursor.chunk }) }

	// Houses along both sides of every street, each in its own slot of the street, as long as it
	// stays off the path at the corners, and inside the block.
	let index = base
	for (const side of [-1, 1]) {
		let distance = from
		while (distance < to) {
			const width = 4.5 + scatter(index * 3 + side) * 3
			index++
			const middle = distance + width / 2
			const street = distance + width <= to && path.at(distance).zone === 'street' && path.at(distance + width).zone === 'street'
			if (!street || scatter(index + 500) < 0.08) {
				// A garden, or an alley between houses, with a banner or a cart at the street's edge.
				if (street) {
					cursor.chunk = chunkOf(distance + 1.25)
					streetThing(town, path.at(distance + 1.25), side, index)
				}
				distance += street ? 2.5 : 4
				continue
			}
			cursor.chunk = chunkOf(middle)
			const point = path.at(middle)
			// The front a little back from the street's edge; only the eaves reach out over it.
			const centre = beside(point, side * (streetHalfWidth + 4.1), 0)
			const frame = placed(centre.x, 0, centre.z, facingPath(point, side))
			const corners = [[-width / 2, -3.5], [width / 2, -3.5], [-width / 2, 3.5], [width / 2, 3.5], [0, 0]] as const
			const free = corners.every(([x, z]) => {
				const corner = new Vector3(x, 0, z).applyMatrix4(frame)
				return clear(corner.x, corner.z, middle, streetHalfWidth + 0.4)
			})
			if (free) {
				building(town, frame, width - 0.15, index)
				taken.push({ x: centre.x, z: centre.z, radius: Math.hypot(width, 7) / 2 })
			}
			distance += width
		}
	}

	// The gardens, first what is fixed in them: the torii at the gate, landmarks on the skyline, and
	// halfway in a stream under a red bridge with a pond either side.
	const gardens = gardensOf(path, from, to)
	for (const [which, garden] of gardens.entries()) {
		const gate = path.at(garden.start + 4)
		cursor.chunk = chunkOf(garden.start + 4)
		plant(pending.torii, placed(gate.x, 0, gate.z, gate.heading))

		const landmark = base + which
		const skyline = beside(gate, (scatter(landmark) > 0.5 ? 1 : -1) * 38, 40)
		if (clear(skyline.x, skyline.z, garden.start + 44, 12, 400) && isFree(taken, skyline.x, skyline.z, 6)) {
			cursor.chunk = landmarkChunks + which * 2
			pagoda(town, placed(skyline.x, 0, skyline.z, scatter(landmark + 1) * Math.PI))
			taken.push({ x: skyline.x, z: skyline.z, radius: 6 })
		}
		const keep = beside(gate, (scatter(landmark + 2) > 0.5 ? 1 : -1) * 70, 160)
		if (clear(keep.x, keep.z, garden.start + 164, 30, 400) && isFree(taken, keep.x, keep.z, 18)) {
			cursor.chunk = landmarkChunks + which * 2 + 1
			castle(town, placed(keep.x, 0, keep.z, gate.heading))
			taken.push({ x: keep.x, z: keep.z, radius: 18 })
		}

		const middle = Math.min(garden.start + 37, garden.end - 10)
		if (middle <= garden.start + 10) continue
		const crossing = path.at(middle)
		cursor.chunk = chunkOf(middle)
		for (const side of [-1, 1]) {
			const pond = beside(crossing, side * 9, 0)
			town.water.add(placed(pond.x, 0.03, pond.z, 0, 6.5), palette.water)
			taken.push({ x: pond.x, z: pond.z, radius: 7.2 })
			for (let stone = 0; stone < 8; stone++) {
				const angle = (stone / 8) * Math.PI * 2
				town.rocks.add(placed(pond.x + Math.cos(angle) * 6.7, 0.25, pond.z + Math.sin(angle) * 6.7, angle, 0.6, 0.45, 0.6), 0x6f6a60)
			}
		}
		const deck = placed(crossing.x, 0, crossing.z, crossing.heading)
		town.water.add(within(deck, placed(0, 0.025, 0, 0, 3.4, 1, 3.4)), palette.water)
		town.bridge.add(within(deck, placed(0, 0.12, 0, 0, gardenHalfWidth * 2 + 0.4, 0.16, 6.5)), 0x6b4a32)
		for (const side of [-1, 1]) {
			town.bridge.add(within(deck, placed(side * (gardenHalfWidth + 0.15), 0.95, 0, 0, 0.14, 0.12, 6.5)), palette.bridge)
			for (const post of [-3, -1, 1, 3]) town.bridge.add(within(deck, placed(side * (gardenHalfWidth + 0.15), 0.55, post, 0, 0.16, 0.85, 0.16)), palette.bridge)
		}
	}

	// Then what grows around them: maples, bamboo, rocks, and stone lanterns along the path, all
	// clear of the path, the houses and the ponds, and of the block's ends.
	for (const garden of gardens) {
		const last = Math.min(garden.end, to - treeReach)
		for (let distance = Math.ceil(Math.max(garden.start, from + treeReach) / 3) * 3; distance <= last; distance += 3) {
			const point = path.at(distance)
			cursor.chunk = chunkOf(distance)
			const step = Math.round(distance)
			for (const side of [-1, 1]) {
				const seed = step * 7 + side
				if (step % 9 === 0 && scatter(seed) > 0.25) {
					const at = beside(point, side * (gardenHalfWidth + 3 + scatter(seed + 1) * 6), 0)
					if (clear(at.x, at.z, distance, gardenHalfWidth + 2.5) && isFree(taken, at.x, at.z, 2.5)) {
						plant(pending.maples, placed(at.x, 0, at.z, scatter(seed + 2) * 6.28, 0.9 + scatter(seed + 3) * 0.4))
						taken.push({ x: at.x, z: at.z, radius: 1.5 })
					}
				}
				if (step % 3 === 0 && scatter(seed + 4) > 0.35) {
					const at = beside(point, side * (gardenHalfWidth + 9 + scatter(seed + 5) * 4), 0)
					if (clear(at.x, at.z, distance, gardenHalfWidth + 5) && isFree(taken, at.x, at.z, 1.2)) {
						plant(pending.bamboo, placed(at.x, 0, at.z, scatter(seed + 6) * 6.28, 0.9 + scatter(seed + 7) * 0.5))
					}
				}
				if (step % 15 === 0 && (step / 15 + (side > 0 ? 1 : 0)) % 2 === 0) {
					const at = beside(point, side * (gardenHalfWidth + 0.9), 0)
					if (isFree(taken, at.x, at.z, 0.5)) stoneLantern(town, placed(at.x, 0, at.z, point.heading))
				}
				if (scatter(seed + 8) > 0.8) {
					const at = beside(point, side * (gardenHalfWidth + 1.5 + scatter(seed + 9) * 8), 0)
					const size = 0.3 + scatter(seed + 10) * 0.6
					if (clear(at.x, at.z, distance, gardenHalfWidth + 0.8) && isFree(taken, at.x, at.z, size)) {
						town.rocks.add(placed(at.x, size * 0.3, at.z, scatter(seed + 11) * 6, size, size * 0.7, size), 0x7d786d)
					}
				}
			}
		}
	}

	const group = new Group()
	for (const each of Object.values(town)) {
		if (each instanceof Batch && each.count > 0) addAll(group, each.build())
	}
	return { town, pending, group }
}

export function createCastleTown(scene: Scene, path: Path, models: Promise<TownModels>): StageView {
	const [first] = daylight
	const fog = new Fog(first.fog, 30, fogFar)
	scene.fog = fog

	const owned: Owned = { geometries: [], materials: [], textures: [] }
	const backdrop = sky(owned, first.skyTop, first.skyHorizon)
	scene.add(backdrop)

	const ambient = new HemisphereLight(first.ambient.sky, first.ambient.ground, first.ambient.intensity)
	scene.add(ambient)
	const sun = new DirectionalLight(first.sun.colour, first.sun.intensity)
	castsShadows(sun)
	scene.add(sun, sun.target)
	const sunFrom = { x: -22, y: 30, z: 14 }

	const groundGeometry = new CircleGeometry(skyRadius, 32).rotateX(-Math.PI / 2)
	const groundMaterial = new MeshStandardMaterial({ color: palette.ground, roughness: 1 })
	owned.geometries.push(groundGeometry)
	owned.materials.push(groundMaterial)
	const ground = new Mesh(groundGeometry, groundMaterial)
	ground.receiveShadow = true
	scene.add(ground)

	// The road: wide in town, narrow in the gardens, eased between them over a few metres.
	const gardenness = (distance: number) => [-4, -2, 0, 2, 4].filter((offset) => path.at(distance + offset).zone === 'garden').length / 5
	const street = new Color(palette.street)
	const gardenPath = new Color(palette.gardenPath)
	const grass = new Color(palette.grass)
	const { shapes, shopLight } = shapesOf(owned)
	// Soft light around every lantern, drawn as a cloud of glowing points.
	const glow = glowTexture()
	const glowMaterial = new PointsMaterial({ map: glow, size: 2.6, color: 0xffa060, transparent: true, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true })
	owned.materials.push(glowMaterial)
	owned.textures.push(glow)

	// The town, a round of the path at a time ([blocks](./blocks.mts)).
	const blocks = layBlocks<Pending>(path, (from, to, seed) => {
		const laid = lay(path, from, to, seed, shapes)
		laid.group.add(strip(path, from, to, owned, {
			half: (distance) => streetHalfWidth + (gardenHalfWidth - streetHalfWidth) * gardenness(distance),
			colour: (distance) => street.clone().lerp(gardenPath, gardenness(distance)),
			y: 0.02,
		}))
		// The gardens' grass, a wide strip under them that breaks off where the streets begin.
		laid.group.add(strip(path, from, to, owned, {
			half: () => 18,
			colour: () => grass,
			y: 0.008,
			runs: (distance) => path.at(distance).zone === 'garden',
		}))
		const glowGeometry = new BufferGeometry()
		glowGeometry.setAttribute('position', new Float32BufferAttribute(laid.town.glows, 3))
		owned.geometries.push(glowGeometry)
		laid.group.add(new Points(glowGeometry, glowMaterial))
		return { group: laid.group, pending: laid.pending }
	})
	scene.add(blocks.group)
	// As night falls the lanterns' glow spreads and the shops shine brighter.
	const lamps = (strength: number) => {
		glowMaterial.size = 2.6 + strength
		shopLight.emissiveIntensity = 0.35 + 0.65 * strength
	}

	// The models come in later; until then the town stands without its trees. Their geometry and
	// textures belong to the shared, cached model; only the clones made here are freed with the town.
	let disposed = false
	void models.then((loaded) => {
		if (disposed) return
		// The maple file holds five trees side by side; each is a variant.
		const named = /^MapleTree_\d+$/
		const meshes = loaded.maple?.scene.getObjectsByProperty('type', 'Mesh') ?? []
		const trees = [...new Set(meshes.map((mesh) => (named.test(mesh.parent?.name ?? '') ? mesh.parent : mesh)))]
			.filter((tree): tree is Object3D => tree !== null && named.test(tree.name))
		const maples = loaded.maple === undefined ? [] : trees.length > 0 ? trees : [loaded.maple.scene]
		// Each part has the size of the shape it replaces, so every copy keeps its place and colour.
		const parts = ([['GableRoof', 'roofs'], ['PentRoof', 'eaves'], ['Lantern', 'lanterns'], ['Barrel', 'barrels']] as const).flatMap(([name, shape]) => {
			const geometry = loaded.kit === undefined ? undefined : partOf(loaded.kit.scene, name)
			if (geometry === undefined) return []
			owned.geometries.push(geometry)
			return [{ shape, geometry }]
		})
		for (const { group, pending } of blocks.laid) {
			maples.forEach((variant, which) => {
				const mine = pending.maples.filter((_, index) => index % maples.length === which)
				addAll(group, stamp(variant, mine, 7, true, owned))
			})
			if (loaded.bamboo !== undefined) addAll(group, stamp(loaded.bamboo.scene, pending.bamboo, 7, false, owned))
			if (loaded.torii !== undefined) addAll(group, stamp(loaded.torii.scene, pending.torii, 6.2, true, owned))
			for (const { shape, geometry } of parts) pending.town[shape].reshape(geometry)
		}
	}).catch((error: unknown) => {
		console.warn('[bunbu] the town models could not be read; the town stands without optional foliage', error)
	})

	return {
		passTime: passTime({ scene, fog, backdrop, ambient, sun, lamps }, daylight),

		follow(x, z, distance) {
			blocks.follow(distance)
			ground.position.set(x, 0, z)
			backdrop.position.set(x, 0, z)
			followSun(sun, sunFrom, path, distance)
		},

		dispose() {
			disposed = true
			for (const made of owned.geometries) made.dispose()
			for (const made of owned.materials) made.dispose()
			for (const made of owned.textures) made.dispose()
			blocks.dispose()
			sun.dispose()
		},
	}
}
