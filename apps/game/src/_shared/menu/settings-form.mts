/**
 * The settings: difficulty, haptics and volume, kept for every run. On the settings screen, and in
 * the pause menu without leaving the run ([6 Pause](../../../../../docs/design/screens.md#6-pause)).
 */

import { component } from '@rooted/components'
import { settings } from '../../settings/state/settings.mts'
import { DifficultyPicker } from './difficulty-picker.mts'
import { MenuSection } from './menu-section.mts'
import styles from './settings-form.css'

const percentOf = (volume: number) => `${Math.round(volume * 100)}%`

export const SettingsForm = component({
	name: 'settings-form',
	styles,
	onMount({ append, create, element }) {
		const percent = element('span', {
			classes: styles.percent,
			textContent: percentOf(settings.value.volume),
		})

		append(
			create(MenuSection, {
				label: 'Difficulty',
				children: [
					create(DifficultyPicker, {
						name: 'difficulty',
					}),
					element('p', {
						classes: styles.hint,
						textContent: 'How long an ambush waits for your answer. Novice has no time limit, Adept gives you half again as long as Master.',
					}),
				],
			}),
			create(MenuSection, {
				label: 'Haptics',
				children: [
					element('label', {
						classes: styles.toggle,
						children: [
							'Buzz when you are hit',
							element('input', {
								type: 'checkbox',
								checked: settings.value.haptics,
								on: {
									change(event) {
										settings.value.setHaptics(event.currentTarget.checked)
									},
								},
							}),
						],
					}),
					element('p', {
						classes: styles.hint,
						textContent: 'Not every phone or browser can buzz.',
					}),
				],
			}),
			create(MenuSection, {
				label: 'Volume',
				children: [
					element('label', {
						classes: styles.volume,
						children: [
							element('input', {
								type: 'range',
								min: '0',
								max: '100',
								step: '1',
								value: String(Math.round(settings.value.volume * 100)),
								aria: {
									label: 'Volume',
								},
								on: {
									input(event) {
										settings.value.setVolume(Number(event.currentTarget.value) / 100)
										percent.textContent = percentOf(settings.value.volume)
									},
								},
							}),
							percent,
						],
					}),
					element('p', {
						classes: styles.hint,
						textContent: 'The game has no sound yet.',
					}),
				],
			}),
		)
	},
})
