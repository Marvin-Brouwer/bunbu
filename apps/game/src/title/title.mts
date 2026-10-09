/**
 * 1 Title / menu ([screens.md](../../../../docs/design/screens.md#1-title--menu)), the router's
 * home at `/`: the name, the high score of the chosen quiz, and the way into a run, the dojo and
 * the settings.
 */

import { component } from '@rooted/components'
import { href } from '@rooted/router'
import { DojoRoute } from '../dojo/_routes.mts'
import { FightRoute, runNow } from '../fight/_routes.mts'
import { SettingsRoute } from '../settings/_routes.mts'
import { MenuButton } from '../_shared/menu/menu-button.mts'
import { Placeholder } from '../_shared/placeholder.mts'
import { selection, stageNames } from '../_shared/state/selection.mts'
import { HighScoreCard } from './high-score-card.mts'
import styles from './title.css'

export const Title = component({
	name: 'title',
	styles,
	onMount({ append, create, element }) {
		const { quiz, stage } = selection.value

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
							quiz === undefined
								? undefined
								: create(HighScoreCard, {
									quiz,
								}),
							create(MenuButton, {
								kind: 'primary',
								label: 'Run',
								// Without a quiz, the run starts by choosing one.
								note: quiz === undefined
									? 'Choose a quiz first'
									: `${quiz.title} · ${stageNames[stage]}`,
								href: quiz === undefined
									? href.for(FightRoute)
									: runNow(),
							}),
							create(MenuButton, {
								label: 'Quiz and stage',
								href: href.for(FightRoute),
							}),
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
