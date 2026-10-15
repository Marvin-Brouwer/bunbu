/**
 * Rice fields ([stages](../../../../../docs/design/screens.md#2-fight-setup)) on a clear morning: a
 * dirt path along the dikes between flooded paddies, young rice in rows, farmhouses under thick
 * thatch with red maples beside them, scarecrows in the fields, and mountains all round.
 *
 * Laid out when the run starts as a few blocks of a round of the path each, stitched together
 * ahead of the samurai for as long as the run goes ([blocks](./blocks.mts)), in stretches of path
 * that are each their own `InstancedMesh`, like castle town. The farmhouses and scarecrows are
 * from our stage kit (`assets/blender/stage_kit.py`) and the maples are Quaternius's; the fields
 * stand without them until they are in.
 */

import {
	Box3,
	BoxGeometry,
	BufferGeometry,
	CanvasTexture,
	CircleGeometry,
	Color,
	ConeGeometry,
	DirectionalLight,
	DoubleSide,
	Float32BufferAttribute,
	Fog,
	Group,
	HemisphereLight,
	Mesh,
	MeshStandardMaterial,
	RepeatWrapping,
	SRGBColorSpace,
	type Object3D,
	type Scene,
} from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { layBlocks } from './blocks.mts'
import { Batch, chunkOf, placed, scatter, type Cursor } from './kit.mts'
import { addAll, clearanceOf, facingPath, fogFar, isFree, passTime, sky, skyRadius, stamp, strip, type Daylight, type Owned, type Planting, type StageView, type Taken } from './landscape.mts'
import type { District } from './backdrop.mts'
import type { CoverSet } from './cover.mts'
import { beside, type Leg, type Path } from './path.mts'

const palette = {
	grass: 0x6f8f3e,
	path: 0xa08a64,
	water: 0xffffff,
	rice: 0x7fb04a,
	/** Near mountains to far, bluer and paler with distance. */
	mountains: [0x5d7a6a, 0x7d93a0, 0x9fb0c0],
}

/** From late morning to a golden evening. One light per quarter of the stage ({@link passTime}). */
const daylight: Daylight = [
	{
		skyTop: 0x4f86c6,
		skyHorizon: 0xf4dcae,
		fog: 0xd9d2bc,
		ambient: { sky: 0xdfe8ff, ground: 0x7a6a4a, intensity: 2.2 },
		sun: { colour: 0xfff0d0, intensity: 2.6 },
		lamps: 0,
	},
	{
		skyTop: 0x4a7cbc,
		skyHorizon: 0xf6d6a0,
		fog: 0xdccfb2,
		ambient: { sky: 0xe2e4f4, ground: 0x7a6a4a, intensity: 2.2 },
		sun: { colour: 0xffe6bc, intensity: 2.6 },
		lamps: 0,
	},
	{
		skyTop: 0x46699e,
		skyHorizon: 0xf4c486,
		fog: 0xd8bf98,
		ambient: { sky: 0xe6dcd8, ground: 0x7a6448, intensity: 2.1 },
		sun: { colour: 0xffcf90, intensity: 2.5 },
		lamps: 0,
	},
	{
		skyTop: 0x3a4f86,
		skyHorizon: 0xf0a070,
		fog: 0xc8a084,
		ambient: { sky: 0xd8c8d8, ground: 0x6a5440, intensity: 2.0 },
		sun: { colour: 0xffaa70, intensity: 2.2 },
		lamps: 0,
	},
]

/** Long gentle curves along the dikes, as much left as right. */
export const riceRound: readonly Leg[] = [
	{ length: 70, turn: 0, zone: 'garden' },
	{ length: 60, turn: 0.55, zone: 'garden' },
	{ length: 70, turn: -1.1, zone: 'garden' },
	{ length: 60, turn: 0.55, zone: 'garden' },
	{ length: 40, turn: 0, zone: 'garden' },
]

/** Half the width of the dirt path. */
const pathHalfWidth = 1.5

/** What ninjas hide behind in the fields: stooks of straw and carts on the dikes ([cover](./cover.mts)). */
export const riceCover: CoverSet = {
	kinds: ['bales', 'bales', 'cart'],
	aside: pathHalfWidth + 1.2,
	colours: { bales: [0xc9b06a, 0xb89f5c, 0xd4bd78], cart: [0xd8c8a0, 0xa08a64] },
}

/**
 * The fields' four districts ([districts](./districts.mts)), past the paddies
 * ([backdrop](./backdrop.mts)): the village edge, the open paddies, the irrigation ponds and the
 * shrine grove.
 */
export const riceDistricts: readonly District[] = [
	{
		name: 'Village edge',
		rows: [
			{ shape: 'hut', from: 34, to: 62, perTile: 1.3, colours: [[0x7a5a3c, 0x8a6a46], [0xb09a62, 0xa08a58]] },
			{ shape: 'broadleaf', from: 34, to: 75, perTile: 2, colours: [[0x5a4630], [0x5e8a3a, 0xb8402a, 0x6f9440]] },
			{ shape: 'hill', from: 75, to: 125, perTile: 0.6, colours: [[0x6f8a4a, 0x7a9254, 0x66804a]] },
		],
	},
	{
		name: 'Open paddies',
		rows: [
			{ shape: 'broadleaf', from: 34, to: 75, perTile: 3, colours: [[0x5a4630], [0x5e8a3a, 0x6f9440, 0x4f7a34]] },
			{ shape: 'pine', from: 40, to: 85, perTile: 1.2, colours: [[0x5a4630], [0x3f6a3a, 0x46703c]] },
			{ shape: 'hut', from: 38, to: 75, perTile: 0.5, colours: [[0x7a5a3c, 0x8a6a46], [0xb09a62, 0xa08a58]] },
			{ shape: 'hill', from: 75, to: 125, perTile: 0.6, colours: [[0x6f8a4a, 0x7a9254, 0x66804a]] },
		],
	},
	{
		name: 'Irrigation ponds',
		rows: [
			{ shape: 'pond', from: 32, to: 70, perTile: 1, colours: [[0x2d4a5a, 0x34566a]] },
			{ shape: 'bamboo', from: 40, to: 80, perTile: 2, colours: [[0x7fa046, 0x8aa84e]] },
			{ shape: 'broadleaf', from: 40, to: 80, perTile: 1, colours: [[0x5a4630], [0x5e8a3a, 0x6f9440]] },
			{ shape: 'hill', from: 75, to: 125, perTile: 0.6, colours: [[0x6f8a4a, 0x7a9254, 0x66804a]] },
		],
	},
	{
		name: 'Shrine grove',
		rows: [
			{ shape: 'torii', across: true, span: pathHalfWidth * 2 + 0.4, from: 0, to: 0, perTile: 0.4, colours: [[0xa8261c], [0xa8261c], [0x2a2a2e, 0x8e2a22]] },
			{ shape: 'lantern', from: pathHalfWidth + 0.4, to: pathHalfWidth + 0.7, perTile: 0.4, colours: [[0x8d877b, 0x9a958a], [0x8d877b, 0x7a756c]] },
			{ shape: 'pine', from: 34, to: 90, perTile: 3, colours: [[0x5a4630], [0x3f6a3a, 0x46703c]] },
			{ shape: 'hill', from: 75, to: 125, perTile: 0.6, colours: [[0x6f8a4a, 0x7a9254, 0x66804a]] },
		],
	},
]

/** A paddy's size along and across the path, and the dike between paddies. */
const paddySize = 11
const dike = 0.9

export type RiceModels = Partial<{
	readonly maple: GLTF
	/** Our stage kit: `Farmhouse`, `Scarecrow`. */
	readonly kit: GLTF
}>

/** Water in a paddy with rows of young rice standing in it, seen from above. */
function paddyTexture(): CanvasTexture {
	const size = 256
	const canvas = document.createElement('canvas')
	canvas.width = size
	canvas.height = size
	const context = canvas.getContext('2d')
	if (context !== null) {
		const water = context.createLinearGradient(0, 0, size, size)
		water.addColorStop(0, '#8fb3c4')
		water.addColorStop(1, '#7a9fae')
		context.fillStyle = water
		context.fillRect(0, 0, size, size)
		const rows = 12
		for (let row = 0; row < rows; row++) {
			for (let column = 0; column < rows; column++) {
				const x = (column + 0.5) * (size / rows) + (scatter(row * 31 + column) - 0.5) * 3
				const y = (row + 0.5) * (size / rows)
				context.fillStyle = scatter(row * 17 + column * 3) > 0.5 ? '#6f9a3c' : '#86ad4c'
				context.beginPath()
				context.ellipse(x, y, 4, 3, 0, 0, Math.PI * 2)
				context.fill()
			}
		}
	}
	const texture = new CanvasTexture(canvas)
	texture.colorSpace = SRGBColorSpace
	texture.wrapS = RepeatWrapping
	texture.wrapT = RepeatWrapping
	return texture
}

/** A tuft of young rice: a few thin blades leaning out from one root. */
function tuftGeometry(): BufferGeometry {
	const positions: number[] = []
	const blades = 5
	for (let blade = 0; blade < blades; blade++) {
		const angle = (blade / blades) * Math.PI * 2
		const lean = 0.12
		const tipX = Math.cos(angle) * lean
		const tipZ = Math.sin(angle) * lean
		const sideX = Math.sin(angle) * 0.025
		const sideZ = -Math.cos(angle) * 0.025
		positions.push(-sideX, 0, -sideZ, sideX, 0, sideZ, tipX, 0.5 + scatter(blade) * 0.15, tipZ)
	}
	const geometry = new BufferGeometry()
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
	geometry.computeVertexNormals()
	return geometry
}

/** How tall `model` stands, so a model made to size is stamped at its own size. */
function heightOf(model: Object3D): number {
	model.updateMatrixWorld(true)
	const bounds = new Box3().setFromObject(model)
	return bounds.max.y - bounds.min.y
}

/** What a rice-field block places once the models are in. */
type RicePending = {
	readonly farmhouses: Planting[]
	readonly maples: Planting[]
	readonly scarecrows: Planting[]
}

/** Metres a farmhouse, its maples and their leaves reach along the path either side of where it stands. */
const farmReach = 14

export function createRiceFields(scene: Scene, path: Path, models: Promise<RiceModels>): StageView {
	const [first] = daylight
	const fog = new Fog(first.fog, 40, fogFar)
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
	const sunFrom = { x: 20, y: 32, z: 12 }

	const groundGeometry = new CircleGeometry(skyRadius, 32).rotateX(-Math.PI / 2)
	const groundMaterial = new MeshStandardMaterial({ color: palette.grass, roughness: 1 })
	owned.geometries.push(groundGeometry)
	owned.materials.push(groundMaterial)
	const ground = new Mesh(groundGeometry, groundMaterial)
	ground.receiveShadow = true
	scene.add(ground)

	// Mountains all round, far off: they go where the samurai goes, so they never come nearer.
	const mountains = new Group()
	const peak = new ConeGeometry(1, 1, 6).translate(0, 0.5, 0)
	owned.geometries.push(peak)
	for (let index = 0; index < 26; index++) {
		const layer = index % 3
		const colour = palette.mountains[layer] ?? 0x7d93a0
		const material = new MeshStandardMaterial({ color: colour, roughness: 1, flatShading: true, fog: false })
		owned.materials.push(material)
		const angle = (index / 26) * Math.PI * 2 + scatter(index) * 0.2
		const distance = skyRadius * (0.72 + layer * 0.1)
		const height = 9 + scatter(index + 40) * 14 + layer * 4
		const mountain = new Mesh(peak, material)
		mountain.position.set(Math.sin(angle) * distance, -1, Math.cos(angle) * distance)
		mountain.scale.set(height * 2.6, height, height * 2)
		mountain.rotation.y = scatter(index + 80) * Math.PI
		mountains.add(mountain)
	}
	scene.add(mountains)

	const dirt = new Color(palette.path)
	const box = new BoxGeometry(1, 1, 1)
	const tuft = tuftGeometry()
	const texture = paddyTexture()
	owned.geometries.push(box, tuft)
	owned.textures.push(texture)
	const waterMaterial = new MeshStandardMaterial({ color: palette.water, map: texture, roughness: 0.2, metalness: 0.15 })
	const riceMaterial = new MeshStandardMaterial({ color: palette.rice, roughness: 0.9, side: DoubleSide, flatShading: true })
	owned.materials.push(waterMaterial, riceMaterial)

	// The fields, a round of the path at a time ([blocks](./blocks.mts)).
	const blocks = layBlocks<RicePending>(path, (from, to, base) => {
		const group = new Group()
		group.add(strip(path, from, to, owned, { half: () => pathHalfWidth, colour: () => dirt, y: 0.04 }))

		// Farmhouses first, on dry plots well off the path, then paddies wherever is left.
		const cursor: Cursor = { chunk: 0 }
		const clear = clearanceOf(path, from - 60, to + 60)
		const taken: Taken = []
		const pending: RicePending = { farmhouses: [], maples: [], scarecrows: [] }
		for (let distance = from + 20, index = base; distance + farmReach <= to; distance += 95 + scatter(index * 7) * 40, index++) {
			const point = path.at(distance)
			const side = scatter(index + 3) > 0.5 ? 1 : -1
			const out = 24 + scatter(index + 5) * 10
			const at = beside(point, side * out)
			if (!clear(at.x, at.z, distance, 14)) continue
			const chunk = chunkOf(distance)
			pending.farmhouses.push({ matrix: placed(at.x, 0, at.z, facingPath(point, side) + (scatter(index + 9) - 0.5) * 0.4), chunk })
			taken.push({ x: at.x, z: at.z, radius: 11 })
			for (const [aside, ahead] of [[6, 7], [-7, 5]] as const) {
				const tree = beside(point, side * (out + aside * 0.6), ahead)
				pending.maples.push({ matrix: placed(tree.x, 0, tree.z, scatter(index + aside) * 6.28, 0.8 + scatter(index + ahead) * 0.3), chunk })
				taken.push({ x: tree.x, z: tree.z, radius: 4 })
			}
		}

		const paddies = new Batch(box, waterMaterial, cursor, { receive: true })
		const rice = new Batch(tuft, riceMaterial, cursor)
		// Whole paddies only, so they end where the block does.
		for (let distance = from; distance + paddySize <= to; distance += paddySize) {
			const point = path.at(distance + paddySize / 2)
			cursor.chunk = chunkOf(distance)
			for (const side of [-1, 1]) {
				for (let row = 0; row < 3; row++) {
					const out = pathHalfWidth + dike + paddySize / 2 + row * paddySize
					const at = beside(point, side * out)
					// Off the path even round a curve, and clear of the farmhouses and their trees.
					if (!clear(at.x, at.z, distance, paddySize * 0.5 + pathHalfWidth, 30)) continue
					if (!isFree(taken, at.x, at.z, paddySize * 0.5)) continue
					const turn = point.heading
					paddies.add(placed(at.x, 0, at.z, turn, paddySize - dike, 0.05, paddySize - dike))
					// Rice standing up out of the paddies nearest the path; farther off the texture is enough.
					if (row === 0) {
						for (let across = -4; across <= 4; across++) {
							for (let along = -4; along <= 4; along++) {
								const spot = beside({ x: at.x, z: at.z, heading: turn }, across * 1.1, along * 1.1)
								const seed = distance * 13 + across * 7 + along * 3 + side
								rice.add(placed(spot.x, 0.02, spot.z, scatter(seed) * 6.28, 0.8 + scatter(seed + 1) * 0.5))
							}
						}
					}
					if (row === 1 && scatter(distance + side * 5) > 0.82) {
						pending.scarecrows.push({ matrix: placed(at.x, 0, at.z, facingPath(point, side) + (scatter(distance) - 0.5)), chunk: cursor.chunk })
					}
				}
			}
		}
		addAll(group, [...paddies.build(), ...rice.build()])
		return { group, pending }
	})
	scene.add(blocks.group)

	let disposed = false
	void models.then((loaded) => {
		if (disposed) return
		const farmhouse = loaded.kit?.scene.getObjectByName('Farmhouse')
		const scarecrow = loaded.kit?.scene.getObjectByName('Scarecrow')
		for (const { group, pending } of blocks.laid) {
			if (loaded.maple !== undefined) addAll(group, stamp(loaded.maple.scene, pending.maples, 7, true, owned))
			if (farmhouse !== undefined) addAll(group, stamp(farmhouse, pending.farmhouses, heightOf(farmhouse), true, owned))
			if (scarecrow !== undefined) addAll(group, stamp(scarecrow, pending.scarecrows, heightOf(scarecrow), true, owned))
		}
	}).catch((error: unknown) => {
		console.warn('[bunbu] the rice fields\' models could not be read; the fields stand without them', error)
	})

	return {
		passTime: passTime({ scene, fog, backdrop, ambient, sun }, daylight),

		follow(x, z, distance) {
			blocks.follow(distance)
			ground.position.set(x, 0, z)
			backdrop.position.set(x, 0, z)
			mountains.position.set(x, 0, z)
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
