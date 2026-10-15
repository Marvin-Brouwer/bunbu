/**
 * The run's world: castle town from dusk to night, the samurai running its streets and gardens along a path
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
import { marksPassed } from '../state/run.mts'
import { framedIn, runFraming, viewOnPath } from './camera.mts'
import { skyRadius } from './landscape.mts'
import { createStageWorld } from './stages.mts'
import { selection } from '../../_shared/state/selection.mts'
import { createEffects } from './effects.mts'
import { createPetals } from '../../_shared/world/petals.mts'
import { createCharacter, ninjaLook, placeholderBody, samuraiLook, type Body } from '../../_shared/world/character.mts'
import { createFigureParts } from '../../_shared/world/figure.mts'
import { bladeLandsAfter, createNinjasView } from './ninjas.mts'
import { headingOf } from './placement.mts'
import { finishingOf, poseSeconds, type FigurePose } from '../../_shared/world/poses.mts'

/** Metres per half a running cycle: one step, matched to the run clip at the run's pace. */
const stepLength = 2.1

/** How quickly the camera and the samurai's heading settle, per second. */
const settle = 4

/** How far to move toward a target this frame, for `rate` per second, the same at any frame rate. */
const damp = (delta: number, rate = settle) => 1 - Math.exp(-rate * delta)

/** The short way round from `from` to `to`, in radians. */
const shortWay = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from))

/** How quickly the camera moves the fight into the room below the scroll and back, per second. */
const reframe = 3

/**
 * `roomBelow` is how many CSS pixels below the scroll an ambush keeps free for the fight
 * ([ambush room](../ambush-room.mts)); during an ambush the camera frames the fight in there.
 */
export function createRunWorld(game: RunGame, viewport: Viewport, roomBelow: () => number = () => 0): View {
	const { renderer, camera } = viewport
	const scene = new Scene()
	const overlay = new Scene()

	// The figures first, which the run waits on to look right; the town's trees after them.
	const samuraiModel = loadModel('samurai')
	const ninjaModel = loadModel('ninja')
	// The stage's own world, after the figures, so the figures' models are asked for first.
	const { path, view: stage, covers } = createStageWorld(selection.value.stage, scene, () => game.run.value.stageLength)

	const parts = createFigureParts()
	const fighters = new Group()
	scene.add(fighters)
	let samurai: Body = placeholderBody(parts, { body: 0x7a2a22, skin: 0xe2c4a0, band: 0x1f1c18, blade: 0xdfe3ea })
	fighters.add(samurai.root)
	let makeNinja = (): Body => placeholderBody(parts, { body: 0x2e2d38, skin: 0x2e2d38, band: 0xa3322a, blade: 0xb8bcc4 })
	const ninjas = createNinjasView(fighters, makeNinja)
	const effects = createEffects(scene, overlay)
	// A light fall of petals round the samurai, all along the run.
	const petals = createPetals(140, { width: 26, height: 9, depth: 26 })
	scene.add(petals.mesh)
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
	// What he shows, and what he showed when the store last changed his pose: hurt, he keeps showing
	// that while the blade is still on its way.
	let shown: { pose: FigurePose; time: number } = { pose: 'idle', time: 0 }
	let previous = shown
	let turnedTo = 0
	let first = true
	// From 0, the whole screen, to 1, the fight framed in the room below the scroll.
	let framed = 0
	const position = new Vector3()
	const target = new Vector3()
	const look = new Vector3()
	const lookAt = new Vector3()

	return {
		scene,
		overlay,

		draw(realDelta) {
			const run = game.run.value
			const shogun = game.shogun.value
			const ambush = game.ambush.value

			// Paused, or counting down to resume, the world holds still.
			const still = run.phase === 'paused' || run.countdown > 0
			const delta = still ? 0 : realDelta
			const worldDelta = delta * run.worldScale

			const here = path.at(run.distance)
			stage.follow(here.x, here.z, run.distance)
			stage.passTime(marksPassed(run), delta)

			if (shogun.sequence === seen) {
				since += delta
			} else {
				seen = shogun.sequence
				since = 0
				previous = shown
			}
			const cycle = (run.distance / stepLength) * Math.PI
			const fallen = shogun.pose === 'fallen'
			// Falling, the samurai is finished off first and goes down as the blade lands.
			const finish = fallen ? finishingOf(since) : undefined
			// Hurt, he takes the hit when the blade lands, not when the ninja starts its strike.
			const lands = shogun.pose === 'hurt' ? bladeLandsAfter(game.ninjas.value.active.some((ninja) => ninja.slicer === true)) : 0
			if (finish !== undefined) shown = finish.samurai
			else if (since < lands) shown = { pose: previous.pose, time: previous.time + since }
			else shown = { pose: shogun.pose, time: since - lands }
			samurai.show(shown.pose, shown.time, cycle)
			samurai.grey(finish?.samurai.pose === 'fallen' ? Math.min(1, finish.samurai.time / poseSeconds.fallen) : 0)

			// During an ambush the fight moves into the room below the scroll, if there is any; when
			// the scroll rolls up it fills the screen again.
			const { clientWidth: width, clientHeight: height } = renderer.domElement
			const below = roomBelow()
			framed = below > 0 ? framed + ((ambush.open ? 1 : 0) - framed) * damp(delta, reframe) : 0
			const frame = framedIn(width, height, height - (height - below) * framed, runFraming.fov)
			const view = viewOnPath(path, run.distance, frame.aspect, fallen)

			// The ninjas first: they keep the mark each came from after the ambush's options are gone.
			// They wind up to charge just before the time runs out.
			ninjas.draw(game.ninjas.value.active, ambush.options, ambush.kind, view.frame, delta, worldDelta, ambush.open && ambush.seconds > 0 ? ambush.secondsLeft : undefined, covers(run.distance))

			// He runs along the path, and turns toward the ninja he strikes, blocks or is hit by, who stands square
			// to the camera's way ahead.
			const aimed = shogun.target === undefined ? undefined : ninjas.markOf(shogun.target)
			const turnTo = (shogun.pose === 'strike' || shogun.pose === 'block' || shogun.pose === 'hurt') && aimed !== undefined
				? shortWay(here.heading, view.frame.heading + headingOf(aimed))
				: 0
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
			target.set(...view.position)
			lookAt.set(...view.look)
			if (first) {
				position.copy(target)
				look.copy(lookAt)
				first = false
			} else {
				// Held with the rest of the world while paused.
				position.lerp(target, damp(delta))
				look.lerp(lookAt, damp(delta))
			}
			camera.fov = frame.fov
			camera.aspect = width / frame.height
			if (frame.height === height) camera.clearViewOffset()
			else camera.setViewOffset(width, frame.height, 0, 0, width, height)
			camera.updateProjectionMatrix()
			camera.position.copy(position)
			camera.lookAt(look)
			camera.updateMatrixWorld()
			stage.frame?.(camera, here.x, here.z)

			// After the camera has turned, so the slash is square to the camera this frame is drawn with.
			const side = aimed === undefined ? 0 : Math.sign(Math.round(Math.sin(-headingOf(aimed)) * 10))
			effects.draw({
				x: here.x,
				z: here.z,
				heading: samurai.root.rotation.y,
				time: shogun.pose === 'strike' ? since : undefined,
				side,
			}, ninjas.slain(), ninjas.clashes(), camera)
			// Around where the camera looks, a little ahead of him; they drift on in slow motion too.
			petals.draw(worldDelta, { x: view.look[0], z: view.look[2] })
		},

		dispose() {
			// Routes come and go, so free what this world uploaded to the GPU.
			disposed = true
			ninjas.dispose()
			effects.dispose()
			petals.dispose()
			dropFinisher()
			samurai.dispose()
			parts.dispose()
			stage.dispose()
			scene.clear()
			overlay.clear()
			camera.fov = before.fov
			camera.far = before.far
			camera.clearViewOffset()
			camera.aspect = renderer.domElement.clientWidth / Math.max(1, renderer.domElement.clientHeight)
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
