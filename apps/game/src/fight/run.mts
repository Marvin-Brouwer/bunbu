/**
 * The run's screen: puts the run's world on the canvas, plugs the run into the game loop, and holds
 * one empty layer per part of the HUD for the tracks to fill
 * ([layers](../../../../docs/architecture/rendering.md#layers)).
 *
 * It is handed its `game` by the fight screen and keeps nothing of its own, so unmounting it stops
 * the run and lets the game go.
 */

import { component } from '@rooted/components'
import { tickRun } from './flows/run.mts'
import { play } from '../_canvas/loop.mts'
import { createRunWorld } from './world.mts'
import { show } from '../_canvas/stage.mts'
import type { RunGame } from './state/game.mts'
import styles from './run.css'

/** The run's layers over the canvas, back to front. */
export const runLayers = ['hud', 'scroll', 'swipe', 'overlays'] as const

export type RunLayer = (typeof runLayers)[number]

export type RunScreenOptions = {
	readonly game: RunGame
	/** Leaves the run for the select screen, from the pause menu, results or the fallen screen. */
	readonly leave: () => void
}

export const RunScreen = component<RunScreenOptions>({
	name: 'run',
	styles,
	onMount({ append, element, options, signal }) {
		const { game } = options

		show((camera) => createRunWorld(game, camera), signal)
		play({
			update: (dt) => { tickRun(game, dt) },
			paused: () => game.run.get().phase === 'paused',
			worldScale: () => game.run.get().worldScale,
			pause: () => { game.run.pause() },
		}, signal)

		const layer = (name: RunLayer) => {
			const container = element('div', {
				classes: [
					styles.layer,
					styles[name],
				],
			})
			container.dataset.layer = name
			return container
		}

		append(
			element('div', {
				classes: styles.run,
				children: runLayers.map(layer),
			})
		)
		// The tracks mount here, one line each, handing their component `game` (and the overlays `leave`).
	},
})
