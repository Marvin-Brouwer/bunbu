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

/**
 * The least room the layout leaves him, in CSS pixels (`title.css`, 8rem): a long quiz title can
 * make the menu tall, and then the screen scrolls rather than squeezing him out.
 */
export const minimumGap = 128

export type TitleShot = {
	readonly position: Point
	readonly look: Point
	/**
	 * CSS pixels to move the picture up by (`setViewOffset`), so the samurai lands in the gap rather
	 * than in the middle of the screen.
	 */
	readonly shift: number
}

/** The farthest the camera stands back, in metres, however little room the gap leaves. */
export const farthest = 40

/**
 * The camera for a `width` × `height` screen with `gap` free for the samurai, on a phone and a
 * laptop alike: the path, the temple and he in the middle. `sway` moves it from side to side, as a
 * share of its distance.
 */
export function titleShot(width: number, height: number, gap: Gap, sway = 0): TitleShot {
	const aspect = width / height
	// What shows of the gap: scrolled, it can run off the top of the screen, and then he is framed
	// in what is left of it. Unscrolled the layout keeps it at least `minimumGap` high.
	const top = Math.max(0, gap.top)
	const bottom = Math.min(height, gap.top + gap.height)
	const free = { top, height: Math.max(1, gap.top < 0 ? bottom - top : Math.max(minimumGap, bottom - top)) }
	const halfTan = Math.tan((titleFraming.fov * Math.PI) / 360)
	// Back far enough that the torii fits across, and that he fits in the gap; never out of sight.
	const fitsGap = (samuraiHeight * height) / (2 * halfTan * filled * free.height)
	const distance = Math.min(farthest, Math.max(distanceFor(aspect, titleFraming), fitsGap))
	const x = sway * distance
	return {
		position: [x, cameraHeight, distance],
		look: [x, lookHeight, 0],
		shift: height / 2 - (free.top + free.height * standsAt),
	}
}
