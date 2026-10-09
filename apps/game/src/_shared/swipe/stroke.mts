/**
 * Reading swipes: one pointer stroke in the swipe zone turns into the marks it swiped toward
 * ([ambush](../../../../../docs/design/gameplay.md#ambush)). Plain TypeScript, so it is tested on
 * recorded pointer sequences.
 *
 * A stroke runs from the pointer going down to it lifting. It is read in pieces as long as the dead
 * zone, so jitter and taps never count. While the pieces keep their heading the swipe goes on; a
 * sharp turn ends one swipe and starts the next, so one continuous ← → stroke picks two marks.
 * Gentle curves stay one swipe, whose direction is the line from where it started to how far it got.
 *
 * Coordinates are the pointer's, in CSS pixels: `y` grows downward.
 */

import type { AmbushKind, Mark } from '../state/ambush.mts'

export type Point = {
	readonly x: number
	readonly y: number
}

/** The numbers to tune on a real phone ([to tune](../../../../../docs/design/gameplay.md#to-tune)). */
export const swipeConfig = {
	/** How far the pointer has to move before it is a swipe. Less is a tap or jitter. */
	deadZone: 24,
	/** How sharply a stroke has to turn, in degrees, to start a new swipe. */
	turnDegrees: 60,
	/**
	 * How far off a mark a swipe may be, in degrees, and still count as that mark. With all 8
	 * marks in play every swipe is within 22.5° of one; with fewer, a swipe close to none of them
	 * (↓ when the marks are ← ↑ →) is ignored.
	 */
	reachDegrees: 67.5,
}

/** Each mark's direction in degrees, counter-clockwise from → as on a compass rose. */
const degreesOf: Readonly<Record<Mark, number>> = {
	right: 0,
	'up-right': 45,
	up: 90,
	'up-left': 135,
	left: 180,
	'down-left': 225,
	down: 270,
	'down-right': 315,
}

/** A unit vector toward `mark`, in pointer coordinates: ↑ is `{ x: 0, y: -1 }`. */
export function directionOf(mark: Mark): Point {
	const radians = (degreesOf[mark] * Math.PI) / 180
	return { x: Math.cos(radians), y: -Math.sin(radians) }
}

const between = (from: Point, to: Point): Point => ({ x: to.x - from.x, y: to.y - from.y })

const lengthOf = (vector: Point) => Math.hypot(vector.x, vector.y)

/** Screen `y` grows downward, so it is flipped to make ↑ 90°. */
const degreesOfVector = (vector: Point) => (Math.atan2(-vector.y, vector.x) * 180) / Math.PI

/** The angle between two directions in degrees, `0` to `180`. */
function degreesApart(first: number, second: number): number {
	const apart = Math.abs(first - second) % 360
	return apart > 180 ? 360 - apart : apart
}

/**
 * The mark of `available` that `vector` swipes toward, or `undefined` when it is too short to be a
 * swipe or close to none of them.
 */
export function markToward(vector: Point, available: readonly Mark[]): Mark | undefined {
	if (lengthOf(vector) < swipeConfig.deadZone) return undefined
	const degrees = degreesOfVector(vector)
	let nearest: Mark | undefined
	let nearestApart = swipeConfig.reachDegrees
	for (const mark of available) {
		const apart = degreesApart(degrees, degreesOf[mark])
		if (apart <= nearestApart) {
			nearest = mark
			nearestApart = apart
		}
	}
	return nearest
}

/** The swipe a stroke is in the middle of. */
export type Stroke = {
	/** Where this swipe started: where the pointer went down, or where the stroke last turned. */
	readonly from: Point
	/** How far the swipe has got. Moves on in steps of the dead zone. */
	readonly furthest: Point
}

/** What a step of the stroke did: the stroke so far, and the mark of a swipe it ended. */
export type StrokeStep = {
	readonly stroke: Stroke
	readonly mark: Mark | undefined
}

/** A stroke starting where the pointer went down. */
export const strokeAt = (point: Point): Stroke => ({ from: point, furthest: point })

/** Follows the pointer to `point`. When the stroke turns sharply, the swipe before the turn is done. */
export function follow(stroke: Stroke, point: Point, available: readonly Mark[]): StrokeStep {
	const { deadZone, turnDegrees } = swipeConfig
	const heading = between(stroke.from, stroke.furthest)
	// Still in the dead zone: nothing has a direction yet.
	if (lengthOf(heading) < deadZone) return { stroke: { ...stroke, furthest: point }, mark: undefined }

	const onward = between(stroke.furthest, point)
	if (lengthOf(onward) < deadZone) return { stroke, mark: undefined }
	if (degreesApart(degreesOfVector(onward), degreesOfVector(heading)) < turnDegrees) {
		return { stroke: { ...stroke, furthest: point }, mark: undefined }
	}
	return {
		stroke: { from: stroke.furthest, furthest: point },
		mark: markToward(heading, available),
	}
}

/** The mark of the last swipe when the pointer lifts, or `undefined` for a tap. */
export const finish = (stroke: Stroke, available: readonly Mark[]): Mark | undefined =>
	markToward(between(stroke.from, stroke.furthest), available)

/**
 * Whether a pick strikes at once. `yes-no` and `single` hold one pick, so the swipe is the answer;
 * `multiple` and `order` strike after a pause once the pointer lifts.
 */
export const strikesAtOnce = (kind: AmbushKind) => kind === 'yes-no' || kind === 'single'
