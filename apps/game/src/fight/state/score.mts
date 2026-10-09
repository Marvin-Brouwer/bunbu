/**
 * The score: a flat 100 per correct answer, and the run time as the tiebreak
 * ([score](../../../../../docs/design/gameplay.md#score)). There is no per-question time bonus.
 */

import type { BunbuData } from '@bunbu/data'
import { createStore, type Store } from '@rooted/store'
import type { QuestionRef } from '../../_shared/state/quiz.mts'

/** Points for a correct answer. Wrong and unanswered score nothing. */
export const pointsPerCorrect = 100

/**
 * The point an ambush counts toward ([data format](../../../../../docs/design/data-format.md)):
 * every `solutions` entry is a point of its own, any other question is one point, however many
 * ambushes it takes. So the rows of a `match` question share one.
 */
export function pointOf(quiz: BunbuData, at: QuestionRef): string {
	return quiz.questions[at.question]?.type === 'solutions' ? `${at.question}.${at.part}` : `${at.question}`
}

/** How many points the ambushes in `refs` are worth together. */
export function pointsIn(quiz: BunbuData, refs: readonly QuestionRef[]): number {
	return new Set(refs.map((at) => pointOf(quiz, at))).size
}

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
	/** Starts a run against `best`, the quiz's high score, or against none when it has no high score yet. */
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
			store.update(() => ({ ...noScore, best }))
		},
	})
	return store
}
