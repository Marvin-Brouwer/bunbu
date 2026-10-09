/**
 * The quizzes the player has loaded, so they are there again next time. App-wide.
 *
 * What is kept is each quiz's `.bunbu` file, not the parsed quiz: the file is validated again when
 * it is read back, as quiz files are untrusted input, and it stays valid if the format moves on.
 * The files sit beside the store, not in it: `@rooted/store` turns a `Uint8Array` in its state into
 * a plain object.
 */

import type { BunbuData } from '@bunbu/data'
import { createStore, type Store } from '@rooted/store'
import { snapshot } from '../state/store.mts'

export type LibraryEntry = {
	readonly quiz: BunbuData
}

/** A quiz with its `.bunbu` file, as it is loaded and kept. */
export type QuizFile = LibraryEntry & {
	readonly file: Uint8Array
}

export type LibraryState = {
	readonly entries: readonly LibraryEntry[]
	/** The quizzes added or removed this session, which a restore of the saved ones must not undo. */
	readonly touched: readonly string[]
}

export type LibraryActions = {
	/** Adds a loaded quiz, replacing the one with the same `id` and `version`. */
	add: (loaded: QuizFile) => void
	remove: (id: string, version: string) => void
	/** Puts back saved quizzes, except those added or removed since the app started. */
	restore: (saved: readonly QuizFile[]) => void
	reset: () => void
}

/** The store, with its actions on its state. Change it through those, not `update`. */
export type Library = Store<LibraryState & LibraryActions>

const keyOf = (id: string, version: string) => JSON.stringify([id, version])

const files = new Map<string, Uint8Array>()

/** The `.bunbu` file of a quiz in the library. */
export function fileOf(quiz: Pick<BunbuData, 'id' | 'version'>): Uint8Array | undefined {
	return files.get(keyOf(quiz.id, quiz.version))
}

/** App-wide: the library outlives every screen. Read the quizzes with `snapshot(library).entries`. */
export const library: Library = createStore<LibraryState & LibraryActions>({
	entries: [],
	touched: [],

	add({ quiz, file }) {
		const { entries, touched } = snapshot<LibraryState & LibraryActions>(library)
		const key = keyOf(quiz.id, quiz.version)
		files.set(key, file)
		library.update(() => ({
			entries: [...entries.filter((entry) => keyOf(entry.quiz.id, entry.quiz.version) !== key), { quiz }],
			touched: [...touched, key],
		}))
	},

	remove(id, version) {
		const { entries, touched } = snapshot<LibraryState & LibraryActions>(library)
		const key = keyOf(id, version)
		files.delete(key)
		library.update(() => ({
			entries: entries.filter((entry) => keyOf(entry.quiz.id, entry.quiz.version) !== key),
			touched: [...touched, key],
		}))
	},

	restore(saved) {
		const { entries, touched } = snapshot<LibraryState & LibraryActions>(library)
		// One quiz per `id` + `version`, as in `add`: the last saved wins.
		const older = new Map<string, QuizFile>()
		for (const each of saved) older.set(keyOf(each.quiz.id, each.quiz.version), each)
		const restored = [...older].filter(([key]) => !touched.includes(key))
		for (const [key, { file }] of restored) files.set(key, file)
		library.update(() => ({ entries: [...restored.map(([, { quiz }]) => ({ quiz })), ...entries] }))
	},

	reset() {
		files.clear()
		library.update(() => ({ entries: [], touched: [] }))
	},
})
