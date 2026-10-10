/**
 * Framing a subject so it fits in portrait and in landscape alike
 * ([platform](../../../../docs/design/gameplay.md#platform)). Plain numbers, so it can be tested.
 *
 * The field of view stays fixed, because widening it on a narrow phone bends the world like a
 * fisheye. On a narrow screen the camera steps back instead, until the width the world needs fits.
 */

export type Framing = {
	/** Vertical field of view in degrees. */
	readonly fov: number
	/** Metres that must stay in view either side of the subject. */
	readonly halfWidth: number
	/** The closest the camera comes, in metres, on a wide screen. */
	readonly closest: number
}

/** How far the camera stands from the subject for a screen of `aspect` (width / height). */
export function distanceFor(aspect: number, framing: Framing): number {
	const halfHeight = Math.tan((framing.fov * Math.PI) / 360)
	const needed = framing.halfWidth / (halfHeight * Math.max(aspect, 0.01))
	return Math.max(framing.closest, needed)
}
