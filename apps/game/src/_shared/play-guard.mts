/**
 * Keeps the player in the game while they play, a fight or a practice: full screen on a phone, and
 * Back pauses before it leaves.
 *
 * - **Full screen** on a phone. Leaving full screen (the system's back gesture, or swiping down)
 *   pauses; resuming goes full screen again.
 * - **Back** pauses first: playing puts one history entry on the page, which Back takes off
 *   again. Back once more leaves as usual. Resuming puts the entry back.
 *
 * Both only pause while `pausable` says so. When there is nothing to pause, as on the results,
 * Back goes on back without stopping.
 */

import { navigate } from '@rooted/router'

export type PlayGuardOptions = {
	readonly pause: () => void
	/** Whether there is play to pause now: not while paused already, nor once it is over. */
	readonly pausable: () => boolean
}

export type PlayGuard = {
	/** Call when play resumes: back to full screen, and Back pauses again. */
	readonly resumed: () => void
}

/** The history state that marks the entry Back takes off to pause. */
const guardKey = 'bunbu:playing'

const guarding = () => (history.state as Record<string, unknown> | null)?.[guardKey] === true

/** The guards of the play on screen; a restart starts the next before the last has gone. */
let active = 0

/**
 * A phone: its main pointer is a finger. A laptop with a touch screen still points with its
 * trackpad or mouse, so it stays out. The dev server stays out too, as the device mode of the
 * devtools passes for a phone.
 */
const phone = () => !import.meta.env.DEV && window.matchMedia('(hover: none) and (pointer: coarse)').matches

/** Puts the entry Back takes off to pause, unless it is there already. */
function guard() {
	if (!guarding()) navigate({ [guardKey]: true })
}

/** Goes full screen where the browser can; not every phone can, iPhones only for video. */
function enterFullscreen() {
	if (!phone() || document.fullscreenElement !== null || !document.fullscreenEnabled) return
	document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
		// Refused, as without a recent tap: the game plays on in the page.
	})
}

function resumed() {
	enterFullscreen()
	guard()
}

export function guardPlay(options: PlayGuardOptions, signal: AbortSignal): PlayGuard {
	active++

	// Back took the guard off: pause, or go on back when there is nothing to pause.
	window.addEventListener('popstate', () => {
		if (guarding()) return
		if (options.pausable()) options.pause()
		else history.back()
	}, { signal })

	document.addEventListener('fullscreenchange', () => {
		if (document.fullscreenElement === null && options.pausable()) options.pause()
	}, { signal })

	signal.addEventListener('abort', () => {
		active--
		// Left from a menu, not restarted: take the guard off, so Back doesn't stop on it later,
		// and leave full screen. A restart keeps both for the next play.
		setTimeout(() => {
			if (active > 0) return
			if (guarding()) history.back()
			if (document.fullscreenElement !== null) {
				document.exitFullscreen().catch(() => {
					// Already left.
				})
			}
		})
	}, { once: true })

	resumed()
	return { resumed }
}
