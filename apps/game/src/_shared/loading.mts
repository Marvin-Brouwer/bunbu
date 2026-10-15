/**
 * The loading screen ([0 Loading](../../../../docs/design/screens.md#0-loading)): it is in the page
 * itself (`index.html`), so it covers the screen from the first paint, and fades out once the
 * first screen has settled: the saved quizzes back, the fonts in, and the models its world asked
 * for loaded. That way the buttons and the world don't flicker in one by one.
 */

import { modelsSettled } from '../canvas/models.mts'
import { library } from './storage/library.mts'

/** It never waits longer than this, so a slow model doesn't keep the player out. */
const longestSeconds = 6

const nextFrame = () => new Promise<void>((resolve) => { requestAnimationFrame(() => { resolve() }) })

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
	await Promise.all([libraryRestored(signal), document.fonts.ready])
	// A frame first, so the screen has put its world on the canvas and asked for its models.
	await nextFrame()
	await modelsSettled()
	// Then a frame drawn with them, so it fades onto a world that is all there.
	await nextFrame()
	await nextFrame()
}

/** Fades the loading screen out once the first screen has settled, or after {@link longestSeconds}. */
export function hideLoading(signal: AbortSignal): void {
	const screen = document.getElementById('opening')
	if (screen === null) return
	const timeout = new Promise<void>((resolve) => { setTimeout(resolve, longestSeconds * 1000) })
	void Promise.race([settled(signal), timeout]).then(() => {
		screen.classList.add('settled')
		// After its fade (index.html), timed rather than on `transitionend`, which a hidden tab never sends.
		setTimeout(() => { screen.remove() }, 500)
	})
}
