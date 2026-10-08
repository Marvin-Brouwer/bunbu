/**
 * Answering a question, which touches the ambush, the score or the life bar, the samurai and the
 * ninjas at once ([flows](../../../../../docs/architecture/state.md#flows-changes-that-span-stores)).
 *
 * The rules themselves belong to the ambush and run tracks; this is the obvious stub.
 */

import type { RunGame } from '../state/game.mts'
import { shareOfOnePoint } from '../state/life.mts'
import { endRun } from './run.mts'

/** What one miss costs the life bar, for the quiz that is loaded. */
export function missShare(game: RunGame): number {
	const { quiz, refs } = game.quiz.value
	if (quiz === undefined) return 1
	return shareOfOnePoint(refs.length, quiz.passingScore)
}

/** Commits the open ambush and spreads the result over the run's stores. */
export function commitAmbush(game: RunGame): void {
	const result = game.ambush.commit()
	if (result === undefined) return

	game.quiz.record({ at: result.at, outcome: result.outcome, picked: result.picked })

	if (result.outcome === 'correct') {
		game.score.addCorrect()
		for (const ninja of result.slain) game.ninjas.slay(ninja)
		for (const ninja of result.blocked) game.ninjas.block(ninja)
		const [first] = result.slain
		if (first === undefined) game.shogun.block(result.blocked[0] ?? 0)
		else game.shogun.strike(first)
	} else {
		game.score.addMiss()
		game.life.hit(missShare(game))
		game.shogun.hurt()
		for (const ninja of game.ninjas.value.active) game.ninjas.strike(ninja.id)
	}

	const { answered, refs } = game.quiz.value
	if (game.life.empty() || answered >= refs.length) {
		endRun(game)
		return
	}
	// The samurai keeps the pose he struck, blocked or was hit in: the run track adds the pause
	// before the run resumes (about 1 s after a hit) and puts him back to running.
	game.run.endAmbush()
}
