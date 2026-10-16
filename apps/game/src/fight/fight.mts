/**
 * The fight route: the select screen, then the run in its place. The run's game state is created
 * when the player starts and dropped when they leave the run or the route, so nothing carries over
 * into the next run, and a run can't be opened from a URL without a quiz.
 *
 * The run's screen comes first and the run starts once its world has loaded, so the samurai runs
 * into a world that is all there.
 */

import { component } from '@rooted/components'
import { selection } from '../_shared/state/selection.mts'
import { snapshot } from '../_shared/state/store.mts'
import { startRun } from './flows/run.mts'
import { RunScreen } from './run.mts'
import { fightable } from '../_shared/quiz/read-quiz.mts'
import { Select } from './select/select.mts'
import { createRunGame, type RunGame } from './state/game.mts'
import { runWorldLoaded } from './world/world.mts'
import { endlessStage } from './flows/endless.mts'

export const Fight = component({
	name: 'fight',
	onMount({ create, replace, signal }) {
		// The run on screen, if any: the start of one that was replaced before its world loaded is dropped.
		let shown: RunGame | undefined

		const showSelect = () => {
			shown = undefined
			replace(
				create(Select, {
					start,
				})
			)
		}

		const showRun = (game: RunGame) => {
			shown = game
			replace(
				create(RunScreen, {
					game,
					restart: start,
				})
			)
		}

		function start() {
			const { quiz } = snapshot(selection)
			if (quiz === undefined || !fightable(quiz)) {
				showSelect()
				return
			}
			const game = createRunGame()
			showRun(game)
			// Endless starts in the first stage, whichever stage was chosen before it.
			void runWorldLoaded(selection.value.endless ? endlessStage(0) : selection.value.stage).then(() => {
				// A frame with the models in first, so the intro doesn't start on the one that sets them up.
				requestAnimationFrame(() => {
					if (signal.aborted || game !== shown) return
					startRun(game, quiz, Math.random)
				})
			})
		}

		// The select screen first, also on the page built at build time: a run is the player's own.
		showSelect()
	},
})
