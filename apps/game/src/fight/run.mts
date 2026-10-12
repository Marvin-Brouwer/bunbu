/**
 * The run's screen: puts the run's world on the canvas, plugs the run into the game loop, and holds
 * one empty layer per part of the HUD for the tracks to fill
 * ([layers](../../../../docs/architecture/rendering.md#layers)).
 *
 * It is handed its `game` by the fight screen and keeps nothing of its own, so unmounting it stops
 * the run and lets the game go.
 */

import { component } from '@rooted/components'
import { resizeObserver } from '@rooted/observers'
import { tickRun } from './flows/run.mts'
import { commitAmbush } from './flows/ambush.mts'
import { play } from '../canvas/loop.mts'
import { guardPlay } from '../_shared/play-guard.mts'
import { show } from '../canvas/stage.mts'
import type { RunGame } from './state/game.mts'
import { pausable } from './state/run.mts'
import { Hud } from './hud/hud.mts'
import { DuelStrip } from './hud/duel-strip.mts'
import { ambushRoomOf, noRoom, type AmbushRoom } from './ambush-room.mts'
import { Scroll } from '../_shared/scroll/scroll.mts'
import { RunOverlays } from './overlays/overlays.mts'
import { createRunWorld } from './world/world.mts'
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
	onMount({ append, create, element, options, signal }) {
		const { game } = options

		play({
			update: (worldDelta, realDelta) => { tickRun(game, worldDelta, realDelta) },
			paused: () => game.run.value.phase === 'paused',
			worldScale: () => game.run.value.worldScale,
			pause: () => { game.run.value.pause() },
		}, signal)

		// Full screen on a phone, and Back pauses; both come back when the run resumes.
		const guard = guardPlay({
			pause: () => { game.run.value.pause() },
			pausable: () => pausable.has(game.run.value.phase),
		}, signal)
		let wasPaused = false
		game.run.on('change', signal, ({ detail }) => {
			const paused = detail.state.phase === 'paused'
			if (wasPaused && !paused) guard.resumed()
			wasPaused = paused
		})

		// The run's layers over the canvas, back to front. The tracks mount here, one line each,
		// handing their component `game` (and the overlays `leave`).
		const run = append(
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
						children: [
							create(DuelStrip, {
								ambush: game.ambush,
							}),
							create(Scroll, {
								ambush: game.ambush,
								quiz: game.quiz,
								label: 'AMBUSH',
								commit: () => { commitAmbush(game) },
								held: () => game.run.value.phase !== 'ambush' || game.run.value.countdown > 0 || game.ambush.value.openingLeft > 0,
							}),
						],
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

		// Where the ambush shows the ninjas closing in: the fight below the scroll when there is room,
		// the duel strip above it when there isn't. The layout and the world's framing both follow it.
		let room: AmbushRoom = noRoom
		resizeObserver({
			targets: run,
			signal,
			on: {
				resize() {
					room = ambushRoomOf(run.clientWidth, run.clientHeight)
					run.style.setProperty('--room-below', `${room.below}px`)
					run.style.setProperty('--strip-height', `${room.strip}px`)
				},
			},
		})

		show((viewport) => createRunWorld(game, viewport, () => room.below), signal)
	},
})
