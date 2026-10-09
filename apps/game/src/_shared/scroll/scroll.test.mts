import { describe, expect, it } from 'vitest'
import { noAmbush, type AmbushOption, type AmbushState } from '../state/ambush.mts'
import { headingOf } from './heading.mts'
import { scrollChangeOf } from './scroll-change.mts'

const option = (ninja: number, mark: AmbushOption['mark']): AmbushOption => ({
	answer: 'x',
	correct: false,
	mark,
	ninja,
	pick: 0,
	source: ninja,
	rank: 0,
})

const open: AmbushState = {
	...noAmbush,
	open: true,
	kind: 'single',
	query: 'Which one?',
	options: [option(0, 'left'), option(1, 'up'), option(2, 'right')],
	seconds: 10,
	secondsLeft: 10,
}

describe('headingOf', () => {
	it('names the type and the ninjas', () => {
		expect(headingOf('AMBUSH', open, 'single')).toBe('AMBUSH · SINGLE · 3 NINJAS')
	})

	it('says how many to choose', () => {
		expect(headingOf('AMBUSH', { ...open, kind: 'multiple', choose: 2 }, 'multiple')).toBe('AMBUSH · MULTIPLE · CHOOSE 2 · 3 NINJAS')
	})

	it('counts the rounds of a solutions question, without the one ninja', () => {
		const solution = { ...open, kind: 'yes-no' as const, round: 2, rounds: 3, options: [option(0, 'up'), option(0, 'down')] }
		expect(headingOf('AMBUSH', solution, 'solutions')).toBe('AMBUSH · SOLUTIONS · 2 OF 3')
	})

	it('counts the options when ninjas carry more than one', () => {
		const marks = ['up', 'up-right', 'right', 'down-right', 'down', 'down-left', 'left'] as const
		const ninjas = [0, 1, 1, 2, 2, 3, 4]
		const many = { ...open, options: marks.map((mark, index) => option(ninjas[index]!, mark)) }
		expect(headingOf('AMBUSH', many, 'single')).toBe('AMBUSH · SINGLE · 7 OPTIONS · 5 NINJAS')
	})

	it('only gives the count away for multiple', () => {
		expect(headingOf('AMBUSH', { ...open, choose: 1 }, 'single')).toBe('AMBUSH · SINGLE · 3 NINJAS')
		expect(headingOf('AMBUSH', { ...open, kind: 'order', choose: 3 }, 'order')).toBe('AMBUSH · ORDER · 3 NINJAS')
	})

	it('falls back to the kind of ambush without a question', () => {
		expect(headingOf('PRACTICE', open, undefined)).toBe('PRACTICE · SINGLE · 3 NINJAS')
	})
})

describe('scrollChangeOf', () => {
	const timedOut = { ...open, secondsLeft: 0 }
	const picked = { ...open, options: open.options.map((each, index) => ({ ...each, pick: index === 0 ? 1 : 0 })) }

	it('unrolls a new ambush', () => {
		expect(scrollChangeOf(noAmbush, open)).toBe('unroll')
		expect(scrollChangeOf(open, { ...open, at: { question: 1, part: 0 } })).toBe('unroll')
	})

	it('follows the picks', () => {
		expect(scrollChangeOf(open, picked)).toBe('update')
	})

	it('rolls up when the ambush is answered', () => {
		expect(scrollChangeOf(picked, noAmbush)).toBe('roll-up')
	})

	it('is sliced when the time runs out', () => {
		expect(scrollChangeOf(open, timedOut)).toBe('slice')
		expect(scrollChangeOf(timedOut, noAmbush)).toBe('slice')
	})

	it('never runs out without a time limit', () => {
		const untimed = { ...open, seconds: 0, secondsLeft: 0 }
		expect(scrollChangeOf(noAmbush, untimed)).toBe('unroll')
		expect(scrollChangeOf(untimed, noAmbush)).toBe('roll-up')
	})

	it('does nothing while no ambush is open', () => {
		expect(scrollChangeOf(noAmbush, noAmbush)).toBe('none')
	})
})
