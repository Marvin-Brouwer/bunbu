import { compress, uncompress, type BunbuData, type Markdown } from '@bunbu/data'
import { describe, expect, it } from 'vitest'
import { fixtureQuiz } from '../../_temp/quiz.mts'
import { describeIssue, fightable, fitNotesOf, readQuiz } from './read-quiz.mts'

const sample = import.meta.glob<string>('../../../../../docs/testdata/every-type.yaml', { query: '?raw', import: 'default', eager: true })
const everyType = Object.values(sample)[0]!

const file = (contents: string | Uint8Array, name: string) => new File([typeof contents === 'string' ? contents : new Uint8Array(contents)], name)

const options = (correct: number, wrong: number) => [
	...Array.from({ length: correct }, (_, index) => ({ answer: `right ${index}` as Markdown, correct: true })),
	...Array.from({ length: wrong }, (_, index) => ({ answer: `wrong ${index}` as Markdown, correct: false })),
]

describe('readQuiz', () => {
	it('reads a .yaml quiz and packs it as a .bunbu file', async () => {
		const result = await readQuiz(file(everyType, 'every-type.yaml'))
		if (!('quiz' in result)) expect.unreachable(result.problems.join('\n'))
		expect(result.quiz.id).toBe('every-type')
		// The file leaves out the built-in pronunciations, and reading it puts them all back.
		expect(await uncompress(result.file.value)).toEqual({ ...result.quiz, pronunciations: expect.objectContaining(result.quiz.pronunciations) })
	})

	it('lists what is wrong with an invalid .yaml quiz, by line', async () => {
		const broken = everyType.replace('passingScore: 70', 'passingScore: lots')
		const result = await readQuiz(file(broken, 'broken.yaml'))
		if (!('problems' in result)) expect.unreachable('read an invalid quiz')
		expect(result.problems.some((problem) => /^Line \d+: /.test(problem))).toBe(true)
	})

	it('says a file without the schema line is not a quiz', async () => {
		const result = await readQuiz(file('title: hello', 'notes.yaml'))
		expect(result).toEqual({ problems: [expect.stringContaining('first line must reference the schema')] })
	})

	it('reads a .bunbu quiz and keeps the file as it was', async () => {
		const bytes = await compress(fixtureQuiz)
		const result = await readQuiz(file(bytes, 'fixture.bunbu'))
		if (!('quiz' in result)) expect.unreachable(result.problems.join('\n'))
		expect(result.quiz.title).toBe(fixtureQuiz.title)
		expect(result.file.value).toEqual(new Uint8Array(bytes))
	})

	it('explains a damaged .bunbu file', async () => {
		const result = await readQuiz(file(new Uint8Array([1, 2, 3, 4]), 'damaged.BUNBU'))
		if (!('problems' in result)) expect.unreachable('read a damaged file')
		expect(result.problems).toHaveLength(1)
	})
})

describe('describeIssue', () => {
	it('says where in the file, by line or else by path', () => {
		expect(describeIssue({ path: '/title', message: 'must be a string', line: 7 })).toBe('Line 7: must be a string')
		expect(describeIssue({ path: '/title', message: 'must be a string' })).toBe('/title: must be a string')
		expect(describeIssue({ path: '', message: 'empty file' })).toBe('empty file')
	})
})

describe('fitNotesOf', () => {
	const quiz = (questions: BunbuData['questions']): BunbuData => ({ ...fixtureQuiz, questions })

	it('has nothing to say about a quiz that fits', () => {
		expect(fitNotesOf(fixtureQuiz)).toEqual([])
		expect(fightable(fixtureQuiz)).toBe(true)
	})

	it('notes truncated and unplayable questions by their place in the file', () => {
		const notes = fitNotesOf(quiz([
			{ type: 'single', query: 'fits' as Markdown, options: options(1, 3) },
			{ type: 'multiple', query: 'truncated' as Markdown, options: options(2, 8) },
			{ type: 'multiple', query: 'unplayable' as Markdown, options: options(9, 1) },
		]))
		expect(notes).toEqual([
			{ question: 1, fit: 'truncated' },
			{ question: 2, fit: 'unplayable' },
		])
	})

	it('only lets a fight start when no question is unplayable', () => {
		const truncated = quiz([{ type: 'multiple', query: 'truncated' as Markdown, options: options(2, 8) }])
		const unplayable = quiz([{ type: 'multiple', query: 'unplayable' as Markdown, options: options(9, 1) }])
		expect(fightable(truncated)).toBe(true)
		expect(fightable(unplayable)).toBe(false)
	})
})
