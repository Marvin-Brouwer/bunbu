/**
 * The answers swiped so far, in swipe order, between the scroll's text and the swipe paper
 * ([4 Ambush](../../../../../docs/design/screens.md#4-ambush)). The text above may have scrolled
 * away, so the player sees what they cut without looking up.
 *
 * Every option has its entry from the start, hidden until it is picked; the pick number puts the
 * entries in swipe order.
 */

import { component } from '@rooted/components'
import { Markdown } from '@rooted/markdown'
import type { Ambush, AmbushState } from '../state/ambush.mts'
import { renderMarkdown } from '../markdown/render.mts'
import { arrows } from '../scroll/heading.mts'
import styles from './swipe.css'

export type SwipePicksOptions = {
	readonly ambush: Ambush
}

export const SwipePicks = component<SwipePicksOptions>({
	name: 'swipe-picks',
	styles,
	onMount({ append, create, element, options, signal }) {
		const { ambush } = options
		const { kind } = ambush.value

		const entries = ambush.value.options.map((option) => {
			const place = element('span', {
				classes: styles.place,
			})
			const entry = element('li', {
				classes: styles.choice,
				children: [
					place,
					element('span', {
						classes: styles.arrow,
						textContent: arrows[option.mark],
					}),
					create(Markdown, {
						source: renderMarkdown(option.answer),
						classes: styles.text,
					}),
				],
			})
			return { mark: option.mark, entry, place }
		})

		const list = append(
			element('ol', {
				classes: styles.choices,
				aria: {
					label: 'your answers',
				},
				children: entries.map(({ entry }) => entry),
			})
		)

		const show = (state: AmbushState) => {
			let any = false
			for (const { mark, entry, place } of entries) {
				const pick = state.options.find((option) => option.mark === mark)?.pick ?? 0
				entry.hidden = pick === 0
				entry.style.order = String(pick)
				place.textContent = kind === 'order' && pick > 0 ? String(pick) : ''
				any ||= pick > 0
			}
			list.hidden = !any
		}

		show(ambush.value)
		// Once the ambush closes its options are gone; the list keeps showing the last picks.
		ambush.on('change', signal, ({ detail }) => {
			if (detail.state.open) show(detail.state)
		})
	},
})
