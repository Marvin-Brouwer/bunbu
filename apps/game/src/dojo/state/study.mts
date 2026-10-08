/**
 * The state of one dojo study session ([D2 Study](../../../../../docs/design/dojo.md)): a
 * shuffled loop of cards read aloud, with the word being spoken highlighted. The study route
 * creates it when it mounts and drops it when it unmounts.
 *
 * Speech itself is a side effect and lives outside the stores; it reports the spoken word back
 * through `speak`. The rules belong to the dojo track; this fixes the shapes.
 */

import { createQuiz, noQuiz, type Quiz, type QuizState } from '../../_shared/state/quiz.mts'
import { createStore, type Store } from '@rooted/store'

export type ReadingState = {
	/** Index into the quiz's `order` of the card on screen. */
	readonly card: number
	readonly playing: boolean
	/** Speech rate, `1` is normal. */
	readonly rate: number
	/** Character range of the word being spoken in the card's text, for the highlight. */
	readonly word: { readonly start: number; readonly end: number } | undefined
}

export type ReadingActions = {
	play: () => void
	pause: () => void
	/** Back to the first card. */
	restart: () => void
	/** The next card; loops back to the first after the last. */
	next: (cards: number) => void
	setRate: (rate: number) => void
	/** The word the speech engine reached, or `undefined` between words. */
	speak: (word: ReadingState['word']) => void
}

/** The store, with its actions on its state. Change it through those, not `update`. */
export type Reading = Store<ReadingState & ReadingActions>

export const notReading: ReadingState = { card: 0, playing: false, rate: 1, word: undefined }

export function createReading(initial: ReadingState = notReading): Reading {
	const change = (next: Partial<ReadingState>) => { store.update(() => next) }
	const store: Reading = createStore<ReadingState & ReadingActions>({
		...initial,
		play: () => { change({ playing: true }) },
		pause: () => { change({ playing: false }) },
		restart: () => { change({ card: 0, word: undefined }) },
		next: (cards) => { change({ card: cards === 0 ? 0 : (store.value.card + 1) % cards, word: undefined }) },
		setRate: (rate) => { change({ rate: Math.min(2, Math.max(0.5, rate)) }) },
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
