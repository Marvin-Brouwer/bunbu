/**
 * A scroll over the dimmed screen, for a question or a few steps that need the player's attention:
 * how to share a quiz, or whether to remove one. It's a modal `<dialog>`, so Escape closes it too.
 *
 * ```ts
 * const scroll: Element = create(ScrollDialog, {
 * 	title: 'Remove this quiz?',
 * 	children: element('p', { textContent: '…' }),
 * 	footer: (close) => create(MenuButton, { label: 'Cancel', action: close }),
 * 	closed: () => { scroll.remove() },
 * })
 * ```
 */

import { component } from '@rooted/components'
import type { ElementChildren } from '@rooted/components/elements'
import { ScrollSheet } from './scroll-sheet.mts'
import styles from './scroll-dialog.css'

export type ScrollDialogOptions = {
	/** The heading on the scroll, and its name for screen readers. */
	readonly title: string
	readonly children: ElementChildren
	/** The buttons at the foot of the scroll. `close` closes it, which calls `closed`. */
	readonly footer: (close: () => void) => ElementChildren
	/** Called once the scroll is closed, by a button or by Escape. Remove it here. */
	readonly closed: () => void
}

export const ScrollDialog = component<ScrollDialogOptions>({
	name: 'scroll-dialog',
	styles,
	onMount({ append, create, element, options }) {
		const close = () => {
			dialog.close()
		}
		const dialog = element('dialog', {
			classes: styles.scrollDialog,
			aria: {
				label: options.title,
			},
			on: {
				close: options.closed,
			},
			children: create(ScrollSheet, {
				unroll: true,
				children: element('div', {
					classes: styles.dialogBody,
					children: [
						element('h2', {
							classes: styles.dialogTitle,
							textContent: options.title,
						}),
						options.children,
					].flat(),
				}),
				footer: element('div', {
					classes: styles.dialogActions,
					children: options.footer(close),
				}),
			}),
		})

		append(
			dialog
		)
		dialog.showModal()
	},
})
