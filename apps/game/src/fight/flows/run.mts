/**
 * Starting and ending a run, and what the game loop does every frame: the changes that span the
 * run's stores ([flows](../../../../../docs/architecture/state.md#flows-changes-that-span-stores)).
 *
 * The run's rules live here: when the next ambush springs, how the samurai recovers from one, and
 * what a finished or fallen run leaves behind (the high score and the misses to practise).
 */

import type { BunbuData } from '@bunbu/data'
import { snapshot } from '../../_shared/state/store.mts'
import type { QuizActions, QuizState } from '../../_shared/state/quiz.mts'
import { settings } from '../../settings/state/settings.mts'
import type { RunGame } from '../state/game.mts'
import { highScores } from '../state/highscores.mts'
import { lastRun } from '../state/lastrun.mts'
import type { HighScore } from '../state/score.mts'
import { openAmbush, tickAmbush } from './ambush.mts'

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
	// The ambush first: a frame that ends the resume countdown is still part of the pause.
	tickAmbush(game, realDelta)
	game.run.value.tick(worldDelta, realDelta)

	const { phase, recovery, distance, countdown } = game.run.value
	if (phase !== 'running' || recovery > 0 || countdown > 0) return

	// The samurai is back on his feet once the strike or the hit has played out.
	if (game.shogun.value.pose !== 'run') game.shogun.value.run()
	if (game.quiz.value.current() !== undefined && distance >= ambushAt(game.quiz.value.answered)) {
		openAmbush(game, settings.value.timeScale())
	}
}
