/**
 * What the player chose on the quiz and stage screen ([2 Quiz + stage](../../../../docs/design/screens.md#2-quiz--stage)).
 * App-wide, so it survives navigating from the menus into a run, the dojo and back.
 */

import type { BunbuData } from '@bunbu/data'
import { createStore } from './store.mts'

export const stages = ['rice-fields', 'bamboo-forest', 'mountain-temple', 'castle-town', 'edo-castle'] as const

export type Stage = (typeof stages)[number]

export type SelectionState = {
	/** The quiz to play, or `undefined` until one is chosen or loaded. */
	readonly quiz: BunbuData | undefined
	readonly stage: Stage
}

const initial: SelectionState = { quiz: undefined, stage: 'rice-fields' }

const selectionStore = createStore(initial)

export const selection = {
	get: selectionStore.get,
	subscribe: selectionStore.subscribe,

	chooseQuiz(quiz: BunbuData): void {
		selectionStore.set({ ...selectionStore.get(), quiz })
	},

	chooseStage(stage: Stage): void {
		selectionStore.set({ ...selectionStore.get(), stage })
	},

	reset(): void {
		selectionStore.set(initial)
	},
}
