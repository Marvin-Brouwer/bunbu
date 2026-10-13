/**
 * Reading aloud, in the dojo's study ([dojo](../../../../../docs/design/dojo.md#study)): the voice
 * for the chosen quiz's language and the speed, kept with the other settings.
 */

import { component, environment } from '@rooted/components'
import { languageOf, settings, speechRates } from '../../settings/state/settings.mts'
import { canSpeak, languageName, watchVoices } from '../speech/speaker.mts'
import { selection } from '../state/selection.mts'
import { MenuSection } from './menu-section.mts'
import styles from './menu.css'
import formStyles from './settings-form.css'

const rateOf = (rate: number) => `${rate}x speed`
const placeOf = (rate: number) => speechRates.indexOf(rate as (typeof speechRates)[number]) / (speechRates.length - 1)

/** The voices for the chosen quiz's language, or the browser's own when no quiz is chosen. */
export const VoiceSelect = component({
	name: 'voice-select',
	styles: formStyles,
	onMount({ append, element, signal }) {
		// The pre-rendered page has no browser to ask; it fills in once the app loads.
		const speaking = !environment.is('preRenderer') && canSpeak()
		const language = selection.value.quiz?.language ?? (environment.is('preRenderer') ? 'en' : navigator.language)

		const select = element('select', {
			classes: formStyles.select,
			disabled: !speaking,
			aria: {
				label: 'Voice',
			},
			on: {
				change(event) {
					const voice = event.currentTarget.value
					settings.value.chooseVoice(language, voice === '' ? undefined : voice)
				},
			},
		})
		const system = element('option', {
			value: '',
			textContent: `System voice · ${languageName(language)}`,
		})
		select.append(system)

		append(
			element('label', {
				classes: formStyles.selectGroup,
				children: select,
			}),
			element('p', {
				classes: formStyles.hint,
				textContent: speaking
					? `Voices for ${languageName(languageOf(language))}, the language of ${selection.value.quiz === undefined ? 'this browser' : 'your quiz'}.`
					: 'Reading aloud doesn\'t work in this browser.',
			}),
		)
		if (!speaking) return

		watchVoices(language, signal, (voices) => {
			const chosen = settings.value.voices[languageOf(language)]
			select.replaceChildren(
				system,
				...voices.map((voice) => element('option', {
					value: voice.voiceURI,
					selected: voice.voiceURI === chosen,
					textContent: `${voice.name} · ${languageName(voice.lang)}`,
				})),
			)
		})
	},
})

/** The reading speed: a slider over its stops, from half to triple, with the speed under it. */
export const SpeechRateSlider = component({
	name: 'speech-rate-slider',
	styles,
	onMount({ append, element, signal }) {
		const note = element('p', {
			classes: styles.sliderNote,
		})
		const slider = element('input', {
			type: 'range',
			min: '0',
			max: String(speechRates.length - 1),
			step: '1',
			aria: {
				label: 'Reading speed',
			},
			on: {
				input(event) {
					const rate = speechRates[Number(event.currentTarget.value)]
					if (rate !== undefined) settings.value.setSpeechRate(rate)
				},
			},
		})
		const fill = element('span', {
			classes: styles.sliderFill,
			aria: {
				hidden: 'true',
			},
		})
		const show = (rate: number) => {
			slider.value = String(speechRates.indexOf(rate as (typeof speechRates)[number]))
			fill.style.setProperty('--place', String(placeOf(rate)))
			slider.setAttribute('aria-valuetext', rateOf(rate))
			note.textContent = rateOf(rate)
		}
		show(settings.value.speechRate)

		// The stops between the ends, on the rail and under the red fill.
		const marks = speechRates.slice(1, -1).map((rate) => {
			const mark = element('span', {
				classes: styles.sliderMark,
				aria: {
					hidden: 'true',
				},
			})
			mark.style.setProperty('--place', String(placeOf(rate)))
			return mark
		})

		append(
			element('div', {
				classes: styles.slider,
				children: [
					element('div', {
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
					}),
					note,
				],
			})
		)

		settings.on('change', signal, ({ detail }) => {
			show(detail.state.speechRate)
		})
	},
})

/** The voice and the speed, each under its label. */
export const SpeechSettings = component({
	name: 'speech-settings',
	onMount({ append, create }) {
		append(
			create(MenuSection, {
				label: 'Voice',
				children: create(VoiceSelect),
			}),
			create(MenuSection, {
				label: 'Reading speed',
				children: create(SpeechRateSlider),
			}),
		)
	},
})
