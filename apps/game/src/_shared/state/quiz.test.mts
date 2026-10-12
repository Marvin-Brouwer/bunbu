import { describe, expect, it } from 'vitest'
import { questionsAnswered, type QuestionRef } from './quiz.mts'

// Question 0 takes one ambush, question 1 three (a `solutions` question), question 2 one.
const refs: readonly QuestionRef[] = [
	{ question: 0, part: 0 },
	{ question: 1, part: 0 },
	{ question: 1, part: 1 },
	{ question: 1, part: 2 },
	{ question: 2, part: 0 },
]

describe('questions answered', () => {
	it('counts a question once every ambush of it is answered', () => {
		expect(questionsAnswered({ refs, answered: 0 })).toBe(0)
		expect(questionsAnswered({ refs, answered: 1 })).toBe(1)
		expect(questionsAnswered({ refs, answered: 4 })).toBe(2)
		expect(questionsAnswered({ refs, answered: 5 })).toBe(3)
	})

	it("doesn't count a question halfway through its rounds", () => {
		expect(questionsAnswered({ refs, answered: 2 })).toBe(1)
		expect(questionsAnswered({ refs, answered: 3 })).toBe(1)
	})
})
