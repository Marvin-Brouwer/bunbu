import { describe, expect, it } from 'vitest'
import { ambushRoomConfig, ambushRoomOf, noRoom } from './ambush-room.mts'

describe('ambush room', () => {
	it('frames the fight below the scroll on a tall phone, under the duel strip', () => {
		const room = ambushRoomOf(390, 844)
		expect(room.strip).toBeGreaterThan(0)
		expect(room.below).toBeGreaterThanOrEqual(ambushRoomConfig.minimumBelow * 16)
		expect(room.below).toBeLessThanOrEqual(844 * ambushRoomConfig.largestBelow)
	})

	it('keeps the scroll tall enough to read', () => {
		const { scrollTop, scrollBottom, minimumScroll } = ambushRoomConfig
		for (const height of [700, 760, 844, 932]) {
			const { below, strip } = ambushRoomOf(390, height)
			expect(height - below - strip).toBeGreaterThanOrEqual((scrollTop + scrollBottom + minimumScroll) * 16)
		}
	})

	it('shows only the duel strip on a short phone', () => {
		expect(ambushRoomOf(375, 667)).toEqual({ below: 0, strip: (ambushRoomConfig.strip + ambushRoomConfig.stripGap) * 16 })
	})

	it('needs neither when the world shows beside the scroll', () => {
		expect(ambushRoomOf(1024, 768)).toEqual(noRoom)
		expect(ambushRoomOf(844, 390)).toEqual(noRoom)
	})
})
