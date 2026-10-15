/**
 * The game's sounds, made as they play with the Web Audio API: noise shaped by filters and short
 * tones, so the game brings no sound files and they cost nothing to load. Swords and steps only:
 * the ninjas make no voices.
 *
 * They play at the settings' volume, and only once the player has touched the page, as browsers
 * keep a page quiet until then.
 */

import { settings } from '../../settings/state/settings.mts'

export type Sound =
	/** A sword cutting the air: the samurai's strike. */
	| 'swing'
	/** The sword landing: a ninja cut down. */
	| 'cut'
	/** Blade on blade: a ninja's strike blocked. */
	| 'clash'
	/** The samurai hit: a dull thud. */
	| 'hit'
	/** A foot on the path, as the samurai runs. */
	| 'step'
	/** Ninjas coming in fast through the grass and over the ground. */
	| 'rush'
	/** The scroll unrolling. */
	| 'unroll'
	/** A swipe cutting the paper of an answer. */
	| 'paper'

/** What every sound plays through: the audio context, its loudness, and noise to filter. */
type Audio = { readonly context: AudioContext; readonly master: GainNode; readonly noise: AudioBuffer }

let made: Audio | undefined

/** The audio, made on first use, at the volume of the settings. */
function audio(): Audio | undefined {
	if (typeof AudioContext === 'undefined') return undefined
	if (made === undefined) {
		const context = new AudioContext()
		const master = context.createGain()
		master.connect(context.destination)
		// A second of white noise, the stuff whooshes, steps and cuts are filtered from.
		const noise = context.createBuffer(1, context.sampleRate, context.sampleRate)
		const samples = noise.getChannelData(0)
		for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1
		made = { context, master, noise }
	}
	// Kept quiet until a touch: try again on every sound, which follows one.
	if (made.context.state === 'suspended') void made.context.resume()
	made.master.gain.value = settings.value.volume
	return made
}

/** A burst of noise through a filter whose frequency sweeps `from` to `to`, rising and falling over `seconds`. */
function whoosh(
	{ context, master, noise }: Audio,
	{ from, to, seconds, loudness, type = 'bandpass', q = 1.2, delay = 0 }: { from: number; to: number; seconds: number; loudness: number; type?: BiquadFilterType; q?: number; delay?: number },
): void {
	const start = context.currentTime + delay
	const source = context.createBufferSource()
	source.buffer = noise
	source.playbackRate.value = 0.8 + Math.random() * 0.4
	const filter = context.createBiquadFilter()
	filter.type = type
	filter.Q.value = q
	filter.frequency.setValueAtTime(from, start)
	filter.frequency.exponentialRampToValueAtTime(to, start + seconds)
	const gain = context.createGain()
	gain.gain.setValueAtTime(0.0001, start)
	gain.gain.exponentialRampToValueAtTime(loudness, start + seconds * 0.3)
	gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds)
	source.connect(filter).connect(gain).connect(master)
	source.start(start, Math.random() * 0.5)
	source.stop(start + seconds + 0.05)
}

/** A struck tone at `frequency` that rings for `seconds`. */
function ring(
	{ context, master }: Audio,
	{ frequency, seconds, loudness, type = 'sine', delay = 0 }: { frequency: number; seconds: number; loudness: number; type?: OscillatorType; delay?: number },
): void {
	const start = context.currentTime + delay
	const oscillator = context.createOscillator()
	oscillator.type = type
	oscillator.frequency.setValueAtTime(frequency, start)
	const gain = context.createGain()
	gain.gain.setValueAtTime(loudness, start)
	gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds)
	oscillator.connect(gain).connect(master)
	oscillator.start(start)
	oscillator.stop(start + seconds + 0.05)
}

/** Plays `sound`, `loudness` times as loud as it is made (`1` as it is). */
export function play(sound: Sound, loudness = 1): void {
	if (settings.value.volume <= 0) return
	const sounding = audio()
	if (sounding === undefined) return
	const loud = (level: number) => Math.max(0.0002, level * loudness)
	switch (sound) {
		case 'swing': {
			whoosh(sounding, { from: 600, to: 3200, seconds: 0.22, loudness: loud(0.5), q: 0.9 })
			break
		}
		case 'cut': {
			whoosh(sounding, { from: 2400, to: 900, seconds: 0.12, loudness: loud(0.35), q: 2 })
			whoosh(sounding, { from: 220, to: 90, seconds: 0.18, loudness: loud(0.45), type: 'lowpass', q: 0.7, delay: 0.01 })
			break
		}
		case 'clash': {
			// Steel on steel: a few partials that don't make a chord, over a bright scrape.
			for (const [frequency, level, seconds] of [[1850, 0.16, 0.5], [2730, 0.1, 0.4], [4120, 0.07, 0.3], [5980, 0.04, 0.2]] as const) {
				ring(sounding, { frequency: frequency * (0.97 + Math.random() * 0.06), seconds, loudness: loud(level), type: 'triangle' })
			}
			whoosh(sounding, { from: 6000, to: 2500, seconds: 0.09, loudness: loud(0.4), type: 'highpass', q: 0.7 })
			break
		}
		case 'hit': {
			ring(sounding, { frequency: 95, seconds: 0.25, loudness: loud(0.6) })
			whoosh(sounding, { from: 400, to: 120, seconds: 0.2, loudness: loud(0.5), type: 'lowpass', q: 0.8 })
			break
		}
		case 'step': {
			whoosh(sounding, { from: 380, to: 160, seconds: 0.09, loudness: loud(0.22), type: 'lowpass', q: 0.6 })
			break
		}
		case 'rush': {
			whoosh(sounding, { from: 300, to: 1500, seconds: 0.7, loudness: loud(0.25), q: 0.6 })
			whoosh(sounding, { from: 900, to: 400, seconds: 0.5, loudness: loud(0.15), q: 0.8, delay: 0.25 })
			break
		}
		case 'unroll': {
			whoosh(sounding, { from: 1800, to: 700, seconds: 0.45, loudness: loud(0.18), q: 0.5 })
			break
		}
		case 'paper': {
			whoosh(sounding, { from: 5200, to: 2600, seconds: 0.08, loudness: loud(0.28), type: 'highpass', q: 0.8 })
			break
		}
	}
}
