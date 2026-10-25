/**
 * The phone's buzz, behind the haptics setting ([outcome](../../../../docs/design/gameplay.md#outcome)).
 * Where it can't buzz, the setting is greyed out and nothing buzzes.
 */

import { settings } from '../settings/state/settings.mts'

/** How long each buzz lasts, in milliseconds. */
export const buzzes = {
	/** A swipe picked a mark. */
	pick: 12,
	/** A scroll is about to unroll. */
	scroll: 150,
	/** The samurai is hit. */
	hit: 600,
}

/**
 * Whether this phone can buzz: its browser has `navigator.vibrate` (iOS Safari and Firefox don't),
 * and its main pointer is a finger, as a laptop's browser has `vibrate` too but nothing to buzz with.
 * A phone with vibration turned off in its own settings still passes: the browser can't tell.
 */
export const canBuzz = () =>
	'vibrate' in navigator && window.matchMedia('(hover: none) and (pointer: coarse)').matches

export function buzz(milliseconds: number): void {
	if (!settings.value.haptics || !canBuzz()) return
	navigator.vibrate(milliseconds)
}
