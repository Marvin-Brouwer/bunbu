/**
 * How long an ambush lasts, and how far the ninjas have crept in. There is no timer bar: the
 * ninjas creeping in are the timer ([time limit](../../../../../docs/design/gameplay.md#time-limit)).
 *
 * ```text
 * ambushSeconds = ceil(read + answer) × timeScale, minimum 5 s
 * read          = words / 200 wpm (words in code count double)
 * answer        = base + per option, per kind
 * ```
 */

import type { AmbushKind } from './ambush.mts'

/** Every number of the time limit, to tune in playtests ([to tune](../../../../../docs/design/gameplay.md#to-tune)). */
export const ambushConfig = {
	wordsPerMinute: 200,
	/** Code is slower to read than prose: each word in code counts this many times. */
	codeWeight: 2,
	/** Seconds to answer: `base + perOption × options`. */
	answerSeconds: {
		'yes-no': { base: 1.5, perOption: 0 },
		single: { base: 1, perOption: 0.75 },
		multiple: { base: 1, perOption: 1.25 },
		order: { base: 1, perOption: 1.5 },
	} satisfies Record<AmbushKind, { base: number; perOption: number }>,
	minimumSeconds: 5,
	/** How long after the last swipe a `multiple` or `order` answer strikes. The swipe input waits this long. */
	commitPauseSeconds: 0.8,
}

const fencedCode = /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[ \t]*$/gm
const inlineCode = /(`+)[\s\S]*?\1/g
/** A word has a letter or a digit in it, so table rules and list bullets don't count. */
const word = /\S*[\p{L}\p{N}]\S*/gu

const countWords = (text: string) => text.match(word)?.length ?? 0

/** The words to read in Markdown, with every word in code counted `codeWeight` times. */
export function wordsIn(markdown: string): number {
	const outsideBlocks = markdown.replace(fencedCode, '')
	const code = [
		// Without the opening fence, whose language is not read.
		...Array.from(markdown.matchAll(fencedCode), ([block]) => block.slice(block.indexOf('\n') + 1)),
		...Array.from(outsideBlocks.matchAll(inlineCode), ([inline]) => inline),
	]
	const codeWords = code.reduce((total, block) => total + countWords(block), 0)
	return countWords(outsideBlocks.replace(inlineCode, '')) + ambushConfig.codeWeight * codeWords
}

/**
 * The time limit of an ambush in seconds, or `0` when there is none (`timeScale` is `undefined`
 * on Novice). `texts` is everything on the scroll: the query and every option.
 */
export function ambushSeconds(kind: AmbushKind, texts: readonly string[], options: number, timeScale: number | undefined): number {
	if (timeScale === undefined) return 0
	const { wordsPerMinute, answerSeconds, minimumSeconds } = ambushConfig
	const read = (texts.reduce((total, text) => total + wordsIn(text), 0) / wordsPerMinute) * 60
	const answer = answerSeconds[kind].base + answerSeconds[kind].perOption * options
	return Math.max(minimumSeconds, Math.ceil(read + answer) * timeScale)
}

/**
 * How far the ninjas have crept in: `0` far away when the ambush opens, `1` within reach when the
 * time is up. Without a time limit they stay where they are.
 */
export function approachOf(seconds: number, secondsLeft: number): number {
	if (seconds <= 0) return 0
	return Math.min(1, Math.max(0, 1 - secondsLeft / seconds))
}
