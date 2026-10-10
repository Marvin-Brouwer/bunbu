/**
 * The way the samurai runs: not a straight line but streets with corners, then the winding path
 * through a garden, over and over for as long as the stage is. Plain numbers, so it can be tested.
 *
 * The run store only knows how far he has come (`distance`); this turns that into where he is and
 * which way he faces. The path is made of legs: straight ones, and arcs that turn by a fixed angle.
 * Heading `0` faces `-z`, and a positive heading turns left, like a rotation about `y`.
 */

/** What lines the path: houses along a street, or a garden. */
export type Zone = 'street' | 'garden'

export type PathPoint = {
	readonly x: number
	readonly z: number
	/** The rotation about `y` that faces along the path. */
	readonly heading: number
	readonly zone: Zone
}

type Leg = {
	readonly length: number
	/** Radians turned over the whole leg, left positive; `0` for a straight leg. */
	readonly turn: number
	readonly zone: Zone
}

/** How tightly the streets turn their corners, in metres. */
export const cornerRadius = 9

const corner = (side: 1 | -1): Leg => ({ length: (cornerRadius * Math.PI) / 2, turn: (side * Math.PI) / 2, zone: 'street' })

/**
 * One round of the town: a street, a corner, another street and a corner back, then into a garden
 * whose path winds left and right. The two corners cancel out, so the run keeps heading the same
 * way overall and the path never crosses itself.
 */
const round: readonly Leg[] = [
	{ length: 70, turn: 0, zone: 'street' },
	corner(1),
	{ length: 45, turn: 0, zone: 'street' },
	corner(-1),
	{ length: 35, turn: 0, zone: 'street' },
	{ length: 25, turn: 0, zone: 'garden' },
	{ length: 40, turn: 0.7, zone: 'garden' },
	{ length: 50, turn: -1.4, zone: 'garden' },
	{ length: 40, turn: 0.7, zone: 'garden' },
	{ length: 20, turn: 0, zone: 'garden' },
]

/** Metres in one round of the town. */
export const roundLength = round.reduce((sum, leg) => sum + leg.length, 0)

type LaidLeg = Leg & {
	readonly start: number
	readonly x: number
	readonly z: number
	readonly heading: number
}

export type Path = {
	/** Where the path is `distance` metres along. Before the start it carries on straight back. */
	at: (distance: number) => PathPoint
	/** Metres the path is laid out for; past that it carries on straight. */
	readonly length: number
}

/** Moves `along` metres from a point on a leg that turns `curvature` radians per metre. */
function travel(x: number, z: number, heading: number, curvature: number, along: number): { x: number; z: number; heading: number } {
	if (Math.abs(curvature) < 1e-9) {
		return { x: x - Math.sin(heading) * along, z: z - Math.cos(heading) * along, heading }
	}
	const turned = heading + curvature * along
	return {
		x: x + (Math.cos(turned) - Math.cos(heading)) / curvature,
		z: z - (Math.sin(turned) - Math.sin(heading)) / curvature,
		heading: turned,
	}
}

/** Lays the path out for at least `length` metres, starting at the origin facing `-z`. */
export function createPath(length: number): Path {
	const legs: LaidLeg[] = []
	let start = 0
	let point = { x: 0, z: 0, heading: 0 }
	while (start < length) {
		for (const leg of round) {
			legs.push({ ...leg, start, ...point })
			point = travel(point.x, point.z, point.heading, leg.turn / leg.length, leg.length)
			start += leg.length
		}
	}
	const end = { ...point, start }

	return {
		length: start,

		at(distance) {
			if (distance <= 0) {
				const first = legs[0]
				return { ...travel(0, 0, 0, 0, distance), zone: first?.zone ?? 'street' }
			}
			if (distance >= end.start) {
				return { ...travel(end.x, end.z, end.heading, 0, distance - end.start), zone: 'street' }
			}
			// Binary search for the leg the distance falls in.
			let low = 0
			let high = legs.length - 1
			while (low < high) {
				const middle = (low + high + 1) >> 1
				if ((legs[middle]?.start ?? 0) <= distance) low = middle
				else high = middle - 1
			}
			const leg = legs[low]
			if (leg === undefined) return { x: 0, z: 0, heading: 0, zone: 'street' }
			return { ...travel(leg.x, leg.z, leg.heading, leg.turn / leg.length, distance - leg.start), zone: leg.zone }
		},
	}
}

/** The point `side` metres to the right of the path at `point` (left when negative), and `ahead` metres along it. */
export function beside(point: Pick<PathPoint, 'x' | 'z' | 'heading'>, side: number, ahead = 0): { x: number; z: number } {
	const sin = Math.sin(point.heading)
	const cos = Math.cos(point.heading)
	return {
		x: point.x + cos * side - sin * ahead,
		z: point.z - sin * side - cos * ahead,
	}
}
