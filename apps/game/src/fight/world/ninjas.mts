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
	 * how far the samurai has run.
	 */
	draw: (active: readonly Ninja[], options: readonly AmbushOption[], distance: number, delta: number, worldDelta: number) => void
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
		draw(active, options, distance, delta, worldDelta) {
			cycle += worldDelta * creepCycle

			for (const ninja of active) {
				let entry = shown.get(ninja.id)
				if (entry === undefined) {
					entry = { body: maker(), mark: markById(ninja.id), sequence: ninja.sequence, time: 0, beatenAt: undefined }
					shown.set(ninja.id, entry)
					parent.add(entry.body.root)
				}
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
				const approach = ninja.pose === 'strike' ? lungeOf(ninja.approach, entry.time, poseSeconds.strike * 0.4) : ninja.approach
				const spot = spotOf(entry.mark, ninja.wave, approach)
				// Around the samurai where he is, or where he was when this ninja was beaten: it stays on
				// that spot of the path as he runs on. Ahead and behind follow the path's bends, so a ninja
				// coming round a corner stays in the street; to the side is square to the path there.
				const base = entry.beatenAt ?? distance
				const samurai = frameAt(base)
				const at = beside(frameAt(base - spot.z), spot.x, 0)
				const { root } = entry.body
				root.position.set(at.x, 0, at.z)
				// Facing the samurai: a figure faces -z when not turned.
				const toX = samurai.x - at.x
				const toZ = samurai.z - at.z
				root.rotation.y = Math.hypot(toX, toZ) > 1e-6 ? Math.atan2(-toX, -toZ) : samurai.heading
				// Out of step with each other, so they don't run as one.
				entry.body.show(ninja.pose, entry.time, cycle + ninja.id * 1.7, ninja.wave > 0 ? backRowOpacity : 1)
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
