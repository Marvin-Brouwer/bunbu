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
import { play } from '../canvas/loop.mts'
import { createRunWorld } from './world.mts'
import { show } from '../canvas/stage.mts'
import type { RunGame } from './state/game.mts'
import styles from './run.css'

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
			paused: () => game.run.value.phase === 'paused',
			worldScale: () => game.run.value.worldScale,
			pause: () => { game.run.value.pause() },
		}, signal)

		// The run's layers over the canvas, back to front. The tracks mount here, one line each,
		// handing their component `game` (and the overlays `leave`).
		append(
			element('div', {
				classes: styles.run,
				children: [
					element('div', {
						'data-layer': 'hud',
						classes: [
							styles.layer,
							styles.hud,
						],
					}),
					element('div', {
						'data-layer': 'scroll',
						classes: [
							styles.layer,
							styles.scroll,
						],
					}),
					element('div', {
						'data-layer': 'swipe',
						classes: [
							styles.layer,
							styles.swipe,
						],
					}),
					element('div', {
						'data-layer': 'overlays',
						classes: [
							styles.layer,
							styles.overlays,
						],
					}),
				],
			})
		)
	},
})
