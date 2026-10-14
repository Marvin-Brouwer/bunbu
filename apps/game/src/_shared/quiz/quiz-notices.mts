/**
 * What the player should know about a quiz on the select screen: why a file didn't load, which
 * questions a loaded file repeated, and which
 * questions of the chosen quiz won't play as written in a fight
 * ([more than 3 options](../../../../../docs/design/gameplay.md#more-than-3-options)).
 */

import { component, match } from '@rooted/components'
import type { FitNote, RepeatedQuestion } from './read-quiz.mts'
import styles from './quiz.css'

export type LoadProblemsOptions = {
	readonly file: string
	readonly problems: readonly string[]
}

/** Why a quiz file didn't load: one line per problem, with where in the file it is. */
export const LoadProblems = component<LoadProblemsOptions>({
	name: 'load-problems',
	styles,
	onMount({ append, element, options }) {
		append(
			element('div', {
				classes: styles.notice,
				'data-severity': 'problem',
				role: 'alert',
				children: [
					element('p', {
						classes: styles.noticeTitle,
						textContent: `${options.file} is not a quiz Bunbu can read`,
					}),
					element('ul', {
						children: options.problems.map((problem) => element('li', {
							classes: styles.issue,
							textContent: problem,
						})),
					}),
				],
			})
		)
	},
})

export type DuplicatesNoticeOptions = {
	readonly file: string
	readonly duplicates: readonly RepeatedQuestion[]
}

/** The questions a loaded file asked more than once, which the library keeps only once. */
export const DuplicatesNotice = component<DuplicatesNoticeOptions>({
	name: 'duplicates-notice',
	styles,
	onMount({ append, element, options }) {
		const { file, duplicates } = options
		append(
			element('div', {
				classes: styles.notice,
				'data-severity': 'warning',
				role: 'status',
				children: [
					element('p', {
						classes: styles.noticeTitle,
						textContent: duplicates.length === 1
							? `${file} repeats a question, so 1 copy was left out`
							: `${file} repeats questions, so ${duplicates.length} copies were left out`,
					}),
					element('ul', {
						children: duplicates.map((duplicate) => element('li', {
							classes: styles.issue,
							textContent: describeRepeat(duplicate),
						})),
					}),
				],
			})
		)
	},
})

/** A question's number and the line it starts on: `3 (line 40)`, or just `3` when the line isn't known. */
function numberAt(index: number, line: number | undefined): string {
	return line === undefined ? `${index + 1}` : `${index + 1} (line ${line})`
}

/** `Question 3 (line 40) is the same as question 1 (line 9).` */
function describeRepeat({ question, of, line, ofLine }: RepeatedQuestion): string {
	return `Question ${numberAt(question, line)} is the same as question ${numberAt(of, ofLine)}.`
}

export type FitNoticeOptions = {
	readonly notes: readonly FitNote[]
}

/** The questions that won't play as written in a fight. The same quiz still works in the dojo. */
export const FitNotice = component<FitNoticeOptions>({
	name: 'fit-notice',
	styles,
	onMount({ append, element, options }) {
		const { notes } = options
		if (notes.length === 0) return

		const unplayable = notes.some((note) => note.fit === 'unplayable')
		append(
			element('div', {
				classes: styles.notice,
				'data-severity': unplayable ? 'problem' : 'warning',
				role: 'status',
				children: [
					element('p', {
						classes: styles.noticeTitle,
						textContent: notes.length === 1
							? '1 question won\'t play as written in a fight'
							: `${notes.length} questions won't play as written in a fight`,
					}),
					element('ul', {
						children: notes.map((note) => element('li', {
							textContent: `Question ${note.question + 1}: ${match(note.fit, {
								'one-option': 'it has only one option to choose, so it gives the answer away.',
								truncated: 'it has more than 8 options, so each fight leaves out some wrong ones at random.',
								unplayable: 'it has more than 8 right answers, which no fight can ask.',
							})}`,
						})),
					}),
					unplayable
						? element('p', {
							classes: styles.noticeTitle,
							textContent: 'Fix those to fight with this quiz. The dojo can still study it.',
						})
						: undefined,
				],
			})
		)
	},
})
