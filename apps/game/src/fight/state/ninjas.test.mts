/**
 * The ninjas remember how every round of a question handled them, so the outcome shows all of it.
 */

import { describe, expect, it } from 'vitest'
import { attackSpawnsOf, chargeOrder, createNinjas, outcomeOrder, spawnsOf } from './ninjas.mts'
import { seeded } from '../../_temp/random.mts'

const three = () => {
	const ninjas = createNinjas()
	ninjas.value.spawn([0, 1, 2].map((id) => ({ id, wave: 0, options: [id], chargeAs: id })))
	return ninjas
}

describe('judging the ninjas', () => {
	it('keeps a miss, and lets a later slash win over a block', () => {
		const ninjas = three()
		ninjas.value.judge([
			{ ninja: 0, verdict: 'slash', picked: 1 },
			{ ninja: 1, verdict: 'block', picked: 0 },
			{ ninja: 2, verdict: 'miss', picked: 0 },
		])
		ninjas.value.judge([
			{ ninja: 0, verdict: 'block', picked: 0 },
			{ ninja: 1, verdict: 'slash', picked: 1 },
			{ ninja: 2, verdict: 'slash', picked: 2 },
		])
		expect(ninjas.value.active.map((ninja) => ninja.verdict)).toEqual(['slash', 'slash', 'miss'])
	})

	it('plays the outcome in the order the ninjas were first picked, the rest after', () => {
		const ninjas = three()
		ninjas.value.judge([
			{ ninja: 0, verdict: 'block', picked: 0 },
			{ ninja: 1, verdict: 'block', picked: 0 },
			{ ninja: 2, verdict: 'slash', picked: 1 },
		])
		ninjas.value.judge([
			{ ninja: 0, verdict: 'block', picked: 0 },
			{ ninja: 1, verdict: 'slash', picked: 1 },
			{ ninja: 2, verdict: 'block', picked: 0 },
		])
		expect(outcomeOrder(ninjas.value.active).map((ninja) => ninja.id)).toEqual([2, 1, 0])
	})
})

describe('when the time runs out', () => {
	it('lets the first one to wind up slice through the scroll, and the others flee', () => {
		const ninjas = createNinjas()
		ninjas.value.spawn([{ id: 0, wave: 0, options: [0], chargeAs: 2 }, { id: 1, wave: 0, options: [1], chargeAs: 0 }, { id: 2, wave: 0, options: [2], chargeAs: 1 }])
		expect(chargeOrder(ninjas.value.active).map((ninja) => ninja.id)).toEqual([1, 2, 0])
		ninjas.value.strikeUnanswered()
		expect(ninjas.value.active.map((ninja) => ninja.slicer)).toEqual([false, true, false])
	})

	it('winds them up in a random order, each its own turn', () => {
		const options = [0, 1, 2, 3].map((ninja) => ({ ninja }))
		expect(spawnsOf(options).map((ninja) => ninja.chargeAs)).toEqual([0, 1, 2, 3])
		const turns = spawnsOf(options, seeded(4)).map((ninja) => ninja.chargeAs)
		expect(turns.toSorted((first, second) => first - second)).toEqual([0, 1, 2, 3])
	})

	it('has a ninja per solution of a `solutions` question from the first round, the round\'s own carrying its answers', () => {
		const option = (mark: 'up' | 'down') => ({ answer: '', correct: mark === 'up', mark, ninja: 1, pick: 0, source: 0, rank: 0 })
		const spawns = attackSpawnsOf({ kind: 'yes-no', options: [option('up'), option('down')], rounds: 3 })
		expect(spawns.map(({ id, options }) => [id, options])).toEqual([[0, []], [1, [0, 1]], [2, []]])
	})
})
