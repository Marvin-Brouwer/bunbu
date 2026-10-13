import { describe, expect, it } from 'vitest'
import { missedQuestions } from './mistakes.mts'

describe('missedQuestions', () => {
	it('counts a question with several missed rounds once, in the order missed', () => {
		expect(missedQuestions([
			{ at: { question: 4, part: 0 }, outcome: 'wrong', picked: [0] },
			{ at: { question: 2, part: 1 }, outcome: 'wrong', picked: [1] },
			{ at: { question: 2, part: 0 }, outcome: 'unanswered', picked: [] },
		])).toEqual([4, 2])
	})

	it('has none without misses', () => {
		expect(missedQuestions([])).toEqual([])
	})
})
