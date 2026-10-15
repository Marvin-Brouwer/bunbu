/**
 * Where the title's camera stands, so the samurai stands in the gap the name and the menu leave
 * free, whatever the phone ([1 Title](../../../../docs/design/screens.md#1-title--menu)). Plain
 * numbers, so the framing can be tested on the screens we play on.
 */

import { distanceFor, type Framing } from '../canvas/framing.mts'

type Point = readonly [x: number, y: number, z: number]

/** The samurai and the torii must fit side to side, on a narrow phone too. */
export const titleFraming: Framing = { fov: 40, halfWidth: 3.4, closest: 9 }

/** The gap between the name and the menu, in CSS pixels from the top of the screen. */
export type Gap = {
	readonly top: number
	readonly height: number
}

/** Metres from the ground to the top of the samurai's helmet, with a little air above it. */
export const samuraiHeight = 2.2
/** What part of the gap's height he may take at most, so he never touches the name or the menu. */
const filled = 0.7
/** The height the camera looks at: the middle of him. */
const lookHeight = 1
/** How far down the gap the middle of him stands: below its middle, leaving the torii room above him. */
const standsAt = 0.6
const cameraHeight = 1.9

/** On a wide screen, where across the screen the samurai stands: `-1` the left edge, `0` the middle. */
const wideAt = -0.55

export type TitleShot = {
	readonly position: Point
	readonly look: Point
	/**
	 * CSS pixels to move the picture up by (`setViewOffset`), so the samurai lands in the gap rather
	 * than in the middle of the screen.
	 */
	readonly shift: number
}

/**
 * The camera for a `width` × `height` screen with `gap` free for the samurai. `sway` moves it from
 * side to side, as a share of its distance. On a wide screen the menu stands in the middle, so the
 * samurai stands to its left with the whole height of the screen to himself.
 */
export function titleShot(width: number, height: number, gap: Gap, sway = 0): TitleShot {
	const aspect = width / height
	const wide = aspect > 1.1
	const free = wide ? { top: 0, height } : { top: Math.max(0, gap.top), height: Math.max(1, Math.min(gap.height, height)) }
	const halfTan = Math.tan((titleFraming.fov * Math.PI) / 360)
	// Back far enough that the torii fits across, and that he fits in the gap.
	const fitsGap = (samuraiHeight * height) / (2 * halfTan * filled * free.height)
	const distance = Math.max(distanceFor(aspect, titleFraming), fitsGap)
	// The camera moves over sideways, keeping the view straight down the path.
	const aside = wide ? -wideAt * distance * halfTan * aspect : 0
	const x = aside + sway * distance
	return {
		position: [x, cameraHeight, distance],
		look: [x, lookHeight, 0],
		shift: height / 2 - (free.top + free.height * standsAt),
	}
}
