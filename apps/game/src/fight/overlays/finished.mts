/**
 * 7 Finished ([screens.md](../../../../../docs/design/screens.md#7-finished-results-and-mistakes)):
 * the quiz is passed. The score, and the high score it beat; correct, time and distance; the
 * mistakes; then Next stage, and Share beside Menu to dare a friend to beat it, all on one scroll
 * over the world. A run that didn't unlock the next stage offers Retry instead: as Samurai after
 * Apprentice, which unlocks none ([stages](../../../../../docs/design/gameplay.md#stages)).
 *
 * The run that unlocks endless shows a scroll that says so first, to start an endless run at once
 * or go on to the results ([endless](../../../../../docs/design/gameplay.md#endless)).
 */

import { component } from '@rooted/components'
import type { Path } from '@rooted/router'
import { formatDuration, formatWhole } from '../../_shared/numbers.mts'
import { builtStages, selection, stageNames, stages } from '../../_shared/state/selection.mts'
import { ScrollSheet } from '../../_shared/scroll/scroll-sheet.mts'
import { snapshot } from '../../_shared/state/store.mts'
import type { QuizActions, QuizState } from '../../_shared/state/quiz.mts'
import { difficultyNames, quizDifficulties } from '../state/difficulty.mts'
import type { RunGame } from '../state/game.mts'
import { stageResults } from '../state/stage-results.mts'
import { pointsIn, pointsPerCorrect } from '../state/score.mts'
import { AfterRun } from './after-run.mts'
import { MenuButton, type MenuButtonOptions } from '../../_shared/menu/menu-button.mts'
import { Mistakes } from './mistakes.mts'
import type { ScorePicture } from './score-picture.mts'
import { StatTile } from './stat-tile.mts'
import styles from './overlays.css'

export type FinishedOptions = {
	readonly game: RunGame
	readonly restart: () => void
	/** Leaves the run for another screen: Menu, Practise mistakes. */
	readonly leave: (to: Path) => void
}

export const Finished = component<FinishedOptions>({
	name: 'finished',
	styles,
	onMount({ create, element, options, replace }) {
		const { game } = options
		const { quiz, refs } = snapshot<QuizState & QuizActions>(game.quiz)
		if (quiz === undefined) return

		const { points, correct, best, newBest, unlocked, unlockedEndless } = game.score.value
		const { elapsed, stageLength, difficulty } = game.run.value
		const total = pointsIn(quiz, refs)
		const misses = game.quiz.value.misses()
		// The same quiz on the next stage that has a world (docs/plan.md#open-questions), or this one
		// again after the last. Passing has unlocked it, now or before.
		const next = stages.slice(stages.indexOf(selection.value.stage) + 1).find((stage) => builtStages.has(stage))
		const nextAction = ((): MenuButtonOptions & { hint?: string } => {
			if (next === undefined) return { label: 'Run again', action: options.restart }
			if (stageResults.value.unlocked(quiz.id, quiz.version, next)) {
				return {
					label: 'Next stage',
					note: next === unlocked ? `${stageNames[next]} · unlocked` : stageNames[next],
					action: () => {
						selection.value.chooseStage(next)
						options.restart()
					},
				}
			}
			// Cleared, but not so that it unlocks the next stage.
			if (difficulty === 'apprentice') {
				return {
					label: `Retry as ${difficultyNames.samurai}`,
					hint: `${difficultyNames.apprentice} unlocks no stages.`,
					action: () => {
						quizDifficulties.value.choose(quiz.id, quiz.version, 'samurai')
						options.restart()
					},
				}
			}
			return { label: 'Retry', hint: `Finish with half the life bar or more to unlock ${stageNames[next]}.`, action: options.restart }
		})()
		// The top of the results, which Share sends as a picture too.
		const picture: ScorePicture = {
			quizTitle: quiz.title,
			verdict: newBest ? 'Quiz passed · new high score' : 'Quiz passed',
			points: formatWhole(points),
			was: newBest && best !== undefined ? `was ${formatWhole(best.points)}` : undefined,
			// As on the title's quiz card; the time has a tile of its own.
			lines: [
				newBest || best === undefined
					? `high score · ${formatWhole(points)} · ${difficulty}`
					: `high score · ${formatWhole(best.points)} · ${best.difficulty}`,
				`correct · ${correct} / ${total}`,
			],
			tiles: [
				{
					label: 'Correct',
					value: formatWhole(points),
					note: `${correct} × ${pointsPerCorrect}`,
				},
				{
					label: 'Time',
					value: formatDuration(elapsed),
					note: 'breaks a tie',
				},
				{
					label: 'Distance',
					value: `${formatWhole(stageLength)} m`,
					note: 'stage cleared',
				},
			],
		}

		const showResults = () => replace(
			element('section', {
				classes: styles.results,
				'data-outcome': 'finished',
				children: create(ScrollSheet, {
					fill: true,
					unroll: true,
					children: element('div', {
						classes: styles.sheetBody,
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
													textContent: picture.verdict,
												}),
												element('span', {
													classes: styles.total,
													children: [
														picture.points,
														picture.was === undefined
															? undefined
															: element('span', {
																classes: styles.was,
																textContent: picture.was,
															}),
													],
												}),
												element('span', {
													classes: styles.summary,
													children: picture.lines.map((line) => element('span', {
														textContent: line,
													})),
												}),
											],
										}),
									],
								}),
								element('div', {
									classes: styles.tiles,
									children: picture.tiles.map((tile) => create(StatTile, tile)),
								}),
								create(Mistakes, {
									title: 'Mistakes',
									quiz,
									misses,
									open: true,
								}),
						],
					}),
					footer: create(AfterRun, {
						misses: misses.length,
						share: {
							quizId: quiz.id,
							picture,
						},
						leave: options.leave,
						next: nextAction,
						hint: nextAction.hint,
					}),
				}),
			})
		)

		// Endless unlocked: that first, on a scroll of its own.
		const showEndlessUnlocked = () => replace(
			element('section', {
				classes: styles.results,
				'data-outcome': 'endless-unlocked',
				children: create(ScrollSheet, {
					unroll: true,
					children: element('div', {
						classes: styles.sheetBody,
						children: element('header', {
							classes: styles.header,
							children: [
								element('span', {
									classes: styles.seal,
									lang: 'ja',
									textContent: '極',
									aria: {
										hidden: 'true',
									},
								}),
								element('div', {
									classes: styles.headline,
									children: [
										element('h1', {
											classes: styles.verdict,
											textContent: 'Endless unlocked',
										}),
										element('p', {
											classes: styles.summary,
											textContent: `Every stage cleared as ${difficultyNames.shogun}. In endless the stages run on into each other, every question once and then again, until you fall.`,
										}),
									],
								}),
							],
						}),
					}),
					footer: element('nav', {
						classes: styles.actions,
						children: [
							create(MenuButton, {
								label: 'Start endless run now',
								kind: 'primary',
								action: () => {
									selection.value.chooseEndless()
									options.restart()
								},
							}),
							create(MenuButton, {
								label: 'See the results',
								action: showResults,
							}),
						],
					}),
				}),
			})
		)

		if (unlockedEndless) showEndlessUnlocked()
		else showResults()
	},
})
