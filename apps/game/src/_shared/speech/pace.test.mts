import { describe, expect, it } from 'vitest'
import { paceAfter, unheardPace } from './pace.mts'

describe('the pace of a voice', () => {
	it('takes the first line it hears as the pace', () => {
		expect(paceAfter(unheardPace, 60, 3, 1)).toEqual({ charactersPerSecond: 20, heard: 1 })
	})

	it('measures the pace at speed 1, whatever the speed it heard', () => {
		expect(paceAfter(unheardPace, 60, 1.5, 2).charactersPerSecond).toBe(20)
	})

	it('averages over the last lines', () => {
		const heard = [20, 20, 20, 20].reduce((pace) => paceAfter(pace, 60, 3, 1), unheardPace)
		expect(paceAfter(heard, 60, 2, 1).charactersPerSecond).toBe(22.5)
	})

	it('ignores short lines and lines cut short', () => {
		expect(paceAfter(unheardPace, 10, 0.5, 1)).toBe(unheardPace)
		expect(paceAfter(unheardPace, 60, 0.1, 1)).toBe(unheardPace)
		expect(paceAfter(unheardPace, 60, 60, 1)).toBe(unheardPace)
	})
})
