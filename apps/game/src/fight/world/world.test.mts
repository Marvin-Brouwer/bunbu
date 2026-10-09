/**
 * The world's plain-number parts: where the ninjas stand, how the figures move over time and how
 * far back the camera stands. The three.js side only applies these.
 */

import { PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { marks } from '../../_shared/state/ambush.mts'
import { distanceFor } from '../../canvas/framing.mts'
import { cameraOf, runFraming } from './camera.mts'
import { markOf } from './ninjas.mts'
import { headingOf, lungeOf, placementConfig, spotOf } from './placement.mts'
import { poseSeconds, rigOf } from './poses.mts'

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
		const ninja = { id: 1, wave: 0, options: [2], approach: 0, pose: 'approach', sequence: 0 } as const
		const option = (mark: (typeof marks)[number]) => ({ answer: '', correct: false, mark, ninja: 1, pick: 0, source: 0, rank: 0 })
		expect(markOf(ninja, [option('left'), option('up'), option('right')])).toBe('right')
		// Committing clears the options; the world keeps the mark it last drew.
		expect(markOf(ninja, [])).toBeUndefined()
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

	it('knocks a blocked ninja back, and has a fleeing one run off and vanish', () => {
		expect(rigOf('blocked', poseSeconds.blocked).shift).toBeLessThan(0)
		expect(rigOf('fleeing', 0.6).turn).toBeCloseTo(Math.PI)
		expect(rigOf('fleeing', poseSeconds.fleeing).fade).toBe(0)
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
			for (const mark of marks) {
				for (const wave of [0, 1]) {
					for (const approach of [0, 0.25, 0.5, 0.75, 1]) {
						const spot = spotOf(mark, wave, approach)
						// The whole ninja: feet and head, either side of its body.
						for (const [side, height] of [[-0.4, 0], [0.4, 0], [-0.4, 1.9], [0.4, 1.9]] as const) {
							const seen = onScreen(aspect, new Vector3(spot.x + side, height, spot.z))
							const where = `${mark} wave ${wave} at ${approach}, ${height === 0 ? 'feet' : 'head'}`
							expect(Math.abs(seen.x), where).toBeLessThan(0.95)
							expect(Math.abs(seen.y), where).toBeLessThan(0.95)
							expect(seen.z, where).toBeLessThan(1)
						}
					}
				}
			}
		})
	}
})
