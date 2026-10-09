/**
 * The run: which phase it is in, how long it has lasted, how far the samurai has come.
 *
 * The samurai runs at a constant pace and the game never speeds up
 * ([core loop](../../../../../docs/design/gameplay.md#core-loop)). `worldScale` is the slow motion
 * during an ambush, not a difficulty setting: that is `timeScale` in [settings.mts](../settings.mts).
 * Finished and fallen are phases of the run, not routes: the results show over the run's world.
 */

import { createStore, type Store } from '@rooted/store'
import { refuse } from '../../_shared/state/store.mts'

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

export type RunActions = {
	start: (stageLength: number) => void
	/** Advances run time and distance. `delta` is already scaled by `worldScale`; see [loop.mts](../../loop.mts). */
	tick: (delta: number) => void
	beginAmbush: () => void
	endAmbush: () => void
	pause: () => void
	/** Resumes with the 3-2-1 countdown. */
	resume: () => void
	finish: () => void
	fall: () => void
	reset: () => void
}

/** The store, with its actions on its state. Change it through those, not `update`. */
export type Run = Store<RunState & RunActions>

/** Defaults to tune in playtests ([to tune](../../../../../docs/design/gameplay.md#to-tune)). */
export const runConfig = {
	/** Metres per second along the path. */
	pace: 8,
	ambushWorldScale: 0.15,
	introSeconds: 1.5,
	countdownSeconds: 3,
}

export const notRunning: RunState = {
	phase: 'idle',
	elapsed: 0,
	distance: 0,
	stageLength: 0,
	worldScale: 1,
	countdown: 0,
	resumeTo: 'running',
}

const over = (phase: RunPhase) => phase === 'paused' || phase === 'finished' || phase === 'fallen'

export function createRun(initial: RunState = notRunning): Run {

	const expect = (action: string, phase: RunPhase): boolean => {
		const current = store.value.phase
		if (current === phase) return true
		refuse(action, `phase is ${current}`)
		return false
	}

	const store: Run = createStore<RunState & RunActions>({
		...initial,

		start(stageLength) {
			store.update(() => ({ ...notRunning, phase: 'intro', stageLength }))
		},

		tick(delta) {
			const state = store.value
			if (over(state.phase)) return

			if (state.countdown > 0) {
				const countdown = Math.max(0, state.countdown - delta)
				store.update(() => ({ countdown, phase: countdown === 0 ? state.resumeTo : state.phase }))
				return
			}
			if (state.phase === 'intro') {
				const elapsed = state.elapsed + delta
				store.update(() => ({ elapsed, phase: elapsed >= runConfig.introSeconds ? 'running' : 'intro' }))
				return
			}
			const distance = state.phase === 'running' ? state.distance + runConfig.pace * delta : state.distance
			store.update(() => ({ elapsed: state.elapsed + delta, distance: Math.min(distance, state.stageLength) }))
		},

		beginAmbush() {
			if (!expect('run.beginAmbush', 'running')) return
			store.update(() => ({ phase: 'ambush', worldScale: runConfig.ambushWorldScale }))
		},

		endAmbush() {
			if (!expect('run.endAmbush', 'ambush')) return
			store.update(() => ({ phase: 'running', worldScale: 1 }))
		},

		pause() {
			const state = store.value
			if (over(state.phase)) return
			store.update(() => ({ phase: 'paused', resumeTo: state.phase, countdown: 0 }))
		},

		resume() {
			if (!expect('run.resume', 'paused')) return
			const state = store.value
			store.update(() => ({ phase: state.resumeTo, countdown: runConfig.countdownSeconds }))
		},

		finish() {
			store.update(() => ({ phase: 'finished', worldScale: 1, countdown: 0 }))
		},

		fall() {
			store.update(() => ({ phase: 'fallen', worldScale: 1, countdown: 0 }))
		},

		reset() {
			store.update(() => notRunning)
		},
	})
	return store
}
