/**
 * Turns one ambush of a question into what the ambush store opens with: the options shuffled,
 * a mark per option, the ninjas that carry them and the time limit
 * ([per question type](../../../../../docs/design/gameplay.md#per-question-type),
 * [more than 3 options](../../../../../docs/design/gameplay.md#more-than-3-options)).
 */

import type { BunbuData, Question } from '@bunbu/data'
import { yesNoMarks, type AmbushKind, type AmbushOpening, type AmbushOption, type Mark } from './ambush.mts'
import { ambushSeconds } from './ambush-time.mts'
import { choicesOf, type QuestionRef } from './quiz.mts'
import { shuffle, type Random } from './random.mts'

/** Up to 5 ninjas: 3 in front, 2 behind. */
export const frontRow = 3
export const maxNinjas = 5

/** The marks used for a number of options, spread out so the swipes are far apart. */
const markSets: Readonly<Record<number, readonly Mark[]>> = {
	1: ['up'],
	2: ['left', 'right'],
	3: ['left', 'up', 'right'],
	4: ['left', 'up', 'right', 'down'],
	5: ['left', 'up-left', 'up', 'up-right', 'right'],
	6: ['left', 'up-left', 'up-right', 'right', 'down-right', 'down-left'],
	7: ['left', 'up-left', 'up', 'up-right', 'right', 'down-right', 'down-left'],
	8: ['left', 'up-left', 'up', 'up-right', 'right', 'down-right', 'down', 'down-left'],
}

/** One swipe direction per option, so at most 8. */
export const maxOptions = 8

/** How a question is answered: `solutions` entries as `yes-no`, `match` rows as `single`. */
export function kindOf(question: Question): AmbushKind {
	if (question.type === 'solutions') return 'yes-no'
	if (question.type === 'match') return 'single'
	return question.type
}

const quote = (markdown: string) => markdown.split('\n').map((line) => `> ${line}`).join('\n')

/** The scroll's text: the query, with the scenario and proposed solution, or the row to match. */
function queryOf(question: Question, part: number): string {
	if (question.type === 'solutions') {
		return [question.scenario, quote(question.options[part]?.answer ?? ''), question.query].join('\n\n')
	}
	if (question.type === 'match') return [question.query, quote(question.rows[part]?.text ?? '')].join('\n\n')
	return question.query
}

/**
 * The ninja per option: one each up to 5 options. With 6 to 8 the options go onto the 5 ninjas at
 * random (7 options = 1, 2, 2, 1, 1); the options are shuffled already, so they are dealt in turn.
 */
function ninjasFor(options: number, random: Random): number[] {
	const ninjas = Array.from({ length: Math.min(options, maxNinjas) }, (_, ninja) => ninja)
	if (options <= maxNinjas) return ninjas
	const doubled = new Set(shuffle(ninjas, random).slice(0, options - maxNinjas))
	return ninjas.flatMap((ninja) => (doubled.has(ninja) ? [ninja, ninja] : [ninja]))
}

/** For `order`: the place the option at `source` belongs, 1, 2, 3 …, or `0` for a distractor. */
const rankIn = (correct: readonly boolean[], source: number) =>
	correct[source] ? correct.slice(0, source + 1).filter(Boolean).length : 0

export type OpeningSettings = {
	/** From the settings; `undefined` means no time limit (Novice, and the dojo). */
	readonly timeScale: number | undefined
	readonly random: Random
}

/** What the ambush store opens with for the ambush at `at`. */
export function openingOf(quiz: BunbuData, refs: readonly QuestionRef[], at: QuestionRef, settings: OpeningSettings): AmbushOpening {
	const question = quiz.questions[at.question]
	if (question === undefined) throw new RangeError(`[bunbu] the quiz has no question ${at.question}`)
	const kind = kindOf(question)
	const choices = choicesOf(question, at.part)
	if (choices.length > maxOptions) {
		throw new RangeError(`[bunbu] question ${at.question} has ${choices.length} options, at most ${maxOptions} are allowed`)
	}

	const correct = choices.map((choice) => choice.correct)
	const sources = choices.map((_, source) => source)
	// Yes stays on ↑ and no on ↓; everything else is shuffled.
	const order = kind === 'yes-no' ? sources : shuffle(sources, settings.random)
	if (kind === 'order') startOutOfOrder(order, correct)

	const marks = kind === 'yes-no' ? [yesNoMarks.yes, yesNoMarks.no] : markSets[choices.length] ?? []
	const ninjas = kind === 'yes-no' ? [0, 0] : ninjasFor(choices.length, settings.random)
	const options = order.map((source, place): AmbushOption => ({
		answer: choices[source]!.answer,
		correct: correct[source]!,
		mark: marks[place]!,
		ninja: ninjas[place]!,
		pick: 0,
		source,
		rank: kind === 'order' ? rankIn(correct, source) : 0,
	}))
	const query = queryOf(question, at.part)
	const ownRefs = refs.filter((ref) => ref.question === at.question)

	return {
		kind,
		at,
		query,
		options,
		choose: kind === 'multiple' || kind === 'order' ? correct.filter(Boolean).length : 1,
		seconds: ambushSeconds(kind, [query, ...options.map((option) => option.answer)], options.length, settings.timeScale),
		round: Math.max(1, ownRefs.findIndex((ref) => ref.part === at.part) + 1),
		rounds: Math.max(1, ownRefs.length),
	}
}

/**
 * The data format guarantees an `order` question never starts in the right order. When the
 * shuffle put the correct options in order anyway, swap the first two of them.
 */
function startOutOfOrder(order: number[], correct: readonly boolean[]): void {
	const placed = order.flatMap((source, at) => (correct[source] ? [at] : []))
	const inOrder = placed.every((at, index) => index === 0 || order[at]! > order[placed[index - 1]!]!)
	const [first, second] = placed
	if (!inOrder || first === undefined || second === undefined) return
	;[order[first], order[second]] = [order[second]!, order[first]!]
}
