/**
 * The path through the town: where the samurai is at a distance, and which way he faces.
 */

import { describe, expect, it } from 'vitest'
import { beside, cornerRadius, createPath, roundLength, townRound } from './path.mts'
import { bambooRound } from './bamboo-forest.mts'
import { castleRound } from './edo-castle.mts'
import { mountainRound } from './mountain-temple.mts'
import { riceRound } from './rice-fields.mts'

const path = createPath()
/** Three rounds, and the seams between them. */
const laidOut = 3 * roundLength

describe('path', () => {
	it('starts at the origin facing down -z', () => {
		expect(path.at(0)).toMatchObject({ x: 0, z: 0, heading: 0 })
		expect(path.at(10).z).toBeCloseTo(-10)
	})

	it('goes on straight back before the start, for the camera behind the samurai', () => {
		expect(path.at(-12).x).toBeCloseTo(0, 9)
		expect(path.at(-12).heading).toBeCloseTo(0, 9)
		expect(path.at(-12).z).toBeCloseTo(12)
	})

	it('is one unbroken line: a metre along is a metre away, in the direction it faces', () => {
		for (let distance = -roundLength; distance < laidOut; distance += 0.5) {
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
		const points = Array.from({ length: Math.ceil(laidOut / 4) }, (_, step) => path.at(step * 4))
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

describe('stage rounds', () => {
	const rounds = { townRound, riceRound, bambooRound, mountainRound, castleRound }

	it('turns as much left as right on every stage, so the path keeps its way', () => {
		for (const round of Object.values(rounds)) {
			expect(round.reduce((sum, leg) => sum + leg.turn, 0)).toBeCloseTo(0, 9)
			const laid = createPath(round)
			expect(laid.at(laid.round).heading).toBeCloseTo(0, 9)
		}
	})

	it('refuses a round that would not join up with the next one', () => {
		expect(() => createPath([])).toThrow(RangeError)
		expect(() => createPath([{ length: 20, turn: 0.5, zone: 'street' }])).toThrow(RangeError)
	})

	it('goes on for as long as the run does, each round the last one moved on', () => {
		for (const round of Object.values(rounds)) {
			const laid = createPath(round)
			const across = laid.at(laid.round)
			// 50 questions of 120 m is 6 km; an endless run goes on much farther.
			for (const distance of [0, 13.7, 2400, 6000, 100_000]) {
				const here = laid.at(distance)
				const next = laid.at(distance + laid.round)
				expect(next.x - here.x).toBeCloseTo(across.x, 6)
				expect(next.z - here.z).toBeCloseTo(across.z, 6)
				expect(next.heading).toBeCloseTo(here.heading, 9)
				expect(next.zone).toBe(here.zone)
			}
		}
	})

	it('runs on unbroken from one round into the next', () => {
		for (const round of Object.values(rounds)) {
			const laid = createPath(round)
			for (const seam of [laid.round, 7 * laid.round, 60 * laid.round]) {
				const before = laid.at(seam - 0.01)
				const after = laid.at(seam)
				expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeCloseTo(0.01, 4)
				expect(after.heading).toBeCloseTo(before.heading, 6)
			}
		}
	})

	it('ends and starts every round straight, so the camera behind the samurai at the start looks straight down it', () => {
		for (const round of Object.values(rounds)) {
			const laid = createPath(round)
			expect(round[0]?.turn).toBe(0)
			expect(round.at(-1)?.turn).toBe(0)
			expect(laid.at(-12).x).toBeCloseTo(0, 9)
			expect(laid.at(-12).heading).toBeCloseTo(0, 9)
			expect(laid.at(-12).z).toBeCloseTo(12)
		}
	})
})
