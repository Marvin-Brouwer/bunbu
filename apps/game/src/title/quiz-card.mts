/** One quiz on the title's shelf: its title, version, pass mark and high score, or `new`. */

import type { BunbuData } from '@bunbu/data'
import { component } from '@rooted/components'
import { formatWhole } from '../_shared/numbers.mts'
import { highScores } from '../fight/state/highscores.mts'
import styles from './quiz-shelf.css'

export type QuizCardOptions = {
	readonly quiz: BunbuData
	readonly chosen: boolean
	readonly choose: () => void
}

export const QuizCard = component<QuizCardOptions>({
	name: 'quiz-card',
	styles,
	onMount({ append, element, options }) {
		const { quiz } = options
		const best = highScores.value.of(quiz.id, quiz.version)

		append(
			element('label', {
				classes: styles.card,
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
			})
		)
	},
})
