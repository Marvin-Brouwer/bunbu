import { beforeEach, describe, expect, it } from 'vitest'
import { placeOf, settings, timeScaleAt, timeScales } from './settings.mts'

beforeEach(() => {
	settings.value.reset()
})

describe('settings', () => {
	it('starts in the middle of the difficulty slider', () => {
		expect(settings.value.timeScale).toBe(timeScales.middle)
	})

	it('keeps the timeScale between Shogun and Apprentice', () => {
		settings.value.setTimeScale(3)
		expect(settings.value.timeScale).toBe(timeScales.apprentice)
		settings.value.setTimeScale(0)
		expect(settings.value.timeScale).toBe(timeScales.shogun)
	})
})

describe('the difficulty slider', () => {
	it('runs from 120% through 100% in the middle to 50%', () => {
		expect(timeScaleAt(0)).toBe(1.2)
		expect(timeScaleAt(0.25)).toBeCloseTo(1.1)
		expect(timeScaleAt(0.5)).toBe(1)
		expect(timeScaleAt(0.75)).toBeCloseTo(0.75)
		expect(timeScaleAt(1)).toBe(0.5)
	})

	it('finds the place of a timeScale again', () => {
		for (const place of [0, 0.2, 0.5, 0.65, 1]) expect(placeOf(timeScaleAt(place))).toBeCloseTo(place)
	})
})
