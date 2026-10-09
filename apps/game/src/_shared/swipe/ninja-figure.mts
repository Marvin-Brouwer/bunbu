/**
 * One ninja in the mark legend: a figure with the arrows of the options it carries, the picked
 * ones in vermilion, and for `order` the place each was swiped in. The real ninjas are in the 3D
 * world; this one is only a legend.
 */

import { component, optional } from '@rooted/components'
import type { AmbushKind, AmbushOption } from '../state/ambush.mts'
import { arrows, ninjaName } from '../scroll/heading.mts'
import styles from './swipe.css'

export type NinjaFigureOptions = {
	readonly ninja: number
	/** The options this ninja carries: one, or two when there are 6 to 8 options. */
	readonly options: readonly AmbushOption[]
	readonly kind: AmbushKind
	/** The back row is drawn smaller and faded, and strikes in the second wave. */
	readonly back: boolean
}

export const NinjaFigure = component<NinjaFigureOptions>({
	name: 'ninja-figure',
	styles,
	onMount({ append, element, options }) {
		const { ninja, kind, back } = options

		append(
			element('div', {
				classes: styles.figure,
				'data-ninja': String(ninja),
				'data-row': back ? 'back' : 'front',
				'data-picked': String(options.options.some((option) => option.pick > 0)),
				aria: {
					label: `ninja ${ninjaName(ninja)}`,
				},
				children: [
					element('div', {
						classes: styles.head,
					}),
					element('div', {
						classes: styles.body,
						children: options.options.map((option) => element('span', {
							classes: styles.arrow,
							'data-picked': String(option.pick > 0),
							aria: {
								label: `swipe ${option.mark.replaceAll('-', ' ')}`,
							},
							children: [
								arrows[option.mark],
								optional(kind === 'order' && option.pick > 0,
									element('sup', {
										classes: styles.place,
										textContent: String(option.pick),
									})
								),
							],
						})),
					}),
				],
			})
		)
	},
})
