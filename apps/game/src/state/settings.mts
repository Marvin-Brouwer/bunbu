/**
 * The player's settings. Persisting them in local storage is the run track's job; this store is
 * plain state with defaults.
 *
 * Difficulty is the ambush time limit: Novice has none, Adept gets half again as long as Master
 * ([time limit](../../../../docs/design/gameplay.md#time-limit)). The values are defaults to tune.
 */

import { createStore, type Store } from './store.mts'

export type Difficulty = 'novice' | 'adept' | 'master'

export type SettingsState = {
	readonly difficulty: Difficulty
	/** The haptic buzz on a hit, which can be turned off. */
	readonly haptics: boolean
	/** `0` to `1`. Nothing plays sound yet. */
	readonly volume: number
}

/** `timeScale` per difficulty; `undefined` means no time limit at all. */
export const timeScales: Readonly<Record<Difficulty, number | undefined>> = {
	novice: undefined,
	adept: 1.5,
	master: 1,
}

const initial: SettingsState = { difficulty: 'adept', haptics: true, volume: 0.8 }

export const settingsStore: Store<SettingsState> = createStore(initial)

export const settings = {
	get: settingsStore.get,
	subscribe: settingsStore.subscribe,

	/** The `timeScale` of the chosen difficulty, or `undefined` when there is no time limit. */
	timeScale(): number | undefined {
		return timeScales[settingsStore.get().difficulty]
	},

	setDifficulty(difficulty: Difficulty): void {
		settingsStore.set({ ...settingsStore.get(), difficulty })
	},

	setHaptics(haptics: boolean): void {
		settingsStore.set({ ...settingsStore.get(), haptics })
	},

	setVolume(volume: number): void {
		settingsStore.set({ ...settingsStore.get(), volume: Math.min(1, Math.max(0, volume)) })
	},

	reset(): void {
		settingsStore.set(initial)
	},
}
