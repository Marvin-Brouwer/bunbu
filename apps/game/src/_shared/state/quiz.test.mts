import type { BunbuData, Markdown } from '@bunbu/data'
import { describe, expect, it } from 'vitest'
import { askStarts, questionsAnswered, questionsStarted, refsOf, refsOfAsk } from './quiz.mts'

const markdown = (text: string) => text as Markdown
const yesNo = { type: 'yes-no', query: markdown('?'), answer: 'yes' } as const
// Question 0 takes one ambush, question 1 three (a `solutions` question), question 2 one.
const quiz = {
	id: 'q',
	title: 'Q',
	version: '1',
	language: 'en',
	passingScore: 70,
	questions: [
		yesNo,
		{ type: 'solutions', query: markdown('?'), options: [0, 1, 2].map((each) => ({ answer: markdown(String(each)), correct: each === 0 })) },
		yesNo,
	],
} as unknown as BunbuData
const order = [0, 1, 2]
const at = (answered: number) => ({ quiz, order, answered })

describe('questions answered', () => {
	it('counts a question once every ambush of it is answered', () => {
		expect(questionsAnswered(at(0))).toBe(0)
		expect(questionsAnswered(at(1))).toBe(1)
		expect(questionsAnswered(at(4))).toBe(2)
		expect(questionsAnswered(at(5))).toBe(3)
	})

	it("doesn't count a question halfway through its rounds", () => {
		expect(questionsAnswered(at(2))).toBe(1)
		expect(questionsAnswered(at(3))).toBe(1)
	})
})

describe('a question asked again', () => {
	// Endless asks the only question of a quiz again and again: each time counts on its own.
	const one = { ...quiz, questions: [yesNo] } as unknown as BunbuData
	const again = [0, 0, 0]
	const refs = refsOf(one, again)

	it('counts every time it is asked, even with the same question each time', () => {
		expect(askStarts({ quiz: one, order: again })).toEqual([0, 1, 2, 3])
		expect(questionsStarted({ quiz: one, order: again, answered: 2 })).toBe(2)
		expect(questionsAnswered({ quiz: one, order: again, answered: 2 })).toBe(2)
	})

	it('keeps the rounds of one time apart from the others', () => {
		const twice = [1, 0, 1]
		const all = refsOf(quiz, twice)
		expect(refsOfAsk({ quiz, order: twice, refs: all }, 0)).toHaveLength(3)
		expect(refsOfAsk({ quiz, order: twice, refs: all }, 3)).toEqual([{ question: 0, part: 0 }])
		expect(refsOfAsk({ quiz, order: twice, refs: all }, 5)).toHaveLength(3)
		expect(refsOfAsk({ quiz: one, order: again, refs }, 1)).toEqual([{ question: 0, part: 0 }])
	})
})
