/**
 * The scroll of one ambush: the heading and the query on a {@link ScrollSheet}, with the answers
 * in the answer drawer at its foot. In practice, read out loud follows the query. The question scrolls above the drawer's edge. The
 * {@link Scroll} unrolls it, rolls it up, or cuts it in two.
 */

import { component, type GenericComponent } from '@rooted/components'
import { Markdown } from '@rooted/markdown'
import type { AmbushState } from '../state/ambush.mts'
import { renderMarkdown } from '../markdown/render.mts'
import { ScrollSheet } from './scroll-sheet.mts'
import styles from './scroll.css'

export type ScrollPaperOptions = {
	/** The ambush as it was when the scroll opened. */
	readonly state: AmbushState
	readonly heading: string
	/** The answer drawer with the answers. It stretches the scroll to the bottom of the screen. */
	readonly drawer: GenericComponent
	/** Practice's read out loud, after the query. */
	readonly readAloud?: GenericComponent
}

export const ScrollPaper = component<ScrollPaperOptions>({
	name: 'scroll-paper',
	styles,
	onMount({ append, create, element, options }) {
		const { state, heading, drawer, readAloud } = options

		append(
			create(ScrollSheet, {
				fill: true,
				footer: drawer,
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
					readAloud,
				],
			})
		)
	},
})
