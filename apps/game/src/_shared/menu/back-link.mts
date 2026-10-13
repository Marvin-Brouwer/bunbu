/**
 * The back link at the top left of a menu screen. When the page before this one in the history is
 * where it leads, it goes back to that entry, as the browser's Back does, so the two never disagree
 * on where back is. Otherwise (the screen was opened by its address, or reached another way) it
 * goes to `target` as a new entry.
 */

import { component } from '@rooted/components'
import { navigate, type Path } from '@rooted/router'
import styles from './menu.css'

export type BackLinkOptions = {
	readonly target: Path
}

/** Whether the history entry before this one is at `target`. Without the Navigation API, there is no telling. */
function cameFrom(target: Path): boolean {
	if (!('navigation' in globalThis)) return false
	const { currentEntry } = navigation
	if (currentEntry === null) return false
	const previous = navigation.entries()[currentEntry.index - 1]?.url
	if (previous === undefined || previous === null) return false
	return new URL(previous).pathname === new URL(target.href, location.href).pathname
}

/** Back to `target`: the entry before this one when that is `target`, else `target` as a new entry. */
export function goBack(target: Path): void {
	if (cameFrom(target)) history.back()
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
