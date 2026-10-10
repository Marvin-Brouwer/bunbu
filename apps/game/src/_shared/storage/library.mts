/**
 * The quizzes the player has loaded, so they are there again next time. App-wide.
 *
 * What is kept is each quiz's `.bunbu` file, not the parsed quiz: the file is validated again when
 * it is read back, as quiz files are untrusted input, and it stays valid if the format moves on.
 */

import type { BunbuData } from '@bunbu/data'
import { createStore, type Immutable, type Store } from '@rooted/store'
import { snapshot } from '../state/store.mts'

/** A quiz with its `.bunbu` file, as it is loaded and kept. The file doesn't change once loaded. */
export type LibraryEntry = {
	readonly quiz: BunbuData
	readonly file: Immutable<Uint8Array>
}

export type LibraryState = {
	readonly entries: readonly LibraryEntry[]
	/** The quizzes added or removed this session, which a restore of the saved ones must not undo. */
	readonly touched: readonly string[]
}

export type LibraryActions = {
	/** Adds a loaded quiz, replacing the one with the same `id` and `version`. */
	add: (loaded: LibraryEntry) => void
	remove: (id: string, version: string) => void
	/** Puts back saved quizzes, except those added or removed since the app started. */
	restore: (saved: readonly LibraryEntry[]) => void
	reset: () => void
}

/** The store, with its actions on its state. Change it through those, not `update`. */
export type Library = Store<LibraryState & LibraryActions>

const keyOf = (id: string, version: string) => JSON.stringify([id, version])

/** App-wide: the library outlives every screen. Read the quizzes with `snapshot(library).entries`. */
export const library: Library = createStore<LibraryState & LibraryActions>({
	entries: [],
	touched: [],

	add(loaded) {
		const { entries, touched } = snapshot<LibraryState & LibraryActions>(library)
		const key = keyOf(loaded.quiz.id, loaded.quiz.version)
		library.update(() => ({
			entries: [...entries.filter((entry) => keyOf(entry.quiz.id, entry.quiz.version) !== key), loaded],
			touched: [...touched, key],
		}))
	},

	remove(id, version) {
		const { entries, touched } = snapshot<LibraryState & LibraryActions>(library)
		const key = keyOf(id, version)
		library.update(() => ({
			entries: entries.filter((entry) => keyOf(entry.quiz.id, entry.quiz.version) !== key),
			touched: [...touched, key],
		}))
	},

	restore(saved) {
		const { entries, touched } = snapshot<LibraryState & LibraryActions>(library)
		// One quiz per `id` + `version`, as in `add`: the last saved wins.
		const older = new Map<string, LibraryEntry>()
		for (const each of saved) older.set(keyOf(each.quiz.id, each.quiz.version), each)
		const restored = [...older].filter(([key]) => !touched.includes(key))
		library.update(() => ({ entries: [...restored.map(([, entry]) => entry), ...entries] }))
	},

	reset() {
		library.update(() => ({ entries: [], touched: [] }))
	},
})
