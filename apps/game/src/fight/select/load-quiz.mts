/**
 * The last card on the quiz shelf: **Load quiz** opens a `.yaml` or `.bunbu` file. What comes of it
 * goes to `read`, which the shelf turns into a new card or into the problems with the file.
 */

import { fileExtension } from '@bunbu/data'
import { component } from '@rooted/components'
import { readQuiz, type ReadQuiz } from './read-quiz.mts'
import styles from './select.css'

export type LoadQuizOptions = {
	readonly read: (file: File, result: ReadQuiz) => void
}

export const LoadQuiz = component<LoadQuizOptions>({
	name: 'load-quiz',
	styles,
	onMount({ append, element, options }) {
		append(
			element('label', {
				classes: [
					styles.card,
					styles.load,
				],
				children: [
					element('input', {
						type: 'file',
						accept: `.yaml,.yml,${fileExtension}`,
						on: {
							async change(event) {
								const input = event.currentTarget
								const file = input.files?.[0]
								// The same file can be loaded again after it is fixed.
								input.value = ''
								if (file !== undefined) options.read(file, await readQuiz(file))
							},
						},
					}),
					element('span', {
						classes: styles.cardTitle,
						textContent: '+ Load quiz',
					}),
					element('span', {
						classes: styles.cardNote,
						textContent: `.yaml or ${fileExtension}`,
					}),
				],
			})
		)
	},
})
