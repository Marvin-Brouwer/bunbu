/** A part of a menu screen under a small label, such as `1 · QUIZ`. */

import { component } from '@rooted/components'
import type { ElementChildren } from '@rooted/components/elements'
import styles from './menu.css'

export type MenuSectionOptions = {
	readonly label: string
	readonly children: ElementChildren
}

export const MenuSection = component<MenuSectionOptions>({
	name: 'menu-section',
	styles,
	onMount({ append, element, options }) {
		append(
			element('section', {
				classes: styles.section,
				children: [
					element('h2', {
						classes: styles.label,
						textContent: options.label,
					}),
					...[options.children].flat(),
				],
			})
		)
	},
})
