/** The 3-2-1 after resuming from the pause ([6 Pause](../../../../../docs/design/screens.md#6-pause)). */

import { component } from '@rooted/components'
import type { Run, RunState } from '../state/run.mts'
import styles from './overlays.css'

export type CountdownOptions = {
	readonly run: Run
}

export const Countdown = component<CountdownOptions>({
	name: 'countdown',
	styles,
	onMount({ append, element, options, signal }) {
		const { run } = options
		const layer = append(
			element('div', {
				classes: styles.countdown,
				aria: {
					live: 'assertive',
				},
			})
		)

		// The run counts down every frame; the number only changes once a second.
		let shown = 0
		const show = (state: RunState) => {
			const count = Math.ceil(state.countdown)
			if (count === shown) return
			shown = count
			layer.replaceChildren(
				...count === 0
					? []
					: [element('span', {
						classes: styles.count,
						textContent: String(count),
					})],
			)
		}
		show(run.value)
		run.on('change', signal, ({ detail }) => {
			show(detail.state)
		})
	},
})
