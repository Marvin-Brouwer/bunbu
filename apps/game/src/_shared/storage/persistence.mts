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
import { pointsPerCorrect, type HighScore } from '../../fight/state/score.mts'
import { settings, timeScales, type Difficulty, type SettingsState } from '../../settings/state/settings.mts'
import type { AnswerRecord, Outcome } from '../state/quiz.mts'
import { library, type LibraryEntry } from './library.mts'
import { arrayOf, count, flag, fraction, listOf, object, oneOf, partial, recordOf, seconds, text, where } from './schema.mts'
import { read, write, type StoredKey } from './storage.mts'

/** Settings are kept field by field: a field that is missing or invalid keeps its default. */
export const parseSettings = partial<SettingsState>({
	difficulty: oneOf<Difficulty>(...(Object.keys(timeScales) as Difficulty[])),
	haptics: flag,
	volume: fraction,
})

/** A score has to add up: edited points would otherwise become a high score nobody can beat. */
const highScoreOf = where(
	object<HighScore>({ points: count, seconds, correct: count, answered: count }),
	(score) => score.points === score.correct * pointsPerCorrect && score.correct <= score.answered
)

export const parseHighScores = recordOf(highScoreOf)

const missOf = object<AnswerRecord>({
	at: object({ question: count, part: count }),
	outcome: oneOf<Outcome>('correct', 'wrong', 'unanswered'),
	picked: arrayOf(count),
})

/** The last run, or `undefined` when it is not one. The misses that are invalid are dropped. */
export const parseLastRun = object<LastRunState>({
	quiz: object({ id: text, version: text }),
	misses: listOf(missOf),
})

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
