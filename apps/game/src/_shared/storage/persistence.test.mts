import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { highScores } from '../../fight/state/highscores.mts'
import { lastRun } from '../../fight/state/lastrun.mts'
import { settings } from '../../settings/state/settings.mts'
import { fixtureQuiz } from '../../_temp/quiz.mts'
import { library } from './library.mts'
import { parseHighScores, parseLastRun, parseLibrary, parseSettings, persistApp } from './persistence.mts'
import { read, storedVersion, write } from './storage.mts'

/** A stand-in for the browser's local storage. */
function fakeStorage(items: Record<string, string> = {}) {
	return {
		items,
		getItem: (key: string) => items[key] ?? null,
		setItem: (key: string, value: string) => { items[key] = value },
		removeItem: (key: string) => { Reflect.deleteProperty(items, key) },
	}
}

const source = [
	'# yaml-language-server: $schema=https://raw.githubusercontent.com/Marvin-Brouwer/bunbu/main/schema/v1.json',
	'id: saved',
	'title: Saved',
	'version: "1"',
	'language: en',
	'passingScore: 70',
	'questions:',
	'  - type: yes-no',
	'    query: Is it?',
	'    answer: yes',
].join('\n')

let storage: ReturnType<typeof fakeStorage>
let stop: AbortController
const sessions: AbortController[] = []

/** The signal of another app session, which ends with the test so its listeners don't linger. */
function session(): AbortSignal {
	const controller = new AbortController()
	sessions.push(controller)
	return controller.signal
}

beforeEach(() => {
	storage = fakeStorage()
	vi.stubGlobal('localStorage', storage)
	stop = new AbortController()
	settings.value.reset()
	highScores.value.reset()
	lastRun.value.reset()
	library.value.restore([])
})

afterEach(() => {
	stop.abort()
	for (const controller of sessions.splice(0)) controller.abort()
	vi.unstubAllGlobals()
})

describe('storage', () => {
	it('round-trips a value in an envelope with the stored version', () => {
		write('settings', { haptics: false })
		expect(JSON.parse(storage.items['bunbu:settings'] ?? '')).toEqual({ version: storedVersion, data: { haptics: false } })
		expect(read('settings')).toEqual({ haptics: false })
	})

	it('ignores a value of another version, or one that is not an envelope', () => {
		storage.items['bunbu:settings'] = JSON.stringify({ version: storedVersion + 1, data: {} })
		storage.items['bunbu:last-run'] = '"nonsense"'
		storage.items['bunbu:high-scores'] = '{not json'
		expect(read('settings')).toBeUndefined()
		expect(read('last-run')).toBeUndefined()
		expect(read('high-scores')).toBeUndefined()
	})

	it('survives a full storage and a missing one', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined)
		vi.stubGlobal('localStorage', { ...storage, setItem: () => { throw new Error('quota') } })
		expect(() => { write('settings', {}) }).not.toThrow()

		vi.stubGlobal('localStorage', undefined)
		expect(() => { write('settings', {}) }).not.toThrow()
		expect(read('settings')).toBeUndefined()
	})
})

describe('parsing what was saved', () => {
	it('keeps the settings that are valid and drops the rest', () => {
		expect(parseSettings({ difficulty: 'master', haptics: 'yes', volume: 3 })).toEqual({ difficulty: 'master' })
		expect(parseSettings({ difficulty: 'toString' })).toEqual({})
		expect(parseSettings(undefined)).toEqual({})
	})

	it('keeps the high scores that are valid', () => {
		const good = { points: 300, seconds: 61.5, correct: 3, answered: 4 }
		expect(parseHighScores({ a: good, b: { ...good, points: -1 }, c: 'x' })).toEqual({ a: good })
		expect(parseHighScores([good])).toEqual({})
	})

	it('keeps the misses that are valid', () => {
		const miss = { at: { question: 1, part: 0 }, outcome: 'wrong', picked: [2, 0] }
		expect(parseLastRun({ quiz: { id: 'a', version: '1' }, misses: [miss, { ...miss, outcome: 'maybe' }, null] }))
			.toEqual({ quiz: { id: 'a', version: '1' }, misses: [miss] })
		expect(parseLastRun({ quiz: { id: 'a' }, misses: [] })).toBeUndefined()
	})

	it('validates the saved quiz files again', async () => {
		const entries = await parseLibrary([source, 'id: broken', 7])
		expect(entries).toHaveLength(1)
		expect(entries[0]?.quiz).toMatchObject({ id: 'saved', version: '1' })
	})
})

describe('persistApp', () => {
	it('puts back what was saved before the first screen', async () => {
		write('settings', { difficulty: 'master', haptics: false, volume: 0.2 })
		write('high-scores', { '["a","1"]': { points: 200, seconds: 30, correct: 2, answered: 2 } })
		write('last-run', { quiz: { id: 'a', version: '1' }, misses: [{ at: { question: 0, part: 0 }, outcome: 'unanswered', picked: [] }] })

		await persistApp(stop.signal)

		expect(settings.value).toMatchObject({ difficulty: 'master', haptics: false, volume: 0.2 })
		expect(highScores.value.of('a', '1')).toMatchObject({ points: 200 })
		expect(lastRun.value.missesOf('a', '1')).toHaveLength(1)
	})

	it('saves every change, and what it saved is what it puts back', async () => {
		await persistApp(stop.signal)
		settings.value.setDifficulty('novice')
		highScores.value.submit('a', '1', { points: 100, seconds: 9, correct: 1, answered: 1 })
		lastRun.value.save('a', '1', [{ at: { question: 2, part: 0 }, outcome: 'wrong', picked: [1] }])
		stop.abort()

		settings.value.reset()
		highScores.value.reset()
		lastRun.value.reset()
		await persistApp(session())

		expect(settings.value.difficulty).toBe('novice')
		expect(highScores.value.of('a', '1')).toMatchObject({ points: 100, seconds: 9 })
		expect(lastRun.value.missesOf('a', '1')).toEqual([{ at: { question: 2, part: 0 }, outcome: 'wrong', picked: [1] }])
	})

	it('keeps the best of what was saved and what was earned meanwhile', async () => {
		write('high-scores', { '["a","1"]': { points: 200, seconds: 30, correct: 2, answered: 2 } })
		highScores.value.submit('a', '1', { points: 300, seconds: 50, correct: 3, answered: 3 })
		highScores.value.submit('b', '1', { points: 100, seconds: 50, correct: 1, answered: 1 })
		await persistApp(stop.signal)
		expect(highScores.value.of('a', '1')).toMatchObject({ points: 300 })
		expect(highScores.value.of('b', '1')).toMatchObject({ points: 100 })
	})

	it('starts from the defaults when nothing was saved', async () => {
		await persistApp(stop.signal)
		expect(settings.value).toMatchObject({ difficulty: 'adept', haptics: true, volume: 0.8 })
		expect(lastRun.value.quiz).toBeUndefined()
	})

	it('keeps the loaded quizzes and brings them back validated', async () => {
		await persistApp(stop.signal)
		library.value.add(source, fixtureQuiz)
		expect(read('library')).toEqual([source])
		stop.abort()

		// A new session: nothing loaded yet, then the saved quiz is validated and comes back.
		library.value.remove('fixture', '1')
		expect(library.value.entries).toHaveLength(0)
		await persistApp(session())
		expect(library.value.entries).toHaveLength(1)
		expect(library.value.entries[0]?.quiz).toMatchObject({ id: 'saved', version: '1' })
	})
})
