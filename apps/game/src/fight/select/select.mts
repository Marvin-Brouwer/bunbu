/**
 * 2 Fight ([screens.md](../../../../../docs/design/screens.md#2-fight-setup)): "Choose your path".
 * The chosen quiz and how it fits in a fight, then the stage and the difficulty, which
 * only a fight needs, then **Start run**.
 */

import { component } from '@rooted/components'
import { href } from '@rooted/router'
import { DifficultyPicker } from '../../_shared/menu/difficulty-picker.mts'
import { MenuButton } from '../../_shared/menu/menu-button.mts'
import { MenuScreen } from '../../_shared/menu/menu-screen.mts'
import { MenuSection } from '../../_shared/menu/menu-section.mts'
import { formatWhole } from '../../_shared/numbers.mts'
import { FitNotice } from '../../_shared/quiz/quiz-notices.mts'
import { fightable, fitNotesOf } from '../../_shared/quiz/read-quiz.mts'
import { selection, type SelectionState } from '../../_shared/state/selection.mts'
import { snapshot } from '../../_shared/state/store.mts'
import { fixtureQuiz } from '../../_temp/quiz.mts'
import { QuizzesRoute } from '../../quizzes/_routes.mts'
import { highScores } from '../state/highscores.mts'
import { StagePicker } from './stage-picker.mts'
import styles from './select.css'

export type SelectOptions = {
	/** Starts a run on the chosen quiz and stage. */
	readonly start: () => void
}

export const Select = component<SelectOptions>({
	name: 'select',
	styles,
	onMount({ append, create, element, options }) {
		// In dev a run can start without loading a quiz first, on the fixture quiz.
		if (import.meta.env.DEV && selection.value.quiz === undefined) selection.value.chooseQuiz(fixtureQuiz)

		const { quiz } = snapshot<SelectionState>(selection)
		const title = href.path('/')

		// A fight opened without a quiz sends the player to choose one.
		if (quiz === undefined) {
			append(
				create(MenuScreen, {
					title: 'Choose your path',
					back: title,
					children: create(MenuSection, {
						label: 'Quiz',
						children: [
							element('p', {
								classes: styles.quizNote,
								textContent: 'Choose a quiz first.',
							}),
							create(MenuButton, {
								kind: 'primary',
								label: 'Choose a quiz',
								href: href.for(QuizzesRoute),
							}),
						],
					}),
				})
			)
			return
		}

		const best = highScores.value.of(quiz.id, quiz.version)

		append(
			create(MenuScreen, {
				title: 'Choose your path',
				back: title,
				children: [
					create(MenuSection, {
						label: 'Quiz',
						children: [
							element('div', {
								classes: styles.quiz,
								children: [
									element('span', {
										classes: styles.quizTitle,
										textContent: quiz.title,
									}),
									element('span', {
										classes: styles.quizNote,
										textContent: [
											`v${quiz.version}`,
											`pass ${quiz.passingScore}%`,
											best === undefined ? 'new' : `best ${formatWhole(best.points)}`,
										].join(' · '),
									}),
								],
							}),
							create(FitNotice, {
								notes: fitNotesOf(quiz),
							}),
						],
					}),
					create(MenuSection, {
						label: 'Stage',
						children: create(StagePicker),
					}),
					create(MenuSection, {
						label: 'Difficulty',
						children: create(DifficultyPicker, {
							name: 'difficulty',
						}),
					}),
					element('div', {
						classes: styles.start,
						children: create(MenuButton, {
							kind: 'primary',
							label: 'Start run',
							action: options.start,
							// An unplayable question can't be asked in a fight.
							disabled: !fightable(quiz),
						}),
					}),
				],
			})
		)
	},
})
