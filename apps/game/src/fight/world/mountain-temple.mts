/**
 * Mountain temple ([stages](../../../../../docs/design/screens.md#2-fight-setup)) on a clear
 * afternoon high up: stone steps climbing between black pines and rocks, long tunnels of red torii
 * the path runs through, the temple hall and its pagoda on the slopes, and snow on the peaks all round.
 *
 * Laid out once, when the run starts, in stretches of path that are each their own `InstancedMesh`.
 * The torii, hall, pagoda and lanterns are from the temple kit, the pines from our stage kit; the
 * slopes stand without them until they are in.
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
	InstancedMesh,
	Mesh,
	MeshStandardMaterial,
	Vector3,
	type Material,
	type Object3D,
	type Scene,
} from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { Batch, chunkOf, placed, scatter, type Cursor } from './kit.mts'
import { clearanceOf, facingPath, fogFar, isFree, sky, skyRadius, stamp, strip, type Owned, type Planting, type StageView, type Taken } from './landscape.mts'
import { beside, type Leg, type Path } from './path.mts'

const palette = {
	skyTop: 0x3b6cb0,
	skyHorizon: 0xe6edf2,
	fog: 0xc6d0d8,
	ground: 0x6a6f4c,
	step: 0xa39e93,
	stepEdge: 0x86817a,
	rock: 0x8a8780,
	/** Near peaks to far, and the snow on them. */
	peaks: [0x6e7a86, 0x8a96a4, 0xa8b3c0],
	snow: 0xf4f6fa,
}

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

/**
 * Cuts away whatever of `material` is nearer the camera than `cut.value`, in view depth: the torii
 * between the camera and the samurai would otherwise fill the screen in a tunnel. Their shadows stay.
 */
function cutAway(material: Material, cut: { value: number }): void {
	material.onBeforeCompile = (shader) => {
		shader.uniforms.cutDepth = cut
		shader.vertexShader = `varying float vViewDepth;\n${shader.vertexShader}`.replace(
			'#include <project_vertex>',
			'#include <project_vertex>\n\tvViewDepth = -mvPosition.z;',
		)
		shader.fragmentShader = `uniform float cutDepth;\nvarying float vViewDepth;\n${shader.fragmentShader}`.replace(
			'void main() {',
			'void main() {\n\tif (vViewDepth < cutDepth) discard;',
		)
	}
	material.customProgramCacheKey = () => 'cut-away'
	material.needsUpdate = true
}

/** How tall `model` stands, so a model made to size is stamped at its own size. */
function heightOf(model: Object3D): number {
	model.updateMatrixWorld(true)
	const bounds = new Box3().setFromObject(model)
	return bounds.max.y - bounds.min.y
}

export function createMountainTemple(scene: Scene, path: Path, from: number, to: number, models: Promise<MountainModels>): StageView {
	const visualTo = Math.min(to, 2400)
	scene.background = new Color(palette.fog)
	scene.fog = new Fog(palette.fog, 30, fogFar)
	const owned: Owned = { geometries: [], materials: [], textures: [] }
	const backdrop = sky(owned, palette.skyTop, palette.skyHorizon)
	scene.add(backdrop)

	scene.add(new HemisphereLight(0xe4ecff, 0x5a5440, 2.2))
	const sun = new DirectionalLight(0xfff4e0, 2.8)
	sun.castShadow = true
	sun.shadow.mapSize.set(1024, 1024)
	for (const side of ['left', 'bottom'] as const) sun.shadow.camera[side] = -18
	for (const side of ['right', 'top'] as const) sun.shadow.camera[side] = 18
	sun.shadow.camera.near = 1
	sun.shadow.camera.far = 80
	sun.shadow.bias = -0.0008
	scene.add(sun, sun.target)
	const sunFrom = { x: 18, y: 34, z: 16 }

	const groundGeometry = new CircleGeometry(skyRadius, 32).rotateX(-Math.PI / 2)
	const groundMaterial = new MeshStandardMaterial({ color: palette.ground, roughness: 1 })
	owned.geometries.push(groundGeometry)
	owned.materials.push(groundMaterial)
	const ground = new Mesh(groundGeometry, groundMaterial)
	ground.receiveShadow = true
	scene.add(ground)

	// Stone steps: the path in bands of stone, each edge darker, a step a metre.
	const step = new Color(palette.step)
	const edge = new Color(palette.stepEdge)
	scene.add(strip(path, from, visualTo, owned, { half: () => pathHalfWidth, colour: (distance) => (Math.floor(distance) % 2 === 0 ? step : edge), y: 0.04 }))

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

	// How near the camera the torii are cut away, in view depth; set every frame.
	const cut = { value: 0 }
	const samurai = new Vector3()

	const cursor: Cursor = { chunk: 0 }
	const clear = clearanceOf(path, from, visualTo)
	const taken: Taken = []

	// The torii tunnels, square across the steps, and a pair of lanterns where each one begins.
	const torii: Planting[] = []
	const lanterns: Planting[] = []
	let wasTunnel = false
	for (let distance = from; distance < visualTo; distance += toriiEvery) {
		const tunnel = inTunnel(distance)
		const point = path.at(distance)
		if (tunnel) torii.push({ matrix: placed(point.x, 0, point.z, point.heading), chunk: chunkOf(distance) })
		if (tunnel && !wasTunnel) {
			for (const side of [-1, 1]) {
				const at = beside(point, side * (pathHalfWidth + 1.4), 2)
				lanterns.push({ matrix: placed(at.x, 0, at.z, facingPath(point, side)), chunk: chunkOf(distance) })
			}
		}
		wasTunnel = tunnel
	}

	// The temple on the slopes: a hall and its pagoda, once a round, set back from the path.
	const halls: Planting[] = []
	const pagodas: Planting[] = []
	for (let distance = Math.max(from, 0) + 90, index = 0; distance < visualTo; distance += roundLength, index++) {
		const point = path.at(distance)
		const side = index % 2 === 0 ? 1 : -1
		const hall = beside(point, side * 42)
		if (clear(hall.x, hall.z, distance, 26, 60)) {
			halls.push({ matrix: placed(hall.x, 0, hall.z, facingPath(point, side)), chunk: chunkOf(distance) })
			taken.push({ x: hall.x, z: hall.z, radius: 20 })
		}
		const pagoda = beside(point, side * 38, 34)
		if (clear(pagoda.x, pagoda.z, distance + 34, 14, 60) && isFree(taken, pagoda.x, pagoda.z, 7)) {
			pagodas.push({ matrix: placed(pagoda.x, 0, pagoda.z, facingPath(point, side)), chunk: chunkOf(distance) })
			taken.push({ x: pagoda.x, z: pagoda.z, radius: 8 })
		}
	}

	// Pines and rocks on the slopes either side, thinner inside the tunnels, where the torii crowd in.
	const pines: Planting[] = []
	const rockGeometry = new DodecahedronGeometry(1, 0)
	const rockMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true })
	owned.geometries.push(rockGeometry)
	owned.materials.push(rockMaterial)
	const rocks = new Batch(rockGeometry, rockMaterial, cursor, { cast: true, receive: true })
	const rockShade = new Color()
	for (let distance = from, index = 0; distance < visualTo; distance += 5, index++) {
		const point = path.at(distance)
		cursor.chunk = chunkOf(distance)
		for (const side of [-1, 1]) {
			for (let row = 0; row < 4; row++) {
				const seed = index * 23 + row * 7 + side
				if (scatter(seed) < (inTunnel(distance) ? 0.7 : 0.35)) continue
				const out = 4.5 + row * 6 + scatter(seed + 1) * 4
				const at = beside(point, side * out, (scatter(seed + 2) - 0.5) * 4)
				if (!clear(at.x, at.z, distance, 3.6, 24) || !isFree(taken, at.x, at.z, 2)) continue
				if (scatter(seed + 3) > 0.3) {
					pines.push({ matrix: placed(at.x, 0, at.z, scatter(seed + 4) * 6.28, 0.7 + scatter(seed + 5) * 0.5), chunk: cursor.chunk })
					taken.push({ x: at.x, z: at.z, radius: 1.8 })
				} else {
					const size = 0.5 + scatter(seed + 6) * 1.4
					rockShade.setHex(palette.rock).multiplyScalar(0.8 + scatter(seed + 7) * 0.35)
					rocks.add(placed(at.x, size * 0.35, at.z, scatter(seed + 8) * 6.28, size * 1.3, size * 0.8, size), rockShade.clone())
				}
			}
		}
	}

	const laid = new Group()
	laid.add(...rocks.build())
	scene.add(laid)

	const modelled = new Group()
	scene.add(modelled)
	let disposed = false
	void models.then((loaded) => {
		if (disposed) return
		const temple = loaded.temple?.scene
		const gate = temple?.getObjectByName('Torii')
		if (gate !== undefined) {
			const gates = stamp(gate, torii, toriiHeight, true, owned)
			for (const mesh of gates) cutAway(mesh.material as Material, cut)
			modelled.add(...gates)
		}
		const lantern = temple?.getObjectByName('StoneLantern')
		if (lantern !== undefined) modelled.add(...stamp(lantern, lanterns, heightOf(lantern), true, owned))
		const hall = temple?.getObjectByName('Hall')
		if (hall !== undefined) modelled.add(...stamp(hall, halls, heightOf(hall), false, owned))
		const pagoda = temple?.getObjectByName('Pagoda')
		if (pagoda !== undefined) modelled.add(...stamp(pagoda, pagodas, heightOf(pagoda), false, owned))
		const pine = loaded.kit?.scene.getObjectByName('Pine')
		if (pine !== undefined) modelled.add(...stamp(pine, pines, heightOf(pine), true, owned))
	}).catch((error: unknown) => {
		console.warn('[bunbu] the mountain temple\'s models could not be read; the slopes stand without them', error)
	})

	return {
		frame(camera, x, z) {
			// The samurai's depth in view, less a little, so the gate he is passing under still shows.
			cut.value = Math.max(0, -samurai.set(x, 1, z).applyMatrix4(camera.matrixWorldInverse).z - 2.5)
		},

		follow(x, z) {
			ground.position.set(x, 0, z)
			backdrop.position.set(x, 0, z)
			peaks.position.set(x, 0, z)
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
