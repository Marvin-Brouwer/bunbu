/**
 * The swipe area itself ([4 Ambush](../../../../../docs/design/screens.md#4-ambush)): a plain sheet
 * of hanji, the fibrous mulberry paper, with a line on how to answer. It is abstract on purpose:
 * the answers are on the scroll above it, and the ninjas only come in once the player has answered.
 */

import { component } from '@rooted/components'
import type { AmbushKind } from '../state/ambush.mts'
import styles from './swipe.css'

export type SwipePaperOptions = {
	readonly kind: AmbushKind
}

/** How to answer. One short line. */
function hintOf(kind: AmbushKind): string {
	if (kind === 'yes-no') return 'swipe ↑ yes · ↓ no'
	if (kind === 'single') return 'swipe toward your answer'
	return 'swipe each answer · lift + pause = strike · swipe again to undo'
}

export const SwipePaper = component<SwipePaperOptions>({
	name: 'swipe-paper',
	styles,
	onMount({ append, element, options }) {
		append(
			element('div', {
				classes: styles.hanji,
				children: element('p', {
					classes: styles.hint,
					textContent: hintOf(options.kind),
				}),
			})
		)
	},
})
