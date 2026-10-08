/**
 * The stores are plain TypeScript, so they are tested without a browser: call actions, tick the
 * clock by hand and assert on `value`
 * ([testing](../../../../../docs/architecture/state.md#testing)).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { fixtureQuiz } from '../fixtures/quiz.mts'
import { createAmbush, marks, type Ambush, type AmbushOption } from './ambush.mts'
import { createQuiz, refsOf, type Quiz } from './quiz.mts'

const option = (answer: string, correct: boolean, index: number): AmbushOption => ({
	answer,
	correct,
	mark: marks[index]!,
	ninja: index,
	pick: 0,
})

let quiz: Quiz
let ambush: Ambush

beforeEach(() => {
	quiz = createQuiz()
	ambush = createAmbush()
	quiz.load(fixtureQuiz)
})

describe('quiz', () => {
	it('asks one ambush per question, solution and row', () => {
		const refs = refsOf(fixtureQuiz, [0, 1, 2, 3])
		expect(refs).toHaveLength(4)
	})

	it('keeps misses for the review', () => {
		quiz.record({ at: { question: 0, part: 0 }, outcome: 'correct', picked: [0] })
		quiz.record({ at: { question: 1, part: 0 }, outcome: 'unanswered', picked: [] })
		expect(quiz.value.answered).toBe(2)
		expect(quiz.misses()).toHaveLength(1)
	})
})

describe('ambush', () => {
	const open = () => {
		ambush.open({
			kind: 'multiple',
			at: { question: 2, part: 0 },
			query: 'Which HTTP methods are safe?',
			options: [
				option('GET', true, 0),
				option('HEAD', true, 1),
				option('POST', false, 2),
			],
			choose: 2,
			seconds: 10,
		})
	}

	it('numbers picks in swipe order and renumbers when one is taken back', () => {
		open()
		ambush.pick(marks[0]!)
		ambush.pick(marks[1]!)
		expect(ambush.value.options.map((item) => item.pick)).toEqual([1, 2, 0])

		ambush.pick(marks[0]!)
		expect(ambush.value.options.map((item) => item.pick)).toEqual([0, 1, 0])
	})

	it('is correct when every slash is on a correct option and every block on a wrong one', () => {
		open()
		ambush.pick(marks[0]!)
		ambush.pick(marks[1]!)
		expect(ambush.commit()?.outcome).toBe('correct')
	})

	it('is wrong when a slash lands on an incorrect option', () => {
		open()
		ambush.pick(marks[0]!)
		ambush.pick(marks[2]!)
		expect(ambush.commit()?.outcome).toBe('wrong')
	})

	it('is unanswered when the time runs out, and a half-swiped answer does not count', () => {
		open()
		ambush.pick(marks[0]!)
		ambush.tick(10)
		expect(ambush.unanswered()).toBe(true)
		expect(ambush.commit()?.outcome).toBe('unanswered')
	})

	it('has no time limit when seconds is 0', () => {
		ambush.open({
			kind: 'single',
			at: { question: 1, part: 0 },
			query: 'Which attribute?',
			options: [option('alt', true, 0)],
			choose: 1,
			seconds: 0,
		})
		ambush.tick(60)
		expect(ambush.unanswered()).toBe(false)
	})

	it('ignores a pick when no ambush is open', () => {
		ambush.pick(marks[0]!)
		expect(ambush.value.open).toBe(false)
		expect(ambush.commit()).toBeUndefined()
	})
})
