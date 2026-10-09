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
import { commitAmbush } from './flows/ambush.mts'
import { play } from '../canvas/loop.mts'
import { show } from '../canvas/stage.mts'
import type { RunGame } from './state/game.mts'
import { Hud } from './hud/hud.mts'
import { Scroll } from '../_shared/scroll/scroll.mts'
import { RunOverlays } from './overlays/overlays.mts'
import styles from './run.css'

export type RunScreenOptions = {
	readonly game: RunGame
	/** Leaves the run for the select screen, from the pause menu. */
	readonly leave: () => void
	/** Starts a new run on the chosen quiz and stage: Restart stage, Next stage, Rise again. */
	readonly restart: () => void
}

export const RunScreen = component<RunScreenOptions>({
	name: 'run',
	styles,
	async onMount({ append, create, element, options, signal }) {
		const { game } = options

		play({
			update: (worldDelta, realDelta) => { tickRun(game, worldDelta, realDelta) },
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
						children: create(Hud, {
							game,
						}),
					}),
					element('div', {
						'data-layer': 'scroll',
						classes: [
							styles.layer,
							styles.scroll,
						],
						children: create(Scroll, {
							ambush: game.ambush,
							quiz: game.quiz,
							label: 'AMBUSH',
							commit: () => { commitAmbush(game) },
							held: () => game.run.value.phase !== 'ambush' || game.run.value.countdown > 0 || game.ambush.value.openingLeft > 0,
						}),
					}),
					element('div', {
						'data-layer': 'overlays',
						classes: [
							styles.layer,
							styles.overlays,
						],
						children: create(RunOverlays, {
							game,
							restart: options.restart,
							leave: options.leave,
						}),
					}),
				],
			})
		)

		// The world needs three.js, which is only loaded once a run starts in the browser.
		const { createRunWorld } = await import('./world/world.mts')
		if (signal.aborted) return
		show((viewport) => createRunWorld(game, viewport), signal)
	},
})
