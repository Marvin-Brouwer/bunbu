/**
 * The run's overlays layer: the pause menu, the 3-2-1 after it, and the results of a finished or
 * fallen run, each over the run's world. Which one shows follows the run's phase.
 */

import { component } from '@rooted/components'
import type { Path } from '@rooted/router'
import type { RunGame } from '../state/game.mts'
import type { RunState } from '../state/run.mts'
import { Countdown } from './countdown.mts'
import { Fallen } from './fallen.mts'
import { Finished } from './finished.mts'
import { Pause } from './pause.mts'

export type RunOverlaysOptions = {
	readonly game: RunGame
	/** A new run on the chosen quiz and stage: Restart stage, Next stage, Rise again. */
	readonly restart: () => void
	/** Leaves the run for another screen, which takes its place in history: Quit, Menu, Practise mistakes. */
	readonly leave: (to: Path) => void
}

type Overlay = 'none' | 'pause' | 'countdown' | 'finished' | 'fallen'

function overlayOf(state: RunState): Overlay {
	if (state.phase === 'paused') return 'pause'
	if (state.phase === 'finished' || state.phase === 'fallen') return state.phase
	return state.countdown > 0 ? 'countdown' : 'none'
}

export const RunOverlays = component<RunOverlaysOptions>({
	name: 'run-overlays',
	onMount({ create, options, replace, signal }) {
		const { game } = options

		let shown: Overlay = 'none'
		const show = (state: RunState) => {
			const overlay = overlayOf(state)
			if (overlay === shown) return
			shown = overlay
			switch (overlay) {
				case 'none':
					replace()
					return
				case 'pause':
					replace(create(Pause, options))
					return
				case 'countdown':
					replace(create(Countdown, { run: game.run }))
					return
				case 'finished':
					replace(create(Finished, options))
					return
				case 'fallen':
					replace(create(Fallen, options))
			}
		}
		show(game.run.value)
		game.run.on('change', signal, ({ detail }) => {
			show(detail.state)
		})
	},
})
