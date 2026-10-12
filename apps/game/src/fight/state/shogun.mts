/**
 * The samurai's pose. The store decides what he is doing; the renderer fits an animation clip to
 * it and never tells the game that a clip has finished
 * ([what the renderer may keep](../../../../../docs/architecture/state.md#what-the-renderer-may-keep)).
 */

import { createStore, type Store } from '@rooted/store'

export type Pose = 'idle' | 'run' | 'strike' | 'block' | 'hurt' | 'fallen'

/** One cut or parry of the samurai's, or the hit he takes, from one ninja. */
export type Move = {
	readonly pose: 'strike' | 'block' | 'hurt'
	readonly target: number
}

export type ShogunState = {
	readonly pose: Pose
	/** The ninja a strike or block is aimed at, when there is one. */
	readonly target: number | undefined
	/** Counts up on every change, so the renderer can start a one-off effect without an event bus. */
	readonly sequence: number
	/** The moves still to come, when he deals with several ninjas in turn. */
	readonly moves: readonly Move[]
	/** Seconds until the next of `moves`. */
	readonly moveLeft: number
}

export type ShogunActions = {
	idle: () => void
	run: () => void
	strike: (ninja: number) => void
	block: (ninja: number) => void
	/**
	 * Deals with the ninjas one after another: the first move after `delay` seconds, the next one
	 * every `moveSeconds` ([outcome](../../../../../docs/design/gameplay.md#outcome)).
	 */
	fight: (moves: readonly Move[], delay: number) => void
	/** Counts down to the next move, and returns it when it starts. */
	tick: (delta: number) => Move | undefined
	hurt: () => void
	fall: () => void
	reset: () => void
}

/** The store, with its actions on its state. Change it through those, not `update`. */
export type Shogun = Store<ShogunState & ShogunActions>

export const standing: ShogunState = { pose: 'idle', target: undefined, sequence: 0, moves: [], moveLeft: 0 }

/** Seconds between his moves when he deals with several ninjas in turn. To tune in playtests. */
export const moveSeconds = 0.5

export function createShogun(initial: ShogunState = standing): Shogun {

	const pose = (next: Pose, target?: number) => {
		store.update(() => ({ pose: next, target, sequence: store.value.sequence + 1, moves: [], moveLeft: 0 }))
	}

	const store: Shogun = createStore<ShogunState & ShogunActions>({
		...initial,

		idle: () => { pose('idle') },
		run: () => { pose('run') },
		strike: (ninja) => { pose('strike', ninja) },
		block: (ninja) => { pose('block', ninja) },
		fight(moves, delay) {
			store.update(() => ({ moves, moveLeft: delay }))
		},
		tick(delta) {
			const { moves, moveLeft } = store.value
			const [next, ...rest] = moves
			if (next === undefined) return undefined
			const left = moveLeft - delta
			if (left > 0) {
				store.update(() => ({ moveLeft: left }))
				return undefined
			}
			pose(next.pose, next.target)
			store.update(() => ({ moves: rest, moveLeft: rest.length === 0 ? 0 : left + moveSeconds }))
			return next
		},
		hurt: () => { pose('hurt') },
		fall: () => { pose('fallen') },
		reset: () => { store.update(() => standing) },
	})
	return store
}
