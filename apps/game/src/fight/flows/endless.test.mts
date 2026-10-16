import { describe, expect, it } from 'vitest'
import { endlessStage, stageAt, stageQuestions, stageStart } from './endless.mts'
import { ambushAt } from './run.mts'

describe('the stages of endless', () => {
	it('are a test of the quiz each: questionsPerTest, or every question', () => {
		expect(stageQuestions({ questions: { length: 40 } })).toBe(40)
		expect(stageQuestions({ questionsPerTest: 10, questions: { length: 40 } })).toBe(10)
		expect(stageQuestions({ questionsPerTest: 60, questions: { length: 40 } })).toBe(40)
	})

	it('go from Rice fields to Edo castle, and round again', () => {
		expect([0, 1, 4, 5, 9].map(endlessStage)).toEqual(['rice-fields', 'bamboo-forest', 'edo-castle', 'rice-fields', 'edo-castle'])
	})

	it('change halfway between the last ambush of one and the first of the next', () => {
		const questions = 10
		// The ambushes after 0 to 9 questions asked are the first stage's, the one after 10 the second's.
		expect(stageAt(ambushAt(9), questions)).toBe(0)
		expect(stageAt(ambushAt(10), questions)).toBe(1)
		expect(stageAt(stageStart(1, questions) - 0.01, questions)).toBe(0)
		expect(stageAt(stageStart(1, questions), questions)).toBe(1)
		expect(stageAt(stageStart(7, questions) + 1, questions)).toBe(7)
		expect(stageStart(0, questions)).toBe(0)
	})

})
