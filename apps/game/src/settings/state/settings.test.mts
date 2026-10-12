import { beforeEach, describe, expect, it } from 'vitest'
import { settings } from './settings.mts'

beforeEach(() => {
	settings.value.reset()
})

describe('settings', () => {
	it('starts as a samurai, with the full time', () => {
		expect(settings.value.difficulty).toBe('samurai')
		expect(settings.value.timeScale()).toBe(1)
	})

	it('maps the difficulty to a timeScale, from 120% to 50%', () => {
		settings.value.setDifficulty('apprentice')
		expect(settings.value.timeScale()).toBe(1.2)
		settings.value.setDifficulty('daimyo')
		expect(settings.value.timeScale()).toBe(0.8)
		settings.value.setDifficulty('shogun')
		expect(settings.value.timeScale()).toBe(0.5)
	})
})
