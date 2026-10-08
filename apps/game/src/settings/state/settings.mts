/**
 * The player's settings. App-wide, so one store for every route and game mode. Persisting them in
 * local storage is the run track's job; this store is plain state with defaults.
 *
 * Difficulty is the ambush time limit: Novice has none, Adept gets half again as long as Master
 * ([time limit](../../../../../docs/design/gameplay.md#time-limit)). The values are defaults to tune.
 */

import { createStore, type Store } from '@rooted/store'

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

export type SettingsActions = {
	/** The `timeScale` of the chosen difficulty, or `undefined` when there is no time limit. */
	timeScale: () => number | undefined
	setDifficulty: (difficulty: Difficulty) => void
	setHaptics: (haptics: boolean) => void
	setVolume: (volume: number) => void
	reset: () => void
}

/** App-wide: the settings outlive every screen. Change them through their actions, not `update`. */
export const settings: Store<SettingsState & SettingsActions> = createStore<SettingsState & SettingsActions>({
	...initial,

	timeScale: () => timeScales[settings.value.difficulty],

	setDifficulty: (difficulty) => {
		settings.update(() => ({ difficulty }))
	},

	setHaptics: (haptics) => {
		settings.update(() => ({ haptics }))
	},

	setVolume: (volume) => {
		settings.update(() => ({ volume: Math.min(1, Math.max(0, volume)) }))
	},

	reset: () => {
		settings.update(() => initial)
	},
})
