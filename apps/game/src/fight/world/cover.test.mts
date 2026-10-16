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
})
