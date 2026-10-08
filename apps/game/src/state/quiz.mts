/**
 * The quiz being played: the order its questions are asked in, and what the player answered.
 * Shared by every game mode that asks questions, so each mode creates its own.
 *
 * A question can take several ambushes: one per `solutions` entry and one per `match` row
 * ([per question type](../../../../docs/design/gameplay.md#per-question-type)). A single ambush is
 * addressed by a {@link QuestionRef}, and each ref is worth one point
 * ([life bar](../../../../docs/design/gameplay.md#life-bar)).
 */

import type { BunbuData, Question } from '@bunbu/data'
import { createStore, refuse, type Readable } from './store.mts'

/** One ambush: a question, plus which solution or row of it is being asked. */
export type QuestionRef = {
	readonly question: number
	/** `0` for questions that are one ambush, otherwise the solution or row being asked. */
	readonly part: number
}

export type Outcome = 'correct' | 'wrong' | 'unanswered'

/** What the player answered, kept for the review and for "practise mistakes". */
export type AnswerRecord = {
	readonly at: QuestionRef
	readonly outcome: Outcome
	/** Indices into the question's options, in the order they were picked. */
	readonly picked: readonly number[]
}

export type QuizState = {
	readonly quiz: BunbuData | undefined
	/** Question indices in the order they are asked. */
	readonly order: readonly number[]
	/** Every ambush of this quiz, in the order they are asked. */
	readonly refs: readonly QuestionRef[]
	/** How many ambushes have been answered. */
	readonly answered: number
	readonly records: readonly AnswerRecord[]
}

export type Quiz = Readable<QuizState> & {
	/** Loads a quiz. `order` defaults to the questions in file order; the app shuffles it. */
	load: (data: BunbuData, order?: readonly number[]) => void
	/** The ambush that is up next, or `undefined` when the quiz is done. */
	current: () => QuestionRef | undefined
	/** The question a ref points at. */
	question: (at: QuestionRef) => Question | undefined
	/** Records an answer and moves on to the next ambush. */
	record: (answer: AnswerRecord) => void
	/** The answers that were wrong or unanswered, for the review and for practice. */
	misses: () => readonly AnswerRecord[]
	/** Starts the same quiz over, in the same order. */
	reset: () => void
}

export const noQuiz: QuizState = { quiz: undefined, order: [], refs: [], answered: 0, records: [] }

/** How many ambushes a question takes: one per solution, one per row, otherwise one. */
export function partsOf(question: Question): number {
	if (question.type === 'solutions') return question.options.length
	if (question.type === 'match') return question.rows.length
	return 1
}

/** Every ambush of the quiz, in the order the questions are asked. Each one is worth a point. */
export function refsOf(quiz: BunbuData, order: readonly number[]): QuestionRef[] {
	return order.flatMap((question) => {
		const parts = partsOf(quiz.questions[question]!)
		return Array.from({ length: parts }, (_, part) => ({ question, part }))
	})
}

/** A loaded quiz, ready to be asked in `order`. */
export function loaded(data: BunbuData, order?: readonly number[]): QuizState {
	const asked = order ?? data.questions.map((_, index) => index)
	return { ...noQuiz, quiz: data, order: asked, refs: refsOf(data, asked) }
}

export function createQuiz(initial: QuizState = noQuiz): Quiz {
	const store = createStore(initial)

	return {
		get: store.get,
		subscribe: store.subscribe,

		load(data, order) {
			store.set(loaded(data, order))
		},

		current() {
			const { refs, answered } = store.get()
			return refs[answered]
		},

		question(at) {
			return store.get().quiz?.questions[at.question]
		},

		record(answer) {
			const state = store.get()
			if (state.answered >= state.refs.length) {
				refuse('quiz.record', 'every question has been answered')
				return
			}
			store.set({ ...state, answered: state.answered + 1, records: [...state.records, answer] })
		},

		misses() {
			return store.get().records.filter((record) => record.outcome !== 'correct')
		},

		reset() {
			const { quiz, order } = store.get()
			store.set(quiz === undefined ? noQuiz : loaded(quiz, order))
		},
	}
}
