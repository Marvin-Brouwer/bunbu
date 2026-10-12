/**
 * Where the run's camera stands and looks: behind and above the samurai, far enough back that the
 * ninjas are in view on a narrow phone, and close in when he has fallen. Plain numbers, so the
 * framing can be tested against where the ninjas actually stand.
 *
 * `cameraOf` is the camera around the samurai, the way ahead along `-z`; `viewOnPath` sets that
 * down where he is on the path.
 */

import { distanceFor, type Framing } from '../../canvas/framing.mts'
import { beside, type Path } from './path.mts'

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

/** Where the samurai is, and the way ahead the camera and the ninjas around him go by. */
export type ViewFrame = {
	readonly x: number
	readonly z: number
	/** The rotation about `y` that faces ahead. */
	readonly heading: number
}

export type PathView = {
	readonly frame: ViewFrame
	readonly position: Point
	readonly look: Point
}

/**
 * The camera with the samurai `distance` metres along `path`. Ahead is the way from where the
 * path was the camera's distance back to him, so the camera stays over the path round a corner
 * and never cuts through a house. The ninjas stand around him square to that same way, so on
 * screen they stand where they would on a straight path, even round a corner.
 */
export function viewOnPath(path: Path, distance: number, aspect: number, fallen: boolean): PathView {
	const here = path.at(distance)
	// The way ahead goes by the running camera's distance, so the ninjas don't move when he falls.
	const [, , back] = cameraOf(aspect, false).position
	const from = path.at(distance - back)
	const frame = { x: here.x, z: here.z, heading: Math.atan2(from.x - here.x, from.z - here.z) }
	const spot = cameraOf(aspect, fallen)
	const at = ([x, y, z]: Point): Point => {
		const ground = beside(frame, x, -z)
		return [ground.x, y, ground.z]
	}
	return { frame, position: at(spot.position), look: at(spot.look) }
}

/** How the camera's picture is framed to a band at the foot of the screen. */
export type Framed = {
	/** The band's aspect, which the camera frames the fight for. */
	readonly aspect: number
	/** The vertical field of view of the whole picture, so the band gets `fov`. */
	readonly fov: number
	/** The height of the whole picture, centred on the band; the screen is its top `height` pixels. */
	readonly height: number
}

/**
 * Frames the fight in the bottom `band` pixels of a `width` × `height` screen, as if the band were
 * the screen: the camera's picture is centred on the band and as large as it has to be for the
 * band to get `fov`, and the screen shows its top part (three.js `setViewOffset`). Above the band
 * the world goes on, behind the scroll. A band as high as the screen is the usual picture.
 */
export function framedIn(width: number, height: number, band: number, fov: number): Framed {
	const bandHeight = Math.min(height, Math.max(1, band))
	const pictureHeight = 2 * height - bandHeight
	const halfTan = Math.tan((fov * Math.PI) / 360) * (pictureHeight / bandHeight)
	return {
		aspect: width / bandHeight,
		fov: (Math.atan(halfTan) * 360) / Math.PI,
		height: pictureHeight,
	}
}
