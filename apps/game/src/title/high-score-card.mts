/** The high score of the chosen quiz on the title screen, with its correct answers and run time. */

import type { BunbuData } from '@bunbu/data'
import { component } from '@rooted/components'
import { highScores } from '../fight/state/highscores.mts'
import { formatDuration, formatWhole } from '../_shared/numbers.mts'
import styles from './title.css'

export type HighScoreCardOptions = {
	readonly quiz: Pick<BunbuData, 'id' | 'version' | 'title'>
}

export const HighScoreCard = component<HighScoreCardOptions>({
	name: 'high-score-card',
	styles,
	onMount({ append, element, options }) {
		const { quiz } = options
		const best = highScores.value.of(quiz.id, quiz.version)
		if (best === undefined) return

		append(
			element('div', {
				classes: [
					styles.panel,
					styles.score,
				],
				children: [
					element('span', {
						classes: styles.label,
						textContent: `High score · ${quiz.title}`,
					}),
					element('span', {
						classes: styles.points,
						textContent: formatWhole(best.points),
					}),
					element('span', {
						classes: styles.note,
						textContent: `${best.correct} / ${best.answered} correct · ${formatDuration(best.seconds)}`,
					}),
				],
			})
		)
	},
})
