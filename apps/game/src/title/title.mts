/**
 * 1 Title / menu ([screens.md](../../../../docs/design/screens.md#1-title--menu)), the router's
 * home at `/`: the name, the quiz card with the way into a fight and the quizzes, then the dojo, how
 * to play and the settings. Quizzes are chosen and loaded on a screen of their own, the stage and
 * the difficulty on the fight screen, since only a fight needs them.
 */

import { component, environment } from '@rooted/components'
import { resizeObserver } from '@rooted/observers'
import { href, Link } from '@rooted/router'
import { CreditsRoute, HowToPlayRoute } from '../about/_routes.mts'
import { DojoRoute } from '../dojo/_routes.mts'
import { SettingsRoute } from '../settings/_routes.mts'
import { MenuButton } from '../_shared/menu/menu-button.mts'
import { Placeholder } from '../_shared/placeholder.mts'
import { selection, type SelectionState } from '../_shared/state/selection.mts'
import { snapshot } from '../_shared/state/store.mts'
import { library } from '../_shared/storage/library.mts'
import { show } from '../canvas/stage.mts'
import { ChosenQuizCard } from './chosen-quiz-card.mts'
import { UpdateNotice } from './update-notice.mts'
import type { Gap } from './framing.mts'
import { createTitleWorld } from './world.mts'
import styles from './title.css'

export const Title = component({
	name: 'title',
	styles,
	onMount({ append, create, element, signal }) {
		// The quiz card follows the choice. It says it is loading until the saved quizzes are back,
		// and always on the pre-rendered page, as the browser has to read them first.
		const chosen = element('div', {
			classes: styles.chosen,
		})
		const showChosen = () => {
			const { quiz } = snapshot<SelectionState>(selection)
			const loading = environment.is('preRenderer') || !library.value.restored
			chosen.replaceChildren(
				create(ChosenQuizCard, {
					quiz: quiz ?? (loading ? 'loading' : undefined),
				})
			)
		}

		const name = element('h1', {
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
		})
		const menu = element('nav', {
			classes: styles.menu,
			children: [
				create(UpdateNotice),
				chosen,
				element('div', {
					classes: styles.row,
					children: [
						create(MenuButton, {
							label: 'Dojo',
							href: href.for(DojoRoute),
						}),
						create(MenuButton, {
							label: 'How to play',
							href: href.for(HowToPlayRoute),
						}),
						create(MenuButton, {
							label: 'Settings',
							href: href.for(SettingsRoute),
						}),
					],
				}),
				element('div', {
					classes: styles.pages,
					children: create(Link, {
						href: href.for(CreditsRoute),
						children: 'About the Bunbu app',
					}),
				}),
			],
		})
		const title = append(
			element('section', {
				classes: styles.title,
				children: [
					name,
					menu,
				],
			})
		)

		showChosen()
		selection.on('change', signal, showChosen)
		library.on('change', signal, showChosen)

		// The gap the name and the menu leave for the samurai, which the world frames him in. Also
		// on the screen as `--gap-top` and `--gap-height`, so tests can see it.
		let gap: Gap = { top: 0, height: window.innerHeight }
		let pending = 0
		const measure = () => {
			const top = name.getBoundingClientRect().bottom
			const bottom = Math.min(menu.getBoundingClientRect().top, window.innerHeight)
			gap = { top, height: Math.max(0, bottom - top) }
			title.style.setProperty('--gap-top', `${gap.top}px`)
			title.style.setProperty('--gap-height', `${gap.height}px`)
		}
		resizeObserver({
			targets: [title, name, menu],
			signal,
			on: {
				// On the next frame, not in the observer's callback, as the run does.
				resize() {
					cancelAnimationFrame(pending)
					pending = requestAnimationFrame(measure)
				},
			},
		})
		// When a tall menu makes the screen scroll, the gap moves without anything changing size.
		title.addEventListener('scroll', () => {
			cancelAnimationFrame(pending)
			pending = requestAnimationFrame(measure)
		}, { passive: true, signal })
		signal.addEventListener('abort', () => { cancelAnimationFrame(pending) }, { once: true })
		show((viewport) => createTitleWorld(viewport, () => gap), signal)
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
