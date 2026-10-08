import { beforeEach, describe, expect, it } from 'vitest'
import { settings, timeScales } from './settings.mts'

beforeEach(() => {
	settings.value.reset()
})

describe('settings', () => {
	it('maps the difficulty to a timeScale, with no limit for novice', () => {
		settings.value.setDifficulty('novice')
		expect(settings.value.timeScale()).toBeUndefined()
		settings.value.setDifficulty('master')
		expect(settings.value.timeScale()).toBe(timeScales.master)
	})
})
