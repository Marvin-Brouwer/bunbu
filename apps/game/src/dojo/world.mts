/**
 * The dojo's world for practice ([D3 to D5](../../../../docs/design/screens.md#d3-practice-start)):
 * a wooden training dummy holding a bamboo sword, on the dojo's floor in front of its paper walls.
 * The dummy doesn't move, except to swing back when the player misses: thwack.
 *
 * All of it is built in code from simple shapes; there is no model to wait for. Like the run, it
 * reads the store and never changes it.
 */

import {
	ACESFilmicToneMapping,
	BoxGeometry,
	CanvasTexture,
	Color,
	CylinderGeometry,
	DirectionalLight,
	Fog,
	Group,
	HemisphereLight,
	Mesh,
	MeshStandardMaterial,
	PlaneGeometry,
	PointLight,
	RepeatWrapping,
	Scene,
	SphereGeometry,
	SRGBColorSpace,
	type BufferGeometry,
	type Material,
} from 'three'
import { distanceFor, type Framing } from '../canvas/framing.mts'
import type { View } from '../canvas/stage.mts'
import type { Viewport } from '../canvas/viewport.mts'
import type { Tally } from './state/practice.mts'

const palette = {
	floor: 0xb08458,
	wall: 0x4a3426,
	paper: 0xf4ead2,
	post: 0x8a5a36,
	straw: 0xc9a964,
	rope: 0x6b4a2a,
	cloth: 0xe9e2d0,
	band: 0x8e2a22,
	bamboo: 0xd8c27a,
	grip: 0x2a2420,
	fog: 0x2a1e18,
}

/** The dummy and a little floor either side of it. */
export const dojoFraming: Framing = { fov: 40, halfWidth: 1.6, closest: 4.5 }

/** Seconds the dummy takes to settle after a miss. */
export const swingSeconds = 1.6

/**
 * How far the dummy leans back, in radians, `time` seconds after a miss: knocked back hard, then
 * rocking on its base until it stands still again. A function of time alone.
 */
export function swingOf(time: number): number {
	if (time <= 0 || time >= swingSeconds) return 0
	return -0.5 * Math.sin(time * 11) * Math.exp(-time * 3.2)
}

/** Floorboards drawn on a canvas: long planks with dark seams. */
function boardsTexture(): CanvasTexture {
	const size = 256
	const canvas = document.createElement('canvas')
	canvas.width = size
	canvas.height = size
	const context = canvas.getContext('2d')
	if (context !== null) {
		context.fillStyle = '#ffffff'
		context.fillRect(0, 0, size, size)
		const planks = 4
		for (let index = 0; index < planks; index++) {
			context.fillStyle = index % 2 === 0 ? '#f3ebe2' : '#e6dccf'
			context.fillRect(index * (size / planks), 0, size / planks, size)
			context.fillStyle = '#7a6a5a'
			context.fillRect(index * (size / planks), 0, 2, size)
			// Plank ends, staggered.
			context.fillRect(index * (size / planks), ((index * 97) % size), size / planks, 2)
		}
	}
	const texture = new CanvasTexture(canvas)
	texture.wrapS = RepeatWrapping
	texture.wrapT = RepeatWrapping
	texture.repeat.set(10, 10)
	texture.colorSpace = SRGBColorSpace
	return texture
}

/** A shoji panel: paper in a lattice of thin bars. */
function shojiTexture(): CanvasTexture {
	const size = 128
	const canvas = document.createElement('canvas')
	canvas.width = size
	canvas.height = size * 2
	const context = canvas.getContext('2d')
	if (context !== null) {
		context.fillStyle = '#fff8e8'
		context.fillRect(0, 0, size, size * 2)
		context.fillStyle = '#5a3e2a'
		for (let x = 0; x <= 3; x++) context.fillRect((x * (size - 4)) / 3, 0, 4, size * 2)
		for (let y = 0; y <= 6; y++) context.fillRect(0, (y * (size * 2 - 4)) / 6, size, 4)
	}
	const texture = new CanvasTexture(canvas)
	texture.colorSpace = SRGBColorSpace
	return texture
}

type Owned = { geometries: BufferGeometry[]; materials: Material[]; textures: CanvasTexture[] }

/** One piece of the dummy at `x`, `y`, `z`, casting and taking shadows. */
function part(geometry: BufferGeometry, colour: Material, x: number, y: number, z: number): Mesh {
	const mesh = new Mesh(geometry, colour)
	mesh.position.set(x, y, z)
	mesh.castShadow = true
	mesh.receiveShadow = true
	return mesh
}

/** The training dummy: a post on a base, a straw-bound body, a cloth head, arms and a bamboo sword. */
function trainingDummy(owned: Owned): { readonly root: Group; readonly swinging: Group } {
	const material = (colour: number, roughness = 0.85) => {
		const made = new MeshStandardMaterial({ color: colour, roughness })
		owned.materials.push(made)
		return made
	}
	const shape = <T extends BufferGeometry>(geometry: T): T => {
		owned.geometries.push(geometry)
		return geometry
	}

	const post = material(palette.post)
	const straw = material(palette.straw, 1)
	const rope = material(palette.rope)
	const cloth = material(palette.cloth)
	const band = material(palette.band)
	const bamboo = material(palette.bamboo, 0.6)
	const grip = material(palette.grip)

	const root = new Group()
	// Two crossed feet on the floor, which stay put while the rest rocks.
	root.add(part(shape(new BoxGeometry(1, 0.12, 0.18)), post, 0, 0.06, 0))
	root.add(part(shape(new BoxGeometry(0.18, 0.12, 1)), post, 0, 0.06, 0))

	const swinging = new Group()
	swinging.position.y = 0.12
	root.add(swinging)
	swinging.add(part(shape(new CylinderGeometry(0.07, 0.08, 1.7, 10).translate(0, 0.85, 0)), post, 0, 0, 0))
	// The body: straw bound with rope.
	swinging.add(part(shape(new CylinderGeometry(0.26, 0.3, 0.75, 14)), straw, 0, 1.15, 0))
	const binding = shape(new CylinderGeometry(0.3, 0.3, 0.05, 14))
	for (const y of [0.88, 1.12, 1.38]) swinging.add(part(binding, rope, 0, y, 0))
	// Arms: one bar through the shoulders.
	swinging.add(part(shape(new CylinderGeometry(0.05, 0.05, 1.1, 8).rotateZ(Math.PI / 2)), post, 0, 1.42, 0))
	// The head, wrapped in cloth, with a red band round the brow.
	swinging.add(part(shape(new SphereGeometry(0.2, 14, 10)), cloth, 0, 1.78, 0))
	swinging.add(part(shape(new CylinderGeometry(0.205, 0.205, 0.06, 14)), band, 0, 1.82, 0))

	// The bamboo sword (shinai) in the right hand, held up across the body: four slats, a grip, a guard.
	const sword = new Group()
	sword.position.set(0.55, 1.42, 0.08)
	sword.rotation.set(0.3, 0, 0.5)
	const blade = shape(new CylinderGeometry(0.028, 0.032, 1, 8).translate(0, 0.7, 0))
	sword.add(part(blade, bamboo, 0, 0, 0))
	const joint = shape(new CylinderGeometry(0.036, 0.036, 0.02, 8))
	for (const y of [0.45, 0.75, 1.05]) sword.add(part(joint, rope, 0, y, 0))
	sword.add(part(shape(new CylinderGeometry(0.035, 0.035, 0.26, 8).translate(0, 0.07, 0)), grip, 0, 0, 0))
	sword.add(part(shape(new CylinderGeometry(0.08, 0.08, 0.02, 12)), grip, 0, 0.2, 0))
	swinging.add(sword)

	return { root, swinging }
}

export function createDojoWorld(viewport: Viewport, tally?: Tally): View {
	const { renderer, camera } = viewport
	const scene = new Scene()
	scene.background = new Color(palette.fog)
	scene.fog = new Fog(palette.fog, 8, 20)
	const owned: Owned = { geometries: [], materials: [], textures: [] }

	scene.add(new HemisphereLight(0xfff0d8, 0x4a3426, 1.6))
	const light = new DirectionalLight(0xffe2b8, 2.2)
	light.position.set(-3, 6, 4)
	light.castShadow = true
	light.shadow.mapSize.set(1024, 1024)
	for (const side of ['left', 'bottom'] as const) light.shadow.camera[side] = -4
	for (const side of ['right', 'top'] as const) light.shadow.camera[side] = 4
	light.shadow.bias = -0.0008
	scene.add(light)
	// Warm light through the paper walls.
	const glow = new PointLight(0xffd9a0, 6, 10)
	glow.position.set(0, 2.2, -2.2)
	scene.add(glow)

	const boards = boardsTexture()
	owned.textures.push(boards)
	const floorGeometry = new PlaneGeometry(20, 20).rotateX(-Math.PI / 2)
	const floorMaterial = new MeshStandardMaterial({ color: palette.floor, map: boards, roughness: 0.7 })
	owned.geometries.push(floorGeometry)
	owned.materials.push(floorMaterial)
	const floor = new Mesh(floorGeometry, floorMaterial)
	floor.receiveShadow = true
	scene.add(floor)

	// The back wall: shoji panels between dark posts, lit from behind.
	const shoji = shojiTexture()
	owned.textures.push(shoji)
	const panelGeometry = new PlaneGeometry(1.2, 2.4)
	const panelMaterial = new MeshStandardMaterial({ color: palette.paper, map: shoji, emissive: 0xffc890, emissiveMap: shoji, emissiveIntensity: 0.45, roughness: 1 })
	const postGeometry = new BoxGeometry(0.16, 3, 0.16)
	const postMaterial = new MeshStandardMaterial({ color: palette.wall, roughness: 0.8 })
	const beamGeometry = new BoxGeometry(12, 0.2, 0.2)
	owned.geometries.push(panelGeometry, postGeometry, beamGeometry)
	owned.materials.push(panelMaterial, postMaterial)
	for (let index = -4; index <= 4; index++) {
		const panel = new Mesh(panelGeometry, panelMaterial)
		panel.position.set(index * 1.3, 1.25, -3)
		scene.add(panel)
		const post = new Mesh(postGeometry, postMaterial)
		post.position.set(index * 1.3 + 0.65, 1.5, -2.95)
		scene.add(post)
	}
	const beam = new Mesh(beamGeometry, postMaterial)
	beam.position.set(0, 2.55, -2.9)
	scene.add(beam)
	// Plaster above the beam, up to the ceiling.
	const plasterGeometry = new PlaneGeometry(12, 3)
	const plasterMaterial = new MeshStandardMaterial({ color: 0xd8ccb0, roughness: 1 })
	owned.geometries.push(plasterGeometry)
	owned.materials.push(plasterMaterial)
	const plaster = new Mesh(plasterGeometry, plasterMaterial)
	plaster.position.set(0, 4.1, -3.02)
	scene.add(plaster)

	const dummy = trainingDummy(owned)
	// Turned a little, so the sword arm shows.
	dummy.root.rotation.y = -0.35
	scene.add(dummy.root)

	const before = {
		fov: camera.fov,
		position: camera.position.clone(),
		quaternion: camera.quaternion.clone(),
		shadows: renderer.shadowMap.enabled,
		toneMapping: renderer.toneMapping,
		exposure: renderer.toneMappingExposure,
	}
	camera.fov = dojoFraming.fov
	camera.updateProjectionMatrix()
	renderer.shadowMap.enabled = true
	renderer.toneMapping = ACESFilmicToneMapping
	renderer.toneMappingExposure = 1.05

	// The swing starts when the miss screen shows, and runs on the clock from there.
	let missed = Boolean(tally?.value.missed)
	let sinceMiss = Number.POSITIVE_INFINITY

	return {
		scene,

		draw(delta) {
			const now = Boolean(tally?.value.missed)
			if (now && !missed) sinceMiss = 0
			else sinceMiss += delta
			missed = now
			// A negative lean tips the top away from the camera: knocked back by the player's cut.
			dummy.swinging.rotation.x = swingOf(sinceMiss)

			const distance = distanceFor(camera.aspect, dojoFraming)
			camera.position.set(0, 1.5, distance)
			// Below the dummy's middle, so it stands in the upper part of the screen, above the buttons.
			camera.lookAt(0, 0.7, 0)
		},

		dispose() {
			for (const made of owned.geometries) made.dispose()
			for (const made of owned.materials) made.dispose()
			for (const made of owned.textures) made.dispose()
			light.dispose()
			glow.dispose()
			scene.clear()
			camera.fov = before.fov
			camera.position.copy(before.position)
			camera.quaternion.copy(before.quaternion)
			camera.updateProjectionMatrix()
			renderer.shadowMap.enabled = before.shadows
			renderer.toneMapping = before.toneMapping
			renderer.toneMappingExposure = before.exposure
		},
	}
}
