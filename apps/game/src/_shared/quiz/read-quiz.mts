/**
 * Reading a quiz file the player loads on the quizzes screen: a `.yaml` file through `validate`, a
 * shared `.bunbu` file through `uncompress`. Either way the library keeps it as a `.bunbu` file. Both are untrusted input, so what goes wrong comes
 * back as problems to show the player, not as an error. Any other file, such as a picture, is turned
 * away before it is read as a quiz.
 */

import {
	BunbuShareError,
	BunbuValidationError,
	compress,
	fileExtension,
	mimeType,
	uncompress,
	validate,
	type BunbuData,
	type ValidationIssue,
} from '@bunbu/data'
import { Immutable } from '@rooted/store'
import { fitOf, type Fit } from '../state/ambush-opening.mts'

export type ReadQuiz =
	| {
		readonly quiz: BunbuData
		/** The quiz as a `.bunbu` file, which the library keeps and validates again when the app starts. */
		readonly file: Immutable<Uint8Array>
	}
	| {
		/** What is wrong with the file, one line each. */
		readonly problems: readonly string[]
	}

/** An issue as the player reads it: where in the file, and what is wrong there. */
export function describeIssue(issue: ValidationIssue): string {
	if (issue.line !== undefined) return `Line ${issue.line}: ${issue.message}`
	if (issue.path !== '') return `${issue.path}: ${issue.message}`
	return issue.message
}

/** The file names a quiz can have. */
export const quizExtensions = ['.yaml', '.yml', fileExtension] as const

/**
 * What the file picker offers: the quiz extensions, and their media types for phones that pick by
 * media type.
 */
export const quizFileTypes = [...quizExtensions, mimeType, 'application/yaml', 'application/x-yaml', 'text/yaml', 'text/x-yaml'].join(',')

const notAQuiz = 'This is not a quiz. A quiz is a .yaml or .bunbu file.'
const aPicture = 'This is a picture, not a quiz. A quiz is a .yaml or .bunbu file.'

const ascii = (text: string) => new TextEncoder().encode(text)

/** The bytes the picture formats a phone or camera saves start with, and where in the file. */
const pictureStarts: readonly (readonly { readonly at: number, readonly bytes: ArrayLike<number> }[])[] = [
	// PNG
	[{ at: 0, bytes: [0x89, 0x50, 0x4E, 0x47] }],
	// JPEG
	[{ at: 0, bytes: [0xFF, 0xD8, 0xFF] }],
	// GIF
	[{ at: 0, bytes: ascii('GIF8') }],
	// BMP
	[{ at: 0, bytes: ascii('BM') }],
	// WebP: a RIFF file of the WEBP kind
	[{ at: 0, bytes: ascii('RIFF') }, { at: 8, bytes: ascii('WEBP') }],
	// HEIC and AVIF, as iPhones and newer Androids save them
	...['heic', 'heix', 'mif1', 'avif'].map((brand) => [{ at: 4, bytes: ascii('ftyp') }, { at: 8, bytes: ascii(brand) }]),
]

/** Whether the file is a picture, by its media type or else by how it starts. */
async function isPicture(file: File): Promise<boolean> {
	if (file.type.startsWith('image/')) return true
	const start = new Uint8Array(await file.slice(0, 12).arrayBuffer())
	return pictureStarts.some((parts) => parts.every(({ at, bytes }) => Array.from(bytes).every((byte, index) => start[at + index] === byte)))
}

/** The text of the file, or `undefined` when it holds something else, such as a renamed picture. */
async function textOf(file: File): Promise<string | undefined> {
	try {
		const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
		return text.includes('\u0000') ? undefined : text
	} catch {
		return undefined
	}
}

export async function readQuiz(file: File): Promise<ReadQuiz> {
	if (await isPicture(file)) return { problems: [aPicture] }

	const name = file.name.toLowerCase()
	if (!quizExtensions.some((extension) => name.endsWith(extension))) return { problems: [notAQuiz] }

	if (name.endsWith(fileExtension)) {
		try {
			const bytes = new Uint8Array(await file.arrayBuffer())
			return { quiz: await uncompress(bytes), file: Immutable.from(bytes) }
		} catch (error) {
			if (error instanceof BunbuValidationError) return { problems: error.issues.map(describeIssue) }
			if (error instanceof BunbuShareError) return { problems: [error.message] }
			throw error
		}
	}

	const source = await textOf(file)
	if (source === undefined) return { problems: [notAQuiz] }
	const quiz = await validate(source)
	if (quiz instanceof BunbuValidationError) return { problems: quiz.issues.map(describeIssue) }
	// Kept as a `.bunbu` file: smaller, and the same bytes a share sends on.
	return { quiz, file: Immutable.from(await compress(quiz)) }
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
