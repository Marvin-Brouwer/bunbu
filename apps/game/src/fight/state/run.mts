/**
 * The run: which phase it is in, how long it has lasted, how far the samurai has come.
 *
 * The samurai runs at a constant pace and the game never speeds up
 * ([core loop](../../../../../docs/design/gameplay.md#core-loop)). `worldScale` is the slow motion
 * during an ambush, not the difficulty: that is `timeScales` in [difficulty.mts](./difficulty.mts).
 * Finished and fallen are phases of the run, not routes: the results show over the run's world.
 */

import { createStore, type Store } from '@rooted/store'
import { refuse } from '../../_shared/state/store.mts'
import { usualDifficulty, type Difficulty } from './difficulty.mts'

export type RunPhase = 'idle' | 'intro' | 'running' | 'ambush' | 'paused' | 'finished' | 'fallen'

/** The phases a run can be paused in; the rest are paused, over, or not started. */
export const pausable: ReadonlySet<RunPhase> = new Set(['intro', 'running', 'ambush'])

export type RunState = {
	readonly phase: RunPhase
	/** The difficulty the run started with: it can't change halfway through. */
	readonly difficulty: Difficulty
	/** Run time in real seconds, slow motion included. Shown on the results and used as the high-score tiebreak. */
	readonly elapsed: number
	/** Metres covered of `stageLength`. */
	readonly distance: number
	readonly stageLength: number
	/** How fast the world moves: `1` while running, lower and lower in the ambush's slow motion. */
	readonly worldScale: number
	/** Real seconds the ambush's slow motion has lasted, pauses left out. */
	readonly slowedFor: number
	/** Seconds left of the 3-2-1 countdown after resuming, `0` when not counting down. */
	readonly countdown: number
	/** The phase to return to when the pause or the countdown ends. */
	readonly resumeTo: RunPhase
	/** Seconds the samurai still holds after an ambush, for the strike or the hit to play out. */
	readonly recovery: number
}

export type RunActions = {
	/** Starts the intro; `difficulty` defaults to the usual one. */
	start: (stageLength: number, difficulty?: Difficulty) => void
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
	pace: 9,
	/**
	 * The ambush's slow motion: the world runs at half speed after `halfSpeedAfter` real seconds,
	 * at a third after twice that, and so on, but never slower than `slowest`.
	 */
	slowMotion: { halfSpeedAfter: 0.25, slowest: 0.03 },
	introSeconds: 1.5,
	countdownSeconds: 3,
	/** How long the samurai holds after slaying or blocking. */
	strikeSeconds: 0.5,
	/** How long he holds after a hit: the run resumes after about 1 s ([outcome](../../../../../docs/design/gameplay.md#outcome)). */
	hitSeconds: 1,
	/**
	 * How long he holds when the time ran out: the scroll is cut and its halves fall, and the
	 * slicer charges in and lands the hit while the others flee.
	 */
	slicedSeconds: 1.3,
}

/**
 * Where the stage is marked off in quarters, as shares of its length. Each mark the samurai passes
 * moves the stage's light on ([3 Running](../../../../../docs/design/screens.md#3-running)).
 */
export const quarterMarks = [0.25, 0.5, 0.75] as const

/** How many of the {@link quarterMarks} the samurai has passed. */
export function marksPassed({ distance, stageLength }: Pick<RunState, 'distance' | 'stageLength'>): number {
	if (stageLength === 0) return 0
	return quarterMarks.filter((mark) => distance >= mark * stageLength).length
}

export const notRunning: RunState = {
	phase: 'idle',
	difficulty: usualDifficulty,
	elapsed: 0,
	distance: 0,
	stageLength: 0,
	worldScale: 1,
	slowedFor: 0,
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

/** Metres covered of the stage: the samurai may run on past its end in the last ambush. */
export const stageDistanceOf = (state: Pick<RunState, 'distance' | 'stageLength'>): number => Math.min(state.distance, state.stageLength)

/**
 * How fast the world moves `seconds` into an ambush: slower and slower on a curve, so it slows down
 * hard at first and then hardly moves.
 */
export function slowMotionOf(seconds: number): number {
	const { halfSpeedAfter, slowest } = runConfig.slowMotion
	return Math.max(slowest, 1 / (1 + Math.max(0, seconds) / halfSpeedAfter))
}

/**
 * Running covers ground up to the end of the stage. In an ambush the samurai runs on in slow
 * motion, past the end too, for the last question is asked there.
 */
function advance(state: RunState, worldDelta: number, realDelta: number): Partial<RunState> {
	const elapsed = state.elapsed + realDelta
	const moved = state.distance + runConfig.pace * worldDelta
	if (state.phase !== 'ambush') return { elapsed, distance: Math.max(state.distance, Math.min(moved, state.stageLength)) }
	const slowedFor = state.slowedFor + realDelta
	return { elapsed, distance: moved, slowedFor, worldScale: slowMotionOf(slowedFor) }
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

		start(stageLength, difficulty = usualDifficulty) {
			store.update(() => ({ ...notRunning, phase: 'intro', stageLength, difficulty }))
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
			store.update(() => ({ phase: 'ambush', worldScale: 1, slowedFor: 0 }))
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
