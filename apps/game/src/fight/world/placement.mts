/**
 * Where a ninja stands around the samurai. Plain numbers, no three.js, so it can be tested.
 *
 * A ninja closes in on the side its mark points to as the player sees it: the camera looks down
 * the path from behind the samurai, so ↑ is ahead, → is to his right and ↓ is between him and the
 * camera. Swiping toward a mark is swiping toward the ninja. `approach` comes from the time left
 * ([time limit](../../../../../docs/design/gameplay.md#time-limit)), so how close they are is the
 * timer.
 */

import type { Mark } from '../../_shared/state/ambush.mts'

/** A point on the ground, the samurai at the origin, the path ahead along `-z`. */
export type Spot = {
	readonly x: number
	readonly z: number
	/** The heading that faces the samurai, as a rotation about `y`. */
	readonly facing: number
}

const lowSide = Math.sin(Math.PI / 6)
const lowDown = Math.cos(Math.PI / 6)

/** The direction of each mark on the ground, as the camera sees it. */
const directions: Readonly<Record<Mark, readonly [x: number, z: number]>> = {
	up: [0, -1],
	'up-right': [Math.SQRT1_2, -Math.SQRT1_2],
	right: [1, 0],
	// The lower diagonals are steeper: close to the camera, a wide angle runs off the screen's sides.
	'down-right': [lowSide, lowDown],
	down: [0, 1],
	'down-left': [-lowSide, lowDown],
	left: [-1, 0],
	'up-left': [-Math.SQRT1_2, -Math.SQRT1_2],
}

/** Defaults to tune with the real models. Metres. */
export const placementConfig = {
	/** How far from the samurai a ninja strikes from. */
	reach: 1.5,
	/** How far ahead the ninjas start, straight ahead and to the sides. */
	ahead: 11,
	aside: 7,
	/** How far to the side they start, for a mark that points fully sideways. */
	wide: 3.2,
	/** How much farther than in reach they start from below, short of the camera. */
	behind: 1,
	/** How much farther the back row stands than the front row. */
	backRow: 1.4,
}

/**
 * Where a ninja with `mark` in `wave` stands, at `approach` from `0` (far away) to `1` (in reach).
 *
 * They start in a fan ahead of the samurai, where the camera sees them coming even on a narrow
 * phone, and close in on the side their mark points to.
 */
export function spotOf(mark: Mark, wave: number, approach: number, config = placementConfig): Spot {
	const [x, z] = directions[mark]
	const near = Math.min(1, Math.max(0, approach))
	// The back row stands farther out, except from below: there farther out is off the screen's bottom.
	const back = z > 0 ? 0 : wave * config.backRow
	// From below they come straight in from a little farther out, with the camera at their back.
	const startX = z > 0 ? x * (config.reach + back + config.behind) : x * (config.wide + back)
	const startZ = z > 0
		? z * (config.reach + back + config.behind)
		: -(config.aside + (config.ahead - config.aside) * -z) - back
	const endX = x * (config.reach + back)
	const endZ = z * (config.reach + back)
	const spotX = startX + (endX - startX) * near
	const spotZ = startZ + (endZ - startZ) * near
	return {
		x: spotX,
		z: spotZ,
		// Facing the samurai at the origin: a figure faces `-z` when not rotated.
		facing: Math.atan2(spotX, spotZ),
	}
}

/**
 * How close a striking ninja is, `time` seconds into its strike. The store stops moving a ninja
 * once it strikes, wherever the answer caught it, so it lunges in to land the hit
 * ([outcome](../../../../../docs/design/gameplay.md#outcome)) over `seconds`.
 */
export function lungeOf(approach: number, time: number, seconds: number): number {
	const done = Math.min(1, Math.max(0, time / seconds))
	return approach + (1 - approach) * (1 - (1 - done) ** 2)
}

/** The heading from the samurai toward a mark, for turning to strike or block. */
export function headingOf(mark: Mark): number {
	const [x, z] = directions[mark]
	return Math.atan2(-x, -z)
}
