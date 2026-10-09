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
	sequence: number
	/** Seconds since the store last changed this ninja's pose. */
	time: number
}

/** The mark a ninja comes from: its first option's, or one by its id when the options are gone. */
export function markOf(ninja: Ninja, options: readonly AmbushOption[]): Mark {
	const first = ninja.options[0]
	return (first === undefined ? undefined : options[first]?.mark) ?? marks[(ninja.id * 2) % marks.length] ?? 'up'
}

export type NinjasView = {
	/** Makes the figures match `active`. `delta` is real time, `worldDelta` slowed down. */
	draw: (active: readonly Ninja[], options: readonly AmbushOption[], delta: number, worldDelta: number) => void
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
		draw(active, options, delta, worldDelta) {
			cycle += worldDelta * creepCycle

			for (const ninja of active) {
				let entry = shown.get(ninja.id)
				if (entry === undefined) {
					entry = { figure: createFigure(parts, colours), sequence: ninja.sequence, time: 0 }
					shown.set(ninja.id, entry)
					parent.add(entry.figure.root)
				}
				if (entry.sequence === ninja.sequence) {
					entry.time += delta
				} else {
					entry.sequence = ninja.sequence
					entry.time = 0
				}

				const spot = spotOf(markOf(ninja, options), ninja.wave, ninja.approach)
				const { root } = entry.figure
				root.position.set(spot.x, 0, spot.z)
				root.rotation.y = spot.facing
				// Out of step with each other, so they don't run as one.
				entry.figure.pose(rigOf(ninja.pose, entry.time, cycle + ninja.id * 1.7), ninja.wave > 0 ? backRowOpacity : 1)
			}

			for (const [id, entry] of shown) {
				if (!active.some((ninja) => ninja.id === id)) drop(id, entry)
			}
		},

		dispose() {
			for (const [id, entry] of shown) drop(id, entry)
		},
	}
}
