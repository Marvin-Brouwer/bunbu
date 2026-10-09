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
	/** Run time in real seconds, slow motion included. Shown on the results and used as the high-score tiebreak. */
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
	/** Seconds the samurai still holds after an ambush, for the strike or the hit to play out. */
	readonly recovery: number
}

export type RunActions = {
	start: (stageLength: number) => void
	/**
	 * Advances the run. Distance goes by `worldDelta`, which the loop has scaled by `worldScale`;
	 * the run time and the resume countdown go by `realDelta`, the player's own time.
	 */
	tick: (worldDelta: number, realDelta: number) => void
	beginAmbush: () => void
	/** Back to running, after `recovery` seconds of standing still. */
	endAmbush: (recovery?: number) => void
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
	/** How long the samurai holds after slaying or blocking. */
	strikeSeconds: 0.5,
	/** How long he holds after a hit: the run resumes after about 1 s ([outcome](../../../../../docs/design/gameplay.md#outcome)). */
	hitSeconds: 1,
}

export const notRunning: RunState = {
	phase: 'idle',
	elapsed: 0,
	distance: 0,
	stageLength: 0,
	worldScale: 1,
	countdown: 0,
	resumeTo: 'running',
	recovery: 0,
}

const over = (phase: RunPhase) => phase === 'paused' || phase === 'finished' || phase === 'fallen'

// What one tick changes, by what the run is doing. Each returns only the fields that change.

/** The 3-2-1 after resuming: the run itself stands still. */
function countDown(state: RunState, realDelta: number): Partial<RunState> {
	const countdown = Math.max(0, state.countdown - realDelta)
	return { countdown, phase: countdown === 0 ? state.resumeTo : state.phase }
}

function introduce(state: RunState, realDelta: number): Partial<RunState> {
	const elapsed = state.elapsed + realDelta
	return { elapsed, phase: elapsed >= runConfig.introSeconds ? 'running' : 'intro' }
}

/** Holding after an ambush: time passes, the samurai does not move. */
function recover(state: RunState, realDelta: number): Partial<RunState> {
	return { elapsed: state.elapsed + realDelta, recovery: Math.max(0, state.recovery - realDelta) }
}

/** Running covers ground; an ambush only lets time pass. */
function advance(state: RunState, worldDelta: number, realDelta: number): Partial<RunState> {
	const moved = state.phase === 'running' ? state.distance + runConfig.pace * worldDelta : state.distance
	return { elapsed: state.elapsed + realDelta, distance: Math.min(moved, state.stageLength) }
}

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

		tick(worldDelta, realDelta) {
			const state = store.value
			if (over(state.phase)) return

			if (state.countdown > 0) store.update(() => countDown(state, realDelta))
			else if (state.phase === 'intro') store.update(() => introduce(state, realDelta))
			else if (state.recovery > 0) store.update(() => recover(state, realDelta))
			else store.update(() => advance(state, worldDelta, realDelta))
		},

		beginAmbush() {
			if (!expect('run.beginAmbush', 'running')) return
			store.update(() => ({ phase: 'ambush', worldScale: runConfig.ambushWorldScale }))
		},

		endAmbush(recovery = 0) {
			if (!expect('run.endAmbush', 'ambush')) return
			// Back to running for good: a countdown that was still going belonged to the ambush.
			store.update(() => ({ phase: 'running', worldScale: 1, recovery, countdown: 0, resumeTo: 'running' }))
		},

		pause() {
			const state = store.value
			if (over(state.phase) || state.phase === 'idle') return
			store.update(() => ({ phase: 'paused', resumeTo: state.phase, countdown: 0 }))
		},

		resume() {
			if (!expect('run.resume', 'paused')) return
			const state = store.value
			store.update(() => ({ phase: state.resumeTo, countdown: runConfig.countdownSeconds }))
		},

		finish() {
			store.update(() => ({ phase: 'finished', worldScale: 1, countdown: 0, recovery: 0 }))
		},

		fall() {
			store.update(() => ({ phase: 'fallen', worldScale: 1, countdown: 0, recovery: 0 }))
		},

		reset() {
			store.update(() => notRunning)
		},
	})
	return store
}
