/**
 * Starting and ending a run, and what the game loop does every frame: the changes that span the
 * run's stores ([flows](../../../../../docs/architecture/state.md#flows-changes-that-span-stores)).
 *
 * The rules themselves belong to the run track; these are the obvious stubs the other tracks
 * build against.
 */

import type { BunbuData } from '@bunbu/data'
import type { RunGame } from '../state/game.mts'
import type { HighScore } from '../state/score.mts'
import { tickAmbush } from './ambush.mts'

/** Metres of path per ambush, until stage length and question count are decided (docs/plan.md). */
export const metresPerAmbush = 120

export function startRun(game: RunGame, data: BunbuData, best?: HighScore): void {
	game.quiz.value.load(data)
	game.score.value.reset(best)
	game.life.value.reset()
	game.ambush.value.close()
	game.ninjas.value.clear()
	game.shogun.value.run()
	game.run.value.start(game.quiz.value.refs.length * metresPerAmbush)
}

/** Ends the run: finished when the quiz is done, fallen when the bar is empty. */
export function endRun(game: RunGame): void {
	if (game.life.value.empty()) {
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
}
