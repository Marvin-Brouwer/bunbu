/**
 * Asks the player to agree to a set of {@link terms} on a scroll, with **I agree** and a way out.
 * Closing the scroll any other way, as with Escape, doesn't agree.
 */

import { component } from '@rooted/components'
import { Markdown } from '@rooted/markdown'
import { MenuButton } from '../menu/menu-button.mts'
import { ScrollDialog } from '../scroll/scroll-dialog.mts'
import type { TermsKind } from '../state/agreements.mts'
import { terms } from './terms.mts'
import styles from './terms.css'

export type TermsScrollOptions = {
	readonly terms: TermsKind
	/** What the player is asked about, such as which quiz, above the terms. */
	readonly about: string
	/** The button that doesn't agree, such as `Cancel`. */
	readonly decline: string
	/** Called once the scroll is closed, with whether the player agreed. Remove it here. */
	readonly closed: (agreed: boolean) => void
}

export const TermsScroll = component<TermsScrollOptions>({
	name: 'terms-scroll',
	styles,
	onMount({ append, create, element, options }) {
		const asked = terms[options.terms]
		let agreed = false

		append(
			create(ScrollDialog, {
				title: asked.title,
				closed: () => {
					options.closed(agreed)
				},
				children: [
					element('p', {
						textContent: options.about,
					}),
					create(Markdown, {
						source: asked.source,
						classes: styles.terms,
					}),
				],
				footer: (close) => [
					create(MenuButton, {
						kind: 'primary',
						label: 'I agree',
						action: () => {
							agreed = true
							close()
						},
					}),
					create(MenuButton, {
						label: options.decline,
						action: close,
					}),
				],
			})
		)
	},
})
