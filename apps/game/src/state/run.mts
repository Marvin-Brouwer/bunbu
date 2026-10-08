/**
 * The run: which phase it is in, how long it has lasted, how far the samurai has come.
 *
 * The samurai runs at a constant pace and the game never speeds up
 * ([core loop](../../../../docs/design/gameplay.md#core-loop)). `worldScale` is the slow motion
 * during an ambush, not a difficulty setting: that is `timeScale` in [settings.mts](settings.mts).
 */

import { createStore, refuse, type Store } from './store.mts'

export type RunPhase = 'idle' | 'intro' | 'running' | 'ambush' | 'paused' | 'finished' | 'fallen'

export type RunState = {
	readonly phase: RunPhase
	/** Run time in seconds. Shown on the results and used as the high-score tiebreak. */
	readonly elapsed: number
	/** Metres covered of `stageLength`. */
	readonly distance: number
	readonly stageLength: number
	/** How fast the world moves: `1` while running, lower in the ambush's slow motion. */
	readonly worldScale: number
	/** Seconds left of the 3-2-1 countdown after resuming, `0` when not counting down. */
	readonly countdown: number
	/** The phase to return to when the pause or the countdown ends. */
	readonly resumeTo: RunPhase
}

/** Defaults to tune in playtests ([to tune](../../../../docs/design/gameplay.md#to-tune)). */
export const runConfig = {
	/** Metres per second along the path. */
	pace: 8,
	ambushWorldScale: 0.15,
	introSeconds: 1.5,
	countdownSeconds: 3,
	/** A frame delta longer than this is clamped, so a backgrounded tab cannot jump the run forward. */
	maximumDelta: 0.1,
}

const initial: RunState = {
	phase: 'idle',
	elapsed: 0,
	distance: 0,
	stageLength: 0,
	worldScale: 1,
	countdown: 0,
	resumeTo: 'running',
}

export const runStore: Store<RunState> = createStore(initial)

export const run = {
	get: runStore.get,
	subscribe: runStore.subscribe,

	start(stageLength: number): void {
		runStore.set({ ...initial, phase: 'intro', stageLength })
	},

	/** Advances run time and distance. `dt` is already scaled by `worldScale`; see [loop.mts](../loop.mts). */
	tick(dt: number): void {
		const state = runStore.get()
		if (state.phase === 'paused' || state.phase === 'finished' || state.phase === 'fallen') return

		if (state.countdown > 0) {
			const countdown = Math.max(0, state.countdown - dt)
			runStore.set({ ...state, countdown, phase: countdown === 0 ? state.resumeTo : state.phase })
			return
		}
		if (state.phase === 'intro') {
			const elapsed = state.elapsed + dt
			runStore.set({ ...state, elapsed, phase: elapsed >= runConfig.introSeconds ? 'running' : 'intro' })
			return
		}
		const distance = state.phase === 'running' ? state.distance + runConfig.pace * dt : state.distance
		runStore.set({ ...state, elapsed: state.elapsed + dt, distance: Math.min(distance, state.stageLength) })
	},

	beginAmbush(): void {
		const state = runStore.get()
		if (state.phase !== 'running') {
			refuse('run.beginAmbush', `phase is ${state.phase}`)
			return
		}
		runStore.set({ ...state, phase: 'ambush', worldScale: runConfig.ambushWorldScale })
	},

	endAmbush(): void {
		const state = runStore.get()
		if (state.phase !== 'ambush') {
			refuse('run.endAmbush', `phase is ${state.phase}`)
			return
		}
		runStore.set({ ...state, phase: 'running', worldScale: 1 })
	},

	pause(): void {
		const state = runStore.get()
		if (state.phase === 'paused' || state.phase === 'finished' || state.phase === 'fallen') return
		runStore.set({ ...state, phase: 'paused', resumeTo: state.phase, countdown: 0 })
	},

	resume(): void {
		const state = runStore.get()
		if (state.phase !== 'paused') {
			refuse('run.resume', `phase is ${state.phase}`)
			return
		}
		runStore.set({ ...state, phase: state.resumeTo, countdown: runConfig.countdownSeconds })
	},

	finish(): void {
		runStore.set({ ...runStore.get(), phase: 'finished', worldScale: 1, countdown: 0 })
	},

	fall(): void {
		runStore.set({ ...runStore.get(), phase: 'fallen', worldScale: 1, countdown: 0 })
	},

	reset(): void {
		runStore.set(initial)
	},
}
