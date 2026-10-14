/**
 * The world's plain-number parts: where the ninjas stand, how the figures move over time and how
 * far back the camera stands. The three.js side only applies these.
 */

import { DirectionalLight, Fog, HemisphereLight, PerspectiveCamera, Scene, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { marks } from '../../_shared/state/ambush.mts'
import { distanceFor } from '../../canvas/framing.mts'
import { cameraOf, runFraming, viewOnPath } from './camera.mts'
import { dayFade, fadeToward, passTime, sky, type Daylight, type Light } from './landscape.mts'
import { bladeLandsAfter, markOf } from './ninjas.mts'
import { beside, createPath, roundLength } from './path.mts'
import { headingOf, lungeOf, placementConfig, spotOf } from './placement.mts'
import { clipPlays, clipTimeOf, finishing, finishingOf, helmetFlight, helmetRest, helmetSeconds, hurtKnockBack, poseSeconds, rigOf } from '../../_shared/world/poses.mts'
import { runConfig } from '../state/run.mts'

describe('placement', () => {
	it('puts a ninja where its mark points on screen', () => {
		expect(spotOf('up', 0, 1).z).toBeLessThan(0)
		expect(spotOf('left', 0, 1).x).toBeLessThan(0)
		expect(spotOf('right', 0, 1).x).toBeGreaterThan(0)
		expect(spotOf('down', 0, 1).z).toBeGreaterThan(0)
	})

	it('brings them in from far away to within reach as the time runs out', () => {
		for (const mark of marks) {
			const far = spotOf(mark, 0, 0)
			const near = spotOf(mark, 0, 1)
			expect(Math.hypot(near.x, near.z)).toBeCloseTo(placementConfig.reach)
			expect(Math.hypot(far.x, far.z)).toBeGreaterThan(Math.hypot(near.x, near.z))
		}
	})

	it('starts them ahead of the samurai in a fan narrow enough for a phone', () => {
		for (const mark of marks.filter((each) => !each.startsWith('down'))) {
			const far = spotOf(mark, 1, 0)
			expect(far.z).toBeLessThan(-placementConfig.aside + 0.01)
			expect(Math.abs(far.x)).toBeLessThanOrEqual(placementConfig.wide + placementConfig.backRow)
		}
	})

	it('keeps the ninjas from behind between the samurai and the camera', () => {
		for (const aspect of [9 / 19.5, 3 / 4, 16 / 9]) {
			const [, , cameraZ] = cameraOf(aspect, false).position
			for (const mark of ['down-left', 'down', 'down-right'] as const) {
				for (const wave of [0, 1]) expect(spotOf(mark, wave, 0).z).toBeLessThan(cameraZ - 2)
			}
		}
	})

	it('has a striking ninja lunge in to land the hit, wherever the answer caught it', () => {
		expect(lungeOf(0.1, 0, 0.12)).toBeCloseTo(0.1)
		expect(lungeOf(0.1, 0.12, 0.12)).toBe(1)
		expect(lungeOf(0, 5, 0.12)).toBe(1)
		expect(lungeOf(0.1, 0.06, 0.12)).toBeGreaterThan(0.1)
	})

	it('stands the back row farther away', () => {
		expect(Math.abs(spotOf('up-left', 1, 1).x)).toBeGreaterThan(Math.abs(spotOf('up-left', 0, 1).x))
	})

	it('faces the samurai, and he faces back', () => {
		for (const mark of marks) {
			const spot = spotOf(mark, 0, 1)
			// A figure faces -z when not turned: turned by `facing`, it looks at the origin.
			const lookX = -Math.sin(spot.facing)
			const lookZ = -Math.cos(spot.facing)
			expect(lookX * -spot.x + lookZ * -spot.z).toBeCloseTo(placementConfig.reach)
			const heading = headingOf(mark)
			expect(-Math.sin(heading) * spot.x + -Math.cos(heading) * spot.z).toBeCloseTo(placementConfig.reach)
		}
	})

	it('finds a ninja its mark from its first option', () => {
		const ninja = { id: 1, wave: 0, options: [2], approach: 0, pose: 'approach', sequence: 0, chargeAs: 0 } as const
		const option = (mark: (typeof marks)[number]) => ({ answer: '', correct: false, mark, ninja: 1, pick: 0, source: 0, rank: 0 })
		expect(markOf(ninja, [option('left'), option('up'), option('right')], 'single')).toBe('right')
		// Committing clears the options; the world keeps the mark it last drew.
		expect(markOf(ninja, [], 'single')).toBeUndefined()
	})
})

describe('poses', () => {
	it('raises the sword, then cuts down, and holds there', () => {
		const raised = rigOf('strike', poseSeconds.strike * 0.4)
		const done = rigOf('strike', poseSeconds.strike)
		expect(raised.swordArm).toBeGreaterThan(Math.PI * 0.8)
		expect(done.swordArm).toBeLessThan(raised.swordArm)
		expect(rigOf('strike', 5)).toEqual(done)
	})

	it('runs in step with the cycle it is given, not the clock', () => {
		expect(rigOf('run', 0, Math.PI / 2).stride).toBeGreaterThan(0)
		expect(rigOf('run', 0, -Math.PI / 2).stride).toBeLessThan(0)
		expect(rigOf('run', 3, 1)).toEqual(rigOf('run', 0, 1))
	})

	it('goes down on one knee when fallen, and stays there', () => {
		expect(rigOf('fallen', 0).kneel).toBe(0)
		expect(rigOf('fallen', poseSeconds.fallen).kneel).toBe(1)
		expect(rigOf('fallen', 60)).toEqual(rigOf('fallen', poseSeconds.fallen))
	})

	it('lets go of the katana when fallen, and holds it in every other pose', () => {
		expect(rigOf('fallen', 0).drop).toBe(0)
		expect(rigOf('fallen', poseSeconds.fallen).drop).toBe(1)
		for (const pose of ['idle', 'run', 'strike', 'block', 'hurt'] as const) expect(rigOf(pose, 10, 1).drop).toBe(0)
	})

	it('lets a slain ninja lie, then fade', () => {
		expect(rigOf('slain', poseSeconds.slain).fade).toBe(1)
		expect(rigOf('slain', poseSeconds.slain + poseSeconds.slainFade + 1).fade).toBe(0)
	})

	it('knocks the samurai back and lights him up when a blade lands, then puts him back where he stood', () => {
		const struck = rigOf('hurt', 0)
		expect(struck.flash).toBe(1)
		const knocked = rigOf('hurt', poseSeconds.hurt * 0.25)
		expect(knocked.shift).toBeCloseTo(-hurtKnockBack)
		expect(knocked.flash).toBeLessThan(1)
		const recovered = rigOf('hurt', poseSeconds.hurt)
		expect(recovered.shift).toBeCloseTo(0)
		expect(recovered.flash).toBeCloseTo(0)
	})

	it('plays the whole hit before the run holds no longer, after an answer or when the time ran out', () => {
		expect(bladeLandsAfter(false) + poseSeconds.hurt).toBeLessThanOrEqual(runConfig.hitSeconds)
		expect(bladeLandsAfter(true) + poseSeconds.hurt).toBeLessThanOrEqual(runConfig.slicedSeconds)
	})

	it('knocks a blocked ninja back, and has a fleeing one run off and vanish', () => {
		expect(rigOf('blocked', poseSeconds.blocked).shift).toBeLessThan(0)
		expect(rigOf('fleeing', 0.6).turn).toBeCloseTo(Math.PI)
		expect(rigOf('fleeing', poseSeconds.fleeing).fade).toBe(0)
	})
})

describe('clips on the real model', () => {
	it('fits a one-off clip to the pose, whatever the clip\'s own length, and holds its end', () => {
		const duration = 0.83
		expect(clipTimeOf('strike', 0, 0, duration)).toBe(0)
		expect(clipTimeOf('strike', poseSeconds.strike / 2, 0, duration)).toBeCloseTo(duration / 2, 2)
		expect(clipTimeOf('strike', poseSeconds.strike, 0, duration)).toBeCloseTo(duration, 3)
		expect(clipTimeOf('strike', 10, 0, duration)).toBeLessThan(duration)
		expect(clipTimeOf('strike', 10, 0, duration)).toBe(clipTimeOf('strike', poseSeconds.strike, 0, duration))
	})

	it('runs in step with the cycle, which goes by distance, not the clock', () => {
		const duration = 0.54
		expect(clipTimeOf('run', 0, 0, duration)).toBe(0)
		expect(clipTimeOf('run', 0, Math.PI, duration)).toBeCloseTo(duration / 2)
		expect(clipTimeOf('run', 5, Math.PI * 4 + 1, duration)).toBeCloseTo(clipTimeOf('run', 0, 1, duration))
	})

	it('stops a block partway into its clip', () => {
		expect(clipTimeOf('block', 10, 0, 1)).toBeCloseTo(clipPlays.block.until ?? 1, 3)
	})

	it('has a clip for every pose, from the clips the model has', () => {
		const clips = new Set(['Death', 'Duck', 'HitReact', 'Idle', 'Run', 'Weapon'])
		for (const play of Object.values(clipPlays)) expect(clips).toContain(play.clip)
	})
})

describe('the fall', () => {
	it('has a ninja run in, then strike, and the samurai go down only as the blade lands', () => {
		expect(finishingOf(0).ninja).toMatchObject({ pose: 'approach', distance: finishing.from })
		expect(finishingOf(finishing.run).ninja).toMatchObject({ pose: 'strike', distance: finishing.reach })
		expect(finishingOf(finishing.run).samurai.pose).toBe('hurt')
		// Not hit again by the blade still on its way: he stands as the last hit left him.
		expect(rigOf('hurt', finishingOf(0).samurai.time)).toEqual(rigOf('hurt', poseSeconds.hurt))
		const down = finishingOf(finishing.run + poseSeconds.strike)
		expect(down.samurai.pose).toBe('fallen')
		expect(down.samurai.time).toBeGreaterThan(0)
	})

	it('holds at its end, the ninja standing over him', () => {
		expect(finishingOf(30).ninja.distance).toBe(finishing.reach)
		expect(clipTimeOf(finishingOf(30).ninja.pose, finishingOf(30).ninja.time, 0, 1)).toBe(clipTimeOf('strike', 99, 0, 1))
	})

	it('knocks the helmet up and back; it lands, bounces once and rests, the same at any frame rate', () => {
		const from = 1.6
		expect(helmetFlight(0, from)).toMatchObject({ back: 0, side: 0, height: from, tumble: 0 })
		expect(helmetFlight(0.1, from).height).toBeGreaterThan(from)
		const heights = Array.from({ length: 200 }, (_, step) => helmetFlight(step / 100, from).height)
		expect(Math.min(...heights)).toBeCloseTo(helmetRest)
		// Falling, it turns round once near the ground: one bounce, then it rests.
		const bounces = heights.filter((height, step) => {
			const before = heights[step - 1] ?? from
			const after = heights[step + 1] ?? height
			return height < before && height < after
		})
		expect(bounces).toHaveLength(1)
		expect(heights.at(-1)).toBe(helmetRest)
		expect(helmetFlight(helmetSeconds, from)).toEqual(helmetFlight(60, from))
		expect(helmetFlight(helmetSeconds, from).back).toBeGreaterThan(0.5)
	})
})

describe('framing', () => {
	const framing = { fov: 50, halfWidth: 2.6, closest: 6.5 }

	it('steps back on a narrow screen so the width still fits', () => {
		const portrait = distanceFor(9 / 19.5, framing)
		const halfWidthSeen = Math.tan((framing.fov * Math.PI) / 360) * (9 / 19.5) * portrait
		expect(halfWidthSeen).toBeCloseTo(framing.halfWidth)
	})

	it('never comes closer than the closest on a wide screen', () => {
		expect(distanceFor(16 / 9, framing)).toBe(framing.closest)
	})
})

describe('camera', () => {
	const shapes = { phone: 9 / 19.5, tablet: 3 / 4, desktop: 16 / 9 }

	/** Where a point lands on screen, from -1 to 1 either way. */
	function onScreen(aspect: number, point: Vector3): Vector3 {
		const camera = new PerspectiveCamera(runFraming.fov, aspect, 0.1, 200)
		const spot = cameraOf(aspect, false)
		camera.position.set(...spot.position)
		camera.lookAt(new Vector3(...spot.look))
		camera.updateMatrixWorld()
		return point.clone().project(camera)
	}

	for (const [shape, aspect] of Object.entries(shapes)) {
		it(`keeps every ninja in view on a ${shape}, from where they start to within reach`, () => {
			const offScreen: string[] = []
			for (const mark of marks) {
				for (const wave of [0, 1]) {
					for (const approach of [0, 0.25, 0.5, 0.75, 1]) {
						const spot = spotOf(mark, wave, approach)
						// The whole ninja: feet and head, either side of its body.
						for (const [side, height] of [[-0.4, 0], [0.4, 0], [-0.4, 1.9], [0.4, 1.9]] as const) {
							const seen = onScreen(aspect, new Vector3(spot.x + side, height, spot.z))
							if (Math.abs(seen.x) >= 0.95 || Math.abs(seen.y) >= 0.95 || seen.z >= 1) {
								offScreen.push(`${mark} wave ${wave} at ${approach}, ${height === 0 ? 'feet' : 'head'}`)
							}
						}
					}
				}
			}
			expect(offScreen).toEqual([])
		})

		it(`keeps every ninja in view on a ${shape} round the path's corners too`, () => {
			const path = createPath()
			const offScreen = new Set<string>()
			for (let distance = 0; distance < roundLength; distance++) {
				const view = viewOnPath(path, distance, aspect, false)
				const camera = new PerspectiveCamera(runFraming.fov, aspect, 0.1, 200)
				camera.position.set(...view.position)
				camera.lookAt(new Vector3(...view.look))
				camera.updateMatrixWorld()
				for (const mark of marks) {
					for (const wave of [0, 1]) {
						for (const approach of [0, 0.5, 1]) {
							const spot = spotOf(mark, wave, approach)
							for (const [side, height] of [[-0.4, 0], [0.4, 0], [-0.4, 1.9], [0.4, 1.9]] as const) {
								const at = beside(view.frame, spot.x + side, -spot.z)
								const seen = new Vector3(at.x, height, at.z).project(camera)
								if (Math.abs(seen.x) >= 0.95 || Math.abs(seen.y) >= 0.95 || seen.z >= 1) {
									offScreen.add(`${mark} wave ${wave} at ${approach}, ${distance} m in`)
								}
							}
						}
					}
				}
			}
			expect([...offScreen]).toEqual([])
		})
	}

	it('looks along the path on a straight, and stays behind the samurai round a corner', () => {
		const path = createPath()
		const [, height, back] = cameraOf(9 / 19.5, false).position
		const straight = viewOnPath(path, 40, 9 / 19.5, false)
		expect(straight.frame.heading).toBeCloseTo(0)
		expect(straight.position[1]).toBe(height)
		expect(straight.position[2]).toBeCloseTo(-40 + back)
		// Coming out of the first corner, the camera's way ahead is between the two streets'.
		const corner = viewOnPath(path, 80, 9 / 19.5, false)
		expect(corner.frame.heading).toBeGreaterThan(0)
		expect(corner.frame.heading).toBeLessThan(path.at(80).heading)
	})
})

describe('time passing', () => {
	const at = (fog: number, lamps: number): Light => ({
		skyTop: fog,
		skyHorizon: fog,
		fog,
		ambient: { sky: fog, ground: fog, intensity: 2 },
		sun: { colour: fog, intensity: 2 },
		lamps,
	})
	const daylight: Daylight = [at(0x000000, 0), at(0x808080, 0.5), at(0xffffff, 1), at(0xffffff, 1)]
	const litStage = () => {
		const scene = new Scene()
		const fog = new Fog(0x123456, 30, 150)
		let lamps = -1
		const lit = {
			scene,
			fog,
			backdrop: sky({ geometries: [], materials: [], textures: [] }, 0x123456, 0x123456),
			ambient: new HemisphereLight(),
			sun: new DirectionalLight(),
			lamps: (strength: number) => { lamps = strength },
		}
		return { lit, fog, lamps: () => lamps, pass: passTime(lit, daylight) }
	}

	it('fades one step of the day per dayFade seconds, and no further than the target', () => {
		expect(fadeToward(0, 1, dayFade / 2)).toBeCloseTo(0.5)
		expect(fadeToward(0.5, 1, dayFade)).toBe(1)
		expect(fadeToward(1, 3, dayFade)).toBe(2)
		expect(fadeToward(2, 0, dayFade)).toBe(1)
	})

	it('lights the stage as the first time of day at once', () => {
		const { fog, lamps } = litStage()
		expect(fog.color.getHex()).toBe(0x000000)
		expect(lamps()).toBe(0)
	})

	it('moves on after a mark, over a few seconds, and holds still with no time passing', () => {
		const { fog, lamps, pass } = litStage()
		pass(0, 0)
		pass(1, 0)
		expect(fog.color.getHex()).toBe(0x000000)
		pass(1, dayFade / 2)
		expect(lamps()).toBeCloseTo(0.25)
		pass(1, dayFade)
		expect(fog.color.getHex()).toBe(0x808080)
		expect(lamps()).toBe(0.5)
	})

	it('starts a run joined halfway at its own time of day', () => {
		const { fog, pass } = litStage()
		pass(2, 0)
		expect(fog.color.getHex()).toBe(0xffffff)
	})

	it('goes no further than the last time of day', () => {
		const { fog, lamps, pass } = litStage()
		pass(0, 0)
		for (let second = 0; second < dayFade * 5; second++) pass(3, 1)
		expect(fog.color.getHex()).toBe(0xffffff)
		expect(lamps()).toBe(1)
	})
})
