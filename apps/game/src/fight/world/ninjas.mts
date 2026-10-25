/**
 * The ninjas of the current ambush, one figure per ninja in the store. Where each stands comes from
 * its mark and its `approach` ([placement](./placement.mts)); its pose from the store, timed from
 * when the store last changed it.
 *
 * Placement is around the samurai, square to the way the camera looks
 * ([viewOnPath](./camera.mts)), so round a corner they stay on screen where they would be on a
 * straight path.
 *
 * The figures and their timers are visual state: derived from the store, never fed back.
 */

import type { Group } from 'three'
import type { AmbushKind, AmbushOption, Mark } from '../../_shared/state/ambush.mts'
import { marks } from '../../_shared/state/ambush.mts'
import type { Ninja, NinjaPose } from '../state/ninjas.mts'
import { runConfig, tempo } from '../state/run.mts'
import type { Body } from '../../_shared/world/character.mts'
import type { ViewFrame } from './camera.mts'
import { coverReach, type CoverSpot } from './cover.mts'
import type { ClashSpot, SlainSpot } from './effects.mts'
import { beside } from './path.mts'
import { headingOf, lungeOf, spotOf } from './placement.mts'
import { clearBetween, partWay, routeConfig, routeTo } from './routes.mts'
import { inside, intoBox, nearestTallBox, nearestWithin, outOfBox, reachOf, tallBoxBetween, type Box, type Solid, type Spot } from './solids.mts'
import { poseSeconds, type FigurePose } from '../../_shared/world/poses.mts'

/**
 * Real seconds a ninja takes to come into view when an ambush springs: steady, while the world
 * keeps slowing down, and within the ambush's opening, so they are all in before the scroll opens,
 * the ones that wait their turn behind a shared cover too. As fast as the samurai runs, by the run's `tempo`.
 */
export const entranceSeconds = 1.35 / tempo
/**
 * Ninjas that share a cover come out from behind it one after another, this much of the entrance
 * apart and a little to the side of each other, and at most this many behind one.
 */
export const shareConfig = { stagger: 0.2, lane: 0.7, most: 3 }
/** Extra metres beyond the normal starting spot, so the entrance can be seen along the path. */
const entranceDistance = 8
/**
 * When the time ran out, the halves of the scroll fall before the ninjas strike: the slice is heard
 * out before the slicer's swing.
 */
export const strikeDelaySeconds = 0.95


/**
 * Seconds a blocked ninja takes to lunge in and bring its blade down, until the samurai's sword
 * meets it with a white flash. Then it is knocked back.
 */
export const clashSeconds = 0.2
/** Seconds a fleeing ninja takes to turn off to its side. */
const fleeTurnSeconds = 0.2
/** How much a fleeing ninja runs on along the path while it runs off to its side, per metre aside. */
const fleeAhead = 0.3

/** How far into its lunge a striking ninja takes to close in. */
const lungeSeconds = poseSeconds.strike * 0.6

/**
 * Seconds from a ninja's strike until its blade lands on the samurai: when it has closed in. The
 * slicer first cuts the scroll and waits for the halves to fall.
 */
export const bladeLandsAfter = (slicer: boolean): number => (slicer ? strikeDelaySeconds : 0) + lungeSeconds

/**
 * Where the ninjas stand while the time runs, of the way from where they start to in reach: they
 * run in to there, stand still ready for the attack, and charge in to strike from there.
 */
export const standReach = 0.6
/** How far into the strike a ninja holds its blade up, wound up when the time runs out. */
const windUpTime = poseSeconds.strike * 0.35
/** Metres a ninja leaps up charging in from where it crept to. */
const leapHeight = 0.6

/**
 * Radians of the running cycle per metre a ninja covers, so its feet keep to the ground at any
 * speed, and how slow it can go, in metres a second, and still be running rather than standing.
 */
const cyclePerMetre = Math.PI / 0.85
const standingSpeed = 0.05
/** Radians of the running cycle per world second as it strikes and flees, its own moves rather than the ground's. */
const creepCycle = 9

type Shown = {
	body: Body
	pose: Ninja['pose']
	/**
	 * The mark it closes in from. Kept, because committing an ambush clears its options while the
	 * ninjas are still being slain or blocked where the player swiped.
	 */
	mark: Mark
	sequence: number
	/** `0` while entering from farther along the path, `1` once at the normal starting spot. */
	entrance: number
	/** The cover it leaps out from behind, in the world, if there is one on its side ahead. */
	cover: CoverSpot | undefined
	/**
	 * How it comes in, in the world: by a leap, over its cover or down off a roof, or by the way it
	 * runs in around what is solid from where the camera can't see it ([routes](./routes.mts)).
	 * Neither when there is none: then it comes in from farther out the way its mark points.
	 */
	leap: Leap | undefined
	route: Spot[] | undefined
	/** The side it comes in on from ↓, picked at random: `1` right, `-1` left. */
	below: 1 | -1
	/** How far through its running cycle it is, where it was last drawn, and how fast it went, smoothed. */
	cycle: number
	last: { x: number; z: number } | undefined
	speed: number
	/** Seconds since the store last changed this ninja's pose. */
	time: number
	/** World seconds it has stood still, so it stands in slow motion too. */
	stood: number
	/** Where the samurai was when this ninja was beaten, so it stays on that spot as he runs on. */
	beatenAt: ViewFrame | undefined
	/** Where its blade meets the samurai's when he blocks it. */
	clash: { x: number; z: number }
}

/** Poses after the fight: the ninja stays on the path where it was beaten, and the run passes it by. */
const beaten = new Set<Ninja['pose']>(['slain', 'blocked', 'fleeing'])

/**
 * Where the ninjas of a `yes-no` attack come from, by id. Its marks say yes or no, not where a
 * ninja is, so the ninja of each solution of a `solutions` question has its own spot.
 */
const yesNoSpots: readonly Mark[] = ['up', 'up-left', 'up-right', 'left', 'right']
const yesNoSpotOf = (id: number): Mark => yesNoSpots[id % yesNoSpots.length] ?? 'up'

/**
 * The mark a ninja comes from: its first option's, or `undefined` once the ambush's options are
 * gone. In a `yes-no` attack, its spot by id.
 */
export function markOf(ninja: Ninja, options: readonly AmbushOption[], kind: AmbushKind): Mark | undefined {
	const first = ninja.options[0]
	if (first === undefined || options[first] === undefined) return undefined
	return kind === 'yes-no' ? yesNoSpotOf(ninja.id) : options[first].mark
}

/** A mark for a ninja that never had options to go by, spread out by its id. */
const markById = (id: number): Mark => marks[(id * 2) % marks.length] ?? 'up'

/**
 * The side a ninja flees to, `1` right of the path and `-1` left: away from the path on the side it
 * stands, so the samurai doesn't run into it. One in the middle picks a side by its `id`.
 */
export function fleeSideOf(x: number, id: number): 1 | -1 {
	if (Math.abs(x) > 0.3) return x > 0 ? 1 : -1
	return id % 2 === 0 ? 1 : -1
}

/** How a ninja comes out from behind its cover: where it waits, how high it leaps, where it lands. */
export const leapConfig = {
	/** Metres from the middle of the cover it waits behind, and lands in front of: clear of all of it. */
	behind: 2.2,
	ahead: 2.2,
	/** Metres off the ground at the top of its leap. */
	height: 3,
	/** How far into its entrance it waits, and where it lands, of the whole entrance. */
	waits: 0.12,
	lands: 0.4,
}

/** Where a ninja coming out from behind its cover is: in the world, how high off the ground, and doing what. */
export type OutOf = { x: number; z: number; hop: number; doing: 'hiding' | 'leaping' | 'running' }

/**
 * Where a ninja coming out from behind `cover` is, `amount` (`0` to `1`) into its entrance, with
 * the samurai at `from` when it came: crouched behind the cover, then leaping over it toward him,
 * then running on to `to`, where it stands for the fight.
 *
 * The leap goes up nearly straight, over the top of the cover, and down nearly straight in front of
 * it, so it clears the whole cover ({@link coverReach} round its middle, {@link coverHeight} high).
 */
export function outOf(cover: CoverSpot, from: { x: number; z: number }, to: { x: number; z: number }, amount: number, lane = 0): OutOf {
	return leapIn(overCover(cover, from, lane), to, amount)
}

/**
 * A leap a ninja comes in by: where it waits, out of sight, and lands, how high it goes on the way,
 * and how far into its entrance it waits and lands, of the whole entrance; and how deep under water
 * it waits, when it rises out of it.
 */
export type Leap = { readonly hidden: Spot; readonly landed: Spot; readonly height: number; readonly waits: number; readonly lands: number; readonly sunk?: number }

/** The leap over `cover`, with the samurai at `from` when it came, for the `lane` of one that shares it. */
function overCover(cover: CoverSpot, from: Spot, lane: number): Leap {
	const { behind, ahead, height, waits, lands } = leapConfig
	// The way from the samurai to the cover, flat, and across it for the `lane` of one that shares it.
	const away = Math.hypot(cover.x - from.x, cover.z - from.z) || 1
	const out = { x: (cover.x - from.x) / away, z: (cover.z - from.z) / away }
	const aside = { x: -out.z * lane * shareConfig.lane, z: out.x * lane * shareConfig.lane }
	return {
		hidden: { x: cover.x + out.x * behind + aside.x, z: cover.z + out.z * behind + aside.z },
		landed: { x: cover.x - out.x * ahead + aside.x, z: cover.z - out.z * ahead + aside.z },
		height,
		waits,
		lands,
	}
}

/** Metres from where it would come from on open ground that a ninja looks for a roof to leap down off, when nothing stands in its way. */
const roofReach = 16

/** How a ninja leaps down off a roof: how far behind the back wall it waits, and before the front it lands, how far over the ridge it goes, and its timing. */
export const roofConfig = { behind: 1, ahead: 1.2, over: 1, waits: 0.05, lands: 0.6 }

/**
 * The leap over `roof`, a building or a wall, toward `to`, where it stands for the fight: from
 * behind it, where the camera can't see it, across it in line with `wished`, where it would have
 * come from on open ground, down in front of it, clear of what is solid there, as a moat.
 */
export function offRoof(roof: Box, to: Spot, wished: Spot, solids: readonly Solid[] = []): Leap {
	const { behind, ahead, over, waits, lands } = roofConfig
	// Its front is the side toward where it will stand.
	const front = intoBox(roof, to.x, to.z).along > 0 ? 1 : -1
	const across = Math.min(roof.width / 2 - 0.5, Math.max(-roof.width / 2 + 0.5, intoBox(roof, wished.x, wished.z).across))
	let out = roof.depth / 2 + ahead
	const landsIn = () => {
		const { x, z } = outOfBox(roof, across, front * out)
		return solids.some((solid) => inside(solid, x, z, routeConfig.clearance))
	}
	while (landsIn() && out < roof.depth / 2 + roofReach) out += routeConfig.cell
	return {
		hidden: outOfBox(roof, across, -front * (roof.depth / 2 + behind)),
		landed: outOfBox(roof, across, front * out),
		height: (roof.height ?? 0) + over,
		waits,
		lands,
	}
}

/**
 * How a ninja rises out of deep water: how far in from its edge and how deep it waits, how high it
 * springs out onto the bank and how far past the edge it lands, and its timing; how near where it
 * will stand the water has to be, and how often one comes that way where there is some.
 */
export const waterConfig = { inset: 1.5, sunk: 1.9, height: 1.4, ahead: 0.8, waits: 0.1, lands: 0.45, reach: 12, chance: 0.4 }

/**
 * The leap up out of `water` toward `to`, where it stands for the fight: from under the water
 * nearest `wished`, where it would have come from on open ground, if `toward` allows, out onto the
 * bank and on from there clear of `solids`.
 */
function outOfWater(water: Solid, to: Spot, wished: Spot, toward: (spot: Spot) => boolean, solids: readonly Solid[]): Leap | undefined {
	const { inset, sunk, height, ahead, waits, lands, reach } = waterConfig
	const hidden = nearestWithin(water, wished, inset)
	const length = Math.hypot(to.x - hidden.x, to.z - hidden.z)
	if (length > reach || length === 0 || !toward(hidden)) return undefined
	const at = (out: number): Spot => ({ x: hidden.x + (to.x - hidden.x) * (out / length), z: hidden.z + (to.z - hidden.z) * (out / length) })
	// Out to the edge on the way to `to`, then a little past it.
	let out = 0
	while (out < length && inside(water, at(out).x, at(out).z, routeConfig.clearance)) out += routeConfig.cell / 2
	out += ahead
	const landed = at(out)
	if (out >= length || !clearBetween(landed, to, solids, routeConfig.clearance)) return undefined
	return { hidden, landed, height, waits, lands, sunk }
}

/**
 * Where a ninja coming in by `leap` is, `amount` (`0` to `1`) into its entrance: waiting out of
 * sight, then leaping, then running on to `to`, where it stands for the fight.
 */
function leapIn(leap: Leap, to: Spot, amount: number): OutOf {
	const { hidden, landed, height, waits, lands, sunk } = leap
	if (amount <= waits) return { ...hidden, hop: sunk === undefined ? 0 : -sunk, doing: 'hiding' }
	if (amount < lands) {
		const flown = (amount - waits) / (lands - waits)
		// Flat over the top and steep at either end: 1 - u⁴, with u from -1 through 0 to 1. Out of
		// water, up from under it.
		const hop = height * (1 - (2 * flown - 1) ** 4) - (sunk ?? 0) * (1 - flown)
		return { x: hidden.x + (landed.x - hidden.x) * flown, z: hidden.z + (landed.z - hidden.z) * flown, hop, doing: 'leaping' }
	}
	const run = (amount - lands) / (1 - lands)
	return { x: landed.x + (to.x - landed.x) * run, z: landed.z + (to.z - landed.z) * run, hop: 0, doing: 'running' }
}

/** The angle from `from` to `to`, the short way round. */
const turnBetween = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from))

/** How close a ninja is, what it shows, and how high it leaps. */
export type Motion = {
	readonly approach: number
	readonly pose: FigurePose
	readonly time: number
	/** Metres off the ground. */
	readonly hop: number
}

/** Seconds a ninja shows its cut, or being knocked back, before it turns and flees on its own. */
const strikeSeconds = poseSeconds.strike + 0.1
const knockedSeconds = poseSeconds.blocked + 0.1

/** Having struck, it flees from in reach, `since` seconds after it was done. */
const fleeing = (since: number): Motion => ({ approach: 1, pose: 'fleeing', time: since, hop: 0 })

/** Lunging in from `approach` over `seconds`: how close it is and how high it leaps, `time` seconds in. */
function charge(approach: number, time: number, seconds: number): Pick<Motion, 'approach' | 'hop'> {
	const done = Math.min(1, Math.max(0, time / seconds))
	return { approach: lungeOf(approach, time, seconds), hop: Math.sin(Math.PI * done) * leapHeight * (1 - approach) }
}

/**
 * How close a ninja in `pose` is, and what it shows, `time` seconds after the store gave it that
 * pose. `approach` is where the store left it.
 *
 * - Striking in an outcome, it charges in at once to land its hit. After the time ran out, the
 *   slicer cuts the scroll from where it stands and charges in once the halves have fallen; the
 *   others wind up while they fall, then turn and flee from where they stand.
 * - Blocked, it lunges in and cuts first; the samurai's sword meets it after `clashSeconds`, and
 *   it is knocked back.
 * - Having landed its hit or been knocked back, it flees straight away, without waiting for the
 *   others.
 */
export function motionOf(pose: NinjaPose, slicer: boolean | undefined, approach: number, time: number): Motion {
	if (pose === 'strike') {
		if (slicer === undefined) {
			return time < strikeSeconds ? { ...charge(approach, time, lungeSeconds), pose, time } : fleeing(time - strikeSeconds)
		}
		const wait = time - strikeDelaySeconds
		// The slicer cuts through the scroll from where it stands; the others wind up while it
		// falls. Then the slicer charges in to land the hit, and the others flee.
		if (wait <= 0) return { approach, pose, time: slicer ? time : windUpTime, hop: 0 }
		if (!slicer) return { approach, pose: 'fleeing', time: wait, hop: 0 }
		return wait < strikeSeconds ? { ...charge(approach, wait, lungeSeconds), pose, time: wait } : fleeing(wait - strikeSeconds)
	}
	if (pose === 'blocked') {
		if (time < clashSeconds) return { ...charge(approach, time, clashSeconds), pose: 'strike', time }
		const knocked = time - clashSeconds
		return knocked < knockedSeconds ? { approach: 1, pose, time: knocked, hop: 0 } : fleeing(knocked - knockedSeconds)
	}
	if (pose === 'fleeing') return { approach: 1, pose, time, hop: 0 }
	return { approach, pose, time, hop: 0 }
}

/** What is round an ambush, that the ninjas come in by. */
export type Surroundings = {
	/** The ambush's covers ([cover](./cover.mts)), to leap out from behind. */
	readonly covers: readonly CoverSpot[]
	/** What is solid round it, to run around ([solids](./solids.mts)): only asked for when a ninja comes in without a cover. */
	readonly solids: () => readonly Solid[]
	/** Whether the camera can't see a ninja standing at `spot`, with `solids` round it. */
	readonly hidden: (spot: Spot, solids: readonly Solid[]) => boolean
}

const nothingAround: Surroundings = { covers: [], solids: () => [], hidden: () => false }

export type NinjasView = {
	/**
	 * Makes the figures match `active`. `delta` is real time, `worldDelta` slowed down, `frame`
	 * where the samurai is and the way ahead. A ninja that comes in runs out from behind one of the
	 * ambush's covers, or else in around what is solid from where the camera can't see it.
	 */
	draw: (active: readonly Ninja[], options: readonly AmbushOption[], kind: AmbushKind, frame: ViewFrame, delta: number, worldDelta: number, around?: Surroundings) => void
	/** Swaps every figure's body for one made by `make`, for when the real model has loaded. */
	remake: (make: () => Body) => void
	/** The heading from the samurai toward where the ninja with `id` was last drawn, for him to turn toward. */
	headingOf: (id: number) => number | undefined
	/** Where each slain ninja lies, and for how long, for his ink splash. */
	slain: () => SlainSpot[]
	/** Where blades met on a block, and how long ago, for the white flash. */
	clashes: () => ClashSpot[]
	dispose: () => void
}

/** How far `point` is from the line from `from` to `to`, flat. */
function offLine(point: { x: number; z: number }, from: { x: number; z: number }, to: { x: number; z: number }): number {
	const dx = to.x - from.x
	const dz = to.z - from.z
	const length = dx * dx + dz * dz
	const along = length === 0 ? 0 : Math.min(1, Math.max(0, ((point.x - from.x) * dx + (point.z - from.z) * dz) / length))
	return Math.hypot(point.x - (from.x + dx * along), point.z - (from.z + dz * along))
}

/** Whether two cover spots are the same one: the spots are worked out afresh every frame. */
const sameCover = (one: CoverSpot, other: CoverSpot) => Math.hypot(one.x - other.x, one.z - other.z) < 0.01

/**
 * The cover a ninja that will stand at `start` (round the samurai at `frame`, the way ahead along `-z`)
 * runs out from behind: of the `covers` on its side ahead of him, the nearest one it can come out
 * from toward him all the way. It lands beyond where it will stand
 * for the fight, once the samurai has run on, and runs in from there clear of the other covers.
 * One that comes from behind the camera, or for which no cover will do, has none and runs in from
 * farther along the path; one from straight ahead picks a side by its `id`.
 */
export function coverOf(start: { x: number; z: number }, id: number, frame: ViewFrame, covers: readonly CoverSpot[]): CoverSpot | undefined {
	if (start.z >= 0) return undefined
	const side = fleeSideOf(start.x, id)
	const sin = Math.sin(frame.heading)
	const cos = Math.cos(frame.heading)
	// Round the samurai: how far to his right, and how far ahead ({@link beside} undone).
	const around = covers.map((cover) => {
		const dx = cover.x - frame.x
		const dz = cover.z - frame.z
		return { cover, right: dx * cos - dz * sin, ahead: -dx * sin - dz * cos }
	})
	// Where it will stand, once the samurai has run on as far as an ambush lets him.
	const stands = { right: start.x, ahead: -start.z + runConfig.ambushRunOn }
	const fits = around.filter(({ cover, right, ahead }) => {
		if (Math.sign(right) !== side || ahead <= 0) return false
		const away = Math.hypot(right, ahead)
		const landed = { x: right * (1 - leapConfig.ahead / away), z: ahead * (1 - leapConfig.ahead / away) }
		if (landed.z < stands.ahead) return false
		const to = { x: stands.right, z: stands.ahead }
		return around.every((other) => other.cover === cover || offLine({ x: other.right, z: other.ahead }, landed, to) > coverReach + 0.3)
	})
	return fits.toSorted((one, other) => one.ahead - other.ahead)[0]?.cover
}

/** Metres from the samurai that what is solid is looked at for a ninja's way in: past the camera and the farthest it starts from. */
const nearSolids = 50

/** The entrance a ninja without a cover makes on open ground: from farther out the same way it comes from. */
function farOut(far: Spot): Spot {
	const length = Math.hypot(far.x, far.z)
	return length > 0 ? { x: far.x * (1 + entranceDistance / length), z: far.z * (1 + entranceDistance / length) } : far
}

/**
 * How a ninja without a cover comes in, in the world, with the samurai at `frame` when it comes:
 * running in around what is solid ([routes](./routes.mts)) from where the camera can't see it,
 * toward the samurai and as near as it can to where it would come from on open ground. Where there
 * is no such way, it leaps down off a roof: of the building or wall in the way of that, or else the
 * nearest one on its side of the way. Neither, where there is nothing to come from behind. One that
 * `rises` comes up out of deep water near where it will stand instead, where there is any, as near
 * as it can to where it would come from.
 */
export function wayIn(mark: Mark, wave: number, below: 1 | -1, frame: ViewFrame, around: Surroundings, rises = false): { leap: Leap | undefined; route: Spot[] | undefined } {
	const stand = spotOf(mark, wave, standReach, below)
	const far = farOut(spotOf(mark, wave, 0, below))
	// Where it and the samurai will stand, once he has run on as far as an ambush lets him.
	const to = beside(frame, stand.x, -stand.z + runConfig.ambushRunOn)
	const samurai = beside(frame, 0, runConfig.ambushRunOn)
	const wished = beside(frame, far.x, -far.z)
	// What is near enough to stand in its way, or between it and the camera.
	const solids = around.solids().filter((solid) => Math.hypot(solid.x - frame.x, solid.z - frame.z) < nearSolids + reachOf(solid))
	// From farther from the samurai than where it will stand, on the same side of him along the way,
	// so it runs in toward him, never away from him or past him.
	const ahead = (spot: Spot) => -(spot.x - samurai.x) * Math.sin(frame.heading) - (spot.z - samurai.z) * Math.cos(frame.heading)
	const toward = (spot: Spot) => Math.sign(ahead(spot)) === Math.sign(ahead(to))
		&& Math.hypot(spot.x - samurai.x, spot.z - samurai.z) > Math.hypot(to.x - samurai.x, to.z - samurai.z) + 1
	if (rises) {
		const waters = solids.filter((solid) => solid.water === true)
		const nearest = (water: Solid) => {
			const under = nearestWithin(water, wished, waterConfig.inset)
			return Math.hypot(under.x - wished.x, under.z - wished.z)
		}
		const leap = waters.toSorted((one, other) => nearest(one) - nearest(other)).map((water) => outOfWater(water, to, wished, toward, solids)).find((found) => found !== undefined)
		if (leap !== undefined) return { leap, route: undefined }
	}
	const route = routeTo(to, wished, solids, (spot) => toward(spot) && around.hidden(spot, solids))
	if (route !== undefined) return { leap: undefined, route }
	// Off a roof on its own side of the way, rather than across it, where there is one.
	const right = (spot: Spot) => (spot.x - samurai.x) * Math.cos(frame.heading) - (spot.z - samurai.z) * Math.sin(frame.heading)
	const ownSide = solids.filter((solid) => Math.sign(right(solid)) === Math.sign(right(to)))
	const roof = tallBoxBetween(solids, to, wished) ?? nearestTallBox(ownSide, wished, roofReach) ?? nearestTallBox(solids, wished, roofReach)
	return { leap: roof === undefined ? undefined : offRoof(roof, to, wished, solids), route: undefined }
}

/** `parent` is in world space, and `make` makes a ninja's body. */
export function createNinjasView(parent: Group, make: () => Body): NinjasView {
	// Ninja id to its figure.
	const shown = new Map<number, Shown>()
	let maker = make

	const drop = (id: number, entry: Shown) => {
		parent.remove(entry.body.root)
		entry.body.dispose()
		shown.delete(id)
	}

	return {
		draw(active, options, kind, frame, delta, worldDelta, around = nothingAround) {

			for (const ninja of active) {
				let entry = shown.get(ninja.id)
				// A new ambush gives its ninjas the ids the last one's had, at once: one that comes in
				// again after the fight is a new ninja, with its own cover and entrance.
				if (entry !== undefined && entry.pose !== 'approach' && ninja.pose === 'approach') {
					drop(ninja.id, entry)
					entry = undefined
				}
				if (entry === undefined) {
					const mark = markOf(ninja, options, kind) ?? (kind === 'yes-no' ? yesNoSpotOf(ninja.id) : markById(ninja.id))
					// Ninjas behind one cover take turns: each one waits for the ones before it to leap.
					const behind = coverOf(spotOf(mark, ninja.wave, standReach), ninja.id, frame, around.covers)
					const sharing = behind === undefined ? 0 : [...shown.values()].filter((other) => other.entrance < 1 && other.cover !== undefined && sameCover(other.cover, behind)).length
					const cover = sharing < shareConfig.most ? behind : undefined
					const below = Math.random() < 0.5 ? 1 : -1
					entry = {
						body: maker(),
						pose: ninja.pose,
						mark,
						sequence: ninja.sequence,
						time: 0,
						stood: 0,
						entrance: cover === undefined ? 0 : -sharing * shareConfig.stagger,
						cover,
						// Behind a cover, the first one behind its middle, the others either side.
						...cover === undefined ? wayIn(mark, ninja.wave, below, frame, around, Math.random() < waterConfig.chance) : { leap: overCover(cover, frame, [0, 1, -1][sharing] ?? 0), route: undefined },
						below,
						cycle: ninja.id * 1.7,
						last: undefined,
						speed: 0,
						beatenAt: undefined,
						clash: { x: 0, z: 0 },
					}
					shown.set(ninja.id, entry)
					parent.add(entry.body.root)
				}
				entry.entrance = Math.min(1, entry.entrance + delta / entranceSeconds)
				if (entry.sequence === ninja.sequence) {
					entry.time += delta
				} else {
					entry.sequence = ninja.sequence
					entry.time = 0
				}
				entry.pose = ninja.pose

				entry.mark = markOf(ninja, options, kind) ?? entry.mark
				// They stand still at their distance while the time runs, and charge in from there.
				const motion = motionOf(ninja.pose, ninja.slicer, standReach, entry.time)

				if (!beaten.has(ninja.pose) && motion.pose !== 'fleeing') entry.beatenAt = undefined
				else entry.beatenAt ??= frame
				const spot = spotOf(entry.mark, ninja.wave, motion.approach, entry.below)
				// Enter from behind its cover, around what is solid from where the camera can't see it, or
				// else from farther out the same way.
				const entrance = farOut(spotOf(entry.mark, ninja.wave, 0, entry.below))
				const visible = {
					x: entrance.x + (spot.x - entrance.x) * entry.entrance,
					z: entrance.z + (spot.z - entrance.z) * entry.entrance,
				}
				// Around the samurai where he is, or where he was when this ninja was beaten: it stays on
				// that spot as he runs on.
				const samurai = entry.beatenAt ?? frame
				const standsAt = beside(samurai, spot.x, -spot.z)
				const at: OutOf = entry.entrance < 1 && entry.leap !== undefined
					? leapIn(entry.leap, standsAt, entry.entrance)
					: entry.entrance < 1 && entry.route !== undefined
						? { ...partWay([...entry.route.slice(0, -1), standsAt], entry.entrance), hop: 0, doing: 'running' }
						: { ...beside(samurai, visible.x, -visible.z), hop: 0, doing: 'running' }
				const { root } = entry.body
				root.position.set(at.x, motion.hop + at.hop, at.z)
				// Its legs go by the ground it covers, so it never slides, and it stands still when it
				// doesn't move: behind its cover, and waiting its turn once the scroll is answered.
				const moved = entry.last === undefined ? 0 : Math.hypot(at.x - entry.last.x, at.z - entry.last.z)
				entry.last = { x: at.x, z: at.z }
				if (motion.pose !== 'approach') entry.cycle += worldDelta * creepCycle
				else if (at.doing === 'running') entry.cycle += moved * cyclePerMetre
				if (delta > 0) entry.speed += (moved / delta - entry.speed) * Math.min(1, delta * 10)
				// Facing the samurai: a figure faces -z when not turned.
				const toX = samurai.x - at.x
				const toZ = samurai.z - at.z
				const facing = Math.hypot(toX, toZ) > 1e-6 ? Math.atan2(-toX, -toZ) : samurai.heading
				// The figure runs off behind its back; fleeing, it turns that way off to its side.
				if (motion.pose === 'fleeing') {
					const side = fleeSideOf(visible.x, ninja.id)
					const off = beside(samurai, side, fleeAhead)
					const away = Math.atan2(off.x - samurai.x, off.z - samurai.z)
					root.rotation.y = facing + turnBetween(facing, away) * Math.min(1, motion.time / fleeTurnSeconds)
				} else {
					root.rotation.y = facing
				}
				// Where the blades meet on a block: between the two, nearer the samurai's sword.
				entry.clash = { x: samurai.x + (at.x - samurai.x) * 0.45, z: samurai.z + (at.z - samurai.z) * 0.45 }
				const standing = motion.pose === 'approach' && (at.doing === 'hiding' || (at.doing === 'running' && entry.speed < standingSpeed))
				// At its place it winds up as the time runs, its blade up when the time runs out: `approach`
				// is how much of the time has gone. Answered, it holds where it got to.
				const windingUp = standing && at.doing === 'running' && ninja.approach > 0
				const pose = windingUp ? 'strike' : standing ? 'idle' : motion.pose
				entry.stood = standing ? entry.stood + worldDelta : 0
				const time = windingUp ? windUpTime * ninja.approach : standing ? entry.stood : motion.time
				// In the air its legs keep the stride it took off with.
				entry.body.show(pose, time, entry.cycle)
			}

			for (const [id, entry] of shown) {
				if (!active.some((ninja) => ninja.id === id)) drop(id, entry)
			}
		},

		remake(next) {
			maker = next
			for (const entry of shown.values()) {
				parent.remove(entry.body.root)
				entry.body.dispose()
				entry.body = next()
				parent.add(entry.body.root)
			}
		},

		headingOf(id) {
			const entry = shown.get(id)
			return entry === undefined ? undefined : headingOf(entry.mark, entry.below)
		},

		slain: () => [...shown]
			.filter(([, entry]) => entry.pose === 'slain')
			.map(([id, entry]) => ({ id, x: entry.body.root.position.x, z: entry.body.root.position.z, time: entry.time })),

		clashes: () => [...shown]
			.filter(([, entry]) => entry.pose === 'blocked' && entry.time >= clashSeconds)
			.map(([id, entry]) => ({ id, x: entry.clash.x, z: entry.clash.z, time: entry.time - clashSeconds })),

		dispose() {
			for (const [id, entry] of shown) drop(id, entry)
		},
	}
}
