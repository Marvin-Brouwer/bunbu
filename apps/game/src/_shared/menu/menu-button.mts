/**
 * A menu's button: a link to another screen, or a button for something that happens on this one.
 * The primary one is the vermilion of a torii: the one thing to do next on a screen.
 */

import { component, cssClass, optional } from '@rooted/components'
import { Link, type Path } from '@rooted/router'
import styles from './menu.css'

type Target =
	| { readonly href: Path }
	| { readonly action: () => void; readonly disabled?: boolean }
	/** A button that can't be pressed yet, such as Fight before a quiz is chosen. */
	| { readonly disabled: true }

export type MenuButtonOptions = Target & {
	readonly label: string
	/** A smaller line under the label, such as the quiz a fight starts on. */
	readonly note?: string
	readonly kind?: 'primary' | 'plain'
}

export const MenuButton = component<MenuButtonOptions>({
	name: 'menu-button',
	styles,
	onMount({ append, create, element, options }) {
		const classes = [
			styles.button,
			cssClass(options.kind === 'primary', styles.primary),
		]
		const children = [
			element('span', {
				textContent: options.label,
			}),
			optional(options.note !== undefined,
				element('span', {
					classes: styles.buttonNote,
					textContent: options.note ?? '',
				})
			),
		]

		append(
			'href' in options
				? create(Link, {
					href: options.href,
					classes,
					children,
				})
				: element('button', {
					type: 'button',
					classes,
					disabled: options.disabled ?? false,
					children,
					on: 'action' in options
						? { click: options.action }
						: {},
				})
		)
	},
})
