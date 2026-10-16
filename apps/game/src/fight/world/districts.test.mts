import { describe, expect, it } from 'vitest'
import { metresPerAmbush } from '../flows/run.mts'
import { districtAt, districtConfig, districtsOf } from './districts.mts'

describe('the districts of a stage', () => {
	it('are as many as fit the fewest questions each, up to four, from the first to the last', () => {
		expect(districtsOf(4)).toEqual([0])
		expect(districtsOf(10)).toEqual([0, 3])
		expect(districtsOf(15)).toEqual([0, 2, 3])
		expect(districtsOf(20)).toEqual([0, 1, 2, 3])
		expect(districtsOf(260)).toEqual([0, 1, 2, 3])
	})

	it('go one after another along the stage, each a quarter of a long one', () => {
		const length = 40 * metresPerAmbush
		expect(districtAt(100, length)).toEqual({ from: 0, to: 0, mix: 0 })
		expect(districtAt(length * 0.4, length)).toEqual({ from: 1, to: 1, mix: 0 })
		expect(districtAt(length * 0.6, length)).toEqual({ from: 2, to: 2, mix: 0 })
		expect(districtAt(length * 0.9, length)).toEqual({ from: 3, to: 3, mix: 0 })
		// The samurai runs on past the end in the last ambush.
		expect(districtAt(length + 50, length)).toEqual({ from: 3, to: 3, mix: 0 })
	})

	it('fade into the next over a stretch of path round where they meet, not at the mark', () => {
		const length = 40 * metresPerAmbush
		const meet = length / 4
		const half = districtConfig.blend / 2
		expect(districtAt(meet - half - 1, length).mix).toBe(0)
		expect(districtAt(meet, length)).toEqual({ from: 0, to: 1, mix: 0.5 })
		const later = districtAt(meet + half / 2, length)
		expect(later.from).toBe(0)
		expect(later.mix).toBeCloseTo(0.75)
		expect(districtAt(meet + half + 1, length)).toEqual({ from: 1, to: 1, mix: 0 })
	})

	it('is the first all the way before the run has a length, or for a short test', () => {
		expect(districtAt(500, 0)).toEqual({ from: 0, to: 0, mix: 0 })
		expect(districtAt(400, 4 * metresPerAmbush)).toEqual({ from: 0, to: 0, mix: 0 })
	})
})
