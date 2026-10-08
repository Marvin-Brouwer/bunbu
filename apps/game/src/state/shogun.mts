/**
 * The samurai's pose. The store decides what he is doing; the renderer fits an animation clip to
 * it and never tells the game that a clip has finished
 * ([what the renderer may keep](../../../../docs/architecture/state.md#what-the-renderer-may-keep)).
 */

import { createStore, type Store } from './store.mts'

export type Pose = 'idle' | 'run' | 'strike' | 'block' | 'hurt' | 'fallen'

export type ShogunState = {
	readonly pose: Pose
	/** The ninja a strike or block is aimed at, when there is one. */
	readonly target: number | undefined
	/** Counts up on every change, so the renderer can start a one-off effect without an event bus. */
	readonly sequence: number
}

const initial: ShogunState = { pose: 'idle', target: undefined, sequence: 0 }

export const shogunStore: Store<ShogunState> = createStore(initial)

function pose(next: Pose, target?: number): void {
	const state = shogunStore.get()
	shogunStore.set({ pose: next, target, sequence: state.sequence + 1 })
}

export const shogun = {
	get: shogunStore.get,
	subscribe: shogunStore.subscribe,

	idle: () => { pose('idle') },
	run: () => { pose('run') },
	strike: (ninja: number) => { pose('strike', ninja) },
	block: (ninja: number) => { pose('block', ninja) },
	hurt: () => { pose('hurt') },
	fall: () => { pose('fallen') },

	reset(): void {
		shogunStore.set(initial)
	},
}
