/**
 * How a ninja moves in the outcome: plain numbers, so the timing can be tested without three.js.
 */

import { describe, expect, it } from 'vitest'
import { marks, openingSeconds } from '../../_shared/state/ambush.mts'
import { metresPerAmbush } from '../flows/run.mts'
import { runConfig } from '../state/run.mts'
import { bambooCover, bambooRound } from './bamboo-forest.mts'
import { townCover } from './castle-town.mts'
import { coverAhead, coverHeight, coverReach, coverSpotsAt } from './cover.mts'
import { castleCover, castleRound } from './edo-castle.mts'
import { mountainCover, mountainRound } from './mountain-temple.mts'
import { clashSeconds, coverOf, entranceSeconds, fleeSideOf, opacityOf, leapConfig, motionOf, outOf, shareConfig, strikeDelaySeconds } from './ninjas.mts'
import { beside, createPath, townRound } from './path.mts'
import { riceCover, riceRound } from './rice-fields.mts'
import { spotOf } from './placement.mts'

describe('a ninja in the outcome', () => {
	it('lunges in at once to land its hit', () => {
		expect(motionOf('strike', undefined, 0.3, 0)).toEqual({ approach: 0.3, pose: 'strike', time: 0, hop: 0 })
		expect(motionOf('strike', undefined, 0.3, 1)).toMatchObject({ approach: 1, hop: expect.closeTo(0) as number })
	})

	it('leaps in when it charges from far away, and hardly when it is close already', () => {
		const far = motionOf('strike', undefined, 0.3, 0.09).hop
		expect(far).toBeGreaterThan(0.2)
		expect(motionOf('strike', undefined, 0.95, 0.09).hop).toBeLessThan(far / 5)
	})

	it('lunges in and cuts before it is blocked, then is knocked back from in reach', () => {
		expect(motionOf('blocked', undefined, 0.2, clashSeconds / 2)).toMatchObject({ pose: 'strike', time: clashSeconds / 2 })
		expect(motionOf('blocked', undefined, 0.2, clashSeconds / 2).approach).toBeGreaterThan(0.2)
		expect(motionOf('blocked', undefined, 0.2, clashSeconds + 0.1)).toEqual({ approach: 1, pose: 'blocked', time: expect.closeTo(0.1) as number, hop: 0 })
		expect(motionOf('fleeing', undefined, 0.2, 0.5).approach).toBe(1)
	})

	it('cuts through the scroll from where it stands, then charges in alone to land the hit', () => {
		expect(motionOf('strike', true, 0.5, 0.1)).toEqual({ approach: 0.5, pose: 'strike', time: 0.1, hop: 0 })
		expect(motionOf('strike', true, 0.5, strikeDelaySeconds + 0.1).approach).toBeGreaterThan(0.5)
		expect(motionOf('strike', true, 0.5, 2).approach).toBe(1)
	})

	it('winds up while the halves of the scroll fall, then flees from where it stands while the slicer strikes', () => {
		const waiting = motionOf('strike', false, 0.5, 0.3)
		expect(waiting).toMatchObject({ approach: 0.5, pose: 'strike', hop: 0 })
		expect(motionOf('strike', false, 0.5, 0.5)).toEqual(waiting)
		expect(motionOf('strike', false, 0.5, strikeDelaySeconds + 0.1)).toEqual({ approach: 0.5, pose: 'fleeing', time: expect.closeTo(0.1) as number, hop: 0 })
	})
})

describe('a ninja done with its move', () => {
	it('flees straight after landing its hit, without waiting for the others', () => {
		expect(motionOf('strike', undefined, 0.3, 0.2).pose).toBe('strike')
		expect(motionOf('strike', undefined, 0.3, 0.6)).toMatchObject({ approach: 1, pose: 'fleeing' })
		expect(motionOf('strike', true, 0.3, strikeDelaySeconds + 0.6)).toMatchObject({ approach: 1, pose: 'fleeing' })
	})

	it('flees straight after it is knocked back', () => {
		expect(motionOf('blocked', undefined, 0.3, clashSeconds + 0.1).pose).toBe('blocked')
		expect(motionOf('blocked', undefined, 0.3, clashSeconds + 0.5)).toMatchObject({ approach: 1, pose: 'fleeing' })
	})
})

describe('a fleeing ninja', () => {
	it('runs off on the side it stands, so the samurai does not run into it', () => {
		expect(fleeSideOf(2, 4)).toBe(1)
		expect(fleeSideOf(-2, 4)).toBe(-1)
	})

	it('picks a side by its id when it stands in the middle', () => {
		expect(fleeSideOf(0, 2)).toBe(1)
		expect(fleeSideOf(0.1, 3)).toBe(-1)
	})
})

describe('a ninja coming in', () => {
	const path = createPath(townRound)
	// Half way down the first street, facing -z: right is +x, ahead is -z.
	const frame = { ...path.at(30), heading: 0 }
	const covers = coverSpotsAt(path, 30, 3.3)

	it('runs out from behind the cover on its side, the nearest', () => {
		expect(coverOf(spotOf('left', 0, 0), 1, frame, covers)).toMatchObject({ x: expect.closeTo(-3.3) as number, z: expect.closeTo(frame.z - coverAhead[0]) as number })
		expect(coverOf(spotOf('up-right', 1, 0), 1, frame, covers)?.x).toBeCloseTo(3.3)
	})

	it('picks a side by its id when it comes from straight ahead', () => {
		expect(coverOf(spotOf('up', 0, 0), 0, frame, covers)?.x).toBeCloseTo(3.3)
		expect(coverOf(spotOf('up', 0, 0), 1, frame, covers)?.x).toBeCloseTo(-3.3)
	})

	it('has no cover when it creeps up from behind, or when there is none', () => {
		expect(coverOf(spotOf('down', 0, 0), 0, frame, covers)).toBeUndefined()
		expect(coverOf(spotOf('down-left', 0, 0), 0, frame, covers)).toBeUndefined()
		expect(coverOf(spotOf('left', 0, 0), 0, frame, [])).toBeUndefined()
	})
})

describe('a ninja leaping out from behind its cover', () => {
	// The samurai at the origin, the cover 15 m ahead, where the ninja stands for the fight 8 m ahead.
	const from = { x: 0, z: 0 }
	const cover = { x: 0, z: -15 }
	const to = { x: 0, z: -8 }

	it('waits behind it, out of the samurai\'s way', () => {
		expect(outOf(cover, from, to, 0)).toEqual({ x: 0, z: -15 - leapConfig.behind, hop: 0, doing: 'hiding' })
	})

	it('leaps over it and lands in front of it', () => {
		const middle = (leapConfig.waits + leapConfig.lands) / 2
		expect(outOf(cover, from, to, middle)).toMatchObject({ hop: expect.closeTo(leapConfig.height) as number, doing: 'leaping' })
		expect(outOf(cover, from, to, leapConfig.lands)).toMatchObject({ z: expect.closeTo(-15 + leapConfig.ahead) as number, hop: 0, doing: 'running' })
	})

	it('clears the whole cover all the way over, not only at the top of its leap', () => {
		const over = Array.from({ length: 201 }, (_, step) => outOf(cover, from, to, step / 200))
			.filter((at) => Math.hypot(at.x - cover.x, at.z - cover.z) <= coverReach)
		expect(over.length).toBeGreaterThan(0)
		expect(Math.min(...over.map((at) => at.hop))).toBeGreaterThan(coverHeight)
	})

	it('then runs on to where it stands for the fight, always toward the samurai', () => {
		expect(outOf(cover, from, to, 1)).toMatchObject({ x: 0, z: -8, hop: 0 })
		let last = outOf(cover, from, to, 0).z
		for (let amount = 0.05; amount <= 1; amount += 0.05) {
			const { z } = outOf(cover, from, to, amount)
			expect(z).toBeGreaterThanOrEqual(last - 1e-9)
			last = z
		}
	})
})

describe('ninjas coming out from behind the covers of every stage', () => {
	const stagesWithCovers = [
		{ round: riceRound, cover: riceCover },
		{ round: bambooRound, cover: bambooCover },
		{ round: mountainRound, cover: mountainCover },
		{ round: townRound, cover: townCover },
		{ round: castleRound, cover: castleCover },
	]
	// Every ambush of a long run, round its bends, for every mark in both rows, with ids of either parity.
	const entrances = stagesWithCovers.flatMap(({ round, cover }) => {
		const path = createPath(round)
		return Array.from({ length: 12 }, (_, at) => (at + 1) * metresPerAmbush).flatMap((distance) => {
			const from = path.at(distance)
			// Where the samurai is once he has run on as far as an ambush lets him.
			const ranOn = path.at(distance + runConfig.ambushRunOn)
			const covers = coverSpotsAt(path, distance, cover.aside)
			return marks.flatMap((mark) => [0, 1].flatMap((wave) => [0, 1].flatMap((id) => {
				const start = spotOf(mark, wave, 0)
				const chosen = coverOf(start, id, from, covers)
				return chosen === undefined ? [] : [{ from, ranOn, covers, chosen, to: beside(ranOn, start.x, -start.z) }]
			})))
		})
	})
	const runningIn = (entrance: (typeof entrances)[number]) => Array.from({ length: 41 }, (_, step) =>
		outOf(entrance.chosen, entrance.from, entrance.to, leapConfig.lands + (1 - leapConfig.lands) * step / 40))

	it('come out from behind a cover in most ambushes', () => {
		expect(entrances.length).toBeGreaterThan(500)
	})

	it('land beyond where they stand, and only come on toward the samurai from there', () => {
		const backward = entrances.filter((entrance) => {
			const away = runningIn(entrance).map((at) => Math.hypot(at.x - entrance.ranOn.x, at.z - entrance.ranOn.z))
			return away.some((distance, step) => step > 0 && distance > away[step - 1]! + 1e-6)
		})
		expect(backward).toHaveLength(0)
	})

	it('run in clear of the other covers', () => {
		const through = entrances.filter((entrance) => runningIn(entrance).some((at) => entrance.covers.some((cover) =>
			cover !== entrance.chosen && Math.hypot(at.x - cover.x, at.z - cover.z) < coverReach)))
		expect(through).toHaveLength(0)
	})
})

describe('ninjas sharing a cover', () => {
	const from = { x: 0, z: 0 }
	const cover = { x: 3.3, z: -18 }
	const to = { x: 3.2, z: -9.5 }

	it('keep apart all the way out, the later ones waiting their turn', () => {
		const lanes = [0, 1, -1]
		for (let step = 0; step <= 100; step++) {
			const amount = step / 100
			const at = lanes.map((lane, turn) => outOf(cover, from, to, amount - turn * shareConfig.stagger, lane))
			const closest = Math.min(...at.flatMap((one, index) => at.slice(index + 1).map((other) => Math.hypot(one.x - other.x, one.z - other.z, one.hop - other.hop))))
			expect(closest).toBeGreaterThan(0.5)
		}
	})

	it('are all in before the scroll opens', () => {
		expect((1 + (shareConfig.most - 1) * shareConfig.stagger) * entranceSeconds).toBeLessThanOrEqual(openingSeconds)
	})
})

describe('a ninja coming from below (#133)', () => {
	it('is never drawn see-through, even in the back row', () => {
		expect(opacityOf(1, 'down')).toBe(1)
		expect(opacityOf(1, 'down-left')).toBe(1)
		expect(opacityOf(1, 'up')).toBeLessThan(1)
		expect(opacityOf(0, 'up')).toBe(1)
	})

	it('comes in a little to the side, never right behind the samurai', () => {
		for (const approach of [0, 0.5, 1]) expect(Math.abs(spotOf('down', 0, approach).x)).toBeGreaterThan(0.3)
	})
})
