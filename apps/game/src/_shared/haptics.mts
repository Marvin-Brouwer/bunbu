/**
 * The phone's buzz, behind the haptics setting ([outcome](../../../../docs/design/gameplay.md#outcome)).
 * Phones without `navigator.vibrate`, iOS Safari among them, stay silent.
 */

import { settings } from '../settings/state/settings.mts'

/** How long each buzz lasts, in milliseconds. */
export const buzzes = {
	/** A swipe picked a mark. */
	pick: 12,
	/** The samurai is hit. */
	hit: 150,
}

export function buzz(milliseconds: number): void {
	if (!settings.value.haptics || !('vibrate' in navigator)) return
	navigator.vibrate(milliseconds)
}
