/**
 * The scroll itself, rods and all: the heading, the query and the options of one ambush. The
 * {@link Scroll} unrolls it, rolls it up, or cuts it in two.
 */

import { component } from '@rooted/components'
import type { Ambush, AmbushState } from '../state/ambush.mts'
import { QuizMarkdown } from '../markdown/quiz-markdown.mts'
import { bundled } from './heading.mts'
import { ScrollOption } from './scroll-option.mts'
import styles from './scroll.css'

export type ScrollPaperOptions = {
	/** The ambush as it was when the scroll opened. */
	readonly state: AmbushState
	readonly heading: string
	/** The open ambush, to follow the picks; left out for a scroll that no longer changes. */
	readonly ambush?: Ambush
}

export const ScrollPaper = component<ScrollPaperOptions>({
	name: 'scroll-paper',
	styles,
	onMount({ append, create, element, options }) {
		const { state, heading, ambush } = options

		append(
			element('div', {
				classes: styles.paper,
				children: [
					element('div', {
						classes: styles.rod,
					}),
					element('div', {
						classes: styles.sheet,
						children: element('div', {
							classes: styles.body,
							children: [
								element('p', {
									classes: styles.heading,
									textContent: heading,
								}),
								element('div', {
									classes: styles.query,
									children: create(QuizMarkdown, {
										source: state.query,
									}),
								}),
								element('div', {
									classes: styles.options,
									children: state.options.map((option) => create(ScrollOption, {
										option,
										kind: state.kind,
										bundled: bundled(state),
										ambush,
									})),
								}),
							],
						}),
					}),
					element('div', {
						classes: styles.rod,
					}),
				],
			})
		)
	},
})
