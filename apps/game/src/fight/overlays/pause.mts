/**
 * 6 Pause ([screens.md](../../../../../docs/design/screens.md#6-pause)): this run so far, then
 * Resume, Restart stage, Settings and Quit over the dimmed world. The settings open in place, so
 * changing one doesn't end the run.
 */

import { component } from '@rooted/components'
import { MenuButton } from '../../_shared/menu/menu-button.mts'
import { SettingsForm } from '../../_shared/menu/settings-form.mts'
import { formatWhole } from '../../_shared/numbers.mts'
import { selection, stageNames } from '../../_shared/state/selection.mts'
import type { RunGame } from '../state/game.mts'
import styles from './overlays.css'

export type PauseOptions = {
	readonly game: RunGame
	readonly restart: () => void
	readonly leave: () => void
}

export const Pause = component<PauseOptions>({
	name: 'pause',
	styles,
	onMount({ append, create, element, options }) {
		const { game } = options
		const { quiz, answered, refs } = game.quiz.value

		const fact = (term: string, value: string) => element('div', {
			classes: styles.fact,
			children: [
				element('dt', {
					textContent: term,
				}),
				element('dd', {
					textContent: value,
				}),
			],
		})

		const menu = element('div', {
			classes: [
				styles.panel,
				styles.menu,
			],
		})

		const showMenu = () => {
			menu.replaceChildren(
				element('h2', {
					classes: styles.heading,
					textContent: 'Paused',
				}),
				create(MenuButton, {
					kind: 'primary',
					label: 'Resume',
					action: () => { game.run.value.resume() },
				}),
				create(MenuButton, {
					label: 'Restart stage',
					action: options.restart,
				}),
				element('div', {
					classes: styles.pair,
					children: [
						create(MenuButton, {
							label: 'Settings',
							action: showSettings,
						}),
						create(MenuButton, {
							label: 'Quit',
							action: options.leave,
						}),
					],
				}),
				element('p', {
					classes: styles.note,
					textContent: 'Resuming counts down 3, 2, 1 first.',
				}),
			)
		}

		const showSettings = () => {
			menu.replaceChildren(
				element('h2', {
					classes: styles.heading,
					textContent: 'Settings',
				}),
				create(SettingsForm),
				create(MenuButton, {
					label: 'Back',
					action: showMenu,
				}),
			)
		}

		append(
			element('div', {
				classes: styles.pause,
				role: 'dialog',
				aria: {
					label: 'Paused',
					modal: 'true',
				},
				children: [
					element('section', {
						classes: styles.panel,
						children: [
							element('h2', {
								classes: styles.label,
								textContent: 'This run',
							}),
							element('dl', {
								classes: styles.facts,
								children: [
									fact('Quiz', quiz?.title ?? ''),
									fact('Stage', stageNames[selection.value.stage]),
									fact('Answered', `${answered} / ${refs.length}`),
									fact('Distance', `${formatWhole(Math.floor(game.run.value.distance))} m`),
								],
							}),
						],
					}),
					menu,
				],
			})
		)
		showMenu()
	},
})
