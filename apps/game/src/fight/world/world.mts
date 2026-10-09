/**
 * The run's world: the stage scrolling toward the camera, the samurai running down the middle of
 * the path, the ninjas of the current ambush and the camera that follows him. Placeholder figures
 * until the real models land (track F).
 *
 * Rendering is read-only ([rendering is read-only](../../../../../docs/architecture/rendering.md#rendering-is-read-only)):
 * it reads the run's stores every frame and never calls an action.
 */

import { Group, Scene, Vector3, type PerspectiveCamera } from 'three'
import type { View } from '../../canvas/stage.mts'
import type { RunGame } from '../state/game.mts'
import { cameraOf, runFraming } from './camera.mts'
import { createFigure, createFigureParts } from './figure.mts'
import { createNinjasView } from './ninjas.mts'
import { headingOf } from './placement.mts'
import { poseSeconds, rigOf } from './poses.mts'
import { createRiceFields } from './rice-fields.mts'

const samuraiColours = { body: 0x7a2a22, skin: 0xe2c4a0, band: 0x1f1c18, blade: 0xdfe3ea }

/** Metres per half a running cycle: one step. */
const stepLength = 1.4

/** How quickly the camera and the samurai's heading settle, per second. */
const settle = 4

/** Moves `from` toward `to` by a frame's share of `rate` per second, the same at any frame rate. */
const damp = (delta: number, rate = settle) => 1 - Math.exp(-rate * delta)

export function createRunWorld(game: RunGame, camera: PerspectiveCamera): View {
	const scene = new Scene()
	const stage = createRiceFields(scene)

	// The samurai stands still at the origin; the world moves past him.
	const parts = createFigureParts()
	const samurai = createFigure(parts, samuraiColours)
	const fighters = new Group()
	fighters.add(samurai.root)
	scene.add(fighters)
	const ninjas = createNinjasView(fighters, parts)

	let seen = -1
	let since = 0
	let heading = 0
	let first = true
	const position = new Vector3()
	const target = new Vector3()
	const look = new Vector3()
	const lookAt = new Vector3()

	if (camera.fov !== runFraming.fov) {
		camera.fov = runFraming.fov
		camera.updateProjectionMatrix()
	}

	return {
		scene,

		draw(realDelta) {
			const run = game.run.value
			const shogun = game.shogun.value
			const ambush = game.ambush.value

			// Paused, or counting down to resume, the world holds still.
			const still = run.phase === 'paused' || run.countdown > 0
			const delta = still ? 0 : realDelta
			const worldDelta = delta * run.worldScale

			stage.scroll(run.distance)

			if (shogun.sequence === seen) {
				since += delta
			} else {
				seen = shogun.sequence
				since = 0
			}
			samurai.pose(rigOf(shogun.pose, since, (run.distance / stepLength) * Math.PI))
			samurai.grey(shogun.pose === 'fallen' ? Math.min(1, since / poseSeconds.fallen) : 0)

			// The ninjas first: they keep the mark each came from after the ambush's options are gone.
			ninjas.draw(game.ninjas.value.active, ambush.options, run.distance, delta, worldDelta)

			// He turns toward the ninja he strikes or blocks, and back to the path after.
			const aimed = shogun.target === undefined ? undefined : ninjas.markOf(shogun.target)
			const turnTo = (shogun.pose === 'strike' || shogun.pose === 'block') && aimed !== undefined ? headingOf(aimed) : 0
			// The short way round.
			const turn = Math.atan2(Math.sin(turnTo - heading), Math.cos(turnTo - heading))
			heading += turn * damp(delta, 14)
			samurai.root.rotation.y = heading

			const spot = cameraOf(camera.aspect, shogun.pose === 'fallen')
			target.set(...spot.position)
			lookAt.set(...spot.look)
			if (first) {
				position.copy(target)
				look.copy(lookAt)
				first = false
			} else {
				// Held with the rest of the world while paused.
				position.lerp(target, damp(delta))
				look.lerp(lookAt, damp(delta))
			}
			camera.position.copy(position)
			camera.lookAt(look)
		},

		dispose() {
			// Routes come and go, so free what this world uploaded to the GPU.
			ninjas.dispose()
			samurai.dispose()
			parts.dispose()
			stage.dispose()
			scene.clear()
		},
	}
}
