/**
 * Keeps the screen on, where the browser can: it doesn't dim or lock while a screen that asks for
 * it is up, as a run or the dojo's study. The browser lets go of this when the page is hidden, so it
 * is asked for again on coming back.
 *
 * Several screens can ask at once, as a restart starts the next play before the last has gone;
 * the screen may dim again once none of them is up.
 */

/** The screens keeping the screen on now. */
let holders = 0
let wakeLock: WakeLockSentinel | undefined
/** Asked for and not answered yet, so coming back to the page doesn't ask twice. */
let asking = false

function request() {
	if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || asking || holders === 0) return
	if (wakeLock !== undefined && !wakeLock.released) return
	asking = true
	navigator.wakeLock.request('screen').then((sentinel) => {
		// Left while asking: let go again.
		if (holders > 0) wakeLock = sentinel
		else void sentinel.release()
	}).catch(() => {
		// Refused, as on low battery: the screen dims as it would.
	}).finally(() => {
		asking = false
	})
}

function release() {
	void wakeLock?.release()
	wakeLock = undefined
}

/** Keeps the screen on until `signal` aborts. */
export function keepScreenOn(signal: AbortSignal): void {
	holders++
	document.addEventListener('visibilitychange', request, { signal })
	signal.addEventListener('abort', () => {
		holders--
		// A restart asks again straight after; only let go once nothing has.
		setTimeout(() => {
			if (holders === 0) release()
		})
	}, { once: true })
	request()
}
