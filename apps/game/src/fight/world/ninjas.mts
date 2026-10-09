/**
 * The ninjas of the current ambush, one figure per ninja in the store. Where each stands comes from
 * its mark and its `approach` ([placement](./placement.mts)); its pose from the store, timed from
 * when the store last changed it.
 *
 * The figures and their timers are visual state: derived from the store, never fed back.
 */

import type { Group } from 'three'
import type { AmbushOption, Mark } from '../../_shared/state/ambush.mts'
import { marks } from '../../_shared/state/ambush.mts'
import type { Ninja } from '../state/ninjas.mts'
import { createFigure, type Figure, type FigureParts } from './figure.mts'
import { spotOf } from './placement.mts'
import { rigOf } from './poses.mts'

const colours = { body: 0x2e2d38, skin: 0x2e2d38, band: 0xa3322a, blade: 0xb8bcc4 }

/** The back row is drawn faded ([more than 3 options](../../../../../docs/design/gameplay.md#more-than-3-options)). */
const backRowOpacity = 0.5

/** Running cycles per second while creeping in, in world time so slow motion slows them. */
const creepCycle = 9

type Shown = {
	readonly figure: Figure
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
	/** The mark the ninja with `id` was last drawn at, for the samurai to turn toward. */
	markOf: (id: number) => Mark | undefined
	dispose: () => void
}

export function createNinjasView(parent: Group, parts: FigureParts): NinjasView {
	// Ninja id to its figure.
	const shown = new Map<number, Shown>()
	let cycle = 0

	const drop = (id: number, entry: Shown) => {
		parent.remove(entry.figure.root)
		entry.figure.dispose()
		shown.delete(id)
	}

	return {
		draw(active, options, distance, delta, worldDelta) {
			cycle += worldDelta * creepCycle

			for (const ninja of active) {
				let entry = shown.get(ninja.id)
				if (entry === undefined) {
					entry = { figure: createFigure(parts, colours), mark: markById(ninja.id), sequence: ninja.sequence, time: 0, beatenAt: undefined }
					shown.set(ninja.id, entry)
					parent.add(entry.figure.root)
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
				const spot = spotOf(entry.mark, ninja.wave, ninja.approach)
				const { root } = entry.figure
				// The path comes toward the camera as the samurai runs on.
				root.position.set(spot.x, 0, spot.z + distance - (entry.beatenAt ?? distance))
				root.rotation.y = spot.facing
				// Out of step with each other, so they don't run as one.
				entry.figure.pose(rigOf(ninja.pose, entry.time, cycle + ninja.id * 1.7), ninja.wave > 0 ? backRowOpacity : 1)
			}

			for (const [id, entry] of shown) {
				if (!active.some((ninja) => ninja.id === id)) drop(id, entry)
			}
		},

		markOf: (id) => shown.get(id)?.mark,

		dispose() {
			for (const [id, entry] of shown) drop(id, entry)
		},
	}
}
