/**
 * The one `requestAnimationFrame` loop: time, update, render, in that order every frame
 * ([the game loop](../../../../docs/architecture/state.md#the-game-loop)).
 *
 * The `Application` starts it once for the whole app. The game mode that is playing plugs into it with
 * `play()`; the canvas draws whatever a route put on the stage. The delta is clamped, so a tab
 * that comes back from the background cannot jump a run forward by minutes, and multiplied by the
 * mode's world scale, which is how slow motion works. While the mode is paused its update is
 * skipped; while the page is hidden the loop stops entirely and the mode is asked to pause.
 */

import { drawFrame } from './stage.mts'

/** A delta longer than this is clamped. */
export const maximumDelta = 0.1

/** A game mode the loop drives: the run, or dojo practice. */
export type Mode = {
	/** Time-based actions. Skipped while `paused()`. */
	update: (dt: number) => void
	paused: () => boolean
	/** `1` normally, lower for slow motion. */
	worldScale: () => number
	/** Called when the page goes to the background ([pause](../../../../docs/design/screens.md#6-pause)). */
	pause: () => void
}

let mode: Mode | undefined

/** Drives `next` every frame until `signal` aborts, usually the route component's own signal. */
export function play(next: Mode, signal: AbortSignal): void {
	mode = next
	signal.addEventListener('abort', () => {
		if (mode === next) mode = undefined
	}, { once: true })
}

/** Starts the loop for the lifetime of the app. */
export function startLoop(signal: AbortSignal): void {
	let frame = 0
	let last = performance.now()

	const tick = (now: number) => {
		const delta = Math.min((now - last) / 1000, maximumDelta)
		last = now
		if (mode !== undefined && !mode.paused()) mode.update(delta * mode.worldScale())
		drawFrame(delta)
		frame = requestAnimationFrame(tick)
	}

	const start = () => {
		last = performance.now()
		frame = requestAnimationFrame(tick)
	}

	const stop = () => {
		cancelAnimationFrame(frame)
		frame = 0
	}

	document.addEventListener('visibilitychange', () => {
		if (document.hidden) {
			mode?.pause()
			stop()
		} else if (frame === 0) {
			start()
		}
	}, { signal })

	signal.addEventListener('abort', stop, { once: true })
	start()
}
