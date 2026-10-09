import { validate, type BunbuData, type Markdown, type Option } from '@bunbu/data'
import { beforeAll, describe, expect, it } from 'vitest'
import { fixtureQuiz, manyOptions } from '../../_temp/quiz.mts'
import { createAmbush, type AmbushOpening } from './ambush.mts'
import { frontRow, maxNinjas, openingOf } from './ambush-opening.mts'
import { ambushConfig, ambushSeconds, approachOf, wordsIn } from './ambush-time.mts'
import { refsOf } from './quiz.mts'
import { seeded } from './random.mts'

const markdown = (text: string) => text as Markdown
const settings = (seed = 1) => ({ timeScale: 1, random: seeded(seed) })

/** A quiz of one `multiple` question with these options. */
const withOptions = (options: Option[]): BunbuData => ({
	...fixtureQuiz,
	questions: [{ type: 'multiple', query: markdown('Which?'), options }],
})

const open = (data: BunbuData, question = 0, seed = 1) =>
	openingOf(data, refsOf(data, [question]), { question, part: 0 }, settings(seed))

/** Answers the opening as the quiz says is right, and commits it. */
function answerRight(opening: AmbushOpening) {
	const ambush = createAmbush()
	ambush.value.start(opening)
	const right = opening.kind === 'order'
		? opening.options.filter((option) => option.rank > 0).toSorted((first, second) => first.rank - second.rank)
		: opening.options.filter((option) => option.correct)
	for (const option of right) ambush.value.pick(option.mark)
	return ambush.value.commit()
}

describe('opening an ambush', () => {
	it('asks yes-no with one ninja: ↑ yes, ↓ no', () => {
		const opening = open(fixtureQuiz, 0)
		expect(opening).toMatchObject({ kind: 'yes-no', choose: 1, round: 1, rounds: 1 })
		expect(opening.options.map(({ answer, mark, ninja }) => [answer, mark, ninja])).toEqual([['Yes', 'up', 0], ['No', 'down', 0]])
	})

	it('shuffles the options and gives each its own mark and ninja', () => {
		const opening = open(fixtureQuiz, 1)
		expect(opening.kind).toBe('single')
		expect(new Set(opening.options.map((option) => option.mark)).size).toBe(3)
		expect(opening.options.map((option) => option.ninja)).toEqual([0, 1, 2])
		expect(opening.options.map((option) => option.source).toSorted((first, second) => first - second)).toEqual([0, 1, 2])

		const orders = new Set(Array.from({ length: 10 }, (_, seed) => open(fixtureQuiz, 1, seed).options.map((option) => option.source).join()))
		expect(orders.size).toBeGreaterThan(1)
	})

	it('tells how many to choose for multiple and order', () => {
		expect(open(fixtureQuiz, 2).choose).toBe(2)
		expect(open(fixtureQuiz, 3).choose).toBe(3)
	})

	it('puts 5 options on 5 ninjas: 3 in front, 2 behind', () => {
		const opening = open(withOptions(manyOptions.slice(0, 5)))
		expect(opening.options.map((option) => option.ninja)).toEqual([0, 1, 2, 3, 4])
		expect(frontRow).toBe(3)
	})

	it.for([6, 7, 8])('bundles %i options onto 5 ninjas, each option keeping its own mark', (count) => {
		const options = Array.from({ length: count }, (_, index) => ({ answer: markdown(`${index}`), correct: index === 0 }))
		for (let seed = 0; seed < 20; seed++) {
			const opening = open(withOptions(options), 0, seed)
			const perNinja = Array.from({ length: maxNinjas }, (_, ninja) => opening.options.filter((option) => option.ninja === ninja).length)
			expect(perNinja.toSorted((first, second) => first - second)).toEqual([...Array.from({ length: 10 - count }, () => 1), ...Array.from({ length: count - 5 }, () => 2)])
			expect(new Set(opening.options.map((option) => option.mark)).size).toBe(count)
		}
	})

	it('refuses more than 8 options', () => {
		const options = Array.from({ length: 9 }, (_, index) => ({ answer: markdown(`${index}`), correct: index === 0 }))
		expect(() => open(withOptions(options))).toThrow(RangeError)
	})

	it('never starts an order question in the right order', () => {
		for (let seed = 0; seed < 50; seed++) {
			const ranks = open(fixtureQuiz, 3, seed).options.map((option) => option.rank)
			expect(ranks).not.toEqual([1, 2, 3])
		}
	})

	it('ranks the correct options of an order question and leaves the distractors out', () => {
		const data = withOptions([
			{ answer: markdown('first'), correct: true },
			{ answer: markdown('stash'), correct: false },
			{ answer: markdown('second'), correct: true },
		])
		const order: BunbuData = { ...data, questions: [{ ...data.questions[0]!, type: 'order' } as BunbuData['questions'][number]] }
		const ranks = Object.fromEntries(open(order).options.map((option) => [option.answer, option.rank]))
		expect(ranks).toEqual({ first: 1, stash: 0, second: 2 })
	})

	it('asks each solution with the scenario and says which round it is', () => {
		const data: BunbuData = {
			...fixtureQuiz,
			questions: [{
				type: 'solutions',
				scenario: markdown('The key must stay secret.'),
				query: markdown('Does this solution meet the goal?'),
				options: [
					{ answer: markdown('Put it in the bundle.'), correct: false },
					{ answer: markdown('Proxy through the backend.'), correct: true },
				],
			}],
		}
		const refs = [{ question: 0, part: 1 }, { question: 0, part: 0 }]
		const opening = openingOf(data, refs, { question: 0, part: 0 }, settings())
		expect(opening).toMatchObject({ kind: 'yes-no', round: 2, rounds: 2 })
		expect(opening.query).toBe('The key must stay secret.\n\n> Put it in the bundle.\n\nDoes this solution meet the goal?')
		expect(opening.options.map((option) => option.correct)).toEqual([false, true])
	})

	it('has no time limit without a time scale', () => {
		const opening = openingOf(fixtureQuiz, refsOf(fixtureQuiz, [1]), { question: 1, part: 0 }, { timeScale: undefined, random: seeded(1) })
		expect(opening.seconds).toBe(0)
	})
})

describe('every sample quiz', () => {
	const files = import.meta.glob<string>('../../../../../docs/testdata/*.yaml', { query: '?raw', import: 'default', eager: true })
	const quizzes: BunbuData[] = []

	beforeAll(async () => {
		for (const yaml of Object.values(files)) {
			const result = await validate(yaml)
			if (!(result instanceof Error)) quizzes.push(result)
		}
	})

	it('opens every ambush with distinct marks and at most 5 ninjas, and the right answer is correct', () => {
		expect(quizzes.length).toBeGreaterThan(0)
		for (const data of quizzes) {
			const refs = refsOf(data, data.questions.map((_, index) => index), seeded(7))
			for (const at of refs) {
				const opening = openingOf(data, refs, at, settings(at.question))
				const ninjas = new Set(opening.options.map((option) => option.ninja))
				expect(new Set(opening.options.map((option) => option.mark)).size).toBe(opening.options.length)
				expect(ninjas.size).toBeLessThanOrEqual(maxNinjas)
				expect(opening.seconds).toBeGreaterThanOrEqual(ambushConfig.minimumSeconds)
				expect(answerRight(opening)?.outcome).toBe('correct')
			}
		}
	})
})

describe('time limit', () => {
	it('counts words, and words in code twice', () => {
		expect(wordsIn('Which attribute should be added?')).toBe(5)
		expect(wordsIn('Is `PUT` idempotent?')).toBe(1 + 2 + 1)
		expect(wordsIn('Look:\n\n```http\nPUT /users/42 HTTP/1.1\n```\n\n| a | b |\n| - | - |')).toBe(1 + 2 * 3 + 2)
	})

	it('is ceil(read + answer) × timeScale', () => {
		// 200 words is a minute of reading; a single with 4 options takes 1 + 4 × 0.75 = 4 s to answer.
		const words = Array.from({ length: 200 }, () => 'word').join(' ')
		expect(ambushSeconds('single', [words], 4, 1)).toBe(64)
		expect(ambushSeconds('single', [words], 4, 1.5)).toBe(96)
	})

	it('is at least 5 seconds, and none without a time scale', () => {
		expect(ambushSeconds('yes-no', ['Yes?'], 2, 1)).toBe(ambushConfig.minimumSeconds)
		expect(ambushSeconds('yes-no', ['Yes?'], 2, undefined)).toBe(0)
	})

	it('brings the ninjas in as the time runs out', () => {
		expect(approachOf(10, 10)).toBe(0)
		expect(approachOf(10, 2.5)).toBeCloseTo(0.75)
		expect(approachOf(10, 0)).toBe(1)
		expect(approachOf(0, 0)).toBe(0)
	})
})
