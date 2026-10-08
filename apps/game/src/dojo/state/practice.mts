/**
 * The state of one dojo practice session ([D4 Practice](../../../../../docs/design/dojo.md)):
 * the same questions and ambush as a run, but no timer, no life bar and no score, only the running
 * right vs wrong count. The practice route creates it when it mounts and drops it when it unmounts.
 *
 * The rules belong to the dojo track; this fixes the shapes.
 */

import { createAmbush, noAmbush, type Ambush, type AmbushState } from '../../_shared/state/ambush.mts'
import { createQuiz, noQuiz, type Quiz, type QuizState } from '../../_shared/state/quiz.mts'
import { createStore, type Store } from '@rooted/store'

export type TallyState = {
	readonly right: number
	readonly wrong: number
	/** Showing the miss screen ([D5](../../../../../docs/design/screens.md#d5-practice-miss)) until **Continue**. */
	readonly missed: boolean
}

export type TallyActions = {
	addRight: () => void
	/** Counts a miss and shows the miss screen. */
	addWrong: () => void
	/** Leaves the miss screen. */
	carryOn: () => void
	reset: () => void
}

/** The store, with its actions on its state. Change it through those, not `update`. */
export type Tally = Store<TallyState & TallyActions>

export const noTally: TallyState = { right: 0, wrong: 0, missed: false }

export function createTally(initial: TallyState = noTally): Tally {
	const store: Tally = createStore<TallyState & TallyActions>({
		...initial,
		addRight: () => { store.update(() => ({ right: store.value.right + 1 })) },
		addWrong: () => { store.update(() => ({ wrong: store.value.wrong + 1, missed: true })) },
		carryOn: () => { store.update(() => ({ missed: false })) },
		reset: () => { store.update(() => noTally) },
	})
	return store
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
