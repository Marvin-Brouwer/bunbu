/**
 * Starting a practice session: which questions it asks, and in what order
 * ([practice](../../../../../docs/design/dojo.md#practice)).
 */

import type { BunbuData } from '@bunbu/data'
import { fitOf } from '../../_shared/state/ambush-opening.mts'
import { shuffle, type Random } from '../../_shared/state/random.mts'
import type { PracticeGame } from '../state/practice.mts'

/**
 * The questions practice asks, as indices into the quiz: every question, or only `missed` when it
 * is given. A question no ambush can ask (more than 8 correct options) is left out. With `random`
 * they are shuffled; without it, tests get them in file order.
 */
export function practiceOrder(data: BunbuData, missed?: readonly number[], random?: Random): number[] {
	const asked = (missed ?? data.questions.map((_, index) => index))
		.filter((index) => {
			const question = data.questions[index]
			return question !== undefined && fitOf(question) !== 'unplayable'
		})
	return random === undefined ? asked : shuffle(asked, random)
}

/** Loads the quiz for a new session on the start screen: `missed` filters it to the last run's mistakes. */
export function preparePractice(game: PracticeGame, data: BunbuData, missed?: readonly number[], random?: Random): void {
	game.quiz.value.load(data, practiceOrder(data, missed, random), random)
	game.ambush.value.close()
	game.tally.value.reset()
}
