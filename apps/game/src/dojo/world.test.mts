/** The training dummy's swing when the player misses: back, a rock or two, and still again. */

import { describe, expect, it } from 'vitest'
import { swingOf, swingSeconds } from './world.mts'

describe('training dummy', () => {
	it('stands still until a miss and once it has settled', () => {
		expect(swingOf(Number.POSITIVE_INFINITY)).toBe(0)
		expect(swingOf(-1)).toBe(0)
		expect(swingOf(0)).toBe(0)
		expect(swingOf(swingSeconds)).toBe(0)
	})

	it('is knocked back first, away from the player', () => {
		expect(swingOf(0.1)).toBeLessThan(-0.2)
	})

	it('rocks less and less', () => {
		const peaks = [0.14, 0.43, 0.71].map((time) => Math.abs(swingOf(time)))
		expect(peaks[1]).toBeLessThan(peaks[0] ?? 0)
		expect(peaks[2]).toBeLessThan(peaks[1] ?? 0)
		expect(Math.abs(swingOf(swingSeconds - 0.01))).toBeLessThan(0.01)
	})
})
