/**
 * The difficulty, a slider from Apprentice to Shogun that sets how long an ambush waits
 * ([time limit](../../../../../docs/design/gameplay.md#time-limit)). The mark in the middle is the
 * default. On the fight screen and in the settings, both changing the same setting.
 */

import { component } from '@rooted/components'
import { placeOf, settings, timeScaleAt } from '../../settings/state/settings.mts'
import styles from './menu.css'

/** The slider's steps; the middle, the default, is one of them. */
const steps = 20

const percentOf = (timeScale: number) => `${Math.round(timeScale * 100)}%`
const stepOf = (timeScale: number) => String(Math.round(placeOf(timeScale) * steps))

export type DifficultySliderOptions = {
	/** Shows the difficulty without letting it change, as during a run. */
	readonly disabled?: boolean
}

export const DifficultySlider = component<DifficultySliderOptions>({
	name: 'difficulty-slider',
	styles,
	onMount({ append, element, options, signal }) {
		const time = element('output', {
			classes: styles.difficultyTime,
		})
		const slider = element('input', {
			type: 'range',
			min: '0',
			max: String(steps),
			step: '1',
			value: stepOf(settings.value.timeScale),
			disabled: options.disabled ?? false,
			aria: {
				label: 'Difficulty',
			},
			on: {
				input(event) {
					settings.value.setTimeScale(timeScaleAt(Number(event.currentTarget.value) / steps))
				},
			},
		})

		const describe = (timeScale: number) => {
			slider.setAttribute('aria-valuetext', `${percentOf(timeScale)} of the time`)
			time.textContent = percentOf(timeScale)
		}
		describe(settings.value.timeScale)

		append(
			element('div', {
				classes: styles.difficulty,
				children: [
					element('div', {
						classes: styles.difficultyEnds,
						children: [
							element('span', {
								textContent: 'Apprentice',
							}),
							element('span', {
								textContent: 'Shogun',
							}),
						],
					}),
					element('div', {
						classes: styles.difficultyTrack,
						children: [
							element('span', {
								classes: styles.difficultyMiddle,
								aria: {
									hidden: 'true',
								},
							}),
							slider,
						],
					}),
					element('p', {
						classes: styles.difficultyNote,
						children: [
							'Time to answer: ',
							time,
						],
					}),
				],
			}),
		)

		settings.on('change', signal, ({ detail }) => {
			slider.value = stepOf(detail.state.timeScale)
			describe(detail.state.timeScale)
		})
	},
})
