/**
 * The speaker button of practice ([D4](../../../../docs/design/screens.md#d4-practice-ambush),
 * [D5](../../../../docs/design/screens.md#d5-practice-miss)): reads the card aloud when pressed,
 * never by itself. Pressed again while reading, it stops. The voice and the speed are the ones in
 * the settings, as for Study.
 */

import { component } from '@rooted/components'
import { pronouncerOf, sentencesOf, spokenLine, type Pronouncer, type SpokenLine } from '../_shared/speech/line.mts'
import { readableMarkdown } from '../_shared/speech/readable.mts'
import { canSpeak, createSpeaker, voiceFor, watchVoices } from '../_shared/speech/speaker.mts'
import { languageOf, settings } from '../settings/state/settings.mts'
import styles from './practice.css'

/** A speaker, for the read aloud button. */
const speakerIcon = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>'

/**
 * The lines to read for quiz Markdown, a sentence each: `blocks` in turn, as on the card. A block
 * of plain words, such as "The answer is", is said as it is.
 */
export function linesOfBlocks(blocks: readonly string[], pronouncer: Pronouncer): SpokenLine[] {
	// As shown text, not only said: the pronouncer only goes over what is shown. Nothing is
	// highlighted here, so where it is shown doesn't matter.
	return blocks.flatMap((source, block) => {
		const text = readableMarkdown(source)
		return sentencesOf(text).map(({ start, end }) => spokenLine([{ shown: text.slice(start, end), block, offset: start }], pronouncer))
	})
}

export type ReadAloudOptions = {
	/** The quiz's `language`, for the voice. */
	readonly language: string
	/** How terms are said: `resolvePronunciations` of the quiz, its own and the built-in dictionaries. */
	readonly pronunciations: Readonly<Record<string, string>>
	/** What to read, as quiz Markdown, block by block: read when the button is pressed. */
	readonly blocks: () => readonly string[]
	/** Calls `stop` when what is read is no longer on screen, as when the next question opens. */
	readonly stopWhen?: (stop: () => void, signal: AbortSignal) => void
}

export const ReadAloud = component<ReadAloudOptions>({
	name: 'read-aloud',
	styles,
	onMount({ append, element, options, signal }) {
		const { language } = options
		const pronouncer = pronouncerOf(options.pronunciations)
		let lines: SpokenLine[] = []
		let reading = false

		const button = append(
			element('button', {
				type: 'button',
				classes: [
					styles.panel,
					styles.iconButton,
				],
				disabled: !canSpeak(),
				innerHTML: speakerIcon,
				aria: {
					label: 'Read aloud',
					pressed: 'false',
				},
				on: {
					click() {
						if (reading) stop()
						else start()
					},
				},
			})
		)

		const show = (next: boolean) => {
			reading = next
			button.setAttribute('aria-pressed', String(next))
		}

		const speaker = createSpeaker({
			language,
			whileHidden: 'stop',
			lineAt: (place) => lines[place],
			onEnd() {
				show(false)
			},
			onStop() {
				show(false)
			},
		}, signal)

		const start = () => {
			lines = linesOfBlocks(options.blocks(), pronouncer)
			if (lines.length === 0) return
			show(true)
			speaker.play(0)
		}
		const stop = () => {
			if (!reading) return
			show(false)
			speaker.pause()
		}
		options.stopWhen?.(stop, signal)

		// The voice and the speed come from the settings, and follow them.
		const spoken = languageOf(language)
		let voice: string | undefined
		const followVoice = () => {
			const chosen = voiceFor(language, settings.value.voices[spoken])?.voiceURI
			if (chosen === voice) return
			voice = chosen
			speaker.setVoice(voiceFor(language, chosen))
		}
		speaker.setRate(settings.value.speechRate)
		settings.on('change', signal, ({ detail }) => {
			speaker.setRate(detail.state.speechRate)
			followVoice()
		})
		watchVoices(language, signal, followVoice)
	},
})
