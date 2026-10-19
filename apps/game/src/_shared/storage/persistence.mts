/**
 * Keeps the app-wide stores: settings, the difficulty per quiz, the terms agreed to per quiz, high scores, how far each stage got, the last run's misses and the chosen quiz and
 * stage in local storage, the loaded quizzes as `.bunbu` files in IndexedDB. Everything else starts fresh with every run
 * ([state](../../../../../docs/architecture/state.md#stores)).
 *
 * `persistApp` puts back what was saved and then writes every change. The stores know nothing of
 * storage; this is the only place that does.
 */

import { uncompress } from '@bunbu/data'
import { Immutable, type StateObject, type Store } from '@rooted/store'
import { highScores } from '../../fight/state/highscores.mts'
import { lastRun, type LastRunState } from '../../fight/state/lastrun.mts'
import type { HighScore } from '../../fight/state/score.mts'
import { stageResults, type StageResult } from '../../fight/state/stage-results.mts'
import { difficulties, quizDifficulties, type Difficulty } from '../../fight/state/difficulty.mts'
import { settings, speechRates, type SettingsState } from '../../settings/state/settings.mts'
import { agreements, termsKinds, type Agreement } from '../state/agreements.mts'
import type { AnswerRecord } from '../state/quiz.mts'
import { builtStages, selection, stages, type Stage } from '../state/selection.mts'
import { snapshot } from '../state/store.mts'
import { library, type LibraryActions, type LibraryEntry, type LibraryState } from './library.mts'
import { readQuizFiles, writeQuizFiles } from './quiz-files.mts'
import { read, write, type StoredKey } from './storage.mts'

// What is in local storage can be edited from DevTools or come from an older build, so it is
// checked before it is used. Each check builds a fresh value from the fields it knows, which drops
// keys that are not ours.
const isObject = (data: unknown): data is Readonly<Record<string, unknown>> => typeof data === 'object' && data !== null && !Array.isArray(data)
// `Number.isFinite` also turns away the `Infinity` that `JSON.parse('1e999')` gives.
const isNumber = (data: unknown): data is number => Number.isFinite(data)
const isCount = (data: unknown): data is number => Number.isInteger(data) && (data as number) >= 0
const isOneOf = <T,>(options: readonly T[], data: unknown): data is T => options.includes(data as T)

/** The entries of `data` that `check` turns into a value, by key. */
function validEntries<T>(data: unknown, check: (each: unknown) => T | undefined): Record<string, T> {
	if (!isObject(data)) return {}
	const checked = Object.entries(data).map(([key, each]) => [key, check(each)] as const)
	return Object.fromEntries(checked.filter((entry): entry is readonly [string, T] => entry[1] !== undefined))
}

const settingChecks: { readonly [Key in keyof SettingsState]: (data: unknown) => boolean } = {
	haptics: (data) => typeof data === 'boolean',
	volume: (data) => isNumber(data) && data >= 0 && data <= 1,
	speechRate: (data) => isOneOf(speechRates, data),
	voices: (data) => isObject(data) && Object.values(data).every((voice) => typeof voice === 'string'),
}

/** Settings are kept field by field: a field that is missing or invalid keeps its default. */
export function parseSettings(data: unknown): Partial<SettingsState> {
	if (!isObject(data)) return {}
	const valid = Object.entries(settingChecks).filter(([key, check]) => Object.hasOwn(data, key) && check(data[key]))
	return Object.fromEntries(valid.map(([key]) => [key, data[key]]))
}

function highScoreOf(data: unknown): HighScore | undefined {
	if (!isObject(data)) return undefined
	const { points, seconds, correct, answered, difficulty } = data
	// No run takes no time, and a score of zero seconds could never be beaten.
	if (!isCount(points) || !isNumber(seconds) || seconds <= 0 || !isCount(correct) || !isCount(answered)) return undefined
	if (!isOneOf(difficulties, difficulty)) return undefined
	return { points, seconds, correct, answered, difficulty }
}

/** The high scores that are valid, by quiz. */
export function parseHighScores(data: unknown): Record<string, HighScore> {
	return validEntries(data, highScoreOf)
}

/** The difficulties that are valid, by quiz. */
export function parseDifficulties(data: unknown): Record<string, Difficulty> {
	return validEntries(data, (chosen) => isOneOf(difficulties, chosen) ? chosen : undefined)
}

function agreementOf(data: unknown): Agreement | undefined {
	if (!isObject(data)) return undefined
	const { content, terms, termsVersion } = data
	if (typeof content !== 'string' || !isOneOf(termsKinds, terms) || !isNumber(termsVersion)) return undefined
	return { content, terms, termsVersion }
}

/** The terms agreements that are valid, by quiz. One that isn't is asked again when that quiz loads. */
export function parseAgreements(data: unknown): Record<string, Agreement> {
	return validEntries(data, agreementOf)
}

const isOptionalBoolean = (data: unknown): data is boolean | undefined => data === undefined || typeof data === 'boolean'

function stageResultOf(data: unknown): StageResult | undefined {
	if (!isObject(data)) return undefined
	const { distance, cleared, shogun, opens } = data
	if (!isNumber(distance) || distance < 0 || typeof cleared !== 'boolean' || !isOptionalBoolean(shogun) || !isOptionalBoolean(opens)) return undefined
	return {
		distance,
		cleared,
		...(shogun === undefined ? {} : { shogun }),
		...(opens === undefined ? {} : { opens }),
	}
}

/** The stage results that are valid, by quiz and stage. */
export function parseStageResults(data: unknown): Record<string, StageResult> {
	return validEntries(data, stageResultOf)
}

/** A quiz by `id` and `version`, or `undefined` when it is not one. */
function quizKeyOf(data: unknown): { readonly id: string, readonly version: string } | undefined {
	if (!isObject(data)) return undefined
	const { id, version } = data
	return typeof id === 'string' && typeof version === 'string' ? { id, version } : undefined
}

// Only what was missed: the last run is kept for practising its mistakes.
const missOutcomes = ['wrong', 'unanswered'] as const

function missOf(data: unknown): AnswerRecord | undefined {
	if (!isObject(data) || !isObject(data.at)) return undefined
	const { question, part } = data.at
	const { outcome, picked } = data
	if (!isCount(question) || !isCount(part) || !isOneOf(missOutcomes, outcome)) return undefined
	if (!Array.isArray(picked) || !picked.every(isCount)) return undefined
	return { at: { question, part }, outcome, picked }
}

/** The last run, or `undefined` when it is not one. The misses that are invalid are dropped. */
export function parseLastRun(data: unknown): LastRunState | undefined {
	if (!isObject(data) || !Array.isArray(data.misses)) return undefined
	const quiz = quizKeyOf(data.quiz)
	if (quiz === undefined) return undefined
	return { quiz, misses: data.misses.map(missOf).filter((miss) => miss !== undefined) }
}

export type SavedSelection = {
	/** The chosen quiz by `id` and `version`; it is put back once the library has its file. */
	readonly quiz: { readonly id: string, readonly version: string } | undefined
	/** The stage, when it can still be chosen. */
	readonly stage: Stage | undefined
	/** Whether endless was chosen; whether it is open on the quiz is checked on the fight setup. */
	readonly endless: boolean
}

/** The chosen quiz and stage. A stage that isn't built (any more) is dropped. */
export function parseSelection(data: unknown): SavedSelection {
	const nothing: SavedSelection = { quiz: undefined, stage: undefined, endless: false }
	if (!isObject(data) || !isOneOf(stages, data.stage) || !isOptionalBoolean(data.endless)) return nothing
	const quiz = data.quiz === undefined ? undefined : quizKeyOf(data.quiz)
	if (data.quiz !== undefined && quiz === undefined) return nothing
	return { quiz, stage: builtStages.has(data.stage) ? data.stage : undefined, endless: data.endless === true }
}

/** Chooses the saved quiz again when it is in the library, unless another was chosen meanwhile. */
function chooseSaved(quiz: SavedSelection['quiz']): void {
	if (quiz === undefined || selection.value.quiz !== undefined) return
	const entry = snapshot<LibraryState & LibraryActions>(library).entries.find((each) => each.quiz.id === quiz.id && each.quiz.version === quiz.version)
	if (entry !== undefined) selection.value.chooseQuiz(entry.quiz)
}

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
	quizDifficulties.value.restore(parseDifficulties(read('difficulties')))
	agreements.value.restore(parseAgreements(read('agreements')))
	highScores.value.restore(parseHighScores(read('high-scores')))
	stageResults.value.restore(parseStageResults(read('stage-results')))
	const saved = parseLastRun(read('last-run'))
	if (saved !== undefined) lastRun.value.restore(saved)
	const chosen = parseSelection(read('selection'))
	if (chosen.stage !== undefined) selection.value.chooseStage(chosen.stage)
	if (chosen.endless) selection.value.chooseEndless()

	save(settings, 'settings', signal, ({ haptics, volume, speechRate, voices }) => ({ haptics, volume, speechRate, voices }))
	save(quizDifficulties, 'difficulties', signal, (state) => state.chosen)
	save(agreements, 'agreements', signal, (state) => state.agreed)
	save(highScores, 'high-scores', signal, ({ scores }) => scores)
	save(stageResults, 'stage-results', signal, ({ results }) => results)
	save(lastRun, 'last-run', signal, ({ quiz, misses }) => ({ quiz, misses }))
	save(selection, 'selection', signal, ({ quiz, stage, endless }) => ({ quiz: quiz && { id: quiz.id, version: quiz.version }, stage, endless }))
	library.on('change', signal, ({ detail }) => {
		void writeQuizFiles(detail.state.entries.map(({ file }) => file.value))
	})

	return readQuizFiles().then(parseLibrary).then((entries) => {
		if (signal.aborted) return
		library.value.restore(entries)
		chooseSaved(chosen.quiz)
	})
}
