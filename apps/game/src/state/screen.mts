/** Which screen is showing. See [screens.md](../../../../docs/design/screens.md#flow). */

import { createStore, type Store } from './store.mts'

export type Screen =
	| 'title'
	| 'select'
	| 'run'
	| 'results'
	| 'fallen'
	| 'settings'
	| 'dojo'
	| 'study'
	| 'practice-start'
	| 'practice'

export type ScreenState = {
	readonly current: Screen
	/** Where `back()` returns to, so settings can be opened from the title and from the pause menu. */
	readonly previous: Screen | undefined
}

const initial: ScreenState = { current: 'title', previous: undefined }

export const screenStore: Store<ScreenState> = createStore(initial)

export const screen = {
	get: screenStore.get,
	subscribe: screenStore.subscribe,

	show(next: Screen): void {
		const { current } = screenStore.get()
		if (current === next) return
		screenStore.set({ current: next, previous: current })
	},

	back(): void {
		const { previous } = screenStore.get()
		screenStore.set({ current: previous ?? 'title', previous: undefined })
	},

	reset(): void {
		screenStore.set(initial)
	},
}
