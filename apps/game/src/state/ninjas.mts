/**
 * The ninjas of the current ambush. They creep in as the time runs out, so they are the timer
 * ([time limit](../../../../docs/design/gameplay.md#time-limit)): up to 5 of them, 3 in front and
 * 2 behind, each carrying one or more options.
 */

import { createStore, refuse, type Store } from './store.mts'

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

export type NinjasState = {
	readonly active: readonly Ninja[]
}

const initial: NinjasState = { active: [] }

export const ninjasStore: Store<NinjasState> = createStore(initial)

function update(id: number, change: (ninja: Ninja) => Ninja): void {
	const state = ninjasStore.get()
	if (!state.active.some((ninja) => ninja.id === id)) {
		refuse('ninjas', `no ninja ${id}`)
		return
	}
	ninjasStore.set({ active: state.active.map((ninja) => (ninja.id === id ? change(ninja) : ninja)) })
}

function pose(id: number, next: NinjaPose): void {
	update(id, (ninja) => ({ ...ninja, pose: next, sequence: ninja.sequence + 1 }))
}

export const ninjas = {
	get: ninjasStore.get,
	subscribe: ninjasStore.subscribe,

	spawn(wave: readonly NinjaSpawn[]): void {
		const spawned = wave.map((ninja) => ({ ...ninja, approach: 0, pose: 'approach' as const, sequence: 0 }))
		ninjasStore.set({ active: [...ninjasStore.get().active, ...spawned] })
	},

	/** Moves every approaching ninja to `approach`, which the ambush derives from the time left. */
	advance(approach: number): void {
		const next = Math.min(1, Math.max(0, approach))
		ninjasStore.set({
			active: ninjasStore.get().active.map((ninja) => (ninja.pose === 'approach' ? { ...ninja, approach: next } : ninja)),
		})
	},

	strike: (id: number) => { pose(id, 'strike') },
	slay: (id: number) => { pose(id, 'slain') },
	block: (id: number) => { pose(id, 'blocked') },
	flee: (id: number) => { pose(id, 'fleeing') },

	clear(): void {
		ninjasStore.set(initial)
	},
}
