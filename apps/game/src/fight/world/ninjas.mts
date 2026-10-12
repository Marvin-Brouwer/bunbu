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
import type { AmbushOption, Mark } from '../../_shared/state/ambush.mts'
import { marks } from '../../_shared/state/ambush.mts'
import type { Ninja, NinjaPose } from '../state/ninjas.mts'
import type { Body } from '../../_shared/world/character.mts'
import type { ViewFrame } from './camera.mts'
import type { ClashSpot, SlainSpot } from './effects.mts'
import { beside } from './path.mts'
import { lungeOf, spotOf } from './placement.mts'
import { poseSeconds, type FigurePose } from '../../_shared/world/poses.mts'

/** The back row is drawn faded ([more than 3 options](../../../../../docs/design/gameplay.md#more-than-3-options)). */
const backRowOpacity = 0.5

/** World seconds a ninja spends running into view when an ambush starts. */
const entranceSeconds = 0.4
/** Extra metres beyond the normal starting spot, so the entrance can be seen along the path. */
const entranceDistance = 8
/** Keep a newly entering ninja in the ambush's deliberate slow motion during the hit outcome. */
const entranceScale = 0.15
/** When the time ran out, the halves of the scroll fall before the ninjas strike. */
const strikeDelaySeconds = 0.65

/** World seconds the slicer takes to leap in front of the samurai, as long as the scroll's cut. */
const slicerLeapSeconds = 0.2
/** Where the slicer lands straight ahead: as far out as they start, so they stand mid screen while the halves fall. */
const slicerApproach = 0
/** Seconds the slicer then takes to run back in from mid screen before it strikes. */
export const slicerRunSeconds = 0.45

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
 * How far in the ninjas creep while the time runs, of the way from where they start to in reach:
 * they keep their distance, and charge in to strike from there.
 */
export const creepReach = 0.6
/** Seconds before the time runs out that the ninjas stop and wind up to charge. */
export const chargeSeconds = 0.6
/** How far into the strike a ninja holds its blade up, winding up. */
const windUpTime = poseSeconds.strike * 0.35
/** Metres a ninja leaps up charging in from where it crept to. */
const leapHeight = 0.6

/** Radians of the running cycle per world second while creeping in, so slow motion slows them. */
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
	/** Seconds since the store last changed this ninja's pose. */
	time: number
	/** Where the samurai was when this ninja was beaten, so it stays on that spot as he runs on. */
	beatenAt: ViewFrame | undefined
	/** Where its blade meets the samurai's when he blocks it. */
	clash: { x: number; z: number }
}

/** Poses after the fight: the ninja stays on the path where it was beaten, and the run passes it by. */
const beaten = new Set<Ninja['pose']>(['slain', 'blocked', 'fleeing'])

/** The mark a ninja comes from: its first option's, or `undefined` once the ambush's options are gone. */
export function markOf(ninja: Ninja, options: readonly AmbushOption[]): Mark | undefined {
	const first = ninja.options[0]
	return first === undefined ? undefined : options[first]?.mark
}

/** A mark for a ninja that never had options to go by, spread out by its id. */
const markById = (id: number): Mark => marks[(id * 2) % marks.length] ?? 'up'

/**
 * Where the slicer stands when the time has run out: it leaps from its own spot to straight ahead,
 * cutting through the scroll on the way, so it stands mid screen as the halves fall. Then it runs
 * back in to strike, `strikeTime` seconds after the halves have fallen.
 */
function sliceSpotOf(mark: Mark, wave: number, approach: number, time: number, strikeTime: number) {
	const from = spotOf(mark, wave, approach)
	const ahead = spotOf('up', 0, lungeOf(slicerApproach, strikeTime, slicerRunSeconds))
	const leap = Math.min(1, time / slicerLeapSeconds)
	return {
		x: from.x + (ahead.x - from.x) * leap,
		z: from.z + (ahead.z - from.z) * leap,
	}
}

/**
 * The side a ninja flees to, `1` right of the path and `-1` left: away from the path on the side it
 * stands, so the samurai doesn't run into it. One in the middle picks a side by its `id`.
 */
export function fleeSideOf(x: number, id: number): 1 | -1 {
	if (Math.abs(x) > 0.3) return x > 0 ? 1 : -1
	return id % 2 === 0 ? 1 : -1
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

/** Lunging in from `approach` over `seconds`: how close it is and how high it leaps, `time` seconds in. */
function charge(approach: number, time: number, seconds: number): Pick<Motion, 'approach' | 'hop'> {
	const done = Math.min(1, Math.max(0, time / seconds))
	return { approach: lungeOf(approach, time, seconds), hop: Math.sin(Math.PI * done) * leapHeight * (1 - approach) }
}

/**
 * How close a ninja in `pose` is, and what it shows, `time` seconds after the store gave it that
 * pose. `approach` is where the store left it.
 *
 * - Striking in an outcome, it lunges in at once to land its hit. After the time ran out, it waits
 *   for the halves of the scroll to fall; the slicer then runs back in from mid screen first.
 * - Blocked, it lunges in and cuts first; the samurai's sword meets it after `clashSeconds`, and
 *   it is knocked back, then flees from there.
 */
export function motionOf(pose: NinjaPose, slicer: boolean | undefined, approach: number, time: number): Motion {
	if (pose === 'strike') {
		if (slicer === undefined) return { ...charge(approach, time, lungeSeconds), pose, time }
		const wait = time - strikeDelaySeconds
		// The slicer cuts through the scroll straight away, the others wind up while it falls.
		if (wait <= 0) return slicer ? { approach, pose, time, hop: 0 } : { approach, pose, time: windUpTime, hop: 0 }
		if (!slicer) return { ...charge(approach, wait, lungeSeconds), pose, time: wait }
		const run = wait - slicerRunSeconds
		return run < 0
			? { approach: lungeOf(slicerApproach, wait, slicerRunSeconds), pose: 'approach', time: wait, hop: 0 }
			: { approach: 1, pose, time: run, hop: 0 }
	}
	if (pose === 'blocked') {
		return time < clashSeconds
			? { ...charge(approach, time, clashSeconds), pose: 'strike', time }
			: { approach: 1, pose, time: time - clashSeconds, hop: 0 }
	}
	if (pose === 'fleeing') return { approach: 1, pose, time, hop: 0 }
	return { approach, pose, time, hop: 0 }
}

export type NinjasView = {
	/**
	 * Makes the figures match `active`. `delta` is real time, `worldDelta` slowed down, `frame`
	 * where the samurai is and the way ahead, whether the pre-scroll telegraph is playing, and the
	 * seconds until the time runs out (`undefined` without a time limit).
	 */
	draw: (active: readonly Ninja[], options: readonly AmbushOption[], frame: ViewFrame, delta: number, worldDelta: number, telegraph: boolean, secondsLeft: number | undefined) => void
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

/** `parent` is in world space, and `make` makes a ninja's body. */
export function createNinjasView(parent: Group, make: () => Body): NinjasView {
	// Ninja id to its figure.
	const shown = new Map<number, Shown>()
	let cycle = 0
	let maker = make

	const drop = (id: number, entry: Shown) => {
		parent.remove(entry.body.root)
		entry.body.dispose()
		shown.delete(id)
	}

	return {
		draw(active, options, frame, delta, worldDelta, telegraph, secondsLeft) {
			cycle += worldDelta * creepCycle

			for (const ninja of active) {
				let entry = shown.get(ninja.id)
				if (entry === undefined) {
					entry = {
						body: maker(),
						pose: ninja.pose,
						mark: markById(ninja.id),
						sequence: ninja.sequence,
						time: 0,
						approach: ninja.approach,
						targetApproach: ninja.approach,
						entrance: 0,
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
				const entranceDelta = delta > 0 ? Math.min(worldDelta, delta * entranceScale) : 0
				entry.entrance = Math.min(1, entry.entrance + entranceDelta / entranceSeconds)
				if (entry.sequence === ninja.sequence) {
					entry.time += delta
				} else {
					entry.sequence = ninja.sequence
					entry.time = 0
				}
				entry.pose = ninja.pose

				if (!beaten.has(ninja.pose)) entry.beatenAt = undefined
				else entry.beatenAt ??= frame

				entry.mark = markOf(ninja, options) ?? entry.mark
				// They keep their distance while the time runs, and charge in from there.
				const crept = entry.approach * creepReach
				const motion = motionOf(ninja.pose, ninja.slicer, crept, entry.time)
				const spot = ninja.slicer === true
					? sliceSpotOf(entry.mark, ninja.wave, crept, entry.time, Math.max(0, entry.time - strikeDelaySeconds))
					: spotOf(entry.mark, ninja.wave, motion.approach)
				// Enter from farther out the same way. It can disappear behind a tree or house and then
				// run out into view, instead of appearing at the ambush's first visible position.
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
				const at = beside(samurai, visible.x, -visible.z)
				const { root } = entry.body
				root.position.set(at.x, motion.hop, at.z)
				// Facing the samurai: a figure faces -z when not turned.
				const toX = samurai.x - at.x
				const toZ = samurai.z - at.z
				const facing = Math.hypot(toX, toZ) > 1e-6 ? Math.atan2(-toX, -toZ) : samurai.heading
				// The figure runs off behind its back; fleeing, it turns that way off to its side.
				if (ninja.pose === 'fleeing') {
					const side = fleeSideOf(visible.x, ninja.id)
					const off = beside(samurai, side, fleeAhead)
					const away = Math.atan2(off.x - samurai.x, off.z - samurai.z)
					root.rotation.y = facing + turnBetween(facing, away) * Math.min(1, entry.time / fleeTurnSeconds)
				} else {
					root.rotation.y = facing
				}
				// Where the blades meet on a block: between the two, nearer the samurai's sword.
				entry.clash = { x: samurai.x + (at.x - samurai.x) * 0.45, z: samurai.z + (at.z - samurai.z) * 0.45 }
				// Winding up for a cut as they come in, and to charge just before the time runs out.
				const charging = secondsLeft !== undefined && secondsLeft < chargeSeconds
				const windingUp = (telegraph || charging) && ninja.pose === 'approach' && entry.entrance > 0.7
				const pose = windingUp ? 'strike' : motion.pose
				const time = windingUp ? windUpTime : motion.time
				// Out of step with each other, so they don't run as one.
				entry.body.show(pose, time, cycle + ninja.id * 1.7, ninja.wave > 0 ? backRowOpacity : 1)
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
