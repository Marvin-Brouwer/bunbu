/**
 * The player's settings. App-wide, so one store for every route and game mode. Persisting them in
 * local storage is the run track's job; this store is plain state with defaults.
 *
 * The difficulty is the ambush time limit, as a `timeScale` on a slider from Apprentice to Shogun
 * ([time limit](../../../../../docs/design/gameplay.md#time-limit)).
 */

import { createStore, type Store } from '@rooted/store'

/** The `timeScale` at either end of the difficulty slider and in its middle, the default. */
export const timeScales = {
	apprentice: 1.2,
	middle: 1,
	shogun: 0.5,
} as const

/**
 * The `timeScale` at a place on the difficulty slider, from `0` (Apprentice) to `1` (Shogun). The
 * middle is the default, so each half runs at its own rate: 120% to 100%, then 100% to 50%.
 */
export function timeScaleAt(place: number): number {
	const { apprentice, middle, shogun } = timeScales
	const clamped = Math.min(1, Math.max(0, place))
	return clamped <= 0.5
		? apprentice + (middle - apprentice) * clamped * 2
		: middle + (shogun - middle) * (clamped - 0.5) * 2
}

/** Where a `timeScale` is on the difficulty slider: the opposite of {@link timeScaleAt}. */
export function placeOf(timeScale: number): number {
	const { apprentice, middle, shogun } = timeScales
	return timeScale >= middle
		? (apprentice - timeScale) / (apprentice - middle) / 2
		: 0.5 + (middle - timeScale) / (middle - shogun) / 2
}

export type SettingsState = {
	/** How much of a question's time an ambush gives, from Shogun's `0.5` to Apprentice's `1.2`. */
	readonly timeScale: number
	/** The haptic buzz on a hit, which can be turned off. */
	readonly haptics: boolean
	/** `0` to `1`. Nothing plays sound yet. */
	readonly volume: number
}

const initial: SettingsState = { timeScale: timeScales.middle, haptics: true, volume: 0.8 }

export type SettingsActions = {
	setTimeScale: (timeScale: number) => void
	setHaptics: (haptics: boolean) => void
	setVolume: (volume: number) => void
	/** Puts back saved settings. What is missing keeps its default. */
	restore: (saved: Partial<SettingsState>) => void
	reset: () => void
}

/** App-wide: the settings outlive every screen. Change them through their actions, not `update`. */
export const settings: Store<SettingsState & SettingsActions> = createStore<SettingsState & SettingsActions>({
	...initial,

	setTimeScale: (timeScale) => {
		settings.update(() => ({ timeScale: Math.min(timeScales.apprentice, Math.max(timeScales.shogun, timeScale)) }))
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
