/** Where the petals are: always in the air around the centre, wherever the centre goes. */

import { describe, expect, it } from 'vitest'
import { petalAt, scatterPetals, wrapInto, type PetalBox } from './petals.mts'

const box: PetalBox = { width: 20, height: 8, depth: 16 }

describe('petals', () => {
	it('wraps a value into the box around the centre', () => {
		expect(wrapInto(0, 0, 10)).toBe(0)
		expect(wrapInto(6, 0, 10)).toBe(-4)
		expect(wrapInto(-6, 0, 10)).toBe(4)
		expect(wrapInto(103, 100, 10)).toBe(103)
		expect(wrapInto(3, 100, 10)).toBe(103)
	})

	it('keeps every petal in the box, however long it falls and wherever the centre is', () => {
		const petals = scatterPetals(50, box)
		for (const time of [0, 3.7, 120]) {
			for (const centre of [{ x: 0, y: 0, z: 0 }, { x: 500, y: 0, z: -1200 }]) {
				for (const petal of petals) {
					const at = petalAt(petal, time, box, centre)
					expect(Math.abs(at.x - centre.x)).toBeLessThanOrEqual(box.width / 2)
					expect(at.y).toBeGreaterThanOrEqual(0)
					expect(at.y).toBeLessThanOrEqual(box.height)
					expect(Math.abs(at.z - centre.z)).toBeLessThanOrEqual(box.depth / 2)
				}
			}
		}
	})

	it('falls', () => {
		const [petal] = scatterPetals(1, { width: 20, height: 1000, depth: 16 })
		if (petal === undefined) throw new Error('no petal')
		const big = { width: 20, height: 1000, depth: 16 }
		const centre = { x: 0, y: 0, z: 0 }
		expect(petalAt(petal, 1, big, centre).y).toBeLessThan(petalAt(petal, 0, big, centre).y)
	})
})
