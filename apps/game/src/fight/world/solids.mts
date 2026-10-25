/**
 * What a ninja can't run through: houses, walls, halls, trees, rocks, lanterns, shrines, the
 * covers. Foliage and bamboo it can brush through, so those aren't solid. Each stage lists its own
 * as it lays out a block ([blocks](./blocks.mts)), and a ninja that has no cover to leap out from
 * runs in around them ([routes](./routes.mts)). Plain numbers, no three.js, so it can be tested.
 */

/**
 * The ground a solid thing stands on: round, or a box `width` by `depth` turned `heading` about
 * `y`. A tall one, a house or a wall, `hides` what stands behind it from the camera.
 */
export type Solid =
	| { readonly x: number; readonly z: number; readonly radius: number; readonly hides?: boolean }
	| { readonly x: number; readonly z: number; readonly width: number; readonly depth: number; readonly heading: number; readonly hides?: boolean }

/** A point on the ground. */
export type Spot = { readonly x: number; readonly z: number }

/** How far `x, z` is inside `solid`, given `margin` round it: more than `0` when inside. */
function depthIn(solid: Solid, x: number, z: number, margin: number): number {
	const dx = x - solid.x
	const dz = z - solid.z
	if ('radius' in solid) return solid.radius + margin - Math.hypot(dx, dz)
	// Into the box's own frame: `x` across its width, `z` along its depth.
	const cos = Math.cos(solid.heading)
	const sin = Math.sin(solid.heading)
	const across = dx * cos - dz * sin
	const along = dx * sin + dz * cos
	return Math.min(solid.width / 2 + margin - Math.abs(across), solid.depth / 2 + margin - Math.abs(along))
}

/** Whether `x, z` is within `margin` of `solid`. */
export const inside = (solid: Solid, x: number, z: number, margin = 0): boolean => depthIn(solid, x, z, margin) > 0

/** How far from `x, z` any part of `solid` can be: for leaving out the ones far away. */
export const reachOf = (solid: Solid): number => ('radius' in solid ? solid.radius : Math.hypot(solid.width, solid.depth) / 2)

/** `solid` moved by `offset`, as a block is when it is shown on another round of the path. */
export const moved = (solid: Solid, offset: Spot): Solid => ({ ...solid, x: solid.x + offset.x, z: solid.z + offset.z })

/** Whether one of `solids` that hides stands between `eye` and `spot`, on the ground. */
export function hiddenBehind(solids: readonly Solid[], eye: Spot, spot: Spot): boolean {
	const length = Math.hypot(spot.x - eye.x, spot.z - eye.z)
	const steps = Math.ceil(length / 0.5)
	return solids.some((solid) => {
		if (solid.hides !== true) return false
		// Only the ones near the line are worth stepping along it for.
		const reach = reachOf(solid)
		if (Math.hypot(solid.x - spot.x, solid.z - spot.z) > length + reach) return false
		for (let step = 1; step < steps; step++) {
			const along = step / steps
			if (inside(solid, eye.x + (spot.x - eye.x) * along, eye.z + (spot.z - eye.z) * along)) return true
		}
		return false
	})
}
