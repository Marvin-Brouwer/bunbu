import { beforeEach, describe, expect, it } from 'vitest'
import { settings, timeScales } from './settings.mts'

beforeEach(() => {
	settings.reset()
})

describe('settings', () => {
	it('maps the difficulty to a timeScale, with no limit for novice', () => {
		settings.setDifficulty('novice')
		expect(settings.timeScale()).toBeUndefined()
		settings.setDifficulty('master')
		expect(settings.timeScale()).toBe(timeScales.master)
	})
})
