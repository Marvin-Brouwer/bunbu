/**
 * One quiz on the quizzes screen: its title, version, pass mark and high score, or `new`, with
 * **Download** for its `.bunbu` file and **Remove**.
 */

import type { BunbuData } from '@bunbu/data'
import { component } from '@rooted/components'
import { ChoiceStamp } from '../_shared/menu/choice-stamp.mts'
import { formatWhole } from '../_shared/numbers.mts'
import { download, quizFileOf } from '../_shared/quiz/quiz-file.mts'
import { highScores } from '../fight/state/highscores.mts'
import { RemoveQuizButton } from './remove-quiz-button.mts'
import styles from './quiz-shelf.css'

export type QuizCardOptions = {
	readonly quiz: BunbuData
	readonly chosen: boolean
	readonly choose: () => void
	/** Takes the quiz out of the library. Without it there is no Remove, as for the dev fixture quiz. */
	readonly remove?: () => void
}

export const QuizCard = component<QuizCardOptions>({
	name: 'quiz-card',
	styles,
	onMount({ append, create, element, options }) {
		const { quiz, remove } = options
		const best = highScores.value.of(quiz.id, quiz.version)

		append(
			element('div', {
				classes: styles.card,
				children: [
					element('label', {
						classes: styles.cardChoose,
						children: [
							element('input', {
								type: 'radio',
								name: 'quiz',
								checked: options.chosen,
								on: {
									change: options.choose,
								},
							}),
							create(ChoiceStamp),
							element('span', {
								classes: styles.cardTitle,
								textContent: quiz.title,
							}),
							element('span', {
								classes: styles.cardNote,
								textContent: [
									`v${quiz.version}`,
									`pass ${quiz.passingScore}%`,
									best === undefined ? 'new' : `best ${formatWhole(best.points)}`,
								].join(' · '),
							}),
						],
					}),
					element('div', {
						classes: styles.cardActions,
						children: [
							element('button', {
								type: 'button',
								classes: styles.cardAction,
								children: [
									element('span', {
										classes: [
											styles.cardIcon,
											styles.downloadIcon,
										],
									}),
									'Download',
								],
								aria: {
									label: `Download ${quiz.title}`,
								},
								on: {
									click() {
										quizFileOf(quiz).then(download).catch((error: unknown) => {
											console.error('[bunbu] the quiz could not be packed', error)
										})
									},
								},
							}),
							remove === undefined
								? undefined
								: create(RemoveQuizButton, {
									quiz,
									remove,
								}),
						],
					}),
				],
			})
		)
	},
})
