/**
 * The blocks a stage's scenery is stitched together from: which one stands where, and that what is
 * shown round the samurai is all there and in its place, however far he runs.
 */

import { Group, Object3D, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { bambooRound } from './bamboo-forest.mts'
import { blockOrder, blockVariants, layBlocks, shownAhead, shownAround, shownBehind } from './blocks.mts'
import { castleRound } from './edo-castle.mts'
import { fogFar } from './landscape.mts'
import { mountainRound } from './mountain-temple.mts'
import { createPath, townRound } from './path.mts'
import { riceRound } from './rice-fields.mts'

const rounds = { townRound, riceRound, bambooRound, mountainRound, castleRound }

/** How far off the path a stage places anything: castle town's keep, 70 m out and 18 m round. */
const farthestAside = 90

describe('block order', () => {
	it('never shows the same block twice at once', () => {
		const order = blockOrder()
		for (let slot = -shownBehind; slot < 5000; slot++) {
			const shown = shownAround(slot).map(order)
			expect(new Set(shown).size).toBe(shown.length)
		}
	})

	it('uses every block, and picks the next one rather than going round in a fixed cycle', () => {
		const order = blockOrder()
		const slots = Array.from({ length: 400 }, (_, slot) => order(slot))
		expect(new Set(slots)).toEqual(new Set(Array.from({ length: blockVariants }, (_, variant) => variant)))
		const cycle = shownBehind + 1 + shownAhead
		expect(slots.some((variant, slot) => slot >= cycle + 1 && variant !== slots[slot - cycle - 1])).toBe(true)
	})

	it('comes out the same every run', () => {
		const one = blockOrder()
		const other = blockOrder()
		// Asked in a different order, so neither depends on how it was asked.
		const later = Array.from({ length: 50 }, (_, slot) => other(49 - slot)).toReversed()
		expect(Array.from({ length: 50 }, (_, slot) => one(slot))).toEqual(later)
	})

	it('needs a block more than it shows at once', () => {
		expect(() => blockOrder(shownBehind + 1 + shownAhead)).toThrow(RangeError)
	})

	it('shows the block behind the samurai, his own and those ahead, and nothing before the start', () => {
		expect(shownAround(4)).toEqual([3, 4, 5, 6])
		expect(shownAround(0)).toEqual([-1, 0, 1, 2])
		expect(shownAround(-1)).toEqual([-1, 0, 1])
	})
})

describe('laid blocks', () => {
	/** A block that only marks where, on the path, a few points of its stretch are. */
	const marked = (path: ReturnType<typeof createPath>) => (from: number, to: number) => {
		const group = new Group()
		for (const along of [0, 0.5, 0.99]) {
			const point = path.at(from + (to - from) * along)
			const marker = new Object3D()
			marker.position.set(point.x, 0, point.z)
			marker.userData = { along }
			group.add(marker)
		}
		return { group, pending: undefined }
	}

	for (const [name, round] of Object.entries(rounds)) {
		it(`stitches ${name}'s blocks onto the path wherever the samurai is, far past where the world used to end`, () => {
			const path = createPath(round)
			const blocks = layBlocks(path, marked(path))
			// 2.4 km was question 20 of 120 m each; 50 questions is 6 km; endless goes on and on.
			for (const distance of [0, 100, 2399, 2401, 6000, 6100.5, 250_000]) {
				blocks.follow(distance)
				blocks.group.updateMatrixWorld(true)
				const slot = Math.floor(distance / path.round)
				const shown = blocks.laid.filter((block) => block.group.visible)
				expect(shown).toHaveLength(shownAround(slot).length)
				for (const each of shownAround(slot)) {
					// Whichever block stands in this slot has its markers on this slot's stretch of path.
					for (const along of [0, 0.5, 0.99]) {
						const point = path.at((each + along) * path.round)
						const markers = shown.flatMap((block) => block.group.children.filter((marker) => marker.userData.along === along))
						const near = markers.some((marker) => {
							const at = marker.getWorldPosition(new Vector3())
							return Math.hypot(at.x - point.x, at.z - point.z) < 1e-6
						})
						expect(near, `${name}: slot ${each} at ${along} with the samurai at ${distance} m`).toBe(true)
					}
				}
			}
		})

		it(`shows every block of ${name} that could be seen through the fog ahead`, () => {
			const path = createPath(round)
			for (let distance = 0; distance < 6 * path.round; distance += 2) {
				const here = path.at(distance)
				const shown = new Set(shownAround(Math.floor(distance / path.round)))
				for (let ahead = distance; ahead < distance + 5 * path.round; ahead += 2) {
					const point = path.at(ahead)
					if (shown.has(Math.floor(ahead / path.round))) continue
					expect(Math.hypot(point.x - here.x, point.z - here.z)).toBeGreaterThan(fogFar + farthestAside)
				}
			}
		})
	}
})
