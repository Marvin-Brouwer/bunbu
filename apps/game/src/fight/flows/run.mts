/**
 * Starting and ending a run, and what the game loop does every frame: the changes that span the
 * run's stores ([flows](../../../../../docs/architecture/state.md#flows-changes-that-span-stores)).
 *
 * The run's rules live here: when the next ambush springs, how the samurai recovers from one, and
 * what a finished or fallen run leaves behind (the high score and the misses to practise).
 */

import type { BunbuData } from '@bunbu/data'
import { snapshot } from '../../_shared/state/store.mts'
import type { Outcome, QuestionRef, QuizActions, QuizState } from '../../_shared/state/quiz.mts'
import { settings } from '../../settings/state/settings.mts'
import type { RunGame } from '../state/game.mts'
import { highScores } from '../state/highscores.mts'
import { lastRun } from '../state/lastrun.mts'
import { runConfig } from '../state/run.mts'
import { pointOf, type HighScore } from '../state/score.mts'
import { missShare, openAmbush, settleOutcome, tickAmbush } from './ambush.mts'

/** Metres of path per ambush, until stage length and question count are decided (docs/plan.md). */
export const metresPerAmbush = 120

/**
 * Where the samurai is when the ambush after `answered` answers springs: one leg of the path per
 * ambush, so the last one is at the end of the stage.
 */
export function ambushAt(answered: number): number {
	return (answered + 1) * metresPerAmbush
}

/** `best` defaults to the high score of the quiz, which the HUD shows as the one to beat. */
export function startRun(game: RunGame, data: BunbuData, best: HighScore | undefined = highScores.value.of(data.id, data.version)): void {
	game.quiz.value.load(data)
	game.score.value.reset(best)
	game.life.value.reset()
	game.ambush.value.close()
	game.ninjas.value.clear()
	game.shogun.value.run()
	game.run.value.start(game.quiz.value.refs.length * metresPerAmbush)
}

/**
 * Scores an ambush that has just been recorded, by the point it counts toward
 * ([life bar](../../../../../docs/design/gameplay.md#life-bar)). A question that takes several
 * ambushes, such as the rows of a `match`, is one point: it scores once all of them are right,
 * and its first miss takes its whole share of the life bar, the misses after that nothing.
 */
export function scoreAnswer(game: RunGame, at: QuestionRef, outcome: Outcome): void {
	const { quiz, refs, records } = snapshot<QuizState & QuizActions>(game.quiz)
	if (quiz === undefined) return

	const point = pointOf(quiz, at)
	const answered = records.filter((record) => pointOf(quiz, record.at) === point)
	const missedBefore = answered.slice(0, -1).some((record) => record.outcome !== 'correct')
	if (missedBefore) return

	if (outcome !== 'correct') {
		game.score.value.addMiss()
		game.life.value.hit(missShare(game))
		return
	}
	const parts = refs.filter((ref) => pointOf(quiz, ref) === point).length
	if (answered.length === parts) game.score.value.addCorrect()
}

/**
 * Ends the run: finished when the quiz is done, fallen when the bar is empty. Either way the
 * misses are kept for "practise mistakes", and only a finished run, which is a passed one, can set
 * the high score.
 */
export function endRun(game: RunGame): void {
	const { phase, elapsed } = game.run.value
	if (phase === 'finished' || phase === 'fallen') return

	const fallen = game.life.value.empty()
	const { quiz } = snapshot<QuizState & QuizActions>(game.quiz)
	if (quiz !== undefined) {
		lastRun.value.save(quiz.id, quiz.version, game.quiz.value.misses())
		const { points, correct, answered } = game.score.value
		game.score.value.settle(!fallen && highScores.value.submit(quiz.id, quiz.version, { points, seconds: elapsed, correct, answered }))
	}

	if (fallen) {
		game.shogun.value.fall()
		game.run.value.fall()
		return
	}
	game.run.value.finish()
}

/**
 * Ticks the stores that go by time, once per frame while the run is not paused. `worldDelta` is
 * world time, slowed down during an ambush; `realDelta` is the player's time.
 */
export function tickRun(game: RunGame, worldDelta: number, realDelta: number): void {
	// A frame that ends the resume countdown is still part of the pause, for the ambush too.
	const counting = game.run.value.countdown > 0

	// The run first, so its clock has this frame in it when an ambush ends the run.
	game.run.value.tick(cappedAtAmbush(game, worldDelta), realDelta)
	if (!counting) tickAmbush(game, realDelta)

	const { phase, recovery, distance, countdown } = game.run.value
	if (phase !== 'running' || recovery > 0 || countdown > 0) return

	// The samurai is back on his feet once the strike or the hit has played out, and the ninjas
	// he faced flee or vanish.
	if (game.shogun.value.pose !== 'run') {
		game.shogun.value.run()
		settleOutcome(game)
	}
	if (game.quiz.value.current() !== undefined && distance >= ambushAt(game.quiz.value.answered) - reached) {
		openAmbush(game, settings.value.timeScale())
	}
}

/** Distances this close to the ambush count as there: the path is a sum of fractions. */
const reached = 1e-9

/** The world time that gets the samurai to the next ambush at most, so a long frame never carries him past it. */
function cappedAtAmbush(game: RunGame, worldDelta: number): number {
	const { phase, recovery, distance } = game.run.value
	if (phase !== 'running' || recovery > 0 || game.quiz.value.current() === undefined) return worldDelta
	const left = Math.max(0, ambushAt(game.quiz.value.answered) - distance)
	return Math.min(worldDelta, left / runConfig.pace)
}
