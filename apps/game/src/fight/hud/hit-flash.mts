/**
 * The ninja's katana slice and blood spray when the samurai is hit, with the haptic buzz
 * ([5B](../../../../../docs/design/screens.md#5-outcome)).
 */

import { component } from '@rooted/components'
import { buzz, buzzes } from '../../_shared/haptics.mts'
import type { Life } from '../state/life.mts'
import styles from './hud.css'

export type HitFlashOptions = {
	readonly life: Life
}

export const HitFlash = component<HitFlashOptions>({
	name: 'hit-flash',
	styles,
	onMount({ append, element, options, signal }) {
		const { life } = options

		let hits = life.value.hits
		life.on('change', signal, ({ detail }) => {
			if (detail.state.hits > hits) {
				buzz(buzzes.hit)
				append(
					element('div', {
						classes: styles.hit,
						children: [
							element('div', {
								classes: styles.slice,
								children: element('div', {
									classes: styles.handle,
								}),
								on: {
									animationend(event) {
										event.currentTarget.parentElement?.remove()
									},
								},
							}),
							element('div', {
								classes: styles.blood,
							}),
						],
					})
				)
			}
			hits = detail.state.hits
		})
	},
})
