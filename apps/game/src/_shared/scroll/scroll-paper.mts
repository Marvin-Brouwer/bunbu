/**
 * The scroll of one ambush: the heading, the query and the options on a {@link ScrollSheet}, and a
 * footer under them, such as the swipe zone. The text scrolls above the footer. The
 * {@link Scroll} unrolls it, rolls it up, or cuts it in two.
 */

import { component, type GenericComponent } from '@rooted/components'
import { Markdown } from '@rooted/markdown'
import type { Ambush, AmbushState } from '../state/ambush.mts'
import { renderMarkdown } from '../markdown/render.mts'
import { ScrollOption } from './scroll-option.mts'
import { ScrollSheet } from './scroll-sheet.mts'
import styles from './scroll.css'

export type ScrollPaperOptions = {
	/** The ambush as it was when the scroll opened. */
	readonly state: AmbushState
	readonly heading: string
	/** The open ambush, to follow the picks; left out for a scroll that no longer changes. */
	readonly ambush?: Ambush
	/** Shown under the text, which scrolls above it. A footer stretches the scroll to the bottom of the screen. */
	readonly footer?: GenericComponent
}

export const ScrollPaper = component<ScrollPaperOptions>({
	name: 'scroll-paper',
	styles,
	onMount({ append, create, element, options }) {
		const { state, heading, ambush, footer } = options

		append(
			create(ScrollSheet, {
				fill: footer !== undefined,
				footer,
				children: [
					element('p', {
						classes: styles.heading,
						textContent: heading,
					}),
					element('div', {
						classes: styles.query,
						children: create(Markdown, {
							source: renderMarkdown(state.query),
							classes: styles.markdown,
						}),
					}),
					element('div', {
						classes: styles.options,
						children: state.options.map((option) => create(ScrollOption, {
							option,
							kind: state.kind,
							ambush,
						})),
					}),
				],
			})
		)
	},
})
