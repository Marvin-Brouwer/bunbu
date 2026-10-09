/**
 * Keeps the app-wide stores in local storage: settings, high scores, the last run's misses and
 * the loaded quizzes. Everything else starts fresh with every run
 * ([state](../../../../../docs/architecture/state.md#stores)).
 *
 * `persistApp` puts back what was saved and then writes every change. The stores know nothing of
 * storage; this is the only place that does.
 */

import { validate } from '@bunbu/data'
import type { StateObject, Store } from '@rooted/store'
import { highScores } from '../../fight/state/highscores.mts'
import { lastRun, type LastRunState } from '../../fight/state/lastrun.mts'
import type { HighScore } from '../../fight/state/score.mts'
import { settings, timeScales, type Difficulty, type SettingsState } from '../../settings/state/settings.mts'
import type { AnswerRecord, Outcome } from '../state/quiz.mts'
import { library, type LibraryEntry } from './library.mts'
import { read, write, type StoredKey } from './storage.mts'

type Json = Readonly<Record<string, unknown>>

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value)
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0

/** Settings are kept field by field: a field that is missing or invalid keeps its default. */
export function parseSettings(data: unknown): Partial<SettingsState> {
	if (!isObject(data)) return {}
	const { difficulty, haptics, volume } = data
	return {
		...(typeof difficulty === 'string' && Object.hasOwn(timeScales, difficulty) ? { difficulty: difficulty as Difficulty } : {}),
		...(typeof haptics === 'boolean' ? { haptics } : {}),
		...(typeof volume === 'number' && volume >= 0 && volume <= 1 ? { volume } : {}),
	}
}

function parseHighScore(data: unknown): HighScore | undefined {
	if (!isObject(data)) return undefined
	const { points, seconds, correct, answered } = data
	if (!isCount(points) || typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return undefined
	if (!isCount(correct) || !isCount(answered)) return undefined
	return { points, seconds, correct, answered }
}

export function parseHighScores(data: unknown): Record<string, HighScore> {
	const scores: Record<string, HighScore> = {}
	if (!isObject(data)) return scores
	for (const [key, value] of Object.entries(data)) {
		const score = parseHighScore(value)
		if (score !== undefined) scores[key] = score
	}
	return scores
}

const outcomes = new Set<unknown>(['correct', 'wrong', 'unanswered'])

function parseMiss(data: unknown): AnswerRecord | undefined {
	if (!isObject(data)) return undefined
	const { at, outcome, picked } = data
	if (!isObject(at)) return undefined
	const { question, part } = at
	if (!isCount(question) || !isCount(part)) return undefined
	if (!outcomes.has(outcome) || !Array.isArray(picked) || !picked.every(isCount)) return undefined
	return { at: { question, part }, outcome: outcome as Outcome, picked }
}

export function parseLastRun(data: unknown): LastRunState | undefined {
	if (!isObject(data)) return undefined
	const { quiz, misses: saved } = data
	if (!isObject(quiz) || !Array.isArray(saved)) return undefined
	const { id, version } = quiz
	if (typeof id !== 'string' || typeof version !== 'string') return undefined
	const misses = saved.map(parseMiss).filter((miss) => miss !== undefined)
	return { quiz: { id, version }, misses }
}

/** The quiz files, which are validated again: what is in storage is not trusted to still be a quiz. */
export async function parseLibrary(data: unknown): Promise<LibraryEntry[]> {
	if (!Array.isArray(data)) return []
	const sources = data.filter((source) => typeof source === 'string')
	const parsed = await Promise.all(sources.map(async (source) => ({ source, quiz: await validate(source) })))
	return parsed.flatMap(({ source, quiz }) => 'questions' in quiz ? [{ source, quiz }] : [])
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
	save(library, 'library', signal, ({ entries }) => entries.map((entry) => entry.source))

	return parseLibrary(read('library')).then((entries) => {
		if (!signal.aborted) library.value.restore(entries)
	})
}
