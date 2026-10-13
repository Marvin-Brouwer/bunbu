import type { BunbuData, Markdown } from '@bunbu/data'
import { describe, expect, it } from 'vitest'
import { fixtureQuiz } from '../../_temp/quiz.mts'
import { seeded } from '../../_temp/random.mts'
import { createPracticeGame, percentRight, type PracticeGame } from '../state/practice.mts'
import { beginPractice, commitPractice, continuePractice, nextQuestionSeconds, practiceOrder, practiseAgain, preparePractice, progressOf, tickPractice } from './practice.mts'

/** Picks the right answer on the open ambush: every correct option, in its place for `order`. */
function pickRight(game: PracticeGame): void {
	const { kind, options } = game.ambush.value
	const right = kind === 'order'
		? options.filter((option) => option.rank > 0).toSorted((first, second) => first.rank - second.rank)
		: options.filter((option) => option.correct)
	for (const option of right) game.ambush.value.pick(option.mark)
}

/** Picks a wrong answer on the open ambush. */
function pickWrong(game: PracticeGame): void {
	const wrong = game.ambush.value.options.find((option) => !option.correct)
	if (wrong !== undefined) game.ambush.value.pick(wrong.mark)
}

const all = fixtureQuiz.questions.map((_, index) => index)

describe('practiceOrder', () => {
	it('asks every question, in file order without random', () => {
		expect(practiceOrder(fixtureQuiz)).toEqual(all)
	})

	it('shuffles them with random', () => {
		const shuffled = practiceOrder(fixtureQuiz, undefined, seeded(3))
		expect(shuffled).not.toEqual(all)
		expect(shuffled.toSorted((first, second) => first - second)).toEqual(all)
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
		const game = createPracticeGame({ tally: { right: 2, wrong: 1, missed: undefined } })
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
		expect(session.value.phase).toBe('practising')
		session.value.finish()
		expect(session.value.phase).toBe('done')
	})
})

describe('practice', () => {
	const started = (missed?: readonly number[]) => {
		const game = createPracticeGame()
		preparePractice(game, fixtureQuiz, missed)
		beginPractice(game, seeded(1))
		return game
	}

	it('opens the first question on Start, without a time limit', () => {
		const game = started()
		expect(game.session.value.phase).toBe('practising')
		expect(game.ambush.value).toMatchObject({ open: true, at: { question: 0, part: 0 }, seconds: 0, openingLeft: 0 })
		expect(progressOf(game, game.ambush.value.at)).toBe('1 / 4')
	})

	it('counts a right answer and opens the next question once the scroll has rolled up', () => {
		const game = started()
		pickRight(game)
		commitPractice(game)
		expect(game.tally.value).toMatchObject({ right: 1, wrong: 0 })
		// Nothing to answer while the answered scroll rolls up, so its swipe zone can't answer the next one.
		expect(game.ambush.value.open).toBe(false)
		tickPractice(game, nextQuestionSeconds / 2)
		expect(game.ambush.value.open).toBe(false)
		tickPractice(game, nextQuestionSeconds / 2)
		expect(game.ambush.value).toMatchObject({ open: true, at: { question: 1 } })
	})

	it("doesn't open the next question while paused", () => {
		const game = started()
		pickRight(game)
		commitPractice(game)
		game.session.value.pause()
		tickPractice(game, nextQuestionSeconds)
		expect(game.ambush.value.open).toBe(false)
		game.session.value.resume()
		tickPractice(game, nextQuestionSeconds)
		expect(game.ambush.value.open).toBe(true)
	})

	it('counts a wrong answer', () => {
		const game = started()
		pickWrong(game)
		commitPractice(game)
		expect(game.tally.value).toMatchObject({ right: 0, wrong: 1 })
		expect(percentRight(game.tally.value)).toBe(0)
	})

	it('shows a miss until Continue, with the picks as they were answered', () => {
		const game = started()
		pickWrong(game)
		commitPractice(game)
		const { missed } = game.tally.value
		expect(missed?.record).toMatchObject({ at: { question: 0, part: 0 }, outcome: 'wrong' })
		expect(missed?.ambush.options.some((option) => option.pick > 0 && !option.correct)).toBe(true)
		expect(game.ambush.value.open).toBe(false)

		continuePractice(game)
		expect(game.tally.value.missed).toBeUndefined()
		expect(game.ambush.value).toMatchObject({ open: true, at: { question: 1 } })
	})

	it("doesn't continue while paused", () => {
		const game = started()
		pickWrong(game)
		commitPractice(game)
		game.session.value.pause()
		continuePractice(game)
		expect(game.tally.value.missed).toBeDefined()
	})

	it('never runs out of time', () => {
		const game = started()
		tickPractice(game, 600)
		expect(game.ambush.value).toMatchObject({ open: true, openingLeft: 0 })
		expect(game.ambush.value.unanswered()).toBe(false)
	})

	it("doesn't answer while paused", () => {
		const game = started()
		pickRight(game)
		game.session.value.pause()
		commitPractice(game)
		expect(game.tally.value.right).toBe(0)
		expect(game.ambush.value.open).toBe(true)
	})

	it('is done after the last question, and Again starts over with a fresh tally', () => {
		const game = started()
		for (let asked = 0; asked < 4; asked++) {
			pickRight(game)
			commitPractice(game)
			tickPractice(game, nextQuestionSeconds)
		}
		expect(game.session.value.phase).toBe('done')
		expect(game.ambush.value.open).toBe(false)
		expect(percentRight(game.tally.value)).toBe(100)

		practiseAgain(game, seeded(2))
		expect(game.session.value.phase).toBe('practising')
		expect(game.tally.value).toMatchObject({ right: 0, wrong: 0 })
		expect(game.quiz.value.order.toSorted((first, second) => first - second)).toEqual(all)
		expect(game.ambush.value.open).toBe(true)
	})

	it('asks each round of a question in turn', () => {
		const quiz: BunbuData = {
			...fixtureQuiz,
			questions: [{
				type: 'solutions',
				scenario: 'A page loads slowly.' as Markdown,
				query: 'Does this help?' as Markdown,
				options: [
					{ answer: 'Compress the images' as Markdown, correct: true },
					{ answer: 'Add more scripts' as Markdown, correct: false },
				],
			}],
		}
		const game = createPracticeGame()
		preparePractice(game, quiz)
		beginPractice(game)
		pickWrong(game)
		commitPractice(game)
		continuePractice(game)
		expect(game.ambush.value).toMatchObject({ open: true, round: 2, rounds: 2 })
		pickRight(game)
		commitPractice(game)
		expect(game.tally.value).toMatchObject({ right: 1, wrong: 1 })
		expect(game.session.value.phase).toBe('done')
	})
})

describe('percentRight', () => {
	it('has none before the first answer, and rounds down', () => {
		expect(percentRight({ right: 0, wrong: 0 })).toBeUndefined()
		expect(percentRight({ right: 199, wrong: 1 })).toBe(99)
		expect(percentRight({ right: 29, wrong: 71 })).toBe(29)
	})
})
