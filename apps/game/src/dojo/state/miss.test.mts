import { describe, expect, it } from 'vitest'
import type { AmbushOption } from '../../_shared/state/ambush.mts'
import { answerBlocksOf, verdictOf } from './miss.mts'

const option = (answer: string, correct: boolean, pick = 0, rank = 0): AmbushOption =>
	({ answer, correct, mark: 'up', ninja: 0, pick, source: 0, rank })

describe('verdictOf', () => {
	it('marks the right answer and the wrong pick, and leaves the rest', () => {
		expect(verdictOf('single', option('alt', true))).toEqual({ sign: '✓', text: 'correct' })
		expect(verdictOf('single', option('title', false, 1))).toEqual({ sign: '✗', text: 'your pick' })
		expect(verdictOf('single', option('caption', false))).toBeUndefined()
		expect(verdictOf('multiple', option('GET', true, 1))).toEqual({ sign: '✓', text: 'correct, your pick' })
	})

	it('gives the right place for order, and the place given when it was wrong', () => {
		expect(verdictOf('order', option('a', true, 1, 1))).toEqual({ sign: '✓', text: '1st' })
		expect(verdictOf('order', option('b', true, 3, 2))).toEqual({ sign: '✗', text: '2nd, not 3rd' })
		expect(verdictOf('order', option('c', true, 0, 3))).toEqual({ sign: '✗', text: '3rd, left out' })
		expect(verdictOf('order', option('d', false, 4, 0))).toEqual({ sign: '✗', text: 'not in the order, not 4th' })
		expect(verdictOf('order', option('e', false))).toBeUndefined()
	})
})

describe('answerBlocksOf', () => {
	it('leads into the one answer, or all of them, each a block of its own', () => {
		expect(answerBlocksOf({ kind: 'single', options: [option('`alt`', true), option('`title`', false)] })).toEqual(['The answer is:', '`alt`'])
		expect(answerBlocksOf({ kind: 'multiple', options: [option('GET', true), option('HEAD', true), option('POST', false)] }))
			.toEqual(['The answers are:', 'GET', 'HEAD'])
	})

	it('gives an order in its order', () => {
		const options = [option('Inline', true, 0, 3), option('User agent', true, 0, 1), option('Author', true, 0, 2), option('None', false)]
		expect(answerBlocksOf({ kind: 'order', options })).toEqual(['The order is:', 'User agent', 'then', 'Author', 'then', 'Inline'])
	})

	it('keeps a code block answer whole', () => {
		const code = '```html\n<img alt="Sales">\n```'
		expect(answerBlocksOf({ kind: 'single', options: [option(code, true)] })[1]).toBe(code)
	})
})
