/**
 * The run's screen. It owns the run's game state for as long as it is mounted: created on mount,
 * dropped on unmount, so nothing carries over into the next run or the dojo. It puts the run's
 * world on the canvas, plugs the run into the game loop, and holds one empty layer per part of
 * the HUD for the tracks to fill ([layers](../../../../../docs/architecture/rendering.md#layers)).
 *
 * In dev builds, `/run/?fixture=<name>` starts from a fixture instead of a fresh run.
 */

import { component, environment } from '@rooted/components'
import { href, navigate } from '@rooted/router'
import { fixtureFromUrl } from '../../fixtures/index.mts'
import { fixtureQuiz } from '../../fixtures/quiz.mts'
import { startRun, tickRun } from '../../flows/run/run.mts'
import { play } from '../../loop.mts'
import { createRunWorld } from '../../render/run/world.mts'
import { show } from '../../render/stage.mts'
import { createRunGame, type RunGame } from '../../state/run/game.mts'
import { selection } from '../../state/selection.mts'
import { SelectRoute } from '../select/_routes.mts'
import styles from './run.css'

/** The run's layers over the canvas, back to front. */
export const runLayers = ['hud', 'scroll', 'swipe', 'overlays'] as const

export type RunLayer = (typeof runLayers)[number]

/** Starts a fresh run on the chosen quiz, or returns `undefined` when there is none yet. */
function freshRun(): RunGame | undefined {
	// In dev a run can start straight from the title screen, on the fixture quiz.
	const quiz = selection.get().quiz ?? (import.meta.env.DEV ? fixtureQuiz : undefined)
	if (quiz === undefined) return undefined
	const game = createRunGame()
	startRun(game, quiz)
	return game
}

export const RunScreen = component({
	name: 'bunbu-run',
	styles,
	onMount({ append, element, signal }) {
		// A run is the player's own, so the page built at build time is the empty frame.
		if (environment.is('preRenderer')) return

		const fixture = fixtureFromUrl(window.location.search)
		const game = fixture === undefined ? freshRun() : createRunGame(fixture)
		if (game === undefined) {
			navigate.replace(href.for(SelectRoute))
			return
		}

		show((camera) => createRunWorld(game, camera), signal)
		play({
			update: (dt) => { tickRun(game, dt) },
			paused: () => game.run.get().phase === 'paused',
			worldScale: () => game.run.get().worldScale,
			pause: () => { game.run.pause() },
		}, signal)

		const run = append(element('div', { classes: styles.run }))
		for (const name of runLayers) {
			const layer = element('div', { classes: [styles.layer, styles[name]] })
			layer.dataset.layer = name
			run.append(layer)
		}
		// The tracks mount here, one line each, handing their component the `game`.
	},
})
