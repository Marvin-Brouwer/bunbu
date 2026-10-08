/**
 * A stand-in screen: a title, a line about what goes here, and links or buttons to what it leads to.
 * Enough to walk the whole app before the menu and dojo tracks build the real screens.
 */

import { component, type Component } from '@rooted/components'
import { Link, type Path } from '@rooted/router'
import styles from './placeholder.css'

export type PlaceholderLink =
	| { readonly label: string; readonly href: Path | string }
	| { readonly label: string; readonly action: () => void; readonly disabled?: boolean }

export type PlaceholderOptions = {
	readonly title: string
	readonly note: string
	readonly links: readonly PlaceholderLink[]
}

export function placeholder(name: string, options: PlaceholderOptions): Component {
	return component({
		name,
		styles,
		onMount({ append, create, element }) {
			const linkOrButton = (link: PlaceholderLink) => {
				if ('href' in link) {
					return create(Link, {
						href: link.href,
						children: link.label,
					})
				}
				return element('button', {
					type: 'button',
					textContent: link.label,
					disabled: link.disabled ?? false,
					on: {
						click: link.action,
					},
				})
			}

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
							children: options.links.map(linkOrButton),
						}),
					],
				})
			)
		},
	})
}
