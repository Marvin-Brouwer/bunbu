/** The only control while running ([3 Running](../../../../../docs/design/screens.md#3-running)). */

import { component } from '@rooted/components'
import type { Run, RunPhase } from '../state/run.mts'
import styles from './hud.css'

export type PauseButtonOptions = {
	readonly run: Run
}

/** The phases a run can be paused in; the rest are paused, over, or not started. */
const pausable: ReadonlySet<RunPhase> = new Set(['intro', 'running', 'ambush'])

export const PauseButton = component<PauseButtonOptions>({
	name: 'pause-button',
	styles,
	onMount({ append, element, options, signal }) {
		const { run } = options

		const button = append(
			element('button', {
				type: 'button',
				classes: [
					styles.panel,
					styles.pause,
				],
				aria: {
					label: 'Pause',
				},
				on: {
					click() {
						run.value.pause()
					},
				},
			})
		)

		const show = (phase: RunPhase) => {
			button.disabled = !pausable.has(phase)
		}
		show(run.value.phase)
		run.on('change', signal, ({ detail }) => {
			show(detail.state.phase)
		})
	},
})
