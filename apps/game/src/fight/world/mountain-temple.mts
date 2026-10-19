/**
 * Mountain temple ([stages](../../../../../docs/design/screens.md#2-fight-setup)) on a clear
 * afternoon high up: stone steps climbing between black pines and rocks, long tunnels of red torii
 * the path runs through, the temple hall and its pagoda on the slopes, and snow on the peaks all round.
 *
 * Laid out when the run starts as a few blocks of a round of the path each, stitched together
 * ahead of the samurai for as long as the run goes ([blocks](./blocks.mts)), in stretches of path
 * that are each their own `InstancedMesh`. The torii, hall, pagoda and lanterns are from the
 * temple kit, the pines from our stage kit; the slopes stand without them until they are in.
 */

import {
	Box3,
	CircleGeometry,
	Color,
	ConeGeometry,
	DirectionalLight,
	DodecahedronGeometry,
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
import { addAll, castsShadows, followSun, clearanceOf, fadeNear, facingPath, fogFar, isFree, passTime, sky, skyRadius, stamp, strip, type Daylight, type Owned, type Planting, type StageView, type Taken } from './landscape.mts'
import type { District } from './backdrop.mts'
import type { CoverSet } from './cover.mts'
import { beside, type Leg, type Path } from './path.mts'

const palette = {
	ground: 0x6a6f4c,
	step: 0xa39e93,
	stepEdge: 0x86817a,
	rock: 0x8a8780,
	/** Near peaks to far, and the snow on them. */
	peaks: [0x6e7a86, 0x8a96a4, 0xa8b3c0],
	snow: 0xf4f6fa,
}

/** From a clear noon to the glow on the snow at sunset. One light per quarter of the stage ({@link passTime}). */
const daylight: Daylight = [
	{
		skyTop: 0x3b6cb0,
		skyHorizon: 0xe6edf2,
		fog: 0xc6d0d8,
		ambient: { sky: 0xe4ecff, ground: 0x5a5440, intensity: 2.2 },
		sun: { colour: 0xfff4e0, intensity: 2.8 },
		lamps: 0,
	},
	{
		skyTop: 0x3a66a8,
		skyHorizon: 0xeee8e0,
		fog: 0xc8ccd0,
		ambient: { sky: 0xe6e8f8, ground: 0x5a5440, intensity: 2.2 },
		sun: { colour: 0xffead0, intensity: 2.7 },
		lamps: 0,
	},
	{
		skyTop: 0x385a98,
		skyHorizon: 0xf2d6bc,
		fog: 0xc8c0bc,
		ambient: { sky: 0xe8dcec, ground: 0x58503e, intensity: 2.1 },
		sun: { colour: 0xffd0a0, intensity: 2.5 },
		lamps: 0,
	},
	{
		skyTop: 0x2e4680,
		skyHorizon: 0xf0a898,
		fog: 0xb8a4ac,
		ambient: { sky: 0xdcc4e0, ground: 0x4c4438, intensity: 2.0 },
		sun: { colour: 0xffa888, intensity: 2.2 },
		lamps: 0,
	},
]

/** Long straights for the torii tunnels, joined by turns as much left as right. */
export const mountainRound: readonly Leg[] = [
	{ length: 55, turn: 0, zone: 'garden' },
	{ length: 30, turn: 1.1, zone: 'garden' },
	{ length: 40, turn: 0, zone: 'garden' },
	{ length: 30, turn: -2.2, zone: 'garden' },
	{ length: 40, turn: 0, zone: 'garden' },
	{ length: 30, turn: 1.1, zone: 'garden' },
	{ length: 35, turn: 0, zone: 'garden' },
]

const roundLength = mountainRound.reduce((sum, leg) => sum + leg.length, 0)

/** Half the width of the stone steps. */
const pathHalfWidth = 1.6

/** What ninjas hide behind on the mountain: boulders by the steps ([cover](./cover.mts)). */
export const mountainCover: CoverSet = {
	kinds: ['rock', 'rock', 'barrels'],
	aside: pathHalfWidth + 1.5,
	colours: { rock: [palette.rock, 0x7a776f, 0x96938b], barrels: [0x5a4030], woodpile: [0x6a4a30, 0x7a5236], 'stone-lantern': [0x8d877b, 0x9a958a] },
}

/**
 * The mountain's four districts ([districts](./districts.mts)), up and down the mountainside past
 * the rocks ([backdrop](./backdrop.mts)): the foothill pines, the rock garden, the pagoda terrace
 * and the snowy heights.
 */
export const mountainDistricts: readonly District[] = [
	{
		name: 'Foothill pines',
		cover: [{ kind: 'woodpile' }, { kind: 'rock' }],
		rows: [
			// Close behind the rocks, so the slope is wooded right up to the steps' own pines.
			{ shape: 'pine', from: 24, to: 45, perTile: 4.5, colours: [[0x4a3a2c], [0x2f4a32, 0x355238, 0x3a5a3c]] },
			{ shape: 'pine', from: 45, to: 130, perTile: 3.5, colours: [[0x4a3a2c], [0x2f4a32, 0x355238, 0x3a5a3c]] },
			{ shape: 'broadleaf', from: 28, to: 110, perTile: 1.6, colours: [[0x4a3a2c], [0x4a6634, 0x8e5a2a, 0xb8402a]] },
			// The mountainside rising behind them.
			{ shape: 'hill', from: 70, to: 130, perTile: 0.5, colours: [[0x6a6f4c, 0x5e6446, 0x76795a]] },
		],
	},
	{
		name: 'Rock garden',
		cover: [{ kind: 'stone-lantern' }, { kind: 'rock' }],
		rows: [
			{ shape: 'pine', from: 24, to: 40, perTile: 2.5, colours: [[0x4a3a2c], [0x2f4a32, 0x355238]] },
			{ shape: 'hill', from: 70, to: 130, perTile: 0.5, colours: [[0x6a6f4c, 0x5e6446, 0x76795a]] },
			{ shape: 'rock', from: 30, to: 80, perTile: 2.5, colours: [[palette.rock, 0x7a776f, 0x96938b]] },
			{ shape: 'lantern', from: pathHalfWidth + 1, to: pathHalfWidth + 1.6, perTile: 0.5, colours: [[0x8d877b, 0x9a958a], [0x8d877b, 0x7a756c]] },
			{ shape: 'pine', from: 40, to: 130, perTile: 1.5, colours: [[0x4a3a2c], [0x2f4a32, 0x355238]] },
		],
	},
	{
		name: 'Pagoda terrace',
		cover: [{ kind: 'temple-bell', ambush: 0.7 }, { kind: 'barrels' }, { kind: 'rock' }],
		rows: [
			{ shape: 'pine', from: 24, to: 40, perTile: 2.5, colours: [[0x4a3a2c], [0x2f4a32, 0x355238]] },
			{ shape: 'hill', from: 70, to: 130, perTile: 0.5, colours: [[0x6a6f4c, 0x5e6446, 0x76795a]] },
			{ shape: 'pagoda', from: 45, to: 100, perTile: 0.15, colours: [[0xa8261c, 0x8e2a22], [0x2a2a2e, 0x34404f]] },
			{ shape: 'broadleaf', from: 32, to: 90, perTile: 1.2, colours: [[0x4a3a2c], [0xb8402a, 0xd0602e]] },
			{ shape: 'pine', from: 32, to: 130, perTile: 2.5, colours: [[0x4a3a2c], [0x2f4a32, 0x355238]] },
		],
	},
	{
		name: 'Snowy heights',
		rows: [
			{ shape: 'pine', from: 24, to: 40, perTile: 2.5, colours: [[0x4a3a2c], [0x2f4a32, 0x355238]] },
			{ shape: 'hill', from: 70, to: 130, perTile: 0.5, colours: [[0x6a6f4c, 0x5e6446, 0x76795a]] },
			{ shape: 'pine', from: 32, to: 130, perTile: 3, colours: [[0x4a3a2c], [0xe8eef4, 0xd4dde6, 0x3a5a3c]] },
			{ shape: 'rock', from: 30, to: 90, perTile: 1.5, colours: [[palette.snow, 0xd8dee6, palette.rock]] },
		],
	},
]

/** The torii of a tunnel: how far apart, and how tall, so their posts stand just off the steps. */
const toriiEvery = 2.4
const toriiHeight = 3.9

/** Whether `distance` is in one of a round's torii tunnels: down its first long straight, and its last. */
export function inTunnel(distance: number): boolean {
	const along = ((distance % roundLength) + roundLength) % roundLength
	return (along > 6 && along < 50) || (along > roundLength - 32 && along < roundLength - 4)
}

export type MountainModels = Partial<{
	/** The temple kit: `Torii`, `Hall`, `Pagoda`, `StoneLantern`. */
	readonly temple: GLTF
	/** Our stage kit: `Pine`. */
	readonly kit: GLTF
}>

/** How tall `model` stands, so a model made to size is stamped at its own size. */
function heightOf(model: Object3D): number {
	model.updateMatrixWorld(true)
	const bounds = new Box3().setFromObject(model)
	return bounds.max.y - bounds.min.y
}

/** What a mountain-temple block places once the models are in. */
type MountainPending = {
	readonly torii: Planting[]
	readonly lanterns: Planting[]
	readonly halls: Planting[]
	readonly pagodas: Planting[]
	readonly pines: Planting[]
}

/** Metres a pine, or the biggest rock, reaches along the path from where it stands. */
const slopeReach = 2.5

export function createMountainTemple(scene: Scene, path: Path, models: Promise<MountainModels>): StageView {
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
	const sunFrom = { x: 18, y: 34, z: 16 }

	const groundGeometry = new CircleGeometry(skyRadius, 32).rotateX(-Math.PI / 2)
	const groundMaterial = new MeshStandardMaterial({ color: palette.ground, roughness: 1 })
	owned.geometries.push(groundGeometry)
	owned.materials.push(groundMaterial)
	const ground = new Mesh(groundGeometry, groundMaterial)
	ground.receiveShadow = true
	scene.add(ground)

	// Snowy peaks all round, far off: they go where the samurai goes, so they never come nearer.
	const peaks = new Group()
	const cone = new ConeGeometry(1, 1, 7).translate(0, 0.5, 0)
	owned.geometries.push(cone)
	const snowMaterial = new MeshStandardMaterial({ color: palette.snow, roughness: 0.9, flatShading: true, fog: false })
	owned.materials.push(snowMaterial)
	for (let index = 0; index < 24; index++) {
		const layer = index % 3
		const material = new MeshStandardMaterial({ color: palette.peaks[layer] ?? 0x8a96a4, roughness: 1, flatShading: true, fog: false })
		owned.materials.push(material)
		const angle = (index / 24) * Math.PI * 2 + scatter(index) * 0.2
		const distance = skyRadius * (0.72 + layer * 0.1)
		const height = 24 + scatter(index + 40) * 30 + layer * 6
		const width = height * (1.3 + scatter(index + 60) * 0.4)
		const peak = new Mesh(cone, material)
		peak.position.set(Math.sin(angle) * distance, -2, Math.cos(angle) * distance)
		peak.scale.set(width, height, width * 0.8)
		peak.rotation.y = scatter(index + 80) * Math.PI
		const cap = new Mesh(cone, snowMaterial)
		cap.position.set(0, 0.62, 0)
		cap.scale.set(0.4, 0.38, 0.4)
		peak.add(cap)
		peaks.add(peak)
	}
	scene.add(peaks)

	// Where the torii fade near the camera, in view depth: at the samurai's own, set every frame.
	const near = { value: 0 }
	const samurai = new Vector3()

	// Stone steps: the path in bands of stone, each edge darker, a step a metre.
	const step = new Color(palette.step)
	const edge = new Color(palette.stepEdge)
	const rockGeometry = new DodecahedronGeometry(1, 0)
	const rockMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true })
	owned.geometries.push(rockGeometry)
	owned.materials.push(rockMaterial)

	// The slopes, a round of the path at a time ([blocks](./blocks.mts)).
	const blocks = layBlocks<MountainPending>(path, (from, to, base) => {
		const group = new Group()
		group.add(strip(path, from, to, owned, { half: () => pathHalfWidth, colour: (distance) => (Math.floor(distance) % 2 === 0 ? step : edge), y: 0.04 }))

		const cursor: Cursor = { chunk: 0 }
		const clear = clearanceOf(path, from - 60, to + 60)
		const taken: Taken = []
		const pending: MountainPending = { torii: [], lanterns: [], halls: [], pagodas: [], pines: [] }

		// The torii tunnels, square across the steps, and a pair of lanterns where each one begins.
		let wasTunnel = false
		for (let distance = from; distance < to; distance += toriiEvery) {
			const tunnel = inTunnel(distance)
			const point = path.at(distance)
			if (tunnel) pending.torii.push({ matrix: placed(point.x, 0, point.z, point.heading), chunk: chunkOf(distance) })
			if (tunnel && !wasTunnel) {
				for (const side of [-1, 1]) {
					const at = beside(point, side * (pathHalfWidth + 1.4), 2)
					pending.lanterns.push({ matrix: placed(at.x, 0, at.z, facingPath(point, side)), chunk: chunkOf(distance) })
				}
			}
			wasTunnel = tunnel
		}

		// The temple on the slopes: a hall and its pagoda, set back from the path, on either side.
		const templeAt = from + 90
		const temple = path.at(templeAt)
		const templeSide = scatter(base) > 0.5 ? 1 : -1
		const hall = beside(temple, templeSide * 42)
		if (clear(hall.x, hall.z, templeAt, 26, 60)) {
			pending.halls.push({ matrix: placed(hall.x, 0, hall.z, facingPath(temple, templeSide)), chunk: chunkOf(templeAt) })
			taken.push({ x: hall.x, z: hall.z, radius: 20 })
		}
		const pagoda = beside(temple, templeSide * 38, 34)
		if (clear(pagoda.x, pagoda.z, templeAt + 34, 14, 60) && isFree(taken, pagoda.x, pagoda.z, 7)) {
			pending.pagodas.push({ matrix: placed(pagoda.x, 0, pagoda.z, facingPath(temple, templeSide)), chunk: chunkOf(templeAt) })
			taken.push({ x: pagoda.x, z: pagoda.z, radius: 8 })
		}

		// Pines and rocks on the slopes either side, thinner inside the tunnels, where the torii crowd in.
		const rocks = new Batch(rockGeometry, rockMaterial, cursor, { cast: true, receive: true })
		const rockShade = new Color()
		for (let distance = from, index = base; distance < to; distance += 5, index++) {
			const point = path.at(distance)
			cursor.chunk = chunkOf(distance)
			for (const side of [-1, 1]) {
				for (let row = 0; row < 4; row++) {
					const seed = index * 23 + row * 7 + side
					if (scatter(seed) < (inTunnel(distance) ? 0.7 : 0.35)) continue
					const out = 4.5 + row * 6 + scatter(seed + 1) * 4
					const ahead = (scatter(seed + 2) - 0.5) * 4
					// Within the block, with room for a pine or the biggest rock.
					if (distance + ahead - slopeReach < from || distance + ahead + slopeReach > to) continue
					const at = beside(point, side * out, ahead)
					if (!clear(at.x, at.z, distance, 3.6, 24) || !isFree(taken, at.x, at.z, 2)) continue
					if (scatter(seed + 3) > 0.3) {
						pending.pines.push({ matrix: placed(at.x, 0, at.z, scatter(seed + 4) * 6.28, 0.7 + scatter(seed + 5) * 0.5), chunk: cursor.chunk })
						taken.push({ x: at.x, z: at.z, radius: 1.8 })
					} else {
						const size = 0.5 + scatter(seed + 6) * 1.4
						rockShade.setHex(palette.rock).multiplyScalar(0.8 + scatter(seed + 7) * 0.35)
						rocks.add(placed(at.x, size * 0.35, at.z, scatter(seed + 8) * 6.28, size * 1.3, size * 0.8, size), rockShade.clone())
					}
				}
			}
		}
		addAll(group, rocks.build())
		return { group, pending }
	})
	scene.add(blocks.group)

	let disposed = false
	void models.then((loaded) => {
		if (disposed) return
		const temple = loaded.temple?.scene
		const gate = temple?.getObjectByName('Torii')
		const lantern = temple?.getObjectByName('StoneLantern')
		const hall = temple?.getObjectByName('Hall')
		const pagoda = temple?.getObjectByName('Pagoda')
		const pine = loaded.kit?.scene.getObjectByName('Pine')
		for (const { group, pending } of blocks.laid) {
			if (gate !== undefined) {
				const gates = stamp(gate, pending.torii, toriiHeight, true, owned)
				for (const mesh of gates) fadeNear(mesh.material as Material, near)
				addAll(group, gates)
			}
			if (lantern !== undefined) addAll(group, stamp(lantern, pending.lanterns, heightOf(lantern), true, owned))
			if (hall !== undefined) addAll(group, stamp(hall, pending.halls, heightOf(hall), false, owned))
			if (pagoda !== undefined) addAll(group, stamp(pagoda, pending.pagodas, heightOf(pagoda), false, owned))
			if (pine !== undefined) addAll(group, stamp(pine, pending.pines, heightOf(pine), true, owned))
		}
	}).catch((error: unknown) => {
		console.warn('[bunbu] the mountain temple\'s models could not be read; the slopes stand without them', error)
	})

	return {
		passTime: passTime({ scene, fog, backdrop, ambient, sun }, daylight),

		frame(camera, x, z) {
			// The samurai's depth in view, less a little, so the gate he is passing under still shows.
			near.value = Math.max(0, -samurai.set(x, 1, z).applyMatrix4(camera.matrixWorldInverse).z)
		},

		follow(x, z, distance) {
			blocks.follow(distance)
			ground.position.set(x, 0, z)
			backdrop.position.set(x, 0, z)
			peaks.position.set(x, 0, z)
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
