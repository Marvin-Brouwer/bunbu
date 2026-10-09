/**
 * The run's world: castle town at dusk, the samurai running its streets and gardens along a path
 * that turns, the ninjas of the current ambush and the camera that follows him.
 *
 * The samurai and the ninjas start as placeholder figures and become the real model as soon as it
 * has loaded, so the run never waits on a download.
 *
 * Rendering is read-only ([rendering is read-only](../../../../../docs/architecture/rendering.md#rendering-is-read-only)):
 * it reads the run's stores every frame and never calls an action.
 */

import { ACESFilmicToneMapping, Group, PCFShadowMap, Scene, Vector3 } from 'three'
import { loadModel } from '../../canvas/models.mts'
import type { View } from '../../canvas/stage.mts'
import type { Viewport } from '../../canvas/viewport.mts'
import type { RunGame } from '../state/game.mts'
import { cameraOf, runFraming } from './camera.mts'
import { createCastleTown, skyRadius } from './castle-town.mts'
import { createCharacter, ninjaLook, placeholderBody, samuraiLook, type Body } from './character.mts'
import { createFigureParts } from './figure.mts'
import { createNinjasView } from './ninjas.mts'
import { createPath } from './path.mts'
import { headingOf } from './placement.mts'
import { finishingOf, poseSeconds } from './poses.mts'

/** Metres per half a running cycle: one step, matched to the run clip at the run's pace. */
const stepLength = 2.1

/** How quickly the camera and the samurai's heading settle, per second. */
const settle = 4

/** How far to move toward a target this frame, for `rate` per second, the same at any frame rate. */
const damp = (delta: number, rate = settle) => 1 - Math.exp(-rate * delta)

/** Metres of town past the end of the stage, so the run never runs off the edge. */
const beyond = 150

/** The short way round from `from` to `to`, in radians. */
const shortWay = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from))

export function createRunWorld(game: RunGame, viewport: Viewport): View {
	const { renderer, camera } = viewport
	const scene = new Scene()

	const length = Math.max(game.run.value.stageLength, 300) + beyond
	const path = createPath(length)
	// The figures first, which the run waits on to look right; the town's trees after them.
	const samuraiModel = loadModel('samurai')
	const ninjaModel = loadModel('ninja')
	const townModels = Promise.allSettled([samuraiModel, ninjaModel])
		.then(() => Promise.all([loadModel('maple'), loadModel('torii'), loadModel('bamboo')]))
		.then(([maple, torii, bamboo]) => ({ maple, torii, bamboo }))
	const stage = createCastleTown(scene, path, -60, length, townModels)

	const parts = createFigureParts()
	const fighters = new Group()
	scene.add(fighters)
	let samurai: Body = placeholderBody(parts, { body: 0x7a2a22, skin: 0xe2c4a0, band: 0x1f1c18, blade: 0xdfe3ea })
	fighters.add(samurai.root)
	let makeNinja = (): Body => placeholderBody(parts, { body: 0x2e2d38, skin: 0x2e2d38, band: 0xa3322a, blade: 0xb8bcc4 })
	const ninjas = createNinjasView(fighters, (distance) => path.at(distance), makeNinja)
	// The ninja that comes for the samurai when he falls: only there while he is down.
	let finisher: Body | undefined
	const dropFinisher = () => {
		if (finisher === undefined) return
		fighters.remove(finisher.root)
		finisher.dispose()
		finisher = undefined
	}

	let disposed = false
	// Each side swaps to its model on its own, so one that fails to load leaves the other be.
	void samuraiModel.then((model) => {
		if (disposed) return
		fighters.remove(samurai.root)
		samurai.dispose()
		samurai = createCharacter(model, samuraiLook)
		fighters.add(samurai.root)
	}).catch((error: unknown) => {
		console.warn('[bunbu] the samurai model did not load; the placeholder stays', error)
	})
	void ninjaModel.then((model) => {
		if (disposed) return
		makeNinja = () => createCharacter(model, ninjaLook)
		ninjas.remake(makeNinja)
		dropFinisher()
	}).catch((error: unknown) => {
		console.warn('[bunbu] the ninja model did not load; the placeholders stay', error)
	})

	// The renderer and camera are the viewport's, shared by every world: set them up for this one and
	// put them back as they were when it goes.
	const before = {
		fov: camera.fov,
		far: camera.far,
		position: camera.position.clone(),
		quaternion: camera.quaternion.clone(),
		shadows: renderer.shadowMap.enabled,
		shadowType: renderer.shadowMap.type,
		toneMapping: renderer.toneMapping,
		exposure: renderer.toneMappingExposure,
	}
	camera.fov = runFraming.fov
	// Far enough for the sky dome round the samurai, and no farther: the fog hides the rest.
	camera.far = skyRadius * 1.5
	camera.updateProjectionMatrix()
	renderer.shadowMap.enabled = true
	renderer.shadowMap.type = PCFShadowMap
	renderer.toneMapping = ACESFilmicToneMapping
	renderer.toneMappingExposure = 1.15

	let seen = -1
	let since = 0
	let turnedTo = 0
	let pathHeading = 0
	let first = true
	const position = new Vector3()
	const target = new Vector3()
	const look = new Vector3()
	const lookAt = new Vector3()

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

			const here = path.at(run.distance)
			stage.follow(here.x, here.z)

			if (shogun.sequence === seen) {
				since += delta
			} else {
				seen = shogun.sequence
				since = 0
			}
			const cycle = (run.distance / stepLength) * Math.PI
			const fallen = shogun.pose === 'fallen'
			// Falling, the samurai is finished off first and goes down as the blade lands.
			const finish = fallen ? finishingOf(since) : undefined
			if (finish === undefined) samurai.show(shogun.pose, since, cycle)
			else samurai.show(finish.samurai.pose, finish.samurai.time, cycle)
			samurai.grey(finish?.samurai.pose === 'fallen' ? Math.min(1, finish.samurai.time / poseSeconds.fallen) : 0)

			// The ninjas first: they keep the mark each came from after the ambush's options are gone.
			ninjas.draw(game.ninjas.value.active, ambush.options, run.distance, delta, worldDelta)

			// He runs along the path, and turns toward the ninja he strikes or blocks.
			const aimed = shogun.target === undefined ? undefined : ninjas.markOf(shogun.target)
			const turnTo = (shogun.pose === 'strike' || shogun.pose === 'block') && aimed !== undefined ? headingOf(aimed) : 0
			turnedTo += shortWay(turnedTo, turnTo) * damp(delta, 14)
			samurai.root.position.set(here.x, 0, here.z)
			samurai.root.rotation.y = here.heading + turnedTo

			if (finish === undefined) {
				dropFinisher()
			} else {
				if (finisher === undefined) {
					finisher = makeNinja()
					fighters.add(finisher.root)
				}
				// In front of him, the way he faces, running in and then striking.
				const facing = samurai.root.rotation.y
				const { distance: away, pose, time } = finish.ninja
				finisher.root.position.set(here.x - Math.sin(facing) * away, 0, here.z - Math.cos(facing) * away)
				finisher.root.rotation.y = facing + Math.PI
				finisher.show(pose, time, time * 14)
			}

			// The camera follows down the path behind him, so it never cuts through a house at a
			// corner, and it swings round the corners smoothly.
			pathHeading += shortWay(pathHeading, here.heading) * (first ? 1 : damp(delta, 3))
			const spot = cameraOf(camera.aspect, fallen)
			const [, height, back] = spot.position
			const ground = path.at(run.distance - back)
			target.set(ground.x, height, ground.z)
			const [, lookHeight, lookZ] = spot.look
			// `lookZ` is negative: that far ahead of him, along the way he is heading.
			lookAt.set(here.x + Math.sin(pathHeading) * lookZ, lookHeight, here.z + Math.cos(pathHeading) * lookZ)
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
			disposed = true
			ninjas.dispose()
			dropFinisher()
			samurai.dispose()
			parts.dispose()
			stage.dispose()
			scene.clear()
			camera.fov = before.fov
			camera.far = before.far
			camera.position.copy(before.position)
			camera.quaternion.copy(before.quaternion)
			camera.updateProjectionMatrix()
			renderer.shadowMap.enabled = before.shadows
			renderer.shadowMap.type = before.shadowType
			renderer.toneMapping = before.toneMapping
			renderer.toneMappingExposure = before.exposure
		},
	}
}
