/**
 * The ambush that is open: the question on the scroll, the options with their marks, what the
 * player picked and how much time is left. Shared by the run and by dojo practice, so each mode
 * creates its own.
 *
 * The rules that fill this in (marks, bundling, the time limit, the outcome) are
 * [ambush](../../../../../docs/design/gameplay.md#ambush) and belong to the ambush track. This module
 * fixes the shapes and does the obvious thing.
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

export type AmbushOption = {
	/** The option text, as Markdown. */
	readonly answer: string
	readonly correct: boolean
	readonly mark: Mark
	/** The ninja carrying this option; several options can share one ninja when there are 6 to 8. */
	readonly ninja: number
	/** `0` when not picked, otherwise the swipe order, which `order` shows as 1, 2, 3 … */
	readonly pick: number
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
}

/** What an ambush opens with. The ambush track decides marks, ninjas and seconds. */
export type AmbushOpening = Omit<AmbushState, 'open' | 'secondsLeft'>

/** The result of a commit, for the flow that spreads it over the other stores. */
export type AmbushResult = {
	readonly at: QuestionRef
	readonly outcome: Outcome
	/** Option indices in pick order. */
	readonly picked: readonly number[]
	/** Ninjas whose options were all picked correctly. */
	readonly slain: readonly number[]
	/** Ninjas that were blocked, knocked back and flee. */
	readonly blocked: readonly number[]
}

export type AmbushActions = {
	/** Opens an ambush on a question. */
	start: (opening: AmbushOpening) => void
	/** Picks the option on `mark`, or unpicks it when it was already picked. */
	pick: (mark: Mark) => void
	/** Counts down the time left. */
	tick: (dt: number) => void
	/** Whether the time limit has run out. */
	unanswered: () => boolean
	/**
	 * Closes the ambush and reports the outcome: correct when every slash landed on a correct
	 * option and every block on an incorrect one
	 * ([outcome](../../../../../docs/design/gameplay.md#outcome)).
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
}

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
			const index = state.options.findIndex((option) => option.mark === mark)
			if (index < 0) {
				refuse('ambush.pick', `no option on ${mark}`)
				return
			}
			const was = state.options[index]!.pick
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
			return state.open && state.seconds > 0 && state.secondsLeft === 0
		},

		commit() {
			const state = store.value
			if (!state.open) {
				refuse('ambush.commit', 'no ambush is open')
				return undefined
			}
			const unanswered = state.seconds > 0 && state.secondsLeft === 0
			const picked = state.options
				.map((option, index) => ({ option, index }))
				.filter(({ option }) => option.pick > 0)
				.sort((left, right) => left.option.pick - right.option.pick)
				.map(({ index }) => index)
			const correct = !unanswered && state.options.every((option) => (option.pick > 0) === option.correct)
			// A slash means "picked", a block means "not picked", so a ninja carrying a picked option is slain.
			const slashed = (ninja: number) => state.options.some((option) => option.ninja === ninja && option.pick > 0)
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
