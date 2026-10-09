/**
 * The quizzes the player has loaded, so they are there again next time. App-wide.
 *
 * What is kept is each quiz's file, not the parsed quiz: the file is validated again when it is
 * read back, as quiz files are untrusted input, and it stays valid if the format moves on.
 */

import type { BunbuData } from '@bunbu/data'
import { createStore, type Store } from '@rooted/store'
import { snapshot } from '../state/store.mts'

export type LibraryEntry = {
	/** The quiz file as the player loaded it. */
	readonly source: string
	readonly quiz: BunbuData
}

export type LibraryState = {
	readonly entries: readonly LibraryEntry[]
}

export type LibraryActions = {
	/** Adds a loaded quiz, replacing the one with the same `id` and `version`. */
	add: (source: string, quiz: BunbuData) => void
	remove: (id: string, version: string) => void
	/** Puts back saved quizzes, keeping what was added meanwhile. */
	restore: (saved: readonly LibraryEntry[]) => void
}

/** The store, with its actions on its state. Change it through those, not `update`. */
export type Library = Store<LibraryState & LibraryActions>

const same = (a: BunbuData, b: BunbuData) => a.id === b.id && a.version === b.version

/** App-wide: the library outlives every screen. Read the quizzes with `snapshot(library).entries`. */
export const library: Library = createStore<LibraryState & LibraryActions>({
	entries: [],

	add(source, quiz) {
		const { entries } = snapshot<LibraryState & LibraryActions>(library)
		library.update(() => ({ entries: [...entries.filter((entry) => !same(entry.quiz, quiz)), { source, quiz }] }))
	},

	remove(id, version) {
		const { entries } = snapshot<LibraryState & LibraryActions>(library)
		library.update(() => ({ entries: entries.filter((entry) => entry.quiz.id !== id || entry.quiz.version !== version) }))
	},

	restore(saved) {
		const { entries } = snapshot<LibraryState & LibraryActions>(library)
		// One quiz per `id` + `version`, as in `add`: the last saved wins, and one loaded this
		// session is newer than any saved.
		const older = new Map<string, LibraryEntry>()
		for (const each of saved) older.set(JSON.stringify([each.quiz.id, each.quiz.version]), each)
		const fresh = new Set(entries.map((entry) => JSON.stringify([entry.quiz.id, entry.quiz.version])))
		const restored = [...older].filter(([key]) => !fresh.has(key)).map(([, entry]) => entry)
		library.update(() => ({ entries: [...restored, ...entries] }))
	},
})
