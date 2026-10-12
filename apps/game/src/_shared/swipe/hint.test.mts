import { describe, expect, it } from 'vitest'
import { hintOf } from './hint.mts'

describe('hintOf', () => {
	it('asks for one cut when one answer strikes', () => {
		expect(hintOf({ kind: 'single', choose: 1 })).toBe('Cut your answer')
		expect(hintOf({ kind: 'yes-no', choose: 1 })).toBe('Cut your answer')
	})

	it('says how many to cut for multiple, and to hold still to strike', () => {
		expect(hintOf({ kind: 'multiple', choose: 2 })).toBe('Cut the 2 you choose, then hold still')
	})

	it('keeps the count to itself when the question does', () => {
		expect(hintOf({ kind: 'multiple', choose: 0 })).toBe('Cut each answer you choose, then hold still')
	})

	it('asks for the order', () => {
		expect(hintOf({ kind: 'order', choose: 3 })).toBe('Cut them in order, then hold still')
	})
})
