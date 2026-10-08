/**
 * The samurai's pose. The store decides what he is doing; the renderer fits an animation clip to
 * it and never tells the game that a clip has finished
 * ([what the renderer may keep](../../../../../docs/architecture/state.md#what-the-renderer-may-keep)).
 */

import { createStore, type Readable } from '../../_shared/state/store.mts'

export type Pose = 'idle' | 'run' | 'strike' | 'block' | 'hurt' | 'fallen'

export type ShogunState = {
	readonly pose: Pose
	/** The ninja a strike or block is aimed at, when there is one. */
	readonly target: number | undefined
	/** Counts up on every change, so the renderer can start a one-off effect without an event bus. */
	readonly sequence: number
}

export type Shogun = Readable<ShogunState> & {
	idle: () => void
	run: () => void
	strike: (ninja: number) => void
	block: (ninja: number) => void
	hurt: () => void
	fall: () => void
	reset: () => void
}

export const standing: ShogunState = { pose: 'idle', target: undefined, sequence: 0 }

export function createShogun(initial: ShogunState = standing): Shogun {
	const store = createStore(initial)

	const pose = (next: Pose, target?: number) => {
		store.set({ pose: next, target, sequence: store.get().sequence + 1 })
	}

	return {
		get: store.get,
		subscribe: store.subscribe,

		idle: () => { pose('idle') },
		run: () => { pose('run') },
		strike: (ninja) => { pose('strike', ninja) },
		block: (ninja) => { pose('block', ninja) },
		hurt: () => { pose('hurt') },
		fall: () => { pose('fallen') },
		reset: () => { store.set(standing) },
	}
}
