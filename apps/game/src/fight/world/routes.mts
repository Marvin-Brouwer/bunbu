/**
 * The way a ninja that has no cover to leap out from runs in to where it stands for the fight: from
 * somewhere the camera can't see it, behind a house or off the screen, around whatever is solid
 * ([solids](./solids.mts)), through an alley between the houses if that is the way. So it never
 * shows up out of nowhere, and never runs through a wall or a tree. Where there is no such way, it
 * leaps down off a roof instead ([ninjas](./ninjas.mts)).
 *
 * The ground round where it will stand is cut into a grid, and the ways out from there are walked
 * cell by cell, the shortest first. Of the cells it can't be seen in, it starts from the one nearest
 * to where it would have started on open ground. Plain numbers, no three.js, so it can be tested.
 */

import { inside, reachOf, type Solid, type Spot } from './solids.mts'

export const routeConfig = {
	/** Metres per cell of the grid. */
	cell: 0.5,
	/** How far the grid reaches from where the ninja will stand, each way. */
	reach: 22,
	/** How far a ninja keeps from anything solid, its own width. */
	clearance: 0.35,
	/** The longest way it runs in: farther would be too fast for the time it has to come in. */
	longest: 18,
	/** The shortest: it doesn't step out from right beside where it will stand. */
	shortest: 4,
	/** How far off where it will stand its way may end, where that is too near something solid, as a post. */
	nudge: 1,
}

/**
 * The way in to `to`, from the start to `to`, around `solids`: from a spot that `startsFrom` allows,
 * as one the camera can't see, nearest to `wished`. `undefined` when there is no such way, or `to`
 * itself is in something solid, further than `nudge` from open ground.
 */
export function routeTo(to: Spot, wished: Spot, solids: readonly Solid[], startsFrom: (spot: Spot) => boolean, config = routeConfig): Spot[] | undefined {
	const { cell, reach, clearance, longest, shortest, nudge } = config
	const size = Math.round((reach * 2) / cell) + 1
	const middle = (size - 1) / 2
	const spotOf = (index: number): Spot => ({ x: to.x + ((index % size) - middle) * cell, z: to.z + (Math.floor(index / size) - middle) * cell })
	const near = solids.filter((solid) => Math.hypot(solid.x - to.x, solid.z - to.z) < reach * Math.SQRT2 + reachOf(solid) + clearance)
	// Each solid marks the cells it covers, looking only at the ones round it.
	const blocked = new Uint8Array(size * size)
	for (const solid of near) {
		const reachOut = reachOf(solid) + clearance
		const first = (at: number, round: (value: number) => number) => Math.min(size - 1, Math.max(0, round(at / cell + middle)))
		for (let row = first(solid.z - to.z - reachOut, Math.floor); row <= first(solid.z - to.z + reachOut, Math.ceil); row++) {
			for (let column = first(solid.x - to.x - reachOut, Math.floor); column <= first(solid.x - to.x + reachOut, Math.ceil); column++) {
				const index = row * size + column
				const { x, z } = spotOf(index)
				if (inside(solid, x, z, clearance)) blocked[index] = 1
			}
		}
	}
	// Where it will stand, or the open cell nearest it, where it stands too near something solid.
	const centre = Math.round(middle) * size + Math.round(middle)
	let start = -1
	let nearest = Infinity
	const nudging = Math.round(nudge / cell)
	for (let row = -nudging; row <= nudging; row++) {
		for (let column = -nudging; column <= nudging; column++) {
			const away = Math.hypot(row, column) * cell
			if (away <= nudge && away < nearest && blocked[centre + row * size + column] === 0) {
				start = centre + row * size + column
				nearest = away
			}
		}
	}
	if (start === -1) return undefined

	// The shortest way from `to` to every cell within `longest`, step by step.
	const distances = new Float64Array(size * size).fill(Infinity)
	const previous = new Int32Array(size * size).fill(-1)
	distances[start] = 0
	const queue = new Queue()
	queue.push(start, 0)
	const steps = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const
	for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
		const [index, distance] = next
		if (distance > (distances[index] ?? Infinity)) continue
		const column = index % size
		const row = Math.floor(index / size)
		for (const [across, along] of steps) {
			const toColumn = column + across
			const toRow = row + along
			if (toColumn < 0 || toRow < 0 || toColumn >= size || toRow >= size) continue
			const neighbour = toRow * size + toColumn
			// Diagonally only where both cells beside the step are open, so it never cuts a corner.
			if (blocked[neighbour] === 1 || blocked[row * size + toColumn] === 1 || blocked[toRow * size + column] === 1) continue
			const further = distance + Math.hypot(across, along) * cell
			if (further > longest || further >= (distances[neighbour] ?? Infinity)) continue
			distances[neighbour] = further
			previous[neighbour] = index
			queue.push(neighbour, further)
		}
	}

	// Of the cells it can get to from far enough, the one nearest to where it wished to start that it may start from.
	const candidates: { index: number; away: number }[] = []
	distances.forEach((distance, index) => {
		if (distance < shortest || distance === Infinity) return
		const { x, z } = spotOf(index)
		candidates.push({ index, away: Math.hypot(x - wished.x, z - wished.z) })
	})
	candidates.sort((one, other) => one.away - other.away)
	const from = candidates.find(({ index }) => startsFrom(spotOf(index)))
	if (from === undefined) return undefined

	const cells: number[] = []
	for (let index = from.index; index !== -1; index = previous[index] ?? -1) cells.push(index)
	const way = straightened(cells.map(spotOf), (one, other) => clearBetween(one, other, near, clearance))
	// The last step in to where it stands, from the open cell beside it.
	return start === centre ? way : [...way, to]
}

/** Whether the way from `one` to `other` keeps `clearance` from every one of `solids`. */
export function clearBetween(one: Spot, other: Spot, solids: readonly Solid[], clearance: number): boolean {
	const steps = Math.ceil(Math.hypot(other.x - one.x, other.z - one.z) / 0.2)
	for (let step = 0; step <= steps; step++) {
		const along = steps === 0 ? 0 : step / steps
		const x = one.x + (other.x - one.x) * along
		const z = one.z + (other.z - one.z) * along
		if (solids.some((solid) => inside(solid, x, z, clearance))) return false
	}
	return true
}

/** `spots` with every turn left out that it can run past straight, as `clear` says. */
export function straightened(spots: readonly Spot[], clear: (one: Spot, other: Spot) => boolean): Spot[] {
	const first = spots[0]
	if (first === undefined) return []
	const kept = [first]
	let at = 0
	while (at < spots.length - 1) {
		let next = spots.length - 1
		while (next > at + 1 && !clear(spots[at] ?? first, spots[next] ?? first)) next--
		kept.push(spots[next] ?? first)
		at = next
	}
	return kept
}

/** How long the way along `spots` is. */
export const lengthOf = (spots: readonly Spot[]): number =>
	spots.reduce((sum, spot, index) => {
		const before = spots[index - 1]
		return before === undefined ? sum : sum + Math.hypot(spot.x - before.x, spot.z - before.z)
	}, 0)

/** Where along `spots` it is, `amount` (`0` to `1`) of the way. */
export function partWay(spots: readonly Spot[], amount: number): Spot {
	let left = lengthOf(spots) * Math.min(1, Math.max(0, amount))
	for (let index = 1; index < spots.length; index++) {
		const from = spots[index - 1]
		const to = spots[index]
		if (from === undefined || to === undefined) continue
		const length = Math.hypot(to.x - from.x, to.z - from.z)
		if (left <= length && length > 0) return { x: from.x + (to.x - from.x) * (left / length), z: from.z + (to.z - from.z) * (left / length) }
		left -= length
	}
	return spots.at(-1) ?? { x: 0, z: 0 }
}

/** The cells still to walk, the nearest first: a binary heap. */
class Queue {
	private readonly items: [index: number, distance: number][] = []

	push(index: number, distance: number): void {
		const { items } = this
		items.push([index, distance])
		let at = items.length - 1
		while (at > 0) {
			const parent = (at - 1) >> 1
			if ((items[parent]?.[1] ?? 0) <= distance) break
			;[items[parent], items[at]] = [items[at] as [number, number], items[parent] as [number, number]]
			at = parent
		}
	}

	pop(): [index: number, distance: number] | undefined {
		const { items } = this
		const top = items[0]
		const last = items.pop()
		if (top === undefined || last === undefined || items.length === 0) return top
		items[0] = last
		let at = 0
		for (;;) {
			const left = at * 2 + 1
			const right = left + 1
			let smallest = at
			if ((items[left]?.[1] ?? Infinity) < (items[smallest]?.[1] ?? Infinity)) smallest = left
			if ((items[right]?.[1] ?? Infinity) < (items[smallest]?.[1] ?? Infinity)) smallest = right
			if (smallest === at) break
			;[items[smallest], items[at]] = [items[at] as [number, number], items[smallest] as [number, number]]
			at = smallest
		}
		return top
	}
}
