/**
 * The effects' timing: when the slash trail is drawn and gone, and how the ink splash bursts,
 * falls and fades. Plain numbers, so it plays the same at any frame rate.
 */

import { describe, expect, it } from 'vitest'
import { clashOf, clashTiming, inkTiming, slashOf, slashTiming, splashOf } from './effects.mts'
import { poseSeconds } from '../../_shared/world/poses.mts'

describe('slash trail', () => {
	it('is not there before the blade starts across, nor once it has faded', () => {
		expect(slashOf(0)).toBeUndefined()
		expect(slashOf(slashTiming.fadeFrom + slashTiming.fade)).toBeUndefined()
	})

	it('sweeps across, then fades', () => {
		const start = slashOf(slashTiming.from)
		const across = slashOf(slashTiming.from + slashTiming.sweep)
		const fading = slashOf(slashTiming.fadeFrom + slashTiming.fade / 2)
		expect(start?.sweep).toBe(0)
		expect(across).toEqual({ sweep: 1, opacity: 1 })
		expect(fading?.sweep).toBe(1)
		expect(fading?.opacity).toBeCloseTo(0.5)
	})

	it('has gone before the strike would play again', () => {
		expect(slashTiming.fadeFrom + slashTiming.fade).toBeLessThan(poseSeconds.strike * 2)
	})
})

describe('ink splash', () => {
	it('bursts quickly and then fades away', () => {
		expect(splashOf(1, 0).burst.size).toBeLessThan(splashOf(1, inkTiming.burst).burst.size)
		expect(splashOf(1, 0).burst.opacity).toBeGreaterThan(0.5)
		expect(splashOf(1, inkTiming.burstFadeFrom + inkTiming.burstFade).burst.opacity).toBe(0)
	})

	it('throws drops that land on the ground and stay there', () => {
		const late = splashOf(3, 1)
		const later = splashOf(3, 1.05)
		expect(late.drops).toHaveLength(inkTiming.drops)
		for (const [index, drop] of late.drops.entries()) {
			expect(drop.y).toBeCloseTo(0.03)
			expect(later.drops[index]?.x).toBe(drop.x)
		}
		// Thrown out, not straight down.
		expect(late.drops.some((drop) => Math.hypot(drop.x, drop.z) > 0.5)).toBe(true)
	})

	it('leaves a stain that fades with the slain ninja', () => {
		const lying = splashOf(1, 0.8)
		expect(lying.stain.opacity).toBeGreaterThan(0.5)
		expect(lying.stain.size).toBeGreaterThan(1)
		const gone = poseSeconds.slain + poseSeconds.slainFade + 0.4
		expect(splashOf(1, inkTiming.stainFadeFrom + inkTiming.stainFade).stain.opacity).toBe(0)
		expect(inkTiming.stainFadeFrom + inkTiming.stainFade).toBeLessThanOrEqual(gone + 0.2)
	})

	it('splashes differently for each ninja, the same every time', () => {
		expect(splashOf(1, 0.2)).toEqual(splashOf(1, 0.2))
		expect(splashOf(1, 0.2).drops[0]).not.toEqual(splashOf(2, 0.2).drops[0])
	})
})

describe('clash flash', () => {
	it('flares up where the blades meet, then fades out', () => {
		const flare = clashOf(clashTiming.grow)
		expect(flare?.opacity).toBe(1)
		expect(flare?.size).toBeCloseTo(clashTiming.size)
		expect(clashOf(0)?.size).toBeLessThan(clashTiming.size)
		expect(clashOf(clashTiming.fadeFrom + clashTiming.fade / 2)?.opacity).toBeCloseTo(0.5)
		expect(clashOf(clashTiming.fadeFrom + clashTiming.fade)).toBeUndefined()
		expect(clashOf(-0.1)).toBeUndefined()
	})
})
