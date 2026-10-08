/**
 * Answering a question, which touches the ambush, the score or the life bar, the samurai and the
 * ninjas at once ([flows](../../../../docs/architecture/state.md#flows-changes-that-span-stores)).
 *
 * The rules themselves belong to the ambush and run tracks; this is the obvious stub.
 */

import { ambush } from '../state/ambush.mts'
import { life, shareOfOnePoint } from '../state/life.mts'
import { ninjas } from '../state/ninjas.mts'
import { quiz } from '../state/quiz.mts'
import { run } from '../state/run.mts'
import { score } from '../state/score.mts'
import { shogun } from '../state/shogun.mts'
import { endRun } from './run.mts'

/** What one miss costs the life bar, for the quiz that is loaded. */
export function missShare(): number {
	const { quiz: data, refs } = quiz.get()
	if (data === undefined) return 1
	return shareOfOnePoint(refs.length, data.passingScore)
}

/** Commits the open ambush and spreads the result over the stores. */
export function commitAmbush(): void {
	const result = ambush.commit()
	if (result === undefined) return

	quiz.record({ at: result.at, outcome: result.outcome, picked: result.picked })

	if (result.outcome === 'correct') {
		score.addCorrect()
		for (const ninja of result.slain) ninjas.slay(ninja)
		for (const ninja of result.blocked) ninjas.block(ninja)
		const [first] = result.slain
		if (first === undefined) shogun.block(result.blocked[0] ?? 0)
		else shogun.strike(first)
	} else {
		score.addMiss()
		life.hit(missShare())
		shogun.hurt()
		for (const ninja of ninjas.get().active) ninjas.strike(ninja.id)
	}

	const done = quiz.get().answered >= quiz.get().refs.length
	if (life.empty() || done) {
		endRun()
		return
	}
	// The samurai keeps the pose he struck, blocked or was hit in: the run track adds the pause
	// before the run resumes (about 1 s after a hit) and puts him back to running.
	run.endAmbush()
}
