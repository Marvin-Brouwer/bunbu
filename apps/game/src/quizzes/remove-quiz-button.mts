/**
 * **Remove** on a quiz card. The first tap only asks, "Tap again to remove", so a slip doesn't
 * throw a quiz away; moving on to anything else takes the question back.
 */

import { component } from '@rooted/components'
import styles from './quiz-shelf.css'

export type RemoveQuizButtonOptions = {
	/** The quiz's title, for screen readers: the button only says Remove. */
	readonly title: string
	readonly remove: () => void
}

export const RemoveQuizButton = component<RemoveQuizButtonOptions>({
	name: 'remove-quiz-button',
	styles,
	onMount({ append, element, options }) {
		let asking = false

		const button = element('button', {
			type: 'button',
			classes: styles.remove,
			on: {
				click() {
					if (asking) {
						options.remove()
						return
					}
					ask(true)
				},
				blur() {
					ask(false)
				},
			},
		})

		const ask = (again: boolean) => {
			asking = again
			button.textContent = again ? 'Tap again to remove' : 'Remove'
			button.setAttribute('aria-label', `${button.textContent}: ${options.title}`)
		}

		ask(false)
		append(button)
	},
})
