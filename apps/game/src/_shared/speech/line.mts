/**
 * What the speech engine is given, and the way back from it to the text on screen.
 *
 * A line is said as one utterance. It is built from pieces: text that is shown, read after its
 * [pronunciations](../../../../../docs/design/data-format.md#pronunciations), and words that are
 * only said, as "the answer is". Every stretch of the spoken text remembers where it came from, so
 * a word the engine reaches can be found on screen again: a replaced term (`SQL` read as "sequel")
 * as the written term as a whole, any other word letter for letter.
 *
 * Plain TypeScript, no DOM: the screen that shows the text hands it over as plain text, numbered
 * by block, and turns a {@link ShownRange} back into a range on the page.
 */

/** A stretch of shown text: block `block`, characters `start` up to `end`. */
export type ShownRange = {
	readonly block: number
	readonly start: number
	readonly end: number
}

export type LinePiece =
	/** Said, not shown. */
	| { readonly said: string }
	/** Shown in block `block`, starting at character `offset` of that block's text. */
	| { readonly shown: string; readonly block: number; readonly offset: number }

type Segment = {
	/** Where the stretch is in the spoken text. */
	readonly start: number
	readonly end: number
	/** Where it is on screen; `undefined` for what is only said. */
	readonly source: ShownRange | undefined
	/** Said differently from how it is written, so it maps back as a whole. */
	readonly replaced: boolean
}

export type SpokenLine = {
	/** The text for the speech engine. */
	readonly text: string
	readonly segments: readonly Segment[]
}

/** Finds the terms of a pronunciation dictionary in a text. */
export type Pronouncer = {
	readonly pattern: RegExp | undefined
	readonly dictionary: Readonly<Record<string, string>>
}

/** A term as a literal part of a pattern. */
const escape = (term: string) => term.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)

/**
 * The matcher for a dictionary. Whole words only, case-sensitive, and the longest term first, so
 * `HTTP/2` is replaced before `HTTP` and `SQL` doesn't match in `MySQLi`.
 */
export function pronouncerOf(dictionary: Readonly<Record<string, string>>): Pronouncer {
	const terms = Object.keys(dictionary)
		.filter((term) => term !== '')
		.toSorted((first, second) => second.length - first.length)
	const pattern = terms.length === 0
		? undefined
		: new RegExp(String.raw`(?<![\p{L}\p{N}])(?:${terms.map(escape).join('|')})(?![\p{L}\p{N}])`, 'gu')
	return { pattern, dictionary }
}

type Run = {
	readonly spoken: string
	readonly start: number
	readonly end: number
	readonly replaced: boolean
}

/** A text cut into runs: as written, or a term and what is said for it. */
function runsOf(text: string, { pattern, dictionary }: Pronouncer): Run[] {
	if (pattern === undefined) return [{ spoken: text, start: 0, end: text.length, replaced: false }]
	const runs: Run[] = []
	let at = 0
	for (const match of text.matchAll(pattern)) {
		const start = match.index
		const end = start + match[0].length
		if (start > at) runs.push({ spoken: text.slice(at, start), start: at, end: start, replaced: false })
		runs.push({ spoken: dictionary[match[0]] ?? match[0], start, end, replaced: true })
		at = end
	}
	if (at < text.length) runs.push({ spoken: text.slice(at), start: at, end: text.length, replaced: false })
	return runs
}

/** Builds a line from its pieces, a space between each. */
export function spokenLine(pieces: readonly LinePiece[], pronouncer: Pronouncer): SpokenLine {
	let text = ''
	const segments: Segment[] = []
	const add = (spoken: string, source: ShownRange | undefined, replaced: boolean) => {
		if (spoken === '') return
		segments.push({ start: text.length, end: text.length + spoken.length, source, replaced })
		text += spoken
	}

	for (const piece of pieces) {
		if (text !== '' && !/\s$/u.test(text)) add(' ', undefined, false)
		if ('said' in piece) {
			add(piece.said, undefined, false)
			continue
		}
		for (const run of runsOf(piece.shown, pronouncer)) {
			add(run.spoken, {
				block: piece.block,
				start: piece.offset + run.start,
				end: piece.offset + run.end,
			}, run.replaced)
		}
	}
	return { text, segments }
}

/** Closing marks a highlight leaves out: the word is `alt`, not `alt.` */
const trailing = /[.,;:!?)\]"'’”]+$/u

/** Where the word that starts at `index` ends: at `end`, or else the next space, without closing marks. */
function endOfWord(text: string, index: number, end?: number): number {
	const space = text.slice(index).search(/\s/u)
	const until = end ?? (space === -1 ? text.length : index + space)
	const stripped = text.slice(index, until).replace(trailing, '')
	return stripped === '' ? until : index + stripped.length
}

/**
 * Where on screen the word is that the engine reached, at `index` in the line's text, or
 * `undefined` when that word is only said. `length` is the word's length when the engine gives it.
 */
export function shownWordAt(line: SpokenLine, index: number, length?: number): ShownRange | undefined {
	let start = index
	while (start < line.text.length && /\s/u.test(line.text[start] ?? '')) start++
	if (start >= line.text.length) return undefined
	const end = endOfWord(line.text, start, length !== undefined && length > 0 && index + length > start ? index + length : undefined)

	const covered = line.segments.filter((segment) => segment.source !== undefined && segment.start < end && segment.end > start)
	const first = covered[0]
	if (first?.source === undefined) return undefined
	// A word stays inside its block; one that runs on into the next one is shown in the first.
	const inBlock = covered.filter((segment) => segment.source?.block === first.source?.block)
	const last = inBlock.at(-1) ?? first
	const lastSource = last.source ?? first.source

	return {
		block: first.source.block,
		start: first.replaced ? first.source.start : first.source.start + Math.max(start, first.start) - first.start,
		end: last.replaced ? lastSource.end : lastSource.start + Math.min(end, last.end) - last.start,
	}
}

/**
 * The sentences of a text, as character ranges without the space around them. Each is said as its
 * own line: short lines keep a pause between sentences, and some engines stop a long one halfway.
 */
export function sentencesOf(text: string): { readonly start: number; readonly end: number }[] {
	const sentences: { start: number; end: number }[] = []
	// Up to a sentence end, or an empty line between blocks; a single line break is only a space.
	const pattern = /[\s\S]+?(?:[.!?…]+(?=\s|$)|(?=\n\s*\n)|$)/gu
	for (const match of text.matchAll(pattern)) {
		const leading = match[0].length - match[0].trimStart().length
		const trimmed = match[0].trim()
		if (trimmed === '') continue
		const start = match.index + leading
		sentences.push({ start, end: start + trimmed.length })
	}
	return sentences
}

/** The start of every word in a text, to guess the spoken word when the engine doesn't say. */
export function wordStarts(text: string): number[] {
	return [...text.matchAll(/\S+/gu)].map((match) => match.index)
}
