/**
 * The mark legend in the swipe zone ([4 Ambush](../../../../../docs/design/screens.md#4-ambush)):
 * the ninjas with the arrows of the options they carry, front row and back row, and how to answer.
 * It shows one moment of the ambush; the swipe zone draws a new one when the picks change.
 */

import { component } from '@rooted/components'
import { frontRow } from '../state/ambush-opening.mts'
import { sortDistinct } from '../state/arrays.mts'
import type { AmbushKind, AmbushState } from '../state/ambush.mts'
import { NinjaFigure } from './ninja-figure.mts'
import styles from './swipe.css'

export type MarkLegendOptions = {
	readonly state: AmbushState
}

/** How to answer, under the ninjas. One short line, so it fits under the back row as well. */
function hintOf(kind: AmbushKind): string {
	if (kind === 'yes-no') return '↑ yes (slash) · ↓ no (block)'
	if (kind === 'single') return 'one swipe strikes'
	return 'lift + pause = strike · swipe again to undo'
}

export const MarkLegend = component<MarkLegendOptions>({
	name: 'mark-legend',
	styles,
	onMount({ append, create, element, options }) {
		const { state } = options

		const ninjas = sortDistinct(state.options.map((option) => option.ninja))
		const front = ninjas.filter((ninja) => ninja < frontRow)

		append(
			element('div', {
				classes: styles.legend,
				children: [
					element('div', {
						classes: styles.ninjas,
						'data-front': String(front.length),
						'data-back': String(front.length < ninjas.length),
						children: ninjas.map((ninja) => create(NinjaFigure, {
							ninja,
							options: state.options.filter((option) => option.ninja === ninja),
							kind: state.kind,
							back: ninja >= frontRow,
						})),
					}),
					element('p', {
						classes: styles.call,
						textContent: 'swipe here',
					}),
					element('p', {
						classes: styles.hint,
						textContent: hintOf(state.kind),
					}),
				],
			})
		)
	},
})
