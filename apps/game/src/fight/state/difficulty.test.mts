import { beforeEach, describe, expect, it } from 'vitest'
import { createDifficulties, timeScales, type Difficulties } from './difficulty.mts'

let difficulties: Difficulties

beforeEach(() => {
	difficulties = createDifficulties()
})

describe('difficulty', () => {
	it('starts every quiz as a samurai, with the full time', () => {
		expect(difficulties.value.of('a', '1')).toBe('samurai')
		expect(timeScales.samurai).toBe(1)
	})

	it('maps the difficulty to a timeScale, from 120% to 50%', () => {
		expect([timeScales.apprentice, timeScales.daimyo, timeScales.shogun]).toEqual([1.2, 0.8, 0.5])
	})

	it('is kept per quiz version', () => {
		difficulties.value.choose('a', '1', 'shogun')

		expect(difficulties.value.of('a', '1')).toBe('shogun')
		expect(difficulties.value.of('a', '2')).toBe('samurai')
		expect(difficulties.value.of('b', '1')).toBe('samurai')
	})

	it('keeps what was chosen this session over what was saved', () => {
		difficulties.value.choose('a', '1', 'daimyo')

		difficulties.value.restore({ [JSON.stringify(['a', '1'])]: 'apprentice', [JSON.stringify(['b', '1'])]: 'shogun' })

		expect(difficulties.value.of('a', '1')).toBe('daimyo')
		expect(difficulties.value.of('b', '1')).toBe('shogun')
	})
})
