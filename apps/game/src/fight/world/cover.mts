/**
 * What the ninjas hide behind (#42): stacked crates, barrels, a loaded cart, straw bales, a boulder,
 * by the side of the way. At every ambush a few stand where the ninjas will come from, and they run
 * out from behind them rather than out of nowhere. More stand along the way at random where no
 * ambush is, so the ones at an ambush give nothing away.
 *
 * Each district of a stage ([districts](./districts.mts)) can have covers of its own, as fits it: a
 * basket of rice or a scarecrow at the village edge, a market stand or a villager by the town's
 * gate gardens, now and then a panda eating bamboo in the deep grove. A rare one is rarer still at an
 * ambush: a villager is mostly just there.
 *
 * Laid out round the samurai as he runs, like the backdrop ([backdrop](./backdrop.mts)), afresh
 * every run. Plain low-poly shapes, about a ninja's height or more so one fits behind.
 */

import {
	BoxGeometry,
	BufferGeometry,
	Color,
	ConeGeometry,
	CylinderGeometry,
	DodecahedronGeometry,
	Group,
	InstancedMesh,
	Matrix4,
	MeshStandardMaterial,
} from 'three'
import { randomOf, type District } from './backdrop.mts'
import { districtAt } from './districts.mts'
import { placed, within } from './kit.mts'
import type { Owned } from './landscape.mts'
import { beside, type Path } from './path.mts'

/** The things a ninja hides behind. */
export type CoverKind =
	| 'crates' | 'barrels' | 'cart' | 'bales' | 'rock'
	/** A big woven basket heaped with rice, and a smaller one. */
	| 'rice-basket'
	/** A scarecrow in a straw coat and hat, with straw bales at its foot. */
	| 'scarecrow'
	/** Cut bamboo bound in upright bundles. */
	| 'bamboo-bundle'
	/** A panda sitting and eating a stalk of bamboo. */
	| 'panda'
	/** A market stand: a table of goods under a cloth roof on four posts. */
	| 'market-stand'
	/**
	 * A villager in a robe and a straw hat, one of a few: a basket on the back, buckets on a carrying
	 * pole, a paper parasol, an old one with a stick, or two of them talking.
	 */
	| 'villager'
	/** A water wheel turning by its channel. */
	| 'water-wheel'
	/** A tall stone lantern on its base. */
	| 'stone-lantern'
	/** Three little stone jizō statues with red bibs, on a stone step. */
	| 'jizo'
	/** Logs stacked between two stakes. */
	| 'woodpile'
	/** Sake barrels in straw, stacked. */
	| 'sake-barrels'
	/** A guard in armour with a spear. */
	| 'guard'
	/** A rack of spears. */
	| 'weapon-rack'
	/** A temple bell hung in its little roofed frame. */
	| 'temple-bell'
	/** A lacquered palanquin on its pole, set down. */
	| 'palanquin'

/**
 * A cover a district has, and how likely it is against the others there, at an ambush and as a
 * decoy where none is: `1` each unless given. A villager is mostly just there, so it is far likelier
 * as a decoy than at an ambush.
 */
export type CoverChoice = { readonly kind: CoverKind; readonly ambush?: number; readonly decoy?: number }

/** What stands by a stage's path: which kinds, how far off its middle, and in which colours. */
export type CoverSet = {
	readonly kinds: readonly CoverKind[]
	/** Metres from the middle of the path to the middle of a cover: at its edge, clear of the way. */
	readonly aside: number
	/** Colours per kind, picked from at random. */
	readonly colours: Readonly<Partial<Record<CoverKind, readonly number[]>>>
}

/**
 * Where the covers of an ambush stand, around the samurai with the way ahead along `-z` as the
 * ninjas' spots are ([placement](./placement.mts)): two either side, well past where the ninjas
 * stand (12.4 m ahead at most, and 2.5 m more once the samurai has run on), so they leap out from
 * behind the nearer one, land beyond their spots and run in toward the samurai before the scroll
 * opens. The farther one stands so the cover gives nothing away.
 */
export const coverAhead = [18, 23] as const

/**
 * How far any cover reaches from its middle, its turn included, and how high it stands: a leap
 * over it must clear that much.
 */
export const coverReach = 1.5
export const coverHeight = 2.25

/**
 * Whether `distance` along the path is within `margin` metres of where an ambush's covers stand,
 * with an ambush every `every` metres: a stage's own things by the way keep clear of them there.
 */
export function nearAmbushCover(distance: number, every: number, margin = 2.5): boolean {
	const ambush = Math.round(distance / every) * every
	return [ambush - every, ambush].some((at) => at > 0 && coverAhead.some((ahead) => Math.abs(distance - (at + ahead)) < margin))
}

/** Where a cover stands on the ground. */
export type CoverSpot = { readonly x: number; readonly z: number }

/** The spots of the covers of an ambush at `distance`, for `aside` metres off the middle of the path. */
export function coverSpotsAt(path: Path, distance: number, aside: number): CoverSpot[] {
	// Along the path itself, so round a bend the covers keep to its side rather than stand on it.
	return [-1, 1].flatMap((side) => coverAhead.map((ahead) => beside(path.at(distance + ahead), side * aside)))
}

/** Metres of path per tile of decoys, and how far behind and ahead of the samurai covers stand. */
const tileLength = 20
const behind = 30
const ahead = 140

/**
 * The decoys of tile `tile` of `path`, laid out from `seed`: none or a few, one side or the other,
 * well away from where an ambush springs, and never on an ambush's own covers, which can stand
 * past that: two covers never stand in each other. With the heading they stand along.
 */
export function decoysOf(path: Path, set: CoverSet, tile: number, every: number, seed: number): (CoverSpot & { heading: number; distance: number })[] {
	const random = randomOf(seed ^ Math.imul(tile, 0x9e3779b1) ^ 0x5bd1e995)
	const from = tile * tileLength
	const count = Math.floor(random() * 2.2)
	// Apart from each other too: never two on one side closer than two covers' reach, and clear of
	// the tile's ends, so the next tile's can't stand in them either.
	const apart = 2 * coverReach + 0.5
	const kept: { distance: number; side: number }[] = []
	for (const decoy of Array.from({ length: count }, () => ({ distance: from + random() * tileLength, side: random() > 0.5 ? 1 : -1 }))) {
		if (Math.abs(decoy.distance - Math.round(decoy.distance / every) * every) < 22 || nearAmbushCover(decoy.distance, every, apart)) continue
		if (decoy.distance - from < apart / 2 || from + tileLength - decoy.distance < apart / 2) continue
		if (kept.some((other) => other.side === decoy.side && Math.abs(other.distance - decoy.distance) < apart)) continue
		kept.push(decoy)
	}
	return kept
		.map(({ distance, side }) => {
			const point = path.at(distance)
			return { ...beside(point, side * set.aside), heading: point.heading, distance }
		})
}

/** The shapes the covers are made of, one unit in size, standing on the ground. */
function shapesOf(): { box: BufferGeometry; barrel: BufferGeometry; wheel: BufferGeometry; rock: BufferGeometry; cone: BufferGeometry } {
	return {
		cone: new ConeGeometry(0.5, 1, 8).translate(0, 0.5, 0),
		box: new BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
		barrel: new CylinderGeometry(0.5, 0.45, 1, 10).translate(0, 0.5, 0),
		wheel: new CylinderGeometry(0.5, 0.5, 1, 12).rotateZ(Math.PI / 2),
		rock: new DodecahedronGeometry(0.5, 0).translate(0, 0.35, 0),
	}
}

type Shape = keyof ReturnType<typeof shapesOf>
type Part = { readonly shape: Shape; readonly matrix: Matrix4; readonly colour: number }

/** The parts of one cover of `kind`, in `colours`, picked with `random`: about 2 m high, 1.5 m across. */
function partsOf(kind: CoverKind, colours: readonly number[], random: () => number): Part[] {
	const pick = () => colours[Math.floor(random() * colours.length)] ?? 0x7a5a3a
	if (kind === 'crates') {
		// Three crates, two side by side and one on top.
		const size = 0.85 + random() * 0.15
		return [
			{ shape: 'box', matrix: placed(-0.45, 0, 0, random() * 0.3, size), colour: pick() },
			{ shape: 'box', matrix: placed(0.45, 0, 0.05, random() * 0.3, size), colour: pick() },
			{ shape: 'box', matrix: placed(0, size, 0, random() * 0.6, size * 0.95), colour: pick() },
		]
	}
	if (kind === 'barrels') {
		// Barrels in a row, and one laid on top of them.
		return [
			{ shape: 'barrel', matrix: placed(-0.5, 0, 0, 0, 0.95, 1.2, 0.95), colour: pick() },
			{ shape: 'barrel', matrix: placed(0.5, 0, 0.1, 0, 0.95, 1.2, 0.95), colour: pick() },
			{ shape: 'barrel', matrix: placed(0, 1.2, 0, 0, 0.9, 1.05, 0.9), colour: pick() },
		]
	}
	if (kind === 'cart') {
		// A hand cart with a load of sacks, on two big wheels.
		const load = pick()
		return [
			{ shape: 'box', matrix: placed(0, 0.75, 0, 0, 1.6, 0.25, 2.2), colour: 0x5a4030 },
			{ shape: 'wheel', matrix: placed(-0.9, 0.75, 0, 0, 0.12, 1.5, 1.5), colour: 0x3e2c20 },
			{ shape: 'wheel', matrix: placed(0.9, 0.75, 0, 0, 0.12, 1.5, 1.5), colour: 0x3e2c20 },
			{ shape: 'box', matrix: placed(0, 1, 0, 0.1, 1.4, 0.8, 1.6), colour: load },
			{ shape: 'box', matrix: placed(0, 1.8, 0.1, -0.2, 1.1, 0.5, 1.1), colour: load },
		]
	}
	if (kind === 'bales') {
		// Rice straw bound in sheaves and stacked into a stook.
		return [
			{ shape: 'barrel', matrix: placed(-0.4, 0, 0, 0, 1, 1.4, 1), colour: pick() },
			{ shape: 'barrel', matrix: placed(0.45, 0, 0.15, 0, 0.95, 1.3, 0.95), colour: pick() },
			{ shape: 'barrel', matrix: placed(0, 1.3, 0, 0, 0.8, 0.9, 0.8), colour: pick() },
		]
	}
	if (kind === 'rice-basket') {
		const basket = pick()
		return [
			{ shape: 'barrel', matrix: placed(0, 0, 0, 0, 1.7, 1.3, 1.7), colour: basket },
			{ shape: 'cone', matrix: placed(0, 1.3, 0, 0, 1.6, 0.8, 1.6), colour: 0xf2ede0 },
			{ shape: 'barrel', matrix: placed(1.05, 0, 0.35, 0, 0.9, 0.7, 0.9), colour: basket },
			{ shape: 'cone', matrix: placed(1.05, 0.7, 0.35, 0, 0.85, 0.4, 0.85), colour: 0xf2ede0 },
		]
	}
	if (kind === 'scarecrow') {
		const straw = pick()
		return [
			{ shape: 'box', matrix: placed(0, 0, 0, 0, 0.14, 2.3, 0.14), colour: 0x5c3d24 },
			{ shape: 'box', matrix: placed(0, 1.65, 0, 0, 1.8, 0.1, 0.1), colour: 0x5c3d24 },
			{ shape: 'cone', matrix: placed(0, 0.75, 0, 0, 1.1, 1.1, 1.1), colour: straw },
			{ shape: 'rock', matrix: placed(0, 1.75, 0, 0, 0.5), colour: 0xe4d8bd },
			{ shape: 'cone', matrix: placed(0, 2.05, 0, 0, 1, 0.35, 1), colour: straw },
			{ shape: 'barrel', matrix: placed(-0.55, 0, 0.3, 0, 0.9, 1.2, 0.9), colour: straw },
			{ shape: 'barrel', matrix: placed(0.6, 0, 0.35, 0, 0.85, 1.1, 0.85), colour: straw },
		]
	}
	if (kind === 'bamboo-bundle') {
		const cane = pick()
		return [-0.55, 0.5].flatMap((x, index) => {
			const height = index === 0 ? 2.4 : 2.1
			return [
				{ shape: 'barrel' as const, matrix: placed(x, 0, index * 0.2, 0, 0.95, height, 0.95), colour: cane },
				{ shape: 'barrel' as const, matrix: placed(x, height * 0.3, index * 0.2, 0, 1, 0.12, 1), colour: 0x5c3d24 },
				{ shape: 'barrel' as const, matrix: placed(x, height * 0.7, index * 0.2, 0, 1, 0.12, 1), colour: 0x5c3d24 },
			]
		})
	}
	if (kind === 'panda') {
		// Black and white, sitting up facing back down the way, a stalk of bamboo in its paws, a few
		// more stalks behind it.
		const white = 0xf2efe6
		const black = 0x2a2626
		return [
			{ shape: 'rock', matrix: placed(0, 0, 0, 0.4, 1.5, 1.3, 1.4), colour: white },
			{ shape: 'rock', matrix: placed(-0.45, 0, 0.35, 0, 0.6), colour: black },
			{ shape: 'rock', matrix: placed(0.45, 0, 0.35, 0, 0.6), colour: black },
			{ shape: 'rock', matrix: placed(0, 0.7, 0.15, 0, 1.1, 0.5, 0.9), colour: black },
			{ shape: 'rock', matrix: placed(0, 1.05, 0.05, 0.3, 1), colour: white },
			{ shape: 'rock', matrix: placed(-0.32, 1.65, 0, 0, 0.3), colour: black },
			{ shape: 'rock', matrix: placed(0.32, 1.65, 0, 0, 0.3), colour: black },
			{ shape: 'box', matrix: placed(-0.16, 1.4, 0.42, 0, 0.16, 0.1, 0.05), colour: black },
			{ shape: 'box', matrix: placed(0.16, 1.4, 0.42, 0, 0.16, 0.1, 0.05), colour: black },
			{ shape: 'barrel', matrix: within(placed(0.2, 0.55, 0.55), within(rotatedX(0.5), placed(0, 0, 0, 0, 0.09, 1.5, 0.09))), colour: 0x7fa046 },
			...[[-0.8, -0.5], [0.1, -0.8], [0.85, -0.45]].map(([x, z]) => ({ shape: 'barrel' as const, matrix: placed(x!, 0, z!, 0, 0.14, 2.6, 0.14), colour: 0x7fa046 })),
		]
	}
	if (kind === 'market-stand') {
		const cloth = pick()
		return [
			{ shape: 'box', matrix: placed(0, 0, 0, 0, 2, 0.9, 1), colour: 0x8a6240 },
			...[[-0.95, -0.55], [0.95, -0.55], [-0.95, 0.55], [0.95, 0.55]].map(([x, z]) => ({ shape: 'box' as const, matrix: placed(x!, 0, z!, 0, 0.1, 2.2, 0.1), colour: 0x5c3d24 })),
			{ shape: 'box', matrix: placed(0, 2.2, 0, 0, 2.3, 0.08, 1.4), colour: cloth },
			{ shape: 'box', matrix: placed(0, 1.75, -0.7, 0, 2.3, 0.45, 0.04), colour: cloth },
			...[-0.6, -0.15, 0.3, 0.7].map((x) => ({ shape: 'rock' as const, matrix: placed(x, 0.85, -0.1, 0, 0.35), colour: random() > 0.5 ? 0xd9765f : 0xe0a040 })),
			{ shape: 'barrel', matrix: placed(0.4, 0.9, 0.2, 0, 0.5, 0.4, 0.5), colour: 0x9a7a45 },
		]
	}
	if (kind === 'villager') return villagerOf(pick, random)
	if (kind === 'water-wheel') {
		// The wheel stands across the way it turns, its paddles round its rim, by a wooden channel.
		return [
			{ shape: 'wheel', matrix: placed(0, 1.15, 0, 0, 0.3, 2.3, 2.3), colour: 0x6a4a30 },
			{ shape: 'wheel', matrix: placed(0, 1.15, 0, 0, 0.42, 0.5, 0.5), colour: 0x3e2c20 },
			...Array.from({ length: 8 }, (_, index) => ({ shape: 'box' as const, matrix: within(placed(0, 1.15, 0), within(new Matrix4().makeRotationX((index * Math.PI) / 4), placed(0, 0.85, 0, 0, 0.36, 0.5, 0.08))), colour: 0x8a6240 })),
			{ shape: 'box', matrix: placed(0.55, 0, 0, 0, 0.5, 0.5, 2.8), colour: 0x5c3d24 },
			{ shape: 'box', matrix: placed(-0.3, 0, 0, 0, 0.14, 1.2, 0.14), colour: 0x3e2c20 },
		]
	}
	if (kind === 'stone-lantern') {
		const stone = pick()
		return [
			{ shape: 'box', matrix: placed(0, 0, 0, 0, 1.1, 0.3, 1.1), colour: stone },
			{ shape: 'barrel', matrix: placed(0, 0.3, 0, 0, 0.4, 0.9, 0.4), colour: stone },
			{ shape: 'box', matrix: placed(0, 1.2, 0, 0, 0.9, 0.15, 0.9), colour: stone },
			{ shape: 'box', matrix: placed(0, 1.35, 0, 0, 0.6, 0.45, 0.6), colour: 0xf6d79a },
			{ shape: 'cone', matrix: placed(0, 1.8, 0, Math.PI / 4, 1.5, 0.45, 1.5), colour: stone },
			{ shape: 'rock', matrix: placed(0, 2.15, 0, 0, 0.3), colour: stone },
		]
	}
	if (kind === 'jizo') {
		// Small: they stand on a step, with a stone wall behind them to hide behind.
		const stone = pick()
		return [
			{ shape: 'box', matrix: placed(0, 0, -0.45, 0, 2, 2, 0.5), colour: stone },
			{ shape: 'box', matrix: placed(0, 0, 0.15, 0, 1.9, 0.3, 0.7), colour: stone },
			...[-0.6, 0, 0.6].flatMap((x) => [
				{ shape: 'barrel' as const, matrix: placed(x, 0.3, 0.2, 0, 0.42, 0.7, 0.4), colour: stone },
				{ shape: 'cone' as const, matrix: placed(x, 0.65, 0.25, 0, 0.5, 0.3, 0.45), colour: 0xb3391f },
				{ shape: 'rock' as const, matrix: placed(x, 0.98, 0.2, 0, 0.34), colour: stone },
			]),
		]
	}
	if (kind === 'woodpile') {
		const bark = pick()
		return [
			...[-1.05, 1.05].map((x) => ({ shape: 'box' as const, matrix: placed(x, 0, 0, 0, 0.14, 2.1, 0.14), colour: 0x3e2c20 })),
			...Array.from({ length: 4 }, (_, row) => row).flatMap((row) => [-0.55, 0, 0.55].slice(0, row === 3 ? 2 : 3).map((z) => ({
				shape: 'wheel' as const,
				matrix: placed(0, 0.25 + row * 0.46, z + (row === 3 ? 0.27 : 0), 0, 2.1, 0.46, 0.46),
				colour: bark,
			}))),
		]
	}
	if (kind === 'sake-barrels') {
		// Barrels wrapped in straw and bound with rope, three, two and one.
		const straw = pick()
		return [[-0.9, 0, 0.9], [-0.45, 0.45], [0]].flatMap((row, level) => row.flatMap((x) => [
			{ shape: 'barrel' as const, matrix: placed(x, level * 0.82, 0, 0, 0.88, 0.82, 0.88), colour: straw },
			{ shape: 'barrel' as const, matrix: placed(x, level * 0.82 + 0.6, 0, 0, 0.9, 0.08, 0.9), colour: 0x5c3d24 },
		]))
	}
	if (kind === 'guard') {
		const armour = pick()
		return [
			...[-0.15, 0.15].map((x) => ({ shape: 'box' as const, matrix: placed(x, 0, 0, 0, 0.2, 0.8, 0.25), colour: 0x2a2626 })),
			{ shape: 'box', matrix: placed(0, 0.75, 0, 0, 0.7, 0.75, 0.42), colour: armour },
			{ shape: 'cone', matrix: placed(0, 0.6, 0, 0, 0.85, 0.35, 0.6), colour: armour },
			{ shape: 'rock', matrix: placed(0, 1.6, 0, 0, 0.36), colour: 0xe0b48a },
			{ shape: 'cone', matrix: placed(0, 1.72, 0, 0, 0.55, 0.32, 0.55), colour: 0x2a2626 },
			{ shape: 'box', matrix: placed(0.45, 0, 0, 0, 0.06, 2.7, 0.06), colour: 0x5c3d24 },
			{ shape: 'cone', matrix: placed(0.45, 2.7, 0, 0, 0.12, 0.3, 0.12), colour: 0xc9c4b8 },
		]
	}
	if (kind === 'weapon-rack') {
		// A cloth hung behind the spears, a clan's crest on it, so the rack is a wall to hide behind.
		const cloth = pick()
		return [
			{ shape: 'box', matrix: placed(0, 0.02, -0.24, 0, 2.05, 2.25, 0.05), colour: cloth },
			{ shape: 'wheel', matrix: within(placed(0, 1.35, -0.21), new Matrix4().makeRotationY(Math.PI / 2).multiply(placed(0, 0, 0, 0, 0.02, 0.7, 0.7))), colour: 0xf2ead8 },
			...[-0.95, 0.95].map((x) => ({ shape: 'box' as const, matrix: placed(x, 0, 0, 0, 0.14, 1.6, 0.4), colour: 0x5c3d24 })),
			...[0.3, 1.3].map((y) => ({ shape: 'box' as const, matrix: placed(0, y, 0, 0, 2, 0.1, 0.3), colour: 0x8a6240 })),
			...[-0.65, -0.32, 0, 0.32, 0.65].flatMap((x) => [
				{ shape: 'box' as const, matrix: placed(x, 0.05, 0.02, 0, 0.06, 2.5, 0.06), colour: 0x3e2c20 },
				{ shape: 'cone' as const, matrix: placed(x, 2.55, 0.02, 0, 0.12, 0.3, 0.12), colour: 0xc9c4b8 },
			]),
		]
	}
	if (kind === 'temple-bell') {
		return [
			...[[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]].map(([x, z]) => ({ shape: 'box' as const, matrix: placed(x!, 0, z!, 0, 0.16, 2.3, 0.16), colour: 0xa8261c })),
			{ shape: 'cone', matrix: placed(0, 2.25, 0, Math.PI / 4, 2.6, 0.6, 2.6), colour: 0x3a3a44 },
			{ shape: 'barrel', matrix: placed(0, 0.75, 0, 0, 1, 1.3, 1), colour: 0x6b5a3a },
			{ shape: 'cone', matrix: placed(0, 2.02, 0, 0, 0.9, 0.12, 0.9), colour: 0x6b5a3a },
		]
	}
	if (kind === 'palanquin') {
		const lacquer = pick()
		return [
			{ shape: 'box', matrix: placed(0, 0.35, 0, 0, 1.1, 1.2, 1.7), colour: lacquer },
			{ shape: 'box', matrix: placed(0, 1.55, 0, 0, 1.3, 0.12, 1.9), colour: 0x2a1e1a },
			{ shape: 'box', matrix: placed(0, 1.75, 0, 0, 0.14, 0.14, 3.6), colour: 0x8a6240 },
			...[-0.4, 0.4].map((x) => ({ shape: 'box' as const, matrix: placed(x, 0, 0, 0, 0.12, 0.35, 1.5), colour: 0x2a1e1a })),
		]
	}
	// A boulder, and a smaller one leaning on it.
	const size = 2.1 + random() * 0.5
	return [
		{ shape: 'rock', matrix: placed(0, 0, 0, random() * 6.28, size * 1.1, size, size), colour: pick() },
		{ shape: 'rock', matrix: placed(0.9, 0, 0.4, random() * 6.28, size * 0.5), colour: pick() },
	]
}

export type Cover = {
	readonly group: Group
	/** Lays out the covers round the samurai `distance` metres along the path. */
	follow: (distance: number) => void
	dispose: () => void
}

/**
 * The covers of `set` along `path`: at every `every` metres, where an ambush springs, and at
 * random in between from `seed`, a new one every run.
 */
/** One villager, standing at `x`: robe, face, straw hat. */
function personAt(x: number, robe: number, hat = 0xc9a75e): Part[] {
	return [
		{ shape: 'cone', matrix: placed(x, 0, 0, 0, 0.75, 1.45, 0.65), colour: robe },
		{ shape: 'rock', matrix: placed(x, 1.4, 0, 0, 0.36), colour: 0xe0b48a },
		{ shape: 'cone', matrix: placed(x, 1.62, 0, 0, 0.75, 0.22, 0.75), colour: hat },
	]
}

/** A villager, one of a few kinds picked with `random`, in a robe picked with `pick`. */
function villagerOf(pick: () => number, random: () => number): Part[] {
	const robe = pick()
	const which = random()
	// A basket carried on the back.
	if (which < 0.3) return [...personAt(0, robe), { shape: 'barrel', matrix: placed(0, 0.65, 0.35, 0, 0.55, 0.7, 0.45), colour: 0x9a7a45 }]
	// Two buckets hung from a pole across the shoulders.
	if (which < 0.5) {
		return [
			...personAt(0, robe),
			{ shape: 'box', matrix: placed(0, 1.25, 0, 0, 1.9, 0.07, 0.07), colour: 0x8a6240 },
			...[-0.9, 0.9].flatMap((x) => [
				{ shape: 'box' as const, matrix: placed(x, 0.55, 0, 0, 0.03, 0.7, 0.03), colour: 0x3e2c20 },
				{ shape: 'barrel' as const, matrix: placed(x, 0.25, 0, 0, 0.5, 0.42, 0.5), colour: 0x9a7a45 },
			]),
		]
	}
	// A paper parasol held up.
	if (which < 0.7) {
		const paper = [0xb3391f, 0x2f4a7a, 0xe0a040][Math.floor(random() * 3)] ?? 0xb3391f
		return [
			...personAt(0, robe, robe),
			{ shape: 'box', matrix: placed(0.2, 0.9, 0, 0, 0.04, 1.2, 0.04), colour: 0x5c3d24 },
			{ shape: 'cone', matrix: placed(0.2, 1.95, 0, 0, 1.5, 0.35, 1.5), colour: paper },
		]
	}
	// An old one, bent over a stick.
	if (which < 0.85) {
		const bent = within(placed(0, 0, 0), new Matrix4().makeRotationX(-0.25))
		return [
			...personAt(0, robe).map((part) => ({ ...part, matrix: within(bent, part.matrix) })),
			{ shape: 'box', matrix: within(placed(0.35, 0, -0.2), new Matrix4().makeRotationX(-0.15).multiply(placed(0, 0, 0, 0, 0.05, 1.25, 0.05))), colour: 0x5c3d24 },
		]
	}
	// Two of them, talking.
	return [...personAt(-0.45, robe), ...personAt(0.45, pick(), 0xb89a55).map((part) => ({ ...part, matrix: within(placed(0, 0, 0, Math.PI), part.matrix) }))]
}

/** A tilt about `x`, forward. */
function rotatedX(angle: number): Matrix4 {
	return new Matrix4().makeRotationX(angle)
}

/**
 * The kind of cover at `distance` along a stage of `stageLength` metres, for an ambush or as a
 * decoy: from the district there, picked by how likely each of its covers is, else from `set`.
 */
export function coverKindAt(set: CoverSet, districts: readonly District[], distance: number, stageLength: number, role: 'ambush' | 'decoy', random: () => number): CoverKind {
	const { from, to, mix } = districtAt(distance, stageLength)
	const choices: readonly CoverChoice[] = districts[random() < mix ? to : from]?.cover ?? set.kinds.map((kind) => ({ kind }))
	const weights = choices.map((choice) => choice[role] ?? 1)
	let left = random() * weights.reduce((sum, weight) => sum + weight, 0)
	for (const [index, choice] of choices.entries()) {
		left -= weights[index] ?? 0
		if (left < 0) return choice.kind
	}
	return choices.at(-1)?.kind ?? 'crates'
}

export function createCover(path: Path, set: CoverSet, every: number, seed: number, owned: Owned, districts: readonly District[] = [], stageLength: () => number = () => 0): Cover {
	const shapes = shapesOf()
	owned.geometries.push(...Object.values(shapes))
	const material = new MeshStandardMaterial({ roughness: 0.95, flatShading: true })
	owned.materials.push(material)

	/** The covers round one point: their parts, turned to face the path, each of a kind picked at random. */
	const coversAt = (spots: readonly CoverSpot[], distance: number, role: 'ambush' | 'decoy', heading: number, random: () => number): Part[] => spots.flatMap((spot) => {
		const kind = coverKindAt(set, districts, distance, stageLength(), role, random)
		const where = placed(spot.x, 0, spot.z, heading + (random() - 0.5) * 0.6)
		return partsOf(kind, set.colours[kind] ?? [0x7a5a3a], random).map((part) => ({ ...part, matrix: within(where, part.matrix) }))
	})

	/** The covers of tile `tile`: those of an ambush in it, and a decoy or two. */
	const layTile = (tile: number): Part[] => {
		const random = randomOf(seed ^ Math.imul(tile, 0x9e3779b1))
		const from = tile * tileLength
		const parts: Part[] = []
		for (let ambush = Math.ceil(from / every) * every; ambush < from + tileLength; ambush += every) {
			if (ambush <= 0) continue
			parts.push(...coversAt(coverSpotsAt(path, ambush, set.aside), ambush, 'ambush', path.at(ambush).heading, random))
		}
		for (const decoy of decoysOf(path, set, tile, every, seed)) parts.push(...coversAt([decoy], decoy.distance, 'decoy', decoy.heading, random))
		return parts
	}

	const most = Math.ceil((behind + ahead) / tileLength + 1) * 24
	const group = new Group()
	const meshes = new Map<Shape, InstancedMesh>()
	for (const [shape, geometry] of Object.entries(shapes) as [Shape, BufferGeometry][]) {
		const mesh = new InstancedMesh(geometry, material, most)
		mesh.count = 0
		mesh.castShadow = true
		mesh.receiveShadow = true
		mesh.frustumCulled = false
		group.add(mesh)
		meshes.set(shape, mesh)
	}

	const laid = new Map<number, Part[]>()
	const colour = new Color()
	let window: readonly [number, number] | undefined

	const show = () => {
		for (const mesh of meshes.values()) mesh.count = 0
		for (const parts of laid.values()) {
			for (const { shape, matrix, colour: hex } of parts) {
				const mesh = meshes.get(shape)
				if (mesh === undefined || mesh.count >= mesh.instanceMatrix.count) continue
				mesh.setMatrixAt(mesh.count, matrix)
				mesh.setColorAt(mesh.count, colour.setHex(hex))
				mesh.count += 1
			}
		}
		for (const mesh of meshes.values()) {
			mesh.instanceMatrix.needsUpdate = true
			if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true
		}
	}

	return {
		group,

		follow(distance) {
			const first = Math.floor((distance - behind) / tileLength)
			const last = Math.floor((distance + ahead) / tileLength)
			if (window?.[0] === first && window[1] === last) return
			window = [first, last]
			for (const tile of laid.keys()) if (tile < first || tile > last) laid.delete(tile)
			for (let tile = first; tile <= last; tile++) if (!laid.has(tile)) laid.set(tile, layTile(tile))
			show()
		},

		dispose() {
			for (const mesh of meshes.values()) mesh.dispose()
		},
	}
}
