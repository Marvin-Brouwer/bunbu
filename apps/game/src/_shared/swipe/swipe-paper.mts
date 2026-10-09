/**
 * The swipe area itself ([4 Ambush](../../../../../docs/design/screens.md#4-ambush)): a ruled
 * paper-cutting target, as kumdo practises cuts on (종이베기), grey along the top and bottom, cut
 * from the scroll's own paper. It is abstract on purpose: the answers are on the scroll above it,
 * and the ninjas only come in once the player has answered.
 */

import { component } from '@rooted/components'
import styles from './swipe.css'

export const SwipePaper = component({
	name: 'swipe-paper',
	styles,
	onMount({ append, element }) {
		append(
			element('div', {
				classes: styles.target,
				children: [
					element('div', {
						classes: styles.edge,
					}),
					element('div', {
						classes: styles.field,
						children: [
							element('div', {
								classes: styles.band,
							}),
							element('div', {
								classes: styles.ring,
							}),
						],
					}),
					element('div', {
						classes: styles.edge,
					}),
				],
			})
		)
	},
})
