/**
 * How fast a voice reads, to guess the spoken word where the engine doesn't say which word it is
 * on (Chrome on Android sends no word boundaries).
 *
 * Words are weighed by how long they take to say rather than by their letters: code, numbers and
 * abbreviations take far longer than their characters suggest (`404` is "four hundred four",
 * `HTTP` is said letter by letter, `node.js` is "node dot js"). The pace, in that weight per
 * second, is measured from every line read: the line's weight over the time from its start to its
 * end. Voices differ a lot, so this matters more than the weights being exact.
 *
 * Plain TypeScript, no DOM.
 */

/** The pace in weight per second at speed 1, and how many lines it was measured from. */
export type Pace = {
	readonly perSecond: number
	readonly heard: number
}

/** A first guess, until a line was read. */
export const unheardPace: Pace = { perSecond: 16, heard: 0 }

/** A word of a line: where it starts, and the weight said before it. */
export type SpokenWord = {
	readonly start: number
	readonly before: number
}

/** The pause between words. */
const betweenWords = 1
/** A letter said by its name, as in an abbreviation: "aitch", "tee". */
const spelledLetter = 3
/** A digit of a number said in words. */
const digit = 4
/** A sign between letters, said as a word: "dot", "slash". */
const innerSign = 3

/** How long a word takes to say, roughly in letters said. */
export function weightOf(word: string): number {
	const letters = word.match(/\p{L}/gu)?.length ?? 0
	const digits = word.match(/\p{N}/gu)?.length ?? 0
	const signs = word.match(/(?<=[\p{L}\p{N}])[^\p{L}\p{N}\s'’-](?=[\p{L}\p{N}])/gu)?.length ?? 0
	// A short word in capitals, or a single letter, is spelled out.
	const spelled = letters > 0 && letters <= 5 && !/\p{Ll}/u.test(word)
	return betweenWords + letters * (spelled ? spelledLetter : 1) + digits * digit + signs * innerSign
}

/** The words of a text, each with the weight said before it, and the text's weight in all. */
export function spokenWords(text: string): { readonly words: SpokenWord[]; readonly weight: number } {
	const words: SpokenWord[] = []
	let weight = 0
	for (const match of text.matchAll(/\S+/gu)) {
		words.push({ start: match.index, before: weight })
		weight += weightOf(match[0])
	}
	return { words, weight }
}

/** Lighter lines say little about the pace: the pause after them weighs too much. */
const lightestMeasured = 20
/** Paces outside these are taken as a line cut short or held up, not as the voice's pace. */
const slowest = 4
const fastest = 50
/** How many lines the pace is averaged over: few, to follow the voice, but not one odd line. */
const remembered = 2

/** The pace after hearing a line of `weight` read in `seconds` at speed `rate`. */
export function paceAfter(pace: Pace, weight: number, seconds: number, rate: number): Pace {
	if (weight < lightestMeasured || seconds <= 0 || rate <= 0) return pace
	const measured = weight / seconds / rate
	if (measured < slowest || measured > fastest) return pace
	const kept = Math.min(pace.heard, remembered)
	return {
		perSecond: (pace.perSecond * kept + measured) / (kept + 1),
		heard: pace.heard + 1,
	}
}
