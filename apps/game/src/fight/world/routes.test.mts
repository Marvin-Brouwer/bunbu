/**
 * The way a ninja without a cover runs in: from out of sight, around what is solid.
 */

import { describe, expect, it } from 'vitest'
import { lengthOf, partWay, routeConfig, routeTo, straightened } from './routes.mts'
import { hiddenBehind, inside, type Solid, type Spot } from './solids.mts'

/**
 * A street along `z`, the samurai at the origin, with a row of houses 7 deep along its right side,
 * their fronts 5.2 m out, and an alley 2.5 m wide between two of them, 12 m ahead.
 */
const houses: Solid[] = [
	{ x: 8.7, z: -4, width: 15, depth: 7, heading: Math.PI / 2, hides: true },
	{ x: 8.7, z: -21.75, width: 17, depth: 7, heading: Math.PI / 2, hides: true },
]
const camera = { x: 0, z: 9 }
/** Out of sight only behind the houses: the camera sees the whole street. */
const behindHouses = (spot: Spot) => hiddenBehind(houses, camera, spot)
const to = { x: 2.2, z: -5 }
/** Where it would start on open ground: inside the houses. */
const wished = { x: 8, z: -16 }

describe('a ninja running in without a cover', () => {
	const route = routeTo(to, wished, houses, behindHouses)

	it('starts out of sight, behind the houses', () => {
		const start = route?.[0]
		expect(start).toBeDefined()
		expect(behindHouses(start ?? to)).toBe(true)
		expect(start?.x).toBeGreaterThan(5.2)
	})

	it('comes out through the alley rather than through a wall, and ends where it stands', () => {
		expect(route?.at(-1)).toEqual(to)
		const steps = route ?? []
		for (let step = 0; step <= 200; step++) {
			const at = partWay(steps, step / 200)
			expect(houses.some((house) => inside(house, at.x, at.z))).toBe(false)
		}
	})

	it('is never longer than it has time to run', () => {
		expect(lengthOf(route ?? [])).toBeLessThanOrEqual(routeConfig.longest + routeConfig.cell * 2)
	})

	it('has none where everything is in sight, or where it would stand in something solid', () => {
		expect(routeTo(to, wished, [], () => false)).toBeUndefined()
		expect(routeTo({ x: 8.7, z: -4 }, wished, houses, () => true)).toBeUndefined()
	})

	it('starts nearest to where it would have come from, when it is out of sight anywhere', () => {
		const start = routeTo(to, { x: -6, z: -10 }, [], () => true)?.[0]
		expect(Math.hypot((start?.x ?? 0) + 6, (start?.z ?? 0) + 10)).toBeLessThan(1)
	})
})

describe('a way straightened', () => {
	it('leaves out the turns it can run past', () => {
		const spots = [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 1 }]
		expect(straightened(spots, () => true)).toEqual([{ x: 0, z: 0 }, { x: 2, z: 1 }])
		expect(straightened(spots, (one, other) => one.z === other.z || one.x === other.x)).toEqual([{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 1 }])
	})

	it('is walked by its length', () => {
		const spots = [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 1 }]
		expect(lengthOf(spots)).toBe(4)
		expect(partWay(spots, 0.5)).toEqual({ x: 2, z: 0 })
		expect(partWay(spots, 1)).toEqual({ x: 3, z: 1 })
	})
})
