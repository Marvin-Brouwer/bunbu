/**
 * Reading a quiz file the player loads on the select screen: a `.yaml` file through `validate`, a
 * shared `.bunbu` file through `uncompress`. Both are untrusted input, so what goes wrong comes
 * back as problems to show the player, not as an error.
 */

import {
	BunbuShareError,
	BunbuValidationError,
	fileExtension,
	uncompress,
	validate,
	type BunbuData,
	type ValidationIssue,
} from '@bunbu/data'
import { fitOf, type Fit } from '../state/ambush-opening.mts'

export type ReadQuiz =
	| {
		readonly quiz: BunbuData
		/** The quiz as YAML, which the library keeps and validates again when the app starts. */
		readonly source: string
	}
	| {
		/** What is wrong with the file, one line each. */
		readonly problems: readonly string[]
	}

/** The schema line every quiz file starts with ([data format](../../../../../docs/design/data-format.md)). */
const schemaLine = '# yaml-language-server: $schema=https://raw.githubusercontent.com/Marvin-Brouwer/bunbu/main/schema/v1.json'

/** An issue as the player reads it: where in the file, and what is wrong there. */
export function describeIssue(issue: ValidationIssue): string {
	if (issue.line !== undefined) return `Line ${issue.line}: ${issue.message}`
	if (issue.path !== '') return `${issue.path}: ${issue.message}`
	return issue.message
}

/**
 * A quiz as a YAML source the library can keep. JSON is YAML, so a quiz from a `.bunbu` file only
 * needs the schema line in front of it to be read back by `validate`.
 */
export function sourceOf(quiz: BunbuData): string {
	return `${schemaLine}\n${JSON.stringify(quiz)}\n`
}

export async function readQuiz(file: File): Promise<ReadQuiz> {
	if (file.name.toLowerCase().endsWith(fileExtension)) {
		try {
			const quiz = await uncompress(file)
			return { quiz, source: sourceOf(quiz) }
		} catch (error) {
			if (error instanceof BunbuValidationError) return { problems: error.issues.map(describeIssue) }
			if (error instanceof BunbuShareError) return { problems: [error.message] }
			throw error
		}
	}

	const source = await file.text()
	const quiz = await validate(source)
	if (quiz instanceof BunbuValidationError) return { problems: quiz.issues.map(describeIssue) }
	return { quiz, source }
}

/** A question that won't play as written in a fight, by its place in the file (from `0`). */
export type FitNote = {
	readonly question: number
	readonly fit: Exclude<Fit, 'fits'>
}

/**
 * The questions of a quiz that won't play as written in a fight
 * ([more than 3 options](../../../../../docs/design/gameplay.md#more-than-3-options)). The same
 * quiz still works in the dojo.
 */
export function fitNotesOf(quiz: BunbuData): FitNote[] {
	return quiz.questions.flatMap((question, index) => {
		const fit = fitOf(question)
		return fit === 'fits' ? [] : [{ question: index, fit }]
	})
}

/** Whether a fight can ask every question of the quiz. */
export function fightable(quiz: BunbuData): boolean {
	return fitNotesOf(quiz).every((note) => note.fit !== 'unplayable')
}
