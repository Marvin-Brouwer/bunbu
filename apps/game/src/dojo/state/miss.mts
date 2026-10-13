/**
 * What the practice miss screen ([D5](../../../../../docs/design/screens.md#d5-practice-miss)) says
 * about a wrong answer: next to each option whether it was right and what the player picked, and
 * the line read aloud, "The answer is …".
 */

import type { AmbushKind, AmbushOption, AmbushState } from '../../_shared/state/ambush.mts'

/** What an option shows next to it on the miss screen: ✓ for the right answer, ✗ for a wrong pick. */
export type OptionVerdict = {
	readonly sign: '✓' | '✗'
	readonly text: string
}

const place = (rank: number) => {
	const ends: Readonly<Record<number, string>> = { 1: 'st', 2: 'nd', 3: 'rd' }
	const teen = rank % 100 >= 11 && rank % 100 <= 13
	return `${rank}${teen ? 'th' : ends[rank % 10] ?? 'th'}`
}

/**
 * The verdict on one option, or `undefined` when it was rightly left alone. For `order` the right
 * place is shown, and the place the player gave it when that was wrong.
 */
export function verdictOf(kind: AmbushKind, option: AmbushOption): OptionVerdict | undefined {
	if (kind === 'order') {
		if (option.rank === 0) return option.pick > 0 ? { sign: '✗', text: 'not in the order' } : undefined
		if (option.pick === option.rank) return { sign: '✓', text: place(option.rank) }
		return { sign: '✗', text: option.pick > 0 ? `${place(option.rank)}, not ${place(option.pick)}` : `${place(option.rank)}, left out` }
	}
	if (option.correct) return { sign: '✓', text: option.pick > 0 ? 'correct, your pick' : 'correct' }
	return option.pick > 0 ? { sign: '✗', text: 'your pick' } : undefined
}

/** `A`, `A and B`, `A, B and C`. */
function listOf(items: readonly string[], last = ' and '): string {
	if (items.length <= 1) return items.join('')
	return `${items.slice(0, -1).join(', ')}${last}${items.at(-1)}`
}

/** The right answer as a sentence of quiz Markdown, to read aloud: "The answer is `alt`." */
export function answerLineOf(ambush: Pick<AmbushState, 'kind' | 'options'>): string {
	if (ambush.kind === 'order') {
		const ordered = ambush.options.filter((option) => option.rank > 0).toSorted((first, second) => first.rank - second.rank)
		return `The order is ${listOf(ordered.map((option) => option.answer), ', then ')}.`
	}
	const right = ambush.options.filter((option) => option.correct).map((option) => option.answer)
	return right.length === 1 ? `The answer is ${right[0]}.` : `The answers are ${listOf(right)}.`
}
