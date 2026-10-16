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
import { chargeOrder, type Ninja, type NinjaPose } from '../state/ninjas.mts'
import type { Body } from '../../_shared/world/character.mts'
import type { ViewFrame } from './camera.mts'
import type { CoverSpot } from './cover.mts'
import type { ClashSpot, SlainSpot } from './effects.mts'
import { beside } from './path.mts'
import { lungeOf, spotOf } from './placement.mts'
import { poseSeconds, type FigurePose } from '../../_shared/world/poses.mts'

/** The back row is drawn faded ([more than 3 options](../../../../../docs/design/gameplay.md#more-than-3-options)). */
const backRowOpacity = 0.5

/**
 * Real seconds a ninja takes to come into view when an ambush springs: steady, while the world
 * keeps slowing down, and within the ambush's opening, so they are all in before the scroll opens.
 */
const entranceSeconds = 1.8
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
 * How far in the ninjas creep while the time runs, of the way from where they start to in reach:
 * they keep their distance, and charge in to strike from there.
 */
export const creepReach = 0.6
/** Seconds before the time runs out that the first ninja stops and winds up to charge. */
export const chargeSeconds = 0.6
/** Seconds after one ninja winds up before the next one does. */
const chargeStagger = 0.1
/** How far into the strike a ninja holds its blade up, winding up. */
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
	/** Visual approach, advanced with world time so the run-in is also in slow motion. */
	approach: number
	/** The latest approach reported by the game state. */
	targetApproach: number
	/** `0` while entering from farther along the path, `1` once at the normal starting spot. */
	entrance: number
	/** The cover it leaps out from behind, in the world, if there is one on its side ahead. */
	cover: CoverSpot | undefined
	/** Where the samurai was when it came. */
	came: { x: number; z: number }
	/** How far through its running cycle it is, where it was last drawn, and how fast it went, smoothed. */
	cycle: number
	last: { x: number; z: number } | undefined
	speed: number
	/** Seconds since the store last changed this ninja's pose. */
	time: number
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
export function outOf(cover: CoverSpot, from: { x: number; z: number }, to: { x: number; z: number }, amount: number): OutOf {
	const { behind, ahead, height, waits, lands } = leapConfig
	// The way from the samurai to the cover, flat.
	const away = Math.hypot(cover.x - from.x, cover.z - from.z) || 1
	const out = { x: (cover.x - from.x) / away, z: (cover.z - from.z) / away }
	const hidden = { x: cover.x + out.x * behind, z: cover.z + out.z * behind }
	const landed = { x: cover.x - out.x * ahead, z: cover.z - out.z * ahead }
	if (amount <= waits) return { ...hidden, hop: 0, doing: 'hiding' }
	if (amount < lands) {
		const leap = (amount - waits) / (lands - waits)
		// Flat over the top and steep at either end: 1 - u⁴, with u from -1 through 0 to 1.
		const hop = height * (1 - (2 * leap - 1) ** 4)
		return { x: hidden.x + (landed.x - hidden.x) * leap, z: hidden.z + (landed.z - hidden.z) * leap, hop, doing: 'leaping' }
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

export type NinjasView = {
	/**
	 * Makes the figures match `active`. `delta` is real time, `worldDelta` slowed down, `frame`
	 * where the samurai is and the way ahead, and the seconds until the time runs out (`undefined`
	 * without a time limit). A ninja that comes in runs out from behind one of `covers`, the
	 * ambush's ([cover](./cover.mts)).
	 */
	draw: (active: readonly Ninja[], options: readonly AmbushOption[], kind: AmbushKind, frame: ViewFrame, delta: number, worldDelta: number, secondsLeft: number | undefined, covers?: readonly CoverSpot[]) => void
	/** Swaps every figure's body for one made by `make`, for when the real model has loaded. */
	remake: (make: () => Body) => void
	/** The mark the ninja with `id` was last drawn at, for the samurai to turn toward. */
	markOf: (id: number) => Mark | undefined
	/** Where each slain ninja lies, and for how long, for his ink splash. */
	slain: () => SlainSpot[]
	/** Where blades met on a block, and how long ago, for the white flash. */
	clashes: () => ClashSpot[]
	dispose: () => void
}

/**
 * The cover a ninja starting at `start` (round the samurai at `frame`, the way ahead along `-z`)
 * runs out from behind: of the `covers` on its side ahead of him, the one nearest its start. One
 * that comes from behind the camera, or straight ahead, has none, or picks a side by its `id`.
 */
export function coverOf(start: { x: number; z: number }, id: number, frame: ViewFrame, covers: readonly CoverSpot[]): CoverSpot | undefined {
	if (start.z >= 0) return undefined
	const side = fleeSideOf(start.x, id)
	const sin = Math.sin(frame.heading)
	const cos = Math.cos(frame.heading)
	// Of the covers on its side, the nearest one at least as far ahead as where it starts, so it
	// comes toward the samurai all the way; else the farthest.
	const startAhead = -start.z
	const onSide = covers.flatMap((cover) => {
		const dx = cover.x - frame.x
		const dz = cover.z - frame.z
		// The cover round the samurai: how far to his right, and how far ahead ({@link beside} undone).
		const right = dx * cos - dz * sin
		const ahead = -dx * sin - dz * cos
		return Math.sign(right) === side && ahead > 0 ? [{ cover, ahead }] : []
	})
	const beyond = onSide.filter(({ ahead }) => ahead >= startAhead).toSorted((one, other) => one.ahead - other.ahead)
	return (beyond[0] ?? onSide.toSorted((one, other) => other.ahead - one.ahead)[0])?.cover
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
		draw(active, options, kind, frame, delta, worldDelta, secondsLeft, covers = []) {
			const charging = chargeOrder(active).map((ninja) => ninja.id)

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
					entry = {
						body: maker(),
						pose: ninja.pose,
						mark,
						sequence: ninja.sequence,
						time: 0,
						approach: ninja.approach,
						targetApproach: ninja.approach,
						entrance: 0,
						cover: coverOf(spotOf(mark, ninja.wave, 0), ninja.id, frame, covers),
						came: { x: frame.x, z: frame.z },
						cycle: ninja.id * 1.7,
						last: undefined,
						speed: 0,
						beatenAt: undefined,
						clash: { x: 0, z: 0 },
					}
					shown.set(ninja.id, entry)
					parent.add(entry.body.root)
				}
				// The ambush timer runs in real time, while the world is slowed down. Apply only the
				// change since the previous state update in world time, so the ninja visibly runs in.
				const approachDelta = ninja.approach - entry.targetApproach
				if (approachDelta !== 0) {
					// `approach` is already the visual position reported by the store. Only the
					// running cycle is slowed down; scaling this delta makes a striking ninja
					// jump when the store advances in real time but the world is in slow motion.
					entry.approach = Math.min(1, Math.max(0, entry.approach + approachDelta))
					entry.targetApproach = ninja.approach
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
				// They keep their distance while the time runs, and charge in from there.
				const crept = entry.approach * creepReach
				const motion = motionOf(ninja.pose, ninja.slicer, crept, entry.time)

				if (!beaten.has(ninja.pose) && motion.pose !== 'fleeing') entry.beatenAt = undefined
				else entry.beatenAt ??= frame
				const spot = spotOf(entry.mark, ninja.wave, motion.approach)
				// Enter from farther out the same way, or from behind its cover. From farther out it can
				// disappear behind a tree or house and then run out into view, instead of appearing at
				// the ambush's first visible position.
				const far = spotOf(entry.mark, ninja.wave, 0)
				const length = Math.hypot(far.x, far.z)
				const entrance = length > 0
					? { x: far.x * (1 + entranceDistance / length), z: far.z * (1 + entranceDistance / length) }
					: far
				const visible = {
					x: entrance.x + (spot.x - entrance.x) * entry.entrance,
					z: entrance.z + (spot.z - entrance.z) * entry.entrance,
				}
				// Around the samurai where he is, or where he was when this ninja was beaten: it stays on
				// that spot as he runs on.
				const samurai = entry.beatenAt ?? frame
				const at: OutOf = entry.cover === undefined || entry.entrance >= 1
					? { ...beside(samurai, visible.x, -visible.z), hop: 0, doing: 'running' }
					: outOf(entry.cover, entry.came, beside(samurai, spot.x, -spot.z), entry.entrance)
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
				// Winding up to charge just before the time runs out, one after another.
				const turn = charging.indexOf(ninja.id)
				const windingUp = secondsLeft !== undefined && ninja.pose === 'approach' && secondsLeft < chargeSeconds - turn * chargeStagger
				const standing = motion.pose === 'approach' && (at.doing === 'hiding' || (at.doing === 'running' && entry.speed < standingSpeed))
				const pose = windingUp ? 'strike' : standing ? 'idle' : motion.pose
				const time = windingUp ? windUpTime : standing ? entry.time : motion.time
				// In the air its legs keep the stride it took off with.
				entry.body.show(pose, time, entry.cycle, ninja.wave > 0 ? backRowOpacity : 1)
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

		markOf: (id) => shown.get(id)?.mark,

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
