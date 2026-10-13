/**
 * The difficulty, a slider over four stops from Apprentice to Shogun that sets how long an ambush
 * waits ([time limit](../../../../../docs/design/gameplay.md#time-limit)). The stops between
 * the ends are marked; Samurai is where a new player starts.
 * Only on the fight setup, and kept per quiz: each test has its own difficulty.
 */

import { secondsOf, type BunbuData } from '@bunbu/data'
import { component } from '@rooted/components'
import { difficulties, difficultyNames, quizDifficulties, timeScales, type Difficulty } from '../../fight/state/difficulty.mts'
import styles from './menu.css'

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
 * What the slider says about a difficulty: its name, and the time per question when the quiz sets
 * one.
 */
function describe(quiz: BunbuData, difficulty: Difficulty): string {
	const { timePerQuestion } = quiz
	const seconds = timePerQuestion === undefined ? undefined : secondsOf(timePerQuestion)
	if (seconds === undefined) return difficultyNames[difficulty]
	return `${difficultyNames[difficulty]}: ${durationOf(seconds * timeScales[difficulty])} per question`
}

const placeOf = (difficulty: Difficulty) => difficulties.indexOf(difficulty) / (difficulties.length - 1)

export type DifficultySliderOptions = {
	/** The quiz the difficulty is chosen for. */
	readonly quiz: BunbuData
}

export const DifficultySlider = component<DifficultySliderOptions>({
	name: 'difficulty-slider',
	styles,
	onMount({ append, element, options, signal }) {
		const { quiz } = options
		const note = element('p', {
			classes: styles.sliderNote,
		})
		const slider = element('input', {
			type: 'range',
			min: '0',
			max: String(difficulties.length - 1),
			step: '1',
			value: String(difficulties.indexOf(quizDifficulties.value.of(quiz.id, quiz.version))),
			aria: {
				label: 'Difficulty',
			},
			on: {
				input(event) {
					const difficulty = difficulties[Number(event.currentTarget.value)]
					if (difficulty !== undefined) quizDifficulties.value.choose(quiz.id, quiz.version, difficulty)
				},
			},
		})
		const fill = element('span', {
			classes: styles.sliderFill,
			aria: {
				hidden: 'true',
			},
		})
		const show = (difficulty: Difficulty) => {
			slider.value = String(difficulties.indexOf(difficulty))
			fill.style.setProperty('--place', String(placeOf(difficulty)))
			slider.setAttribute('aria-valuetext', describe(quiz, difficulty))
			note.textContent = describe(quiz, difficulty)
		}
		show(quizDifficulties.value.of(quiz.id, quiz.version))

		// The stops between the ends, on the rail and under the red fill.
		const marks = difficulties.slice(1, -1).map((difficulty) => {
			const mark = element('span', {
				classes: styles.sliderMark,
				aria: {
					hidden: 'true',
				},
			})
			mark.style.setProperty('--place', String(placeOf(difficulty)))
			return mark
		})
		const track = element('div', {
			classes: styles.sliderTrack,
			children: [
				element('span', {
					classes: styles.sliderRail,
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
				classes: styles.slider,
				children: [
					element('div', {
						classes: styles.sliderEnds,
						children: [
							element('span', {
								textContent: difficultyNames.apprentice,
							}),
							element('span', {
								textContent: difficultyNames.shogun,
							}),
						],
					}),
					track,
					note,
				],
			}),
		)

		quizDifficulties.on('change', signal, () => {
			show(quizDifficulties.value.of(quiz.id, quiz.version))
		})
	},
})
