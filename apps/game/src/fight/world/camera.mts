/**
 * Where the run's camera stands and looks: behind and above the samurai, far enough back that the
 * ninjas are in view on a narrow phone, and close in when he has fallen. Plain numbers, so the
 * framing can be tested against where the ninjas actually stand.
 */

import { distanceFor, type Framing } from '../../canvas/framing.mts'

type Point = readonly [x: number, y: number, z: number]

export type CameraSpot = {
	readonly position: Point
	readonly look: Point
}

/** What has to stay in view either side of the samurai, at his distance from the camera. */
export const runFraming: Framing = { fov: 50, halfWidth: 3.8, closest: 8 }

/** The camera's direction from the samurai: behind and above him, down the path. */
const behind: Point = [0, 0.45, 1]
const lookAhead: Point = [0, 2.4, -4]
const lookAheadPortrait: Point = [0, 4, -7]
const lookAheadWide: Point = [0, 1.4, -2.8]
/** Fallen, it comes in close to the samurai on his knee. */
const fallenCloser = 0.55
const lookFallen: Point = [0, 0.7, 0]

export function cameraOf(aspect: number, fallen: boolean, framing = runFraming): CameraSpot {
	const distance = distanceFor(aspect, framing) * (fallen ? fallenCloser : 1)
	const scale = distance / Math.hypot(...behind)
	return {
		position: [behind[0] * scale, behind[1] * scale, behind[2] * scale],
		// On a narrow portrait screen the extra look-ahead leaves the samurai low in frame. Tablets
		// use a gentler version so the lower ninja row remains visible.
		look: fallen ? lookFallen : aspect > 1 ? lookAheadWide : aspect <= 0.7 ? lookAheadPortrait : lookAhead,
	}
}
