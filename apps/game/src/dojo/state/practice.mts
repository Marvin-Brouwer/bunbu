/**
 * The state of one dojo practice session ([D4 Practice](../../../../../docs/design/dojo.md)):
 * the same questions and ambush as a run, but no timer, no life bar and no score, only the running
 * right vs wrong count. The practice route creates it when it mounts and drops it when it unmounts.
 *
 * The rules belong to the dojo track; this fixes the shapes.
 */

import { createAmbush, noAmbush, type Ambush, type AmbushState } from '../../_shared/state/ambush.mts'
import { createQuiz, noQuiz, type Quiz, type QuizState } from '../../_shared/state/quiz.mts'
import { createStore } from '@rooted/store'
import { type Readable, snapshot } from '../../_shared/state/store.mts'

export type TallyState = {
	readonly right: number
	readonly wrong: number
	/** Showing the miss screen ([D5](../../../../../docs/design/screens.md#d5-practice-miss)) until **Continue**. */
	readonly missed: boolean
}

export type Tally = Readable<TallyState> & {
	right: () => void
	/** Counts a miss and shows the miss screen. */
	wrong: () => void
	/** Leaves the miss screen. */
	carryOn: () => void
	reset: () => void
}

export const noTally: TallyState = { right: 0, wrong: 0, missed: false }

export function createTally(initial: TallyState = noTally): Tally {
	const store = createStore(initial)
	return {
		get value() {
			return snapshot(store)
		},
		on: store.on.bind(store),
		right: () => { store.update(() => ({ right: snapshot(store).right + 1 })) },
		wrong: () => { store.update(() => ({ wrong: snapshot(store).wrong + 1, missed: true })) },
		carryOn: () => { store.update(() => ({ missed: false })) },
		reset: () => { store.update(() => noTally) },
	}
}

export type PracticeGame = {
	readonly quiz: Quiz
	/** Opened with `seconds: 0`: practice has no time limit. */
	readonly ambush: Ambush
	readonly tally: Tally
}

export type PracticeGameState = {
	readonly quiz: QuizState
	readonly ambush: AmbushState
	readonly tally: TallyState
}

export const newPractice: PracticeGameState = { quiz: noQuiz, ambush: noAmbush, tally: noTally }

export function createPracticeGame(initial: Partial<PracticeGameState> = {}): PracticeGame {
	const state = { ...newPractice, ...initial }
	return {
		quiz: createQuiz(state.quiz),
		ambush: createAmbush(state.ambush),
		tally: createTally(state.tally),
	}
}
