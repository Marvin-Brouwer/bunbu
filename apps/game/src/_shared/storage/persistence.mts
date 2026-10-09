/**
 * Keeps the app-wide stores: settings, high scores and the last run's misses in local storage, the
 * loaded quizzes as `.bunbu` files in IndexedDB. Everything else starts fresh with every run
 * ([state](../../../../../docs/architecture/state.md#stores)).
 *
 * `persistApp` puts back what was saved and then writes every change. The stores know nothing of
 * storage; this is the only place that does.
 */

import { compress, uncompress, validate } from '@bunbu/data'
import { type, type Type } from 'arktype'
import type { StateObject, Store } from '@rooted/store'
import { highScores } from '../../fight/state/highscores.mts'
import { lastRun, type LastRunState } from '../../fight/state/lastrun.mts'
import { pointsPerCorrect, type HighScore } from '../../fight/state/score.mts'
import { settings, type SettingsState } from '../../settings/state/settings.mts'
import { fileOf, library, type QuizFile } from './library.mts'
import { readQuizFiles, writeQuizFiles } from './quiz-files.mts'
import { forget, read, write, type StoredKey } from './storage.mts'

// What is in local storage can be edited from DevTools or come from an older build, so it is
// checked before it is used: https://arktype.io. `'+': 'delete'` drops keys that are not ours.

/** Whether an ArkType check passed. */
const passed = <T,>(result: T | type.errors): result is T => !(result instanceof type.errors)

const settingFields = {
	difficulty: type.enumerated('novice', 'adept', 'master'),
	haptics: type('boolean'),
	volume: type('0 <= number <= 1'),
} satisfies Record<keyof SettingsState, Type>

/** Settings are kept field by field: a field that is missing or invalid keeps its default. */
export function parseSettings(data: unknown): Partial<SettingsState> {
	if (!isObject(data)) return {}
	const valid = Object.entries(settingFields).filter(([key, field]) => passed(field(data[key])))
	return Object.fromEntries(valid.map(([key]) => [key, data[key]]))
}

/** A score has to add up: edited points would otherwise become a high score nobody can beat. */
const highScore = type({
	'+': 'delete',
	points: 'number.integer >= 0',
	// No run takes no time, and a score of zero seconds could never be beaten.
	seconds: 'number > 0',
	correct: 'number.integer >= 0',
	answered: 'number.integer >= 0',
}).narrow((score) => score.points === score.correct * pointsPerCorrect && score.correct <= score.answered)

/** The high scores that are valid, by quiz. */
export function parseHighScores(data: unknown): Record<string, HighScore> {
	if (!isObject(data)) return {}
	const checked = Object.entries(data).map(([key, score]) => [key, highScore(score)] as const)
	return Object.fromEntries(checked.filter((entry): entry is readonly [string, HighScore] => passed(entry[1])))
}

const miss = type({
	'+': 'delete',
	at: { '+': 'delete', question: 'number.integer >= 0', part: 'number.integer >= 0' },
	// Only what was missed: the last run is kept for practising its mistakes.
	outcome: type.enumerated('wrong', 'unanswered'),
	picked: 'number.integer >= 0 []',
})

const lastRunShape = type({
	'+': 'delete',
	quiz: { '+': 'delete', id: 'string', version: 'string' },
	misses: 'unknown[]',
})

/** The last run, or `undefined` when it is not one. The misses that are invalid are dropped. */
export function parseLastRun(data: unknown): LastRunState | undefined {
	const run = lastRunShape(data)
	if (!passed(run)) return undefined
	return { quiz: run.quiz, misses: run.misses.map((each) => miss(each)).filter(passed) }
}

const isObject = (data: unknown): data is Readonly<Record<string, unknown>> => typeof data === 'object' && data !== null && !Array.isArray(data)

/** The kept `.bunbu` files, validated again: what is in storage is not trusted to still be a quiz. */
export async function parseLibrary(files: readonly Uint8Array[]): Promise<QuizFile[]> {
	const parsed = await Promise.all(files.map(async (file) => {
		try {
			return [{ quiz: await uncompress(file), file }]
		} catch {
			return []
		}
	}))
	return parsed.flat()
}

/**
 * The quizzes an older build kept in local storage as YAML, validated and packed as `.bunbu` files
 * to move them to IndexedDB.
 */
export async function parseOlderLibrary(data: unknown): Promise<QuizFile[]> {
	if (!Array.isArray(data)) return []
	const sources = data.filter((source) => typeof source === 'string')
	const parsed = await Promise.all(sources.map(async (source) => {
		const quiz = await validate(source)
		return 'questions' in quiz ? [{ quiz, file: await compress(quiz) }] : []
	}))
	return parsed.flat()
}

/** The kept quizzes, the ones an older build kept first so a newer file of the same quiz wins. */
async function restoreLibrary(): Promise<QuizFile[]> {
	const [older, kept] = await Promise.all([
		parseOlderLibrary(read('library')),
		readQuizFiles().then(parseLibrary),
	])
	return [...older, ...kept]
}

/** Saves `pick(state)` on every change of `store`. */
function save<TState extends StateObject>(store: Store<TState>, key: StoredKey, signal: AbortSignal, pick: (state: TState) => unknown): void {
	store.on('change', signal, ({ detail }) => { write(key, pick(detail.state as TState)) })
}

/**
 * Puts back what was saved, then saves every change until `signal` aborts. Call it once, before
 * the first screen mounts, so the screens start from the saved state. The loaded quizzes come
 * back a moment later, once they have been validated: the promise settles when they have.
 */
export function persistApp(signal: AbortSignal): Promise<void> {
	settings.value.restore(parseSettings(read('settings')))
	highScores.value.restore(parseHighScores(read('high-scores')))
	const saved = parseLastRun(read('last-run'))
	if (saved !== undefined) lastRun.value.restore(saved)

	save(settings, 'settings', signal, ({ difficulty, haptics, volume }) => ({ difficulty, haptics, volume }))
	save(highScores, 'high-scores', signal, ({ scores }) => scores)
	save(lastRun, 'last-run', signal, ({ quiz, misses }) => ({ quiz, misses }))
	library.on('change', signal, ({ detail }) => {
		const files = detail.state.entries.map(({ quiz }) => fileOf(quiz)).filter((file) => file !== undefined)
		void writeQuizFiles(files)
	})

	return restoreLibrary().then((entries) => {
		if (signal.aborted) return
		library.value.restore(entries)
		// Restoring saved them in IndexedDB, so the older copy can go.
		forget('library')
	})
}
