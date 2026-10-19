import { compress, validate, type BunbuData } from '@bunbu/data'
import { Immutable } from '@rooted/store'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { quizDifficulties } from '../../fight/state/difficulty.mts'
import { highScores } from '../../fight/state/highscores.mts'
import { stageResults } from '../../fight/state/stage-results.mts'
import { lastRun } from '../../fight/state/lastrun.mts'
import { settings } from '../../settings/state/settings.mts'
import { selection } from '../state/selection.mts'
import { library } from './library.mts'
import { parseAgreements, parseDifficulties, parseHighScores, parseLastRun, parseStageResults, parseLibrary, parseSelection, parseSettings, persistApp } from './persistence.mts'
import { readQuizFiles, writeQuizFiles } from './quiz-files.mts'
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
	'# yaml-language-server: $schema=https://marvin-brouwer.github.io/bunbu/schema/v1.json',
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

let savedQuiz: BunbuData
let savedFile: Uint8Array

/** The quiz `saved` with another title, and its `.bunbu` file. */
async function savedAs(title: string) {
	const quiz = { ...savedQuiz, title }
	return { quiz, file: Immutable.from(await compress(quiz)) }
}

beforeAll(async () => {
	const quiz = await validate(source)
	if (!('questions' in quiz)) throw new Error('the saved quiz should be valid')
	savedQuiz = quiz
	savedFile = await compress(quiz)
})

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
	vi.stubGlobal('indexedDB', new IDBFactory())
	stop = new AbortController()
	settings.value.reset()
	quizDifficulties.value.reset()
	highScores.value.reset()
	lastRun.value.reset()
	stageResults.value.reset()
	library.value.reset()
	selection.value.reset()
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
	it('keeps the difficulties that are valid and drops the rest', () => {
		expect(parseDifficulties({ '["a","1"]': 'shogun', '["b","1"]': 'novice', '["c","1"]': 'toString' })).toEqual({ '["a","1"]': 'shogun' })
		expect(parseDifficulties('shogun')).toEqual({})
	})

	it('keeps the terms agreements that are valid and drops the rest', () => {
		const agreed = { content: 'abc', terms: 'written', termsVersion: 1 }
		expect(parseAgreements({ '["a","1"]': agreed, '["b","1"]': { ...agreed, terms: 'stolen' }, '["c","1"]': { content: 'abc' } })).toEqual({ '["a","1"]': agreed })
		expect(parseAgreements('yes')).toEqual({})
	})

	it('keeps the settings that are valid and drops the rest', () => {
		expect(parseSettings({ haptics: false, volume: 3 })).toEqual({ haptics: false })
		expect(parseSettings({ difficulty: 'shogun' })).toEqual({})
		expect(parseSettings({ toString: 'nonsense' })).toEqual({})
		expect(parseSettings(undefined)).toEqual({})
		expect(parseSettings({ speechRate: 2.5, voices: { en: 'daniel' } })).toEqual({ speechRate: 2.5, voices: { en: 'daniel' } })
		expect(parseSettings({ speechRate: 1.25, voices: { en: 3 } })).toEqual({})
	})

	it('keeps the high scores that are valid', () => {
		const good = { points: 300, seconds: 61.5, correct: 3, answered: 4, difficulty: 'samurai' }
		expect(parseHighScores({ a: good, b: { ...good, points: -1 }, c: 'x' })).toEqual({ a: good })
		expect(parseHighScores([good])).toEqual({})
		expect(parseHighScores({ a: { ...good, seconds: 0 } })).toEqual({})
		expect(parseHighScores({ a: { ...good, seconds: Infinity } })).toEqual({})
		expect(parseHighScores({ a: { ...good, difficulty: 'ronin' } })).toEqual({})
	})

	it('keeps the stage results that are valid', () => {
		const good = { distance: 360, cleared: false }

		const parsed = parseStageResults({ a: good, b: { ...good, distance: -1 }, c: { distance: 10 }, d: 'x' })

		expect(parsed).toEqual({ a: good })
	})

	it('keeps whether a stage result unlocks the next stage, and on Shogun', () => {
		const kept = { distance: 480, cleared: true, opens: false, shogun: true }

		expect(parseStageResults({ a: kept })).toEqual({ a: kept })
	})

	it('keeps the misses that are valid', () => {
		const miss = { at: { question: 1, part: 0 }, outcome: 'wrong', picked: [2, 0] }
		expect(parseLastRun({ quiz: { id: 'a', version: '1' }, misses: [miss, { ...miss, outcome: 'maybe' }, null] }))
			.toEqual({ quiz: { id: 'a', version: '1' }, misses: [miss] })
		expect(parseLastRun({ quiz: { id: 'a', version: '1' }, misses: [{ ...miss, outcome: 'correct' }] }))
			.toEqual({ quiz: { id: 'a', version: '1' }, misses: [] })
		expect(parseLastRun({ quiz: { id: 'a' }, misses: [] })).toBeUndefined()
	})

	it('keeps the chosen quiz and a stage that can still be chosen', () => {
		expect(parseSelection({ quiz: { id: 'a', version: '1' }, stage: 'castle-town' })).toEqual({ quiz: { id: 'a', version: '1' }, stage: 'castle-town', endless: false })
		expect(parseSelection({ stage: 'rice-fields' })).toEqual({ quiz: undefined, stage: 'rice-fields', endless: false })
		expect(parseSelection({ stage: 'edo-castle', endless: true })).toEqual({ quiz: undefined, stage: 'edo-castle', endless: true })
		expect(parseSelection({ stage: 'moon' })).toEqual({ quiz: undefined, stage: undefined, endless: false })
	})

	it('validates the saved quiz files again', async () => {
		const entries = await parseLibrary([savedFile, new Uint8Array([1, 2, 3])])
		expect(entries).toHaveLength(1)
		expect(entries[0]?.quiz).toMatchObject({ id: 'saved', version: '1' })
		expect(entries[0]?.file.value).toBe(savedFile)
	})
})

describe('persistApp', () => {
	it('puts back what was saved before the first screen', async () => {
		write('settings', { haptics: false, volume: 0.2 })
		write('difficulties', { '["a","1"]': 'shogun' })
		write('high-scores', { '["a","1"]': { points: 200, seconds: 30, correct: 2, answered: 2, difficulty: 'samurai' } })
		write('last-run', { quiz: { id: 'a', version: '1' }, misses: [{ at: { question: 0, part: 0 }, outcome: 'unanswered', picked: [] }] })

		await persistApp(stop.signal)

		expect(settings.value).toMatchObject({ haptics: false, volume: 0.2 })
		expect(quizDifficulties.value.of('a', '1')).toBe('shogun')
		expect(highScores.value.of('a', '1')).toMatchObject({ points: 200 })
		expect(lastRun.value.missesOf('a', '1')).toHaveLength(1)
	})

	it('tells when the saved quizzes are back, even when there are none', async () => {
		const restoring = persistApp(stop.signal)
		expect(library.value.restored).toBe(false)

		await restoring

		expect(library.value.restored).toBe(true)
	})

	it('saves every change, and what it saved is what it puts back', async () => {
		await persistApp(stop.signal)
		quizDifficulties.value.choose('a', '1', 'apprentice')
		highScores.value.submit('a', '1', { points: 100, seconds: 9, correct: 1, answered: 1, difficulty: 'samurai' })
		lastRun.value.save('a', '1', [{ at: { question: 2, part: 0 }, outcome: 'wrong', picked: [1] }])
		stageResults.value.submit('a', '1', 'castle-town', { distance: 240, cleared: false })
		stop.abort()

		quizDifficulties.value.reset()
		highScores.value.reset()
		lastRun.value.reset()
		stageResults.value.reset()
		await persistApp(session())

		expect(quizDifficulties.value.of('a', '1')).toBe('apprentice')
		expect(highScores.value.of('a', '1')).toMatchObject({ points: 100, seconds: 9 })
		expect(lastRun.value.missesOf('a', '1')).toEqual([{ at: { question: 2, part: 0 }, outcome: 'wrong', picked: [1] }])
		expect(stageResults.value.of('a', '1', 'castle-town')).toEqual({ distance: 240, cleared: false, opens: false })
	})

	it('keeps the best of what was saved and what was earned meanwhile', async () => {
		write('high-scores', { '["a","1"]': { points: 200, seconds: 30, correct: 2, answered: 2, difficulty: 'samurai' } })
		highScores.value.submit('a', '1', { points: 300, seconds: 50, correct: 3, answered: 3, difficulty: 'samurai' })
		highScores.value.submit('b', '1', { points: 100, seconds: 50, correct: 1, answered: 1, difficulty: 'samurai' })
		await persistApp(stop.signal)
		expect(highScores.value.of('a', '1')).toMatchObject({ points: 300 })
		expect(highScores.value.of('b', '1')).toMatchObject({ points: 100 })
	})

	it('keeps a quiz loaded while the saved ones are still being validated', async () => {
		await writeQuizFiles([savedFile])
		const loading = persistApp(stop.signal)
		const newer = await savedAs('Newer')
		library.value.add(newer)
		await loading
		expect(library.value.entries).toHaveLength(1)
		expect(library.value.entries[0]?.quiz.title).toBe('Newer')
		expect(library.value.entries[0]?.file).toBe(newer.file)
	})

	it('does not bring back a quiz that was removed while the saved ones were validated', async () => {
		await writeQuizFiles([savedFile])
		const loading = persistApp(stop.signal)
		library.value.add(await savedAs('Newer'))
		library.value.remove('saved', '1')
		await loading
		expect(library.value.entries).toHaveLength(0)
	})

	it('keeps one saved quiz per id and version, the last', async () => {
		const [first, last] = await Promise.all([savedAs('First'), savedAs('Last')])
		await writeQuizFiles([first.file.value, last.file.value])
		await persistApp(stop.signal)
		expect(library.value.entries).toHaveLength(1)
		expect(library.value.entries[0]?.quiz.title).toBe('Last')
	})

	it('starts from the defaults when nothing was saved', async () => {
		await persistApp(stop.signal)
		expect(settings.value).toMatchObject({ haptics: true, volume: 0.8 })
		expect(quizDifficulties.value.of('a', '1')).toBe('samurai')
		expect(lastRun.value.quiz).toBeUndefined()
	})

	it('keeps the loaded quizzes and brings them back validated', async () => {
		await persistApp(stop.signal)
		library.value.add({ quiz: savedQuiz, file: Immutable.from(savedFile) })
		await vi.waitFor(async () => { expect(await readQuizFiles()).toEqual([savedFile]) })
		stop.abort()

		// A new session: nothing loaded yet, then the saved quiz is validated and comes back.
		library.value.reset()
		await persistApp(session())
		expect(library.value.entries).toHaveLength(1)
		expect(library.value.entries[0]?.quiz).toMatchObject({ id: 'saved', version: '1' })
		expect(library.value.entries[0]?.file.value).toEqual(savedFile)
	})

	it('chooses the saved quiz and stage again once the library has the quiz', async () => {
		await writeQuizFiles([savedFile])
		write('selection', { quiz: { id: 'saved', version: '1' }, stage: 'castle-town' })

		await persistApp(stop.signal)

		expect(selection.value.stage).toBe('castle-town')
		expect(selection.value.quiz).toMatchObject({ id: 'saved', version: '1' })
	})

	it('saves the chosen quiz by id and version', async () => {
		await persistApp(stop.signal)
		selection.value.chooseQuiz(savedQuiz)
		expect(read('selection')).toEqual({ quiz: { id: 'saved', version: '1' }, stage: 'rice-fields', endless: false })
	})

	it('forgets the chosen quiz when it is removed, and leaves another chosen one be', async () => {
		await persistApp(stop.signal)
		selection.value.chooseQuiz(savedQuiz)

		selection.value.forgetQuiz('other', '1')
		const kept = selection.value.quiz
		selection.value.forgetQuiz('saved', '1')

		expect(kept).toMatchObject({ id: 'saved' })
		expect(read('selection')).toEqual({ stage: 'rice-fields', endless: false })
	})

	it('keeps a quiz chosen while the saved ones are still being validated', async () => {
		await writeQuizFiles([savedFile])
		write('selection', { quiz: { id: 'saved', version: '1' }, stage: 'castle-town' })
		const loading = persistApp(stop.signal)
		const other = await savedAs('Other')
		selection.value.chooseQuiz({ ...other.quiz, id: 'other' })
		await loading
		expect(selection.value.quiz).toMatchObject({ id: 'other' })
	})

	it('chooses no quiz when the saved one is no longer loaded', async () => {
		write('selection', { quiz: { id: 'gone', version: '1' }, stage: 'castle-town' })
		await persistApp(stop.signal)
		expect(selection.value.quiz).toBeUndefined()
	})
})
