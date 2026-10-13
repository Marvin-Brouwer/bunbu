/**
 * The state of one dojo practice session ([D4 Practice](../../../../../docs/design/dojo.md)):
 * the same questions and ambush as a run, but no timer, no life bar and no score, only the running
 * right vs wrong count. The practice route creates it when it mounts and drops it when it unmounts.
 *
 * The session goes from the start screen ([D3](../../../../../docs/design/screens.md#d3-practice-start))
 * into the ambushes, can pause, and is done after the last question.
 */

import { createAmbush, noAmbush, type Ambush, type AmbushState } from '../../_shared/state/ambush.mts'
import { createQuiz, noQuiz, type Quiz, type QuizState } from '../../_shared/state/quiz.mts'
import { refuse } from '../../_shared/state/store.mts'
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

/**
 * The running right vs wrong percentage, rounded down so 99.5% is never shown as all right;
 * `undefined` before the first answer. It isn't a score and isn't stored.
 */
export function percentRight({ right, wrong }: Pick<TallyState, 'right' | 'wrong'>): number | undefined {
	const answered = right + wrong
	return answered === 0 ? undefined : Math.floor((right / answered) * 100)
}

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

export type SessionPhase = 'start' | 'practising' | 'paused' | 'done'

export type SessionState = {
	readonly phase: SessionPhase
}

export type SessionActions = {
	/** **Start** on the start screen: into the ambushes. */
	begin: () => void
	pause: () => void
	resume: () => void
	/** The last question is answered. */
	finish: () => void
}

/** The store, with its actions on its state. Change it through those, not `update`. */
export type Session = Store<SessionState & SessionActions>

export const noSession: SessionState = { phase: 'start' }

export function createSession(initial: SessionState = noSession): Session {
	const store: Session = createStore<SessionState & SessionActions>({
		...initial,
		begin: () => {
			if (store.value.phase !== 'start' && store.value.phase !== 'done') {
				refuse('session.begin', `phase is ${store.value.phase}`)
				return
			}
			store.update(() => ({ phase: 'practising' }))
		},
		pause: () => {
			if (store.value.phase !== 'practising') return
			store.update(() => ({ phase: 'paused' }))
		},
		resume: () => {
			if (store.value.phase !== 'paused') return
			store.update(() => ({ phase: 'practising' }))
		},
		finish: () => { store.update(() => ({ phase: 'done' })) },
	})
	return store
}

export type PracticeGame = {
	readonly session: Session
	readonly quiz: Quiz
	/** Opened with `seconds: 0`: practice has no time limit. */
	readonly ambush: Ambush
	readonly tally: Tally
}

export type PracticeGameState = {
	readonly session: SessionState
	readonly quiz: QuizState
	readonly ambush: AmbushState
	readonly tally: TallyState
}

export const newPractice: PracticeGameState = { session: noSession, quiz: noQuiz, ambush: noAmbush, tally: noTally }

export function createPracticeGame(initial: Partial<PracticeGameState> = {}): PracticeGame {
	const state = { ...newPractice, ...initial }
	return {
		session: createSession(state.session),
		quiz: createQuiz(state.quiz),
		ambush: createAmbush(state.ambush),
		tally: createTally(state.tally),
	}
}
