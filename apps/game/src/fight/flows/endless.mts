/**
 * Endless ([endless](../../../../../docs/design/gameplay.md#endless)): every stage in turn, a test
 * on each, for as long as the samurai stands. Plain numbers, so the run, the world and the HUD agree
 * on where one stage ends and the next begins.
 *
 * A stage of endless is as many questions as a test of the quiz (`questionsPerTest`, or all of
 * them), one leg of the path each. The run changes stage halfway between the last ambush of one
 * stage and the first of the next.
 */

import type { BunbuData } from '@bunbu/data'
import { stages, type Stage } from '../../_shared/state/selection.mts'
import type { QuestionRef } from '../../_shared/state/quiz.mts'
import { metresPerAmbush } from './run.mts'

/** How many questions a stage of endless asks: a test's worth. */
export function stageQuestions(data: Pick<BunbuData, 'questionsPerTest'> & { readonly questions: { readonly length: number } }): number {
	return Math.max(1, Math.min(data.questionsPerTest ?? data.questions.length, data.questions.length))
}

/** The stage the `index`th stage of endless is run on: Rice fields to Edo castle, and round again. */
export function endlessStage(index: number): Stage {
	return stages[((index % stages.length) + stages.length) % stages.length] ?? stages[0]
}

/** The stage of endless the question asked after `asked` others is in. */
export const stageOfQuestion = (asked: number, questions: number): number => Math.floor(asked / questions)

/** Where the `index`th stage of endless starts, in metres: halfway along the leg before its first ambush. */
export const stageStart = (index: number, questions: number): number => index === 0 ? 0 : (index * questions + 0.5) * metresPerAmbush

/** Which stage of endless the samurai is in, `distance` metres along. */
export function stageAt(distance: number, questions: number): number {
	return Math.max(0, Math.floor((distance - metresPerAmbush / 2) / (questions * metresPerAmbush)))
}

/**
 * How many questions `refs` asks, and so how many ambushes it springs: each question once per time
 * it is asked, its rounds together. In endless a question comes round again once all have been asked.
 */
export function asksIn(refs: readonly QuestionRef[]): number {
	return refs.filter((ref, index) => index === 0 || refs[index - 1]?.question !== ref.question).length
}
