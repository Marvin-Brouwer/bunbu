/**
 * The papyrus between two wooden rods, holding whatever is written on it: an ambush in the
 * {@link ScrollPaper}, or the pause menu and the results of a run. The text scrolls inside the
 * sheet when it is long, above the footer when there is one.
 */

import { component, optional } from '@rooted/components'
import type { ElementChildren } from '@rooted/components/elements'
import styles from './scroll.css'

export type ScrollSheetOptions = {
	readonly children: ElementChildren
	/** Stays in view under the text, which scrolls above it, such as the swipe zone or a run's buttons. */
	readonly footer?: ElementChildren
	/** Stretches the scroll to the bottom of the screen, as for the swipe zone. */
	readonly fill?: boolean
	/** Unrolls the sheet from the top rod once it is shown. */
	readonly unroll?: boolean
}

export const ScrollSheet = component<ScrollSheetOptions>({
	name: 'scroll-sheet',
	styles,
	onMount({ append, element, options }) {
		const { footer } = options

		append(
			element('div', {
				classes: styles.paper,
				'data-footer': String(footer !== undefined),
				'data-fill': String(options.fill ?? false),
				'data-unroll': String(options.unroll ?? false),
				children: [
					element('div', {
						classes: styles.rod,
					}),
					element('div', {
						classes: styles.sheet,
						children: [
							element('div', {
								classes: styles.body,
								children: options.children,
							}),
							optional(footer !== undefined,
								element('div', {
									classes: styles.footer,
									children: footer,
								})
							),
						],
					}),
					element('div', {
						classes: styles.rod,
					}),
				],
			})
		)
	},
})
