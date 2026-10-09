/**
 * A menu screen on papyrus: a back link and a heading, then the screen's own parts. It scrolls as a
 * whole when it is taller than the phone.
 */

import { component } from '@rooted/components'
import type { ElementChildren } from '@rooted/components/elements'
import { Link, type Path } from '@rooted/router'
import styles from './menu.css'

export type MenuScreenOptions = {
	readonly title: string
	/** Where the back link goes. */
	readonly back: Path
	readonly children: ElementChildren
}

export const MenuScreen = component<MenuScreenOptions>({
	name: 'menu-screen',
	styles,
	onMount({ append, create, element, options }) {
		append(
			element('section', {
				classes: styles.screen,
				children: element('div', {
					classes: styles.page,
					children: [
						element('header', {
							classes: styles.header,
							children: [
								create(Link, {
									href: options.back,
									classes: styles.back,
									aria: {
										label: 'Back',
									},
									children: '‹',
								}),
								element('h1', {
									classes: styles.title,
									textContent: options.title,
								}),
							],
						}),
						...[options.children].flat(),
					],
				}),
			})
		)
	},
})
