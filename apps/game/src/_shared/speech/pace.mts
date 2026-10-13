/**
 * How fast a voice reads, to guess the spoken word where the engine doesn't say which word it is
 * on (Chrome on Android sends no word boundaries). Voices differ a lot, so the pace is measured
 * from the lines read so far: a line's length over the time from its start to its end.
 *
 * Plain TypeScript, no DOM.
 */

/** The pace in characters per second at speed 1, and how many lines it was measured from. */
export type Pace = {
	readonly charactersPerSecond: number
	readonly heard: number
}

/** A first guess, until a line was read. */
export const unheardPace: Pace = { charactersPerSecond: 14, heard: 0 }

/** Shorter lines say little about the pace: the pause after them weighs too much. */
const shortestMeasured = 20
/** Paces outside these are taken as a line cut short or held up, not as the voice's pace. */
const slowest = 4
const fastest = 40
/** How many lines the pace is averaged over, so one odd line doesn't throw it off. */
const remembered = 3

/** The pace after hearing a line of `characters` read in `seconds` at speed `rate`. */
export function paceAfter(pace: Pace, characters: number, seconds: number, rate: number): Pace {
	if (characters < shortestMeasured || seconds <= 0 || rate <= 0) return pace
	const measured = characters / seconds / rate
	if (measured < slowest || measured > fastest) return pace
	const weight = Math.min(pace.heard, remembered)
	return {
		charactersPerSecond: (pace.charactersPerSecond * weight + measured) / (weight + 1),
		heard: pace.heard + 1,
	}
}
