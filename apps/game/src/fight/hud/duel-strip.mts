/**
 * The duel strip ([time limit](../../../../../docs/design/gameplay.md#time-limit)): on a screen too
 * short to show the fight below the scroll ([ambush room](../ambush-room.mts)), a low strip above
 * it shows the samurai and a ninja as silhouettes against the sky, walking toward each other. They
 * meet in the middle when the time is up, as far in as the ninjas in the world.
 */

import { component } from '@rooted/components'
import { approachOf } from '../../_shared/state/ambush-time.mts'
import type { Ambush, AmbushState } from '../../_shared/state/ambush.mts'
import samuraiFigure from './duel-samurai.svg'
import ninjaFigure from './duel-ninja.svg'
import styles from './hud.css'

export type DuelStripOptions = {
	readonly ambush: Ambush
}

export const DuelStrip = component<DuelStripOptions>({
	name: 'duel-strip',
	styles,
	onMount({ append, element, options, signal }) {
		const { ambush } = options

		const strip = append(
			element('div', {
				classes: styles.duel,
				'data-open': 'false',
				'aria-hidden': 'true',
				children: [
					element('img', {
						classes: [
							styles.fighter,
							styles.samurai,
						],
						src: samuraiFigure,
						alt: '',
					}),
					element('img', {
						classes: [
							styles.fighter,
							styles.ninja,
						],
						src: ninjaFigure,
						alt: '',
					}),
				],
			})
		)

		const show = (state: AmbushState) => {
			// Only an ambush against the clock: the dojo's have no time limit.
			strip.dataset.open = String(state.open && state.seconds > 0)
			strip.style.setProperty('--closing', String(approachOf(state.seconds, state.secondsLeft)))
		}

		show(ambush.value)
		ambush.on('change', signal, ({ detail }) => {
			show(detail.state)
		})
	},
})
