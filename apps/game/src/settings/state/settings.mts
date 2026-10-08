/**
 * The player's settings. App-wide, so one store for every route and game mode. Persisting them in
 * local storage is the run track's job; this store is plain state with defaults.
 *
 * Difficulty is the ambush time limit: Novice has none, Adept gets half again as long as Master
 * ([time limit](../../../../../docs/design/gameplay.md#time-limit)). The values are defaults to tune.
 */

import { createStore } from '@rooted/store'
import { snapshot } from '../../_shared/state/store.mts'

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

const settingsStore = createStore(initial)

export const settings = {
	get value() {
		return snapshot(settingsStore)
	},
	on: settingsStore.on.bind(settingsStore),

	/** The `timeScale` of the chosen difficulty, or `undefined` when there is no time limit. */
	timeScale(): number | undefined {
		return timeScales[snapshot(settingsStore).difficulty]
	},

	setDifficulty(difficulty: Difficulty): void {
		settingsStore.update(() => ({ difficulty }))
	},

	setHaptics(haptics: boolean): void {
		settingsStore.update(() => ({ haptics }))
	},

	setVolume(volume: number): void {
		settingsStore.update(() => ({ volume: Math.min(1, Math.max(0, volume)) }))
	},

	reset(): void {
		settingsStore.update(() => initial)
	},
}
