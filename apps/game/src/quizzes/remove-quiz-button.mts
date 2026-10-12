/**
 * **Remove** on a quiz card. It asks first, on a scroll with Remove and Cancel, so a slip doesn't
 * throw a quiz away.
 */

import type { BunbuData } from '@bunbu/data'
import { component } from '@rooted/components'
import { MenuButton } from '../_shared/menu/menu-button.mts'
import { ScrollDialog } from '../_shared/scroll/scroll-dialog.mts'
import styles from './quiz-shelf.css'

export type RemoveQuizButtonOptions = {
	readonly quiz: BunbuData
	readonly remove: () => void
}

export const RemoveQuizButton = component<RemoveQuizButtonOptions>({
	name: 'remove-quiz-button',
	styles,
	onMount({ append, create, element, options }) {
		const { quiz } = options

		const ask = () => {
			const scroll: Element = create(ScrollDialog, {
				title: 'Remove this quiz?',
				closed: () => {
					scroll.remove()
				},
				children: element('p', {
					textContent: `${quiz.title} comes off your quizzes. Its high score stays, for if you load it again.`,
				}),
				footer: (close) => [
					create(MenuButton, {
						kind: 'primary',
						label: 'Remove',
						action: () => {
							close()
							options.remove()
						},
					}),
					create(MenuButton, {
						label: 'Cancel',
						action: close,
					}),
				],
			})
			append(
				scroll
			)
		}

		append(
			element('button', {
				type: 'button',
				classes: styles.cardAction,
				textContent: 'Remove',
				aria: {
					label: `Remove ${quiz.title}`,
				},
				on: {
					click: ask,
				},
			})
		)
	},
})
