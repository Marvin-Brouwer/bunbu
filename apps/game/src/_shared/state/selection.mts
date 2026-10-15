/**
 * What the player chose: the quiz on the title, the stage on the fight screen ([2 Fight setup](../../../../../docs/design/screens.md#2-fight-setup)).
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

/** The stages with a world built: all of them now. A stage added later shows in the stage select but can't be chosen until it is in here. */
export const builtStages: ReadonlySet<Stage> = new Set<Stage>(stages)

export type SelectionState = {
	/** The quiz to play, or `undefined` until one is chosen or loaded. */
	readonly quiz: BunbuData | undefined
	readonly stage: Stage
	/**
	 * Endless instead of the stage: every stage in turn, for as long as the samurai stands
	 * ([endless](../../../../../docs/design/gameplay.md#endless)).
	 */
	readonly endless: boolean
}

// The first stage is the only one open on a new quiz ([stages](../../../../../docs/design/gameplay.md#stages)).
const initial: SelectionState = { quiz: undefined, stage: 'rice-fields', endless: false }

export type SelectionActions = {
	chooseQuiz: (quiz: BunbuData) => void
	/** Unchooses the quiz when it is this one, as when it is removed from the library. */
	forgetQuiz: (id: string, version: string) => void
	/** Chooses `stage`, and so not endless. */
	chooseStage: (stage: Stage) => void
	/** Chooses endless; the stage is kept for when a stage is chosen again. */
	chooseEndless: () => void
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

	forgetQuiz: (id, version) => {
		const { quiz } = selection.value
		if (quiz?.id === id && quiz.version === version) selection.update(() => ({ quiz: undefined }))
	},

	chooseStage: (stage) => {
		selection.update(() => ({ stage, endless: false }))
	},

	chooseEndless: () => {
		selection.update(() => ({ endless: true }))
	},

	reset: () => {
		selection.update(() => initial)
	},
})
