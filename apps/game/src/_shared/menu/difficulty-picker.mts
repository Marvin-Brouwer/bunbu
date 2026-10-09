/**
 * Novice / Adept / Master, which sets the ambush time limit
 * ([time limit](../../../../../docs/design/gameplay.md#time-limit)). On the quiz and stage select
 * and in the settings, both changing the same setting.
 */

import { component } from '@rooted/components'
import { settings, type Difficulty } from '../../settings/state/settings.mts'
import styles from './menu.css'

const difficulties: readonly { readonly value: Difficulty; readonly label: string }[] = [
	{ value: 'novice', label: 'Novice' },
	{ value: 'adept', label: 'Adept' },
	{ value: 'master', label: 'Master' },
]

export type DifficultyPickerOptions = {
	/** The radio group's name, unique on the screen. */
	readonly name: string
}

export const DifficultyPicker = component<DifficultyPickerOptions>({
	name: 'difficulty-picker',
	styles,
	onMount({ append, element, options, signal }) {
		const radios = difficulties.map(({ value }) => element('input', {
			type: 'radio',
			name: options.name,
			value,
			checked: settings.value.difficulty === value,
			on: {
				change() {
					settings.value.setDifficulty(value)
				},
			},
		}))

		append(
			element('div', {
				classes: styles.segments,
				role: 'radiogroup',
				aria: {
					label: 'Difficulty',
				},
				children: difficulties.map(({ label }, index) => element('label', {
					classes: styles.segment,
					children: [
						radios[index]!,
						label,
					],
				})),
			})
		)

		settings.on('change', signal, ({ detail }) => {
			radios.forEach((radio) => { radio.checked = radio.value === detail.state.difficulty })
		})
	},
})
