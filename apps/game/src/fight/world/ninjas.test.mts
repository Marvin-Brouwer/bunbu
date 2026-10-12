/**
 * How a ninja moves in the outcome: plain numbers, so the timing can be tested without three.js.
 */

import { describe, expect, it } from 'vitest'
import { clashSeconds, fleeSideOf, motionOf } from './ninjas.mts'

describe('a ninja in the outcome', () => {
	it('lunges in at once to land its hit', () => {
		expect(motionOf('strike', undefined, 0.3, 0)).toEqual({ approach: 0.3, pose: 'strike', time: 0, hop: 0 })
		expect(motionOf('strike', undefined, 0.3, 1)).toMatchObject({ approach: 1, hop: expect.closeTo(0) as number })
	})

	it('leaps in when it charges from far away, and hardly when it is close already', () => {
		const far = motionOf('strike', undefined, 0.3, 0.09).hop
		expect(far).toBeGreaterThan(0.2)
		expect(motionOf('strike', undefined, 0.95, 0.09).hop).toBeLessThan(far / 5)
	})

	it('lunges in and cuts before it is blocked, then is knocked back from in reach', () => {
		expect(motionOf('blocked', undefined, 0.2, clashSeconds / 2)).toMatchObject({ pose: 'strike', time: clashSeconds / 2 })
		expect(motionOf('blocked', undefined, 0.2, clashSeconds / 2).approach).toBeGreaterThan(0.2)
		expect(motionOf('blocked', undefined, 0.2, clashSeconds + 0.1)).toEqual({ approach: 1, pose: 'blocked', time: expect.closeTo(0.1) as number, hop: 0 })
		expect(motionOf('fleeing', undefined, 0.2, 0.5).approach).toBe(1)
	})

	it('cuts through the scroll from where it stands, then charges in alone to land the hit', () => {
		expect(motionOf('strike', true, 0.5, 0.1)).toEqual({ approach: 0.5, pose: 'strike', time: 0.1, hop: 0 })
		expect(motionOf('strike', true, 0.5, 0.75).approach).toBeGreaterThan(0.5)
		expect(motionOf('strike', true, 0.5, 2).approach).toBe(1)
	})

	it('winds up while the halves of the scroll fall, then flees from where it stands while the slicer strikes', () => {
		const waiting = motionOf('strike', false, 0.5, 0.3)
		expect(waiting).toMatchObject({ approach: 0.5, pose: 'strike', hop: 0 })
		expect(motionOf('strike', false, 0.5, 0.5)).toEqual(waiting)
		expect(motionOf('strike', false, 0.5, 0.75)).toEqual({ approach: 0.5, pose: 'fleeing', time: expect.closeTo(0.1) as number, hop: 0 })
	})
})

describe('a ninja done with its move', () => {
	it('flees straight after landing its hit, without waiting for the others', () => {
		expect(motionOf('strike', undefined, 0.3, 0.2).pose).toBe('strike')
		expect(motionOf('strike', undefined, 0.3, 0.6)).toMatchObject({ approach: 1, pose: 'fleeing' })
		expect(motionOf('strike', true, 0.3, 0.65 + 0.6)).toMatchObject({ approach: 1, pose: 'fleeing' })
	})

	it('flees straight after it is knocked back', () => {
		expect(motionOf('blocked', undefined, 0.3, clashSeconds + 0.1).pose).toBe('blocked')
		expect(motionOf('blocked', undefined, 0.3, clashSeconds + 0.5)).toMatchObject({ approach: 1, pose: 'fleeing' })
	})
})

describe('a fleeing ninja', () => {
	it('runs off on the side it stands, so the samurai does not run into it', () => {
		expect(fleeSideOf(2, 4)).toBe(1)
		expect(fleeSideOf(-2, 4)).toBe(-1)
	})

	it('picks a side by its id when it stands in the middle', () => {
		expect(fleeSideOf(0, 2)).toBe(1)
		expect(fleeSideOf(0.1, 3)).toBe(-1)
	})
})
