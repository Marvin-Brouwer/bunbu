import { describe, expect, it } from 'vitest'
import { marks, type Mark } from '../state/ambush.mts'
import { directionOf, finish, follow, markToward, strikesAtOnce, strokeAt, type Point } from './stroke.mts'

/** Replays a pointer sequence, from the pointer going down to it lifting, as the swipe zone does. */
function marksOf(points: readonly Point[], available: readonly Mark[] = marks): Mark[] {
	const [first, ...rest] = points
	if (first === undefined) return []
	const picked: Mark[] = []
	let stroke = strokeAt(first)
	for (const point of rest) {
		const step = follow(stroke, point, available)
		stroke = step.stroke
		if (step.mark !== undefined) picked.push(step.mark)
	}
	const last = finish(stroke, available)
	if (last !== undefined) picked.push(last)
	return picked
}

/** The pointer moving in a straight line, sampled every 8 px or so, like a pointermove at 60 Hz. */
function line(from: Point, to: Point): Point[] {
	const steps = Math.max(1, Math.round(Math.hypot(to.x - from.x, to.y - from.y) / 8))
	return Array.from({ length: steps }, (_, step) => ({
		x: from.x + ((to.x - from.x) * (step + 1)) / steps,
		y: from.y + ((to.y - from.y) * (step + 1)) / steps,
	}))
}

/** A path through `corners`, starting at the first one. */
const path = (...corners: Point[]): Point[] =>
	[corners[0]!, ...corners.slice(1).flatMap((corner, index) => line(corners[index]!, corner))]

const at = (x: number, y: number): Point => ({ x, y })

describe('markToward', () => {
	it('reads all 8 directions, with y growing downward', () => {
		const directions: Record<Mark, Point> = {
			up: at(0, -50),
			'up-right': at(40, -40),
			right: at(50, 0),
			'down-right': at(40, 40),
			down: at(0, 50),
			'down-left': at(-40, 40),
			left: at(-50, 0),
			'up-left': at(-40, -40),
		}
		for (const mark of marks) expect(markToward(directions[mark], marks)).toBe(mark)
	})

	it('ignores anything shorter than the dead zone', () => {
		expect(markToward(at(-20, 0), marks)).toBeUndefined()
	})

	it('snaps to the nearest mark in play', () => {
		expect(markToward(at(-40, -30), ['left', 'up', 'right'])).toBe('left')
		expect(markToward(at(30, -40), ['left', 'up', 'right'])).toBe('up')
	})

	it('ignores a swipe close to none of the marks in play', () => {
		expect(markToward(at(0, 50), ['left', 'up', 'right'])).toBeUndefined()
		expect(markToward(at(-50, 0), ['up', 'down'])).toBeUndefined()
	})
})

describe('directionOf', () => {
	it('points each mark back the way markToward reads it', () => {
		for (const mark of marks) {
			const toward = directionOf(mark)
			expect(Math.hypot(toward.x, toward.y)).toBeCloseTo(1)
			expect(markToward({ x: toward.x * 50, y: toward.y * 50 }, marks)).toBe(mark)
		}
	})
})

describe('a stroke', () => {
	it('is a tap while it stays in the dead zone', () => {
		expect(marksOf([at(100, 100), at(103, 98), at(98, 104), at(101, 100)])).toEqual([])
	})

	it('picks one mark for a straight swipe', () => {
		expect(marksOf(path(at(200, 100), at(80, 100)))).toEqual(['left'])
		expect(marksOf(path(at(200, 100), at(200, 20)))).toEqual(['up'])
		expect(marksOf(path(at(200, 100), at(280, 20)))).toEqual(['up-right'])
	})

	it('keeps a wobbly swipe as one mark', () => {
		const wobbly = [at(200, 100), at(190, 103), at(176, 98), at(160, 104), at(143, 99), at(127, 105), at(110, 101), at(96, 97)]
		expect(marksOf(wobbly)).toEqual(['left'])
	})

	it('keeps a gentle curve as one mark, in the direction of its chord', () => {
		// A quarter of a circle from the right of it to the top: the chord points up-left.
		const curve = Array.from({ length: 13 }, (_, step) => {
			const angle = (step / 12) * (Math.PI / 2)
			return at(100 + 80 * Math.cos(angle), 100 - 80 * Math.sin(angle))
		})
		expect(marksOf(curve)).toEqual(['up-left'])
	})

	it('picks two marks for one continuous ← → stroke', () => {
		expect(marksOf(path(at(200, 100), at(100, 100), at(220, 100)))).toEqual(['left', 'right'])
	})

	it('turns on a right angle: ← then ↑', () => {
		expect(marksOf(path(at(200, 200), at(100, 200), at(100, 100)))).toEqual(['left', 'up'])
	})

	it('picks every leg of a zigzag', () => {
		expect(marksOf(path(at(200, 200), at(120, 200), at(120, 120), at(200, 120), at(140, 180)))).toEqual(['left', 'up', 'right', 'down-left'])
	})

	it('ignores a short hook as the pointer lifts', () => {
		expect(marksOf([...path(at(200, 100), at(100, 100)), at(104, 92), at(106, 88)])).toEqual(['left'])
	})

	it('ignores the legs that are close to none of the marks in play', () => {
		expect(marksOf(path(at(200, 100), at(100, 100), at(100, 200), at(200, 200)), ['left', 'up', 'right'])).toEqual(['left', 'right'])
	})
})

describe('strikesAtOnce', () => {
	it('strikes at once when there is one pick to make', () => {
		expect(strikesAtOnce('yes-no')).toBe(true)
		expect(strikesAtOnce('single')).toBe(true)
		expect(strikesAtOnce('multiple')).toBe(false)
		expect(strikesAtOnce('order')).toBe(false)
	})
})
