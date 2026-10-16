/**
 * The loading screen ([0 Loading](../../../../docs/design/screens.md#0-loading)): it is in the page
 * itself (`index.html`), so it covers the screen from the first paint, and fades out once the
 * first screen has settled: its route in, the saved quizzes back, the fonts in, and the models its
 * world asked for loaded. That way the buttons and the world don't flicker in one by one.
 *
 * Until then the app under it is `inert` (`index.html`), so no key or screen reader reaches what
 * can't be seen, and what would open over it, as the terms asked again, waits for {@link loaded}.
 */

import { modelsSettled } from '../canvas/models.mts'
import { library } from './storage/library.mts'

/** It never waits longer than this, so a slow model doesn't keep the player out. */
const longestSeconds = 6

const nextFrame = () => new Promise<void>((resolve) => { requestAnimationFrame(() => { resolve() }) })

/**
 * Whether the router has put the first screen up: a lazily loaded route comes in a moment later.
 * The screen's place is marked by the `Application` (`data-screen`), the router in it, and the
 * route's screen in that; Rooted's own component names are there in development only.
 */
const routed = () => document.querySelector('[data-screen] > * > *') !== null

function firstScreen(signal: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		if (routed()) {
			resolve()
			return
		}
		const watch = new MutationObserver(() => {
			if (!routed()) return
			watch.disconnect()
			resolve()
		})
		watch.observe(document.body, { childList: true, subtree: true })
		signal.addEventListener('abort', () => { watch.disconnect() }, { once: true })
	})
}

let gone: () => void = () => undefined
const goneAway = new Promise<void>((resolve) => { gone = resolve })

/** Resolves once the loading screen has gone, or at once where there is none: then the app is the player's. */
export function loaded(): Promise<void> {
	return document.getElementById('opening') === null ? Promise.resolve() : goneAway
}

function libraryRestored(signal: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		if (library.value.restored) {
			resolve()
			return
		}
		library.on('change', signal, ({ detail }) => {
			if (detail.state.restored) resolve()
		})
	})
}

/** Everything the first screen waits for, and then the models a lazily loaded route asked for after. */
async function settled(signal: AbortSignal): Promise<void> {
	await Promise.all([firstScreen(signal), libraryRestored(signal), document.fonts.ready])
	// A frame first, so the screen has put its world on the canvas and asked for its models.
	await nextFrame()
	await modelsSettled()
	// Then a frame drawn with them, so it fades onto a world that is all there.
	await nextFrame()
	await nextFrame()
}

/**
 * Fades the loading screen out once the first screen has settled, or after {@link longestSeconds}.
 * Call it before anything that can fail, such as making the WebGL renderer, so the time limit
 * still holds when it does.
 */
export function hideLoading(signal: AbortSignal): void {
	const screen = document.getElementById('opening')
	if (screen === null) return
	const timeout = new Promise<void>((resolve) => { setTimeout(resolve, longestSeconds * 1000) })
	void Promise.race([settled(signal), timeout]).then(() => {
		document.getElementById('app')?.removeAttribute('inert')
		gone()
		screen.classList.add('settled')
		// After its fade (index.html), timed rather than on `transitionend`, which a hidden tab never sends.
		setTimeout(() => { screen.remove() }, 500)
	})
}
