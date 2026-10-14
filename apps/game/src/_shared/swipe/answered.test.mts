import { describe, expect, it } from 'vitest'
import { noAmbush, type AmbushOption, type AmbushState } from '../state/ambush.mts'
import { answered } from './answered.mts'

const option = (mark: AmbushOption['mark'], correct: boolean, pick: number, rank = 0): AmbushOption =>
	({ answer: mark, correct, mark, ninja: 0, pick, source: 0, rank })

const order = (options: AmbushOption[]): AmbushState =>
	({ ...noAmbush, open: true, kind: 'order', choose: options.filter((each) => each.correct).length, options })

describe('answered', () => {
	it('completes an order once its items are placed, leaving its distractor out', () => {
		const placing = [option('left', true, 1, 1), option('up', true, 0, 2), option('right', false, 0)]
		expect(answered(order(placing))).toBe(false)
		const placed = [option('left', true, 1, 1), option('up', true, 2, 2), option('right', false, 0)]
		expect(answered(order(placed))).toBe(true)
	})

	it('completes an order without distractors once every item is placed', () => {
		expect(answered(order([option('left', true, 1, 1), option('up', true, 0, 2)]))).toBe(false)
		expect(answered(order([option('left', true, 1, 1), option('up', true, 2, 2)]))).toBe(true)
	})

	it('completes a multiple at as many picks as it asks for, and the rest at one pick', () => {
		const multiple = { ...noAmbush, open: true, kind: 'multiple' as const, choose: 2 }
		expect(answered({ ...multiple, options: [option('left', true, 1), option('up', true, 0)] })).toBe(false)
		expect(answered({ ...multiple, options: [option('left', true, 1), option('up', true, 2)] })).toBe(true)
		expect(answered({ ...noAmbush, open: true, kind: 'single', options: [option('left', true, 1)] })).toBe(true)
	})
})
