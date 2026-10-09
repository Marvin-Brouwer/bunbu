/**
 * The chosen quiz on the title screen: its title, and its high score with the correct answers and
 * run time, or that it has none yet. Share sends it on as a `.bunbu` file.
 */

import type { BunbuData } from '@bunbu/data'
import { component } from '@rooted/components'
import { highScores } from '../fight/state/highscores.mts'
import { formatDuration, formatWhole } from '../_shared/numbers.mts'
import { ShareQuizButton } from './share-quiz-button.mts'
import styles from './title.css'

export type ChosenQuizCardOptions = {
	readonly quiz: BunbuData
}

export const ChosenQuizCard = component<ChosenQuizCardOptions>({
	name: 'chosen-quiz-card',
	styles,
	onMount({ append, create, element, options }) {
		const { quiz } = options
		const best = highScores.value.of(quiz.id, quiz.version)

		append(
			element('div', {
				classes: [
					styles.panel,
					styles.chosenQuiz,
				],
				children: [
					element('div', {
						classes: styles.chosenDetails,
						children: [
							element('span', {
								classes: styles.label,
								textContent: 'Quiz',
							}),
							element('span', {
								classes: styles.quizTitle,
								textContent: quiz.title,
							}),
							best === undefined
								? element('span', {
									classes: styles.note,
									textContent: 'No high score yet',
								})
								: element('span', {
									classes: styles.score,
									children: [
										element('span', {
											classes: styles.points,
											textContent: formatWhole(best.points),
										}),
										element('span', {
											classes: styles.note,
											textContent: `high score · ${best.correct} / ${best.answered} correct · ${formatDuration(best.seconds)}`,
										}),
									],
								}),
						],
					}),
					create(ShareQuizButton, {
						quiz,
					}),
				],
			})
		)
	},
})
