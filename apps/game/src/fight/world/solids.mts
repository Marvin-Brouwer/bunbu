/**
 * What a ninja can't run through: houses, walls, halls, trees, rocks, lanterns, shrines, the
 * covers. Foliage and bamboo it can brush through, so those aren't solid. Each stage lists its own
 * as it lays out a block ([blocks](./blocks.mts)), and a ninja that has no cover to leap out from
 * runs in around them ([routes](./routes.mts)). Plain numbers, no three.js, so it can be tested.
 */

/**
 * The ground a solid thing stands on: round, or a box `width` by `depth` turned `heading` about
 * `y`, and its `height` when it is taller than a ninja, as a house or a wall: then it hides what
 * stands behind it from the camera, and a ninja can leap down off it. Deep `water`, as a moat, a
 * ninja can't run through either, but it can rise out of it.
 */
export type Solid = Round | Box
type Round = { readonly x: number; readonly z: number; readonly radius: number; readonly height?: number; readonly water?: boolean }
export type Box = { readonly x: number; readonly z: number; readonly width: number; readonly depth: number; readonly heading: number; readonly height?: number; readonly water?: boolean }

/** How tall a ninja is, in metres: what is taller hides it. */
export const ninjaHeight = 1.8

/** A point on the ground. */
export type Spot = { readonly x: number; readonly z: number }

/** How far `x, z` is inside `solid`, given `margin` round it: more than `0` when inside. */
function depthIn(solid: Solid, x: number, z: number, margin: number): number {
	const dx = x - solid.x
	const dz = z - solid.z
	if ('radius' in solid) return solid.radius + margin - Math.hypot(dx, dz)
	const { across, along } = intoBox(solid, x, z)
	return Math.min(solid.width / 2 + margin - Math.abs(across), solid.depth / 2 + margin - Math.abs(along))
}

/** `x, z` in the box's own frame: `across` its width, `along` its depth, from its middle. */
export function intoBox(box: Box, x: number, z: number): { across: number; along: number } {
	const dx = x - box.x
	const dz = z - box.z
	const cos = Math.cos(box.heading)
	const sin = Math.sin(box.heading)
	return { across: dx * cos - dz * sin, along: dx * sin + dz * cos }
}

/** The spot `across` and `along` the box's own frame, in the world: {@link intoBox} undone. */
export function outOfBox(box: Box, across: number, along: number): Spot {
	const cos = Math.cos(box.heading)
	const sin = Math.sin(box.heading)
	return { x: box.x + across * cos + along * sin, z: box.z - across * sin + along * cos }
}

/** The first of `solids` that is a box taller than a ninja on the way from `from` to `to`, nearest `from`. */
export function tallBoxBetween(solids: readonly Solid[], from: Spot, to: Spot): Box | undefined {
	const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.25)
	for (let step = 0; step <= steps; step++) {
		const along = steps === 0 ? 0 : step / steps
		const x = from.x + (to.x - from.x) * along
		const z = from.z + (to.z - from.z) * along
		const found = solids.find((solid): solid is Box => !('radius' in solid) && (solid.height ?? 0) > ninjaHeight && inside(solid, x, z))
		if (found !== undefined) return found
	}
	return undefined
}

/** Of `solids`, the box taller than a ninja nearest to `spot`, within `reach` of it. */
export function nearestTallBox(solids: readonly Solid[], spot: Spot, reach: number): Box | undefined {
	let nearest: Box | undefined
	let nearestAway = reach
	for (const solid of solids) {
		if ('radius' in solid || (solid.height ?? 0) <= ninjaHeight) continue
		// How far `spot` is outside it.
		const { across, along } = intoBox(solid, spot.x, spot.z)
		const away = Math.hypot(Math.max(0, Math.abs(across) - solid.width / 2), Math.max(0, Math.abs(along) - solid.depth / 2))
		if (away < nearestAway) {
			nearest = solid
			nearestAway = away
		}
	}
	return nearest
}

/** The spot in `solid` nearest to `spot`, at least `inset` in from its edge where it is that big. */
export function nearestWithin(solid: Solid, spot: Spot, inset: number): Spot {
	if ('radius' in solid) {
		const away = Math.hypot(spot.x - solid.x, spot.z - solid.z)
		const most = Math.max(0, solid.radius - inset)
		if (away <= most) return spot
		return { x: solid.x + (spot.x - solid.x) * (most / away), z: solid.z + (spot.z - solid.z) * (most / away) }
	}
	const { across, along } = intoBox(solid, spot.x, spot.z)
	const clamp = (value: number, half: number) => Math.min(Math.max(0, half - inset), Math.max(-Math.max(0, half - inset), value))
	return outOfBox(solid, clamp(across, solid.width / 2), clamp(along, solid.depth / 2))
}

/** Whether `x, z` is within `margin` of `solid`. */
export const inside = (solid: Solid, x: number, z: number, margin = 0): boolean => depthIn(solid, x, z, margin) > 0

/** How far from `x, z` any part of `solid` can be: for leaving out the ones far away. */
export const reachOf = (solid: Solid): number => ('radius' in solid ? solid.radius : Math.hypot(solid.width, solid.depth) / 2)

/** `solid` moved by `offset`, as a block is when it is shown on another round of the path. */
export const moved = (solid: Solid, offset: Spot): Solid => ({ ...solid, x: solid.x + offset.x, z: solid.z + offset.z })

/** Whether one of `solids` taller than a ninja stands between `eye` and `spot`, on the ground. */
export function hiddenBehind(solids: readonly Solid[], eye: Spot, spot: Spot): boolean {
	const length = Math.hypot(spot.x - eye.x, spot.z - eye.z)
	const steps = Math.ceil(length / 0.5)
	return solids.some((solid) => {
		if ((solid.height ?? 0) <= ninjaHeight) return false
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
