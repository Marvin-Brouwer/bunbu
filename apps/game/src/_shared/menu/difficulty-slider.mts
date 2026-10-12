/**
 * The difficulty, a slider over four stops from Apprentice to Shogun that sets how long an ambush
 * waits ([time limit](../../../../../docs/design/gameplay.md#time-limit)). The stops between
 * the ends are marked; Samurai is where a new player starts.
 * On the fight screen and in the settings, both changing the same setting.
 */

import { secondsOf } from '@bunbu/data'
import { component } from '@rooted/components'
import { difficulties, settings, timeScales, type Difficulty } from '../../settings/state/settings.mts'
import { selection } from '../state/selection.mts'
import styles from './menu.css'

const names: Readonly<Record<Difficulty, string>> = {
	apprentice: 'Apprentice',
	samurai: 'Samurai',
	daimyo: 'Daimyo',
	shogun: 'Shogun',
}

/** A time as the quiz format writes it, with spaces: `45s`, `2m 24s`, `1h 12m`. */
function durationOf(seconds: number): string {
	const whole = Math.round(seconds)
	const parts = [
		[Math.floor(whole / 3600), 'h'],
		[Math.floor(whole / 60) % 60, 'm'],
		[whole % 60, 's'],
	] as const
	return parts.filter(([amount]) => amount > 0).map(([amount, unit]) => `${amount}${unit}`).join(' ')
}

/**
 * What the slider says about a difficulty: its name, and the time per question when the chosen
 * quiz sets one.
 */
function describe(difficulty: Difficulty): string {
	const timePerQuestion = selection.value.quiz?.timePerQuestion
	const seconds = timePerQuestion === undefined ? undefined : secondsOf(timePerQuestion)
	if (seconds === undefined) return names[difficulty]
	return `${names[difficulty]}: ${durationOf(seconds * timeScales[difficulty])} per question`
}

const placeOf = (difficulty: Difficulty) => difficulties.indexOf(difficulty) / (difficulties.length - 1)

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
		const fill = element('span', {
			classes: styles.difficultyFill,
			aria: {
				hidden: 'true',
			},
		})
		const show = (difficulty: Difficulty) => {
			slider.value = String(difficulties.indexOf(difficulty))
			fill.style.setProperty('--place', String(placeOf(difficulty)))
			slider.setAttribute('aria-valuetext', describe(difficulty))
			note.textContent = describe(difficulty)
		}
		show(settings.value.difficulty)

		// The stops between the ends, on the rail and under the red fill.
		const marks = difficulties.slice(1, -1).map((difficulty) => {
			const mark = element('span', {
				classes: styles.difficultyMark,
				aria: {
					hidden: 'true',
				},
			})
			mark.style.setProperty('--place', String(placeOf(difficulty)))
			return mark
		})
		const track = element('div', {
			classes: styles.difficultyTrack,
			children: [
				element('span', {
					classes: styles.difficultyRail,
					aria: {
						hidden: 'true',
					},
				}),
				...marks,
				fill,
				slider,
			],
		})

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
