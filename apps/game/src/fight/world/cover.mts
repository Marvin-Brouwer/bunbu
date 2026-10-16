/**
 * What the ninjas hide behind (#42): stacked crates, barrels, a loaded cart, straw bales, a boulder,
 * by the side of the way. At every ambush a few stand where the ninjas will come from, and they run
 * out from behind them rather than out of nowhere. More stand along the way at random where no
 * ambush is, so the ones at an ambush give nothing away.
 *
 * Laid out round the samurai as he runs, like the backdrop ([backdrop](./backdrop.mts)), afresh
 * every run. Plain low-poly shapes, a little over a ninja's height so one fits behind.
 */

import {
	BoxGeometry,
	BufferGeometry,
	Color,
	CylinderGeometry,
	DodecahedronGeometry,
	Group,
	InstancedMesh,
	Matrix4,
	MeshStandardMaterial,
} from 'three'
import { randomOf } from './backdrop.mts'
import { placed, within } from './kit.mts'
import type { Owned } from './landscape.mts'
import { beside, type Path } from './path.mts'

/** The things a ninja hides behind. */
export type CoverKind = 'crates' | 'barrels' | 'cart' | 'bales' | 'rock'

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

/** The shapes the covers are made of, one unit in size, standing on the ground. */
function shapesOf(): { box: BufferGeometry; barrel: BufferGeometry; wheel: BufferGeometry; rock: BufferGeometry } {
	return {
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
export function createCover(path: Path, set: CoverSet, every: number, seed: number, owned: Owned): Cover {
	const shapes = shapesOf()
	owned.geometries.push(...Object.values(shapes))
	const material = new MeshStandardMaterial({ roughness: 0.95, flatShading: true })
	owned.materials.push(material)

	/** The covers round one point: their parts, turned to face the path, each of a kind picked at random. */
	const coversAt = (spots: readonly CoverSpot[], heading: number, random: () => number): Part[] => spots.flatMap((spot) => {
		const kind = set.kinds[Math.floor(random() * set.kinds.length)] ?? 'crates'
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
			parts.push(...coversAt(coverSpotsAt(path, ambush, set.aside), path.at(ambush).heading, random))
		}
		// Decoys, one side or the other, kept away from the ambushes' own.
		const decoys = Math.floor(random() * 2.2)
		for (let index = 0; index < decoys; index++) {
			const distance = from + random() * tileLength
			const nearest = Math.round(distance / every) * every
			if (Math.abs(distance - nearest) < 22) continue
			const point = path.at(distance)
			const spot = beside(point, (random() > 0.5 ? 1 : -1) * set.aside)
			parts.push(...coversAt([spot], point.heading, random))
		}
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
