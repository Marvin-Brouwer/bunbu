/**
 * The score: a flat 100 per correct answer, and the run time as the tiebreak
 * ([score](../../../../../docs/design/gameplay.md#score)). There is no per-question time bonus.
 */

import { createStore, type Store } from '@rooted/store'

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
	/** Whether this run set the high score, for the "new high score" header. `best` is then the one it beat. */
	readonly newBest: boolean
}

export type ScoreActions = {
	addCorrect: () => void
	addMiss: () => void
	/** Ends the run, with whether it set the high score. */
	settle: (newBest: boolean) => void
	/** Starts a run, keeping the high score to beat. */
	reset: (best?: HighScore) => void
}

/** The store, with its actions on its state. Change it through those, not `update`. */
export type Score = Store<ScoreState & ScoreActions>

export const noScore: ScoreState = { points: 0, correct: 0, answered: 0, best: undefined, newBest: false }

/** Whether `score` beats `best`: more points, or the same points in less time. */
export function beats(score: HighScore, best: HighScore | undefined): boolean {
	if (best === undefined) return true
	if (score.points !== best.points) return score.points > best.points
	return score.seconds < best.seconds
}

export function createScore(initial: ScoreState = noScore): Score {

	const store: Score = createStore<ScoreState & ScoreActions>({
		...initial,

		addCorrect() {
			store.update((state) => ({
				points: state.points + pointsPerCorrect,
				correct: state.correct + 1,
				answered: state.answered + 1,
			}))
		},

		addMiss() {
			store.update((state) => ({ answered: state.answered + 1 }))
		},

		settle(newBest) {
			store.update(() => ({ newBest }))
		},

		reset(best) {
			store.update((state) => ({ ...noScore, best: best ?? state.best }))
		},
	})
	return store
}
