/**
 * 8 Fallen ([screens.md](../../../../../docs/design/screens.md#8-fallen)): the life bar is empty and
 * the pass mark out of reach. How far the samurai got, the run's numbers (never a high score),
 * what cut him down, then Rise again.
 */

import { component } from '@rooted/components'
import { formatDuration, formatWhole } from '../../_shared/numbers.mts'
import { selection, stageNames } from '../../_shared/state/selection.mts'
import { snapshot } from '../../_shared/state/store.mts'
import type { QuizActions, QuizState } from '../../_shared/state/quiz.mts'
import type { RunGame } from '../state/game.mts'
import { pointsIn } from '../state/score.mts'
import { AfterRun } from './after-run.mts'
import { Mistakes } from './mistakes.mts'
import { StatTile } from './stat-tile.mts'
import styles from './overlays.css'

export type FallenOptions = {
	readonly game: RunGame
	readonly restart: () => void
}

export const Fallen = component<FallenOptions>({
	name: 'fallen',
	styles,
	onMount({ append, create, element, options }) {
		const { game } = options
		const { quiz, refs } = snapshot<QuizState & QuizActions>(game.quiz)
		if (quiz === undefined) return

		const { points, correct, answered } = game.score.value
		const { elapsed, distance, stageLength } = game.run.value
		const total = pointsIn(quiz, refs)
		// Every point not missed yet, as if the rest of the run had gone perfectly.
		const bestPossible = Math.round(((total - (answered - correct)) / total) * 100)
		const misses = game.quiz.value.misses()

		append(
			element('section', {
				classes: styles.results,
				'data-outcome': 'fallen',
				children: element('div', {
					classes: styles.page,
					children: [
						element('header', {
							classes: styles.fallen,
							children: [
								element('span', {
									classes: styles.fallenKanji,
									lang: 'ja',
									textContent: '散',
									aria: {
										hidden: 'true',
									},
								}),
								element('h1', {
									classes: styles.fallenTitle,
									textContent: 'Fallen',
								}),
								element('span', {
									classes: styles.where,
									textContent: `${stageNames[selection.value.stage]} · ${formatWhole(Math.floor(distance))} of ${formatWhole(stageLength)} m`,
								}),
								element('span', {
									classes: styles.why,
									textContent: `life bar empty: ${quiz.passingScore}% is out of reach`,
								}),
							],
						}),
						element('div', {
							classes: styles.tiles,
							children: [
								create(StatTile, {
									label: 'Correct',
									value: `${correct} / ${answered}`,
									note: `best possible ${bestPossible}%`,
								}),
								create(StatTile, {
									label: 'Run score',
									value: formatWhole(points),
									note: 'not a high score',
								}),
								create(StatTile, {
									label: 'Time',
									value: formatDuration(elapsed),
									note: `${answered} answered`,
								}),
							],
						}),
						create(Mistakes, {
							title: 'What cut you down',
							quiz,
							misses,
							open: false,
						}),
						create(AfterRun, {
							misses: misses.length,
							next: {
								label: 'Rise again',
								action: options.restart,
							},
						}),
					],
				}),
			})
		)
	},
})
