import { describe, expect, it } from 'vitest'
import { paceAfter, spokenWords, unheardPace, weightOf } from './pace.mts'

describe('the weight of a word', () => {
	it('is its letters, and the pause after it', () => {
		expect(weightOf('element')).toBe(8)
		expect(weightOf('element.')).toBe(8)
	})

	it('weighs numbers, spelled letters and signs inside a word more', () => {
		expect(weightOf('404')).toBeGreaterThan(weightOf('four'))
		expect(weightOf('HTTP')).toBeGreaterThan(weightOf('http'))
		expect(weightOf('node.js')).toBeGreaterThan(weightOf('nodejs'))
	})

	it('reads words in capitals of more than five letters as words', () => {
		expect(weightOf('DELETE')).toBe(weightOf('delete'))
	})
})

describe('the words of a line', () => {
	it('finds the start of every word and the weight before it', () => {
		expect(spokenWords(' one two  three')).toEqual({
			words: [{ start: 1, before: 0 }, { start: 5, before: 4 }, { start: 10, before: 8 }],
			weight: 14,
		})
	})
})

describe('the pace of a voice', () => {
	it('takes the first line it hears as the pace', () => {
		expect(paceAfter(unheardPace, 60, 3, 1)).toEqual({ perSecond: 20, heard: 1 })
	})

	it('measures the pace at speed 1, whatever the speed it heard', () => {
		expect(paceAfter(unheardPace, 60, 1.5, 2).perSecond).toBe(20)
	})

	it('follows the last lines', () => {
		const heard = [20, 20, 20].reduce((pace) => paceAfter(pace, 60, 3, 1), unheardPace)
		expect(paceAfter(heard, 60, 2, 1).perSecond).toBeCloseTo(70 / 3)
	})

	it('ignores light lines and lines cut short', () => {
		expect(paceAfter(unheardPace, 10, 0.5, 1)).toBe(unheardPace)
		expect(paceAfter(unheardPace, 60, 0.1, 1)).toBe(unheardPace)
		expect(paceAfter(unheardPace, 60, 60, 1)).toBe(unheardPace)
	})
})
