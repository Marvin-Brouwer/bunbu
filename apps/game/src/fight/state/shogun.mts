/**
 * The samurai's pose. The store decides what he is doing; the renderer fits an animation clip to
 * it and never tells the game that a clip has finished
 * ([what the renderer may keep](../../../../../docs/architecture/state.md#what-the-renderer-may-keep)).
 */

import { createStore, type Store } from '@rooted/store'

export type Pose = 'idle' | 'run' | 'strike' | 'block' | 'hurt' | 'fallen'

export type ShogunState = {
	readonly pose: Pose
	/** The ninja a strike or block is aimed at, when there is one. */
	readonly target: number | undefined
	/** Counts up on every change, so the renderer can start a one-off effect without an event bus. */
	readonly sequence: number
}

export type ShogunActions = {
	idle: () => void
	run: () => void
	strike: (ninja: number) => void
	block: (ninja: number) => void
	hurt: () => void
	fall: () => void
	reset: () => void
}

/** The store, with its actions on its state. Change it through those, not `update`. */
export type Shogun = Store<ShogunState & ShogunActions>

export const standing: ShogunState = { pose: 'idle', target: undefined, sequence: 0 }

export function createShogun(initial: ShogunState = standing): Shogun {

	const pose = (next: Pose, target?: number) => {
		store.update(() => ({ pose: next, target, sequence: store.value.sequence + 1 }))
	}

	const store: Shogun = createStore<ShogunState & ShogunActions>({
		...initial,

		idle: () => { pose('idle') },
		run: () => { pose('run') },
		strike: (ninja) => { pose('strike', ninja) },
		block: (ninja) => { pose('block', ninja) },
		hurt: () => { pose('hurt') },
		fall: () => { pose('fallen') },
		reset: () => { store.update(() => standing) },
	})
	return store
}
