/**
 * Reading aloud with the browser's Speech API ([dojo](../../../../../docs/design/dojo.md)): a
 * small wrapper around `speechSynthesis` that reads a run of {@link SpokenLine}s, with the voice
 * for the quiz's language, a speed, and the word being spoken on screen.
 *
 * What it smooths over, as the engines differ a lot:
 * - **Pause** cancels and resumes from the start of the line: Android's engine has no real pause
 *   (pausing stops it), and others don't always resume.
 * - **What is being said** is the word, from the engine's word boundaries. Android and some online
 *   voices send none; there it is the whole line, which the engine does say when it starts.
 * - **Voices** load late, after a `voiceschanged` event, or, on Safari, without one.
 * - **Lines** are short, a sentence at most, as Chrome stops some voices after 15 seconds.
 * - An utterance the page no longer holds can be dropped by the browser before it ends, so the
 *   ones queued are kept.
 *
 * It stops when its screen goes (the signal) and when the page is left. With `whileHidden: 'keep
 * reading'` it goes on while the page is hidden where the browser lets it: it then hands the engine
 * the lines ahead, so it reads on even where the page itself is put to sleep. Phones stop the speech
 * when they lock (Chrome on Android only speaks while it is on screen, as does Safari on an
 * iPhone); it then picks up again from the line it was on when the page is back.
 */

import { shownRangesOf, shownWordAt, type ShownRange, type SpokenLine } from './line.mts'

/** The engine's errors for speech that was stopped on purpose, by `cancel`. */
const stopped = new Set<string>(['canceled', 'interrupted'])
/** How long to wait for the engine to start before taking it as refused, as without a tap first. */
const startTimeout = 3000
/** How many lines to hand the engine ahead while the page is hidden. */
const linesAheadHidden = 500

const hidden = () => document.visibilityState === 'hidden'
const normalised = (language: string) => language.replaceAll('_', '-').toLowerCase()
const primaryOf = (language: string) => normalised(language).split('-')[0] ?? ''

export function canSpeak(): boolean {
	return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** The voices for a language (any region of it), the exact language and the system's default first. */
export function voicesFor(language: string): SpeechSynthesisVoice[] {
	if (!canSpeak()) return []
	const wanted = normalised(language)
	const rank = (voice: SpeechSynthesisVoice) => (normalised(voice.lang) === wanted ? 0 : 2) + (voice.default ? 0 : 1)
	return speechSynthesis.getVoices()
		.filter((voice) => primaryOf(voice.lang) === primaryOf(language))
		.toSorted((first, second) => rank(first) - rank(second) || first.name.localeCompare(second.name))
}

/** The chosen voice for a language, when it is there; `undefined` for the system's own. */
export function voiceFor(language: string, voiceURI: string | undefined): SpeechSynthesisVoice | undefined {
	return voiceURI === undefined ? undefined : voicesFor(language).find((voice) => voice.voiceURI === voiceURI)
}

/** A language or a voice's language in words: `English`, `British English`. */
export function languageName(tag: string): string {
	try {
		return new Intl.DisplayNames(['en'], { type: 'language' }).of(tag.replaceAll('_', '-')) ?? tag
	}
	catch {
		// Not a language tag the browser knows.
		return tag
	}
}

/**
 * Calls `listener` with the voices for `language` now and whenever they change. Safari fills the
 * list without telling, so it is looked at a few times while it is still empty.
 */
export function watchVoices(language: string, signal: AbortSignal, listener: (voices: SpeechSynthesisVoice[]) => void): void {
	if (!canSpeak()) {
		listener([])
		return
	}
	let known: string | undefined
	const update = () => {
		const voices = voicesFor(language)
		const names = voices.map((voice) => voice.voiceURI).join('\n')
		if (names === known) return
		known = names
		listener(voices)
	}
	speechSynthesis.addEventListener('voiceschanged', update, { signal })
	let tries = 0
	const poll = setInterval(() => {
		update()
		if (known !== '' || ++tries >= 20) clearInterval(poll)
	}, 250)
	signal.addEventListener('abort', () => { clearInterval(poll) }, { once: true })
	update()
}

export type SpeakerOptions = {
	/** The quiz's `language`, for the voice. */
	readonly language: string
	/** Whether to go on while the page is hidden, as when the phone locks, or to stop. */
	readonly whileHidden: 'stop' | 'keep reading'
	/** The line at a place in the run, or `undefined` past its end. */
	readonly lineAt: (place: number) => SpokenLine | undefined
	/** The engine started on the line at `place`. */
	readonly onLine?: (place: number) => void
	/**
	 * What is being said, on screen: the word, or the whole line where the engine doesn't say which
	 * word; nothing between words or for words only said.
	 */
	readonly onSaid?: (said: readonly ShownRange[]) => void
	/** Read to the end of the run. */
	readonly onEnd?: () => void
	/** Stopped without being asked: refused, as before the first tap, or stopped by a hidden page. */
	readonly onStop?: () => void
}

export type Speaker = {
	/** Reads from `place` on. */
	readonly play: (place: number) => void
	/** Stops; {@link Speaker.resume} starts the line it was on again. */
	readonly pause: () => void
	readonly resume: () => void
	/** Goes on from `place`: straight away while reading, from there on resuming while paused. */
	readonly moveTo: (place: number) => void
	/** The line it is on, or resumes from. */
	readonly place: () => number
	/** The voice, or `undefined` for the system's own for the language. Takes effect from the line being read. */
	readonly setVoice: (voice: SpeechSynthesisVoice | undefined) => void
	/** The speed, `1` is normal. Takes effect from the line being read. */
	readonly setRate: (rate: number) => void
}

export function createSpeaker(options: SpeakerOptions, signal: AbortSignal): Speaker {
	const { language, lineAt } = options
	let voice: SpeechSynthesisVoice | undefined
	let rate = 1
	let playing = false
	/** The line the engine is on, or starts on next. */
	let current = 0
	/** The next line to hand the engine. */
	let queued = 0
	/** Bumped on every cancel, so events of the speech it cancelled are ignored. */
	let generation = 0
	/** Whether the engine sends word boundaries; until then the whole line is shown as being said. */
	let boundaries = false
	let waiting: ReturnType<typeof setTimeout> | undefined
	const held = new Set<SpeechSynthesisUtterance>()

	const cancel = () => {
		generation++
		clearTimeout(waiting)
		held.clear()
		if (canSpeak()) speechSynthesis.cancel()
		options.onSaid?.([])
	}

	const halt = () => {
		if (!playing) return
		playing = false
		cancel()
		options.onStop?.()
	}

	const say = (place: number, line: SpokenLine) => {
		const ours = generation
		const utterance = new SpeechSynthesisUtterance(line.text)
		utterance.lang = language
		utterance.voice = voice ?? voicesFor(language)[0] ?? null
		utterance.rate = rate
		held.add(utterance)

		utterance.addEventListener('start', () => {
			if (ours !== generation) return
			clearTimeout(waiting)
			current = place
			options.onLine?.(place)
			if (!boundaries) options.onSaid?.(shownRangesOf(line))
			fill()
		})
		utterance.addEventListener('boundary', (event) => {
			if (ours !== generation || event.name !== 'word') return
			boundaries = true
			const word = shownWordAt(line, event.charIndex, event.charLength)
			options.onSaid?.(word === undefined ? [] : [word])
		})
		const done = () => {
			held.delete(utterance)
			if (ours !== generation) return
			options.onSaid?.([])
			if (lineAt(place + 1) !== undefined) return
			playing = false
			options.onEnd?.()
		}
		utterance.addEventListener('end', done)
		utterance.addEventListener('error', (event) => {
			if (stopped.has(event.error)) {
				held.delete(utterance)
				return
			}
			// Refused, as before the first tap: stop, so the player can start it.
			if (event.error === 'not-allowed') {
				held.delete(utterance)
				if (ours === generation) halt()
				return
			}
			// Any other failure skips the line rather than stopping the reading.
			done()
		})
		speechSynthesis.speak(utterance)
	}

	/** Hands the engine the next line, or, while hidden, the lines well ahead. */
	const fill = () => {
		if (!playing) return
		const ahead = hidden() && options.whileHidden === 'keep reading' ? linesAheadHidden : 1
		while (queued <= current + ahead) {
			const line = lineAt(queued)
			if (line === undefined) return
			say(queued, line)
			queued++
		}
	}

	const play = (place: number) => {
		if (!canSpeak()) {
			options.onStop?.()
			return
		}
		cancel()
		playing = true
		current = place
		queued = place
		fill()
		// Nothing started: refused without a word, as Safari does before the first tap.
		const ours = generation
		waiting = setTimeout(() => {
			if (ours === generation && !speechSynthesis.speaking) halt()
		}, startTimeout)
	}

	document.addEventListener('visibilitychange', () => {
		if (!playing) return
		if (hidden()) {
			if (options.whileHidden === 'stop') halt()
			else fill()
			return
		}
		// Back on the page after the browser stopped the speech: pick up from the line it was on.
		if (!speechSynthesis.speaking) play(current)
	}, { signal })
	window.addEventListener('pagehide', () => {
		playing = false
		cancel()
	}, { signal })
	signal.addEventListener('abort', () => {
		playing = false
		cancel()
	}, { once: true })

	return {
		play,
		pause() {
			playing = false
			cancel()
		},
		resume() {
			play(current)
		},
		moveTo(place) {
			if (playing) play(place)
			else current = place
		},
		place: () => current,
		setVoice(next) {
			voice = next
			if (playing) play(current)
		},
		setRate(next) {
			rate = next
			if (playing) play(current)
		},
	}
}
