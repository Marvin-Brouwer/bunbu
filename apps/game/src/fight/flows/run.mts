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

/** Metres of path per ambush, until stage length and question count are decided (docs/plan.md). */
export const metresPerAmbush = 120

export function startRun(game: RunGame, data: BunbuData, best?: HighScore): void {
	game.quiz.load(data)
	game.score.reset(best)
	game.life.reset()
	game.ambush.close()
	game.ninjas.clear()
	game.shogun.run()
	game.run.start(game.quiz.value.refs.length * metresPerAmbush)
}

/** Ends the run: finished when the quiz is done, fallen when the bar is empty. */
export function endRun(game: RunGame): void {
	if (game.life.empty()) {
		game.shogun.fall()
		game.run.fall()
		return
	}
	game.run.finish()
}

/** Ticks the stores that go by time, once per frame while the run is not paused. */
export function tickRun(game: RunGame, dt: number): void {
	game.run.tick(dt)
	const ambush = game.ambush.value
	if (!ambush.open) return
	game.ambush.tick(dt)
	// The ninjas creeping in are the timer (gameplay.md#time-limit).
	if (ambush.seconds > 0) game.ninjas.advance(1 - game.ambush.value.secondsLeft / ambush.seconds)
}
