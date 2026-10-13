/**
 * Practice ([dojo.md](../../../../../docs/design/dojo.md#practice)): the ambush without the risk.
 * The same questions and rounds as a run, but no timer, no life bar and no score: each answer
 * counts toward the right vs wrong tally, and the next question opens once the scroll answered
 * has rolled up.
 */

import type { BunbuData } from '@bunbu/data'
import { fitOf, inPlacesOf, openingOf } from '../../_shared/state/ambush-opening.mts'
import type { AmbushOption } from '../../_shared/state/ambush.mts'
import type { QuestionRef, QuizActions, QuizState } from '../../_shared/state/quiz.mts'
import { shuffle, type Random } from '../../_shared/state/random.mts'
import { refuse, snapshot } from '../../_shared/state/store.mts'
import type { PracticeGame } from '../state/practice.mts'

/**
 * Seconds after a right answer before the next question opens: the scroll answered rolls up first
 * (its `vanish` in scroll.css), so its swipe zone can't answer a question not on screen yet.
 */
export const nextQuestionSeconds = 0.65

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

/** **Start**: into the ambushes, the first one open. */
export function beginPractice(game: PracticeGame, random: Random = Math.random): void {
	game.session.value.begin()
	if (game.session.value.phase !== 'practising') return
	openPractice(game, random)
}

/** **Again** after the last question: the same questions, shuffled again, and a fresh tally. */
export function practiseAgain(game: PracticeGame, random: Random = Math.random): void {
	const { quiz, order } = snapshot<QuizState & QuizActions>(game.quiz)
	if (quiz === undefined) return
	game.quiz.value.load(quiz, shuffle(order, random), random)
	game.tally.value.reset()
	beginPractice(game, random)
}

/** Opens the ambush for the question up next, or ends the session after the last one. */
export function openPractice(game: PracticeGame, random: Random = Math.random): void {
	const at = game.quiz.value.current()
	if (at === undefined) {
		game.ambush.value.close()
		game.session.value.finish()
		return
	}
	const { quiz, refs } = snapshot<QuizState & QuizActions>(game.quiz)
	if (quiz === undefined) return
	// No ninjas come in, so the scroll can be answered as soon as it is there.
	game.ambush.value.start(openingOf(quiz, refs, at, { timeScale: undefined, random }), 0)
}

/**
 * Counts down the wait for the next question, and opens it when it is up. There is no time limit,
 * so nothing else runs out.
 */
export function tickPractice(game: PracticeGame, realDelta: number, random: Random = Math.random): void {
	if (game.session.value.phase !== 'practising') return
	game.ambush.value.tick(realDelta)
	if (game.session.value.countDown(realDelta)) openPractice(game, random)
}

/**
 * Answers the open ambush: right or wrong goes on the tally, and the next round of the question, or
 * the next question, opens.
 */
export function commitPractice(game: PracticeGame, random: Random = Math.random): void {
	const { phase } = game.session.value
	if (phase !== 'practising') {
		refuse('commitPractice', `phase is ${phase}`)
		return
	}
	const { options } = game.ambush.value
	const result = game.ambush.value.commit()
	if (result === undefined) return

	game.quiz.value.record({ at: result.at, outcome: result.outcome, picked: result.picked })
	if (result.outcome === 'correct') game.tally.value.addRight()
	else {
		game.tally.value.addWrong()
		// There is no miss screen to show yet, so practice moves straight on and the dummy, which
		// swings back while the miss screen shows, stands still.
		game.tally.value.carryOn()
	}

	// The next round of the question at once, its scroll revealed under this one; the next
	// question once this scroll has rolled up.
	const next = game.quiz.value.current()
	if (next?.question === result.at.question) openNextRound(game, next, options, random)
	else if (next === undefined) openPractice(game, random)
	else game.session.value.waitForNext(nextQuestionSeconds)
}

/** The next round of a question, with the options that were in the round before still where they were. */
function openNextRound(game: PracticeGame, at: QuestionRef, before: readonly AmbushOption[], random: Random): void {
	const { quiz, refs } = snapshot<QuizState & QuizActions>(game.quiz)
	if (quiz === undefined) return
	game.ambush.value.nextRound(inPlacesOf(openingOf(quiz, refs, at, { timeScale: undefined, random }), before), 0)
}

/** Where the question at `at` is in the session, `8 / 40`, for the scroll's heading. */
export function progressOf(game: PracticeGame, at: QuestionRef): string {
	const { order } = game.quiz.value
	return `${order.indexOf(at.question) + 1} / ${order.length}`
}
