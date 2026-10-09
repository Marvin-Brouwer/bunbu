/**
 * The high score of every quiz the player has passed, kept per quiz `id` + `version`
 * ([score](../../../../../docs/design/gameplay.md#score)). App-wide, since the menu and the quiz
 * cards show it outside a run. Only a passed run sets one, and with equal points the shorter
 * run time wins.
 */

import { createStore, type Store } from '@rooted/store'
import { beats, type HighScore } from './score.mts'

export type HighScoresState = {
	/** By {@link highScoreKey}. */
	readonly scores: Readonly<Record<string, HighScore>>
}

export type HighScoresActions = {
	/** The high score of a quiz, or `undefined` while it has not been passed. */
	of: (id: string, version: string) => HighScore | undefined
	/** Keeps `score` when it beats the high score. Returns whether it did, for "new high score". */
	submit: (id: string, version: string, score: HighScore) => boolean
	/** Puts back what was saved. Anything already recorded this session is kept when it is better. */
	restore: (saved: Readonly<Record<string, HighScore>>) => void
	reset: () => void
}

/** The store, with its actions on its state. Change it through those, not `update`. */
export type HighScores = Store<HighScoresState & HighScoresActions>

export const noHighScores: HighScoresState = { scores: {} }

/** A new version of a quiz starts with a clean slate: its questions may have changed. */
export function highScoreKey(id: string, version: string): string {
	return JSON.stringify([id, version])
}

export function createHighScores(initial: HighScoresState = noHighScores): HighScores {

	const store: HighScores = createStore<HighScoresState & HighScoresActions>({
		...initial,

		of(id, version) {
			return store.value.scores[highScoreKey(id, version)]
		},

		submit(id, version, score) {
			const key = highScoreKey(id, version)
			if (!beats(score, store.value.scores[key])) return false
			store.update((state) => ({ scores: { ...state.scores, [key]: score } }))
			return true
		},

		restore(saved) {
			store.update((state) => {
				const scores: Record<string, HighScore> = { ...saved }
				for (const [key, score] of Object.entries(state.scores)) {
					if (beats(score, scores[key])) scores[key] = score
				}
				return { scores }
			})
		},

		reset() {
			store.update(() => noHighScores)
		},
	})
	return store
}

/** App-wide: the high scores outlive every run. */
export const highScores = createHighScores()
