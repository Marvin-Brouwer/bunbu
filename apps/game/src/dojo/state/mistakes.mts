/**
 * Practice mistakes ([practise mistakes](../../../../../docs/design/dojo.md#practise-mistakes)):
 * the questions the last run got wrong or left unanswered, which practice is filtered to.
 */

import type { AnswerRecord } from '../../_shared/state/quiz.mts'

/**
 * The questions missed, in the order they were missed, each once: a `solutions` or `match`
 * question with several rounds missed is still one question to practise.
 */
export function missedQuestions(misses: readonly AnswerRecord[]): number[] {
	return [...new Set(misses.map((miss) => miss.at.question))]
}
