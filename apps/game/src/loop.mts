/**
 * The one `requestAnimationFrame` loop: time, update, render, in that order every frame
 * ([the game loop](../../../docs/architecture/state.md#the-game-loop)).
 *
 * The delta is clamped, so a tab that comes back from the background cannot jump the run forward
 * by minutes, and it is multiplied by the run's `worldScale`, which is how slow motion works.
 * While paused the update step is skipped; while the page is hidden the loop stops entirely.
 */

import { ambush } from './state/ambush.mts'
import { ninjas } from './state/ninjas.mts'
import { run, runConfig } from './state/run.mts'

export type Loop = {
	/** Reads the stores and draws a frame. */
	render: (dt: number) => void
	/** Time-based actions, before the frame is drawn. Defaults to ticking the stores. */
	update?: (dt: number) => void
}

/** Ticks the stores that go by time. The ambush and run tracks fill in the rules behind these. */
export function update(dt: number): void {
	run.tick(dt)
	const open = ambush.get()
	if (open.open) {
		ambush.tick(dt)
		if (open.seconds > 0) ninjas.advance(1 - ambush.get().secondsLeft / open.seconds)
	}
}

/**
 * Starts the loop and keeps it running until `signal` aborts. Auto-pauses the run when the page
 * goes to the background ([pause](../../../docs/design/screens.md#6-pause)).
 */
export function startLoop(loop: Loop, signal: AbortSignal): void {
	const step = loop.update ?? update
	let frame = 0
	let last = performance.now()

	const tick = (now: number) => {
		const delta = Math.min((now - last) / 1000, runConfig.maximumDelta)
		last = now
		const { phase, worldScale } = run.get()
		if (phase !== 'paused') step(delta * worldScale)
		loop.render(delta)
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
			run.pause()
			stop()
		} else if (frame === 0) {
			start()
		}
	}, { signal })

	signal.addEventListener('abort', stop, { once: true })
	start()
}
