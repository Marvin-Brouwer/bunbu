/**
 * Keeps the app-wide stores: settings, high scores, the last run's misses and the chosen quiz and
 * stage in local storage, the loaded quizzes as `.bunbu` files in IndexedDB. Everything else starts fresh with every run
 * ([state](../../../../../docs/architecture/state.md#stores)).
 *
 * `persistApp` puts back what was saved and then writes every change. The stores know nothing of
 * storage; this is the only place that does.
 */

import { uncompress } from '@bunbu/data'
import { type, type Type } from 'arktype'
import { Immutable, type StateObject, type Store } from '@rooted/store'
import { highScores } from '../../fight/state/highscores.mts'
import { lastRun, type LastRunState } from '../../fight/state/lastrun.mts'
import { pointsPerCorrect, type HighScore } from '../../fight/state/score.mts'
import { settings, type SettingsState } from '../../settings/state/settings.mts'
import { builtStages, selection, stages, type Stage } from '../state/selection.mts'
import { snapshot } from '../state/store.mts'
import { library, type LibraryActions, type LibraryEntry, type LibraryState } from './library.mts'
import { readQuizFiles, writeQuizFiles } from './quiz-files.mts'
import { read, write, type StoredKey } from './storage.mts'

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

const savedSelection = type({
	'+': 'delete',
	'quiz?': { '+': 'delete', id: 'string', version: 'string' },
	stage: type.enumerated(...stages),
})

export type SavedSelection = {
	/** The chosen quiz by `id` and `version`; it is put back once the library has its file. */
	readonly quiz: { readonly id: string, readonly version: string } | undefined
	/** The stage, when it can still be chosen. */
	readonly stage: Stage | undefined
}

/** The chosen quiz and stage. A stage that isn't built (any more) is dropped. */
export function parseSelection(data: unknown): SavedSelection {
	const saved = savedSelection(data)
	if (!passed(saved)) return { quiz: undefined, stage: undefined }
	return { quiz: saved.quiz, stage: builtStages.has(saved.stage) ? saved.stage : undefined }
}

/** Chooses the saved quiz again when it is in the library, unless another was chosen meanwhile. */
function chooseSaved(quiz: SavedSelection['quiz']): void {
	if (quiz === undefined || selection.value.quiz !== undefined) return
	const entry = snapshot<LibraryState & LibraryActions>(library).entries.find((each) => each.quiz.id === quiz.id && each.quiz.version === quiz.version)
	if (entry !== undefined) selection.value.chooseQuiz(entry.quiz)
}

const isObject = (data: unknown): data is Readonly<Record<string, unknown>> => typeof data === 'object' && data !== null && !Array.isArray(data)

/** The kept `.bunbu` files, validated again: what is in storage is not trusted to still be a quiz. */
export async function parseLibrary(files: readonly Uint8Array[]): Promise<LibraryEntry[]> {
	const parsed = await Promise.all(files.map(async (file) => {
		try {
			return [{ quiz: await uncompress(file), file: Immutable.from(file) }]
		} catch {
			return []
		}
	}))
	return parsed.flat()
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
	const chosen = parseSelection(read('selection'))
	if (chosen.stage !== undefined) selection.value.chooseStage(chosen.stage)

	save(settings, 'settings', signal, ({ difficulty, haptics, volume }) => ({ difficulty, haptics, volume }))
	save(highScores, 'high-scores', signal, ({ scores }) => scores)
	save(lastRun, 'last-run', signal, ({ quiz, misses }) => ({ quiz, misses }))
	save(selection, 'selection', signal, ({ quiz, stage }) => ({ quiz: quiz && { id: quiz.id, version: quiz.version }, stage }))
	library.on('change', signal, ({ detail }) => {
		void writeQuizFiles(detail.state.entries.map(({ file }) => file.value))
	})

	return readQuizFiles().then(parseLibrary).then((entries) => {
		if (signal.aborted) return
		library.value.restore(entries)
		chooseSaved(chosen.quiz)
	})
}
