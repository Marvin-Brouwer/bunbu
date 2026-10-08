/**
 * The sample quizzes are the content every track develops against, so they have to stay valid
 * against `@bunbu/data`.
 */

import { describe, expect, it } from 'vitest'
import { validate } from '@bunbu/data'

const quizzes = import.meta.glob<string>('../../../docs/testdata/*.yaml', { query: '?raw', import: 'default', eager: true })

describe('sample quizzes', () => {
	it('finds the sample quizzes', () => {
		expect(Object.keys(quizzes).length).toBeGreaterThan(0)
	})

	it.for(Object.entries(quizzes))('%s is valid', async ([, yaml]) => {
		const result = await validate(yaml)
		if (result instanceof Error) expect.unreachable(result.message)
		expect(result.questions.length).toBeGreaterThan(0)
	})

	it('covers every question type', async () => {
		const types = new Set<string>()
		for (const yaml of Object.values(quizzes)) {
			const result = await validate(yaml)
			if (result instanceof Error) continue
			for (const question of result.questions) types.add(question.type)
		}
		expect([...types].toSorted()).toEqual(['match', 'multiple', 'order', 'single', 'solutions', 'yes-no'])
	})

	it('covers 2 to 8 options', async () => {
		const counts = new Set<number>()
		for (const yaml of Object.values(quizzes)) {
			const result = await validate(yaml)
			if (result instanceof Error) continue
			for (const question of result.questions) {
				if ('options' in question) counts.add(question.options.length)
			}
		}
		expect(Math.min(...counts)).toBe(2)
		expect(Math.max(...counts)).toBe(8)
	})
})
