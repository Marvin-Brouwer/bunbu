import type { BunbuData, Question } from './types'

/** A question that asks the same as an earlier one, both by their place in the file (from `0`). */
export type DuplicateQuestion = {
	question: number
	/** The earlier question it repeats. */
	of: number
}

/**
 * The questions that repeat an earlier question. `source` is left out of the comparison: the same
 * question can come from more than one place. Everything else must match.
 */
export function duplicateQuestions(quiz: BunbuData): DuplicateQuestion[] {
	const firsts = new Map<string, number>()
	const duplicates: DuplicateQuestion[] = []
	quiz.questions.forEach((question, index) => {
		const key = keyOf(question)
		const first = firsts.get(key)
		if (first === undefined) firsts.set(key, index)
		else duplicates.push({ question: index, of: first })
	})
	return duplicates
}

/** The quiz without the questions that repeat an earlier one ({@link duplicateQuestions}). */
export function withoutDuplicates(quiz: BunbuData): BunbuData {
	const duplicates = new Set(duplicateQuestions(quiz).map(({ question }) => question))
	if (duplicates.size === 0) return quiz
	return { ...quiz, questions: quiz.questions.filter((_, index) => !duplicates.has(index)) }
}

function keyOf({ source: _source, ...question }: Question): string {
	return JSON.stringify(question, (_key, value: unknown) => sorted(value))
}

/** Objects with their keys in order, so two copies written in a different order still match. */
function sorted(value: unknown): unknown {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return value
	return Object.fromEntries(Object.entries(value).toSorted(([one], [other]) => one.localeCompare(other)))
}
