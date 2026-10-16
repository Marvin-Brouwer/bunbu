/**
 * The player's settings. App-wide, so one store for every route and game mode. Persisting them in
 * local storage is the run track's job; this store is plain state with defaults.
 *
 * The difficulty is not a setting: it is chosen per quiz on the fight setup, see
 * `fight/state/difficulty.mts`.
 *
 * Reading aloud, in the dojo's study, has its speed and a voice per language.
 */

import { createStore, type Store } from '@rooted/store'

export type SettingsState = {
	/** The haptic buzz on a hit, which can be turned off. */
	readonly haptics: boolean
	/** `0` to `1`, the loudness of the game's sounds ([sound](../../_shared/sound/sound.mts)); `0` is silent. */
	readonly volume: number
	/** How fast the dojo reads aloud, one of {@link speechRates}. */
	readonly speechRate: number
	/** The chosen voice per language ({@link languageOf}), by its `voiceURI`. Without one, the system's own. */
	readonly voices: Readonly<Record<string, string>>
}

/** The speeds of reading aloud, as the stops on its slider; `1` is normal. */
export const speechRates = [0.5, 1, 1.5, 2, 2.5, 3] as const

/** The language a voice is kept for: `en` for `en-GB` and `en_US` alike. */
export const languageOf = (tag: string): string => tag.replaceAll('_', '-').split('-')[0]?.toLowerCase() ?? ''

const initial: SettingsState = { haptics: true, volume: 0.8, speechRate: 1, voices: {} }

export type SettingsActions = {
	setHaptics: (haptics: boolean) => void
	setVolume: (volume: number) => void
	/** Sets the reading speed to the nearest of {@link speechRates}. */
	setSpeechRate: (rate: number) => void
	/** Chooses the voice for a language, or, with `undefined`, the system's own again. */
	chooseVoice: (language: string, voice: string | undefined) => void
	/** Puts back saved settings. What is missing keeps its default. */
	restore: (saved: Partial<SettingsState>) => void
	reset: () => void
}

/** App-wide: the settings outlive every screen. Change them through their actions, not `update`. */
export const settings: Store<SettingsState & SettingsActions> = createStore<SettingsState & SettingsActions>({
	...initial,

	setHaptics: (haptics) => {
		settings.update(() => ({ haptics }))
	},

	setVolume: (volume) => {
		settings.update(() => ({ volume: Math.min(1, Math.max(0, volume)) }))
	},

	setSpeechRate: (rate) => {
		const nearest = speechRates.reduce((best, each) => Math.abs(each - rate) < Math.abs(best - rate) ? each : best)
		settings.update(() => ({ speechRate: nearest }))
	},

	chooseVoice: (language, voice) => {
		const { [languageOf(language)]: _, ...others } = settings.value.voices
		settings.update(() => ({ voices: voice === undefined ? others : { ...others, [languageOf(language)]: voice } }))
	},

	restore: (saved) => {
		settings.update(() => ({ ...initial, ...saved }))
	},

	reset: () => {
		settings.update(() => initial)
	},
})
