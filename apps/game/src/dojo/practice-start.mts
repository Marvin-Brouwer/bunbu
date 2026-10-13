/**
 * D3 Practice start ([screens.md](../../../../docs/design/screens.md#d3-practice-start)): the quiz,
 * how many questions and whether only the mistakes are asked, over the dojo world with the training
 * dummy; then what practice leaves out, and **Start**. Not play yet: no full screen until Start.
 */

import { component } from '@rooted/components'
import { href } from '@rooted/router'
import { BackLink } from '../_shared/menu/back-link.mts'
import { MenuButton } from '../_shared/menu/menu-button.mts'
import menuStyles from '../_shared/menu/menu.css'
import { formatWhole } from '../_shared/numbers.mts'
import { DojoRoute, withMistakes } from './_routes.mts'
import styles from './practice.css'

export type PracticeStartOptions = {
	readonly title: string
	readonly questions: number
	readonly mistakesOnly: boolean
	readonly start: () => void
}

export const PracticeStart = component<PracticeStartOptions>({
	name: 'practice-start',
	styles,
	onMount({ append, create, element, options }) {
		const { questions, mistakesOnly } = options

		append(
			element('section', {
				classes: styles.start,
				children: [
					element('header', {
						classes: [
							styles.panel,
							styles.startHeader,
						],
						children: [
							create(BackLink, {
								// Back to the menu as it was left, the mistakes ticked or not.
								target: withMistakes(href.for(DojoRoute), mistakesOnly),
							}),
							element('div', {
								children: [
									element('h1', {
										classes: menuStyles.title,
										textContent: 'Practice',
									}),
									element('p', {
										classes: styles.startNote,
										textContent: [
											options.title,
											`${formatWhole(questions)} ${questions === 1 ? 'question' : 'questions'}`,
											`mistakes only: ${mistakesOnly ? 'on' : 'off'}`,
										].join(' · '),
									}),
								],
							}),
						],
					}),
					element('div', {
						classes: styles.startFooter,
						children: [
							element('p', {
								classes: [
									styles.panel,
									styles.startRules,
								],
								textContent: 'no timer · no life bar · no score',
							}),
							create(MenuButton, {
								kind: 'primary',
								label: 'Start',
								action: options.start,
								disabled: questions === 0,
							}),
						],
					}),
				],
			})
		)
	},
})
