/**
 * The world: for now a grey floor that scrolls toward the camera and a cube standing in for the
 * samurai. The 3D track replaces the placeholders; the point of this module is that rendering is
 * read-only ([rendering is read-only](../../../../docs/architecture/rendering.md#rendering-is-read-only)).
 *
 * It reads the stores every frame and never calls an action.
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
import { ninjas } from '../state/ninjas.mts'
import { run } from '../state/run.mts'
import { shogun } from '../state/shogun.mts'

/** How long one floor tile is, in metres. The floor scrolls within one tile and repeats. */
const tileLength = 4

export type World = {
	readonly scene: Scene
	/** Reads the stores and makes the scene match. Called once per frame. */
	update(dt: number): void
	dispose(): void
}

export function createWorld(camera: PerspectiveCamera): World {
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

	const ninjaMesh = () => new Mesh(new BoxGeometry(0.5, 1.5, 0.5), new MeshStandardMaterial({ color: 0x3a3a46 }))
	// Ninja id to its mesh: visual state derived from the store, never fed back.
	const meshes = new Map<number, Mesh>()

	camera.position.set(0, 2.4, 5)
	camera.lookAt(0, 1.2, -2)

	let bob = 0

	return {
		scene,

		update(dt) {
			const { distance, phase, worldScale } = run.get()
			// The path scrolls toward the camera; the samurai stays centred.
			floor.position.z = -(distance % tileLength)

			bob += dt * worldScale * (phase === 'running' || phase === 'intro' ? 8 : 0)
			samurai.position.y = 0.8 + Math.abs(Math.sin(bob)) * 0.08
			samurai.rotation.z = shogun.get().pose === 'fallen' ? Math.PI / 2.5 : 0

			const active = ninjas.get().active
			for (const ninja of active) {
				let mesh = meshes.get(ninja.id)
				if (mesh === undefined) {
					mesh = ninjaMesh()
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
			scene.clear()
			meshes.clear()
		},
	}
}
