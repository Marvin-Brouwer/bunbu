import { describe, expect, it } from 'vitest'
import { metresPerAmbush } from '../flows/run.mts'
import { randomOf } from './backdrop.mts'
import { townCover, townDistricts } from './castle-town.mts'
import { mountainCover, mountainDistricts } from './mountain-temple.mts'
import { riceCover, riceDistricts } from './rice-fields.mts'
import { coverKindAt, coverReach, coverSpotsAt, decoysOf } from './cover.mts'
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

describe('the covers of a district', () => {
	const stageLength = 40 * metresPerAmbush
	const random = randomOf(11)
	const kindsIn = (distance: number, role: 'ambush' | 'decoy') => Array.from({ length: 4000 }, () => coverKindAt(townCover, townDistricts, distance, stageLength, role, random))
	const share = (kinds: readonly string[], kind: string) => kinds.filter((one) => one === kind).length / kinds.length

	it('are the district\'s own where it has them, and the stage\'s elsewhere', () => {
		const gateGardens = new Set(townDistricts[0]!.cover!.map((choice) => choice.kind))

		expect(kindsIn(100, 'ambush').every((kind) => gateGardens.has(kind))).toBe(true)
		// The mountain temple's snowy heights, its last district, has none of its own.
		const snowy = Array.from({ length: 2000 }, () => coverKindAt(mountainCover, mountainDistricts, stageLength * 0.95, stageLength, 'ambush', random))
		expect(new Set(snowy)).toEqual(new Set(mountainCover.kinds))
	})

	it('have a villager mostly just there, rarely one a ninja comes from', () => {
		expect(share(kindsIn(100, 'decoy'), 'villager')).toBeGreaterThan(0.35)
		expect(share(kindsIn(100, 'ambush'), 'villager')).toBeLessThan(0.15)
	})
})

describe('a scarecrow on its own', () => {
	const random = randomOf(5)

	it('is never one a ninja comes from, only one along the way', () => {
		const kinds = (role: 'ambush' | 'decoy') => Array.from({ length: 3000 }, () => coverKindAt(riceCover, riceDistricts, 100, 40 * metresPerAmbush, role, random))
		expect(kinds('ambush')).not.toContain('lone-scarecrow')
		expect(kinds('decoy')).toContain('lone-scarecrow')
	})
})
