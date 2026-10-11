/**
 * Rice fields ([stages](../../../../../docs/design/screens.md#2-fight-setup)) on a clear morning: a
 * dirt path along the dikes between flooded paddies, young rice in rows, farmhouses under thick
 * thatch with red maples beside them, scarecrows in the fields, and mountains all round.
 *
 * Laid out once, when the run starts, in stretches of path that are each their own
 * `InstancedMesh`, like castle town. The farmhouses and scarecrows are from our stage kit
 * (`assets/blender/stage_kit.py`) and the maples are Quaternius's; the fields stand without them
 * until they are in.
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
	InstancedMesh,
	Mesh,
	MeshStandardMaterial,
	RepeatWrapping,
	SRGBColorSpace,
	type Object3D,
	type Scene,
} from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { Batch, chunkOf, placed, scatter, type Cursor } from './kit.mts'
import { clearanceOf, facingPath, fogFar, isFree, sky, skyRadius, stamp, strip, type Owned, type Planting, type StageView, type Taken } from './landscape.mts'
import { beside, type Leg, type Path } from './path.mts'

const palette = {
	skyTop: 0x4f86c6,
	skyHorizon: 0xf4dcae,
	fog: 0xd9d2bc,
	grass: 0x6f8f3e,
	path: 0xa08a64,
	water: 0xffffff,
	rice: 0x7fb04a,
	/** Near mountains to far, bluer and paler with distance. */
	mountains: [0x5d7a6a, 0x7d93a0, 0x9fb0c0],
}

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

export function createRiceFields(scene: Scene, path: Path, from: number, to: number, models: Promise<RiceModels>): StageView {
	const visualTo = Math.min(to, 2400)
	scene.background = new Color(palette.fog)
	scene.fog = new Fog(palette.fog, 40, fogFar)
	const owned: Owned = { geometries: [], materials: [], textures: [] }
	const backdrop = sky(owned, palette.skyTop, palette.skyHorizon)
	scene.add(backdrop)

	scene.add(new HemisphereLight(0xdfe8ff, 0x7a6a4a, 2.2))
	const sun = new DirectionalLight(0xfff0d0, 2.6)
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

	const dirt = new Color(palette.path)
	scene.add(strip(path, from, visualTo, owned, { half: () => pathHalfWidth, colour: () => dirt, y: 0.04 }))

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

	// The fields: farmhouses first, on dry plots well off the path, then paddies wherever is left.
	const cursor: Cursor = { chunk: 0 }
	const clear = clearanceOf(path, from, visualTo)
	const taken: Taken = []
	const farmhouses: Planting[] = []
	const maples: Planting[] = []
	const scarecrows: Planting[] = []
	for (let distance = Math.max(from, 20), index = 0; distance < visualTo; distance += 95 + scatter(index * 7) * 40, index++) {
		const point = path.at(distance)
		const side = scatter(index + 3) > 0.5 ? 1 : -1
		const out = 24 + scatter(index + 5) * 10
		const at = beside(point, side * out)
		if (!clear(at.x, at.z, distance, 14)) continue
		const chunk = chunkOf(distance)
		farmhouses.push({ matrix: placed(at.x, 0, at.z, facingPath(point, side) + (scatter(index + 9) - 0.5) * 0.4), chunk })
		taken.push({ x: at.x, z: at.z, radius: 11 })
		for (const [aside, ahead] of [[6, 7], [-7, 5]] as const) {
			const tree = beside(point, side * (out + aside * 0.6), ahead)
			maples.push({ matrix: placed(tree.x, 0, tree.z, scatter(index + aside) * 6.28, 0.8 + scatter(index + ahead) * 0.3), chunk })
			taken.push({ x: tree.x, z: tree.z, radius: 4 })
		}
	}

	const box = new BoxGeometry(1, 1, 1)
	const tuft = tuftGeometry()
	const texture = paddyTexture()
	owned.geometries.push(box, tuft)
	owned.textures.push(texture)
	const waterMaterial = new MeshStandardMaterial({ color: palette.water, map: texture, roughness: 0.2, metalness: 0.15 })
	const riceMaterial = new MeshStandardMaterial({ color: palette.rice, roughness: 0.9, side: DoubleSide, flatShading: true })
	owned.materials.push(waterMaterial, riceMaterial)
	const paddies = new Batch(box, waterMaterial, cursor, { receive: true })
	const rice = new Batch(tuft, riceMaterial, cursor)

	for (let distance = from; distance < visualTo; distance += paddySize) {
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
					scarecrows.push({ matrix: placed(at.x, 0, at.z, facingPath(point, side) + (scatter(distance) - 0.5)), chunk: cursor.chunk })
				}
			}
		}
	}

	const laid = new Group()
	laid.add(...paddies.build(), ...rice.build())
	scene.add(laid)

	const modelled = new Group()
	scene.add(modelled)
	let disposed = false
	void models.then((loaded) => {
		if (disposed) return
		if (loaded.maple !== undefined) modelled.add(...stamp(loaded.maple.scene, maples, 7, true, owned))
		const farmhouse = loaded.kit?.scene.getObjectByName('Farmhouse')
		if (farmhouse !== undefined) modelled.add(...stamp(farmhouse, farmhouses, heightOf(farmhouse), true, owned))
		const scarecrow = loaded.kit?.scene.getObjectByName('Scarecrow')
		if (scarecrow !== undefined) modelled.add(...stamp(scarecrow, scarecrows, heightOf(scarecrow), true, owned))
	}).catch((error: unknown) => {
		console.warn('[bunbu] the rice fields\' models could not be read; the fields stand without them', error)
	})

	return {
		follow(x, z) {
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
			for (const child of [...laid.children, ...modelled.children]) if (child instanceof InstancedMesh) child.dispose()
			sun.dispose()
		},
	}
}
