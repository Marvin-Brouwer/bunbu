/**
 * The difficulty, a slider over four stops from Apprentice to Shogun that sets how long an ambush
 * waits ([time limit](../../../../../docs/design/gameplay.md#time-limit)). The default is marked.
 * On the fight screen and in the settings, both changing the same setting.
 */

import { component } from '@rooted/components'
import { difficulties, settings, timeScales, type Difficulty } from '../../settings/state/settings.mts'
import styles from './menu.css'

const names: Readonly<Record<Difficulty, string>> = {
	apprentice: 'Apprentice',
	default: 'Default',
	experienced: 'Experienced',
	shogun: 'Shogun',
}

/** What the slider says about a difficulty: its name and its share of the time. */
const describe = (difficulty: Difficulty) => `${names[difficulty]}: ${Math.round(timeScales[difficulty] * 100)}% of the time`

/** Where the default sits on the track, from `0` to `1`. */
const defaultPlace = String(difficulties.indexOf('default') / (difficulties.length - 1))

export type DifficultySliderOptions = {
	/** Shows the difficulty without letting it change, as during a run. */
	readonly disabled?: boolean
}

export const DifficultySlider = component<DifficultySliderOptions>({
	name: 'difficulty-slider',
	styles,
	onMount({ append, element, options, signal }) {
		const note = element('p', {
			classes: styles.difficultyNote,
		})
		const slider = element('input', {
			type: 'range',
			min: '0',
			max: String(difficulties.length - 1),
			step: '1',
			value: String(difficulties.indexOf(settings.value.difficulty)),
			disabled: options.disabled ?? false,
			aria: {
				label: 'Difficulty',
			},
			on: {
				input(event) {
					const difficulty = difficulties[Number(event.currentTarget.value)]
					if (difficulty !== undefined) settings.value.setDifficulty(difficulty)
				},
			},
		})
		const show = (difficulty: Difficulty) => {
			slider.value = String(difficulties.indexOf(difficulty))
			slider.setAttribute('aria-valuetext', describe(difficulty))
			note.textContent = describe(difficulty)
		}
		show(settings.value.difficulty)

		const track = element('div', {
			classes: styles.difficultyTrack,
			children: [
				element('span', {
					classes: styles.difficultyDefault,
					aria: {
						hidden: 'true',
					},
				}),
				slider,
			],
		})
		track.style.setProperty('--default-place', defaultPlace)

		append(
			element('div', {
				classes: styles.difficulty,
				children: [
					element('div', {
						classes: styles.difficultyEnds,
						children: [
							element('span', {
								textContent: names.apprentice,
							}),
							element('span', {
								textContent: names.shogun,
							}),
						],
					}),
					track,
					note,
				],
			}),
		)

		settings.on('change', signal, ({ detail }) => {
			show(detail.state.difficulty)
		})
	},
})
