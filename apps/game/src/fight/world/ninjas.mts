/**
 * The ninjas of the current ambush, one figure per ninja in the store. Where each stands comes from
 * its mark and its `approach` ([placement](./placement.mts)); its pose from the store, timed from
 * when the store last changed it.
 *
 * Placement is around the samurai, measured along the path: ahead of him is farther along it, so the
 * ninjas come round its corners and stay in the street.
 *
 * The figures and their timers are visual state: derived from the store, never fed back.
 */

import type { Group } from 'three'
import type { AmbushOption, Mark } from '../../_shared/state/ambush.mts'
import { marks } from '../../_shared/state/ambush.mts'
import type { Ninja } from '../state/ninjas.mts'
import type { Body } from './character.mts'
import { beside, type PathPoint } from './path.mts'
import { lungeOf, spotOf } from './placement.mts'
import { poseSeconds } from './poses.mts'

/** The back row is drawn faded ([more than 3 options](../../../../../docs/design/gameplay.md#more-than-3-options)). */
const backRowOpacity = 0.5

/** World seconds a ninja spends running into view when an ambush starts. */
const entranceSeconds = 0.4
/** Extra metres beyond the normal starting spot, so the entrance can be seen along the path. */
const entranceDistance = 8
/** Keep a newly entering ninja in the ambush's deliberate slow motion during the hit outcome. */
const entranceScale = 0.15
/** The scroll needs to finish rolling away before a striking ninja enters the hit animation. */
const strikeDelaySeconds = 0.65

/** Radians of the running cycle per world second while creeping in, so slow motion slows them. */
const creepCycle = 9

type Shown = {
	body: Body
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
	/** How far the samurai had run when this ninja was beaten, so it stays on that spot of the path. */
	beatenAt: number | undefined
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

export type NinjasView = {
	/**
	 * Makes the figures match `active`. `delta` is real time, `worldDelta` slowed down, `distance`
	 * how far the samurai has run, whether the pre-scroll telegraph is playing, and how long the
	 * scroll has been rolling away before a strike may become visible.
	 */
	draw: (active: readonly Ninja[], options: readonly AmbushOption[], distance: number, delta: number, worldDelta: number, telegraph: boolean, outcomeTime: number) => void
	/** Swaps every figure's body for one made by `make`, for when the real model has loaded. */
	remake: (make: () => Body) => void
	/** The mark the ninja with `id` was last drawn at, for the samurai to turn toward. */
	markOf: (id: number) => Mark | undefined
	dispose: () => void
}

/**
 * `parent` is in world space; `frameAt` is where the path has the samurai at a distance, and `make`
 * makes a ninja's body.
 */
export function createNinjasView(parent: Group, frameAt: (distance: number) => PathPoint, make: () => Body): NinjasView {
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
		draw(active, options, distance, delta, worldDelta, telegraph, outcomeTime) {
			cycle += worldDelta * creepCycle

			for (const ninja of active) {
				let entry = shown.get(ninja.id)
				if (entry === undefined) {
					entry = {
						body: maker(),
						mark: markById(ninja.id),
						sequence: ninja.sequence,
						time: 0,
						approach: ninja.approach,
						targetApproach: ninja.approach,
						entrance: 0,
						beatenAt: undefined,
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

				if (!beaten.has(ninja.pose)) entry.beatenAt = undefined
				else entry.beatenAt ??= distance

				entry.mark = markOf(ninja, options) ?? entry.mark
				// A striker closes in during the wind-up, so the cut lands on the samurai.
				const strikeTime = ninja.pose === 'strike' ? Math.max(0, outcomeTime - strikeDelaySeconds) : 0
				const approach = ninja.pose === 'strike' ? lungeOf(entry.approach, strikeTime, poseSeconds.strike * 0.4) : entry.approach
				const spot = spotOf(entry.mark, ninja.wave, approach)
				// Enter from farther along the same path. It can disappear behind a tree or house and
				// then run out into view, instead of appearing at the ambush's first visible position.
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
				// that spot of the path as he runs on. Ahead and behind follow the path's bends, so a ninja
				// coming round a corner stays in the street; to the side is square to the path there.
				const base = entry.beatenAt ?? distance
				const samurai = frameAt(base)
				const at = beside(frameAt(base - visible.z), visible.x, 0)
				const { root } = entry.body
				root.position.set(at.x, 0, at.z)
				// Facing the samurai: a figure faces -z when not turned.
				const toX = samurai.x - at.x
				const toZ = samurai.z - at.z
				root.rotation.y = Math.hypot(toX, toZ) > 1e-6 ? Math.atan2(-toX, -toZ) : samurai.heading
				// Out of step with each other, so they don't run as one.
				const windingUp = telegraph && ninja.pose === 'approach' && entry.entrance > 0.7
				const pose = ninja.pose === 'strike' && strikeTime === 0 ? 'approach' : windingUp ? 'strike' : ninja.pose
				const time = ninja.pose === 'strike' ? strikeTime : windingUp ? poseSeconds.strike * 0.35 : entry.time
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

		dispose() {
			for (const [id, entry] of shown) drop(id, entry)
		},
	}
}
