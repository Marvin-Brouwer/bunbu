/**
 * The ambush that is open: the question on the scroll, the options with their marks, what the
 * player picked and how much time is left. Shared by the run and by dojo practice, so each mode
 * creates its own.
 *
 * The rules are [ambush](../../../../../docs/design/gameplay.md#ambush): this store holds the
 * picks and decides the outcome, [ambush-opening.mts](./ambush-opening.mts) turns a question into
 * an opening (marks, ninjas, the time limit) and [ambush-time.mts](./ambush-time.mts) has the numbers.
 */

import { createStore, type Store } from '@rooted/store'
import { refuse } from './store.mts'
import type { Outcome, QuestionRef } from './quiz.mts'

/** The eight swipe directions ([more than 3 options](../../../../../docs/design/gameplay.md#more-than-3-options)). */
export type Mark = 'up' | 'up-right' | 'right' | 'down-right' | 'down' | 'down-left' | 'left' | 'up-left'

export const marks: readonly Mark[] = [
	'up', 'up-right', 'right', 'down-right', 'down', 'down-left', 'left', 'up-left',
]

/** How an ambush is answered. `solutions` and `match` are asked as `yes-no` and `single`. */
export type AmbushKind = 'yes-no' | 'single' | 'multiple' | 'order'

/** A `yes-no` ambush is one ninja: ↑ slashes it (yes), ↓ blocks it (no). */
export const yesNoMarks = { yes: 'up', no: 'down' } as const satisfies Record<string, Mark>

export type AmbushOption = {
	/** The option text, as Markdown. */
	readonly answer: string
	readonly correct: boolean
	readonly mark: Mark
	/** The ninja carrying this option; several options can share one ninja when there are 6 to 8. */
	readonly ninja: number
	/** `0` when not picked, otherwise the swipe order, which `order` shows as 1, 2, 3 … */
	readonly pick: number
	/** Where this option is in the question's choices (`choicesOf` in quiz.mts), for the record. */
	readonly source: number
	/** For `order`: the place this option belongs, 1, 2, 3 …, or `0` for a distractor. `0` otherwise. */
	readonly rank: number
}

export type AmbushState = {
	readonly open: boolean
	readonly kind: AmbushKind
	readonly at: QuestionRef
	/** The query as Markdown, with the scenario for `solutions` and the row for `match`. */
	readonly query: string
	readonly options: readonly AmbushOption[]
	/** How many options to choose, `0` when the count is not given away. */
	readonly choose: number
	/** The time limit in seconds, `0` when there is none (Novice). */
	readonly seconds: number
	readonly secondsLeft: number
	/** Which of the question's ambushes this is, 1, 2, 3 …: "2 of 3" for `solutions`. */
	readonly round: number
	/** How many ambushes the question takes: one per solution or row, otherwise `1`. */
	readonly rounds: number
}

/** What an ambush opens with. The ambush track decides marks, ninjas and seconds. */
export type AmbushOpening = Omit<AmbushState, 'open' | 'secondsLeft'>

/** The result of a commit, for the flow that spreads it over the other stores. */
export type AmbushResult = {
	readonly at: QuestionRef
	readonly outcome: Outcome
	/** The picked options' `source`, in pick order. */
	readonly picked: readonly number[]
	/** Ninjas whose options were all picked correctly. */
	readonly slain: readonly number[]
	/** Ninjas that were blocked, knocked back and flee. */
	readonly blocked: readonly number[]
}

export type AmbushActions = {
	/** Opens an ambush on a question. */
	start: (opening: AmbushOpening) => void
	/**
	 * Picks the option on `mark`, or unpicks it when it was already picked. `yes-no` and `single`
	 * hold one pick, so a new pick replaces the old one.
	 */
	pick: (mark: Mark) => void
	/** Counts down the time left. */
	tick: (dt: number) => void
	/** Whether the time limit has run out. */
	unanswered: () => boolean
	/**
	 * Closes the ambush and reports the outcome: correct when every slash landed on a correct
	 * option and every block on an incorrect one, and for `order` in the right order
	 * ([outcome](../../../../../docs/design/gameplay.md#outcome)). Once the time is up it is
	 * unanswered, whatever was picked: half-swiped answers do not count. Refused while nothing is
	 * picked and there is time left.
	 */
	commit: () => AmbushResult | undefined
	close: () => void
}

/** The store, with its actions on its state. Change it through those, not `update`. */
export type Ambush = Store<AmbushState & AmbushActions>

export const noAmbush: AmbushState = {
	open: false,
	kind: 'single',
	at: { question: 0, part: 0 },
	query: '',
	options: [],
	choose: 0,
	seconds: 0,
	secondsLeft: 0,
	round: 1,
	rounds: 1,
}

const timeUp = (state: AmbushState) => state.seconds > 0 && state.secondsLeft === 0

/** Whether the option is answered right: picked when correct, and for `order` in its place. */
const right = (kind: AmbushKind, option: AmbushOption) =>
	kind === 'order' ? option.pick === option.rank : (option.pick > 0) === option.correct

/** A slash means "picked", a block "not picked". Picking *no* on a `yes-no` ambush is a block. */
const slashes = (kind: AmbushKind, option: AmbushOption) =>
	option.pick > 0 && !(kind === 'yes-no' && option.mark === yesNoMarks.no)

export function createAmbush(initial: AmbushState = noAmbush): Ambush {

	const store: Ambush = createStore<AmbushState & AmbushActions>({
		...initial,

		start(opening) {
			store.update(() => ({ ...opening, open: true, secondsLeft: opening.seconds }))
		},

		pick(mark) {
			const state = store.value
			if (!state.open) {
				refuse('ambush.pick', 'no ambush is open')
				return
			}
			if (timeUp(state)) {
				refuse('ambush.pick', 'the time is up')
				return
			}
			const index = state.options.findIndex((option) => option.mark === mark)
			if (index < 0) {
				refuse('ambush.pick', `no option on ${mark}`)
				return
			}
			const was = state.options[index]!.pick
			if (state.kind === 'yes-no' || state.kind === 'single') {
				const options = state.options.map((option, at) => ({ ...option, pick: at === index && was === 0 ? 1 : 0 }))
				store.update(() => ({ options }))
				return
			}
			const highest = Math.max(0, ...state.options.map((option) => option.pick))
			const options = state.options.map((option, at) => {
				if (at === index) return { ...option, pick: was > 0 ? 0 : highest + 1 }
				// Keep the numbers 1, 2, 3 … without gaps when an earlier pick is taken back.
				if (was > 0 && option.pick > was) return { ...option, pick: option.pick - 1 }
				return option
			})
			store.update(() => ({ options }))
		},

		tick(dt) {
			const state = store.value
			if (!state.open || state.seconds === 0) return
			store.update(() => ({ secondsLeft: Math.max(0, state.secondsLeft - dt) }))
		},

		unanswered() {
			const state = store.value
			return state.open && timeUp(state)
		},

		commit() {
			const state = store.value
			if (!state.open) {
				refuse('ambush.commit', 'no ambush is open')
				return undefined
			}
			const unanswered = timeUp(state)
			const picked = state.options
				.filter((option) => option.pick > 0)
				.toSorted((first, second) => first.pick - second.pick)
				.map((option) => option.source)
			if (!unanswered && picked.length === 0) {
				refuse('ambush.commit', 'nothing is picked')
				return undefined
			}
			const correct = !unanswered && state.options.every((option) => right(state.kind, option))
			// A bundled ninja is slain when one of its options is slashed, and handled right only
			// when all of them are, which `correct` already covers.
			const slashed = (ninja: number) => state.options.some((option) => option.ninja === ninja && slashes(state.kind, option))
			const ninjas = [...new Set(state.options.map((option) => option.ninja))]

			store.update(() => noAmbush)
			return {
				at: state.at,
				outcome: unanswered ? 'unanswered' : correct ? 'correct' : 'wrong',
				picked,
				slain: correct ? ninjas.filter((ninja) => slashed(ninja)) : [],
				blocked: correct ? ninjas.filter((ninja) => !slashed(ninja)) : [],
			}
		},

		close() {
			store.update(() => noAmbush)
		},
	})
	return store
}
