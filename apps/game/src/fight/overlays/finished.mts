/**
 * 7 Finished ([screens.md](../../../../../docs/design/screens.md#7-finished-results-and-mistakes)):
 * the quiz is passed. The score, and the high score it beat; correct, time and distance; the
 * mistakes scroll; then Next stage.
 */

import { component } from '@rooted/components'
import { formatDuration, formatWhole } from '../../_shared/numbers.mts'
import { selection, stageNames, stages } from '../../_shared/state/selection.mts'
import { snapshot } from '../../_shared/state/store.mts'
import type { QuizActions, QuizState } from '../../_shared/state/quiz.mts'
import type { RunGame } from '../state/game.mts'
import { pointsIn, pointsPerCorrect } from '../state/score.mts'
import { AfterRun } from './after-run.mts'
import { Mistakes } from './mistakes.mts'
import { StatTile } from './stat-tile.mts'
import styles from './overlays.css'

export type FinishedOptions = {
	readonly game: RunGame
	readonly restart: () => void
}

export const Finished = component<FinishedOptions>({
	name: 'finished',
	styles,
	onMount({ append, create, element, options }) {
		const { game } = options
		const { quiz, refs } = snapshot<QuizState & QuizActions>(game.quiz)
		if (quiz === undefined) return

		const { points, correct, best, newBest } = game.score.value
		const { elapsed, stageLength } = game.run.value
		const total = pointsIn(quiz, refs)
		const misses = game.quiz.value.misses()
		// The same quiz on the next stage (docs/plan.md#open-questions), or this one again after the last.
		const next = stages[stages.indexOf(selection.value.stage) + 1]

		append(
			element('section', {
				classes: styles.results,
				'data-outcome': 'finished',
				children: element('div', {
					classes: styles.page,
					children: [
						element('header', {
							classes: styles.header,
							children: [
								element('span', {
									classes: styles.seal,
									lang: 'ja',
									textContent: '勝',
									aria: {
										hidden: 'true',
									},
								}),
								element('div', {
									classes: styles.headline,
									children: [
										element('h1', {
											classes: styles.verdict,
											textContent: newBest ? 'Quiz passed · new high score' : 'Quiz passed',
										}),
										element('span', {
											classes: styles.total,
											children: [
												formatWhole(points),
												best === undefined
													? undefined
													: element('span', {
														classes: styles.was,
														textContent: newBest ? `was ${formatWhole(best.points)}` : `best ${formatWhole(best.points)}`,
													}),
											],
										}),
										element('span', {
											classes: styles.summary,
											textContent: `${correct} / ${total} correct (${Math.round((correct / total) * 100)}%) · ${formatDuration(elapsed)}`,
										}),
									],
								}),
							],
						}),
						element('div', {
							classes: styles.tiles,
							children: [
								create(StatTile, {
									label: 'Correct',
									value: formatWhole(points),
									note: `${correct} × ${pointsPerCorrect}`,
								}),
								create(StatTile, {
									label: 'Time',
									value: formatDuration(elapsed),
									note: 'breaks a tie',
								}),
								create(StatTile, {
									label: 'Distance',
									value: `${formatWhole(stageLength)} m`,
									note: 'stage cleared',
								}),
							],
						}),
						create(Mistakes, {
							title: 'Mistakes',
							quiz,
							misses,
							open: true,
						}),
						create(AfterRun, {
							misses: misses.length,
							next: next === undefined
								? {
									label: 'Run again',
									action: options.restart,
								}
								: {
									label: 'Next stage',
									note: stageNames[next],
									action: () => {
										selection.value.chooseStage(next)
										options.restart()
									},
								},
						}),
					],
				}),
			})
		)
	},
})
