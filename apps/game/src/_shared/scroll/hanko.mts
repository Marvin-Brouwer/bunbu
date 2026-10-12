/**
 * A red seal, a hanko. On the edge of the answer drawer it is stamped with 答, "answer": the thing
 * to tap or swipe up to draw the answers ([4 Ambush](../../../../../docs/design/screens.md#4-ambush)).
 * Drawn, not an image, so it stays sharp and takes the scroll's own colours.
 */

import { component } from '@rooted/components'
import styles from './scroll.css'

export type HankoOptions = {
	/** The character stamped on it, such as 答. */
	readonly character: string
}

export const Hanko = component<HankoOptions>({
	name: 'hanko',
	styles,
	onMount({ append, element, options }) {
		append(
			element('svg', {
				classes: styles.hanko,
				viewBox: '0 0 48 48',
				aria: {
					hidden: 'true',
				},
				children: element('svg:g', {
					transform: 'rotate(-4 24 24)',
					children: [
						element('svg:rect', {
							classes: styles.sealStamp,
							x: 5,
							y: 5,
							width: 38,
							height: 38,
							rx: 5,
						}),
						element('svg:rect', {
							classes: styles.sealBorder,
							x: 8.5,
							y: 8.5,
							width: 31,
							height: 31,
							rx: 2.5,
						}),
						element('svg:text', {
							classes: styles.sealCharacter,
							x: 24,
							y: 25,
							textContent: options.character,
						}),
					],
				}),
			})
		)
	},
})
