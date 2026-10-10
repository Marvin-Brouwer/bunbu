/**
 * The title screen's world ([1 Title](../../../../docs/design/screens.md#1-title--menu)): the
 * samurai idling under a torii at dusk, with petals falling. It sits between the name at the top
 * and the menu at the bottom.
 *
 * Like the run, it shows placeholders until the models have loaded, each on its own.
 */

import {
	ACESFilmicToneMapping,
	BackSide,
	Box3,
	CircleGeometry,
	Color,
	DirectionalLight,
	Fog,
	Group,
	HemisphereLight,
	Mesh,
	MeshStandardMaterial,
	Scene,
	ShaderMaterial,
	SphereGeometry,
	Vector3,
	type Object3D,
} from 'three'
import { distanceFor, type Framing } from '../canvas/framing.mts'
import { loadModel } from '../canvas/models.mts'
import type { View } from '../canvas/stage.mts'
import type { Viewport } from '../canvas/viewport.mts'
import { createCharacter, placeholderBody, samuraiLook, type Body } from '../_shared/world/character.mts'
import { createFigureParts } from '../_shared/world/figure.mts'
import { createPetals } from '../_shared/world/petals.mts'

const palette = {
	skyTop: 0x161a3a,
	skyHorizon: 0xd9805a,
	fog: 0x6e4d5c,
	ground: 0x3e352f,
}

/** The samurai and the torii must fit side to side, on a narrow phone too. */
export const titleFraming: Framing = { fov: 40, halfWidth: 3.4, closest: 9 }

/** Metres the torii stands behind the samurai, and how tall it is. */
const toriiBehind = 2.6
const toriiHeight = 5.2

/**
 * Where the camera looks, as a height on the samurai. Below him, so he stands in the upper middle of
 * the screen, in the gap between the name and the menu.
 */
const lookHeight = -0.6

function skyDome(): Mesh {
	const geometry = new SphereGeometry(60, 24, 12)
	const material = new ShaderMaterial({
		side: BackSide,
		depthWrite: false,
		fog: false,
		uniforms: {
			top: { value: new Color(palette.skyTop) },
			horizon: { value: new Color(palette.skyHorizon) },
		},
		vertexShader: 'varying vec3 vPosition; void main() { vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
		fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vPosition; void main() { float h = clamp(normalize(vPosition).y * 2.4, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, h), 1.0);\n#include <colorspace_fragment>\n}',
	})
	const mesh = new Mesh(geometry, material)
	mesh.renderOrder = -10
	return mesh
}

/** `model` scaled to `height` metres, standing on the ground and centred. */
function standing(model: Object3D, height: number): Group {
	model.updateMatrixWorld(true)
	const bounds = new Box3().setFromObject(model)
	const centre = bounds.getCenter(new Vector3())
	const scale = height / Math.max(bounds.max.y - bounds.min.y, 1e-3)
	const holder = new Group()
	holder.add(model)
	model.position.set(-centre.x, -bounds.min.y, -centre.z)
	holder.scale.setScalar(scale)
	return holder
}

export function createTitleWorld(viewport: Viewport): View {
	const { renderer, camera } = viewport
	const scene = new Scene()
	scene.fog = new Fog(palette.fog, 14, 45)
	const sky = skyDome()
	scene.add(sky)

	scene.add(new HemisphereLight(0xb0b4e0, 0x4a3a30, 2.2))
	const sun = new DirectionalLight(0xffb27a, 2.6)
	sun.position.set(-6, 9, 5)
	sun.castShadow = true
	sun.shadow.mapSize.set(1024, 1024)
	for (const side of ['left', 'bottom'] as const) sun.shadow.camera[side] = -6
	for (const side of ['right', 'top'] as const) sun.shadow.camera[side] = 6
	sun.shadow.bias = -0.0008
	scene.add(sun)

	const groundGeometry = new CircleGeometry(50, 32).rotateX(-Math.PI / 2)
	const groundMaterial = new MeshStandardMaterial({ color: palette.ground, roughness: 1 })
	const ground = new Mesh(groundGeometry, groundMaterial)
	ground.receiveShadow = true
	scene.add(ground)

	const parts = createFigureParts()
	let samurai: Body = placeholderBody(parts, { body: 0x7a2a22, skin: 0xe2c4a0, band: 0x1f1c18, blade: 0xdfe3ea })
	scene.add(samurai.root)
	// Turned a little toward the light, so he reads as a figure rather than a silhouette.
	const facing = Math.PI - 0.35

	const petals = createPetals(120, { width: 14, height: 8, depth: 10 })
	scene.add(petals.mesh)

	let disposed = false
	const torii = new Group()
	torii.position.z = -toriiBehind
	scene.add(torii)
	void loadModel('torii').then((model) => {
		if (disposed) return
		const gate = standing(model.scene.clone(), toriiHeight)
		gate.traverse((object) => {
			if (object instanceof Mesh) object.castShadow = true
		})
		torii.add(gate)
	}).catch((error: unknown) => {
		console.warn('[bunbu] the torii did not load; the samurai stands alone', error)
	})
	void loadModel('samurai').then((model) => {
		if (disposed) return
		scene.remove(samurai.root)
		samurai.dispose()
		samurai = createCharacter(model, samuraiLook)
		scene.add(samurai.root)
	}).catch((error: unknown) => {
		console.warn('[bunbu] the samurai model did not load; the placeholder stays', error)
	})

	const before = {
		fov: camera.fov,
		far: camera.far,
		position: camera.position.clone(),
		quaternion: camera.quaternion.clone(),
		shadows: renderer.shadowMap.enabled,
		toneMapping: renderer.toneMapping,
		exposure: renderer.toneMappingExposure,
	}
	camera.fov = titleFraming.fov
	camera.far = 100
	camera.updateProjectionMatrix()
	renderer.shadowMap.enabled = true
	renderer.toneMapping = ACESFilmicToneMapping
	renderer.toneMappingExposure = 1.1

	let time = 0

	return {
		scene,

		draw(delta) {
			time += delta
			samurai.show('idle', time, 0)
			samurai.root.rotation.y = facing

			// A slow breath of the camera from side to side, so the still scene is alive.
			const distance = distanceFor(camera.aspect, titleFraming)
			const sway = Math.sin(time * 0.15) * 0.35
			camera.position.set(sway * distance * 0.1, 1.9, distance)
			camera.lookAt(0, lookHeight + 1.6, 0)

			petals.draw(delta, { x: 0, z: 0 })
		},

		dispose() {
			disposed = true
			samurai.dispose()
			parts.dispose()
			petals.dispose()
			groundGeometry.dispose()
			groundMaterial.dispose()
			sky.geometry.dispose()
			;(sky.material as ShaderMaterial).dispose()
			sun.dispose()
			scene.clear()
			camera.fov = before.fov
			camera.far = before.far
			camera.position.copy(before.position)
			camera.quaternion.copy(before.quaternion)
			camera.updateProjectionMatrix()
			renderer.shadowMap.enabled = before.shadows
			renderer.toneMapping = before.toneMapping
			renderer.toneMappingExposure = before.exposure
		},
	}
}
