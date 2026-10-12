/**
 * The quiz card on the title screen, and the way into a fight. While the saved quizzes come back it
 * says so; without a quiz it leads to the quizzes to select one. With one: its title, its high score
 * with the correct answers and run time (or that it has none yet), Share, which sends it on as a
 * `.bunbu` file, and Fight with Change quiz under it.
 */

import type { BunbuData } from '@bunbu/data'
import { component } from '@rooted/components'
import { href } from '@rooted/router'
import { FightRoute } from '../fight/_routes.mts'
import { highScores } from '../fight/state/highscores.mts'
import { QuizzesRoute } from '../quizzes/_routes.mts'
import { MenuButton } from '../_shared/menu/menu-button.mts'
import { formatDuration, formatWhole } from '../_shared/numbers.mts'
import { ShareQuizButton } from './share-quiz-button.mts'
import styles from './title.css'

export type ChosenQuizCardOptions = {
	/** The chosen quiz, `'loading'` while the saved quizzes come back, or `undefined` when there is none. */
	readonly quiz: BunbuData | 'loading' | undefined
}

export const ChosenQuizCard = component<ChosenQuizCardOptions>({
	name: 'chosen-quiz-card',
	styles,
	onMount({ append, create, element, options }) {
		const { quiz } = options
		const label = element('span', {
			classes: styles.label,
			textContent: 'Quiz',
		})

		if (quiz === 'loading' || quiz === undefined) {
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
								label,
								element('span', {
									classes: styles.note,
									textContent: quiz === 'loading' ? 'Loading…' : 'No quiz chosen yet',
								}),
							],
						}),
						quiz === 'loading'
							? undefined
							: element('div', {
								classes: styles.chosenActions,
								children: create(MenuButton, {
									kind: 'primary',
									label: 'Select quiz',
									href: href.for(QuizzesRoute),
								}),
							}),
					],
				})
			)
			return
		}

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
							label,
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
					element('div', {
						classes: styles.chosenActions,
						children: [
							create(MenuButton, {
								kind: 'primary',
								label: 'Fight',
								href: href.for(FightRoute),
							}),
							create(MenuButton, {
								label: 'Change quiz',
								href: href.for(QuizzesRoute),
							}),
						],
					}),
				],
			})
		)
	},
})
