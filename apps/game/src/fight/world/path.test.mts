/**
 * The path through the town: where the samurai is at a distance, and which way he faces.
 */

import { describe, expect, it } from 'vitest'
import { beside, cornerRadius, createPath, roundLength } from './path.mts'

const path = createPath(3 * roundLength)

describe('path', () => {
	it('starts at the origin facing down -z', () => {
		expect(path.at(0)).toMatchObject({ x: 0, z: 0, heading: 0 })
		expect(path.at(10).z).toBeCloseTo(-10)
	})

	it('goes on straight back before the start, for the camera behind the samurai', () => {
		expect(path.at(-12)).toMatchObject({ x: 0, heading: 0 })
		expect(path.at(-12).z).toBeCloseTo(12)
	})

	it('is one unbroken line: a metre along is a metre away, in the direction it faces', () => {
		for (let distance = 0; distance < path.length; distance += 0.5) {
			const here = path.at(distance)
			const next = path.at(distance + 0.01)
			expect(Math.hypot(next.x - here.x, next.z - here.z)).toBeCloseTo(0.01, 4)
			// The step goes the way it faces: forward is (-sin, -cos).
			expect((next.x - here.x) * -Math.sin(here.heading) + (next.z - here.z) * -Math.cos(here.heading)).toBeCloseTo(0.01, 4)
		}
	})

	it('turns its street corners a quarter turn, and turns back after, so the run keeps its way', () => {
		const headings = Array.from({ length: 400 }, (_, metre) => path.at(metre).heading)
		expect(Math.max(...headings)).toBeCloseTo(Math.PI / 2, 2)
		expect(path.at(roundLength).heading).toBeCloseTo(0)
	})

	it('has streets and gardens', () => {
		const zones = new Set(Array.from({ length: Math.ceil(roundLength) }, (_, metre) => path.at(metre).zone))
		expect(zones).toEqual(new Set(['street', 'garden']))
	})

	it('never comes back on itself', () => {
		// Points far apart along the path are far apart on the ground, so streets never overlap.
		const points = Array.from({ length: Math.ceil(path.length / 4) }, (_, step) => path.at(step * 4))
		for (const [index, point] of points.entries()) {
			for (const other of points.slice(index + 15)) {
				expect(Math.hypot(point.x - other.x, point.z - other.z)).toBeGreaterThan(2 * cornerRadius)
			}
		}
	})

	it('finds the points beside it, right positive', () => {
		const right = beside({ x: 0, z: 0, heading: 0 }, 3)
		expect(right.x).toBeCloseTo(3)
		expect(right.z).toBeCloseTo(0)
		const turnedLeft = beside({ x: 0, z: 0, heading: Math.PI / 2 }, 3, 1)
		// Facing -x, the right is -z, and ahead is -x.
		expect(turnedLeft.x).toBeCloseTo(-1)
		expect(turnedLeft.z).toBeCloseTo(-3)
	})
})
