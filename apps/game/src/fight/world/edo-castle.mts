/**
 * Edo castle ([stages](../../../../../docs/design/screens.md#2-fight-setup)) at sunset: a gravel way
 * between curving stone walls under white plastered walls, through gatehouses, along a moat, with
 * pines behind the walls and the keep rising over everything. The last stage, and the grandest.
 *
 * Laid out when the run starts as a few blocks of a round of the path each, stitched together
 * ahead of the samurai for as long as the run goes ([blocks](./blocks.mts)), in stretches of path
 * that are each their own `InstancedMesh`. The walls, gates, keep and pines are from our stage kit
 * (`assets/blender/stage_kit.py`), the lanterns from the temple kit; the grounds stand without
 * them until they are in.
 */

import {
	Box3,
	BoxGeometry,
	CircleGeometry,
	Color,
	DirectionalLight,
	Fog,
	Group,
	HemisphereLight,
	Mesh,
	MeshStandardMaterial,
	Vector3,
	type Material,
	type Object3D,
	type Scene,
} from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { layBlocks } from './blocks.mts'
import { Batch, chunkOf, placed, scatter, type Cursor } from './kit.mts'
import { addAll, clearanceOf, cutAway, facingPath, fogFar, isFree, passTime, sky, skyRadius, stamp, strip, type Daylight, type Owned, type Planting, type StageView, type Taken } from './landscape.mts'
import type { District } from './backdrop.mts'
import { nearAmbushCover, type CoverSet } from './cover.mts'
import { metresPerAmbush } from '../flows/run.mts'
import { beside, type Leg, type Path } from './path.mts'

const palette = {
	lawn: 0x56603a,
	gravel: 0xb8ad98,
	water: 0x2d4a5a,
}

/** From sunset to a moonlit night. One light per quarter of the stage ({@link passTime}). */
const daylight: Daylight = [
	{
		skyTop: 0x2c2458,
		skyHorizon: 0xf28c56,
		fog: 0xb07a70,
		ambient: { sky: 0xc0b0e0, ground: 0x4a3a30, intensity: 2.2 },
		sun: { colour: 0xffa070, intensity: 2.8 },
		lamps: 0,
	},
	{
		skyTop: 0x241e4e,
		skyHorizon: 0xd06a58,
		fog: 0x8e6468,
		ambient: { sky: 0xaca4dc, ground: 0x40342e, intensity: 2.1 },
		sun: { colour: 0xff8a64, intensity: 2.2 },
		lamps: 0,
	},
	{
		skyTop: 0x1a1840,
		skyHorizon: 0x7a5274,
		fog: 0x5c5066,
		ambient: { sky: 0x9498d4, ground: 0x34302e, intensity: 1.9 },
		sun: { colour: 0xc0a0c0, intensity: 1.5 },
		lamps: 0,
	},
	{
		skyTop: 0x0e1030,
		skyHorizon: 0x36325c,
		fog: 0x38364e,
		ambient: { sky: 0x808ccc, ground: 0x2a2630, intensity: 1.8 },
		sun: { colour: 0xa8b8e8, intensity: 1.0 },
		lamps: 0,
	},
]

/** Straight ways between the walls, joined by turns as much left as right. */
export const castleRound: readonly Leg[] = [
	{ length: 60, turn: 0, zone: 'street' },
	{ length: 25, turn: 0.8, zone: 'street' },
	{ length: 50, turn: 0, zone: 'street' },
	{ length: 25, turn: -1.6, zone: 'street' },
	{ length: 50, turn: 0, zone: 'street' },
	{ length: 25, turn: 0.8, zone: 'street' },
	{ length: 40, turn: 0, zone: 'street' },
]

const roundLength = castleRound.reduce((sum, leg) => sum + leg.length, 0)

/** Half the width of the gravel way, and how far from its middle the stone walls' feet stand. */
const pathHalfWidth = 3
const wallFoot = 6
/** The wall's foot is this far in front of its root (`CastleWall` faces `+z`). */
const wallFront = 1.6
/** How long one wall piece is, and how far apart they are laid, a little less so they overlap. */
const wallEvery = 5.8
/** How far into a round the gatehouse stands. */
const gateAt = 6

/** What ninjas hide behind in the castle grounds: supplies by the way, and boulders ([cover](./cover.mts)). */
export const castleCover: CoverSet = {
	kinds: ['crates', 'barrels', 'rock'],
	aside: pathHalfWidth + 1.6,
	colours: { crates: [0x8a6a46, 0x7a5a3a], barrels: [0x5a4030, 0x6a4a30], rock: [0x8d877b, 0x7a756c], palanquin: [0x2a1e1a, 0x6e1f0f] },
}

/**
 * The castle's four districts ([districts](./districts.mts)), beyond the walls
 * ([backdrop](./backdrop.mts)): the retainers' quarter, the castle gardens, the pine walk and the
 * keep's approach.
 */
export const castleDistricts: readonly District[] = [
	{
		name: "Retainers' quarter",
		rows: [
			// Right behind the walls and the moat, pines and the first roofs, so no lawn lies bare.
			{ shape: 'pine', from: 22, to: 40, perTile: 4, colours: [[0x3a2e26], [0x2a3e2a, 0x30482e]] },
			{ shape: 'house', from: 26, to: 50, perTile: 2, colours: [[0xeae4d4, 0xddd5c2], [0x2e3036, 0x34404f]] },
			{ shape: 'pine', from: 40, to: 120, perTile: 4, colours: [[0x3a2e26], [0x2a3e2a, 0x30482e]] },
			{ shape: 'broadleaf', from: 45, to: 135, perTile: 1.6, colours: [[0x3a2e26], [0x3e5430, 0x4a5a2e, 0x8e3a24]] },
		],
	},
	{
		name: 'Castle gardens',
		cover: [{ kind: 'palanquin' }, { kind: 'rock' }],
		rows: [
			{ shape: 'pine', from: 22, to: 34, perTile: 2.5, colours: [[0x3a2e26], [0x2a3e2a, 0x30482e]] },
			{ shape: 'bridge', from: 32, to: 60, perTile: 0.6, colours: [[0x2d4a5a], [0xa8261c], [0xa8261c]] },
			{ shape: 'pond', from: 34, to: 70, perTile: 0.6, colours: [[0x2d4a5a, 0x34566a]] },
			{ shape: 'broadleaf', from: 32, to: 90, perTile: 2, colours: [[0x3a2e26], [0xb8402a, 0xd0602e, 0x4a5a2e]] },
			{ shape: 'pine', from: 60, to: 120, perTile: 2, colours: [[0x3a2e26], [0x2a3e2a, 0x30482e]] },
		],
	},
	{
		name: 'Pine walk',
		cover: [{ kind: 'palanquin' }, { kind: 'crates' }],
		rows: [
			{ shape: 'lantern', from: pathHalfWidth + 0.6, to: pathHalfWidth + 0.9, perTile: 0.6, colours: [[0x8d877b, 0x9a958a], [0x8d877b, 0x7a756c]] },
			{ shape: 'pine', from: 22, to: 120, perTile: 6, colours: [[0x3a2e26], [0x2a3e2a, 0x30482e]] },
		],
	},
	{
		name: "Keep's approach",
		rows: [
			{ shape: 'pine', from: 22, to: 32, perTile: 2.5, colours: [[0x3a2e26], [0x2a3e2a, 0x30482e]] },
			{ shape: 'wall', from: 32, to: 48, perTile: 1.4, colours: [[0x8d877b, 0x7a756c], [0xeae4d4, 0xddd5c2], [0x2e3036, 0x34404f]] },
			{ shape: 'pagoda', from: 60, to: 130, perTile: 0.2, colours: [[0xeae4d4], [0x2e3036, 0x34404f]] },
			{ shape: 'pine', from: 48, to: 120, perTile: 2, colours: [[0x3a2e26], [0x2a3e2a, 0x30482e]] },
		],
	},
]

/** Which side the moat is on at `distance`: `1` right, `-1` left, `0` none. Down two straights a round. */
export function moatSide(distance: number): -1 | 0 | 1 {
	const along = ((distance % roundLength) + roundLength) % roundLength
	if (along > 88 && along < 132) return 1
	if (along > 163 && along < 207) return -1
	return 0
}

export type CastleModels = Partial<{
	/** Our stage kit: `CastleWall`, `CastleGate`, `CastleKeep`, `Pine`. */
	readonly kit: GLTF
	/** The temple kit: `StoneLantern`. */
	readonly temple: GLTF
}>

/** How tall `model` stands, so a model made to size is stamped at its own size. */
function heightOf(model: Object3D): number {
	model.updateMatrixWorld(true)
	const bounds = new Box3().setFromObject(model)
	return bounds.max.y - bounds.min.y
}

/** What an Edo-castle block places once the models are in. */
type CastlePending = {
	readonly gates: Planting[]
	readonly walls: Planting[]
	readonly keeps: Planting[]
	readonly pines: Planting[]
	readonly lanterns: Planting[]
}

/** Metres a pine reaches along the path from where it stands. */
const pineReach = 2

export function createEdoCastle(scene: Scene, path: Path, models: Promise<CastleModels>): StageView {
	const [first] = daylight
	const fog = new Fog(first.fog, 30, fogFar)
	scene.fog = fog
	const owned: Owned = { geometries: [], materials: [], textures: [] }
	const backdrop = sky(owned, first.skyTop, first.skyHorizon)
	scene.add(backdrop)

	const ambient = new HemisphereLight(first.ambient.sky, first.ambient.ground, first.ambient.intensity)
	scene.add(ambient)
	// A low sun, warm and long-shadowed.
	const sun = new DirectionalLight(first.sun.colour, first.sun.intensity)
	sun.castShadow = true
	sun.shadow.mapSize.set(1024, 1024)
	for (const side of ['left', 'bottom'] as const) sun.shadow.camera[side] = -18
	for (const side of ['right', 'top'] as const) sun.shadow.camera[side] = 18
	sun.shadow.camera.near = 1
	sun.shadow.camera.far = 80
	sun.shadow.bias = -0.0008
	scene.add(sun, sun.target)
	const sunFrom = { x: -26, y: 22, z: 10 }

	const groundGeometry = new CircleGeometry(skyRadius, 32).rotateX(-Math.PI / 2)
	const groundMaterial = new MeshStandardMaterial({ color: palette.lawn, roughness: 1 })
	owned.geometries.push(groundGeometry)
	owned.materials.push(groundMaterial)
	const ground = new Mesh(groundGeometry, groundMaterial)
	ground.receiveShadow = true
	scene.add(ground)

	const gravel = new Color(palette.gravel)
	const water = new BoxGeometry(1, 1, 1)
	const waterMaterial = new MeshStandardMaterial({ color: palette.water, roughness: 0.15, metalness: 0.4 })
	owned.geometries.push(water)
	owned.materials.push(waterMaterial)

	// The grounds, a round of the path at a time ([blocks](./blocks.mts)).
	const blocks = layBlocks<CastlePending>(path, (from, to, base) => {
		const group = new Group()
		group.add(strip(path, from, to, owned, { half: () => pathHalfWidth, colour: () => gravel, y: 0.03 }))

		const cursor: Cursor = { chunk: 0 }
		const clear = clearanceOf(path, from - 60, to + 60)
		const taken: Taken = []
		const pending: CastlePending = { gates: [], walls: [], keeps: [], pines: [], lanterns: [] }

		// A gatehouse across the way at the start of every round: this block's, and the next one's
		// just past its end, which the walls keep clear of too.
		const gatehouse = path.at(from + gateAt)
		pending.gates.push({ matrix: placed(gatehouse.x, 0, gatehouse.z, gatehouse.heading), chunk: chunkOf(from + gateAt) })
		const nearGate = (distance: number) => [from + gateAt, to + gateAt].some((entrance) => Math.abs(entrance - distance) < 7)

		// Walls either side, but along a moat the near wall gives way to water, with a wall beyond it.
		const moat = new Batch(water, waterMaterial, cursor, { receive: true })
		for (let distance = from; distance < to; distance += wallEvery) {
			if (nearGate(distance)) continue
			const point = path.at(distance)
			cursor.chunk = chunkOf(distance)
			const moatOn = moatSide(distance)
			for (const side of [-1, 1]) {
				const foot = side === moatOn ? wallFoot + 9 : wallFoot
				const at = beside(point, side * (foot + wallFront))
				if (!clear(at.x, at.z, distance, foot + wallFront - 0.5, 20)) continue
				pending.walls.push({ matrix: placed(at.x, 0, at.z, facingPath(point, side)), chunk: cursor.chunk })
				if (side === moatOn) {
					const middle = beside(point, side * (wallFoot + 4))
					moat.add(placed(middle.x, 0.02, middle.z, point.heading, 8.6, 0.05, wallEvery + 0.4))
				}
			}
		}

		// The keep, rising over the walls off to one side ahead; pines behind the walls.
		const keepAt = from + 75
		const keepBy = path.at(keepAt)
		const keepSide = scatter(base) > 0.5 ? 1 : -1
		const keep = beside(keepBy, keepSide * 48)
		if (clear(keep.x, keep.z, keepAt, 30, 80)) {
			pending.keeps.push({ matrix: placed(keep.x, 0, keep.z, facingPath(keepBy, keepSide)), chunk: chunkOf(keepAt) })
			taken.push({ x: keep.x, z: keep.z, radius: 22 })
		}
		for (let distance = from, index = base; distance < to; distance += 9, index++) {
			const point = path.at(distance)
			for (const side of [-1, 1]) {
				const seed = index * 13 + side
				if (scatter(seed) < 0.45) continue
				const out = (side === moatSide(distance) ? wallFoot + 14 : wallFoot + 5) + scatter(seed + 1) * 10
				const along = (scatter(seed + 2) - 0.5) * 5
				// Within the block, with room for the pine.
				if (distance + along - pineReach < from || distance + along + pineReach > to) continue
				const at = beside(point, side * out, along)
				if (!clear(at.x, at.z, distance, wallFoot + 4, 24) || !isFree(taken, at.x, at.z, 2)) continue
				pending.pines.push({ matrix: placed(at.x, 0, at.z, scatter(seed + 3) * 6.28, 0.9 + scatter(seed + 4) * 0.5), chunk: chunkOf(distance) })
				taken.push({ x: at.x, z: at.z, radius: 2 })
			}
		}

		// Stone lanterns in pairs along the way, now and then, but not where an ambush's covers stand.
		for (let distance = from + 30; distance + 1.2 <= to; distance += 45) {
			if (nearGate(distance) || nearAmbushCover(distance, metresPerAmbush)) continue
			const point = path.at(distance)
			for (const side of [-1, 1]) {
				const at = beside(point, side * (pathHalfWidth + 1.2))
				pending.lanterns.push({ matrix: placed(at.x, 0, at.z, facingPath(point, side)), chunk: chunkOf(distance) })
			}
		}

		addAll(group, moat.build())
		return { group, pending }
	})
	scene.add(blocks.group)

	// How near the camera the gatehouses are cut away, in view depth; set every frame.
	const cut = { value: 0 }
	const samurai = new Vector3()

	let disposed = false
	void models.then((loaded) => {
		if (disposed) return
		const kit = loaded.kit?.scene
		const wall = kit?.getObjectByName('CastleWall')
		const gate = kit?.getObjectByName('CastleGate')
		const keep = kit?.getObjectByName('CastleKeep')
		const pine = kit?.getObjectByName('Pine')
		const lantern = loaded.temple?.scene.getObjectByName('StoneLantern')
		for (const { group, pending } of blocks.laid) {
			if (wall !== undefined) addAll(group, stamp(wall, pending.walls, heightOf(wall), true, owned))
			if (gate !== undefined) {
				const made = stamp(gate, pending.gates, heightOf(gate), true, owned)
				for (const mesh of made) cutAway(mesh.material as Material, cut)
				addAll(group, made)
			}
			if (keep !== undefined) addAll(group, stamp(keep, pending.keeps, heightOf(keep), false, owned))
			if (pine !== undefined) addAll(group, stamp(pine, pending.pines, heightOf(pine), true, owned))
			if (lantern !== undefined) addAll(group, stamp(lantern, pending.lanterns, heightOf(lantern), true, owned))
		}
	}).catch((error: unknown) => {
		console.warn('[bunbu] Edo castle\'s models could not be read; the grounds stand without them', error)
	})

	return {
		passTime: passTime({ scene, fog, backdrop, ambient, sun }, daylight),

		frame(camera, x, z) {
			// The samurai's depth in view, less a little, so the gate he is passing under still shows.
			cut.value = Math.max(0, -samurai.set(x, 1, z).applyMatrix4(camera.matrixWorldInverse).z - 3)
		},

		follow(x, z, distance) {
			blocks.follow(distance)
			ground.position.set(x, 0, z)
			backdrop.position.set(x, 0, z)
			sun.position.set(x + sunFrom.x, sunFrom.y, z + sunFrom.z)
			sun.target.position.set(x, 0, z)
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
