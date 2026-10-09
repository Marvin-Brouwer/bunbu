/**
 * The run's world: for now a grey floor that scrolls toward the camera, a cube standing in for the
 * samurai and boxes for the ninjas. The 3D track replaces the placeholders; the point of this
 * module is that rendering is read-only
 * ([rendering is read-only](../../../../docs/architecture/rendering.md#rendering-is-read-only)).
 *
 * It reads the run's stores every frame and never calls an action.
 */

import {
	AmbientLight,
	BoxGeometry,
	DirectionalLight,
	Mesh,
	MeshStandardMaterial,
	PlaneGeometry,
	Scene,
	type PerspectiveCamera,
} from 'three'
import type { RunGame } from './state/game.mts'
import type { View } from '../canvas/stage.mts'

/** How long one floor tile is, in metres. The floor scrolls within one tile and repeats. */
const tileLength = 4

export function createRunWorld(game: RunGame, camera: PerspectiveCamera): View {
	const scene = new Scene()

	scene.add(new AmbientLight(0xffffff, 1.4))
	const sun = new DirectionalLight(0xffffff, 1.8)
	sun.position.set(3, 6, 4)
	scene.add(sun)

	const floor = new Mesh(new PlaneGeometry(12, 120), new MeshStandardMaterial({ color: 0x8c8c86 }))
	floor.rotation.x = -Math.PI / 2
	scene.add(floor)

	const samurai = new Mesh(new BoxGeometry(0.6, 1.6, 0.6), new MeshStandardMaterial({ color: 0xcdb891 }))
	samurai.position.set(0, 0.8, 0)
	scene.add(samurai)

	// One geometry and material for every ninja: uploaded to the GPU once and shared.
	const ninjaGeometry = new BoxGeometry(0.5, 1.5, 0.5)
	const ninjaMaterial = new MeshStandardMaterial({ color: 0x3a3a46 })
	// Ninja id to its mesh: visual state derived from the store, never fed back.
	const meshes = new Map<number, Mesh>()

	camera.position.set(0, 2.4, 5)
	camera.lookAt(0, 1.2, -2)

	let bob = 0

	return {
		scene,

		draw(delta) {
			const { distance, phase, worldScale, recovery, countdown } = game.run.value
			// The path scrolls toward the camera; the samurai stays centred.
			floor.position.z = -(distance % tileLength)

			// He stands still during the 3-2-1 after a pause and while he holds after an ambush.
			const moving = countdown === 0 && ((phase === 'running' && recovery === 0) || phase === 'intro')
			bob += delta * worldScale * (moving ? 8 : 0)
			samurai.position.y = 0.8 + Math.abs(Math.sin(bob)) * 0.08
			samurai.rotation.z = game.shogun.value.pose === 'fallen' ? Math.PI / 2.5 : 0

			const active = game.ninjas.value.active
			for (const ninja of active) {
				let mesh = meshes.get(ninja.id)
				if (mesh === undefined) {
					mesh = new Mesh(ninjaGeometry, ninjaMaterial)
					meshes.set(ninja.id, mesh)
					scene.add(mesh)
				}
				// `approach` is 0 far away and 1 within reach, and it comes from the time left.
				mesh.position.set((ninja.id % 3) - 1, 0.75, -14 + ninja.approach * 11 + ninja.wave * 2)
				mesh.visible = ninja.pose !== 'slain'
			}
			for (const [id, mesh] of meshes) {
				if (active.some((ninja) => ninja.id === id)) continue
				scene.remove(mesh)
				meshes.delete(id)
			}
		},

		dispose() {
			// Routes come and go, so free what this world uploaded to the GPU.
			for (const mesh of [floor, samurai]) {
				mesh.geometry.dispose()
				mesh.material.dispose()
			}
			ninjaGeometry.dispose()
			ninjaMaterial.dispose()
			scene.clear()
			meshes.clear()
		},
	}
}
