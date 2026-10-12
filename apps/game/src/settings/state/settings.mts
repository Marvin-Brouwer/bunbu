/**
 * The player's settings. App-wide, so one store for every route and game mode. Persisting them in
 * local storage is the run track's job; this store is plain state with defaults.
 *
 * The difficulty is the ambush time limit, a `timeScale` from Apprentice's 120% to Shogun's 50%
 * ([time limit](../../../../../docs/design/gameplay.md#time-limit)).
 */

import { createStore, type Store } from '@rooted/store'

/** The difficulty, as the stops on its slider from easy to hard. */
export const difficulties = ['apprentice', 'samurai', 'daimyo', 'shogun'] as const

export type Difficulty = (typeof difficulties)[number]

/** How much of a question's time an ambush gives, per difficulty. */
export const timeScales: Readonly<Record<Difficulty, number>> = {
	apprentice: 1.2,
	samurai: 1,
	daimyo: 0.8,
	shogun: 0.5,
}

export type SettingsState = {
	readonly difficulty: Difficulty
	/** The haptic buzz on a hit, which can be turned off. */
	readonly haptics: boolean
	/** `0` to `1`. Nothing plays sound yet. */
	readonly volume: number
}

const initial: SettingsState = { difficulty: 'samurai', haptics: true, volume: 0.8 }

export type SettingsActions = {
	/** How much of a question's time an ambush gives at the chosen difficulty. */
	timeScale: () => number
	setDifficulty: (difficulty: Difficulty) => void
	setHaptics: (haptics: boolean) => void
	setVolume: (volume: number) => void
	/** Puts back saved settings. What is missing keeps its default. */
	restore: (saved: Partial<SettingsState>) => void
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

	restore: (saved) => {
		settings.update(() => ({ ...initial, ...saved }))
	},

	reset: () => {
		settings.update(() => initial)
	},
})
