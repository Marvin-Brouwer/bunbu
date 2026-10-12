/**
 * Reading aloud with the browser's Speech API ([dojo](../../../../../docs/design/dojo.md)): a
 * small wrapper around `speechSynthesis` that reads a run of {@link SpokenLine}s, with the voice
 * for the quiz's language, a speed, and the word being spoken on screen.
 *
 * What it smooths over, as the engines differ a lot:
 * - **Pause** cancels and resumes from the start of the line: Android's engine has no real pause
 *   (pausing stops it), and others don't always resume.
 * - **The spoken word** comes from the engine's word boundaries. Android and some online voices
 *   send none; there the word is guessed from the time spoken and the speed.
 * - **Voices** load late, after a `voiceschanged` event, or, on Safari, without one.
 * - **Lines** are short, a sentence at most, as Chrome stops some voices after 15 seconds.
 * - An utterance the page no longer holds can be dropped by the browser before it ends, so the
 *   ones queued are kept.
 *
 * It stops when its screen goes (the signal) and when the page is left. With `whileHidden: 'keep
 * reading'` it goes on while the page is hidden, as when the phone locks: it then hands the engine
 * the lines ahead, so it reads on even where the page itself is put to sleep. Where the browser
 * stops the speech anyway (Safari on an iPhone), it picks up again from the line it was on when
 * the page is back.
 */

import { shownWordAt, wordStarts, type ShownRange, type SpokenLine } from './line.mts'

/** The engine's errors for speech that was stopped on purpose, by `cancel`. */
const stopped = new Set<string>(['canceled', 'interrupted'])
/** How long to wait for the engine to start before taking it as refused, as without a tap first. */
const startTimeout = 3000
/** Characters said per second at speed 1, to guess the spoken word without word boundaries. */
const charactersPerSecond = 14
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
	/** The word being spoken on screen, `undefined` between words or for words only said. */
	readonly onWord?: (word: ShownRange | undefined) => void
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
	/** Whether the engine sends word boundaries; until then the word is guessed. */
	let boundaries = false
	let guessing: ReturnType<typeof setInterval> | undefined
	let waiting: ReturnType<typeof setTimeout> | undefined
	const held = new Set<SpeechSynthesisUtterance>()

	const stopGuessing = () => {
		clearInterval(guessing)
		guessing = undefined
	}

	const cancel = () => {
		generation++
		stopGuessing()
		clearTimeout(waiting)
		held.clear()
		if (canSpeak()) speechSynthesis.cancel()
		options.onWord?.(undefined)
	}

	const halt = () => {
		if (!playing) return
		playing = false
		cancel()
		options.onStop?.()
	}

	/** Guesses the word from the time spoken, for engines without word boundaries. */
	const guess = (line: SpokenLine) => {
		const starts = wordStarts(line.text)
		const began = performance.now()
		let shown = -1
		stopGuessing()
		guessing = setInterval(() => {
			const reached = (performance.now() - began) / 1000 * charactersPerSecond * rate
			const word = starts.findLast((start) => start <= reached) ?? 0
			if (word === shown) return
			shown = word
			options.onWord?.(shownWordAt(line, word))
		}, 100)
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
			if (!boundaries) guess(line)
			fill()
		})
		utterance.addEventListener('boundary', (event) => {
			if (ours !== generation || event.name !== 'word') return
			boundaries = true
			stopGuessing()
			options.onWord?.(shownWordAt(line, event.charIndex, event.charLength))
		})
		const done = () => {
			held.delete(utterance)
			if (ours !== generation) return
			stopGuessing()
			options.onWord?.(undefined)
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
