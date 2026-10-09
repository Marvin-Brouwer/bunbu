/**
 * The fight route: the select screen, then the run in its place. The title's Run (`?run`) skips
 * the select screen when a quiz is chosen already. The run's game state is created
 * when the player starts and dropped when they leave the run or the route, so nothing carries over
 * into the next run, and a run can't be opened from a URL without a quiz.
 *
 * In dev builds, `/fight/?fixture=<name>` skips the select screen and starts from a fixture.
 */

import { component, environment } from '@rooted/components'
import { href, navigate } from '@rooted/router'
import { selection } from '../_shared/state/selection.mts'
import { snapshot } from '../_shared/state/store.mts'
import { fixtureFromUrl } from './_temp/fixtures.mts'
import { startRun } from './flows/run.mts'
import { FightRoute, runQuery } from './_routes.mts'
import { RunScreen } from './run.mts'
import { fightable } from './select/read-quiz.mts'
import { Select } from './select/select.mts'
import { createRunGame, type RunGame } from './state/game.mts'

export const Fight = component({
	name: 'fight',
	onMount({ create, replace }) {
		const showSelect = () => {
			replace(
				create(Select, {
					start,
				})
			)
		}

		const showRun = (game: RunGame) => {
			replace(
				create(RunScreen, {
					game,
					leave: showSelect,
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
			startRun(game, quiz)
			showRun(game)
		}

		// The page built at build time is the select screen; a run is the player's own.
		if (environment.is('preRenderer')) {
			showSelect()
			return
		}

		const fixture = fixtureFromUrl(window.location.search)
		if (fixture !== undefined) {
			showRun(createRunGame(fixture))
			return
		}

		if (!new URLSearchParams(window.location.search).has(runQuery)) {
			showSelect()
			return
		}
		// Off the address, so going back or reloading lands on the select screen, not in a new run.
		navigate.replace(href.for(FightRoute))
		start()
	},
})
