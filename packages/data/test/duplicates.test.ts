import { afterEach, describe, expect, it, vi } from 'vitest'
import { duplicateQuestions, questionLines, validate, withoutDuplicates, type BunbuData, type Markdown, type Question } from '../src'

const modeline = '# yaml-language-server: $schema=https://marvin-brouwer.github.io/bunbu/schema/v1.json'

const sql: Question = {
	type: 'single',
	query: 'Which is a query language?' as Markdown,
	options: [
		{ answer: 'SQL' as Markdown, correct: true },
		{ answer: 'HTML' as Markdown, correct: false },
	],
}
const sky: Question = { type: 'yes-no', query: 'Is the sky blue?' as Markdown, answer: 'yes' }

const quizOf = (...questions: Question[]): BunbuData => ({
	id: 'test',
	title: 'Test',
	version: '1',
	language: 'en',
	passingScore: 70,
	questions,
})

describe('duplicateQuestions', () => {
	it('finds a question that repeats an earlier one', () => {
		expect(duplicateQuestions(quizOf(sql, sky, sql, sql))).toEqual([
			{ question: 2, of: 0 },
			{ question: 3, of: 0 },
		])
	})

	it('leaves the source out of the comparison', () => {
		const fromBook = { ...sql, source: [{ Book: 'https://example.com/book' }] }
		const fromCourse = { ...sql, source: [{ Course: 'https://example.com/course' }] }
		expect(duplicateQuestions(quizOf(fromBook, fromCourse))).toEqual([{ question: 1, of: 0 }])
	})

	it('matches copies written with their keys in another order', () => {
		const reordered = {
			options: sql.options.map(({ correct, answer }) => ({ correct, answer })),
			query: sql.query,
			type: sql.type,
		} as Question
		expect(duplicateQuestions(quizOf(sql, reordered))).toEqual([{ question: 1, of: 0 }])
	})

	it('keeps questions that differ anywhere else', () => {
		const otherAnswer = { ...sky, answer: 'no' } as Question
		const explained = { ...sky, explanation: 'Mostly.' as Markdown }
		expect(duplicateQuestions(quizOf(sky, otherAnswer, explained))).toEqual([])
	})

	it('keeps questions with different application metadata so grouping is not lost on import', () => {
		const first = { ...sky, metadata: { anotherApp: { group: 'one' } } }
		const second = { ...sky, metadata: { anotherApp: { group: 'two' } } }
		expect(withoutDuplicates(quizOf(first, second)).questions).toEqual([first, second])
	})
})

describe('withoutDuplicates', () => {
	it('keeps the first of each question', () => {
		expect(withoutDuplicates(quizOf(sql, sky, sql, sky)).questions).toEqual([sql, sky])
	})

	it('gives back the same quiz when nothing repeats', () => {
		const quiz = quizOf(sql, sky)
		expect(withoutDuplicates(quiz)).toBe(quiz)
	})
})

describe('validate', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	const yesNo = `  - type: yes-no\n    query: Is the sky blue?\n    answer: yes\n`
	const file = `${modeline}\n\nid: test\ntitle: Test\nversion: 1\nlanguage: en\npassingScore: 70\nquestions:\n${yesNo}${yesNo}`

	it('warns about repeated questions, by line, and still accepts the quiz', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
		const result = await validate(file)
		expect(result).not.toBeInstanceOf(Error)
		expect((result as BunbuData).questions).toHaveLength(2)
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('question 2 (line 12) repeats question 1 (line 9)'))
	})
})

describe('questionLines', () => {
	it('gives the line each question starts on', () => {
		const file = `${modeline}\n\nid: test\ntitle: Test\nversion: 1\nlanguage: en\npassingScore: 70\nquestions:\n  - type: yes-no\n    query: One?\n    answer: yes\n  - type: yes-no\n    query: Two?\n    answer: no\n`
		expect(questionLines(file)).toEqual([9, 12])
	})
})
