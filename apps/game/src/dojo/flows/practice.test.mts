import type { BunbuData, Markdown } from '@bunbu/data'
import { describe, expect, it } from 'vitest'
import { fixtureQuiz } from '../../_temp/quiz.mts'
import { seeded } from '../../_temp/random.mts'
import { createPracticeGame } from '../state/practice.mts'
import { practiceOrder, preparePractice } from './practice.mts'

const all = fixtureQuiz.questions.map((_, index) => index)

describe('practiceOrder', () => {
	it('asks every question, in file order without random', () => {
		expect(practiceOrder(fixtureQuiz)).toEqual(all)
	})

	it('shuffles them with random', () => {
		expect(practiceOrder(fixtureQuiz, undefined, seeded(3)).toSorted((first, second) => first - second)).toEqual(all)
	})

	it('asks only the mistakes when they are given', () => {
		expect(practiceOrder(fixtureQuiz, [2, 0])).toEqual([2, 0])
	})

	it('leaves out a question no ambush can ask', () => {
		const many = Array.from({ length: 9 }, (_, index) => ({ answer: `${index}` as Markdown, correct: true }))
		const quiz: BunbuData = {
			...fixtureQuiz,
			questions: [...fixtureQuiz.questions, { type: 'multiple', query: 'All of them' as Markdown, options: many }],
		}
		expect(practiceOrder(quiz)).toEqual(all)
	})
})

describe('preparePractice', () => {
	it('loads the quiz on the start screen with a fresh tally', () => {
		const game = createPracticeGame({ tally: { right: 2, wrong: 1, missed: false } })
		preparePractice(game, fixtureQuiz, [1])
		expect(game.quiz.value.order).toEqual([1])
		expect(game.tally.value).toMatchObject({ right: 0, wrong: 0 })
		expect(game.session.value.phase).toBe('start')
	})
})

describe('session', () => {
	it('goes from the start screen into practice, pauses and resumes', () => {
		const { session } = createPracticeGame()
		session.value.pause()
		expect(session.value.phase).toBe('start')
		session.value.begin()
		session.value.pause()
		expect(session.value.phase).toBe('paused')
		session.value.resume()
		session.value.finish()
		expect(session.value.phase).toBe('done')
	})
})
