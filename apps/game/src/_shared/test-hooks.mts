/**
 * What the app's own tests can switch on, to take pictures and videos of it that come out the same
 * every time (#144): `e2e/stage-pictures.spec.mts`, `scripts/how-to-play-video.mts`.
 *
 * A test sets them before the page loads, `page.addInitScript(() => { window.bunbuTestHooks = { … } })`.
 * They are read in the dev server and in a build made for the tests (`vite build --mode e2e`), and
 * nowhere else: the build that is deployed doesn't have this code at all, so nobody can switch them
 * on there, by the address or otherwise.
 */

export type TestHooks = {
	/** Leaves the samurai and the ninjas out of the world: the stage pictures are of its scenery. */
	readonly scenery: boolean
	/**
	 * Lays every run's stage out from this seed, whatever else drew on `Math.random` before (the
	 * sound's noise draws as many as its sample rate, which differs between machines).
	 */
	readonly seed: number | undefined
}

const none: TestHooks = { scenery: false, seed: undefined }

declare global {
	interface Window {
		/** Set by a test before the page loads ({@link testHooks}). */
		bunbuTestHooks?: Partial<TestHooks>
	}
}

/** Whether this build reads the tests' hooks: the dev server and a build for the tests, never the deployed one. */
const forTests = import.meta.env.DEV || import.meta.env.MODE === 'e2e'

/** The hooks a test has switched on, or none. */
export function testHooks(): TestHooks {
	if (!forTests || typeof window === 'undefined') return none
	return { ...none, ...window.bunbuTestHooks }
}
