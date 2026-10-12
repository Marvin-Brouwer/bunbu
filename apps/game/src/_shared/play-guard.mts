/**
 * Keeps the player in the game while they play, a fight or a practice: full screen on a phone, the
 * screen kept on, and Back pauses before it leaves.
 *
 * - **Full screen** on a phone. Leaving full screen (the system's back gesture, or swiping down)
 *   pauses; resuming goes full screen again.
 * - **Screen on**: the screen doesn't dim or lock while on the game, full screen or not. The
 *   browser lets go of this when the page is hidden, so it is asked for again on coming back.
 * - **Back** pauses first: playing puts one history entry on the page, which Back takes off
 *   again. Back once more leaves as usual. Resuming puts the entry back.
 *
 * Both only pause while `pausable` says so. When there is nothing to pause, as on the results,
 * Back goes on back without stopping.
 *
 * **Leaving** for another screen, from a menu, takes the play's place in history, so Back from
 * there doesn't go into the play again.
 */

import { navigate, type Path } from '@rooted/router'

export type PlayGuardOptions = {
	readonly pause: () => void
	/** Whether there is play to pause now: not while paused already, nor once it is over. */
	readonly pausable: () => boolean
}

export type PlayGuard = {
	/** Call when play resumes: back to full screen, and Back pauses again. */
	readonly resumed: () => void
	/** Leaves play for another screen, which takes its place in history. */
	readonly leave: (to: Path) => void
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

/** Keeps the screen on, where the browser can; the browser lets go when the page is hidden. */
let wakeLock: WakeLockSentinel | undefined
/** Asked for and not answered yet, so coming back to the page doesn't ask twice. */
let asking = false

function keepScreenOn() {
	if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || asking) return
	if (wakeLock !== undefined && !wakeLock.released) return
	asking = true
	navigator.wakeLock.request('screen').then((sentinel) => {
		// Left while asking: let go again.
		if (active > 0) wakeLock = sentinel
		else void sentinel.release()
	}).catch(() => {
		// Refused, as on low battery: the screen dims as it would.
	}).finally(() => {
		asking = false
	})
}

function letScreenDim() {
	void wakeLock?.release()
	wakeLock = undefined
}

function resumed() {
	enterFullscreen()
	guard()
}

export function guardPlay(options: PlayGuardOptions, signal: AbortSignal): PlayGuard {
	active++
	let leaving = false

	// Back took the guard off: pause, or go on back when there is nothing to pause.
	window.addEventListener('popstate', () => {
		if (leaving || guarding()) return
		if (options.pausable()) options.pause()
		else history.back()
	}, { signal })

	document.addEventListener('fullscreenchange', () => {
		if (document.fullscreenElement === null && options.pausable()) options.pause()
	}, { signal })

	document.addEventListener('visibilitychange', keepScreenOn, { signal })

	signal.addEventListener('abort', () => {
		active--
		// Left from a menu, not restarted: take the guard off, so Back doesn't stop on it later,
		// leave full screen and let the screen dim. A restart keeps all three for the next play.
		setTimeout(() => {
			if (active > 0) return
			letScreenDim()
			if (guarding()) history.back()
			if (document.fullscreenElement !== null) {
				document.exitFullscreen().catch(() => {
					// Already left.
				})
			}
		})
	}, { once: true })

	keepScreenOn()
	resumed()
	return {
		resumed,
		leave(to) {
			leaving = true
			navigate.replace(to)
		},
	}
}
