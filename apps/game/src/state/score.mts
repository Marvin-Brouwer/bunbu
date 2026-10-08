/**
 * The score: a flat 100 per correct answer, and the run time as the tiebreak
 * ([score](../../../../docs/design/gameplay.md#score)). There is no per-question time bonus.
 */

import { createStore, type Store } from './store.mts'

/** Points for a correct answer. Wrong and unanswered score nothing. */
export const pointsPerCorrect = 100

/** A high score is kept per quiz `id` + `version`; with equal points the shorter run time wins. */
export type HighScore = {
	readonly points: number
	/** Total run time in seconds. */
	readonly seconds: number
	readonly correct: number
	readonly answered: number
}

export type ScoreState = {
	readonly points: number
	readonly correct: number
	readonly answered: number
	/** The high score to beat, shown in the HUD, or `undefined` for a quiz with no run yet. */
	readonly best: HighScore | undefined
}

const initial: ScoreState = { points: 0, correct: 0, answered: 0, best: undefined }

export const scoreStore: Store<ScoreState> = createStore(initial)

/** Whether `score` beats `best`: more points, or the same points in less time. */
export function beats(score: HighScore, best: HighScore | undefined): boolean {
	if (best === undefined) return true
	if (score.points !== best.points) return score.points > best.points
	return score.seconds < best.seconds
}

export const score = {
	get: scoreStore.get,
	subscribe: scoreStore.subscribe,

	addCorrect(): void {
		const state = scoreStore.get()
		scoreStore.set({
			...state,
			points: state.points + pointsPerCorrect,
			correct: state.correct + 1,
			answered: state.answered + 1,
		})
	},

	addMiss(): void {
		const state = scoreStore.get()
		scoreStore.set({ ...state, answered: state.answered + 1 })
	},

	/** Starts a run, keeping the high score to beat. */
	reset(best?: HighScore): void {
		scoreStore.set({ ...initial, best: best ?? scoreStore.get().best })
	},
}
