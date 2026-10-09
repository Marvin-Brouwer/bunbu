/** One of the three numbers under a result: `CORRECT · 1,700 · 17 × 100`. */

import { component } from '@rooted/components'
import styles from './overlays.css'

export type StatTileOptions = {
	readonly label: string
	readonly value: string
	readonly note: string
}

export const StatTile = component<StatTileOptions>({
	name: 'stat-tile',
	styles,
	onMount({ append, element, options }) {
		append(
			element('div', {
				classes: styles.tile,
				children: [
					element('span', {
						classes: styles.label,
						textContent: options.label,
					}),
					element('span', {
						classes: styles.tileValue,
						textContent: options.value,
					}),
					element('span', {
						classes: styles.tileNote,
						textContent: options.note,
					}),
				],
			})
		)
	},
})
