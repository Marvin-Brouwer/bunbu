/**
 * Answering a question, which touches the ambush, the score or the life bar, the samurai and the
 * ninjas at once ([flows](../../../../../docs/architecture/state.md#flows-changes-that-span-stores)).
 *
 * Opening, timing and committing an ambush are the ambush rules; what happens to the run around
 * it (the pause after a hit, resuming) belongs to the run flows.
 */

import { inPlacesOf, openingOf } from '../../_shared/state/ambush-opening.mts'
import { approachOf } from '../../_shared/state/ambush-time.mts'
import type { Random } from '../../_shared/state/random.mts'
import { refuse, snapshot } from '../../_shared/state/store.mts'
import type { AmbushOption, Verdict } from '../../_shared/state/ambush.mts'
import type { QuestionRef, QuizActions, QuizState } from '../../_shared/state/quiz.mts'
import type { RunGame } from '../state/game.mts'
import { shareOfOnePoint } from '../state/life.mts'
import { attackSpawnsOf, outcomeOrder } from '../state/ninjas.mts'
import { runConfig } from '../state/run.mts'
import { moveSeconds, type Move } from '../state/shogun.mts'
import { pointsIn } from '../state/score.mts'
import { recordRun, runIsOver, scoreAnswer } from './run.mts'

/** What one miss costs the life bar, for the quiz that is loaded. */
export function missShare(game: RunGame): number {
	const { quiz, refs } = snapshot<QuizState & QuizActions>(game.quiz)
	if (quiz === undefined) return 1
	return shareOfOnePoint(pointsIn(quiz, refs), quiz.passingScore)
}

/**
 * Springs the ambush for the question that is up next: the world slows down, the ninjas spawn
 * and the scroll opens. `timeScale` comes from the settings, `undefined` for no time limit.
 */
export function openAmbush(game: RunGame, timeScale: number | undefined, random: Random = Math.random): void {
	const at = game.quiz.value.current()
	if (at === undefined) {
		refuse('openAmbush', 'every question has been answered')
		return
	}
	game.run.value.beginAmbush()
	if (game.run.value.phase !== 'ambush') return

	const { quiz, refs } = snapshot<QuizState & QuizActions>(game.quiz)
	if (quiz === undefined) return
	const opening = openingOf(quiz, refs, at, { timeScale, random })
	game.ninjas.value.clear()
	game.ninjas.value.spawn(attackSpawnsOf(opening, random))
	game.ambush.value.start(opening)
}

/**
 * Counts the ambush down and lets the ninjas creep in, so they are the timer. When the time runs
 * out the ambush ends unanswered, whatever was half-swiped.
 *
 * `realDelta` is real time, not the slowed-down world time: the slow motion is only visual, and the
 * time limit is the player's reading time.
 */
export function tickAmbush(game: RunGame, realDelta: number): void {
	const { ambush } = game
	// The 3-2-1 countdown after resuming is part of the pause, not of the time to answer.
	if (!ambush.value.open || game.run.value.countdown > 0) return
	ambush.value.tick(realDelta)
	game.ninjas.value.advance(approachOf(ambush.value.seconds, ambush.value.secondsLeft))
	if (ambush.value.unanswered()) commitAmbush(game)
}

/**
 * Commits the open ambush and spreads the result over the run's stores. When the question has
 * another round, its scroll comes next in the same attack; the outcome plays once the question is
 * done, for every round's answers ([per question type](../../../../../docs/design/gameplay.md#per-question-type)).
 */
export function commitAmbush(game: RunGame, random: Random = Math.random): void {
	// Paused, or in the 3-2-1 after a pause: the player can't answer until the run is back.
	const { phase, countdown } = game.run.value
	if (phase !== 'ambush' || countdown > 0) {
		refuse('commitAmbush', phase === 'ambush' ? 'the run is counting down' : `phase is ${phase}`)
		return
	}
	const { seconds, secondsLeft, options } = game.ambush.value
	const result = game.ambush.value.commit()
	if (result === undefined) return

	game.quiz.value.record({ at: result.at, outcome: result.outcome, picked: result.picked })

	scoreAnswer(game, result.at, result.outcome)
	if (result.outcome !== 'unanswered') game.ninjas.value.judge(result.ninjas)

	const next = game.quiz.value.current()
	if (result.outcome !== 'unanswered' && next?.question === result.at.question && !game.life.value.empty()) {
		openNextRound(game, next, { seconds, secondsLeft }, options, random)
		return
	}

	let hold = runConfig.slicedSeconds
	if (result.outcome === 'unanswered') {
		missRoundsLeft(game, result.at)
		game.shogun.value.hurt()
		game.ninjas.value.strikeUnanswered()
	} else {
		// The ninjas show what was answered, one after another in the order they were answered:
		// he slashes the ones rightly picked and blocks the ones rightly left, and only the ones
		// answered wrong land a hit.
		const moves = outcomeOrder(game.ninjas.value.active).flatMap((ninja): Move[] =>
			ninja.verdict === undefined ? [] : [{ pose: movesFor[ninja.verdict], target: ninja.id }])
		game.shogun.value.fight(moves, outcomeDelaySeconds)
		const last = moves.at(-1)
		hold = outcomeDelaySeconds + Math.max(0, moves.length - 1) * moveSeconds
			+ (last?.pose === 'hurt' ? runConfig.hitSeconds : runConfig.strikeSeconds)
	}

	// The samurai keeps the pose he struck, blocked or was hit in while the run holds, the last
	// answer too, so the outcome plays out before the results or the fall. `tickRun` then settles
	// it and puts him back to running, or ends the run.
	game.run.value.endAmbush(hold)
	// The last answer keeps the run's high score and misses now; the run itself ends after the hold.
	if (runIsOver(game)) recordRun(game)
}

/** What the samurai does with a ninja, by how the answers handled it. */
const movesFor: Readonly<Record<Verdict, Move['pose']>> = { slash: 'strike', block: 'block', miss: 'hurt' }

/** Seconds after the answer before the first ninja is dealt with: the scroll rolls out of the way first. */
export const outcomeDelaySeconds = 0.4

/**
 * The next round of a question, in the same attack: the scroll rolls up and the next one unrolls,
 * the ninjas keep closing in and the time goes on. What the answer did to each ninja plays out
 * after the last round.
 */
function openNextRound(game: RunGame, at: QuestionRef, time: { seconds: number; secondsLeft: number }, before: readonly AmbushOption[], random: Random): void {
	const { quiz, refs } = snapshot<QuizState & QuizActions>(game.quiz)
	if (quiz === undefined) return
	// The time limit is the question's, so it is the same for every round.
	const opening = { ...inPlacesOf(openingOf(quiz, refs, at, { timeScale: undefined, random }), before), seconds: time.seconds }
	game.ninjas.value.regroup(attackSpawnsOf(opening, random))
	game.ambush.value.nextRound(opening, time.secondsLeft)
}

/** The time ran out: the rounds of the question still to come go unanswered too. */
function missRoundsLeft(game: RunGame, at: QuestionRef): void {
	for (let next = game.quiz.value.current(); next?.question === at.question; next = game.quiz.value.current()) {
		game.quiz.value.record({ at: next, outcome: 'unanswered', picked: [] })
		scoreAnswer(game, next, 'unanswered')
	}
}

/** The ninja a move is aimed at goes down, is blocked and knocked back, or lands its hit. */
function meet(game: RunGame, move: Move): void {
	if (move.pose === 'strike') game.ninjas.value.slay(move.target)
	else if (move.pose === 'block') game.ninjas.value.block(move.target)
	else game.ninjas.value.strike(move.target)
}

/** While the run holds after an answer, the samurai deals with the next ninja in turn. */
export function tickOutcome(game: RunGame, realDelta: number): void {
	// A long frame can take in more than one move.
	for (let move = game.shogun.value.tick(realDelta); move !== undefined; move = game.shogun.value.tick(0)) meet(game, move)
}
