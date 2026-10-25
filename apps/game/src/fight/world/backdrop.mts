/**
 * What stands far off the path, behind a stage's own scenery: rows of houses, huts, woods and hills
 * that fill the ground up to the fog, so a stage never looks out on an empty plain (#55).
 *
 * It isn't part of the stage's blocks ([blocks](./blocks.mts)): it is laid out afresh round the
 * samurai as he runs, in short tiles along the path, at random for every run. So the backdrop never
 * repeats with the blocks, and no two runs look out on the same town. It is plain low-poly shapes
 * without shadows: far off, in the fog, only their outline and colour read.
 */

import {
	BufferGeometry,
	Color,
	ConeGeometry,
	CylinderGeometry,
	DodecahedronGeometry,
	Group,
	IcosahedronGeometry,
	InstancedMesh,
	Matrix4,
	MeshStandardMaterial,
	BoxGeometry,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { gableGeometry, placed, within } from './kit.mts'
import { fadeNear, type Owned } from './landscape.mts'
import { beside, type Path, type Zone } from './path.mts'
import { districtAt } from './districts.mts'
import type { CoverChoice } from './cover.mts'

/** The shapes a backdrop is made of. */
export type BackdropShape =
	| 'house' | 'hut' | 'pine' | 'broadleaf' | 'bamboo' | 'hill'
	/** A gate over the way: two posts and two beams, `span` metres between the posts. */
	| 'torii'
	/** A stone lantern by the way. */
	| 'lantern'
	/** A pond, and one with a red bridge over it. */
	| 'pond' | 'bridge'
	/** A boulder. */
	| 'rock'
	/** A stretch of castle wall: a stone base under white plaster and a tiled top. */
	| 'wall'
	/** A pagoda of five storeys, or a castle keep, on the skyline. */
	| 'pagoda'

/**
 * A row along both sides of the path: `shape`s from `from` to `to` metres off it, about `perTile`
 * a side every {@link tileLength} metres, in `colours` picked at random per part.
 */
export type BackdropRow = {
	readonly shape: BackdropShape
	readonly from: number
	readonly to: number
	readonly perTile: number
	/** One list of colours per part of the shape ({@link partsOf}), picked from at random. */
	readonly colours: readonly (readonly number[])[]
	/** Over the way rather than beside it, as a torii: square to the path, `span` metres across. */
	readonly across?: boolean
	/** How wide the way is under a shape `across` it, in metres. */
	readonly span?: number
	/** Only where the path runs through a street, or a garden. */
	readonly zone?: Zone
}

/** A district of a stage ([districts](./districts.mts)): its name, and the rows of its backdrop. */
export type District = {
	readonly name: string
	readonly rows: readonly BackdropRow[]
	/** The covers by the way in this district ([cover](./cover.mts)), when it has its own. */
	readonly cover?: readonly CoverChoice[]
}

/** Metres of path per tile: what is laid out at once as the samurai comes up to it. */
export const tileLength = 15
/**
 * How far along the path behind the samurai the backdrop is laid out, and how far ahead. Not up to
 * the fog along the path but round every bend: on every stage's path, no stretch farther along than
 * this comes within the fog's reach plus the farthest row of him, so nothing is laid out or taken
 * away where it could be seen (`backdrop.test.mts`). The mountain temple's bends need the most.
 */
export const backdropReach = { behind: 460, ahead: 460 }
const { behind, ahead } = backdropReach

/** How many parts each shape has, each a mesh of its own colour: a body and a roof, a trunk and a crown. */
export const partsOf: Readonly<Record<BackdropShape, number>> = {
	house: 2, hut: 2, pine: 2, broadleaf: 2, bamboo: 1, hill: 1,
	torii: 3, lantern: 2, pond: 1, bridge: 3, rock: 1, wall: 3, pagoda: 2,
}

/** One thing in the backdrop: where it stands, and how each of its parts is placed and coloured. */
export type Item = {
	readonly shape: BackdropShape
	readonly parts: readonly { readonly matrix: Matrix4; readonly colour: number }[]
}

/** Random numbers in `[0, 1)` from `seed`, for one tile: the same tile comes out the same in a run. */
export function randomOf(seed: number): () => number {
	let state = seed >>> 0
	return () => {
		state = (state + 0x6d2b79f5) >>> 0
		let value = Math.imul(state ^ (state >>> 15), 1 | state)
		value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
		return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
	}
}

/** The parts of `shape` as matrices round its foot, at a size and in proportions picked with `random`; `span` for a shape over the way. */
function shapeOf(shape: BackdropShape, random: () => number, span = 4): Matrix4[] {
	if (shape === 'torii') {
		// The posts either side of the way, the lintel through them and the curved top beam over it.
		const height = 4.6 + random() * 0.6
		const half = span / 2 + 0.4
		return [
			placed(-half, height / 2, 0, 0, 0.32, height, 0.32),
			placed(half, height / 2, 0, 0, 0.32, height, 0.32),
			placed(0, height, 0, 0, span + 2.2, 0.38, 0.5),
		]
	}
	if (shape === 'lantern') {
		// A post and the fire box on it, under its cap.
		const height = 1.5 + random() * 0.4
		return [placed(0, height * 0.35, 0, 0, 0.32, height * 0.7, 0.32), placed(0, height * 0.82, 0, 0, 0.6, height * 0.3, 0.6)]
	}
	if (shape === 'pond') {
		const radius = 4 + random() * 5
		return [placed(0, 0.03, 0, 0, radius, 0.05, radius * (0.6 + random() * 0.3))]
	}
	if (shape === 'bridge') {
		// A pond with a red arched bridge across it: its deck and a rail either side.
		const radius = 5 + random() * 3
		return [
			placed(0, 0.03, 0, 0, radius, 0.05, radius * 0.7),
			placed(0, 0.6, 0, 0, 1.6, 0.18, radius * 1.6),
			placed(0, 1.1, 0, 0, 1.8, 0.5, radius * 1.6),
		]
	}
	if (shape === 'rock') {
		const size = 1 + random() * 2.2
		return [placed(0, size * 0.25, 0, random() * 6.28, size * 1.3, size * 0.8, size)]
	}
	if (shape === 'wall') {
		// A long stretch, laid along the way: the stone base sloping in, plaster, and a tiled top.
		const length = 14 + random() * 10
		return [placed(0, 2.2, 0, 0, length, 4.4, 2.6), placed(0, 5.4, 0, 0, length, 2, 1), placed(0, 6.6, 0, 0, length + 0.6, 0.7, 1.8)]
	}
	if (shape === 'pagoda') {
		// Storeys narrowing upward, each under its roof: one mesh for the walls, one for the roofs.
		const size = 6 + random() * 4
		return [placed(0, size * 1.6, 0, 0, size, size * 3.2, size), placed(0, size * 3.3, 0, random() * 6.28, size * 1.9, size * 0.5, size * 1.9)]
	}
	if (shape === 'house') {
		// A town house: plastered walls under a gable roof, two storeys or one.
		const width = 6 + random() * 5
		const depth = 5 + random() * 3
		const height = 3.2 + (random() > 0.6 ? 2.6 : 0)
		const roof = 1.8 + random() * 0.8
		return [placed(0, height / 2, 0, 0, width, height, depth), placed(0, height, 0, 0, width + 0.8, roof, depth + 1.4)]
	}
	if (shape === 'hut') {
		// A farmhouse or a shed: low timber walls under a steep thatch.
		const width = 4 + random() * 4
		const depth = 4 + random() * 2
		const height = 2 + random() * 0.8
		return [placed(0, height / 2, 0, 0, width, height, depth), placed(0, height, 0, 0, width + 1, 2.4 + random() * 1.2, depth + 1.6)]
	}
	if (shape === 'pine') {
		const height = 6 + random() * 7
		return [placed(0, height * 0.2, 0, 0, height * 0.05, height * 0.4, height * 0.05), placed(0, height * 0.6, 0, 0, height * 0.28, height * 0.8, height * 0.28)]
	}
	if (shape === 'broadleaf') {
		const height = 5 + random() * 6
		const crown = height * (0.32 + random() * 0.12)
		return [placed(0, height * 0.25, 0, 0, height * 0.06, height * 0.5, height * 0.06), placed(0, height - crown * 0.9, 0, 0, crown, crown * 0.85, crown)]
	}
	if (shape === 'bamboo') {
		const height = 9 + random() * 6
		return [placed(0, 0, 0, 0, 1 + random() * 0.6, height, 1 + random() * 0.6)]
	}
	// A hill, sunk into the ground, so only its top shows.
	const radius = 18 + random() * 22
	return [placed(0, -radius * 0.25, 0, 0, radius * 1.3, radius * (0.35 + random() * 0.3), radius)]
}

/** A clump of bamboo, one unit high, a metre or so across: a handful of stalks of different heights. */
function bambooClump(): BufferGeometry {
	const stalks = [[0, 0, 1], [0.35, 0.2, 0.85], [-0.3, 0.25, 0.92], [0.1, -0.35, 0.78], [-0.25, -0.2, 0.7]] as const
	const geometries = stalks.map(([x, z, height]) => new CylinderGeometry(0.06, 0.08, height, 5).translate(x, height / 2, z))
	const clump = mergeGeometries(geometries)
	for (const geometry of geometries) geometry.dispose()
	return clump
}

/** The geometry of each part of each shape, one unit in size, standing on its foot. */
function geometriesOf(): Record<BackdropShape, BufferGeometry[]> {
	const box = new BoxGeometry(1, 1, 1)
	const gable = gableGeometry()
	const trunk = new CylinderGeometry(0.5, 0.7, 1, 5)
	return {
		house: [box, gable],
		hut: [box, gable],
		pine: [trunk, new ConeGeometry(1, 1, 6)],
		broadleaf: [trunk, new IcosahedronGeometry(1, 0)],
		bamboo: [bambooClump()],
		hill: [new IcosahedronGeometry(1, 1)],
		torii: [box, box, box],
		lantern: [box, box],
		pond: [new CylinderGeometry(1, 1, 1, 20)],
		bridge: [new CylinderGeometry(1, 1, 1, 20), box, box],
		rock: [new DodecahedronGeometry(1, 0)],
		wall: [box, box, box],
		pagoda: [box, new ConeGeometry(1, 1, 4)],
	}
}

/** Metres between the points of the path a tile checks its things against. */
const sampleStep = 2

/**
 * The path round tile `tile`, a point every {@link sampleStep} metres, as far either way as a bend
 * can bring it back within the reach of the backdrop ({@link backdropReach}).
 */
function pathAround(path: Path, tile: number): { x: number; z: number }[] {
	const points: { x: number; z: number }[] = []
	for (let distance = tile * tileLength - behind; distance <= (tile + 1) * tileLength + ahead; distance += sampleStep) points.push(path.at(distance))
	return points
}

/** Whether `x, z` is at least `clear` metres from every point of `points`. */
function clearOfPath(points: readonly { x: number; z: number }[], x: number, z: number, clear: number): boolean {
	return points.every((point) => Math.hypot(point.x - x, point.z - z) >= clear)
}

/**
 * Lays out tile `tile`'s backdrop: the rows of its district either side, each thing clear of the
 * path all round. Where two districts meet, the rows of both, the one thinning out as the other
 * comes in.
 */
export function layTile(path: Path, districts: readonly District[], seed: number, tile: number, stageLength: number): Item[] {
	const random = randomOf(seed ^ Math.imul(tile, 0x9e3779b1))
	const around = pathAround(path, tile)
	const { from, to, mix } = districtAt((tile + 0.5) * tileLength, stageLength)
	const weighted = from === to
		? [{ rows: districts[from]?.rows ?? [], share: 1 }]
		: [{ rows: districts[from]?.rows ?? [], share: 1 - mix }, { rows: districts[to]?.rows ?? [], share: mix }]
	const items: Item[] = []
	for (const { rows, share } of weighted) {
		for (const row of rows) {
			for (const side of row.across === true ? [0] : [-1, 1]) {
				// About `perTile`, more or fewer, so the rows thin out and crowd together along the way.
				const count = Math.floor(row.perTile * share * (0.4 + random() * 1.2) + random())
				for (let index = 0; index < count; index++) {
					const distance = (tile + random()) * tileLength
					const point = path.at(distance)
					const parts = shapeOf(row.shape, random, row.span)
					const turn = random() * Math.PI * 2
					if (row.zone !== undefined && point.zone !== row.zone) continue
					let where: Matrix4
					if (row.across === true) {
						where = placed(point.x, 0, point.z, point.heading)
					} else {
						const out = row.from + random() * (row.to - row.from)
						const at = beside(point, side * out)
						// Never nearer the path than the row starts, also where the path bends back toward it.
						if (!clearOfPath(around, at.x, at.z, row.from - 1)) continue
						// A wall runs along the way; the rest stand at any angle.
						where = placed(at.x, 0, at.z, row.shape === 'wall' ? point.heading + Math.PI / 2 : turn)
					}
					items.push({
						shape: row.shape,
						parts: parts.map((matrix, part) => {
							const colours = row.colours[part] ?? row.colours[0] ?? [0x808080]
							return { matrix: within(where, matrix), colour: colours[Math.floor(random() * colours.length)] ?? 0x808080 }
						}),
					})
				}
			}
		}
	}
	return items
}

export type Backdrop = {
	readonly group: Group
	/** Lays out the backdrop round the samurai `distance` metres along the path. */
	follow: (distance: number) => void
	/** Frees its meshes; the geometries and materials are in the stage's `owned`. */
	dispose: () => void
}

/**
 * The backdrop of a stage's `districts` along `path`, laid out at random from `seed`: a new one
 * every run. Which district is where goes by the length of the stage, `stageLength()` metres, read
 * as each stretch is laid out. One flat-shaded material shades it all, fog included, and a copy of
 * it that fades the torii; each part gets its own colour.
 */
export function createBackdrop(path: Path, districts: readonly District[], seed: number, owned: Owned, stageLength: () => number): Backdrop {
	const rows = districts.flatMap((district) => district.rows)
	const geometries = geometriesOf()
	const material = new MeshStandardMaterial({ roughness: 1, flatShading: true })
	// The torii go over the way, so they fade as the camera passes under them.
	const overhead = material.clone()
	fadeNear(overhead)
	owned.materials.push(material, overhead)
	for (const parts of Object.values(geometries)) owned.geometries.push(...parts)

	// As many as a window of tiles can hold, at the most a row can crowd together.
	const tiles = Math.ceil((behind + ahead) / tileLength) + 1
	const group = new Group()
	const meshes = new Map<BackdropShape, InstancedMesh[]>()
	for (const shape of new Set(rows.map((row) => row.shape))) {
		// Two districts can meet in a tile: room for all of their rows.
		const most = rows.filter((row) => row.shape === shape).reduce((sum, row) => sum + Math.ceil(row.perTile * 1.6 + 1) * 2, 0) * tiles
		const parts = geometries[shape].map((geometry) => {
			const mesh = new InstancedMesh(geometry, shape === 'torii' ? overhead : material, most)
			mesh.count = 0
			// One mesh round the samurai, always in view somewhere: culling it would only cost.
			mesh.frustumCulled = false
			group.add(mesh)
			return mesh
		})
		meshes.set(shape, parts)
	}

	const laid = new Map<number, Item[]>()
	const colour = new Color()
	let window: readonly [number, number] | undefined

	const show = () => {
		for (const parts of meshes.values()) for (const mesh of parts) mesh.count = 0
		for (const items of laid.values()) {
			for (const { shape, parts } of items) {
				const shapeMeshes = meshes.get(shape)
				if (shapeMeshes === undefined) continue
				parts.forEach(({ matrix, colour: hex }, part) => {
					const mesh = shapeMeshes[part]
					if (mesh === undefined || mesh.count >= mesh.instanceMatrix.count) return
					mesh.setMatrixAt(mesh.count, matrix)
					mesh.setColorAt(mesh.count, colour.setHex(hex))
					mesh.count += 1
				})
			}
		}
		for (const parts of meshes.values()) {
			for (const mesh of parts) {
				mesh.instanceMatrix.needsUpdate = true
				if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true
			}
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
			for (let tile = first; tile <= last; tile++) if (!laid.has(tile)) laid.set(tile, layTile(path, districts, seed, tile, stageLength()))
			show()
		},

		dispose() {
			for (const parts of meshes.values()) for (const mesh of parts) mesh.dispose()
		},
	}
}
