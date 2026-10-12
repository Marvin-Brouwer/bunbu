/**
 * The ninjas remember how every round of a question handled them, so the outcome shows all of it.
 */

import { describe, expect, it } from 'vitest'
import { createNinjas, outcomeOrder } from './ninjas.mts'

const three = () => {
	const ninjas = createNinjas()
	ninjas.value.spawn([0, 1, 2].map((id) => ({ id, wave: 0, options: [id] })))
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
