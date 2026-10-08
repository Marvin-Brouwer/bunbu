/**
 * A stand-in screen: a title, a line about what goes here, and links or buttons to what it leads to.
 * Enough to walk the whole app before the menu and dojo tracks build the real screens.
 */

import { component } from '@rooted/components'
import { Link, type Path } from '@rooted/router'
import styles from './placeholder.css'

export type PlaceholderLinkOptions =
	| { readonly label: string; readonly href: Path | string }
	| { readonly label: string; readonly action: () => void; readonly disabled?: boolean }

export type PlaceholderOptions = {
	readonly title: string
	readonly note: string
	readonly links: readonly PlaceholderLinkOptions[]
}

/** A link to another screen, or a button for something that happens on this one. */
export const PlaceholderLink = component<PlaceholderLinkOptions>({
	name: 'placeholder-link',
	onMount({ append, create, element, options }) {
		append(
			'href' in options
				? create(Link, {
					href: options.href,
					children: options.label,
				})
				: element('button', {
					type: 'button',
					textContent: options.label,
					disabled: options.disabled ?? false,
					on: {
						click: options.action,
					},
				})
		)
	},
})

export const Placeholder = component<PlaceholderOptions>({
	name: 'placeholder',
	styles,
	onMount({ append, create, element, options }) {
		append(
			element('section', {
				classes: styles.screen,
				children: [
					element('h1', {
						classes: styles.title,
						textContent: options.title,
					}),
					element('p', {
						classes: styles.note,
						textContent: options.note,
					}),
					element('nav', {
						classes: styles.links,
						children: options.links.map((link) => create(PlaceholderLink, link)),
					}),
				],
			})
		)
	},
})
