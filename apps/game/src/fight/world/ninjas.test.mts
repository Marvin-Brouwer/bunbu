/**
 * How a ninja moves in the outcome: plain numbers, so the timing can be tested without three.js.
 */

import { describe, expect, it } from 'vitest'
import { clashSeconds, motionOf, slicerRunSeconds } from './ninjas.mts'

describe('a ninja in the outcome', () => {
	it('lunges in at once to land its hit', () => {
		expect(motionOf('strike', undefined, 0.3, 0)).toEqual({ approach: 0.3, pose: 'strike', time: 0 })
		expect(motionOf('strike', undefined, 0.3, 1).approach).toBe(1)
	})

	it('lunges in and cuts before it is blocked, then is knocked back from in reach', () => {
		expect(motionOf('blocked', undefined, 0.2, clashSeconds / 2)).toMatchObject({ pose: 'strike', time: clashSeconds / 2 })
		expect(motionOf('blocked', undefined, 0.2, clashSeconds / 2).approach).toBeGreaterThan(0.2)
		expect(motionOf('blocked', undefined, 0.2, clashSeconds + 0.1)).toEqual({ approach: 1, pose: 'blocked', time: expect.closeTo(0.1) as number })
		expect(motionOf('fleeing', undefined, 0.2, 0.5).approach).toBe(1)
	})

	it('runs back in from mid screen when it sliced the scroll, and only then strikes', () => {
		// Cutting through the scroll first.
		expect(motionOf('strike', true, 0.9, 0.1)).toMatchObject({ pose: 'strike', time: 0.1 })
		const running = motionOf('strike', true, 0.9, 0.65 + slicerRunSeconds / 2)
		expect(running.pose).toBe('approach')
		expect(running.approach).toBeGreaterThan(0)
		expect(running.approach).toBeLessThan(1)
		expect(motionOf('strike', true, 0.9, 0.65 + slicerRunSeconds + 0.1)).toMatchObject({ approach: 1, pose: 'strike' })
	})

	it('waits for the halves of the scroll to fall before the others strike', () => {
		expect(motionOf('strike', false, 0.9, 0.3)).toEqual({ approach: 0.9, pose: 'approach', time: 0.3 })
		expect(motionOf('strike', false, 0.9, 1).pose).toBe('strike')
	})
})
