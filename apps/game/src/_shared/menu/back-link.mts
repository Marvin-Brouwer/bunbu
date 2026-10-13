/**
 * The back link at the top left of a menu screen. It goes back through the history, as the
 * browser's Back does, so the two never disagree on where back is. Only when there is no page
 * before this one (the screen was opened by its address) does it go to `target`.
 */

import { component } from '@rooted/components'
import { navigate, type Path } from '@rooted/router'
import styles from './menu.css'

export type BackLinkOptions = {
	readonly target: Path
}

/** Whether there is a page of the game before this one in the history. */
function canGoBack(): boolean {
	if ('navigation' in globalThis) return navigation.canGoBack
	return history.length > 1
}

/** Back to the page before this one, or to `target` when there is none. */
export function goBack(target: Path): void {
	if (canGoBack()) history.back()
	else navigate(target)
}

export const BackLink = component<BackLinkOptions>({
	name: 'back-link',
	styles,
	onMount({ append, element, options }) {
		const { target } = options

		append(
			element('a', {
				href: target.href,
				classes: styles.back,
				aria: {
					label: 'Back',
				},
				textContent: '‹',
				on: {
					click(event) {
						event.preventDefault()
						goBack(target)
					},
				},
			})
		)
	},
})
