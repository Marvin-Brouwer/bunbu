import { describe, expect, it } from 'vitest'
import { metresPerAmbush } from '../flows/run.mts'
import { townCover } from './castle-town.mts'
import { coverReach, coverSpotsAt, decoysOf } from './cover.mts'
import { createPath, townRound } from './path.mts'

describe('the decoys', () => {
	const path = createPath(townRound)

	it('never stand in an ambush\'s own covers, whatever the run\'s seed', () => {
		const ambushCovers = Array.from({ length: 12 }, (_, at) => coverSpotsAt(path, (at + 1) * metresPerAmbush, townCover.aside)).flat()
		const decoys = Array.from({ length: 40 }, (_, seed) => Array.from({ length: 80 }, (__, tile) => decoysOf(path, townCover, tile, metresPerAmbush, seed * 7919)).flat()).flat()
		const closest = Math.min(...decoys.flatMap((decoy) => ambushCovers.map((cover) => Math.hypot(decoy.x - cover.x, decoy.z - cover.z))))

		expect(decoys.length).toBeGreaterThan(1000)
		expect(closest).toBeGreaterThan(2 * coverReach)
	})

	it('never stand in each other, whatever the run\'s seed', () => {
		const runs = Array.from({ length: 40 }, (_, seed) => Array.from({ length: 80 }, (__, tile) => decoysOf(path, townCover, tile, metresPerAmbush, seed * 7919)).flat())
		const closest = Math.min(...runs.flatMap((decoys) => decoys.flatMap((one, index) => decoys.slice(index + 1).map((other) => Math.hypot(one.x - other.x, one.z - other.z)))))

		expect(closest).toBeGreaterThan(2 * coverReach)
	})

	it('keep apart the two Copilot found 2 cm apart (seed 3137, tile 2)', () => {
		const [one, other] = decoysOf(path, townCover, 2, metresPerAmbush, 3137)
		expect(other === undefined || Math.hypot(one!.x - other.x, one!.z - other.z) > 2 * coverReach).toBe(true)
	})
})
