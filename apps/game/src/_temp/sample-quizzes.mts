/**
 * The fixture quiz and the sample quizzes in `docs/testdata/`, your own in `local/` too, for the
 * quizzes menu in dev builds: every one there to choose without loading it by hand. Choosing one
 * adds it to the library, as loading its file would, so it is still chosen after a reload. They are
 * validated like a loaded file; one that isn't valid is left out with a warning in the console.
 */

import { BunbuValidationError, compress, validate, type BunbuData } from '@bunbu/data'
import { Immutable } from '@rooted/store'
import type { LibraryEntry } from '../_shared/storage/library.mts'
import { fixtureQuiz } from './quiz.mts'

const sources = import.meta.glob<string>('../../../../docs/testdata/**/*.yaml', {
	query: '?raw',
	import: 'default',
	eager: true,
})

async function sampleOf(path: string, source: string): Promise<BunbuData | undefined> {
	const quiz = await validate(source)
	if (!(quiz instanceof BunbuValidationError)) return quiz
	console.warn(`[bunbu] sample quiz ${path} left out`, quiz.issues)
	return undefined
}

export async function sampleQuizzes(): Promise<LibraryEntry[]> {
	const read = await Promise.all(Object.entries(sources).map(([path, source]) => sampleOf(path, source)))
	const quizzes = [fixtureQuiz, ...read.filter((quiz) => quiz !== undefined)]
	return Promise.all(quizzes.map(async (quiz) => ({ quiz, file: Immutable.from(await compress(quiz)) })))
}
