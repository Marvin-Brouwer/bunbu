/**
 * What the player chose on the quiz and stage screen ([2 Quiz + stage](../../../../../docs/design/screens.md#2-quiz--stage)).
 * App-wide, so it survives navigating from the menus into a run, the dojo and back.
 */

import type { BunbuData } from '@bunbu/data'
import { createStore, type Store } from '@rooted/store'

export const stages = ['rice-fields', 'bamboo-forest', 'mountain-temple', 'castle-town', 'edo-castle'] as const

export type Stage = (typeof stages)[number]

/** What the stages are called on screen, in the stage select and the HUD. */
export const stageNames: Readonly<Record<Stage, string>> = {
	'rice-fields': 'Rice fields',
	'bamboo-forest': 'Bamboo forest',
	'mountain-temple': 'Mountain temple',
	'castle-town': 'Castle town',
	'edo-castle': 'Edo castle',
}

export type SelectionState = {
	/** The quiz to play, or `undefined` until one is chosen or loaded. */
	readonly quiz: BunbuData | undefined
	readonly stage: Stage
}

const initial: SelectionState = { quiz: undefined, stage: 'rice-fields' }

export type SelectionActions = {
	chooseQuiz: (quiz: BunbuData) => void
	chooseStage: (stage: Stage) => void
	reset: () => void
}

/**
 * App-wide: the choice outlives the select screen. Change it through its actions, not `update`.
 * Read the quiz with `snapshot(selection).quiz` to get it back as `BunbuData`.
 */
export const selection: Store<SelectionState & SelectionActions> = createStore<SelectionState & SelectionActions>({
	...initial,

	chooseQuiz: (quiz) => {
		selection.update(() => ({ quiz }))
	},

	chooseStage: (stage) => {
		selection.update(() => ({ stage }))
	},

	reset: () => {
		selection.update(() => initial)
	},
})
