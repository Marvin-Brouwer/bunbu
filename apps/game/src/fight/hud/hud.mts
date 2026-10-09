/**
 * The run's HUD ([3 Running](../../../../../docs/design/screens.md#3-running)): the score with the
 * best to beat, the pause button, the life bar and the stage progress, plus the katana hit effect
 * on a hit. It only shows the run's stores; the pause button is its one control.
 */

import { component } from '@rooted/components'
import type { RunGame } from '../state/game.mts'
import { HitFlash } from './hit-flash.mts'
import { LifeBar } from './life-bar.mts'
import { PauseButton } from './pause-button.mts'
import { ScoreBox } from './score-box.mts'
import { StageProgress } from './stage-progress.mts'
import styles from './hud.css'

export type HudOptions = {
	readonly game: RunGame
}

export const Hud = component<HudOptions>({
	name: 'hud',
	styles,
	onMount({ append, create, element, options }) {
		const { game } = options

		append(
			element('div', {
				classes: styles.hud,
				children: [
					element('div', {
						classes: styles.top,
						children: [
							create(ScoreBox, {
								score: game.score,
							}),
							create(PauseButton, {
								run: game.run,
							}),
						],
					}),
					create(LifeBar, {
						life: game.life,
						quiz: game.quiz,
					}),
					create(StageProgress, {
						run: game.run,
						quiz: game.quiz,
					}),
				],
			})
		)
		append(
			create(HitFlash, {
				life: game.life,
			})
		)
	},
})
