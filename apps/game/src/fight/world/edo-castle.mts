/**
 * Edo castle ([stages](../../../../../docs/design/screens.md#2-fight-setup)) at sunset: a gravel way
 * between curving stone walls under white plastered walls, through gatehouses, along a moat with a
 * turret on its far corners, with pines behind the walls and the keep rising over everything. The
 * last stage, and the grandest.
 *
 * Laid out when the run starts as a few blocks of a round of the path each, stitched together
 * ahead of the samurai for as long as the run goes ([blocks](./blocks.mts)), in stretches of path
 * that are each their own `InstancedMesh`. The walls, gates, turrets, keep and pines are from our
 * stage kit (`assets/blender/stage_kit.py`), the lanterns from the temple kit; the grounds stand
 * without them until they are in.
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
	type Object3D,
	type Scene,
} from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { blockVariants, layBlocks } from './blocks.mts'
import { districtAt } from './districts.mts'
import { Batch, chunkOf, placed, scatter, type Cursor } from './kit.mts'
import { addAll, castShadows, clearanceOf, facingPath, fading, followSun, fogFar, isFree, passTime, sky, skyRadius, stamp, strip, type Daylight, type Owned, type Planting, type StageView, type Taken } from './landscape.mts'
import type { District } from './backdrop.mts'
import { nearAmbushCover, type CoverSet } from './cover.mts'
import { metresPerAmbush } from '../flows/run.mts'
import { beside, type Leg, type Path } from './path.mts'

const palette = {
	lawn: 0x56603a,
	gravel: 0xb8ad98,
	water: 0x4f7a8a,
	kerb: 0x8d877b,
	plaster: 0xeae4d4,
	tiles: 0x2e3036,
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
/** How wide the moat is, and how wide and high the stone kerb around it. */
const moatWidth = 8.6
const kerbWidth = 0.4
const kerbHeight = 0.25
/** How far into a round the gatehouse stands. */
const gateAt = 6

/** What ninjas hide behind in the castle grounds: supplies by the way, and boulders ([cover](./cover.mts)). */
export const castleCover: CoverSet = {
	kinds: ['crates', 'barrels', 'rock'],
	aside: pathHalfWidth + 1.6,
	colours: { crates: [0x8a6a46, 0x7a5a3a], barrels: [0x5a4030, 0x6a4a30], rock: [0x8d877b, 0x7a756c], palanquin: [0x2a1e1a, 0x6e1f0f], guard: [0x2f3a44, 0x6e1f0f], 'weapon-rack': [0x6e1f0f, 0x2f4a7a, 0x2a1e1a] },
}

/**
 * The castle's four districts ([districts](./districts.mts)), beyond the walls
 * ([backdrop](./backdrop.mts)): the retainers' quarter, the castle gardens, the pine walk and the
 * keep's approach.
 */
export const castleDistricts: readonly District[] = [
	{
		name: "Retainers' quarter",
		cover: [{ kind: 'weapon-rack' }, { kind: 'guard', ambush: 0.3, decoy: 1.5 }, { kind: 'crates' }],
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
		cover: [{ kind: 'guard', ambush: 0.3, decoy: 1.5 }, { kind: 'palanquin' }, { kind: 'rock' }],
		rows: [
			// In front of the keep that stands close by here, and the inner walls beyond it.
			{ shape: 'pine', from: 16, to: 22, perTile: 2.5, colours: [[0x3a2e26], [0x2a3e2a, 0x30482e]] },
			{ shape: 'wall', from: 56, to: 72, perTile: 1.4, colours: [[0x8d877b, 0x7a756c], [0xeae4d4, 0xddd5c2], [0x2e3036, 0x34404f]] },
			{ shape: 'pagoda', from: 75, to: 130, perTile: 0.2, colours: [[0xeae4d4], [0x2e3036, 0x34404f]] },
			{ shape: 'pine', from: 48, to: 120, perTile: 2, colours: [[0x3a2e26], [0x2a3e2a, 0x30482e]] },
		],
	},
]

/** How the way is walled on one side: high stone walls, a low plastered garden wall, or not at all. */
export type Way = 'high' | 'low' | 'open'

/**
 * How {@link castleDistricts}' district `district` walls the way on `side`, with the keep on
 * `keepSide`: high walls round the retainers' quarter, low garden walls through the gardens, none on
 * the pine walk, and on the keep's approach a low wall on the keep's side, so it rises close by.
 */
export function wayOf(district: number, side: number, keepSide: number): Way {
	if (district === 1) return 'low'
	if (district === 2) return 'open'
	if (district === 3 && side === keepSide) return 'low'
	return 'high'
}

/** How far off the way the keep stands, in each district: close by on the keep's approach. */
const keepOff = [48, 48, 48, 36] as const

/** Which side the moat is on at `distance`: `1` right, `-1` left, `0` none. Down two straights a round. */
export function moatSide(distance: number): -1 | 0 | 1 {
	const along = ((distance % roundLength) + roundLength) % roundLength
	if (along > 88 && along < 132) return 1
	if (along > 163 && along < 207) return -1
	return 0
}

export type CastleModels = Partial<{
	/** Our stage kit: `CastleWall`, `CastleGate`, `CastleKeep`, `CastleTurret`, `Pine`. */
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

/** What an Edo-castle block places in one district only, shown while it is run through that district. */
type DistrictPending = {
	readonly group: Group
	readonly walls: Planting[]
	readonly keeps: Planting[]
}

/** What an Edo-castle block places once the models are in: in every district, and in each its own. */
type CastlePending = {
	readonly gates: Planting[]
	readonly walls: Planting[]
	readonly districts: readonly DistrictPending[]
	readonly turrets: Planting[]
	readonly pines: Planting[]
	readonly lanterns: Planting[]
}

/** A low garden wall (tsuiji-bei) a wall piece long at `at`, along `heading`: a stone footing, a white wall, tiles on top. */
function lowWallAt(walls: Batch | undefined, at: { x: number; z: number }, heading: number): void {
	const length = wallEvery + 0.1
	walls?.add(placed(at.x, 0.2, at.z, heading, 0.8, 0.4, length), palette.kerb)
	walls?.add(placed(at.x, 1, at.z, heading, 0.5, 1.2, length), palette.plaster)
	walls?.add(placed(at.x, 1.69, at.z, heading, 0.9, 0.18, length), palette.tiles)
}

/** Metres a pine reaches along the path from where it stands. */
const pineReach = 2

/**
 * Lays out Edo castle along `path`, district after district along a stage of `stageLength()` metres
 * ([districts](./districts.mts)): a block takes the walls of the district its round is mostly in, so
 * the way changes at a gatehouse.
 */
export function createEdoCastle(scene: Scene, path: Path, models: Promise<CastleModels>, stageLength: () => number): StageView {
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
	castShadows(sun)
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
	const box = new BoxGeometry(1, 1, 1)
	// Not metal: with nothing around to reflect, metal water only comes out black.
	const waterMaterial = new MeshStandardMaterial({ color: palette.water, roughness: 0.2 })
	const kerbMaterial = new MeshStandardMaterial({ color: palette.kerb, roughness: 1 })
	// Coloured per part: the stone footing, the white wall, the tiles on top.
	const lowWallMaterial = new MeshStandardMaterial({ roughness: 0.95 })
	owned.geometries.push(box)
	owned.materials.push(waterMaterial, kerbMaterial, lowWallMaterial)

	// The grounds, a round of the path at a time ([blocks](./blocks.mts)).
	const blocks = layBlocks<CastlePending>(path, (from, to, base) => {
		const group = new Group()
		group.add(strip(path, from, to, owned, { half: () => pathHalfWidth, colour: () => gravel, y: 0.03 }))

		const cursor: Cursor = { chunk: 0 }
		const clear = clearanceOf(path, from - 60, to + 60)
		const taken: Taken = []
		const districts = castleDistricts.map((_, index): DistrictPending => {
			const shown = new Group()
			shown.visible = index === 0
			group.add(shown)
			return { group: shown, walls: [], keeps: [] }
		})
		const pending: CastlePending = { gates: [], walls: [], districts, turrets: [], pines: [], lanterns: [] }
		const lowWalls = districts.map(() => new Batch(box, lowWallMaterial, cursor, { cast: true, receive: true }))
		const keepSide = scatter(base) > 0.5 ? 1 : -1

		// A gatehouse across the way at the start of every round: this block's, and the next one's
		// just past its end, which the walls keep clear of too.
		const gatehouse = path.at(from + gateAt)
		pending.gates.push({ matrix: placed(gatehouse.x, 0, gatehouse.z, gatehouse.heading), chunk: chunkOf(from + gateAt) })
		const nearGate = (distance: number) => [from + gateAt, to + gateAt].some((entrance) => Math.abs(entrance - distance) < 7)

		// Walls either side as each district has them, but along a moat the near wall gives way to
		// water, with a wall beyond it in every district, and a stone kerb along the way.
		const moat = new Batch(box, waterMaterial, cursor, { receive: true })
		const kerbs = new Batch(box, kerbMaterial, cursor, { cast: true, receive: true })
		for (let distance = from; distance < to; distance += wallEvery) {
			if (nearGate(distance)) continue
			const point = path.at(distance)
			cursor.chunk = chunkOf(distance)
			const moatOn = moatSide(distance)
			for (const side of [-1, 1]) {
				const foot = side === moatOn ? wallFoot + 9 : wallFoot
				const at = beside(point, side * (foot + wallFront))
				if (!clear(at.x, at.z, distance, foot + wallFront - 0.5, 20)) continue
				if (side !== moatOn) {
					districts.forEach((district, index) => {
						const way = wayOf(index, side, keepSide)
						if (way === 'high') district.walls.push({ matrix: placed(at.x, 0, at.z, facingPath(point, side)), chunk: cursor.chunk })
						if (way === 'low') lowWallAt(lowWalls[index], beside(point, side * (wallFoot + 0.3)), point.heading)
					})
				}
				if (side === moatOn) {
					pending.walls.push({ matrix: placed(at.x, 0, at.z, facingPath(point, side)), chunk: cursor.chunk })
					const middle = beside(point, side * (wallFoot + 4))
					moat.add(placed(middle.x, 0.02, middle.z, point.heading, moatWidth, 0.05, wallEvery + 0.4))
					const edge = beside(point, side * (wallFoot - 0.3))
					kerbs.add(placed(edge.x, 0, edge.z, point.heading, kerbWidth, kerbHeight * 2, wallEvery + 0.4))
					// Where the moat ends, a wall across it from the near wall to a corner turret on the far one.
					for (const end of [-1, 1]) {
						if (moatSide(distance + end * wallEvery) === moatOn) continue
						const across = beside(point, side * (wallFoot + 3.5), end * ((wallEvery + 0.4) / 2 + wallFront))
						pending.walls.push({ matrix: placed(across.x, 0, across.z, point.heading + (end < 0 ? Math.PI : 0)), chunk: cursor.chunk })
						const corner = beside(point, side * (foot + 1), end * (wallEvery + 0.4) / 2)
						pending.turrets.push({ matrix: placed(corner.x, 0, corner.z, point.heading), chunk: cursor.chunk })
					}
				}
			}
		}

		// The keep, rising over the walls off to one side ahead; pines behind the walls.
		const keepAt = from + 75
		const keepBy = path.at(keepAt)
		for (const off of new Set(keepOff)) {
			const keep = beside(keepBy, keepSide * off)
			if (!clear(keep.x, keep.z, keepAt, off - 18, 80)) continue
			districts.forEach((district, index) => {
				if (keepOff[index] === off) district.keeps.push({ matrix: placed(keep.x, 0, keep.z, facingPath(keepBy, keepSide)), chunk: chunkOf(keepAt) })
			})
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
		addAll(group, kerbs.build())
		districts.forEach((district, index) => {
			addAll(district.group, lowWalls[index]?.build() ?? [])
		})
		return { group, pending }
	}, blockVariants, ({ pending }, from) => {
		// The district the round is mostly in.
		const { from: leaving, to: coming, mix } = districtAt(from + roundLength / 2, stageLength())
		const shown = mix < 0.5 ? leaving : coming
		pending.districts.forEach((district, index) => {
			district.group.visible = index === shown
		})
	})
	scene.add(blocks.group)

	let disposed = false
	void models.then((loaded) => {
		if (disposed) return
		const kit = loaded.kit?.scene
		const wall = kit?.getObjectByName('CastleWall')
		const gate = kit?.getObjectByName('CastleGate')
		const keep = kit?.getObjectByName('CastleKeep')
		const turret = kit?.getObjectByName('CastleTurret')
		const pine = kit?.getObjectByName('Pine')
		const lantern = loaded.temple?.scene.getObjectByName('StoneLantern')
		for (const { group, pending } of blocks.laid) {
			if (wall !== undefined) addAll(group, stamp(wall, pending.walls, heightOf(wall), true, owned))
			for (const district of pending.districts) {
				if (wall !== undefined) addAll(district.group, stamp(wall, district.walls, heightOf(wall), true, owned))
				if (keep !== undefined) addAll(district.group, stamp(keep, district.keeps, heightOf(keep), false, owned))
			}
			if (gate !== undefined) addAll(group, fading(stamp(gate, pending.gates, heightOf(gate), true, owned)))
			if (turret !== undefined) addAll(group, stamp(turret, pending.turrets, heightOf(turret), true, owned))
			if (pine !== undefined) addAll(group, stamp(pine, pending.pines, heightOf(pine), true, owned))
			if (lantern !== undefined) addAll(group, stamp(lantern, pending.lanterns, heightOf(lantern), true, owned))
		}
	}).catch((error: unknown) => {
		console.warn('[bunbu] Edo castle\'s models could not be read; the grounds stand without them', error)
	})

	return {
		passTime: passTime({ scene, fog, backdrop, ambient, sun }, daylight),

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
