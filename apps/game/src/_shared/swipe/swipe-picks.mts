/**
 * The marks swiped so far, as small arrows in swipe order, between the hint and the swipe paper
 * ([4 Ambush](../../../../../docs/design/screens.md#4-ambush)). The options above may have
 * scrolled away, so the player sees what they cut without looking up.
 *
 * Every option has its arrow from the start, hidden until it is picked; the pick number puts the
 * arrows in swipe order. The row keeps its height while empty, so the paper never moves.
 */

import { component } from '@rooted/components'
import type { Ambush, AmbushState } from '../state/ambush.mts'
import { arrows } from '../scroll/heading.mts'
import styles from './swipe.css'

export type SwipePicksOptions = {
	readonly ambush: Ambush
}

export const SwipePicks = component<SwipePicksOptions>({
	name: 'swipe-picks',
	styles,
	onMount({ append, element, options, signal }) {
		const { ambush } = options

		const entries = ambush.value.options.map((option) => ({
			mark: option.mark,
			entry: element('li', {
				classes: styles.choice,
				textContent: arrows[option.mark],
				aria: {
					label: option.mark.replaceAll('-', ' '),
				},
			}),
		}))

		append(
			element('ol', {
				classes: styles.choices,
				aria: {
					label: 'your swipes',
				},
				children: entries.map(({ entry }) => entry),
			})
		)

		const show = (state: AmbushState) => {
			for (const { mark, entry } of entries) {
				const pick = state.options.find((option) => option.mark === mark)?.pick ?? 0
				entry.hidden = pick === 0
				entry.style.order = String(pick)
			}
		}

		show(ambush.value)
		// Once the ambush closes its options are gone; the row keeps showing the last picks.
		ambush.on('change', signal, ({ detail }) => {
			if (detail.state.open) show(detail.state)
		})
	},
})
