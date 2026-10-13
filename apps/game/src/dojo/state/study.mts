/**
 * The state of one dojo study session ([D2 Study](../../../../../docs/design/dojo.md)): a
 * shuffled loop of cards read aloud, with the word being spoken highlighted. The study route
 * creates it when it mounts and drops it when it unmounts.
 *
 * Speech itself is a side effect and lives outside the stores (`_shared/speech/`); it reports the
 * card it reached through `reach` and the spoken word through `speak`.
 */

import { createQuiz, noQuiz, type Quiz, type QuizState } from '../../_shared/state/quiz.mts'
import { createStore, type Store } from '@rooted/store'

export type ReadingState = {
	/** Index into the quiz's `order` of the card on screen. */
	readonly card: number
	readonly playing: boolean
	/** The word being spoken: a character range in one of the card's blocks of text, for the highlight. */
	readonly word: { readonly block: number; readonly start: number; readonly end: number } | undefined
}

export type ReadingActions = {
	play: () => void
	pause: () => void
	/** Back to the first card. */
	restart: () => void
	/** The card the reading reached, or that was skipped to. */
	reach: (card: number) => void
	/** The word the speech engine reached, or `undefined` between words. */
	speak: (word: ReadingState['word']) => void
}

/** The store, with its actions on its state. Change it through those, not `update`. */
export type Reading = Store<ReadingState & ReadingActions>

export const notReading: ReadingState = { card: 0, playing: false, word: undefined }

export function createReading(initial: ReadingState = notReading): Reading {
	const change = (next: Partial<ReadingState>) => { store.update(() => next) }
	const store: Reading = createStore<ReadingState & ReadingActions>({
		...initial,
		play: () => { change({ playing: true }) },
		pause: () => { change({ playing: false }) },
		restart: () => { change({ card: 0, word: undefined }) },
		reach: (card) => { change({ card, word: undefined }) },
		speak: (word) => { change({ word }) },
	})
	return store
}

export type StudyGame = {
	readonly quiz: Quiz
	readonly reading: Reading
}

export type StudyGameState = {
	readonly quiz: QuizState
	readonly reading: ReadingState
}

export const newStudy: StudyGameState = { quiz: noQuiz, reading: notReading }

export function createStudyGame(initial: Partial<StudyGameState> = {}): StudyGame {
	const state = { ...newStudy, ...initial }
	return {
		quiz: createQuiz(state.quiz),
		reading: createReading(state.reading),
	}
}
