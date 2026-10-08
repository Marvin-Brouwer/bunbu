/**
 * The fight route: the select screen, then the run in its place. The run's game state is created
 * when the player starts and dropped when they leave the run or the route, so nothing carries over
 * into the next run, and a run can't be opened from a URL without a quiz.
 *
 * In dev builds, `/fight/?fixture=<name>` skips the select screen and starts from a fixture.
 */

import { component, environment } from '@rooted/components'
import { fixtureFromUrl } from '../../fixtures/index.mts'
import { startRun } from '../../flows/run/run.mts'
import { createRunGame, type RunGame } from '../../state/run/game.mts'
import { selection } from '../../state/selection.mts'
import { RunScreen } from './run.mts'
import { Select } from './select.mts'

export const Fight = component({
	name: 'bunbu-fight',
	onMount({ append, create, element }) {
		const view = append(
			element('div')
		)

		const showSelect = () => {
			view.replaceChildren(
				create(Select, {
					start
				})
			)
		}

		const showRun = (game: RunGame) => {
			view.replaceChildren(
				create(RunScreen, {
					game,
					leave: showSelect
				})
			)
		}

		function start() {
			const { quiz } = selection.get()
			if (quiz === undefined) return
			const game = createRunGame()
			startRun(game, quiz)
			showRun(game)
		}

		// The page built at build time is the select screen; a run is the player's own.
		const fixture = environment.is('preRenderer') ? undefined : fixtureFromUrl(window.location.search)
		if (fixture === undefined) showSelect()
		else showRun(createRunGame(fixture))
	},
})
