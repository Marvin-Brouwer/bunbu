/**
 * One quiz on the quizzes screen: its title, version, pass mark and high score, or `new`, and
 * **Remove**, which asks for a second tap before it does.
 */

import type { BunbuData } from '@bunbu/data'
import { component } from '@rooted/components'
import { formatWhole } from '../_shared/numbers.mts'
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
					remove === undefined
						? undefined
						: create(RemoveQuizButton, {
							title: quiz.title,
							remove,
						}),
				],
			})
		)
	},
})
