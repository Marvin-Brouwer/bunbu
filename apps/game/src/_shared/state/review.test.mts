import type { BunbuData, Markdown } from '@bunbu/data'
import { describe, expect, it } from 'vitest'
import { reviewOf } from './review.mts'

const markdown = (text: string) => text as Markdown

const quiz: BunbuData = {
	id: 'review',
	title: 'Review',
	version: '1',
	language: 'en',
	passingScore: 70,
	questions: [
		{
			type: 'single',
			query: markdown('Which attribute describes an image?'),
			explanation: markdown('`alt` is the text alternative.'),
			references: [{ 'MDN: alt': 'https://developer.mozilla.org/' }],
			options: [
				{ answer: markdown('`alt`'), correct: true },
				{ answer: markdown('`title`'), correct: false, explanation: markdown('A tooltip, not read reliably.') },
			],
		},
		{
			type: 'order',
			query: markdown('Lowest precedence first.'),
			options: [
				{ answer: markdown('Author'), correct: true },
				{ answer: markdown('Inline'), correct: true },
				{ answer: markdown('Browser'), correct: false },
			],
		},
		{
			type: 'solutions',
			scenario: markdown('The key must stay secret.'),
			query: markdown('Does this meet the goal?'),
			explanation: markdown('About keys.'),
			options: [
				{ answer: markdown('Bundle it.'), correct: false, explanation: markdown('Anyone can read the bundle.') },
				{ answer: markdown('Proxy it.'), correct: true },
			],
		},
		{
			type: 'match',
			query: markdown('Match the status codes.'),
			rows: [
				{ text: markdown('404'), answer: markdown('Not found') },
				{ text: markdown('500'), answer: markdown('Server error') },
			],
		},
	],
}

describe('reviewOf', () => {
	it('shows the pick, the right answer, the explanations and the references', () => {
		expect(reviewOf(quiz, { at: { question: 0, part: 0 }, outcome: 'wrong', picked: [1] })).toEqual({
			outcome: 'wrong',
			asked: ['Which attribute describes an image?'],
			picked: ['`title`'],
			right: ['`alt`'],
			ordered: false,
			explanations: ['A tooltip, not read reliably.', '`alt` is the text alternative.'],
			references: [{ text: 'MDN: alt', url: 'https://developer.mozilla.org/' }],
		})
	})

	it('keeps an order question in order, picks in the order they were swiped', () => {
		const review = reviewOf(quiz, { at: { question: 1, part: 0 }, outcome: 'wrong', picked: [1, 0] })
		expect(review?.picked).toEqual(['Inline', 'Author'])
		expect(review?.right).toEqual(['Author', 'Inline'])
		expect(review?.ordered).toBe(true)
	})

	it('has no pick when time ran out first', () => {
		expect(reviewOf(quiz, { at: { question: 0, part: 0 }, outcome: 'unanswered', picked: [] })?.picked).toEqual([])
	})

	it('asks a solution with its scenario, and explains that solution', () => {
		const review = reviewOf(quiz, { at: { question: 2, part: 0 }, outcome: 'wrong', picked: [0] })
		expect(review?.asked).toEqual(['The key must stay secret.', 'Bundle it.', 'Does this meet the goal?'])
		expect(review?.picked).toEqual(['Yes'])
		expect(review?.right).toEqual(['No'])
		expect(review?.explanations).toEqual(['Anyone can read the bundle.', 'About keys.'])
	})

	it('asks a match row with its query', () => {
		const review = reviewOf(quiz, { at: { question: 3, part: 1 }, outcome: 'wrong', picked: [0] })
		expect(review?.asked).toEqual(['Match the status codes.', '500'])
		expect(review?.picked).toEqual(['Not found'])
		expect(review?.right).toEqual(['Server error'])
	})

	it('only links to the web', () => {
		const unsafe: BunbuData = {
			...quiz,
			questions: [{
				...quiz.questions[0]!,
				references: [{ script: 'javascript:alert(1)' }, { local: 'file:///etc/passwd' }, { spec: 'http://example.com' }],
			}],
		}
		expect(reviewOf(unsafe, { at: { question: 0, part: 0 }, outcome: 'wrong', picked: [1] })?.references)
			.toEqual([{ text: 'spec', url: 'http://example.com' }])
	})

	it('has nothing to show for a record outside the quiz', () => {
		expect(reviewOf(quiz, { at: { question: 9, part: 0 }, outcome: 'wrong', picked: [] })).toBeUndefined()
	})
})
