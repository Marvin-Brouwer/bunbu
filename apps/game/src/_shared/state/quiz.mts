/**
 * The quiz being played: the order its questions are asked in, and what the player answered.
 * Shared by every game mode that asks questions, so each mode creates its own.
 *
 * A question can take several ambushes: one per `solutions` entry and one per `match` row
 * ([per question type](../../../../../docs/design/gameplay.md#per-question-type)). A single ambush is
 * addressed by a {@link QuestionRef}. Points go by question, not by ambush: every `solutions` entry
 * is a point, any other question one point however many ambushes it takes
 * ([life bar](../../../../../docs/design/gameplay.md#life-bar), `pointOf` in `fight/state/score.mts`).
 */

import type { BunbuData, Markdown, Option, Question } from '@bunbu/data'
import { createStore, type Store } from '@rooted/store'
import { shuffle, type Random } from './random.mts'
import { refuse, snapshot } from './store.mts'

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
	/** Indices into the ambush's {@link choicesOf}, in the order they were picked. */
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

export type QuizActions = {
	/**
	 * Loads a quiz. `order` defaults to the questions in file order; the app shuffles it. With
	 * `random`, the solutions and match rows of each question are asked in random order too.
	 */
	load: (data: BunbuData, order?: readonly number[], random?: Random) => void
	/**
	 * Asks the questions of `order` after the ones already in, for endless: the quiz goes round
	 * again. `random` shuffles their solutions and rows, as in `load`.
	 */
	extend: (order: readonly number[], random?: Random) => void
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

/** The store, with its actions on its state. Change it through those, not `update`. */
export type Quiz = Store<QuizState & QuizActions>

export const noQuiz: QuizState = { quiz: undefined, order: [], refs: [], answered: 0, records: [] }

/** How many ambushes a question takes: one per solution, one per row, otherwise one. */
/** What {@link partsOf} reads of a question: its type, and how many solutions or rows it has. */
export type Rounded = { readonly type: string; readonly options?: { readonly length: number }; readonly rows?: { readonly length: number } }

export function partsOf(question: Rounded): number {
	if (question.type === 'solutions') return question.options?.length ?? 1
	if (question.type === 'match') return question.rows?.length ?? 1
	return 1
}

/**
 * Every ambush of the quiz, in the order the questions are asked.
 * With `random` the solutions and rows of a question are shuffled, as the data format asks;
 * without it they are asked in file order.
 */
export function refsOf(quiz: BunbuData, order: readonly number[], random?: Random): QuestionRef[] {
	return order.flatMap((question) => {
		const parts = Array.from({ length: partsOf(quiz.questions[question]!) }, (_, part) => part)
		const asked = random === undefined ? parts : shuffle(parts, random)
		return asked.map((part) => ({ question, part }))
	})
}

/** What the counting of questions asked reads of a quiz: the questions, in the order they are asked. */
export type Asked = { readonly quiz: { readonly questions: readonly Rounded[] } | undefined; readonly order: readonly number[] }

/**
 * Where each question of `order` starts in the refs: one entry per time a question is asked, its
 * rounds after it, and the end of the refs last. In endless a question is asked again once all have
 * been, so it is where a question is in `order`, not its number, that tells one asking from another.
 */
export function askStarts({ quiz, order }: Asked): number[] {
	const starts = [0]
	for (const question of order) {
		const asked = quiz?.questions[question]
		starts.push((starts.at(-1) ?? 0) + (asked === undefined ? 1 : partsOf(asked)))
	}
	return starts
}

/** How many questions have been asked, the one going on included: as many as start before `answered`. */
export function questionsStarted(state: Asked & { readonly answered: number }): number {
	return askStarts(state).slice(0, -1).filter((start) => start < state.answered).length
}

/**
 * How many questions are done: every ambush of them answered. A question halfway through its
 * rounds isn't done yet. In endless a question is asked again once all have been, and counts again.
 */
export function questionsAnswered(state: Asked & { readonly answered: number }): number {
	// A question is done once the refs up to its end have been answered.
	return askStarts(state).slice(1).filter((end) => end <= state.answered).length
}

/** The refs of the time the question at ref `index` is asked: its rounds, and no other time it is asked. */
export function refsOfAsk(state: Asked & { readonly refs: readonly QuestionRef[] }, index: number): readonly QuestionRef[] {
	const starts = askStarts(state)
	const ask = starts.findIndex((start, at) => index >= start && index < (starts[at + 1] ?? Infinity))
	return state.refs.slice(starts[ask] ?? 0, starts[ask + 1] ?? state.refs.length)
}

/** A loaded quiz, ready to be asked in `order`. */
export function loaded(data: BunbuData, order?: readonly number[], random?: Random): QuizState {
	const asked = order ?? data.questions.map((_, index) => index)
	return { ...noQuiz, quiz: data, order: asked, refs: refsOf(data, asked, random) }
}

const yesNo = (yes: boolean): Option[] => [
	{ answer: 'Yes' as Markdown, correct: yes },
	{ answer: 'No' as Markdown, correct: !yes },
]

/**
 * The options one ambush chooses from, in file order. `AnswerRecord.picked` points into these,
 * so the review can show what was picked.
 *
 * - `yes-no` and each `solutions` entry: *Yes* and *No*, in that order.
 * - `match`: the row's own options, or else the pool of every row's answer plus the distractors.
 * - The other types: the question's options.
 */
export function choicesOf(question: Question, part: number): readonly Option[] {
	switch (question.type) {
		case 'yes-no':
			return yesNo(question.answer === 'yes')
		case 'solutions':
			return yesNo(question.options[part]?.correct ?? false)
		case 'match': {
			const row = question.rows[part]
			if (row === undefined) return []
			if ('options' in row) return row.options
			const pool = [
				...new Set([
					...question.rows.flatMap((each) => ('answer' in each ? [each.answer] : [])),
					...(question.distractors ?? []),
				]),
			]
			return pool.map((answer) => ({ answer, correct: answer === row.answer }))
		}
		default:
			return question.options
	}
}

export function createQuiz(initial: QuizState = noQuiz): Quiz {
	// The quiz as `BunbuData`, not as the store's `ReadonlyState` of it; see snapshot().
	const state = (): QuizState => snapshot<QuizState & QuizActions>(store)

	const store: Quiz = createStore<QuizState & QuizActions>({
		...initial,

		load(data, order, random) {
			store.update(() => loaded(data, order, random))
		},

		extend(order, random) {
			const { quiz, order: asked, refs } = state()
			if (quiz === undefined) {
				refuse('quiz.extend', 'no quiz is loaded')
				return
			}
			store.update(() => ({ order: [...asked, ...order], refs: [...refs, ...refsOf(quiz, order, random)] }))
		},

		current() {
			const { refs, answered } = state()
			return refs[answered]
		},

		question(at) {
			return state().quiz?.questions[at.question]
		},

		record(answer) {
			const { answered, refs, records } = state()
			if (answered >= refs.length) {
				refuse('quiz.record', 'every question has been answered')
				return
			}
			store.update(() => ({ answered: answered + 1, records: [...records, answer] }))
		},

		misses() {
			return state().records.filter((record) => record.outcome !== 'correct')
		},

		reset() {
			const { quiz, order, refs } = state()
			// The same order as before, solutions and rows included.
			store.update(() => quiz === undefined ? noQuiz : { ...noQuiz, quiz, order, refs })
		},
	})
	return store
}
