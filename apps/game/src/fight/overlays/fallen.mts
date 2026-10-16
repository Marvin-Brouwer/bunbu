/**
 * 8 Fallen ([screens.md](../../../../../docs/design/screens.md#8-fallen)): the life bar is empty and
 * the pass mark out of reach. How far the samurai got, the run's numbers (never a high score),
 * what cut him down, then Rise again.
 *
 * Endless always ends here ([endless](../../../../../docs/design/gameplay.md#endless)): then it
 * says which stage he fell in and how many questions he got through, and its score can be a high
 * score of endless's own.
 */

import { component } from '@rooted/components'
import type { Path } from '@rooted/router'
import { formatDuration, formatWhole } from '../../_shared/numbers.mts'
import { selection, stageNames } from '../../_shared/state/selection.mts'
import { ScrollSheet } from '../../_shared/scroll/scroll-sheet.mts'
import { snapshot } from '../../_shared/state/store.mts'
import { questionsAnswered, type QuizActions, type QuizState } from '../../_shared/state/quiz.mts'
import { answersOn, endlessStage, stageAt, stageQuestions } from '../flows/endless.mts'
import { isEndless } from '../flows/run.mts'
import type { RunGame } from '../state/game.mts'
import { pointsIn } from '../state/score.mts'
import { AfterRun } from './after-run.mts'
import { Mistakes } from './mistakes.mts'
import { StatTile } from './stat-tile.mts'
import styles from './overlays.css'

export type FallenOptions = {
	readonly game: RunGame
	readonly restart: () => void
	/** Leaves the run for another screen: Menu, Practise mistakes. */
	readonly leave: (to: Path) => void
}

export const Fallen = component<FallenOptions>({
	name: 'fallen',
	styles,
	onMount({ append, create, element, options }) {
		const { game } = options
		const { quiz, refs } = snapshot<QuizState & QuizActions>(game.quiz)
		if (quiz === undefined) return

		const { points, correct, answered, newBest, best } = game.score.value
		const { elapsed, distance, stageLength } = game.run.value
		const endless = isEndless(game)
		const total = pointsIn(quiz, refs)
		// Every point not missed yet, as if the rest of the run had gone perfectly.
		const bestPossible = Math.round(((total - (answered - correct)) / total) * 100)
		const misses = game.quiz.value.misses()
		const done = questionsAnswered(snapshot<QuizState & QuizActions>(game.quiz))
		const where = endless
			? `Endless · ${stageNames[endlessStage(stageAt(distance, stageQuestions(quiz), answersOn(done, true)))]} · ${formatWhole(done)} questions · ${formatWhole(Math.floor(distance))} m`
			: `${stageNames[selection.value.stage]} · ${formatWhole(Math.floor(distance))} of ${formatWhole(stageLength)} m`
		const scoreNote = !endless ? 'not a high score' : newBest ? 'new endless high score' : best === undefined ? 'endless' : `endless best ${formatWhole(best.points)}`

		append(
			element('section', {
				classes: styles.results,
				'data-outcome': 'fallen',
				children: create(ScrollSheet, {
					fill: true,
					unroll: true,
					children: element('div', {
						classes: styles.sheetBody,
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
											textContent: where,
										}),
										element('span', {
											classes: styles.why,
											textContent: endless
												? `life bar empty: ${quiz.passingScore}% of this stage is out of reach`
												: `life bar empty: ${quiz.passingScore}% is out of reach`,
										}),
									],
								}),
								element('div', {
									classes: styles.tiles,
									children: [
										create(StatTile, {
											label: 'Correct',
											value: `${correct} / ${answered}`,
											// In endless there is no end to be best at: how many questions instead.
											note: endless ? `${formatWhole(done)} questions` : `best possible ${bestPossible}%`,
										}),
										create(StatTile, {
											label: 'Run score',
											value: formatWhole(points),
											note: scoreNote,
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
						],
					}),
					footer: create(AfterRun, {
						misses: misses.length,
						leave: options.leave,
						next: {
							label: 'Rise again',
							action: options.restart,
						},
					}),
				}),
			})
		)
	},
})
