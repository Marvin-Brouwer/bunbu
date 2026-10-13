/**
 * The back link at the top left of a menu screen. It goes back through the history, as the
 * browser's Back does, so the two never disagree on where back is. Only when there is no page
 * before this one (the screen was opened by its address) does it go to the title.
 */

import { component } from '@rooted/components'
import { href, navigate } from '@rooted/router'
import styles from './menu.css'

/** Whether there is a page of the game before this one in the history. */
function canGoBack(): boolean {
	if ('navigation' in globalThis) return navigation.canGoBack
	return history.length > 1
}

/** Back to the page before this one, or to the title when there is none. */
export function goBack(): void {
	if (canGoBack()) history.back()
	else navigate(href.path('/'))
}

export const BackLink = component({
	name: 'back-link',
	styles,
	onMount({ append, element }) {
		append(
			element('a', {
				href: href.path('/').href,
				classes: styles.back,
				aria: {
					label: 'Back',
				},
				textContent: '‹',
				on: {
					click(event) {
						event.preventDefault()
						goBack()
					},
				},
			})
		)
	},
})
