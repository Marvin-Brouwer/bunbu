/**
 * The ninjas of the current ambush. They creep in as the time runs out, so they are the timer
 * ([time limit](../../../../../docs/design/gameplay.md#time-limit)): up to 5 of them, 3 in front
 * and 2 behind, each carrying one or more options.
 */

import { createStore, type Store } from '@rooted/store'
import { frontRow } from '../../_shared/state/ambush-opening.mts'
import { sortDistinct } from '../../_shared/state/arrays.mts'
import { refuse } from '../../_shared/state/store.mts'

export type NinjaPose = 'approach' | 'strike' | 'slain' | 'blocked' | 'fleeing'

export type Ninja = {
	readonly id: number
	/** `0` for the three in front, `1` for the two behind, which are drawn faded. */
	readonly wave: number
	/** Indices into the ambush's options; more than one when 6 to 8 options are bundled. */
	readonly options: readonly number[]
	/** `0` far away, `1` within reach of the samurai. */
	readonly approach: number
	readonly pose: NinjaPose
	/** Counts up on every pose change, so the renderer can start an effect without an event bus. */
	readonly sequence: number
}

/** What a ninja spawns with. */
export type NinjaSpawn = Pick<Ninja, 'id' | 'wave' | 'options'>

/**
 * The ninjas carrying an ambush's options, one per distinct `ninja`: the first 3 in front, the
 * rest behind.
 */
export function spawnsOf(options: readonly { readonly ninja: number }[]): NinjaSpawn[] {
	return sortDistinct(options.map((option) => option.ninja)).map((id) => ({
		id,
		wave: id < frontRow ? 0 : 1,
		options: options.flatMap((option, index) => (option.ninja === id ? [index] : [])),
	}))
}

export type NinjasState = {
	readonly active: readonly Ninja[]
}

export type NinjasActions = {
	spawn: (wave: readonly NinjaSpawn[]) => void
	/** Moves every approaching ninja to `approach`, which the ambush derives from the time left. */
	advance: (approach: number) => void
	strike: (id: number) => void
	slay: (id: number) => void
	block: (id: number) => void
	flee: (id: number) => void
	clear: () => void
}

/** The store, with its actions on its state. Change it through those, not `update`. */
export type Ninjas = Store<NinjasState & NinjasActions>

export const noNinjas: NinjasState = { active: [] }

export function createNinjas(initial: NinjasState = noNinjas): Ninjas {

	const pose = (id: number, next: NinjaPose) => {
		const { active } = store.value
		if (!active.some((ninja) => ninja.id === id)) {
			refuse('ninjas', `no ninja ${id}`)
			return
		}
		store.update(() => ({
			active: active.map((ninja) => (ninja.id === id ? { ...ninja, pose: next, sequence: ninja.sequence + 1 } : ninja)),
		}))
	}

	const store: Ninjas = createStore<NinjasState & NinjasActions>({
		...initial,

		spawn(wave) {
			const spawned = wave.map((ninja) => ({ ...ninja, approach: 0, pose: 'approach' as const, sequence: 0 }))
			store.update(() => ({ active: [...store.value.active, ...spawned] }))
		},

		advance(approach) {
			const next = Math.min(1, Math.max(0, approach))
			store.update(() => ({
				active: store.value.active.map((ninja) => (ninja.pose === 'approach' ? { ...ninja, approach: next } : ninja)),
			}))
		},

		strike: (id) => { pose(id, 'strike') },
		slay: (id) => { pose(id, 'slain') },
		block: (id) => { pose(id, 'blocked') },
		flee: (id) => { pose(id, 'fleeing') },
		clear: () => { store.update(() => noNinjas) },
	})
	return store
}
