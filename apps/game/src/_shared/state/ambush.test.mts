/**
 * The stores are plain TypeScript, so they are tested without a browser: call actions, tick the
 * clock by hand and assert on `value`
 * ([testing](../../../../../docs/architecture/state.md#testing)).
 */

import type { BunbuData, Markdown } from '@bunbu/data'
import { beforeEach, describe, expect, it } from 'vitest'
import { fixtureQuiz } from '../../_temp/quiz.mts'
import { seeded } from '../../_temp/random.mts'
import { createAmbush, marks, yesNoMarks, type Ambush, type AmbushKind, type AmbushOption } from './ambush.mts'
import { choicesOf, createQuiz, refsOf, type Quiz } from './quiz.mts'

const markdown = (text: string) => text as Markdown

const option = (answer: string, correct: boolean, index: number, rank = 0): AmbushOption => ({
	answer,
	correct,
	mark: marks[index]!,
	ninja: index,
	pick: 0,
	source: index,
	rank,
})

let quiz: Quiz
let ambush: Ambush

beforeEach(() => {
	quiz = createQuiz()
	ambush = createAmbush()
	quiz.value.load(fixtureQuiz)
})

const open = (kind: AmbushKind, options: AmbushOption[], seconds = 10) => {
	ambush.value.start({
		kind,
		at: { question: 2, part: 0 },
		query: 'Which HTTP methods are safe?',
		options,
		choose: options.filter((each) => each.correct).length,
		seconds,
		round: 1,
		rounds: 1,
	})
}

const safeMethods = () => [option('GET', true, 0), option('HEAD', true, 1), option('POST', false, 2)]

describe('quiz', () => {
	const scenarios: BunbuData = {
		...fixtureQuiz,
		questions: [
			{
				type: 'solutions',
				scenario: markdown('A secret key must stay secret.'),
				query: markdown('Does this solution meet the goal?'),
				options: [
					{ answer: markdown('Put it in the bundle.'), correct: false },
					{ answer: markdown('Proxy through the backend.'), correct: true },
					{ answer: markdown('Base64-encode it.'), correct: false },
				],
			},
			{
				type: 'match',
				query: markdown('Match each status code to its meaning.'),
				rows: [
					{ text: markdown('`200`'), answer: markdown('Success') },
					{ text: markdown('`201`'), answer: markdown('Success') },
					{ text: markdown('`404`'), answer: markdown('Not found') },
					{
						text: markdown('`418`'),
						options: [
							{ answer: markdown('Teapot'), correct: true },
							{ answer: markdown('Kettle'), correct: false },
						],
					},
				],
				distractors: [markdown('Access denied')],
			},
		],
	}

	it('asks one ambush per question, solution and row', () => {
		expect(refsOf(fixtureQuiz, [0, 1, 2, 3])).toHaveLength(4)
		expect(refsOf(scenarios, [0, 1])).toHaveLength(7)
	})

	it('asks solutions and rows in random order when given a random', () => {
		const refs = refsOf(scenarios, [1, 0], seeded(3))
		expect(refs.slice(0, 4).map((ref) => ref.question)).toEqual([1, 1, 1, 1])
		expect(refs.slice(0, 4).map((ref) => ref.part).toSorted((first, second) => first - second)).toEqual([0, 1, 2, 3])
		expect(refs.map((ref) => ref.part)).not.toEqual([0, 1, 2, 3, 0, 1, 2])
	})

	it('asks yes-no and every solution as yes or no', () => {
		expect(choicesOf(fixtureQuiz.questions[0]!, 0).map(({ answer, correct }) => [answer, correct]))
			.toEqual([['Yes', true], ['No', false]])
		expect(choicesOf(scenarios.questions[0]!, 1).map(({ correct }) => correct)).toEqual([true, false])
	})

	it('matches a row against the pool of answers and distractors, or against its own options', () => {
		const match = scenarios.questions[1]!
		expect(choicesOf(match, 1).map(({ answer, correct }) => [answer, correct]))
			.toEqual([['Success', true], ['Not found', false], ['Access denied', false]])
		expect(choicesOf(match, 3).map(({ answer }) => answer)).toEqual(['Teapot', 'Kettle'])
	})

	it('keeps misses for the review', () => {
		quiz.value.record({ at: { question: 0, part: 0 }, outcome: 'correct', picked: [0] })
		quiz.value.record({ at: { question: 1, part: 0 }, outcome: 'unanswered', picked: [] })
		expect(quiz.value.answered).toBe(2)
		expect(quiz.value.misses()).toHaveLength(1)
	})

	it('starts over in the same order', () => {
		quiz.value.load(scenarios, [1, 0], seeded(3))
		const { refs } = quiz.value
		quiz.value.record({ at: refs[0]!, outcome: 'correct', picked: [0] })
		quiz.value.reset()
		expect(quiz.value.refs).toEqual(refs)
		expect(quiz.value.answered).toBe(0)
	})
})

describe('ambush', () => {
	it('numbers picks in swipe order, and a second swipe on a picked mark does nothing', () => {
		open('multiple', safeMethods())
		ambush.value.pick(marks[0]!)
		ambush.value.pick(marks[1]!)
		expect(ambush.value.options.map((item) => item.pick)).toEqual([1, 2, 0])

		ambush.value.pick(marks[0]!)
		expect(ambush.value.options.map((item) => item.pick)).toEqual([1, 2, 0])
	})

	it('holds one pick for single: a new swipe replaces the old one', () => {
		open('single', safeMethods())
		ambush.value.pick(marks[0]!)
		ambush.value.pick(marks[2]!)
		expect(ambush.value.options.map((item) => item.pick)).toEqual([0, 0, 1])
	})

	it('is correct when every slash is on a correct option and every block on a wrong one', () => {
		open('multiple', safeMethods())
		ambush.value.pick(marks[0]!)
		ambush.value.pick(marks[1]!)
		expect(ambush.value.commit()).toMatchObject({ outcome: 'correct', slain: [0, 1], blocked: [2] })
	})

	it('is wrong when a slash lands on an incorrect option', () => {
		open('multiple', safeMethods())
		ambush.value.pick(marks[0]!)
		ambush.value.pick(marks[2]!)
		expect(ambush.value.commit()).toMatchObject({ outcome: 'wrong', slain: [], blocked: [] })
	})

	it('is wrong when a correct option is left out', () => {
		open('multiple', safeMethods())
		ambush.value.pick(marks[0]!)
		expect(ambush.value.commit()?.outcome).toBe('wrong')
	})

	it('needs the order right for order, and the distractors left out', () => {
		const steps = () => [option('switch', true, 0, 1), option('commit', true, 1, 2), option('stash', false, 2)]
		open('order', steps())
		ambush.value.pick(marks[1]!)
		ambush.value.pick(marks[0]!)
		expect(ambush.value.commit()?.outcome).toBe('wrong')

		open('order', steps())
		ambush.value.pick(marks[0]!)
		ambush.value.pick(marks[1]!)
		expect(ambush.value.commit()?.outcome).toBe('correct')

		open('order', steps())
		ambush.value.pick(marks[0]!)
		ambush.value.pick(marks[1]!)
		ambush.value.pick(marks[2]!)
		expect(ambush.value.commit()?.outcome).toBe('wrong')
	})

	it('blocks the ninja on a right "no", and slays it on a right "yes"', () => {
		const yesNo = (yes: boolean) => [
			{ ...option('Yes', yes, 0), mark: yesNoMarks.yes, ninja: 0 },
			{ ...option('No', !yes, 1), mark: yesNoMarks.no, ninja: 0 },
		]
		open('yes-no', yesNo(false))
		ambush.value.pick(yesNoMarks.no)
		expect(ambush.value.commit()).toMatchObject({ outcome: 'correct', picked: [1], slain: [], blocked: [0] })

		open('yes-no', yesNo(true))
		ambush.value.pick(yesNoMarks.yes)
		expect(ambush.value.commit()).toMatchObject({ outcome: 'correct', picked: [0], slain: [0], blocked: [] })
	})

	it('reports what was picked as the options of the question, in swipe order', () => {
		open('multiple', safeMethods().map((each, index) => ({ ...each, source: 2 - index })))
		ambush.value.pick(marks[2]!)
		ambush.value.pick(marks[0]!)
		expect(ambush.value.commit()?.picked).toEqual([0, 2])
	})

	it('is unanswered when the time runs out, and a half-swiped answer does not count', () => {
		open('multiple', safeMethods())
		ambush.value.pick(marks[0]!)
		ambush.value.pick(marks[1]!)
		ambush.value.tick(12)
		expect(ambush.value.unanswered()).toBe(true)
		expect(ambush.value.commit()?.outcome).toBe('unanswered')
	})

	it('takes no more picks once the time is up', () => {
		open('multiple', safeMethods())
		ambush.value.tick(12)
		ambush.value.pick(marks[0]!)
		expect(ambush.value.options.every((item) => item.pick === 0)).toBe(true)
	})

	it('does not commit while nothing is picked', () => {
		open('multiple', safeMethods())
		expect(ambush.value.commit()).toBeUndefined()
		expect(ambush.value.open).toBe(true)
	})

	it('has no time limit when seconds is 0', () => {
		open('single', [option('alt', true, 0)], 0)
		ambush.value.tick(60)
		expect(ambush.value.unanswered()).toBe(false)
	})

	it('ignores a pick when no ambush is open', () => {
		ambush.value.pick(marks[0]!)
		expect(ambush.value.open).toBe(false)
		expect(ambush.value.commit()).toBeUndefined()
	})
})
