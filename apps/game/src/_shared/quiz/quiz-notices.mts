/**
 * What the player should know about a quiz on the select screen: why a file didn't load, and which
 * questions of the chosen quiz won't play as written in a fight
 * ([more than 3 options](../../../../../docs/design/gameplay.md#more-than-3-options)).
 */

import { component, match } from '@rooted/components'
import type { FitNote } from './read-quiz.mts'
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
