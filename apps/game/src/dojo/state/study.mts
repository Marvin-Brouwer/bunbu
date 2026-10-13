/**
 * The state of one dojo study session ([D2 Study](../../../../../docs/design/dojo.md)): a
 * shuffled loop of cards read aloud, with what is being said highlighted. The study route
 * creates it when it mounts and drops it when it unmounts.
 *
 * Speech itself is a side effect and lives outside the stores (`_shared/speech/`); it reports the
 * card it reached through `reach` and what is being said through `speak`.
 */

import { createQuiz, noQuiz, type Quiz, type QuizState } from '../../_shared/state/quiz.mts'
import { createStore, type Store } from '@rooted/store'

export type ReadingState = {
	/** Index into the quiz's `order` of the card on screen. */
	readonly card: number
	readonly playing: boolean
	/**
	 * What is being said, for the highlight: the word, or the whole sentence where the voice doesn't
	 * say which word, as character ranges in the card's blocks of text. Empty between words.
	 */
	readonly said: readonly { readonly block: number; readonly start: number; readonly end: number }[]
}

export type ReadingActions = {
	play: () => void
	pause: () => void
	/** Back to the first card. */
	restart: () => void
	/** The card the reading reached, or that was skipped to. */
	reach: (card: number) => void
	/** What the speech engine is saying, or nothing between words. */
	speak: (said: ReadingState['said']) => void
}

/** The store, with its actions on its state. Change it through those, not `update`. */
export type Reading = Store<ReadingState & ReadingActions>

export const notReading: ReadingState = { card: 0, playing: false, said: [] }

export function createReading(initial: ReadingState = notReading): Reading {
	const change = (next: Partial<ReadingState>) => { store.update(() => next) }
	const store: Reading = createStore<ReadingState & ReadingActions>({
		...initial,
		play: () => { change({ playing: true }) },
		pause: () => { change({ playing: false }) },
		restart: () => { change({ card: 0, said: [] }) },
		reach: (card) => { change({ card, said: [] }) },
		speak: (said) => { change({ said }) },
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
