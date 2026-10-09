/**
 * 2 Quiz + stage ([screens.md](../../../../../docs/design/screens.md#2-quiz--stage)): "Choose your
 * path". The quiz, the stage and the difficulty, then **Start run**.
 */

import { component } from '@rooted/components'
import { href } from '@rooted/router'
import { DifficultyPicker } from '../../_shared/menu/difficulty-picker.mts'
import { MenuButton } from '../../_shared/menu/menu-button.mts'
import { MenuScreen } from '../../_shared/menu/menu-screen.mts'
import { MenuSection } from '../../_shared/menu/menu-section.mts'
import { selection, type SelectionState } from '../../_shared/state/selection.mts'
import { snapshot } from '../../_shared/state/store.mts'
import { fixtureQuiz } from '../../_temp/quiz.mts'
import { QuizShelf } from './quiz-shelf.mts'
import { fightable } from './read-quiz.mts'
import { StagePicker } from './stage-picker.mts'
import styles from './select.css'

export type SelectOptions = {
	/** Starts a run on the chosen quiz and stage. */
	readonly start: () => void
}

export const Select = component<SelectOptions>({
	name: 'select',
	styles,
	onMount({ append, create, element, options, signal }) {
		// In dev a run can start without loading a quiz first, on the fixture quiz.
		if (import.meta.env.DEV && selection.value.quiz === undefined) selection.value.chooseQuiz(fixtureQuiz)

		const start = element('div', {
			classes: styles.startButton,
		})
		// Start run waits for a quiz that a fight can ask.
		const showStart = () => {
			const { quiz } = snapshot<SelectionState>(selection)
			start.replaceChildren(
				create(MenuButton, {
					kind: 'primary',
					label: 'Start run',
					action: options.start,
					disabled: quiz === undefined || !fightable(quiz),
				}),
			)
		}

		append(
			create(MenuScreen, {
				title: 'Choose your path',
				back: href.path('/'),
				children: [
					create(MenuSection, {
						label: '1 · Quiz',
						children: create(QuizShelf),
					}),
					create(MenuSection, {
						label: '2 · Stage',
						children: create(StagePicker),
					}),
					element('div', {
						classes: styles.start,
						children: [
							create(DifficultyPicker, {
								name: 'difficulty',
							}),
							start,
						],
					}),
				],
			})
		)

		showStart()
		selection.on('change', signal, showStart)
	},
})
