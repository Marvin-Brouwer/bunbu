/** The red flash round the edge of the screen when the samurai is hit ([5B](../../../../../docs/design/screens.md#5-outcome)). */

import { component } from '@rooted/components'
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
				append(
					element('div', {
						classes: styles.flash,
						on: {
							animationend(event) {
								event.currentTarget.remove()
							},
						},
					})
				)
			}
			hits = detail.state.hits
		})
	},
})
