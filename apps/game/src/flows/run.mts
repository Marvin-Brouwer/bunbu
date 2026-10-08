/**
 * Starting and ending a run: the changes that span stores
 * ([flows](../../../../docs/architecture/state.md#flows-changes-that-span-stores)).
 *
 * The rules themselves belong to the run track; these are the obvious stubs the other tracks
 * build against.
 */

import type { BunbuData } from '@bunbu/data'
import { ambush } from '../state/ambush.mts'
import { life } from '../state/life.mts'
import { ninjas } from '../state/ninjas.mts'
import { quiz } from '../state/quiz.mts'
import { score, type HighScore } from '../state/score.mts'
import { screen } from '../state/screen.mts'
import { shogun } from '../state/shogun.mts'
import { run } from '../state/run.mts'

/** Metres of path per ambush, until stage length and question count are decided (docs/plan.md). */
export const metresPerAmbush = 120

export function startRun(data: BunbuData, best?: HighScore): void {
	quiz.load(data)
	score.reset(best)
	life.reset()
	ambush.close()
	ninjas.clear()
	shogun.run()
	run.start(quiz.get().refs.length * metresPerAmbush)
	screen.show('run')
}

/** Ends the run: the results screen when the quiz is done, the fallen screen when the bar is empty. */
export function endRun(): void {
	if (life.empty()) {
		shogun.fall()
		run.fall()
		screen.show('fallen')
		return
	}
	run.finish()
	screen.show('results')
}
