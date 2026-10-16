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
import { questionsAnswered, questionsStarted, type Asked } from '../../_shared/state/quiz.mts'
import { stages, type Stage } from '../../_shared/state/selection.mts'
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

/**
 * Which stage of endless the samurai is in, `distance` metres along with `answered` questions
 * done: never past the stage whose questions are not all answered yet, however far a long ambush
 * has carried him on. Pass the answers that count toward going on ({@link answersOn}).
 */
export function stageAt(distance: number, questions: number, answered = Infinity): number {
	const along = Math.max(0, Math.floor((distance - metresPerAmbush / 2) / (questions * metresPerAmbush)))
	return Math.min(along, Math.floor(answered / questions))
}


/**
 * The questions that take the run on to the next stage: those answered to the end, or, fallen,
 * those before the one he fell on, which may have been halfway through its rounds.
 */
export function answersOn(state: Asked & { readonly answered: number }, fallen: boolean): number {
	return fallen ? Math.max(0, questionsStarted(state) - 1) : questionsAnswered(state)
}
