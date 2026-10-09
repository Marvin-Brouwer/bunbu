/**
 * The last run's misses, kept so the dojo can "practise mistakes" after the run's own stores are
 * gone ([results](../../../../../docs/design/screens.md#7-finished-results-and-mistakes)). It
 * holds the most recent run only, finished or fallen, and the quiz it was a run of.
 */

import { createStore, type Store } from '@rooted/store'
import type { AnswerRecord } from '../../_shared/state/quiz.mts'

export type LastRunState = {
	/** The quiz the run was on, or `undefined` before there was a run. */
	readonly quiz: { readonly id: string, readonly version: string } | undefined
	/** What was wrong or unanswered, with what was picked. */
	readonly misses: readonly AnswerRecord[]
}

export type LastRunActions = {
	save: (id: string, version: string, misses: readonly AnswerRecord[]) => void
	/** The misses of the last run when it was on this quiz, or none. */
	missesOf: (id: string, version: string) => readonly AnswerRecord[]
	restore: (saved: LastRunState) => void
	reset: () => void
}

/** The store, with its actions on its state. Change it through those, not `update`. */
export type LastRun = Store<LastRunState & LastRunActions>

export const noLastRun: LastRunState = { quiz: undefined, misses: [] }

export function createLastRun(initial: LastRunState = noLastRun): LastRun {

	const store: LastRun = createStore<LastRunState & LastRunActions>({
		...initial,

		save(id, version, misses) {
			store.update(() => ({ quiz: { id, version }, misses }))
		},

		missesOf(id, version) {
			const { quiz, misses } = store.value
			return quiz?.id === id && quiz.version === version ? misses : []
		},

		restore(saved) {
			store.update(() => saved)
		},

		reset() {
			store.update(() => noLastRun)
		},
	})
	return store
}

/** App-wide: the dojo reads it after the run that wrote it is gone. */
export const lastRun = createLastRun()
