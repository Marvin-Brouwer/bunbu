/**
 * Bamboo forest ([stages](../../../../../docs/design/screens.md#2-fight-setup)) in green morning
 * mist: stepping stones on gravel winding between dense stands of bamboo, light falling in shafts
 * between the stalks, wayside shrines with stone Jizō beside them, and stone lanterns along the way.
 *
 * Laid out when the run starts as a few blocks of a round of the path each, stitched together
 * ahead of the samurai for as long as the run goes ([blocks](./blocks.mts)), in stretches of path
 * that are each their own `InstancedMesh`. The bamboo, shrines and Jizō are from our stage kit
 * (`assets/blender/stage_kit.py`), the lanterns from the temple kit; thin green stalks stand in for
 * the bamboo until the kit is in.
 */

import {
	AdditiveBlending,
	Box3,
	CanvasTexture,
	CircleGeometry,
	Color,
	CylinderGeometry,
	DirectionalLight,
	DoubleSide,
	Fog,
	Group,
	HemisphereLight,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PlaneGeometry,
	SRGBColorSpace,
	type Object3D,
	type Scene,
} from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { layBlocks } from './blocks.mts'
import { Batch, chunkOf, placed, scatter, type Cursor } from './kit.mts'
import { addAll, clearanceOf, facingPath, isFree, passTime, sky, skyRadius, stamp, strip, type Daylight, type Owned, type Planting, type StageView, type Taken } from './landscape.mts'
import type { BackdropRow } from './backdrop.mts'
import { beside, type Leg, type Path } from './path.mts'

const palette = {
	moss: 0x55663a,
	gravel: 0x8f8a76,
	stone: 0x9a958a,
	stalk: 0x7fa046,
	shaft: 0xfff2c0,
}

/**
 * Deeper into the forest ([backdrop](./backdrop.mts)): more bamboo past the stands along the path,
 * and broadleaf trees farther in.
 */
export const bambooBackdrop: readonly BackdropRow[] = [
	{ shape: 'bamboo', from: 26, to: 70, perTile: 6, colours: [[0x7fa046, 0x8aa84e, 0x6f9440]] },
	{ shape: 'broadleaf', from: 50, to: 110, perTile: 1.4, colours: [[0x4a3a2c], [0x4a6634, 0x557038]] },
]

/** From a misty noon to a misty dusk. One light per quarter of the stage ({@link passTime}). */
const daylight: Daylight = [
	{
		skyTop: 0x8fb08a,
		skyHorizon: 0xdde6c8,
		fog: 0xb4c2a2,
		ambient: { sky: 0xe8f4d0, ground: 0x3a4a28, intensity: 2.4 },
		sun: { colour: 0xfff2d0, intensity: 2.0 },
		lamps: 0,
	},
	{
		skyTop: 0x88a884,
		skyHorizon: 0xe0e2c0,
		fog: 0xb2bc9c,
		ambient: { sky: 0xe8f0c8, ground: 0x3a4a28, intensity: 2.3 },
		sun: { colour: 0xffeac0, intensity: 1.9 },
		lamps: 0,
	},
	{
		skyTop: 0x7c9480,
		skyHorizon: 0xe4d4a8,
		fog: 0xaab08e,
		ambient: { sky: 0xe8e0bc, ground: 0x3a4426, intensity: 2.2 },
		sun: { colour: 0xffd498, intensity: 1.7 },
		lamps: 0,
	},
	{
		skyTop: 0x5a6a70,
		skyHorizon: 0xc8a888,
		fog: 0x8c9080,
		ambient: { sky: 0xc8c8c8, ground: 0x303a26, intensity: 2.0 },
		sun: { colour: 0xffb880, intensity: 1.3 },
		lamps: 0,
	},
]

/** A path that winds tightly between the stands, as much left as right. */
export const bambooRound: readonly Leg[] = [
	{ length: 40, turn: 0, zone: 'garden' },
	{ length: 30, turn: 0.9, zone: 'garden' },
	{ length: 40, turn: -1.8, zone: 'garden' },
	{ length: 30, turn: 0.9, zone: 'garden' },
	{ length: 30, turn: 0, zone: 'garden' },
]

/** Half the width of the gravel path. */
const pathHalfWidth = 1.6
/** Bamboo stands from just off the path to this far out. */
const forestDepth = 24

export type BambooModels = Partial<{
	/** Our stage kit: `BambooClump`, `Shrine`, `Jizo`. */
	readonly kit: GLTF
	/** The temple kit: `StoneLantern`. */
	readonly temple: GLTF
}>

/** A shaft of light: bright down its middle, fading to nothing at its edges and toward the ground. */
function shaftTexture(): CanvasTexture {
	const canvas = document.createElement('canvas')
	canvas.width = 32
	canvas.height = 128
	const context = canvas.getContext('2d')
	if (context !== null) {
		const across = context.createLinearGradient(0, 0, 32, 0)
		across.addColorStop(0, 'rgba(255,255,255,0)')
		across.addColorStop(0.5, 'rgba(255,255,255,1)')
		across.addColorStop(1, 'rgba(255,255,255,0)')
		context.fillStyle = across
		context.fillRect(0, 0, 32, 128)
		context.globalCompositeOperation = 'destination-in'
		const down = context.createLinearGradient(0, 0, 0, 128)
		down.addColorStop(0, 'rgba(255,255,255,0.9)')
		down.addColorStop(1, 'rgba(255,255,255,0)')
		context.fillStyle = down
		context.fillRect(0, 0, 32, 128)
	}
	const texture = new CanvasTexture(canvas)
	texture.colorSpace = SRGBColorSpace
	return texture
}

/** How tall `model` stands, so a model made to size is stamped at its own size. */
function heightOf(model: Object3D): number {
	model.updateMatrixWorld(true)
	const bounds = new Box3().setFromObject(model)
	return bounds.max.y - bounds.min.y
}

/** What a bamboo-forest block places once the models are in, and the stalks that stand in till then. */
type BambooPending = {
	readonly shrines: Planting[]
	readonly jizos: Planting[]
	readonly lanterns: Planting[]
	readonly bamboo: Planting[]
	readonly placeholders: Group
}

/** Metres a shrine and the Jizō beside it reach along the path from where it stands. */
const shrineReach = 4

export function createBambooForest(scene: Scene, path: Path, models: Promise<BambooModels>): StageView {
	// Thick mist: the forest closes in, and what is far off is only a green haze.
	const [first] = daylight
	const fog = new Fog(first.fog, 22, 115)
	scene.fog = fog
	const owned: Owned = { geometries: [], materials: [], textures: [] }
	const backdrop = sky(owned, first.skyTop, first.skyHorizon)
	scene.add(backdrop)

	const ambient = new HemisphereLight(first.ambient.sky, first.ambient.ground, first.ambient.intensity)
	scene.add(ambient)
	const sun = new DirectionalLight(first.sun.colour, first.sun.intensity)
	sun.castShadow = true
	sun.shadow.mapSize.set(1024, 1024)
	for (const side of ['left', 'bottom'] as const) sun.shadow.camera[side] = -18
	for (const side of ['right', 'top'] as const) sun.shadow.camera[side] = 18
	sun.shadow.camera.near = 1
	sun.shadow.camera.far = 80
	sun.shadow.bias = -0.0008
	scene.add(sun, sun.target)
	const sunFrom = { x: -14, y: 34, z: 8 }

	const groundGeometry = new CircleGeometry(skyRadius, 32).rotateX(-Math.PI / 2)
	const groundMaterial = new MeshStandardMaterial({ color: palette.moss, roughness: 1 })
	owned.geometries.push(groundGeometry)
	owned.materials.push(groundMaterial)
	const ground = new Mesh(groundGeometry, groundMaterial)
	ground.receiveShadow = true
	scene.add(ground)

	const gravel = new Color(palette.gravel)
	const stoneGeometry = new CylinderGeometry(0.45, 0.5, 0.12, 9)
	const stoneMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true })
	owned.geometries.push(stoneGeometry)
	owned.materials.push(stoneMaterial)
	// Thin green stalks stand in for the bamboo until the kit is in.
	const stalkGeometry = new CylinderGeometry(0.06, 0.07, 10, 5).translate(0, 5, 0)
	const stalkMaterial = new MeshStandardMaterial({ color: palette.stalk, roughness: 0.7 })
	owned.geometries.push(stalkGeometry)
	owned.materials.push(stalkMaterial)
	// Shafts of light slanting down between the stalks, across the path.
	const shaftGeometry = new PlaneGeometry(3.2, 22).translate(0, 11, 0)
	const shaftMaterial = new MeshBasicMaterial({
		color: palette.shaft,
		map: shaftTexture(),
		transparent: true,
		opacity: 0.55,
		depthWrite: false,
		blending: AdditiveBlending,
		side: DoubleSide,
		fog: false,
	})
	if (shaftMaterial.map !== null) owned.textures.push(shaftMaterial.map)
	owned.geometries.push(shaftGeometry)
	owned.materials.push(shaftMaterial)

	// The forest, a round of the path at a time ([blocks](./blocks.mts)).
	const blocks = layBlocks<BambooPending>(path, (from, to, base) => {
		const group = new Group()
		group.add(strip(path, from, to, owned, { half: () => pathHalfWidth, colour: () => gravel, y: 0.03 }))

		const cursor: Cursor = { chunk: 0 }
		const clear = clearanceOf(path, from - 60, to + 60)
		const taken: Taken = []

		// Stepping stones down the middle of the path, a stride apart.
		const stones = new Batch(stoneGeometry, stoneMaterial, cursor, { receive: true })
		const stoneShade = new Color()
		for (let distance = from, index = base; distance < to; distance += 0.95, index++) {
			cursor.chunk = chunkOf(distance)
			const at = beside(path.at(distance), (scatter(index) - 0.5) * 0.5)
			stoneShade.setHex(palette.stone).multiplyScalar(0.85 + scatter(index + 7) * 0.25)
			stones.add(placed(at.x, 0.05, at.z, scatter(index + 3) * 6.28, 0.8 + scatter(index + 5) * 0.4, 1, 0.7 + scatter(index + 9) * 0.3), stoneShade.clone())
		}

		// Shrines with Jizō beside them, and pairs of stone lanterns, along the way: placed before the
		// bamboo so it keeps clear of them.
		const shrines: Planting[] = []
		const jizos: Planting[] = []
		const lanterns: Planting[] = []
		for (let distance = from + 25, index = base; distance + shrineReach <= to; distance += 70 + scatter(index * 3) * 30, index++) {
			const point = path.at(distance)
			const side = scatter(index + 11) > 0.5 ? 1 : -1
			const chunk = chunkOf(distance)
			const at = beside(point, side * (pathHalfWidth + 2.2))
			shrines.push({ matrix: placed(at.x, 0, at.z, facingPath(point, side)), chunk })
			taken.push({ x: at.x, z: at.z, radius: 3.2 })
			const figures = 1 + Math.floor(scatter(index + 13) * 3)
			for (let figure = 0; figure < figures; figure++) {
				const spot = beside(point, side * (pathHalfWidth + 1.4), 1.3 + figure * 0.55)
				jizos.push({ matrix: placed(spot.x, 0, spot.z, facingPath(point, side), 0.9 + scatter(index + figure) * 0.2), chunk })
			}
		}
		for (let distance = from + 50; distance + 1.2 <= to; distance += 60) {
			const point = path.at(distance)
			for (const side of [-1, 1]) {
				const at = beside(point, side * (pathHalfWidth + 0.9))
				if (!isFree(taken, at.x, at.z, 0.6)) continue
				lanterns.push({ matrix: placed(at.x, 0, at.z, facingPath(point, side)), chunk: chunkOf(distance) })
				taken.push({ x: at.x, z: at.z, radius: 1.2 })
			}
		}

		// The bamboo: dense stands either side, with a clearing here and there. A clump strays up to
		// 0.8 m along the path, so the first and last keep that far in from the block's ends.
		const bamboo: Planting[] = []
		for (let distance = from + 1, index = base; distance + 1 <= to; distance += 2.3, index++) {
			const point = path.at(distance)
			const chunk = chunkOf(distance)
			for (const side of [-1, 1]) {
				for (let out = pathHalfWidth + 1.2; out < forestDepth; out += 2.4) {
					const seed = index * 37 + Math.round(out * 10) * 3 + side
					if (scatter(seed) < 0.22) continue
					const at = beside(point, side * (out + (scatter(seed + 1) - 0.5) * 1.6), (scatter(seed + 2) - 0.5) * 1.6)
					if (!clear(at.x, at.z, distance, pathHalfWidth + 0.9, 20)) continue
					if (!isFree(taken, at.x, at.z, 0.8)) continue
					bamboo.push({ matrix: placed(at.x, 0, at.z, scatter(seed + 3) * 6.28, 0.8 + scatter(seed + 4) * 0.45), chunk })
				}
			}
		}

		const stalks = new Batch(stalkGeometry, stalkMaterial, cursor)
		for (const { matrix, chunk } of bamboo) {
			cursor.chunk = chunk
			stalks.add(matrix)
		}
		const placeholders = new Group()
		addAll(placeholders, stalks.build())

		for (let distance = from + 10, index = base; distance < to; distance += 26 + scatter(index) * 20, index++) {
			const at = beside(path.at(distance), (scatter(index + 1) - 0.5) * 6)
			const shaft = new Mesh(shaftGeometry, shaftMaterial)
			shaft.position.set(at.x, 0, at.z)
			shaft.rotation.set(0, scatter(index + 2) * Math.PI, 0.35)
			shaft.renderOrder = 3
			group.add(shaft)
		}

		addAll(group, [...stones.build(), placeholders])
		return { group, pending: { shrines, jizos, lanterns, bamboo, placeholders } }
	})
	scene.add(blocks.group)

	let disposed = false
	void models.then((loaded) => {
		if (disposed) return
		const clump = loaded.kit?.scene.getObjectByName('BambooClump')
		const shrine = loaded.kit?.scene.getObjectByName('Shrine')
		const jizo = loaded.kit?.scene.getObjectByName('Jizo')
		const lantern = loaded.temple?.scene.getObjectByName('StoneLantern')
		for (const { group, pending } of blocks.laid) {
			if (clump !== undefined) {
				addAll(group, stamp(clump, pending.bamboo, heightOf(clump), false, owned))
				pending.placeholders.visible = false
			}
			if (shrine !== undefined) addAll(group, stamp(shrine, pending.shrines, heightOf(shrine), true, owned))
			if (jizo !== undefined) addAll(group, stamp(jizo, pending.jizos, heightOf(jizo), true, owned))
			if (lantern !== undefined) addAll(group, stamp(lantern, pending.lanterns, heightOf(lantern), true, owned))
		}
	}).catch((error: unknown) => {
		console.warn('[bunbu] the bamboo forest\'s models could not be read; the stand-ins stay', error)
	})

	return {
		passTime: passTime({ scene, fog, backdrop, ambient, sun }, daylight),

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
