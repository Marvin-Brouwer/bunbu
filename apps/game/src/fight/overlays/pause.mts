/**
 * 6 Pause ([screens.md](../../../../../docs/design/screens.md#6-pause)): a scroll over the dimmed
 * world with this run so far, and Resume, Restart stage, Settings and Quit at its foot. The
 * settings open in place on the scroll, so changing one doesn't end the run.
 */

import { component } from '@rooted/components'
import { MenuButton } from '../../_shared/menu/menu-button.mts'
import { SettingsForm } from '../../_shared/menu/settings-form.mts'
import { formatWhole } from '../../_shared/numbers.mts'
import { ScrollSheet } from '../../_shared/scroll/scroll-sheet.mts'
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

		const run = element('div', {
			classes: styles.sheetBody,
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
		})
		const heading = element('h2', {
			classes: styles.pauseTitle,
			textContent: 'Paused',
		})
		const body = element('div', {
			classes: styles.sheetBody,
		})
		const menu = element('div', {
			classes: styles.actions,
		})

		const showMenu = () => {
			heading.textContent = 'Paused'
			body.replaceChildren(run)
			menu.replaceChildren(
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
			heading.textContent = 'Settings'
			body.replaceChildren(
				create(SettingsForm, {
					running: true,
				}),
			)
			menu.replaceChildren(
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
				children: create(ScrollSheet, {
					unroll: true,
					children: element('div', {
						classes: styles.sheetBody,
						children: [
							heading,
							body,
						],
					}),
					footer: menu,
				}),
			})
		)
		showMenu()
	},
})
