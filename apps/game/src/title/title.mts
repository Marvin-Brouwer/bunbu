/**
 * 1 Title / menu ([screens.md](../../../../docs/design/screens.md#1-title--menu)), the router's
 * home at `/`: the name, the chosen quiz and its high score, and the way into a fight, the quizzes,
 * the dojo and the settings. Quizzes are chosen and loaded on a screen of their own, the stage and
 * the difficulty on the fight screen, since only a fight needs them.
 */

import { component } from '@rooted/components'
import { href } from '@rooted/router'
import { DojoRoute } from '../dojo/_routes.mts'
import { FightRoute } from '../fight/_routes.mts'
import { QuizzesRoute } from '../quizzes/_routes.mts'
import { SettingsRoute } from '../settings/_routes.mts'
import { MenuButton } from '../_shared/menu/menu-button.mts'
import { Placeholder } from '../_shared/placeholder.mts'
import { selection, type SelectionState } from '../_shared/state/selection.mts'
import { snapshot } from '../_shared/state/store.mts'
import { ChosenQuizCard } from './chosen-quiz-card.mts'
import styles from './title.css'

export const Title = component({
	name: 'title',
	styles,
	onMount({ append, create, element, signal }) {
		// The chosen quiz, Fight and Quizzes follow the choice. Without a quiz, Fight leads to the quizzes.
		const chosen = element('div', {
			classes: styles.chosen,
		})
		const showChosen = () => {
			const { quiz } = snapshot<SelectionState>(selection)
			chosen.replaceChildren(
				...quiz === undefined
					? [
						create(MenuButton, {
							kind: 'primary',
							label: 'Fight',
							note: 'Choose a quiz first',
							href: href.for(QuizzesRoute),
						}),
						create(MenuButton, {
							label: 'Quizzes',
							note: 'Choose or load a quiz',
							href: href.for(QuizzesRoute),
						}),
					]
					: [
						create(ChosenQuizCard, {
							quiz,
						}),
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
			)
		}

		append(
			element('section', {
				classes: styles.title,
				children: [
					element('h1', {
						classes: [
							styles.panel,
							styles.name,
						],
						children: [
							element('span', {
								classes: styles.kanji,
								lang: 'ja',
								textContent: '文武',
							}),
							element('span', {
								classes: styles.words,
								children: [
									element('span', {
										classes: styles.bunbu,
										textContent: 'Bunbu',
									}),
									element('span', {
										classes: styles.scholar,
										textContent: 'SHOGUN SCHOLAR',
									}),
								],
							}),
						],
					}),
					element('nav', {
						classes: styles.menu,
						children: [
							chosen,
							element('div', {
								classes: styles.pair,
								children: [
									create(MenuButton, {
										label: 'Dojo',
										href: href.for(DojoRoute),
									}),
									create(MenuButton, {
										label: 'Settings',
										href: href.for(SettingsRoute),
									}),
								],
							}),
						],
					}),
				],
			})
		)

		showChosen()
		selection.on('change', signal, showChosen)
	},
})

export const NotFound = component({
	name: 'not-found',
	onMount({ append, create }) {
		append(
			create(Placeholder, {
				title: 'Lost the path',
				note: 'There is nothing at this address.',
				links: [{ label: 'Back to the title', href: href.path('/') }],
			})
		)
	},
})
