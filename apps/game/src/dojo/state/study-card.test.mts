import type { Markdown, Question } from '@bunbu/data'
import { describe, expect, it } from 'vitest'
import { studyCardOf } from './study-card.mts'

const md = (text: string) => text as Markdown
const option = (answer: string, correct: boolean) => ({ answer: md(answer), correct })

/** The answers as they are read: lead, prompt, link and text. */
const read = (question: Question) => studyCardOf(question).answers
	.map((answer) => [answer.lead, answer.prompt, answer.link, answer.text].filter((part) => part !== undefined && part !== '').join(' '))

describe('study cards', () => {
	it('gives a yes-no question its one answer', () => {
		const question: Question = { type: 'yes-no', query: md('Is HTML a language?'), answer: 'yes' }
		expect(studyCardOf(question)).toMatchObject({ asked: ['Is HTML a language?'], label: 'Correct answer' })
		expect(read(question)).toEqual(['The answer is Yes'])
	})

	it('gives a single question its correct option', () => {
		const question: Question = { type: 'single', query: md('Which attribute?'), options: [option('title', false), option('alt', true)] }
		expect(read(question)).toEqual(['The answer is alt'])
	})

	it('lists every correct option of a multiple question', () => {
		const question: Question = {
			type: 'multiple',
			query: md('Which are colours?'),
			options: [option('red', true), option('table', false), option('green', true), option('blue', true)],
		}
		expect(studyCardOf(question).label).toBe('Correct answers')
		expect(read(question)).toEqual(['The answers are red', 'green', 'and blue'])
	})

	it('says "the answer is" for a multiple question with one correct option', () => {
		const question: Question = { type: 'multiple', query: md('Which?'), options: [option('a', true), option('b', false)] }
		expect(studyCardOf(question).label).toBe('Correct answer')
		expect(read(question)).toEqual(['The answer is a'])
	})

	it('gives an order question its right sequence, without the distractors', () => {
		const question: Question = {
			type: 'order',
			query: md('Order the layers'),
			options: [option('physical', true), option('fake', false), option('link', true), option('network', true)],
		}
		expect(studyCardOf(question)).toMatchObject({ label: 'Right order', ordered: true })
		expect(read(question)).toEqual(['The right order is physical', 'then link', 'then network'])
	})

	it('gives each solution with yes or no, after the scenario and the query', () => {
		const question: Question = {
			type: 'solutions',
			scenario: md('Orders arrive in bursts.'),
			query: md('Does the solution meet the goal?'),
			options: [option('Add a queue', true), option('Add a bigger server', false)],
		}
		expect(studyCardOf(question).asked).toEqual(['Orders arrive in bursts.', 'Does the solution meet the goal?'])
		expect(read(question)).toEqual(['Solution 1: Add a queue Yes', 'Solution 2: Add a bigger server No'])
	})

	it('gives each match row its answer', () => {
		const question: Question = {
			type: 'match',
			query: md('Match the status codes'),
			rows: [
				{ text: md('404'), answer: md('Not found') },
				{ text: md('500'), options: [option('Teapot', false), option('Server error', true)] },
			],
		}
		expect(read(question)).toEqual(['404 matches Not found', '500 matches Server error'])
	})
})
